/**
 * routes/recruitments.js - 招新报名相关路由
 * @description 处理招新信息发布、报名申请、状态流转等
 */
const express = require('express');
const moment = require('moment');
const db = require('../config/database');
const { verifyToken, optionalAuth, requireAdmin } = require('../middleware/auth');
const { requireClubLeader } = require('../middleware/clubLeader');
const logger = require('../config/logger');
const { deletePhysicalFile, deletePhysicalFiles } = require('../utils/fileUtils');
const { checkAndAwardBadge } = require('./badges');
const { updateActivityStats } = require('../services/activityStatsService');
const notifyService = require('../services/notifyService');
const applicationLogService = require('../services/applicationLogService');

// 引入公共工具函数
const {
  safeJsonParse,
  getPaginationParams,
  buildPaginationResponse,
  formatDateTime
} = require('../utils/helpers');

const {
  validateRecruitmentExists,
  validateClubMembership,
  isValidRecruitmentStatus,
  isValidApplicationStatus,
  buildNotFoundError,
  buildBadRequestError,
  buildForbiddenError
} = require('../utils/validators');

const { deleteAllRecruitmentImages } = require('../utils/imageHandlers');

const router = express.Router();

/**
 * 计算招新状态
 * @description 根据时间和人数计算招新显示状态
 * @param {Object} recruitment - 招新信息
 * @returns {Object} 状态信息
 */
function calculateRecruitmentStatus(recruitment) {
  const now = moment();
  const startTime = recruitment.start_time ? moment(recruitment.start_time) : null;
  const endTime = recruitment.end_time ? moment(recruitment.end_time) : null;
  
  if (recruitment.status === 'closed') {
    return { statusText: '结束ing', statusClass: 'ended', color: '#999999' };
  }
  
  if (recruitment.status === 'draft') {
    return { statusText: '草稿', statusClass: 'draft', color: '#999999' };
  }
  
  if (startTime && now.isBefore(startTime)) {
    return { statusText: '等待ing', statusClass: 'upcoming', color: '#4facfe' };
  }
  
  if (endTime && now.isAfter(endTime)) {
    return { statusText: '结束ing', statusClass: 'ended', color: '#999999' };
  }
  
  if (recruitment.max_applicants && recruitment.current_applicants >= recruitment.max_applicants) {
    return { statusText: '已满员', statusClass: 'full', color: '#ff6b6b' };
  }
  
  return { statusText: '招新ing', statusClass: 'ongoing', color: '#52c41a' };
}

/**
 * 获取状态文本
 * @param {string} status - 状态码
 * @returns {string} 状态文本
 */
function getStatusText(status) {
  const statusMap = {
    'submitted': '已提交',
    'viewed': '已查看',
    'interviewing': '面试中',
    'accepted': '已录取',
    'rejected': '已拒绝'
  };
  return statusMap[status] || status;
}

/**
 * 获取状态样式类
 * @param {string} status - 状态码
 * @returns {string} 样式类名
 */
function getStatusClass(status) {
  const classMap = {
    'submitted': 'submitted',
    'viewed': 'viewed',
    'interviewing': 'interviewing',
    'accepted': 'accepted',
    'rejected': 'rejected'
  };
  return classMap[status] || '';
}

/**
 * 处理招新JSON字段
 * @description 统一处理招新的JSON字段
 * @param {Object} recruitment - 招新对象
 * @returns {Object} 处理后的招新对象
 */
function processRecruitmentJsonFields(recruitment) {
  return {
    ...recruitment,
    requirements: safeJsonParse(recruitment.requirements, []),
    form_fields: safeJsonParse(recruitment.form_fields, []),
    interview_info: safeJsonParse(recruitment.interview_info, null)
  };
}

/**
 * 处理报名JSON字段
 * @description 统一处理报名的JSON字段
 * @param {Object} application - 报名对象
 * @returns {Object} 处理后的报名对象
 */
function processApplicationJsonFields(application) {
  return {
    ...application,
    form_data: safeJsonParse(application.form_data, {}),
    recruitment_interview_info: safeJsonParse(application.recruitment_interview_info, null),
    statusText: getStatusText(application.status),
    statusClass: getStatusClass(application.status)
  };
}

/**
 * 获取招新列表
 * @route POST /nfunest/api/recruitments
 */
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, status, clubId, clubCategory, keyword } = req.body;
    const { offset } = getPaginationParams(req.body);

    let query = db('recruitments')
      .select(
        'recruitments.*',
        'clubs.name as club_name',
        'clubs.logo as club_logo',
        'clubs.category as club_category'
      )
      .leftJoin('clubs', 'recruitments.club_id', 'clubs.id')
      .modify(qb => {
        if (status && status !== 'all') {
          qb.where('recruitments.status', status);
        } else {
          qb.whereIn('recruitments.status', ['published']);
        }
        if (clubId) {
          qb.where('recruitments.club_id', clubId);
        }
        if (clubCategory && clubCategory !== 'all') {
          qb.where('clubs.category', clubCategory);
        }
        if (keyword) {
          qb.where(function() {
            this.where('recruitments.title', 'like', `%${keyword}%`)
                .orWhere('recruitments.description', 'like', `%${keyword}%`);
          });
        }
      });

    const recruitments = await query
      .orderBy('recruitments.created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const processedRecruitments = recruitments.map(r => {
      const statusInfo = calculateRecruitmentStatus(r);
      return {
        ...processRecruitmentJsonFields(r),
        ...statusInfo
      };
    });

    // 复用查询条件获取总数
    let countQuery = db('recruitments')
      .leftJoin('clubs', 'recruitments.club_id', 'clubs.id')
      .modify(qb => {
        if (status && status !== 'all') {
          qb.where('recruitments.status', status);
        } else {
          qb.whereIn('recruitments.status', ['published']);
        }
        if (clubId) qb.where('recruitments.club_id', clubId);
        if (clubCategory && clubCategory !== 'all') qb.where('clubs.category', clubCategory);
        if (keyword) {
          qb.where(function() {
            this.where('recruitments.title', 'like', `%${keyword}%`)
                .orWhere('recruitments.description', 'like', `%${keyword}%`);
          });
        }
      });

    const [{ count }] = await countQuery.count('recruitments.id as count');

    res.json({
      success: true,
      data: processedRecruitments,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 创建招新（社团会长权限）
 * @route POST /nfunest/api/recruitments/club/:clubId
 */
router.post('/club/:clubId', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const clubId = parseInt(req.params.clubId, 10);

    const { title, description, cover_image, poster, qr_code, requirements, form_fields,
      status = 'draft', start_time, end_time, max_applicants, interview_info, contact_info } = req.body;

    if (!title) {
      return res.status(400).json(buildBadRequestError('请填写招新标题'));
    }

    const recruitmentData = {
      club_id: clubId,
      title,
      description,
      cover_image,
      poster,
      qr_code,
      requirements: requirements ? JSON.stringify(requirements) : null,
      form_fields: form_fields ? JSON.stringify(form_fields) : null,
      status,
      start_time: formatDateTime(start_time),
      end_time: formatDateTime(end_time),
      max_applicants: max_applicants || null,
      interview_info: interview_info ? JSON.stringify(interview_info) : null,
      contact_info,
      created_by: req.user.id,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    };

    const [recruitmentId] = await db('recruitments').insert(recruitmentData);

    const newRecruitment = await db('recruitments').where({ id: recruitmentId }).first();

    logger.info('创建招新:', { recruitmentId, clubId, userId: req.user.id });

    res.status(201).json({
      success: true,
      message: '招新创建成功',
      data: processRecruitmentJsonFields(newRecruitment)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取社团收到的报名列表（社团会长权限）
 * @route GET /nfunest/api/recruitments/club/:clubId/applications
 */
router.get('/club/:clubId/applications', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const clubId = parseInt(req.params.clubId, 10);
    const { recruitment_id, status, page = 1, pageSize = 20 } = req.query;
    const { offset } = getPaginationParams(req.query);

    let query = db('applications')
      .select(
        'applications.*',
        'recruitments.title as recruitment_title',
        'users.nickname',
        'users.avatar',
        'users.student_id',
        'users.wechat'
      )
      .leftJoin('recruitments', 'applications.recruitment_id', 'recruitments.id')
      .leftJoin('users', 'applications.user_id', 'users.id')
      .where('recruitments.club_id', clubId)
      .modify(qb => {
        if (recruitment_id) qb.where('applications.recruitment_id', recruitment_id);
        if (status && status !== 'all') qb.where('applications.status', status);
      });

    const applications = await query
      .orderBy('applications.submitted_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const processedApplications = applications.map(app => processApplicationJsonFields(app));

    let countQuery = db('applications')
      .leftJoin('recruitments', 'applications.recruitment_id', 'recruitments.id')
      .where('recruitments.club_id', clubId)
      .modify(qb => {
        if (recruitment_id) qb.where('applications.recruitment_id', recruitment_id);
        if (status && status !== 'all') qb.where('applications.status', status);
      });

    const [{ count }] = await countQuery.count('applications.id as count');

    res.json({
      success: true,
      data: processedApplications,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取我的报名列表
 * @description 默认不返回 rejected 状态的申请，避免用户看到被拒绝的记录
 * @route GET /nfunest/api/recruitments/my/applications
 */
router.get('/my/applications', verifyToken, async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = db('applications')
      .select(
        'applications.*',
        'recruitments.title as recruitment_title',
        'recruitments.cover_image as recruitment_cover',
        'recruitments.end_time as recruitment_end_time',
        'clubs.name as club_name',
        'clubs.logo as club_logo'
      )
      .leftJoin('recruitments', 'applications.recruitment_id', 'recruitments.id')
      .leftJoin('clubs', 'recruitments.club_id', 'clubs.id')
      .where('applications.user_id', req.user.id);

    // 状态筛选逻辑：默认排除 rejected 状态，除非用户明确指定
    if (status && status !== 'all') {
      // 用户指定特定状态时，按用户要求筛选
      query = query.where('applications.status', status);
    } else if (!status || status === 'all') {
      // 未指定或指定 all 时，默认排除 rejected 状态（更人性化）
      query = query.whereNot('applications.status', 'rejected');
    }

    const applications = await query.orderBy('applications.submitted_at', 'desc');

    const processedApplications = applications.map(app => processApplicationJsonFields(app));

    res.json({
      success: true,
      data: processedApplications
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取报名详情
 * @route GET /nfunest/api/recruitments/applications/:id
 */
router.get('/applications/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const application = await db('applications')
      .select(
        'applications.*',
        'recruitments.title as recruitment_title',
        'recruitments.description as recruitment_description',
        'recruitments.cover_image as recruitment_cover',
        'recruitments.interview_info as recruitment_interview_info',
        'recruitments.contact_info as recruitment_contact',
        'recruitments.club_id as club_id',
        'clubs.name as club_name',
        'clubs.logo as club_logo'
      )
      .leftJoin('recruitments', 'applications.recruitment_id', 'recruitments.id')
      .leftJoin('clubs', 'recruitments.club_id', 'clubs.id')
      .where('applications.id', id)
      .first();

    if (!application) {
      return res.status(404).json(buildNotFoundError('报名记录'));
    }

    // 权限检查：用户本人或社团会长可查看
    if (application.user_id !== req.user.id) {
      const clubMember = await validateClubMembership(application.club_id, req.user.id, { role: 'leader' });
      if (!clubMember) {
        return res.status(403).json(buildForbiddenError('无权查看此报名记录'));
      }
    }

    res.json({
      success: true,
      data: processApplicationJsonFields(application)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 更新报名状态（社团会长权限）
 * @route PUT /nfunest/api/recruitments/applications/:id/status
 */
router.put('/applications/:id/status', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, interview_time, interview_location, interview_type, interview_contact, interview_notes, result_notes } = req.body;

    if (!isValidApplicationStatus(status)) {
      return res.status(400).json(buildBadRequestError('无效的状态值'));
    }

    const application = await db('applications').where({ id }).first();

    if (!application) {
      return res.status(404).json(buildNotFoundError('报名记录'));
    }

    // 验证权限
    const recruitment = await db('recruitments').where({ id: application.recruitment_id }).first();
    const clubMember = await validateClubMembership(recruitment.club_id, req.user.id, { role: 'leader' });

    if (!clubMember) {
      return res.status(403).json(buildForbiddenError('无权操作此报名记录'));
    }

    const updateData = {
      status,
      updated_at: db.fn.now()
    };

    if (status === 'viewed') {
      updateData.viewed_at = db.fn.now();
    }

    // 处理面试相关信息
    if (interview_time) updateData.interview_time = formatDateTime(interview_time);
    if (interview_location) updateData.interview_location = interview_location;
    if (interview_type) updateData.interview_type = interview_type;
    if (interview_contact) updateData.interview_contact = interview_contact;
    if (interview_notes) updateData.interview_notes = interview_notes;
    if (result_notes) updateData.result_notes = result_notes;

    await db('applications').where({ id }).update(updateData);

    logger.info('更新报名状态:', { applicationId: id, status, userId: req.user.id });

    // 记录操作日志
    setImmediate(async () => {
      try {
        const operator = await db('users').where({ id: req.user.id }).first();
        const action = applicationLogService.determineActionByStatus(status);

        await applicationLogService.logApplicationAction({
          applicationId: parseInt(id, 10),
          operatorId: req.user.id,
          operatorName: operator ? operator.nickname || operator.name : '未知',
          operatorRole: 'leader',
          action,
          oldStatus: application.status,
          newStatus: status,
          remark: result_notes || interview_notes || null,
          extraData: status === 'interviewing' ? {
            interview_time,
            interview_location,
            interview_type,
            interview_contact
          } : null
        });
      } catch (logError) {
        logger.error('记录操作日志失败:', {
          error: logError.message,
          applicationId: id
        });
      }
    });

    if (status === 'interviewing' && interview_time) {
      setImmediate(async () => {
        try {
          const club = await db('clubs').where({ id: recruitment.club_id }).first();
          const interviewData = {
            clubName: club ? club.name : '社团',
            interviewTime: moment(interview_time).format('YYYY年MM月DD日 HH:mm'),
            interviewLocation: interview_location || '',
            notes: interview_notes || '请准时参加面试',
            contact: interview_contact || ''
          };

          await notifyService.sendInterviewNotice(
            application.user_id,
            interviewData,
            `pages/applicationDetail/applicationDetail?id=${id}`
          );
        } catch (notifyError) {
          logger.error('发送面试通知失败:', {
            error: notifyError.message,
            applicationId: id
          });
        }
      });
    }

    res.json({
      success: true,
      message: '状态更新成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取报名操作日志
 * @description 获取报名状态变更的历史记录，实现操作可追溯
 * @route GET /nfunest/api/recruitments/applications/:id/logs
 */
router.get('/applications/:id/logs', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const application = await db('applications').where({ id }).first();

    if (!application) {
      return res.status(404).json(buildNotFoundError('报名记录'));
    }

    // 验证权限：申请人本人或社团会长可查看
    const recruitment = await db('recruitments').where({ id: application.recruitment_id }).first();
    const clubMember = await validateClubMembership(recruitment.club_id, req.user.id, { role: 'leader' });
    const isOwner = application.user_id === req.user.id;

    if (!isOwner && !clubMember) {
      return res.status(403).json(buildForbiddenError('无权查看此报名记录'));
    }

    const logs = await applicationLogService.getApplicationLogs(parseInt(id, 10));

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 更新招新（社团会长权限）
 * @route PUT /nfunest/api/recruitments/:id/club/:clubId
 */
router.put('/:id/club/:clubId', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const clubId = parseInt(req.params.clubId, 10);
    
    if (isNaN(id)) {
      return res.status(400).json(buildBadRequestError('无效的ID参数'));
    }

    const recruitment = await db('recruitments').where({ id, club_id: clubId }).first();

    if (!recruitment) {
      return res.status(404).json(buildNotFoundError('招新信息或不属于您的社团'));
    }

    const updateData = { ...req.body };
    updateData.updated_at = db.fn.now();

    // 处理JSON字段
    if (updateData.requirements !== undefined) {
      updateData.requirements = updateData.requirements ? JSON.stringify(updateData.requirements) : null;
    }
    if (updateData.form_fields !== undefined) {
      updateData.form_fields = updateData.form_fields ? JSON.stringify(updateData.form_fields) : null;
    }
    if (updateData.interview_info !== undefined) {
      updateData.interview_info = updateData.interview_info ? JSON.stringify(updateData.interview_info) : null;
    }
    
    // 处理日期时间字段
    if (updateData.start_time) {
      updateData.start_time = formatDateTime(updateData.start_time);
    }
    if (updateData.end_time) {
      updateData.end_time = formatDateTime(updateData.end_time);
    }

    // 移除不应更新的字段
    delete updateData.id;
    delete updateData.club_id;
    delete updateData.created_by;
    delete updateData.created_at;
    delete updateData.current_applicants;

    await db('recruitments').where({ id }).update(updateData);

    const updatedRecruitment = await db('recruitments').where({ id }).first();

    logger.info('更新招新:', { recruitmentId: id, clubId, userId: req.user.id });

    res.json({
      success: true,
      message: '招新更新成功',
      data: processRecruitmentJsonFields(updatedRecruitment)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 删除招新（社团会长权限）
 * @route DELETE /nfunest/api/recruitments/:id/club/:clubId
 */
router.delete('/:id/club/:clubId', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const clubId = parseInt(req.params.clubId, 10);
    
    if (isNaN(id)) {
      return res.status(400).json(buildBadRequestError('无效的ID参数'));
    }

    const recruitment = await db('recruitments').where({ id, club_id: clubId }).first();

    if (!recruitment) {
      return res.status(404).json(buildNotFoundError('招新信息或不属于您的社团'));
    }

    // 删除招新相关的所有图片
    await deleteAllRecruitmentImages(recruitment, req.user.id, 'leader');

    await db('recruitments').where({ id }).delete();

    logger.info('删除招新:', { recruitmentId: id, clubId, userId: req.user.id });

    res.json({
      success: true,
      message: '招新删除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 修改招新状态（社团会长权限）
 * @route PATCH /nfunest/api/recruitments/:id/club/:clubId/status
 */
router.patch('/:id/club/:clubId/status', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const clubId = parseInt(req.params.clubId, 10);
    const { status } = req.body;

    if (!isValidRecruitmentStatus(status)) {
      return res.status(400).json(buildBadRequestError('无效的状态值'));
    }

    const recruitment = await db('recruitments').where({ id, club_id: clubId }).first();

    if (!recruitment) {
      return res.status(404).json(buildNotFoundError('招新信息或不属于您的社团'));
    }

    await db('recruitments').where({ id }).update({
      status,
      updated_at: db.fn.now()
    });

    logger.info('修改招新状态:', { recruitmentId: id, clubId, status, userId: req.user.id });

    res.json({
      success: true,
      message: '招新状态更新成功',
      data: { id, status }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 提交报名申请
 * @route POST /nfunest/api/recruitments/:id/apply
 */
router.post('/:id/apply', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { form_data } = req.body;

    const recruitment = await db('recruitments')
      .where({ id, status: 'published' })
      .first();

    if (!recruitment) {
      return res.status(404).json(buildNotFoundError('招新信息或已结束'));
    }

    const statusInfo = calculateRecruitmentStatus(recruitment);
    if (statusInfo.statusClass === 'ended' || statusInfo.statusClass === 'full') {
      return res.status(400).json(buildBadRequestError(statusInfo.statusText));
    }

    // 检查是否已报名
    const existingApplication = await db('applications')
      .where({ recruitment_id: id, user_id: req.user.id })
      .first();

    if (existingApplication) {
      return res.status(400).json(buildBadRequestError('您已经报名过此招新'));
    }

    await db.transaction(async (trx) => {
      await trx('applications').insert({
        recruitment_id: id,
        user_id: req.user.id,
        form_data: form_data ? JSON.stringify(form_data) : null,
        status: 'submitted',
        submitted_at: trx.fn.now()
      });

      await trx('recruitments').where({ id }).increment('current_applicants', 1);
    });

    logger.info('提交报名申请:', { recruitmentId: id, userId: req.user.id });

    // 触发羽章检查和活跃度统计更新（异步执行，不阻塞响应）
    setImmediate(async () => {
      try {
        // 更新活跃度统计
        await updateActivityStats(req.user.id, 'application');
        // 检查并发放羽章
        await checkAndAwardBadge(req.user.id, 'recruitment.applied');
        // 检查活跃度等级羽章
        await checkAndAwardBadge(req.user.id, 'user.activity_update');
      } catch (err) {
        logger.error('活跃度统计或羽章检查失败:', { 
          error: err.message, 
          stack: err.stack,
          userId: req.user.id,
          recruitmentId: id
        });
      }
    });

    res.json({
      success: true,
      message: '报名成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取招新详情
 * @route GET /nfunest/api/recruitments/:id
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const recruitment = await db('recruitments')
      .select(
        'recruitments.*',
        'clubs.name as club_name',
        'clubs.logo as club_logo',
        'clubs.category as club_category',
        'clubs.description as club_description'
      )
      .leftJoin('clubs', 'recruitments.club_id', 'clubs.id')
      .where('recruitments.id', id)
      .first();

    if (!recruitment) {
      return res.status(404).json(buildNotFoundError('招新信息'));
    }

    const statusInfo = calculateRecruitmentStatus(recruitment);
    
    // 检查用户是否已报名
    let hasApplied = false;
    let applicationStatus = null;
    let applicationId = null;
    
    if (req.user && req.userType === 'user') {
      const application = await db('applications')
        .where({ recruitment_id: id, user_id: req.user.id })
        .first();
      if (application) {
        hasApplied = true;
        applicationStatus = application.status;
        applicationId = application.id;
      }
    }

    const processedRecruitment = {
      ...processRecruitmentJsonFields(recruitment),
      ...statusInfo,
      hasApplied,
      applicationStatus,
      applicationId
    };

    res.json({
      success: true,
      data: processedRecruitment
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
