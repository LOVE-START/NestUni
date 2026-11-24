/**
 * utils/validators.js - 公共验证工具函数
 * @description 提供实体存在性验证、参数验证等通用功能
 */

const db = require('../config/database');
const logger = require('../config/logger');

/**
 * 验证实体是否存在
 * @description 检查指定表中是否存在指定ID的记录
 * @param {string} table - 表名
 * @param {number|string} id - 实体ID
 * @param {Object} options - 可选配置
 * @param {Object} options.conditions - 额外条件 { field: value }
 * @returns {Promise<Object|null>} 存在则返回实体对象，否则返回null
 */
async function validateEntityExists(table, id, options = {}) {
  try {
    const { conditions = {} } = options;
    
    let query = db(table).where({ id });
    
    // 添加额外条件
    Object.entries(conditions).forEach(([field, value]) => {
      query = query.where(field, value);
    });
    
    const entity = await query.first();
    return entity || null;
  } catch (error) {
    logger.error('验证实体存在性失败:', { 
      table, 
      id, 
      error: error.message 
    });
    return null;
  }
}

/**
 * 验证社团是否存在
 * @param {number|string} clubId - 社团ID
 * @returns {Promise<Object|null>} 社团对象或null
 */
async function validateClubExists(clubId) {
  return validateEntityExists('clubs', clubId);
}

/**
 * 验证活动是否存在
 * @param {number|string} eventId - 活动ID
 * @returns {Promise<Object|null>} 活动对象或null
 */
async function validateEventExists(eventId) {
  return validateEntityExists('events', eventId);
}

/**
 * 验证用户是否存在
 * @param {number|string} userId - 用户ID
 * @returns {Promise<Object|null>} 用户对象或null
 */
async function validateUserExists(userId) {
  return validateEntityExists('users', userId);
}

/**
 * 验证公告是否存在
 * @param {number|string} announcementId - 公告ID
 * @param {Object} options - 可选配置
 * @param {number} options.clubId - 限制社团ID
 * @returns {Promise<Object|null>} 公告对象或null
 */
async function validateAnnouncementExists(announcementId, options = {}) {
  const { clubId } = options;
  const conditions = clubId ? { club_id: clubId } : {};
  return validateEntityExists('announcements', announcementId, { conditions });
}

/**
 * 验证招新是否存在
 * @param {number|string} recruitmentId - 招新ID
 * @param {Object} options - 可选配置
 * @param {number} options.clubId - 限制社团ID
 * @returns {Promise<Object|null>} 招新对象或null
 */
async function validateRecruitmentExists(recruitmentId, options = {}) {
  const { clubId } = options;
  const conditions = clubId ? { club_id: clubId } : {};
  return validateEntityExists('recruitments', recruitmentId, { conditions });
}

/**
 * 验证活动-社团关联是否存在
 * @param {number} eventId - 活动ID
 * @param {number} clubId - 社团ID
 * @returns {Promise<Object|null>} 关联对象或null
 */
async function validateEventClubRelation(eventId, clubId) {
  try {
    const relation = await db('event_clubs')
      .where({ event_id: eventId, club_id: clubId })
      .first();
    return relation || null;
  } catch (error) {
    logger.error('验证活动-社团关联失败:', { 
      eventId, 
      clubId, 
      error: error.message 
    });
    return null;
  }
}

/**
 * 验证用户是否为社团成员
 * @param {number} clubId - 社团ID
 * @param {number} userId - 用户ID
 * @param {Object} options - 可选配置
 * @param {string} options.role - 角色限制 ('member' | 'leader')
 * @returns {Promise<Object|null>} 成员关系对象或null
 */
async function validateClubMembership(clubId, userId, options = {}) {
  try {
    const { role } = options;
    
    let query = db('club_members').where({ club_id: clubId, user_id: userId });
    
    if (role) {
      query = query.where({ role });
    }
    
    const membership = await query.first();
    return membership || null;
  } catch (error) {
    logger.error('验证社团成员关系失败:', { 
      clubId, 
      userId, 
      error: error.message 
    });
    return null;
  }
}

/**
 * 验证用户是否已报名活动
 * @param {number} eventId - 活动ID
 * @param {number} userId - 用户ID
 * @param {Array<string>} statuses - 有效状态列表
 * @returns {Promise<Object|null>} 报名记录或null
 */
async function validateEventParticipation(eventId, userId, statuses = ['pending', 'approved', 'checked_in']) {
  try {
    const participation = await db('event_participants')
      .where({ event_id: eventId, user_id: userId })
      .whereIn('status', statuses)
      .first();
    return participation || null;
  } catch (error) {
    logger.error('验证活动报名状态失败:', { 
      eventId, 
      userId, 
      error: error.message 
    });
    return null;
  }
}

/**
 * 验证用户是否已报名招新
 * @param {number} recruitmentId - 招新ID
 * @param {number} userId - 用户ID
 * @returns {Promise<Object|null>} 报名记录或null
 */
async function validateRecruitmentApplication(recruitmentId, userId) {
  try {
    const application = await db('applications')
      .where({ recruitment_id: recruitmentId, user_id: userId })
      .first();
    return application || null;
  } catch (error) {
    logger.error('验证招新报名状态失败:', { 
      recruitmentId, 
      userId, 
      error: error.message 
    });
    return null;
  }
}

/**
 * 验证状态值是否有效
 * @param {string} status - 状态值
 * @param {Array<string>} validStatuses - 有效状态列表
 * @returns {boolean} 是否有效
 */
function isValidStatus(status, validStatuses) {
  return status && validStatuses.includes(status);
}

/**
 * 验证活动状态
 * @param {string} status - 状态值
 * @returns {boolean} 是否有效
 */
function isValidEventStatus(status) {
  const validStatuses = ['draft', 'published', 'completed', 'cancelled'];
  return isValidStatus(status, validStatuses);
}

/**
 * 验证招新状态
 * @param {string} status - 状态值
 * @returns {boolean} 是否有效
 */
function isValidRecruitmentStatus(status) {
  const validStatuses = ['draft', 'published', 'closed'];
  return isValidStatus(status, validStatuses);
}

/**
 * 验证报名状态
 * @param {string} status - 状态值
 * @returns {boolean} 是否有效
 */
function isValidApplicationStatus(status) {
  const validStatuses = ['submitted', 'viewed', 'interviewing', 'accepted', 'rejected'];
  return isValidStatus(status, validStatuses);
}

/**
 * 验证参与者状态
 * @param {string} status - 状态值
 * @returns {boolean} 是否有效
 */
function isValidParticipantStatus(status) {
  const validStatuses = ['pending', 'approved', 'rejected', 'checked_in', 'cancelled'];
  return isValidStatus(status, validStatuses);
}

/**
 * 验证社团级别
 * @param {string} level - 级别值
 * @returns {boolean} 是否有效
 */
function isValidClubLevel(level) {
  const validLevels = ['school', 'college'];
  return level && validLevels.includes(level);
}

/**
 * 验证社团成员角色
 * @param {string} role - 角色值
 * @returns {boolean} 是否有效
 */
function isValidMemberRole(role) {
  const validRoles = ['member', 'leader'];
  return role && validRoles.includes(role);
}

/**
 * 验证图片类型
 * @param {string} imageType - 图片类型
 * @param {Array<string>} validTypes - 有效类型列表
 * @returns {boolean} 是否有效
 */
function isValidImageType(imageType, validTypes = ['cover_image', 'images', 'logo', 'gallery', 'poster', 'qr_code']) {
  return imageType && validTypes.includes(imageType);
}

/**
 * 构建验证错误响应
 * @param {string} message - 错误消息
 * @returns {Object} 错误响应对象
 */
function buildValidationError(message) {
  return {
    success: false,
    error: message
  };
}

/**
 * 构建404错误响应
 * @param {string} entityName - 实体名称
 * @returns {Object} 错误响应对象
 */
function buildNotFoundError(entityName) {
  return buildValidationError(`${entityName}不存在`);
}

/**
 * 构建权限错误响应
 * @param {string} message - 错误消息
 * @returns {Object} 错误响应对象
 */
function buildForbiddenError(message = '无权限执行此操作') {
  return buildValidationError(message);
}

/**
 * 构建参数错误响应
 * @param {string} message - 错误消息
 * @returns {Object} 错误响应对象
 */
function buildBadRequestError(message) {
  return buildValidationError(message);
}

module.exports = {
  validateEntityExists,
  validateClubExists,
  validateEventExists,
  validateUserExists,
  validateAnnouncementExists,
  validateRecruitmentExists,
  validateEventClubRelation,
  validateClubMembership,
  validateEventParticipation,
  validateRecruitmentApplication,
  isValidStatus,
  isValidEventStatus,
  isValidRecruitmentStatus,
  isValidApplicationStatus,
  isValidParticipantStatus,
  isValidClubLevel,
  isValidMemberRole,
  isValidImageType,
  buildValidationError,
  buildNotFoundError,
  buildForbiddenError,
  buildBadRequestError
};
