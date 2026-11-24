/**
 * 审核API模块
 * @description 处理审核相关的接口请求
 */

const { request, requestWithUserToken } = require('./core');

/**
 * 获取待审核列表（管理员/老师）
 * @param {Object} params - 查询参数
 * @param {string} params.targetType - 审核对象类型 (event/announcement)
 * @param {number} params.clubId - 社团ID（可选）
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 * @returns {Promise<Object>} 审核列表
 */
function fetchPendingApprovals(params = {}) {
  const { targetType, clubId, page = 1, pageSize = 20 } = params;
  
  let url = `/nfunest/api/approvals/pending?page=${page}&pageSize=${pageSize}`;
  if (targetType) url += `&targetType=${targetType}`;
  if (clubId) url += `&clubId=${clubId}`;
  
  return request({
    url,
    method: 'GET',
    showLoading: false
  });
}

/**
 * 获取审核详情
 * @param {number} approvalId - 审核记录ID
 * @returns {Promise<Object>} 审核详情
 */
function fetchApprovalDetail(approvalId) {
  return request({
    url: `/nfunest/api/approvals/${approvalId}`,
    method: 'GET'
  });
}

/**
 * 审核通过
 * @param {number} approvalId - 审核记录ID
 * @returns {Promise<Object>} 审核结果
 */
function approveApproval(approvalId) {
  return request({
    url: `/nfunest/api/approvals/${approvalId}/approve`,
    method: 'PUT'
  });
}

/**
 * 审核拒绝
 * @param {number} approvalId - 审核记录ID
 * @param {string} rejectReason - 拒绝原因
 * @returns {Promise<Object>} 审核结果
 */
function rejectApproval(approvalId, rejectReason) {
  return request({
    url: `/nfunest/api/approvals/${approvalId}/reject`,
    method: 'PUT',
    data: { rejectReason }
  });
}

/**
 * 获取用户的审核记录（会长查看自己的申请）
 * @param {Object} params - 查询参数
 * @param {string} params.status - 审核状态（可选）
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 * @returns {Promise<Object>} 审核记录列表
 */
function fetchMyApprovals(params = {}) {
  const { status, page = 1, pageSize = 20 } = params;
  
  let url = `/nfunest/api/approvals/my-applications/list?page=${page}&pageSize=${pageSize}`;
  if (status) url += `&status=${status}`;
  
  return requestWithUserToken({
    url,
    method: 'GET',
    showLoading: false
  });
}

/**
 * 获取待审核数量统计（管理员/老师）
 * @returns {Promise<Object>} 统计数据
 */
function fetchApprovalStats() {
  return request({
    url: '/nfunest/api/approvals/stats/count',
    method: 'GET',
    showLoading: false
  });
}

/**
 * 会长创建公告（需审核）
 * @param {number} clubId - 社团ID
 * @param {Object} data - 公告数据
 * @returns {Promise<Object>} 创建结果
 */
function createAnnouncementAsLeader(clubId, data) {
  return requestWithUserToken({
    url: `/nfunest/api/admin/clubs/${clubId}/announcements/leader`,
    method: 'POST',
    data
  });
}

module.exports = {
  fetchPendingApprovals,
  fetchApprovalDetail,
  approveApproval,
  rejectApproval,
  fetchMyApprovals,
  fetchApprovalStats,
  createAnnouncementAsLeader
};
