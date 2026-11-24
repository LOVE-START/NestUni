/**
 * 社团相关API模块
 * @description 处理社团列表、详情、成员管理等功能
 */

const { request, requestWithUserToken, getAppInstance } = require('./core');

/**
 * 获取社团列表
 * @param {Object} params - 查询参数
 * @param {boolean} useCache - 是否使用缓存
 * @returns {Promise} 社团列表
 */
function fetchClubs(params = {}, useCache = true) {
	if (useCache && (!params.page || params.page === 1)) {
		try {
			const app = getAppInstance();
			if (!app) {
				return Promise.reject(new Error('App实例未初始化'));
			}
			
			const { getTimedCached } = require('../cache');
			const cached = getTimedCached(app.globalData.clubListKey);
			
			if (cached.data && cached.data.length > 0 && !cached.expired) {
				console.log('使用缓存的社团数据');
				return Promise.resolve({
					success: true,
					data: cached.data,
					pagination: {
						page: 1,
						pageSize: cached.data.length,
						total: cached.data.length,
						totalPages: 1
					}
				});
			}
			if (cached.expired) {
				console.log('社团缓存已过期，将获取最新数据');
			}
		} catch (e) {
			console.warn('读取社团缓存失败，将从网络获取数据:', e);
		}
	}
	
	return request({ 
		url: "/nfunest/api/clubs",
		method: "POST",
		data: params,
		showLoading: false
	}).then(response => {
		if (response && response.success) {
			if (!params.page || params.page === 1) {
				try {
					const app = getAppInstance();
					if (app) {
						const { setTimedCached } = require('../cache');
						setTimedCached(app.globalData.clubListKey, response.data || []);
					}
				} catch (e) {
					console.warn('缓存社团数据失败:', e);
				}
			}
			return response;
		} else {
			throw new Error(response.message || '获取社团列表失败');
		}
	});
}

/**
 * 获取用户加入的社团列表
 * @returns {Promise} 用户加入的社团列表
 */
function fetchMyClubs() {
	return request({ 
		url: "/nfunest/api/clubs/my",
		method: "GET",
		showLoading: true
	}).catch(error => {
		console.error('获取用户加入的社团列表失败:', error);
		wx.showToast({ 
			title: '获取社团列表失败', 
			icon: 'none' 
		});
		throw error;
	});
}

/**
 * 根据ID获取社团详情
 * @param {string|number} clubId - 社团ID
 * @returns {Promise} 社团详情
 */
function fetchClubById(clubId) {
	return request({ 
		url: `/nfunest/api/clubs/${clubId}`,
		method: "GET"
	});
}

/**
 * 获取特定社团的公告
 * @param {string|number} clubId - 社团ID
 * @param {Object} params - 查询参数
 * @returns {Promise} 公告列表
 */
function fetchClubAnnouncements(clubId, params = {}) {
	return request({ 
		url: `/nfunest/api/clubs/${clubId}/announcements`,
		method: "POST",
		data: params
	});
}

/**
 * 获取社团成员列表
 * @param {string|number} clubId - 社团ID
 * @param {Object} params - 查询参数
 * @returns {Promise} 成员列表
 */
function fetchClubMembers(clubId, params = {}) {
	const queryString = Object.keys(params)
		.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
		.join('&');
	const url = queryString 
		? `/nfunest/api/clubs/${clubId}/members?${queryString}`
		: `/nfunest/api/clubs/${clubId}/members`;
		
	return request({ 
		url: url,
		method: "GET"
	});
}

/**
 * 获取社团相关的活动
 * @param {string|number} clubId - 社团ID
 * @param {Object} params - 查询参数
 * @returns {Promise} 活动列表
 */
function fetchClubEvents(clubId, params = {}) {
	const queryString = Object.keys(params)
		.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
		.join('&');
	const url = queryString 
		? `/nfunest/api/clubs/${clubId}/events?${queryString}`
		: `/nfunest/api/clubs/${clubId}/events`;
		
	return request({ 
		url: url,
		method: "GET"
	});
}

/**
 * 更改社团成员角色
 * @param {string|number} clubId - 社团ID
 * @param {string|number} userId - 用户ID
 * @param {string} role - 角色
 * @returns {Promise} 更新结果
 */
function changeClubMemberRole(clubId, userId, role) {
	return request({ 
		url: `/nfunest/api/admin/clubs/${clubId}/members/${userId}`,
		method: "PUT",
		data: { role }
	});
}

/**
 * 移除社团成员
 * @param {string|number} clubId - 社团ID
 * @param {string|number} userId - 用户ID
 * @returns {Promise} 移除结果
 */
function removeClubMember(clubId, userId) {
	return request({ 
		url: `/nfunest/api/admin/clubs/${clubId}/members/${userId}`,
		method: "DELETE"
	});
}

/**
 * 添加社团成员
 * @param {string|number} clubId - 社团ID
 * @param {string|number} userId - 用户ID
 * @param {string} role - 角色
 * @returns {Promise} 添加结果
 */
function addClubMember(clubId, userId, role) {
	return request({ 
		url: `/nfunest/api/admin/clubs/${clubId}/members`,
		method: "POST",
		data: { userId, role }
	});
}

/**
 * 通过学号搜索用户
 * @param {string} studentId - 学号
 * @param {Object} params - 查询参数
 * @returns {Promise} 搜索结果
 */
function searchUsersByStudentId(studentId, params = {}) {
	const queryParams = Object.assign({ studentId }, params);
	const queryString = Object.keys(queryParams)
		.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
		.join('&');
		
	return request({ 
		url: `/nfunest/api/admin/users/search?${queryString}`,
		method: "GET"
	});
}

/**
 * 获取社团成员列表（会长权限）
 * @param {string|number} clubId - 社团ID
 * @param {Object} params - 查询参数
 * @returns {Promise} 成员列表
 */
function fetchClubMembersAsLeader(clubId, params = {}) {
	return requestWithUserToken({ 
		url: `/nfunest/api/clubs/${clubId}/members`,
		method: "GET",
		data: params
	});
}

/**
 * 添加社团成员（会长权限）
 * @param {string|number} clubId - 社团ID
 * @param {string|number} userId - 用户ID
 * @param {string} role - 角色
 * @returns {Promise} 添加结果
 */
function addClubMemberAsLeader(clubId, userId, role) {
	return requestWithUserToken({ 
		url: `/nfunest/api/clubs/${clubId}/members`,
		method: "POST",
		data: { userId, role }
	});
}

/**
 * 更改社团成员角色（会长权限）
 * @param {string|number} clubId - 社团ID
 * @param {string|number} userId - 用户ID
 * @param {string} role - 角色
 * @returns {Promise} 更新结果
 */
function changeClubMemberRoleAsLeader(clubId, userId, role) {
	return requestWithUserToken({ 
		url: `/nfunest/api/clubs/${clubId}/members/${userId}`,
		method: "PUT",
		data: { role }
	});
}

/**
 * 移除社团成员（会长权限）
 * @param {string|number} clubId - 社团ID
 * @param {string|number} userId - 用户ID
 * @returns {Promise} 移除结果
 */
function removeClubMemberAsLeader(clubId, userId) {
	return requestWithUserToken({ 
		url: `/nfunest/api/clubs/${clubId}/members/${userId}`,
		method: "DELETE"
	});
}

/**
 * 更改社团成员状态（会长权限）- 换届系统
 * @description 标记成员为已毕业或在任状态
 * @param {string|number} clubId - 社团ID
 * @param {string|number} userId - 用户ID
 * @param {string} status - 成员状态：active=在任, graduated=已毕业
 * @returns {Promise} 更新结果
 */
function changeClubMemberStatusAsLeader(clubId, userId, status) {
	return requestWithUserToken({ 
		url: `/nfunest/api/clubs/${clubId}/members/${userId}/status`,
		method: "PUT",
		data: { status }
	});
}

/**
 * 通过学号搜索用户（会长权限）
 * @param {string|number} clubId - 社团ID
 * @param {string} studentId - 学号
 * @param {Object} params - 查询参数
 * @returns {Promise} 搜索结果
 */
function searchUsersByStudentIdAsLeader(clubId, studentId, params = {}) {
	const queryParams = Object.assign({ studentId }, params);
	const queryString = Object.keys(queryParams)
		.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
		.join('&');
		
	return requestWithUserToken({ 
		url: `/nfunest/api/clubs/${clubId}/users/search?${queryString}`,
		method: "GET"
	});
}

/**
 * 通用社团管理函数
 * @param {string} action - 操作类型：create/update/delete
 * @param {string|number|null} clubId - 社团ID
 * @param {Object|null} payload - 数据负载
 * @param {boolean} isAdmin - 是否管理员操作
 * @returns {Promise} 操作结果
 */
function manageClub(action, clubId = null, payload = null, isAdmin = false) {
	switch (action) {
		case 'update':
			if (isAdmin) {
				return request({ 
					url: `/nfunest/api/admin/clubs/${clubId}`,
					method: "PUT",
					data: payload
				});
			} else {
				return requestWithUserToken({ 
					url: `/nfunest/api/clubs/${clubId}`,
					method: "PUT",
					data: payload
				});
			}
		case 'create':
			return request({ 
				url: `/nfunest/api/admin/clubs`,
				method: "POST",
				data: payload
			});
		case 'delete':
			return request({
				url: `/nfunest/api/admin/clubs/${clubId}`,
				method: "DELETE"
			});
		default:
			return Promise.reject(new Error('无效的操作类型'));
	}
}

/**
 * 更新社团信息（管理员）
 * @param {string|number} clubId - 社团ID
 * @param {Object} payload - 更新数据
 * @returns {Promise} 更新结果
 */
function updateClub(clubId, payload) {
	return request({ 
		url: `/nfunest/api/admin/clubs/${clubId}`, 
		method: "PUT", 
		data: payload 
	});
}

/**
 * 创建社团（管理员）
 * @param {Object} payload - 社团数据
 * @returns {Promise} 创建结果
 */
function createClub(payload) {
	return request({ 
		url: `/nfunest/api/admin/clubs`, 
		method: "POST", 
		data: payload 
	});
}

/**
 * 删除社团（管理员）
 * @param {string|number} clubId - 社团ID
 * @returns {Promise} 删除结果
 */
function deleteClub(clubId) {
	return request({
		url: `/nfunest/api/admin/clubs/${clubId}`,
		method: "DELETE"
	});
}

/**
 * 获取社团综合概览数据
 * @param {string|number} clubId - 社团ID
 * @param {string} period - 时间周期
 * @returns {Promise} 概览数据
 */
function getStatsOverview(clubId, period = 'semester') {
	return requestWithUserToken({
		url: `/nfunest/api/clubs/${clubId}/stats/overview`,
		method: 'GET',
		data: { period }
	});
}

/**
 * 获取社团活动数据统计
 * @param {string|number} clubId - 社团ID
 * @param {string} period - 时间周期
 * @param {number} months - 月份数
 * @returns {Promise} 活动统计数据
 */
function getStatsEvents(clubId, period = 'semester', months = 6) {
	return requestWithUserToken({
		url: `/nfunest/api/clubs/${clubId}/stats/events`,
		method: 'GET',
		data: { period, months }
	});
}

/**
 * 获取社团成员数据统计
 * @param {string|number} clubId - 社团ID
 * @param {string} period - 时间周期
 * @param {number} months - 月份数
 * @returns {Promise} 成员统计数据
 */
function getStatsMembers(clubId, period = 'semester', months = 6) {
	return requestWithUserToken({
		url: `/nfunest/api/clubs/${clubId}/stats/members`,
		method: 'GET',
		data: { period, months }
	});
}

/**
 * 获取社团招新数据统计
 * @param {string|number} clubId - 社团ID
 * @param {string} period - 时间周期
 * @returns {Promise} 招新统计数据
 */
function getStatsRecruitments(clubId, period = 'semester') {
	return requestWithUserToken({
		url: `/nfunest/api/clubs/${clubId}/stats/recruitments`,
		method: 'GET',
		data: { period }
	});
}

module.exports = {
	fetchClubs,
	fetchMyClubs,
	fetchClubById,
	fetchClubAnnouncements,
	fetchClubMembers,
	fetchClubEvents,
	changeClubMemberRole,
	removeClubMember,
	addClubMember,
	searchUsersByStudentId,
	fetchClubMembersAsLeader,
	addClubMemberAsLeader,
	changeClubMemberRoleAsLeader,
	removeClubMemberAsLeader,
	changeClubMemberStatusAsLeader,
	searchUsersByStudentIdAsLeader,
	manageClub,
	updateClub,
	createClub,
	deleteClub,
	getStatsOverview,
	getStatsEvents,
	getStatsMembers,
	getStatsRecruitments
};
