/**
 * 羽章系统API模块
 * @description 提供羽章相关的API接口
 */

const { request } = require('./core');

/**
 * 获取所有羽章列表
 * @param {Object} params - 查询参数
 * @returns {Promise} 羽章列表
 */
const fetchAllBadges = (params = {}) => {
  return request({
    url: '/nfunest/api/badges',
    method: 'GET',
    data: params
  });
};

/**
 * 获取用户羽章列表
 * @returns {Promise} 用户羽章列表
 */
const fetchMyBadges = () => {
  return request({
    url: '/nfunest/api/badges/my',
    method: 'GET'
  });
};

/**
 * 获取羽章详情
 * @param {number} badgeId - 羽章ID
 * @returns {Promise} 羽章详情
 */
const fetchBadgeDetail = (badgeId) => {
  return request({
    url: `/nfunest/api/badges/${badgeId}`,
    method: 'GET'
  });
};

/**
 * 更新羽章展示设置
 * @param {Array} badgeIds - 羽章ID列表
 * @param {Object} displayOrders - 展示顺序
 * @returns {Promise} 更新结果
 */
const updateBadgeDisplay = (badgeIds, displayOrders) => {
  return request({
    url: '/nfunest/api/badges/my/display',
    method: 'PUT',
    data: {
      badge_ids: badgeIds,
      display_orders: displayOrders
    }
  });
};

/**
 * 获取用户羽章统计
 * @returns {Promise} 羽章统计数据
 */
const fetchBadgeStats = () => {
  return request({
    url: '/nfunest/api/badges/my/stats',
    method: 'GET'
  });
};

/**
 * 获取用户活跃度
 * @returns {Promise} 活跃度数据
 */
const fetchUserActivity = () => {
  return request({
    url: '/nfunest/api/badges/my/activity',
    method: 'GET'
  });
};

/**
 * 管理员授予羽章
 * @param {number} badgeId - 羽章ID
 * @param {number} userId - 用户ID
 * @returns {Promise} 授予结果
 */
const awardBadge = (badgeId, userId) => {
  return request({
    url: `/nfunest/api/badges/${badgeId}/award`,
    method: 'POST',
    data: {
      user_id: userId
    }
  });
};

module.exports = {
  fetchAllBadges,
  fetchMyBadges,
  fetchBadgeDetail,
  updateBadgeDisplay,
  fetchBadgeStats,
  fetchUserActivity,
  awardBadge
};
