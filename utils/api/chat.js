/**
 * AI聊天API模块
 * @description 提供AI助手聊天相关的API接口
 */

const { request } = require('./core');

/**
 * 创建新的聊天会话
 * @returns {Promise} 新创建的会话
 */
const createChatSession = () => {
  return request({
    url: '/nfunest/api/chat/sessions',
    method: 'POST',
    showLoading: false
  });
};

/**
 * 获取用户的会话列表
 * @returns {Promise} 会话列表
 */
const fetchChatSessions = () => {
  return request({
    url: '/nfunest/api/chat/sessions',
    method: 'GET',
    showLoading: false
  });
};

/**
 * 删除聊天会话
 * @param {number} sessionId - 会话ID
 * @returns {Promise} 删除结果
 */
const deleteChatSession = (sessionId) => {
  return request({
    url: `/nfunest/api/chat/sessions/${sessionId}`,
    method: 'DELETE'
  });
};

/**
 * 获取会话消息列表
 * @param {number} sessionId - 会话ID
 * @returns {Promise} 消息列表
 */
const fetchChatMessages = (sessionId) => {
  return request({
    url: `/nfunest/api/chat/sessions/${sessionId}/messages`,
    method: 'GET',
    showLoading: false
  });
};

/**
 * 发送聊天消息
 * @param {number} sessionId - 会话ID
 * @param {string} message - 用户消息
 * @param {Object} [options] - 额外选项
 * @param {number} [options.latitude] - 用户纬度
 * @param {number} [options.longitude] - 用户经度
 * @returns {Promise} AI回复
 */
const sendChatMessage = (sessionId, message, options = {}) => {
  const data = { message };
  if (options.latitude) data.latitude = options.latitude;
  if (options.longitude) data.longitude = options.longitude;

  return request({
    url: `/nfunest/api/chat/sessions/${sessionId}/messages`,
    method: 'POST',
    data,
    showLoading: false,
    showError: false
  });
};

/**
 * 批量获取活动详情
 * @description 根据活动ID列表批量获取活动详情，用于AI推荐卡片展示
 * @param {number[]} ids - 活动ID列表
 * @returns {Promise<Object>} 活动列表
 */
const fetchEventsByIds = (ids) => {
  if (!ids || ids.length === 0) {
    return Promise.resolve({ success: true, data: [] });
  }
  return request({
    url: `/nfunest/api/events/by-ids?ids=${ids.join(',')}`,
    method: 'GET',
    showLoading: false
  });
};

/**
 * 批量获取社团详情
 * @description 根据社团ID列表批量获取社团详情，用于AI推荐卡片展示
 * @param {number[]} ids - 社团ID列表
 * @returns {Promise<Object>} 社团列表
 */
const fetchClubsByIds = (ids) => {
  if (!ids || ids.length === 0) {
    return Promise.resolve({ success: true, data: [] });
  }
  return request({
    url: `/nfunest/api/clubs/by-ids?ids=${ids.join(',')}`,
    method: 'GET',
    showLoading: false
  });
};

 /**
 * 批量获取羽章详情
 * @description 根据羽章ID列表批量获取羽章详情，用于AI推荐卡片展示
 * @param {number[]} ids - 羽章ID列表
 * @returns {Promise<Object>} 羽章列表
 */
const fetchBadgesByIds = (ids) => {
  if (!ids || ids.length === 0) {
    return Promise.resolve({ success: true, data: [] });
  }
  return request({
    url: `/nfunest/api/badges/by-ids?ids=${ids.join(',')}`,
    method: 'GET',
    showLoading: false
  });
};

/**
 * 确认执行Agent待确认操作
 * @description 写操作二次确认：携带后端签发的actionToken请求真正执行
 * @param {number} sessionId - 会话ID
 * @param {string} actionToken - 确认令牌
 * @param {number} [messageId] - 携带确认卡片的消息ID
 * @returns {Promise<Object>} 执行结果
 */
const confirmAgentAction = (sessionId, actionToken, messageId) => {
  return request({
    url: `/nfunest/api/chat/sessions/${sessionId}/confirm`,
    method: 'POST',
    data: { actionToken, messageId },
    showLoading: false,
    showError: false
  });
};

/**
 * 取消Agent待确认操作
 * @description 取消闭环走后端：审计记录置为cancelled，并落库取消消息，避免残留pending僵尸记录
 * @param {number} sessionId - 会话ID
 * @param {string} actionToken - 确认令牌
 * @param {number} [messageId] - 携带确认卡片的消息ID
 * @returns {Promise<Object>} 取消结果
 */
const cancelAgentAction = (sessionId, actionToken, messageId) => {
  return request({
    url: `/nfunest/api/chat/sessions/${sessionId}/cancel-action`,
    method: 'POST',
    data: { actionToken, messageId },
    showLoading: false,
    showError: false
  });
};

module.exports = {
  createChatSession,
  fetchChatSessions,
  deleteChatSession,
  fetchChatMessages,
  sendChatMessage,
  fetchEventsByIds,
  fetchClubsByIds,
  fetchBadgesByIds,
  confirmAgentAction,
  cancelAgentAction
};
