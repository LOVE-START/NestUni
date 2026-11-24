// routes/clubs.js - 社团相关路由
const express = require('express');
const db = require('../config/database');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { requireClubLeader } = require('../middleware/clubLeader');
const logger = require('../config/logger');
const { deletePhysicalFile, deletePhysicalFiles } = require('../utils/fileUtils');
const { checkAndAwardBadge } = require('./badges');
const clubMemberService = require('../services/clubMemberService');
const { BusinessError } = require('../utils/errors');

// 引入公共工具函数
const {
  safeJsonParse,
  processImagesField,
  parseImagesField,
  getPaginationParams,
  buildPaginationResponse,
  processJsonFields,
  cleanUpdateData
} = require('../utils/helpers');

const {
  validateClubExists,
  validateUserExists,
  validateClubMembership,
  isValidClubLevel,
  isValidMemberRole,
  isValidImageType,
  buildNotFoundError,
  buildBadRequestError
} = require('../utils/validators');

const {
  removeImageFromRecord,
  deleteAllClubImages
} = require('../utils/imageHandlers');

const router = express.Router();

// 获取所有社团列表 - 仅支持POST方法（与前端API保持一致）
router.post('/', optionalAuth, getClubsList);

/**
 * 社团列表处理函数
 * @description 获取社团列表，支持搜索和分类筛选，包含招新状态信息
 */
async function getClubsList(req, res, next) {
  try {
    logger.info('开始处理获取社团列表请求');
    
    const { page = 1, pageSize = 20, search, category } = req.body;
    const { offset } = getPaginationParams(req.body);

    logger.info('获取社团列表参数:', { params: req.body, method: req.method });

    let query = db('clubs')
      .select(
        'clubs.id', 'clubs.name', 'clubs.short_intro', 'clubs.description', 'clubs.category', 
        'clubs.level', 'clubs.logo', 'clubs.cover_image', 'clubs.gallery', 'clubs.created_at', 'clubs.updated_at'
      );

    // 搜索功能
    if (search) {
      query = query.where(function() {
        this.where('clubs.name', 'like', `%${search}%`)
            .orWhere('clubs.short_intro', 'like', `%${search}%`)
            .orWhere('clubs.description', 'like', `%${search}%`);
      });
    }

    // 分类筛选
    if (category) {
      query = query.where('clubs.category', category);
    }

    // 添加左连接以获取成员数量（只计算在任成员）
    query = query.leftJoin(
      db('club_members')
        .select('club_id', db.raw('COUNT(*) as member_count'))
        .where('status', 'active')
        .groupBy('club_id')
        .as('member_counts'),
      'clubs.id',
      'member_counts.club_id'
    ).select('member_counts.member_count');

    // 添加左连接以获取招新信息（只获取进行中的招新）
    query = query.leftJoin(
      db('recruitments')
        .select('club_id', 'end_time', 'status as recruitment_status')
        .where('status', 'published')
        .where(function() {
          this.whereNull('end_time')
              .orWhere('end_time', '>', db.fn.now());
        })
        .as('active_recruitments'),
      'clubs.id',
      'active_recruitments.club_id'
    ).select('active_recruitments.end_time as recruitment_end_time', 'active_recruitments.recruitment_status');

    logger.info('执行查询:', query.toString());
    
    const clubs = await query
      .orderBy('clubs.id', 'desc')
      .limit(pageSize)
      .offset(offset);

    logger.info('查询到的社团数量:', clubs.length);

    // 处理JSON字段并添加招新状态
    const processedClubs = clubs.map(club => ({
      ...club,
      gallery: safeJsonParse(club.gallery, []),
      member_count: club.member_count || 0,
      // 判断是否有进行中的招新
      isRecruiting: !!(club.recruitment_status === 'published' && 
                       (!club.recruitment_end_time || new Date(club.recruitment_end_time) > new Date()))
    }));

    // 获取总数
    const totalQuery = db('clubs');
    if (search) {
      totalQuery.where(function() {
        this.where('clubs.name', 'like', `%${search}%`)
            .orWhere('clubs.short_intro', 'like', `%${search}%`)
            .orWhere('clubs.description', 'like', `%${search}%`);
      });
    }
    if (category) {
      totalQuery.where('clubs.category', category);
    }
    
    const [{ count }] = await totalQuery.count('clubs.id as count');

    logger.info('返回社团列表数据');
    res.json({
      success: true,
      data: processedClubs,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    logger.error('获取社团列表失败:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    });
    return res.status(500).json({
      success: false,
      error: '获取社团列表失败，请稍后重试'
    });
  }
}

/**
 * 批量获取社团详情
 * @description 根据社团ID列表批量获取社团详情，用于AI推荐卡片展示
 * @route GET /nfunest/api/clubs/by-ids
 */
router.get('/by-ids', optionalAuth, async (req, res, next) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json(buildBadRequestError('缺少社团ID列表'));
    }
    
    const idList = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (idList.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const clubs = await db('clubs')
      .select('id', 'name', 'short_intro', 'category', 'level', 'logo', 'cover_image')
      .whereIn('id', idList);
    
    // 批量查询成员数
    const memberCounts = await db('club_members')
      .select('club_id')
      .count('* as count')
      .whereIn('club_id', idList)
      .where({ status: 'active' })
      .groupBy('club_id');
    
    const memberCountMap = {};
    memberCounts.forEach(m => {
      memberCountMap[m.club_id] = m.count;
    });
    
    // 组装数据
    const processedClubs = clubs.map(club => ({
      id: club.id,
      name: club.name,
      shortIntro: club.short_intro,
      category: club.category,
      level: club.level,
      logo: club.logo,
      coverImage: club.cover_image,
      memberCount: memberCountMap[club.id] || 0
    }));
    
    res.json({ success: true, data: processedClubs });
  } catch (error) {
    logger.error('批量获取社团失败:', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * 获取用户加入的社团列表
 * @route GET /nfunest/api/clubs/my
 */
router.get('/my', verifyToken, async (req, res, next) => {
  try {
    if (!req.user || !req.userType) {
      return res.status(403).json({
        success: false,
        error: '需要登录才能查看加入的社团'
      });
    }

    // 查询用户加入的社团，包含社团详细信息和用户在社团中的角色
    const userClubs = await db('clubs')
      .select(
        'clubs.id', 'clubs.name', 'clubs.short_intro', 'clubs.description', 'clubs.category', 
        'clubs.level', 'clubs.logo', 'clubs.cover_image', 'clubs.gallery', 'clubs.created_at', 'clubs.updated_at',
        'club_members.role', 'club_members.joined_at'
      )
      .join('club_members', 'clubs.id', 'club_members.club_id')
      .where('club_members.user_id', req.user.id)
      .orderBy('club_members.joined_at', 'desc');

    const processedClubs = userClubs.map(club => ({
      ...club,
      gallery: safeJsonParse(club.gallery, []),
      member_count: club.member_count || 0
    }));

    logger.info('用户加入的社团列表获取成功:', { userId: req.user.id, count: processedClubs.length });

    res.json({
      success: true,
      data: processedClubs
    });
  } catch (error) {
    logger.error('获取用户加入的社团列表失败:', {
      error: error.message,
      stack: error.stack,
      userId: req.user.id
    });
    return res.status(500).json({
      success: false,
      error: '获取加入的社团列表失败，请稍后重试'
    });
  }
});

/**
 * 获取社团详情
 * @route GET /nfunest/api/clubs/:id
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // 并行执行查询
    const [club, memberCountResult] = await Promise.all([
      db('clubs')
        .select(
          'clubs.id', 'clubs.name', 'clubs.short_intro', 'clubs.description', 'clubs.category', 
          'clubs.level', 'clubs.logo', 'clubs.cover_image', 'clubs.gallery', 'clubs.created_at', 'clubs.updated_at'
        )
        .where('clubs.id', id)
        .first(),
      db('club_members')
        .where('club_id', id)
        .where('status', 'active')
        .count('* as member_count')
        .first()
    ]);

    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    const clubWithMemberCount = {
      ...club,
      member_count: memberCountResult ? memberCountResult.member_count : 0,
      gallery: safeJsonParse(club.gallery, [])
    };

    res.json({
      success: true,
      data: clubWithMemberCount
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 用户加入社团
 * @description 用户主动申请加入社团，默认角色为member
 * @route POST /nfunest/api/clubs/:id/join
 */
router.post('/:id/join', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // 验证社团是否存在
    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    // 检查用户是否已经是社团成员
    const existingMember = await validateClubMembership(id, req.user.id);
    if (existingMember) {
      return res.status(400).json(buildBadRequestError('您已经是该社团成员'));
    }

    // 添加用户为社团成员
    await db('club_members').insert({
      club_id: id,
      user_id: req.user.id,
      role: 'member',
      joined_at: db.fn.now()
    });

    logger.info('用户加入社团:', { clubId: id, userId: req.user.id });

    // 触发羽章检查（异步执行，不阻塞响应）
    setImmediate(async () => {
      try {
        await checkAndAwardBadge(req.user.id, 'club.joined');
      } catch (badgeError) {
        logger.error('羽章检查失败:', { error: badgeError.message, userId: req.user.id });
      }
    });

    res.json({
      success: true,
      message: '加入社团成功'
    });
  } catch (error) {
    logger.error('加入社团失败:', {
      error: error.message,
      stack: error.stack,
      clubId: req.params.id,
      userId: req.user?.id
    });
    next(error);
  }
});

/**
 * 社团会长更新社团信息
 * @route PUT /nfunest/api/clubs/:id
 */
router.put('/:id', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // 验证社团是否存在
    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    // 处理level字段
    if (updateData.level !== undefined && !isValidClubLevel(updateData.level)) {
      return res.status(400).json(buildBadRequestError('社团级别只能是 school 或 college'));
    }

    // 处理gallery字段
    if (updateData.gallery !== undefined) {
      if (updateData.gallery && Array.isArray(updateData.gallery)) {
        const cleanGallery = updateData.gallery.filter(url => typeof url === 'string' && url.length > 0);
        updateData.gallery = JSON.stringify(cleanGallery);
        logger.info('处理相册数据:', { original: req.body.gallery, cleaned: cleanGallery });
      } else if (updateData.gallery === null) {
        logger.info('相册数据被明确设置为null，将清空相册');
      } else {
        delete updateData.gallery;
        logger.info('相册数据为空数组或无效值，保持原值不变');
      }
    }

    updateData.updated_at = db.fn.now();
    delete updateData.id;
    delete updateData.created_at;

    await db('clubs').where({ id }).update(updateData);

    const updatedClub = await db('clubs').where({ id }).first();

    const responseClub = {
      ...updatedClub,
      gallery: safeJsonParse(updatedClub.gallery, [])
    };

    logger.info('会长更新社团信息:', { clubId: id, userId: req.user.id });

    res.json({
      success: true,
      message: '社团信息更新成功',
      data: responseClub
    });
  } catch (error) {
    logger.error('更新社团信息失败:', {
      error: error.message,
      stack: error.stack,
      clubId: req.params.id,
      userId: req.user.id
    });
    next(error);
  }
});

/**
 * 获取社团公告
 * @description 返回该社团的所有公告（包括待审核的），用于会长管理
 * @route POST /nfunest/api/clubs/:id/announcements
 */
router.post('/:id/announcements', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, pageSize = 10 } = req.body;
    const { offset } = getPaginationParams(req.body);

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    const announcements = await db('announcements')
      .select('id', 'title', 'content', 'images', 'created_at', 'approval_status')
      .where({ club_id: id })
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const processedAnnouncements = announcements.map(announcement => {
      const processed = {
        ...announcement,
        images: parseImagesField(announcement.images)
      };
      // 拒绝原因需要异步查询，先标记，后面单独处理
      return processed;
    });

    // 为被拒绝的公告查询拒绝原因
    await Promise.all(processedAnnouncements.map(async (announcement) => {
      if (announcement.approval_status === 'rejected') {
        const approval = await db('approvals')
          .select('reject_reason')
          .where({ target_type: 'announcement', target_id: announcement.id })
          .whereNotNull('reject_reason')
          .orderBy('approved_at', 'desc')
          .first();
        announcement.reject_reason = approval ? approval.reject_reason : '';
      }
    }));

    const [{ count }] = await db('announcements')
      .where({ club_id: id })
      .count('id as count');

    res.json({
      success: true,
      data: processedAnnouncements,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取社团成员列表
 * @route GET /nfunest/api/clubs/:id/members
 */
router.get('/:id/members', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (page - 1) * pageSize;

    // 验证社团是否存在
    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    // 构建查询条件
    let query = db('club_members')
      .select(
        'club_members.club_id',
        'club_members.user_id',
        'club_members.role',
        'club_members.status',
        'club_members.joined_at',
        'club_members.graduated_at',
        'users.nickname',
        'users.avatar as avatar_url',
        'users.student_id'
      )
      .join('users', 'club_members.user_id', 'users.id')
      .where({ 'club_members.club_id': id });

    // 如果指定了状态筛选
    if (status) {
      query = query.where({ 'club_members.status': status });
    }

    // 获取社团成员
    const members = await query
      .orderBy('club_members.joined_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    // 构建计数查询
    let countQuery = db('club_members').where({ club_id: id });
    if (status) {
      countQuery = countQuery.where({ status });
    }
    const [{ count }] = await countQuery.count('club_id as count');

    res.json({
      success: true,
      data: members,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 添加社团成员（会长权限）
 * @route POST /nfunest/api/clubs/:id/members
 * [MODIFY] 业务逻辑下沉到clubMemberService，与Agent工具共用
 */
router.post('/:id/members', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, role = 'member' } = req.body;

    await clubMemberService.addMember(parseInt(id), parseInt(userId), role);

    logger.info('会长添加社团成员:', { clubId: id, userId, role, leaderId: req.user.id });

    res.status(201).json({
      success: true,
      message: '成员添加成功'
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      const status = error.message.includes('不存在') ? 404 : 400;
      return res.status(status).json(buildBadRequestError(error.message));
    }
    next(error);
  }
});

/**
 * 更改社团成员角色（会长权限）
 * @route PUT /nfunest/api/clubs/:id/members/:userId
 */
router.put('/:id/members/:userId', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    // 验证社团是否存在
    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    // 验证用户是否存在
    const user = await validateUserExists(userId);
    if (!user) {
      return res.status(404).json(buildNotFoundError('用户'));
    }

    // 验证角色是否有效
    if (!isValidMemberRole(role)) {
      return res.status(400).json(buildBadRequestError('无效的角色'));
    }

    // 不能更改自己的角色
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json(buildBadRequestError('不能更改自己的角色'));
    }

    // 更新成员角色
    await db('club_members')
      .where({ club_id: id, user_id: userId })
      .update({ role });

    logger.info('会长更改社团成员角色:', { clubId: id, userId, newRole: role, leaderId: req.user.id });

    // 触发羽章检查（异步执行，不阻塞响应）
    if (role === 'leader') {
      setImmediate(async () => {
        try {
          await checkAndAwardBadge(userId, 'club.became_leader');
        } catch (badgeError) {
          logger.error('羽章检查失败:', { error: badgeError.message, userId });
        }
      });
    }

    res.json({
      success: true,
      message: '成员角色更新成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 更改社团成员状态（会长权限）- 换届系统
 * @description 标记成员为已毕业或在任状态
 * @route PUT /nfunest/api/clubs/:id/members/:userId/status
 */
router.put('/:id/members/:userId/status', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const { status } = req.body;

    // 验证社团是否存在
    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    // 验证用户是否存在
    const user = await validateUserExists(userId);
    if (!user) {
      return res.status(404).json(buildNotFoundError('用户'));
    }

    // 验证状态是否有效
    const validStatuses = ['active', 'graduated'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(buildBadRequestError('无效的状态，状态只能是 active 或 graduated'));
    }

    // 不能更改自己的状态
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json(buildBadRequestError('不能更改自己的状态'));
    }

    // 更新成员状态
    const updateData = {
      status,
      graduated_at: status === 'graduated' ? db.fn.now() : null
    };

    await db('club_members')
      .where({ club_id: id, user_id: userId })
      .update(updateData);

    logger.info('会长更改社团成员状态:', { 
      clubId: id, 
      userId, 
      newStatus: status, 
      leaderId: req.user.id 
    });

    res.json({
      success: true,
      message: status === 'graduated' ? '已标记为毕业成员' : '已标记为在任成员'
    });
  } catch (error) {
    logger.error('更改成员状态失败:', {
      error: error.message,
      stack: error.stack,
      clubId: req.params.id,
      userId: req.params.userId
    });
    next(error);
  }
});

/**
 * 移除社团成员（会长权限）
 * @route DELETE /nfunest/api/clubs/:id/members/:userId
 */
router.delete('/:id/members/:userId', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    // 验证社团是否存在
    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    // 验证用户是否存在
    const user = await validateUserExists(userId);
    if (!user) {
      return res.status(404).json(buildNotFoundError('用户'));
    }

    // 不能移除自己
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json(buildBadRequestError('不能移除自己'));
    }

    // 删除成员关系
    await db('club_members')
      .where({ club_id: id, user_id: userId })
      .del();

    logger.info('会长移除社团成员:', { clubId: id, userId, leaderId: req.user.id });

    res.json({
      success: true,
      message: '成员移除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 通过学号搜索用户（会长权限）
 * @route GET /nfunest/api/clubs/:id/users/search
 */
router.get('/:id/users/search', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { studentId, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    // 验证社团是否存在
    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    if (!studentId) {
      return res.status(400).json(buildBadRequestError('请提供学号参数'));
    }

    // 搜索用户
    const users = await db('users')
      .select('id', 'nickname', 'avatar', 'student_id', 'wechat')
      .where('student_id', 'like', `%${studentId}%`)
      .orderBy('id', 'desc')
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db('users')
      .where('student_id', 'like', `%${studentId}%`)
      .count('id as count');

    res.json({
      success: true,
      data: users,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 社团会长删除社团图片URL
 * @route DELETE /nfunest/api/clubs/:id/images
 */
router.delete('/:id/images', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { imageUrl, imageType } = req.body;

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    if (!imageUrl || !imageType) {
      return res.status(400).json(buildBadRequestError('缺少必要参数'));
    }

    const validImageTypes = ['logo', 'cover_image', 'gallery'];
    if (!isValidImageType(imageType, validImageTypes)) {
      return res.status(400).json(buildBadRequestError('无效的图片类型'));
    }

    await removeImageFromRecord({
      table: 'clubs',
      id,
      imageUrl,
      imageType,
      record: club,
      userId: req.user.id,
      userType: 'leader'
    });

    logger.info('会长删除社团图片URL:', { clubId: id, imageUrl, imageType, userId: req.user.id });

    res.json({
      success: true,
      message: '图片URL删除成功'
    });
  } catch (error) {
    logger.error('会长删除社团图片URL失败:', {
      error: error.message,
      stack: error.stack,
      clubId: req.params.id,
      userId: req.user?.id
    });
    next(error);
  }
});

/**
 * 获取社团相关的活动
 * @description 返回该社团的所有活动（包括待审核的），用于会长管理
 * @route GET /nfunest/api/clubs/:id/events
 */
router.get('/:id/events', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    const events = await db('events')
      .select(
        'events.id', 'events.title', 'events.date', 'events.time', 'events.location',
        'events.latitude', 'events.longitude', 'events.location_name',
        'events.cover_image', 'events.images', 'events.category', 'events.status', 'events.max_participants',
        'events.current_participants', 'events.registration_deadline', 'events.description',
        'events.organizer', 'events.contact', 'events.tags', 'events.requirements',
        'events.created_by', 'events.created_at', 'events.updated_at', 'events.approval_status'
      )
      .join('event_clubs', 'events.id', 'event_clubs.event_id')
      .where({ 'event_clubs.club_id': id })
      .orderBy('events.date', 'desc')
      .orderBy('events.id', 'desc')
      .limit(pageSize)
      .offset(offset);

    const processedEvents = await Promise.all(events.map(async (event) => {
      const relatedClubs = await db('clubs')
        .select('clubs.id', 'clubs.name', 'clubs.logo')
        .join('event_clubs', 'clubs.id', 'event_clubs.club_id')
        .where('event_clubs.event_id', event.id);

      const processedEvent = processJsonFields(event, [
        { field: 'tags', defaultValue: [] },
        { field: 'images', defaultValue: [] },
        { field: 'requirements', defaultValue: [] }
      ]);

      processedEvent.related_clubs = relatedClubs;
      processedEvent.isJoined = false;

      // 如果活动被拒绝，查询拒绝原因
      if (event.approval_status === 'rejected') {
        const approval = await db('approvals')
          .select('reject_reason')
          .where({ target_type: 'event', target_id: event.id })
          .whereNotNull('reject_reason')
          .orderBy('approved_at', 'desc')
          .first();
        processedEvent.reject_reason = approval ? approval.reject_reason : '';
      }

      if (req.user && req.userType === 'user') {
        const participation = await db('event_participants')
          .where({ event_id: event.id, user_id: req.user.id })
          .whereIn('status', ['pending', 'approved', 'checked_in'])
          .first();
        processedEvent.isJoined = !!participation;
      }

      return processedEvent;
    }));

    const [{ count }] = await db('events')
      .join('event_clubs', 'events.id', 'event_clubs.event_id')
      .where({ 'event_clubs.club_id': id })
      .count('events.id as count');

    res.json({
      success: true,
      data: processedEvents,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
