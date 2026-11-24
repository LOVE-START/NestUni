// routes/events.js - 活动相关路由
const express = require('express');
const moment = require('moment');
const db = require('../config/database');
const { verifyToken, optionalAuth, requireAdmin } = require('../middleware/auth');
const { requireClubLeader } = require('../middleware/clubLeader');
const logger = require('../config/logger');
const { deletePhysicalFile, deletePhysicalFiles } = require('../utils/fileUtils');
const { checkAndAwardBadge } = require('./badges');
const eventService = require('../services/eventService');
const { BusinessError } = require('../utils/errors');

// 引入公共工具函数
const {
  safeJsonParse,
  processImagesField,
  parseImagesField,
  getPaginationParams,
  buildPaginationResponse,
  processJsonFields,
  formatDate,
  parseEmptyAsNull,
  parseNumberField,
  processTagsField,
  processRequirementsField
} = require('../utils/helpers');

const {
  validateEventExists,
  validateClubExists,
  validateEventClubRelation,
  isValidEventStatus,
  isValidImageType,
  buildNotFoundError,
  buildBadRequestError
} = require('../utils/validators');

const {
  removeImageFromRecord,
  deleteAllEventImages
} = require('../utils/imageHandlers');
const notifyService = require('../services/notifyService');
const { createApproval, ApprovalTargetType } = require('../utils/approvalHelper');
const { cancelEventReminder } = require('../services/schedulerService');

const router = express.Router();

/**
 * 计算活动状态
 * @description 根据活动日期和状态计算显示状态
 * @param {Object} event - 活动对象
 * @returns {Object} 状态信息
 */
function calculateEventStatus(event) {
  if (!event.date) {
    return { statusText: '未知', statusClass: 'unknown', color: '#999999' };
  }
  
  const today = moment().startOf('day');
  const eventDay = moment(event.date).startOf('day');
  
  if (event.status === 'cancelled') {
    return { statusText: '已取消', statusClass: 'cancelled', color: '#999999' };
  }
  
  if (event.status === 'completed') {
    return { statusText: '已结束', statusClass: 'ended', color: '#999999' };
  }
  
  if (eventDay.isAfter(today)) {
    const diffDays = eventDay.diff(today, 'days');
    if (diffDays === 1) {
      return { statusText: '明天', statusClass: 'upcoming', color: '#4facfe' };
    } else if (diffDays <= 7) {
      return { statusText: `${diffDays}天后`, statusClass: 'upcoming', color: '#4facfe' };
    }
    return { statusText: '即将开始', statusClass: 'upcoming', color: '#4facfe' };
  }
  
  if (eventDay.isSame(today)) {
    return { statusText: '进行中', statusClass: 'ongoing', color: '#52c41a' };
  }
  
  return { statusText: '已结束', statusClass: 'ended', color: '#999999' };
}

/**
 * 处理活动JSON字段
 * @description 统一处理活动的tags, images, requirements字段
 * @param {Object} event - 活动对象
 * @returns {Object} 处理后的活动对象
 */
function processEventJsonFields(event) {
  return {
    ...event,
    tags: safeJsonParse(event.tags, []),
    images: parseImagesField(event.images),
    requirements: safeJsonParse(event.requirements, [])
  };
}

/**
 * 处理活动更新数据
 * @description 统一处理活动创建/更新时的数据格式
 * @param {Object} data - 原始数据
 * @param {Object} existingEvent - 现有活动数据（更新时使用）
 * @returns {Object} 处理后的数据
 */
function processEventData(data, existingEvent = null) {
  const processed = { ...data };
  
  // 处理日期格式
  if (processed.date) {
    processed.date = formatDate(processed.date);
  }
  
  // 处理报名截止日期
  if (processed.registration_deadline) {
    processed.registration_deadline = formatDate(processed.registration_deadline);
  } else if (existingEvent) {
    processed.registration_deadline = existingEvent.registration_deadline;
  }
  
  // 处理JSON字段
  if (processed.tags !== undefined) {
    processed.tags = processTagsField(processed.tags);
  } else if (existingEvent) {
    processed.tags = existingEvent.tags;
  }
  
  if (processed.images !== undefined) {
    processed.images = processImagesField(processed.images);
  } else if (existingEvent) {
    processed.images = existingEvent.images;
  }
  
  if (processed.requirements !== undefined) {
    processed.requirements = processRequirementsField(processed.requirements);
  } else if (existingEvent) {
    processed.requirements = existingEvent.requirements;
  }
  
  // 处理数字字段
  if (processed.latitude !== undefined) {
    processed.latitude = parseNumberField(processed.latitude);
  }
  if (processed.longitude !== undefined) {
    processed.longitude = parseNumberField(processed.longitude);
  }
  if (processed.max_participants !== undefined) {
    processed.max_participants = parseNumberField(processed.max_participants);
  }
  
  // 处理空字符串字段
  const emptyFields = ['cover_image', 'category', 'description', 'organizer', 'contact'];
  emptyFields.forEach(field => {
    if (processed[field] !== undefined) {
      processed[field] = parseEmptyAsNull(processed[field]);
    }
  });
  
  // 移除不应更新的字段
  delete processed.id;
  delete processed.created_at;
  delete processed.current_participants;
  delete processed.club_ids;
  
  return processed;
}

/**
 * 获取活动关联的社团信息
 * @param {number} eventId - 活动ID
 * @returns {Promise<Array>} 社团列表
 */
async function getEventRelatedClubs(eventId) {
  return db('clubs')
    .select('clubs.id', 'clubs.name', 'clubs.logo')
    .join('event_clubs', 'clubs.id', 'event_clubs.club_id')
    .where('event_clubs.event_id', eventId);
}

/**
 * 检查用户是否已报名活动
 * @param {number} eventId - 活动ID
 * @param {number} userId - 用户ID
 * @returns {Promise<boolean>} 是否已报名
 */
async function checkUserJoined(eventId, userId) {
  if (!userId) return false;
  
  const participation = await db('event_participants')
    .where({ event_id: eventId, user_id: userId })
    .whereIn('status', ['pending', 'approved', 'checked_in'])
    .first();
  
  return !!participation;
}

/**
 * 获取活动参与者列表
 * @param {number} eventId - 活动ID
 * @param {number} limit - 限制数量
 * @returns {Promise<Array>} 参与者列表
 */
async function getEventParticipants(eventId, limit = 20) {
  return db('event_participants')
    .select(
      'users.nickname',
      'users.avatar as avatar_url',
      'users.student_id',
      'event_participants.status as participation_status',
      'event_participants.registered_at'
    )
    .join('users', 'event_participants.user_id', 'users.id')
    .where({ 'event_participants.event_id': eventId })
    .whereIn('event_participants.status', ['pending', 'approved', 'checked_in'])
    .orderBy('event_participants.registered_at', 'desc')
    .limit(limit);
}

/**
 * 社团会长删除活动
 * @route DELETE /nfunest/api/events/:id/club/:clubId
 */
router.delete('/:id/club/:clubId', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const clubId = parseInt(req.params.clubId, 10);
    
    if (isNaN(id)) {
      return res.status(400).json(buildBadRequestError('无效的ID参数'));
    }

    const eventClub = await validateEventClubRelation(id, clubId);
    if (!eventClub) {
      return res.status(404).json(buildNotFoundError('活动不存在或不属于您的社团'));
    }

    const event = await validateEventExists(id);
    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    // 删除活动相关的物理文件
    await deleteAllEventImages(event, req.user.id, 'leader');

    // 取消活动提醒
    cancelEventReminder(id);

    // 软删除，将状态改为cancelled
    await db('events').where({ id }).update({ 
      status: 'cancelled',
      updated_at: db.fn.now()
    });

    logger.info('会长删除活动:', { eventId: id, clubId, userId: req.user.id });

    res.json({
      success: true,
      message: '活动删除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 记录地图查看（触发羽章）
 * @route POST /nfunest/api/events/map-viewed
 * @description 用户查看活动地图时触发羽章
 */
router.post('/map-viewed', verifyToken, async (req, res, next) => {
  try {
    // 触发羽章检查（异步执行，不阻塞响应）
    setImmediate(async () => {
      try {
        await checkAndAwardBadge(req.user.id, 'event.map_viewed');
      } catch (badgeError) {
        logger.error('羽章检查失败:', { error: badgeError.message, userId: req.user.id });
      }
    });

    res.json({
      success: true,
      message: '地图查看记录成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取活动地图数据
 * @route POST /nfunest/api/events/map
 * @description 获取带位置信息的活动列表，用于地图展示，只返回已审核通过的活动
 */
router.post('/map', optionalAuth, async (req, res, next) => {
  try {
    const { dateStart, dateEnd, dateFilter = 'all' } = req.body;
    
    let query = db('events')
      .select(
        'events.id', 'events.title', 'events.date', 'events.time', 'events.location',
        'events.latitude', 'events.longitude', 'events.location_name',
        'events.cover_image', 'events.category', 'events.status',
        'events.max_participants', 'events.current_participants'
      )
      .whereNotNull('events.latitude')
      .whereNotNull('events.longitude')
      .where('events.status', 'published')
      .where('events.approval_status', 'approved');

    const today = moment().startOf('day');
    const weekEnd = moment().endOf('week');

    switch (dateFilter) {
      case 'today':
        query = query.where('events.date', today.format('YYYY-MM-DD'));
        break;
      case 'week':
        query = query.whereBetween('events.date', [today.format('YYYY-MM-DD'), weekEnd.format('YYYY-MM-DD')]);
        break;
      case 'custom':
        if (dateStart) query = query.where('events.date', '>=', formatDate(dateStart));
        if (dateEnd) query = query.where('events.date', '<=', formatDate(dateEnd));
        break;
    }

    const events = await query.orderBy('events.date', 'asc');

    const processedEvents = events.map(event => {
      const statusInfo = calculateEventStatus(event);
      return {
        ...event,
        ...statusInfo,
        canJoin: event.max_participants ? event.current_participants < event.max_participants : true
      };
    });

    res.json({
      success: true,
      data: processedEvents
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取附近活动
 * @route POST /nfunest/api/events/nearby
 * @description 根据用户位置获取附近的活动，只返回已审核通过的活动
 */
router.post('/nearby', optionalAuth, async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 5, limit = 10 } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json(buildBadRequestError('请提供位置信息'));
    }

    const events = await db('events')
      .select(
        'events.id', 'events.title', 'events.date', 'events.time', 'events.location',
        'events.latitude', 'events.longitude', 'events.location_name',
        'events.cover_image', 'events.category', 'events.status',
        'events.max_participants', 'events.current_participants'
      )
      .whereNotNull('events.latitude')
      .whereNotNull('events.longitude')
      .where('events.status', 'published')
      .where('events.approval_status', 'approved')
      .whereRaw(`
        (6371 * acos(
          cos(radians(?)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians(?)) + 
          sin(radians(?)) * sin(radians(latitude))
        )) <= ?
      `, [latitude, longitude, latitude, radius])
      .orderByRaw(`
        (6371 * acos(
          cos(radians(?)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians(?)) + 
          sin(radians(?)) * sin(radians(latitude))
        )) ASC
      `, [latitude, longitude, latitude])
      .limit(limit);

    const processedEvents = events.map(event => {
      const statusInfo = calculateEventStatus(event);
      return {
        ...event,
        ...statusInfo,
        canJoin: event.max_participants ? event.current_participants < event.max_participants : true
      };
    });

    res.json({
      success: true,
      data: processedEvents
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取活动列表 - 仅支持POST方法
 * @description 只返回已审核通过的活动
 * @route POST /nfunest/api/events
 */
router.post('/', optionalAuth, getEventsList);

/**
 * 活动列表处理函数
 * @description 只返回 status = 'published' 且 approval_status = 'approved' 的活动
 */
async function getEventsList(req, res, next) {
  try {
    const { page = 1, pageSize = 20, category, keyword, dateStart, dateEnd } = req.body;
    const { offset } = getPaginationParams(req.body);

    let query = db('events')
      .select(
        'events.id', 'events.title', 'events.date', 'events.time', 'events.location',
        'events.cover_image', 'events.images', 'events.category', 'events.status', 'events.max_participants',
        'events.current_participants', 'events.registration_deadline', 'events.description',
        'events.organizer', 'events.contact', 'events.tags', 'events.requirements',
        'events.created_by', 'events.created_at', 'events.updated_at'
      )
      .where('events.status', 'published')
      .where('events.approval_status', 'approved');

    if (keyword) {
      query = query.where(function() {
        this.where('events.title', 'like', `%${keyword}%`)
            .orWhere('events.description', 'like', `%${keyword}%`)
            .orWhere('events.organizer', 'like', `%${keyword}%`);
      });
    }

    if (category) {
      query = query.where('events.category', category);
    }

    const processedDateStart = formatDate(dateStart);
    const processedDateEnd = formatDate(dateEnd);
    
    if (processedDateStart) query = query.where('events.date', '>=', processedDateStart);
    if (processedDateEnd) query = query.where('events.date', '<=', processedDateEnd);

    query = query.leftJoin(
      db('event_clubs')
        .select('event_clubs.event_id', 
          db.raw('GROUP_CONCAT(clubs.id) as club_ids'), 
          db.raw('GROUP_CONCAT(clubs.name) as club_names'), 
          db.raw('GROUP_CONCAT(clubs.logo) as club_logos'))
        .join('clubs', 'event_clubs.club_id', 'clubs.id')
        .groupBy('event_clubs.event_id')
        .as('event_club_info'),
      'events.id',
      'event_club_info.event_id'
    ).select('event_club_info.club_ids', 'event_club_info.club_names', 'event_club_info.club_logos');

    const events = await query
      .orderBy('events.date', 'asc')
      .orderBy('events.id', 'desc')
      .limit(pageSize)
      .offset(offset);

    /**
     * 批量查询优化 - 避免N+1问题
     * @description 将循环内的多次查询改为批量查询，显著提升性能
     */
    const eventIds = events.map(e => e.id);
    
    // 批量查询用户参与的活动ID（一次查询代替N次）
    let userJoinedEventIds = new Set();
    if (req.user?.id && eventIds.length > 0) {
      const participations = await db('event_participants')
        .select('event_id')
        .where({ user_id: req.user.id })
        .whereIn('event_id', eventIds)
        .whereIn('status', ['pending', 'approved', 'checked_in']);
      userJoinedEventIds = new Set(participations.map(p => p.event_id));
    }

    // 批量查询所有活动的参与者（一次查询代替N次）
    let allParticipants = {};
    if (eventIds.length > 0) {
      const participants = await db('event_participants')
        .select(
          'event_participants.event_id',
          'users.nickname',
          'users.avatar as avatar_url',
          'users.student_id',
          'event_participants.status as participation_status',
          'event_participants.registered_at'
        )
        .join('users', 'event_participants.user_id', 'users.id')
        .whereIn('event_participants.event_id', eventIds)
        .whereIn('event_participants.status', ['pending', 'approved', 'checked_in'])
        .orderBy('event_participants.registered_at', 'desc');
      
      // 按活动ID分组，每个活动最多取20个参与者
      participants.forEach(p => {
        if (!allParticipants[p.event_id]) {
          allParticipants[p.event_id] = [];
        }
        if (allParticipants[p.event_id].length < 20) {
          allParticipants[p.event_id].push({
            nickname: p.nickname,
            avatar_url: p.avatar_url,
            student_id: p.student_id,
            participation_status: p.participation_status,
            registered_at: p.registered_at
          });
        }
      });
    }

    const processedEvents = events.map((event) => {
      let relatedClubs = [];
      if (event.club_ids && event.club_names) {
        const clubIds = event.club_ids.split(',').map(id => parseInt(id));
        const clubNames = event.club_names.split(',');
        const clubLogos = event.club_logos ? event.club_logos.split(',') : [];
        relatedClubs = clubIds.map((id, index) => ({
          id: id,
          name: clubNames[index],
          logo: clubLogos[index] || null
        }));
      }

      const processedEvent = processEventJsonFields(event);
      processedEvent.related_clubs = relatedClubs;
      processedEvent.isJoined = userJoinedEventIds.has(event.id);
      processedEvent.recent_participants = allParticipants[event.id] || [];

      return processedEvent;
    });

    let countQuery = db('events')
      .where('events.status', 'published')
      .where('approval_status', 'approved');
    if (keyword) {
      countQuery = countQuery.where(function() {
        this.where('events.title', 'like', `%${keyword}%`)
            .orWhere('events.description', 'like', `%${keyword}%`)
            .orWhere('events.organizer', 'like', `%${keyword}%`);
      });
    }
    if (category) countQuery = countQuery.where('events.category', category);
    if (processedDateStart) countQuery = countQuery.where('events.date', '>=', processedDateStart);
    if (processedDateEnd) countQuery = countQuery.where('events.date', '<=', processedDateEnd);

    const [{ count }] = await countQuery.count('events.id as count');

    res.json({
      success: true,
      data: processedEvents,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 批量获取活动详情
 * @description 根据活动ID列表批量获取活动详情，用于AI推荐卡片展示，只返回已审核通过的活动
 * @route GET /nfunest/api/events/by-ids
 */
router.get('/by-ids', optionalAuth, async (req, res, next) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json(buildBadRequestError('缺少活动ID列表'));
    }
    
    const idList = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (idList.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const events = await db('events')
      .select(
        'id', 'title', 'date', 'time', 'location', 'category', 'status',
        'cover_image', 'description', 'organizer', 'max_participants',
        'current_participants', 'registration_deadline'
      )
      .whereIn('id', idList)
      .where({ status: 'published' })
      .where({ approval_status: 'approved' });

    // [ADD] 按请求ID顺序返回：附近活动按距离排序传入，卡片顺序需与排序结果一致
    const eventMap = new Map(events.map(e => [e.id, e]));
    const orderedEvents = idList.filter(id => eventMap.has(id)).map(id => eventMap.get(id));

    const eventIds = orderedEvents.map(e => e.id);
    const eventClubs = await db('clubs')
      .select('clubs.id', 'clubs.name', 'clubs.logo', 'event_clubs.event_id')
      .join('event_clubs', 'clubs.id', 'event_clubs.club_id')
      .whereIn('event_clubs.event_id', eventIds);
    
    const eventClubsMap = {};
    eventClubs.forEach(ec => {
      if (!eventClubsMap[ec.event_id]) eventClubsMap[ec.event_id] = [];
      eventClubsMap[ec.event_id].push({
        id: ec.id,
        name: ec.name,
        logo: ec.logo
      });
    });
    
    const processedEvents = orderedEvents.map(event => ({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
      category: event.category,
      status: event.status,
      coverImage: event.cover_image,
      description: event.description,
      organizer: event.organizer,
      maxParticipants: event.max_participants,
      currentParticipants: event.current_participants,
      registrationDeadline: event.registration_deadline,
      relatedClubs: eventClubsMap[event.id] || []
    }));
    
    res.json({ success: true, data: processedEvents });
  } catch (error) {
    logger.error('批量获取活动失败:', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * 获取用户参与的活动列表
 * @route GET /nfunest/api/events/my
 */
router.get('/my', verifyToken, async (req, res, next) => {
  try {
    if (!req.user || !req.userType) {
      return res.status(403).json({
        success: false,
        error: '需要登录才能查看参与的活动'
      });
    }

    const userEvents = await db('events')
      .select(
        'events.id', 'events.title', 'events.date', 'events.time', 'events.location',
        'events.cover_image', 'events.images', 'events.category', 'events.status', 'events.max_participants',
        'events.current_participants', 'events.registration_deadline', 'events.description',
        'events.organizer', 'events.contact', 'events.tags', 'events.requirements',
        'events.created_by', 'events.created_at', 'events.updated_at',
        'event_participants.status as participation_status', 'event_participants.registered_at'
      )
      .join('event_participants', 'events.id', 'event_participants.event_id')
      .where('event_participants.user_id', req.user.id)
      .whereIn('event_participants.status', ['pending', 'approved', 'checked_in'])
      .orderBy('event_participants.registered_at', 'desc');

    const processedEvents = userEvents.map(event => processEventJsonFields(event));

    logger.info('用户参与的活动列表获取成功:', { userId: req.user.id, count: processedEvents.length });

    res.json({
      success: true,
      data: processedEvents
    });
  } catch (error) {
    logger.error('获取用户参与的活动列表失败:', {
      error: error.message,
      stack: error.stack,
      userId: req.user.id
    });
    return res.status(500).json({
      success: false,
      error: '获取参与的活动列表失败，请稍后重试'
    });
  }
});

/**
 * 获取活动详情
 * @description 只返回已审核通过的活动
 * @route GET /nfunest/api/events/:id
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await db('events')
      .select(
        'id', 'title', 'date', 'time', 'location',
        'latitude', 'longitude', 'location_name',
        'cover_image', 'images', 'category', 'status', 'max_participants',
        'current_participants', 'registration_deadline', 'description',
        'organizer', 'contact', 'tags', 'requirements',
        'created_by', 'created_at', 'updated_at'
      )
      .where('id', id)
      .where('status', 'published')
      .where('approval_status', 'approved')
      .first();

    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    const relatedClubs = await getEventRelatedClubs(id);
    
    const processedEvent = processEventJsonFields(event);
    processedEvent.related_clubs = relatedClubs;
    processedEvent.isJoined = await checkUserJoined(id, req.user?.id);
    processedEvent.recent_participants = await getEventParticipants(id, 20);

    res.json({
      success: true,
      data: processedEvent
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 报名参加活动
 * @route POST /nfunest/api/events/:id/join
 * [MODIFY] 业务逻辑下沉到eventService，与Agent工具共用同一套规则
 */
router.post('/:id/join', verifyToken, async (req, res, next) => {
  try {
    await eventService.enrollUser(parseInt(req.params.id), req.user.id);
    res.json({
      success: true,
      message: '报名成功'
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json(buildBadRequestError(error.message));
    }
    next(error);
  }
});

/**
 * 取消报名
 * @route DELETE /nfunest/api/events/:id/join
 * [MODIFY] 业务逻辑下沉到eventService
 */
router.delete('/:id/join', verifyToken, async (req, res, next) => {
  try {
    await eventService.cancelEnrollment(parseInt(req.params.id), req.user.id);
    res.json({
      success: true,
      message: '取消报名成功'
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json(buildBadRequestError(error.message));
    }
    next(error);
  }
});

/**
 * 创建活动（需要管理员权限）
 * @route POST /nfunest/api/events/create
 */
router.post('/create', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, date, time, location, club_ids, status = 'published' } = req.body;

    if (!title || !date || !time || !location) {
      return res.status(400).json(buildBadRequestError('请填写活动标题、日期、时间和地点'));
    }

    const eventData = processEventData(req.body);
    eventData.status = status;
    eventData.created_by = req.userType === 'admin' ? null : req.user.id;
    eventData.created_at = db.fn.now();
    eventData.updated_at = db.fn.now();

    const eventId = await db.transaction(async (trx) => {
      const [id] = await trx('events').insert(eventData);
      
      if (club_ids && Array.isArray(club_ids)) {
        for (const club_id of club_ids) {
          const club = await trx('clubs').where({ id: club_id }).first();
          if (club) {
            await trx('event_clubs').insert({ event_id: id, club_id });
          }
        }
      }
      
      return id;
    });

    const newEvent = await db('events').where({ id: eventId }).first();

    logger.info('创建活动:', { eventId, adminId: req.user.id });

    res.status(201).json({
      success: true,
      message: '活动创建成功',
      data: processEventJsonFields(newEvent)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 社团会长创建活动
 * @description 创建活动后进入审核流程，审核通过后才对外显示
 * @route POST /nfunest/api/events/club/:clubId
 */
router.post('/club/:clubId', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const clubId = parseInt(req.params.clubId, 10);
    
    const { title, date, time, location } = req.body;

    if (!title || !date || !time || !location) {
      return res.status(400).json(buildBadRequestError('请填写活动标题、日期、时间和地点'));
    }

    const eventData = processEventData(req.body);
    eventData.status = 'draft';
    eventData.approval_status = 'pending';
    eventData.created_by = req.userType === 'admin' ? null : req.user.id;
    eventData.created_at = db.fn.now();
    eventData.updated_at = db.fn.now();

    const [eventId] = await db('events').insert(eventData);

    await db('event_clubs').insert({ event_id: eventId, club_id: clubId });

    if (req.body.club_ids && Array.isArray(req.body.club_ids)) {
      const additionalClubIds = req.body.club_ids
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id) && id !== clubId);
      
      for (const additionalClubId of additionalClubIds) {
        const clubExists = await db('clubs').where({ id: additionalClubId }).first();
        if (clubExists) {
          await db('event_clubs').insert({ event_id: eventId, club_id: additionalClubId });
        }
      }
    }

    const newEvent = await db('events').where({ id: eventId }).first();

    await createApproval({
      targetType: ApprovalTargetType.EVENT,
      targetId: eventId,
      clubId: clubId,
      applicantId: req.user.id
    });

    logger.info('会长创建活动（待审核）:', { eventId, clubId, userId: req.user.id });

    res.status(201).json({
      success: true,
      message: '活动已提交，等待审核',
      data: processEventJsonFields(newEvent)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 更新活动（需要管理员权限）
 * @route PUT /nfunest/api/events/:id
 */
router.put('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, date, time, location } = req.body;

    const event = await validateEventExists(id);
    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    if (!title || !date || !time || !location) {
      return res.status(400).json(buildBadRequestError('请填写活动标题、日期、时间和地点'));
    }

    const updateData = processEventData(req.body, event);
    updateData.updated_at = db.fn.now();

    await db.transaction(async (trx) => {
      await trx('events').where({ id }).update(updateData);
      
      if (req.body.club_ids !== undefined) {
        await trx('event_clubs').where({ event_id: id }).delete();
        
        if (Array.isArray(req.body.club_ids)) {
          for (const club_id of req.body.club_ids) {
            const club = await trx('clubs').where({ id: club_id }).first();
            if (club) {
              await trx('event_clubs').insert({ event_id: id, club_id });
            }
          }
        }
      }
    });

    const updatedEvent = await db('events').where({ id }).first();

    logger.info('更新活动:', { eventId: id, adminId: req.user.id });

    res.json({
      success: true,
      message: '活动更新成功',
      data: processEventJsonFields(updatedEvent)
    });
  } catch (error) {
    logger.error('更新活动失败:', {
      error: error.message,
      stack: error.stack,
      eventId: req.params.id,
      adminId: req.user?.id
    });
    next(error);
  }
});

/**
 * 社团会长更新活动
 * @route PUT /nfunest/api/events/:id/club/:clubId
 */
router.put('/:id/club/:clubId', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const clubId = parseInt(req.params.clubId, 10);
    
    if (isNaN(id)) {
      return res.status(400).json(buildBadRequestError('无效的ID参数'));
    }

    const eventClub = await validateEventClubRelation(id, clubId);
    if (!eventClub) {
      return res.status(404).json(buildNotFoundError('活动不存在或不属于您的社团'));
    }

    const event = await validateEventExists(id);
    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    const { title, date, time, location } = req.body;
    if (!title || !date || !time || !location) {
      return res.status(400).json(buildBadRequestError('请填写活动标题、日期、时间和地点'));
    }

    const updateData = processEventData(req.body, event);
    updateData.updated_at = db.fn.now();

    await db.transaction(async (trx) => {
      await trx('events').where({ id }).update(updateData);
      
      if (req.body.club_ids !== undefined) {
        await trx('event_clubs').where({ event_id: id }).delete();
        
        if (Array.isArray(req.body.club_ids)) {
          for (const club_id of req.body.club_ids) {
            const club = await trx('clubs').where({ id: club_id }).first();
            if (club) {
              await trx('event_clubs').insert({ event_id: id, club_id });
            }
          }
        }
      }
    });

    const updatedEvent = await db('events').where({ id }).first();

    logger.info('会长更新活动:', { eventId: id, clubId, userId: req.user.id });

    res.json({
      success: true,
      message: '活动更新成功',
      data: processEventJsonFields(updatedEvent)
    });
  } catch (error) {
    logger.error('会长更新活动失败:', {
      error: error.message,
      stack: error.stack,
      eventId: req.params.id,
      clubId: req.params.clubId,
      userId: req.user?.id
    });
    next(error);
  }
});

/**
 * 删除活动（需要管理员权限）
 * @route DELETE /nfunest/api/events/:id
 */
router.delete('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await validateEventExists(id);
    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    // 删除活动相关的物理文件
    await deleteAllEventImages(event, req.user.id, 'admin');

    // 取消活动提醒
    cancelEventReminder(parseInt(id));

    // 软删除
    await db('events').where({ id }).update({ 
      status: 'cancelled',
      updated_at: db.fn.now()
    });

    logger.info('删除活动:', { eventId: id, adminId: req.user.id });

    res.json({
      success: true,
      message: '活动删除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 社团会长修改活动状态
 * @route PATCH /nfunest/api/events/:id/club/:clubId/status
 */
router.patch('/:id/club/:clubId/status', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const clubId = parseInt(req.params.clubId, 10);
    const { status } = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json(buildBadRequestError('无效的ID参数'));
    }

    if (!isValidEventStatus(status)) {
      return res.status(400).json(buildBadRequestError('无效的状态值'));
    }

    const eventClub = await validateEventClubRelation(id, clubId);
    if (!eventClub) {
      return res.status(404).json(buildNotFoundError('活动不存在或不属于您的社团'));
    }

    const event = await validateEventExists(id);
    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    // 如果状态改为 cancelled，取消活动提醒
    if (status === 'cancelled') {
      cancelEventReminder(id);
    }

    await db('events').where({ id }).update({ status, updated_at: db.fn.now() });

    logger.info('会长修改活动状态:', { eventId: id, clubId, status, userId: req.user.id });

    res.json({
      success: true,
      message: '活动状态更新成功',
      data: { id, status }
    });
  } catch (error) {
    logger.error('会长修改活动状态失败:', {
      error: error.message,
      stack: error.stack,
      eventId: req.params.id,
      clubId: req.params.clubId,
      userId: req.user?.id
    });
    next(error);
  }
});

/**
 * 社团会长删除活动图片URL
 * @route DELETE /nfunest/api/events/:id/club/:clubId/images
 */
router.delete('/:id/club/:clubId/images', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const clubId = parseInt(req.params.clubId, 10);
    const { imageUrl, imageType } = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json(buildBadRequestError('无效的ID参数'));
    }

    const eventClub = await validateEventClubRelation(id, clubId);
    if (!eventClub) {
      return res.status(404).json(buildNotFoundError('活动不存在或不属于您的社团'));
    }

    const event = await validateEventExists(id);
    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    if (!imageUrl || !imageType) {
      return res.status(400).json(buildBadRequestError('缺少必要参数'));
    }

    const validImageTypes = ['cover_image', 'images'];
    if (!isValidImageType(imageType, validImageTypes)) {
      return res.status(400).json(buildBadRequestError('无效的图片类型'));
    }

    await removeImageFromRecord({
      table: 'events',
      id,
      imageUrl,
      imageType,
      record: event,
      userId: req.user.id,
      userType: 'leader'
    });

    logger.info('会长删除活动图片URL:', { eventId: id, clubId, imageUrl, imageType, userId: req.user.id });

    res.json({
      success: true,
      message: '图片URL删除成功'
    });
  } catch (error) {
    logger.error('会长删除活动图片URL失败:', {
      error: error.message,
      stack: error.stack,
      eventId: req.params.id,
      clubId: req.params.clubId,
      userId: req.user?.id
    });
    next(error);
  }
});

module.exports = router;
