/**
 * 通知相关路由
 * @description 处理订阅消息通知相关的API接口
 */
const express = require('express');
const db = require('../config/database');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { requireClubLeader } = require('../middleware/clubLeader');
const logger = require('../config/logger');
const notifyService = require('../services/notifyService');

const router = express.Router();

/**
 * 获取模板ID列表
 * @description 返回所有可用的订阅消息模板ID
 * @route GET /nfunest/api/notifications/templates
 */
router.get('/templates', optionalAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      templates: [
        {
          id: 'INTERVIEW_NOTICE',
          templateId: notifyService.TEMPLATE_IDS.INTERVIEW_NOTICE,
          name: '面试通知',
          description: '通知申请人参加面试',
          fields: ['thing10', 'time4', 'thing7', 'thing5', 'phone_number12']
        },
        {
          id: 'EVENT_START_REMINDER',
          templateId: notifyService.TEMPLATE_IDS.EVENT_START_REMINDER,
          name: '活动开始提醒',
          description: '提醒用户活动即将开始',
          fields: ['thing2', 'date3', 'thing6', 'thing14']
        },
        {
          id: 'NEW_EVENT_NOTICE',
          templateId: notifyService.TEMPLATE_IDS.NEW_EVENT_NOTICE,
          name: '新活动提醒',
          description: '通知用户新活动发布',
          fields: ['thing10', 'time5', 'thing3', 'thing11']
        }
      ]
    }
  });
});

/**
 * 发送面试通知
 * @description 社团会长发送面试通知给申请人
 * @route POST /nfunest/api/notifications/interview
 */
router.post('/interview', verifyToken, async (req, res, next) => {
  try {
    const { applicationId, clubName, interviewTime, interviewLocation, notes, contact, page } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        error: '缺少报名ID'
      });
    }

    const application = await db('applications')
      .select('applications.*', 'recruitments.club_id')
      .leftJoin('recruitments', 'applications.recruitment_id', 'recruitments.id')
      .where('applications.id', applicationId)
      .first();

    if (!application) {
      return res.status(404).json({
        success: false,
        error: '报名记录不存在'
      });
    }

    const clubMember = await db('club_members')
      .where({ club_id: application.club_id, user_id: req.user.id, role: 'leader' })
      .first();

    if (!clubMember) {
      return res.status(403).json({
        success: false,
        error: '无权发送此通知'
      });
    }

    const interviewData = {
      clubName: clubName || (await db('clubs').where({ id: application.club_id }).first())?.name || '社团',
      interviewTime: interviewTime || application.interview_time,
      interviewLocation: interviewLocation || application.interview_location,
      notes: notes || application.interview_notes || '请准时参加面试',
      contact: contact || application.interview_contact || ''
    };

    const result = await notifyService.sendInterviewNotice(
      application.user_id,
      interviewData,
      page || `pages/applicationDetail/applicationDetail?id=${applicationId}`
    );

    if (result.success) {
      logger.info('面试通知发送成功:', {
        applicationId,
        userId: application.user_id,
        operatorId: req.user.id
      });

      res.json({
        success: true,
        message: '面试通知发送成功',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || result.errmsg || '发送失败'
      });
    }
  } catch (error) {
    logger.error('发送面试通知失败:', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * 发送活动开始提醒
 * @description 向活动参与者发送活动开始提醒
 * @route POST /nfunest/api/notifications/event-reminder
 */
router.post('/event-reminder', verifyToken, async (req, res, next) => {
  try {
    const { eventId, eventName, startTime, location, page } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: '缺少活动ID'
      });
    }

    const event = await db('events').where({ id: eventId }).first();

    if (!event) {
      return res.status(404).json({
        success: false,
        error: '活动不存在'
      });
    }

    const eventClubs = await db('event_clubs').where({ event_id: eventId });
    const clubIds = eventClubs.map(ec => ec.club_id);

    if (clubIds.length > 0) {
      const isLeader = await db('club_members')
        .where({ user_id: req.user.id, role: 'leader' })
        .whereIn('club_id', clubIds)
        .first();

      if (!isLeader) {
        return res.status(403).json({
          success: false,
          error: '无权发送此通知'
        });
      }
    }

    const eventData = {
      eventName: eventName || event.title,
      startTime: startTime || `${event.date} ${event.time || ''}`,
      location: location || event.location,
      notes: event.description || '请准时参加活动'
    };

    const result = await notifyService.sendEventReminderToParticipants(
      eventId,
      eventData,
      page || `pages/activitiesDetail/activitiesDetail?id=${eventId}`
    );

    logger.info('活动开始提醒发送完成:', {
      eventId,
      operatorId: req.user.id,
      result
    });

    res.json({
      success: true,
      message: `成功发送${result.success}条通知，失败${result.failed}条`,
      data: result
    });
  } catch (error) {
    logger.error('发送活动开始提醒失败:', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * 发送新活动通知
 * @description 向社团成员发送新活动通知
 * @route POST /nfunest/api/notifications/new-event
 */
router.post('/new-event', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { clubId, eventId, eventName, startTime, location, description, page } = req.body;

    if (!clubId || !eventId) {
      return res.status(400).json({
        success: false,
        error: '缺少社团ID或活动ID'
      });
    }

    const event = await db('events').where({ id: eventId }).first();

    if (!event) {
      return res.status(404).json({
        success: false,
        error: '活动不存在'
      });
    }

    const eventData = {
      eventName: eventName || event.title,
      startTime: startTime || `${event.date} ${event.time || ''}`,
      location: location || event.location,
      description: description || event.description || '欢迎参加'
    };

    const result = await notifyService.sendNewEventToClubMembers(
      clubId,
      eventData,
      page || `pages/activitiesDetail/activitiesDetail?id=${eventId}`
    );

    logger.info('新活动通知发送完成:', {
      clubId,
      eventId,
      operatorId: req.user.id,
      result
    });

    res.json({
      success: true,
      message: `成功发送${result.success}条通知，失败${result.failed}条`,
      data: result
    });
  } catch (error) {
    logger.error('发送新活动通知失败:', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * 发送单个用户通知
 * @description 发送通知给指定用户（管理员功能）
 * @route POST /nfunest/api/notifications/send
 */
router.post('/send', verifyToken, async (req, res, next) => {
  try {
    const { userId, templateType, data, page } = req.body;

    if (!userId || !templateType || !data) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    let result;
    switch (templateType) {
      case 'INTERVIEW_NOTICE':
        result = await notifyService.sendInterviewNotice(userId, data, page);
        break;
      case 'EVENT_START_REMINDER':
        result = await notifyService.sendEventStartReminder(userId, data, page);
        break;
      case 'NEW_EVENT_NOTICE':
        result = await notifyService.sendNewEventNotice(userId, data, page);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: '无效的模板类型'
        });
    }

    if (result.success) {
      res.json({
        success: true,
        message: '通知发送成功',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || result.errmsg || '发送失败'
      });
    }
  } catch (error) {
    logger.error('发送单个通知失败:', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

module.exports = router;
