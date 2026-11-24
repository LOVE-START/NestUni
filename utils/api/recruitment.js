/**
 * 招新报名相关API模块
 * @description 处理招新列表、报名、申请管理等功能
 */

const { request, requestWithUserToken } = require('./core');

/**
 * 获取招新列表
 * @param {Object} params - 查询参数
 * @returns {Promise} 招新列表
 */
function fetchRecruitments(params = {}) {
	return request({
		url: "/nfunest/api/recruitments",
		method: "POST",
		data: params,
		showLoading: params.page === 1
	});
}

/**
 * 获取招新详情
 * @param {string|number} recruitmentId - 招新ID
 * @returns {Promise} 招新详情
 */
function fetchRecruitmentById(recruitmentId) {
	return request({
		url: `/nfunest/api/recruitments/${recruitmentId}`,
		method: "GET"
	});
}

/**
 * 提交报名申请
 * @param {string|number} recruitmentId - 招新ID
 * @param {Object} formData - 表单数据
 * @returns {Promise} 报名结果
 */
function submitApplication(recruitmentId, formData) {
	return request({
		url: `/nfunest/api/recruitments/${recruitmentId}/apply`,
		method: "POST",
		data: { form_data: formData }
	});
}

/**
 * 获取我的报名列表
 * @returns {Promise} 报名列表
 */
function fetchMyApplications() {
	return request({
		url: "/nfunest/api/recruitments/my/applications",
		method: "GET",
		showLoading: true
	});
}

/**
 * 获取报名详情
 * @param {string|number} applicationId - 报名ID
 * @returns {Promise} 报名详情
 */
function fetchApplicationById(applicationId) {
	return request({
		url: `/nfunest/api/recruitments/applications/${applicationId}`,
		method: "GET"
	});
}

/**
 * 创建招新（社团会长权限）
 * @param {string|number} clubId - 社团ID
 * @param {Object} data - 招新数据
 * @returns {Promise} 创建结果
 */
function createRecruitment(clubId, data) {
	return requestWithUserToken({
		url: `/nfunest/api/recruitments/club/${clubId}`,
		method: "POST",
		data: data
	});
}

/**
 * 更新招新（社团会长权限）
 * @param {string|number} recruitmentId - 招新ID
 * @param {string|number} clubId - 社团ID
 * @param {Object} data - 更新数据
 * @returns {Promise} 更新结果
 */
function updateRecruitment(recruitmentId, clubId, data) {
	return requestWithUserToken({
		url: `/nfunest/api/recruitments/${recruitmentId}/club/${clubId}`,
		method: "PUT",
		data: data
	});
}

/**
 * 删除招新（社团会长权限）
 * @param {string|number} recruitmentId - 招新ID
 * @param {string|number} clubId - 社团ID
 * @returns {Promise} 删除结果
 */
function deleteRecruitment(recruitmentId, clubId) {
	return requestWithUserToken({
		url: `/nfunest/api/recruitments/${recruitmentId}/club/${clubId}`,
		method: "DELETE"
	});
}

/**
 * 更新招新状态（社团会长权限）
 * @param {string|number} recruitmentId - 招新ID
 * @param {string|number} clubId - 社团ID
 * @param {string} status - 状态
 * @returns {Promise} 更新结果
 */
function updateRecruitmentStatus(recruitmentId, clubId, status) {
	return requestWithUserToken({
		url: `/nfunest/api/recruitments/${recruitmentId}/club/${clubId}/status`,
		method: "PATCH",
		data: { status }
	});
}

/**
 * 获取社团收到的报名列表（社团会长权限）
 * @param {string|number} clubId - 社团ID
 * @param {Object} params - 查询参数
 * @returns {Promise} 报名列表
 */
function fetchClubApplications(clubId, params = {}) {
	const queryString = Object.keys(params)
		.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
		.join('&');
	const url = queryString 
		? `/nfunest/api/recruitments/club/${clubId}/applications?${queryString}`
		: `/nfunest/api/recruitments/club/${clubId}/applications`;
		
	return requestWithUserToken({
		url: url,
		method: "GET"
	});
}

/**
 * 更新报名状态（社团会长权限）
 * @param {string|number} applicationId - 报名ID
 * @param {Object} data - 更新数据
 * @returns {Promise} 更新结果
 */
function updateApplicationStatus(applicationId, data) {
	return requestWithUserToken({
		url: `/nfunest/api/recruitments/applications/${applicationId}/status`,
		method: "PUT",
		data: data
	});
}

module.exports = {
	fetchRecruitments,
	fetchRecruitmentById,
	submitApplication,
	fetchMyApplications,
	fetchApplicationById,
	createRecruitment,
	updateRecruitment,
	deleteRecruitment,
	updateRecruitmentStatus,
	fetchClubApplications,
	updateApplicationStatus
};
