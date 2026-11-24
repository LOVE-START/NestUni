/**
 * 微信小程序订阅消息通知服务
 * @description 提供微信小程序订阅消息发送功能
 * @reference https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/subscribe-message/subscribeMessage.send.html
 */

const axios = require('axios');
const db = require('../config/database');
const logger = require('../config/logger');

/**
 * 微信小程序配置
 */
const WECHAT_CONFIG = {
  appId: process.env.WECHAT_APPID,
  secret: process.env.WECHAT_SECRET
};

/**
 * 订阅消息模板ID配置
 * @description 集中管理所有模板ID，便于维护
 */
const TEMPLATE_IDS = {
  INTERVIEW_NOTICE: 'BE_IaJluW-i29Qz9PBxDgnMqZzaKXCc_2PJefQUscGY',
  EVENT_START_REMINDER: 'HxjOE56MfKSvESDQEpqkyM86SIJahP-8nEWQCdzg6QU',
  NEW_EVENT_NOTICE: 'lRR1mfKOjgoUSEEwUqiQGcnohGDVktI0YF1v1YOhqM8',
  AUDIT_RESULT_NOTICE: '4A3LQazO04CMTM_Koi2Tfof8acYYnmivJvFhtJBTs90',
  PENDING_AUDIT_NOTICE: 'zI3D-tfTKJbiL0rAxXpiKLWmHOUGTlKO4PUaanUYLP8',
  ANNOUNCEMENT_NOTICE: '4XIdqTmL8ODJhXQPxe9_f84KvlmW5DNYsQpwxll3qlI'
};

/**
 * Access Token缓存
 */
let accessTokenCache = {
  token: null,
  expiresAt: 0
};

/**
 * 获取微信Access Token
 * @description 获取小程序全局唯一后台接口调用凭据，带缓存机制
 * @returns {Promise<string>} Access Token
 */
async function getAccessToken() {
  const now = Date.now();
  
  if (accessTokenCache.token && accessTokenCache.expiresAt > now) {
    return accessTokenCache.token;
  }

  try {
    const response = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: {
        grant_type: 'client_credential',
        appid: WECHAT_CONFIG.appId,
        secret: WECHAT_CONFIG.secret
      }
    });

    if (response.data.errcode) {
      throw new Error(`获取Access Token失败: ${response.data.errmsg}`);
    }

    accessTokenCache.token = response.data.access_token;
    accessTokenCache.expiresAt = now + (response.data.expires_in - 300) * 1000;

    logger.info('获取微信Access Token成功');
    return accessTokenCache.token;
  } catch (error) {
    logger.error('获取微信Access Token失败:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * 发送订阅消息
 * @description 发送微信小程序订阅消息
 * @param {string} openid - 用户openid
 * @param {string} templateId - 模板ID
 * @param {Object} data - 模板数据
 * @param {string} [page] - 点击消息卡片后的跳转页面
 * @returns {Promise<Object>} 发送结果
 */
async function sendSubscribeMessage(openid, templateId, data, page = '') {
  try {
    const accessToken = await getAccessToken();

    const messageData = {
      touser: openid,
      template_id: templateId,
      page: page,
      data: data,
      miniprogram_state: process.env.NODE_ENV === 'production' ? 'formal' : 'developer',
      lang: 'zh_CN'
    };

    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
      messageData
    );

    if (response.data.errcode !== 0) {
      logger.error('发送订阅消息失败:', {
        openid,
        templateId,
        errcode: response.data.errcode,
        errmsg: response.data.errmsg
      });
      return {
        success: false,
        errcode: response.data.errcode,
        errmsg: response.data.errmsg
      };
    }

    logger.info('发送订阅消息成功:', { openid, templateId });
    return {
      success: true,
      msgId: response.data.msgid
    };
  } catch (error) {
    logger.error('发送订阅消息异常:', {
      error: error.message,
      stack: error.stack,
      openid,
      templateId
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 格式化电话号码字段
 * @description 微信 phone_number 类型字段要求严格格式，不能为空
 * @param {string} phone - 电话号码
 * @returns {string} 格式化后的电话号码
 */
function formatPhoneNumber(phone) {
  if (!phone || phone.trim() === '') {
    return '00000000000';
  }
  return phone.trim();
}

/**
 * 格式化日期时间字段
 * @description 微信 time/date 类型字段要求中文格式，空值时返回当前日期零点
 * @param {string} dateTime - 日期时间字符串
 * @returns {string} 格式化后的日期时间（如：2026年04月11日 00:00）
 */
function formatDateTime(dateTime) {
  const today = new Date();
  const defaultTime = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, '0')}月${String(today.getDate()).padStart(2, '0')}日 00:00`;
  
  if (!dateTime || typeof dateTime !== 'string') {
    return defaultTime;
  }
  
  const trimmed = dateTime.trim();
  if (trimmed === '') {
    return defaultTime;
  }
  
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    logger.warn('无法解析日期时间，使用默认值:', { input: dateTime });
    return defaultTime;
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}年${month}月${day}日 ${hours}:${minutes}`;
}

/**
 * 截断字符串到指定长度
 * @description 微信订阅消息字段有长度限制，需要截断
 * @param {string} str - 原字符串
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的字符串
 */
function truncateString(str, maxLength = 20) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 1) + '…';
}

/**
 * 发送面试通知
 * @description 通知申请人参加面试
 * @param {number} userId - 用户ID
 * @param {Object} interviewData - 面试信息
 * @param {string} interviewData.clubName - 面试单位（社团名称）
 * @param {string} interviewData.interviewTime - 面试时间
 * @param {string} interviewData.interviewLocation - 面试地址
 * @param {string} interviewData.notes - 通知事项
 * @param {string} interviewData.contact - 联系电话
 * @param {string} [page] - 跳转页面
 * @returns {Promise<Object>} 发送结果
 */
async function sendInterviewNotice(userId, interviewData, page = '') {
  try {
    const user = await db('users').where({ id: userId }).first();
    
    if (!user || !user.openid) {
      logger.warn('用户不存在或无openid:', { userId });
      return { success: false, error: '用户不存在或无openid' };
    }

    const data = {
      thing10: { value: truncateString(interviewData.clubName, 20) },
      time4: { value: formatDateTime(interviewData.interviewTime) },
      thing7: { value: truncateString(interviewData.interviewLocation, 20) },
      thing5: { value: truncateString(interviewData.notes || '请准时参加面试', 20) },
      phone_number12: { value: formatPhoneNumber(interviewData.contact) }
    };

    const result = await sendSubscribeMessage(
      user.openid,
      TEMPLATE_IDS.INTERVIEW_NOTICE,
      data,
      page
    );

    logger.info('面试通知发送完成:', {
      userId,
      openid: user.openid,
      result
    });

    return result;
  } catch (error) {
    logger.error('发送面试通知失败:', {
      error: error.message,
      stack: error.stack,
      userId
    });
    return { success: false, error: error.message };
  }
}

/**
 * 发送活动开始提醒
 * @description 提醒用户活动即将开始
 * @param {number} userId - 用户ID
 * @param {Object} eventData - 活动信息
 * @param {string} eventData.eventName - 活动名称
 * @param {string} eventData.startTime - 开始时间
 * @param {string} eventData.location - 活动地点
 * @param {string} eventData.notes - 活动事项
 * @param {string} [page] - 跳转页面
 * @returns {Promise<Object>} 发送结果
 */
async function sendEventStartReminder(userId, eventData, page = '') {
  try {
    const user = await db('users').where({ id: userId }).first();
    
    if (!user || !user.openid) {
      logger.warn('用户不存在或无openid:', { userId });
      return { success: false, error: '用户不存在或无openid' };
    }

    const data = {
      thing2: { value: truncateString(eventData.eventName, 20) },
      date3: { value: formatDateTime(eventData.startTime) },
      thing6: { value: truncateString(eventData.location, 20) },
      thing14: { value: truncateString(eventData.notes || '请准时参加活动', 20) }
    };

    const result = await sendSubscribeMessage(
      user.openid,
      TEMPLATE_IDS.EVENT_START_REMINDER,
      data,
      page
    );

    logger.info('活动开始提醒发送完成:', {
      userId,
      openid: user.openid,
      result
    });

    return result;
  } catch (error) {
    logger.error('发送活动开始提醒失败:', {
      error: error.message,
      stack: error.stack,
      userId
    });
    return { success: false, error: error.message };
  }
}

/**
 * 发送新活动通知
 * @description 通知用户新活动发布
 * @param {number} userId - 用户ID
 * @param {Object} eventData - 活动信息
 * @param {string} eventData.eventName - 活动名称
 * @param {string} eventData.startTime - 开始时间
 * @param {string} eventData.location - 活动地点
 * @param {string} eventData.description - 活动介绍
 * @param {string} [page] - 跳转页面
 * @returns {Promise<Object>} 发送结果
 */
async function sendNewEventNotice(userId, eventData, page = '') {
  try {
    const user = await db('users').where({ id: userId }).first();
    
    if (!user || !user.openid) {
      logger.warn('用户不存在或无openid:', { userId });
      return { success: false, error: '用户不存在或无openid' };
    }

    const data = {
      thing10: { value: truncateString(eventData.eventName, 20) },
      time5: { value: formatDateTime(eventData.startTime) },
      thing3: { value: truncateString(eventData.location, 20) },
      thing11: { value: truncateString(eventData.description || '欢迎参加', 20) }
    };

    const result = await sendSubscribeMessage(
      user.openid,
      TEMPLATE_IDS.NEW_EVENT_NOTICE,
      data,
      page
    );

    logger.info('新活动通知发送完成:', {
      userId,
      openid: user.openid,
      result
    });

    return result;
  } catch (error) {
    logger.error('发送新活动通知失败:', {
      error: error.message,
      stack: error.stack,
      userId
    });
    return { success: false, error: error.message };
  }
}

/**
 * 批量发送通知
 * @description 批量发送通知给多个用户
 * @param {Array<number>} userIds - 用户ID数组
 * @param {Function} sendFunc - 发送函数
 * @param {Object} data - 通知数据
 * @param {string} [page] - 跳转页面
 * @returns {Promise<Object>} 发送结果统计
 */
async function batchSendNotification(userIds, sendFunc, data, page = '') {
  const results = {
    total: userIds.length,
    success: 0,
    failed: 0,
    errors: []
  };

  for (const userId of userIds) {
    try {
      const result = await sendFunc(userId, data, page);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({ userId, error: result.error || result.errmsg });
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.failed++;
      results.errors.push({ userId, error: error.message });
    }
  }

  logger.info('批量发送通知完成:', results);
  return results;
}

/**
 * 发送活动通知给所有社团成员
 * @description 向社团所有成员发送新活动通知
 * @param {number} clubId - 社团ID
 * @param {Object} eventData - 活动信息
 * @param {string} [page] - 跳转页面
 * @returns {Promise<Object>} 发送结果统计
 */
async function sendNewEventToClubMembers(clubId, eventData, page = '') {
  try {
    const members = await db('club_members')
      .select('user_id')
      .where({ club_id: clubId, status: 'active' });

    if (members.length === 0) {
      return { total: 0, success: 0, failed: 0, errors: [] };
    }

    const userIds = members.map(m => m.user_id);
    return await batchSendNotification(userIds, sendNewEventNotice, eventData, page);
  } catch (error) {
    logger.error('发送活动通知给社团成员失败:', {
      error: error.message,
      stack: error.stack,
      clubId
    });
    return { total: 0, success: 0, failed: 0, errors: [{ error: error.message }] };
  }
}

/**
 * 发送公告通知给单个用户
 * @description 向用户发送公告通知
 * @param {number} userId - 用户ID
 * @param {Object} announcementData - 公告信息
 * @param {string} announcementData.title - 公告标题
 * @param {string} announcementData.content - 公告内容
 * @param {string} announcementData.clubName - 社团名称
 * @param {string} announcementData.sendTime - 发送时间
 * @param {string} [page] - 跳转页面
 * @returns {Promise<Object>} 发送结果
 */
async function sendAnnouncementNotice(userId, announcementData, page = '') {
  try {
    const user = await db('users').where({ id: userId }).first();

    if (!user || !user.openid) {
      logger.warn('用户不存在或无openid:', { userId });
      return { success: false, error: '用户不存在或无openid' };
    }

    const data = {
      thing30: { value: truncateString(announcementData.title, 20) },
      thing2: { value: truncateString(announcementData.content, 20) },
      thing9: { value: truncateString(announcementData.clubName, 20) },
      time3: { value: formatDateTime(announcementData.sendTime) }
    };

    const result = await sendSubscribeMessage(
      user.openid,
      TEMPLATE_IDS.ANNOUNCEMENT_NOTICE,
      data,
      page
    );

    logger.info('公告通知发送完成:', {
      userId,
      openid: user.openid,
      title: announcementData.title,
      result
    });

    return result;
  } catch (error) {
    logger.error('发送公告通知失败:', {
      error: error.message,
      stack: error.stack,
      userId
    });
    return { success: false, error: error.message };
  }
}

/**
 * 发送公告通知给所有社团成员
 * @description 公告审核通过后，向社团所有成员发送公告通知
 * @param {number} clubId - 社团ID
 * @param {Object} announcementData - 公告信息
 * @param {string} announcementData.title - 公告标题
 * @param {string} announcementData.content - 公告内容
 * @param {string} announcementData.clubName - 社团名称
 * @param {string} announcementData.sendTime - 发送时间
 * @param {string} [page] - 跳转页面
 * @returns {Promise<Object>} 发送结果统计
 */
async function sendAnnouncementToClubMembers(clubId, announcementData, page = '') {
  try {
    const members = await db('club_members')
      .select('user_id')
      .where({ club_id: clubId, status: 'active' });

    if (members.length === 0) {
      logger.info('社团没有成员，跳过发送公告通知:', { clubId });
      return { total: 0, success: 0, failed: 0, errors: [] };
    }

    const userIds = members.map(m => m.user_id);
    return await batchSendNotification(userIds, sendAnnouncementNotice, announcementData, page);
  } catch (error) {
    logger.error('发送公告通知给社团成员失败:', {
      error: error.message,
      stack: error.stack,
      clubId
    });
    return { total: 0, success: 0, failed: 0, errors: [{ error: error.message }] };
  }
}

/**
 * 发送活动开始提醒给所有参与者
 * @description 向活动所有参与者发送活动开始提醒
 * @param {number} eventId - 活动ID
 * @param {Object} eventData - 活动信息
 * @param {string} [page] - 跳转页面
 * @returns {Promise<Object>} 发送结果统计
 */
async function sendEventReminderToParticipants(eventId, eventData, page = '') {
  try {
    const participants = await db('event_participants')
      .select('user_id')
      .where({ event_id: eventId })
      .whereIn('status', ['pending', 'approved', 'checked_in']);

    if (participants.length === 0) {
      return { total: 0, success: 0, failed: 0, errors: [] };
    }

    const userIds = participants.map(p => p.user_id);
    return await batchSendNotification(userIds, sendEventStartReminder, eventData, page);
  } catch (error) {
    logger.error('发送活动提醒给参与者失败:', {
      error: error.message,
      stack: error.stack,
      eventId
    });
    return { total: 0, success: 0, failed: 0, errors: [{ error: error.message }] };
  }
}

/**
 * 发送审核结果通知
 * @description 通知会长审核结果（活动/公告审核通过或拒绝）
 * @param {number} userId - 用户ID（会长ID）
 * @param {Object} auditData - 审核信息
 * @param {string} auditData.title - 标题（活动/公告名称）
 * @param {string} auditData.result - 审核结果（通过/不通过）
 * @param {string} auditData.submitTime - 提交时间
 * @param {string} auditData.remark - 备注（审核意见）
 * @param {string} [page] - 跳转页面
 * @returns {Promise<Object>} 发送结果
 */
async function sendAuditResultNotice(userId, auditData, page = '') {
  try {
    const user = await db('users').where({ id: userId }).first();

    if (!user || !user.openid) {
      logger.warn('用户不存在或无openid:', { userId });
      return { success: false, error: '用户不存在或无openid' };
    }

    const data = {
      thing2: { value: truncateString(auditData.title || '审核通知', 20) },
      phrase1: { value: auditData.result || '已处理' },
      time4: { value: formatDateTime(auditData.submitTime) },
      thing5: { value: truncateString(auditData.remark || '无', 20) }
    };

    const result = await sendSubscribeMessage(
      user.openid,
      TEMPLATE_IDS.AUDIT_RESULT_NOTICE,
      data,
      page
    );

    logger.info('审核结果通知发送完成:', {
      userId,
      openid: user.openid,
      title: auditData.title,
      result: auditData.result,
      sendResult: result
    });

    return result;
  } catch (error) {
    logger.error('发送审核结果通知失败:', {
      error: error.message,
      stack: error.stack,
      userId,
      auditData
    });
    return { success: false, error: error.message };
  }
}

/**
 * 发送待审核提醒给老师
 * @description 通知老师有新的活动/公告待审核
 * @param {string} openid - 老师的openid
 * @param {Object} auditData - 审核信息
 * @param {string} auditData.projectName - 项目名称（活动/公告名称）
 * @param {string} auditData.location - 预约场地（活动地点）
 * @param {string} auditData.startTime - 开始时间
 * @param {string} auditData.applicant - 申请单位（社团名称）
 * @param {string} auditData.remark - 备注（活动介绍或公告内容）
 * @param {string} [page] - 跳转页面
 * @returns {Promise<Object>} 发送结果
 */
async function sendPendingAuditNotice(openid, auditData, page = '') {
  try {
    if (!openid) {
      logger.warn('老师openid为空，无法发送待审核提醒');
      return { success: false, error: 'openid为空' };
    }

    const data = {
      thing30: { value: truncateString(auditData.projectName, 20) },
      thing24: { value: truncateString(auditData.location || '线上公告', 20) },
      time26: { value: formatDateTime(auditData.startTime) },
      thing1: { value: truncateString(auditData.applicant, 20) },
      thing6: { value: truncateString(auditData.remark || '无', 20) }
    };

    const result = await sendSubscribeMessage(
      openid,
      TEMPLATE_IDS.PENDING_AUDIT_NOTICE,
      data,
      page
    );

    logger.info('待审核提醒发送完成:', {
      openid,
      projectName: auditData.projectName,
      applicant: auditData.applicant,
      sendResult: result
    });

    return result;
  } catch (error) {
    logger.error('发送待审核提醒失败:', {
      error: error.message,
      stack: error.stack,
      openid,
      auditData
    });
    return { success: false, error: error.message };
  }
}

/**
 * 批量发送待审核提醒给所有老师
 * @description 向所有绑定了openid的老师发送待审核提醒
 * @param {Object} auditData - 审核信息
 * @param {string} [page] - 跳转页面
 * @returns {Promise<Object>} 发送结果统计
 */
async function sendPendingAuditToTeachers(auditData, page = '') {
  try {
    const teachers = await db('admins')
      .select('id', 'username', 'openid')
      .where({ level: 'teacher' })
      .whereNotNull('openid');

    if (teachers.length === 0) {
      logger.info('没有绑定微信的老师，跳过发送待审核提醒');
      return { total: 0, success: 0, failed: 0, errors: [] };
    }

    const results = {
      total: teachers.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (const teacher of teachers) {
      try {
        const result = await sendPendingAuditNotice(teacher.openid, auditData, page);
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({ teacherId: teacher.id, error: result.error });
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.failed++;
        results.errors.push({ teacherId: teacher.id, error: error.message });
      }
    }

    logger.info('批量发送待审核提醒完成:', results);
    return results;
  } catch (error) {
    logger.error('批量发送待审核提醒失败:', {
      error: error.message,
      stack: error.stack
    });
    return { total: 0, success: 0, failed: 0, errors: [{ error: error.message }] };
  }
}

module.exports = {
  TEMPLATE_IDS,
  getAccessToken,
  sendSubscribeMessage,
  sendInterviewNotice,
  sendEventStartReminder,
  sendNewEventNotice,
  batchSendNotification,
  sendNewEventToClubMembers,
  sendAnnouncementNotice,
  sendAnnouncementToClubMembers,
  sendEventReminderToParticipants,
  sendAuditResultNotice,
  sendPendingAuditNotice,
  sendPendingAuditToTeachers
};
