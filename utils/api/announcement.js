/**
 * 公告相关API模块
 * @description 处理公告列表、详情、管理等功能
 */

const { request, requestWithUserToken, getAppInstance } = require('./core');

/**
 * 获取公告列表
 * @param {Object} params - 查询参数
 * @param {boolean} useCache - 是否使用缓存
 * @returns {Promise} 公告列表
 */
function fetchAnnouncements(params = {}, useCache = true) {
	if (useCache && (!params.page || params.page === 1)) {
		try {
			const app = getAppInstance();
			if (!app) {
				return Promise.reject(new Error('App实例未初始化'));
			}
			
			const { getTimedCached } = require('../cache');
			const cached = getTimedCached(app.globalData.announcementsKey);
			
			if (cached.data && cached.data.length > 0 && !cached.expired) {
				console.log('使用缓存的公告数据');
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
				console.log('公告缓存已过期，将获取最新数据');
			}
		} catch (e) {
			console.warn('读取公告缓存失败，将从网络获取数据:', e);
		}
	}
	
	return request({ 
		url: "/nfunest/api/announcements",
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
						setTimedCached(app.globalData.announcementsKey, response.data || []);
					}
				} catch (e) {
					console.warn('缓存公告数据失败:', e);
				}
			}
			return response;
		} else {
			throw new Error(response.message || '获取公告列表失败');
		}
	});
}

/**
 * 创建公告（管理员）
 * @param {Object} payload - 公告数据
 * @returns {Promise} 创建结果
 */
function createAnnouncement(payload) {
	return request({ 
		url: "/nfunest/api/admin/announcements", 
		method: "POST", 
		data: payload 
	});
}

/**
 * 更新公告（管理员）
 * @param {string|number} announcementId - 公告ID
 * @param {Object} payload - 公告数据
 * @returns {Promise} 更新结果
 */
function updateAnnouncement(announcementId, payload) {
	return request({ 
		url: `/nfunest/api/admin/announcements/${announcementId}`, 
		method: "PUT", 
		data: payload 
	});
}

/**
 * 删除公告（管理员）
 * @param {string|number} announcementId - 公告ID
 * @returns {Promise} 删除结果
 */
function deleteAnnouncement(announcementId) {
	return request({
		url: `/nfunest/api/admin/announcements/${announcementId}`,
		method: "DELETE"
	});
}

/**
 * 通用公告管理函数
 * @param {string} action - 操作类型：create/update/delete
 * @param {Object|null} payload - 公告数据
 * @param {string|number|null} clubId - 社团ID（会长权限时使用）
 * @param {string|number|null} announcementId - 公告ID
 * @returns {Promise} 操作结果
 */
function manageAnnouncement(action, payload, clubId = null, announcementId = null) {
	switch (action) {
		case 'create':
			if (clubId) {
				return requestWithUserToken({ 
					url: `/nfunest/api/announcements/club/${clubId}`,
					method: "POST",
					data: payload
				});
			} else {
				return request({ 
					url: "/nfunest/api/admin/announcements", 
					method: "POST", 
					data: payload 
				});
			}
		case 'update':
			if (clubId && announcementId) {
				return requestWithUserToken({ 
					url: `/nfunest/api/announcements/${announcementId}`,
					method: "PUT",
					data: payload
				});
			} else if (announcementId) {
				return request({ 
					url: `/nfunest/api/admin/announcements/${announcementId}`, 
					method: "PUT", 
					data: payload 
				});
			} else {
				return Promise.reject(new Error('更新公告时缺少公告ID'));
			}
		case 'delete':
			if (clubId && announcementId) {
				return requestWithUserToken({ 
					url: `/nfunest/api/announcements/${announcementId}/club/${clubId}`,
					method: "DELETE"
				});
			} else if (announcementId) {
				return request({
					url: `/nfunest/api/admin/announcements/${announcementId}`,
					method: "DELETE"
				});
			} else {
				return Promise.reject(new Error('删除公告时缺少公告ID'));
			}
		default:
			return Promise.reject(new Error('无效的操作类型'));
	}
}

module.exports = {
	fetchAnnouncements,
	createAnnouncement,
	updateAnnouncement,
	deleteAnnouncement,
	manageAnnouncement
};
