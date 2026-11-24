/**
 * 活动相关API模块
 * @description 处理活动列表、详情、报名等功能
 */

const { request, requestWithUserToken, getAppInstance } = require('./core');

/**
 * 获取活动列表
 * @param {Object} params - 查询参数
 * @param {boolean} useCache - 是否使用缓存
 * @returns {Promise} 活动列表
 */
function fetchEvents(params = {}, useCache = true) {
	if (useCache && params.page === 1) {
		try {
			const { getTimedCached } = require('../cache');
			const cached = getTimedCached('eventList');
			
			if (cached.data && cached.data.length > 0 && !cached.expired) {
				console.log('使用缓存的活动数据');
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
				console.log('缓存已过期，将获取最新数据');
			}
		} catch (e) {
			console.warn('读取缓存失败，将从网络获取数据:', e);
		}
	}
	
	return request({ 
		url: "/nfunest/api/events",
		method: "POST",
		data: params,
		showLoading: params.page > 1 ? false : true
	}).then(response => {
		if (response && response.success) {
			if (params.page === 1) {
				try {
					const { setTimedCached } = require('../cache');
					setTimedCached('eventList', response.data || []);
				} catch (e) {
					console.warn('缓存活动数据失败:', e);
				}
			}
			return response;
		} else {
			throw new Error(response.message || '获取活动列表失败');
		}
	});
}

/**
 * 获取用户参与的活动列表
 * @returns {Promise} 用户参与的活动列表
 */
function fetchMyEvents() {
	return request({ 
		url: "/nfunest/api/events/my",
		method: "GET",
		showLoading: true
	}).catch(error => {
		console.error('获取用户参与的活动列表失败:', error);
		wx.showToast({ 
			title: '获取活动列表失败', 
			icon: 'none' 
		});
		throw error;
	});
}

/**
 * 根据ID获取活动详情
 * @param {string|number} eventId - 活动ID
 * @returns {Promise} 活动详情
 */
function fetchEventById(eventId) {
	return request({ 
		url: `/nfunest/api/events/${eventId}`,
		method: "GET"
	});
}

/**
 * 报名参加活动
 * @param {string|number} eventId - 活动ID
 * @returns {Promise} 报名结果
 */
function joinEvent(eventId) {
	return request({ 
		url: `/nfunest/api/events/${eventId}/join`, 
		method: "POST" 
	});
}

/**
 * 取消报名
 * @param {string|number} eventId - 活动ID
 * @returns {Promise} 取消结果
 */
function cancelJoinEvent(eventId) {
	return request({ 
		url: `/nfunest/api/events/${eventId}/join`, 
		method: "DELETE" 
	});
}

/**
 * 获取活动参与者列表
 * @param {string|number} eventId - 活动ID
 * @param {Object} params - 查询参数
 * @returns {Promise} 参与者列表
 */
function fetchEventParticipants(eventId, params = {}) {
	const queryString = Object.keys(params)
		.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
		.join('&');
	const url = queryString 
		? `/nfunest/api/admin/events/${eventId}/participants?${queryString}`
		: `/nfunest/api/admin/events/${eventId}/participants`;
		
	return request({
		url: url,
		method: "GET"
	});
}

/**
 * 更改活动参与者状态
 * @param {string|number} eventId - 活动ID
 * @param {string|number} userId - 用户ID
 * @param {string} status - 状态
 * @returns {Promise} 更新结果
 */
function changeEventParticipantStatus(eventId, userId, status) {
	return request({ 
		url: `/nfunest/api/admin/events/${eventId}/participants/${userId}`,
		method: "PUT",
		data: { status }
	});
}

/**
 * 移除活动参与者
 * @param {string|number} eventId - 活动ID
 * @param {string|number} userId - 用户ID
 * @returns {Promise} 移除结果
 */
function removeEventParticipant(eventId, userId) {
	return request({ 
		url: `/nfunest/api/admin/events/${eventId}/participants/${userId}`,
		method: "DELETE"
	});
}

/**
 * 清理活动数据负载
 * @param {Object} data - 原始数据
 * @returns {Object} 清理后的数据
 */
function cleanEventPayload(data) {
	if (!data) return data;
	
	const cleaned = {};
	for (const key in data) {
		if (data[key] !== undefined && data[key] !== null) {
			if (Array.isArray(data[key])) {
				cleaned[key] = data[key].filter(item => item !== undefined && item !== null);
			} else if (typeof data[key] === 'object' && data[key] !== null) {
				cleaned[key] = cleanEventPayload(data[key]);
			} else {
				cleaned[key] = data[key];
			}
		}
	}
	return cleaned;
}

/**
 * 通用活动管理函数
 * @param {string} action - 操作类型：create/update/delete
 * @param {string|number|null} eventId - 活动ID
 * @param {Object|null} payload - 数据负载
 * @param {string|number|null} clubId - 社团ID（会长权限时使用）
 * @returns {Promise} 操作结果
 */
function manageEvent(action, eventId, payload = null, clubId = null) {
	const cleanData = cleanEventPayload(payload);
	
	switch (action) {
		case 'create':
			if (clubId) {
				return requestWithUserToken({
					url: `/nfunest/api/events/club/${clubId}`,
					method: "POST",
					data: cleanData
				});
			} else {
				return request({
					url: "/nfunest/api/events/create",
					method: "POST",
					data: cleanData
				});
			}
		case 'update':
			if (clubId && eventId) {
				return requestWithUserToken({
					url: `/nfunest/api/events/${eventId}/club/${clubId}`,
					method: "PUT",
					data: cleanData
				});
			} else if (eventId) {
				return request({
					url: `/nfunest/api/events/${eventId}`,
					method: "PUT",
					data: cleanData
				});
			} else {
				return Promise.reject(new Error('更新活动时缺少活动ID'));
			}
		case 'delete':
			if (clubId && eventId) {
				return requestWithUserToken({
					url: `/nfunest/api/events/${eventId}/club/${clubId}`,
					method: "DELETE"
				});
			} else if (eventId) {
				return request({
					url: `/nfunest/api/events/${eventId}`,
					method: "DELETE"
				});
			} else {
				return Promise.reject(new Error('删除活动时缺少活动ID'));
			}
		default:
			return Promise.reject(new Error('无效的操作类型'));
	}
}

/**
 * 通用活动状态修改函数
 * @param {string|number} eventId - 活动ID
 * @param {string} status - 状态
 * @param {string|number|null} clubId - 社团ID
 * @returns {Promise} 更新结果
 */
function updateEventStatusUnified(eventId, status, clubId = null) {
	if (clubId) {
		return requestWithUserToken({
			url: `/nfunest/api/events/${eventId}/club/${clubId}/status`,
			method: "PATCH",
			data: { status }
		});
	} else {
		return request({
			url: `/nfunest/api/admin/events/${eventId}/status`,
			method: "PATCH",
			data: { status }
		});
	}
}

/**
 * 删除活动图片URL
 * @param {string|number} eventId - 活动ID
 * @param {string} imageUrl - 图片URL
 * @param {string} imageType - 图片类型
 * @returns {Promise} 删除结果
 */
function deleteEventImage(eventId, imageUrl, imageType) {
	const app = getAppInstance();
	if (!app) {
		return Promise.reject(new Error('App实例未初始化'));
	}
	
	return request({
		url: `/nfunest/api/admin/events/${eventId}/images`,
		method: "DELETE",
		data: { imageUrl, imageType }
	}).catch(error => {
		console.error('删除活动图片URL失败:', error);
		return { success: true, message: '图片URL删除成功' };
	});
}

/**
 * 获取活动地图数据
 * @param {Object} params - 参数
 * @returns {Promise} 活动列表
 */
function fetchEventsMap(params = {}) {
	return request({
		url: "/nfunest/api/events/map",
		method: "POST",
		data: params,
		showLoading: false
	});
}

/**
 * 获取附近活动
 * @param {number} latitude - 纬度
 * @param {number} longitude - 经度
 * @param {number} radius - 半径(km)
 * @param {number} limit - 数量限制
 * @returns {Promise} 活动列表
 */
function fetchNearbyEvents(latitude, longitude, radius = 5, limit = 10) {
	return request({
		url: "/nfunest/api/events/nearby",
		method: "POST",
		data: { latitude, longitude, radius, limit },
		showLoading: false
	});
}

/**
 * 记录地图查看（触发羽章）
 * @description 用户查看活动地图时调用，用于触发"地图探索者"羽章
 * @returns {Promise} 记录结果
 */
function recordMapViewed() {
	return requestWithUserToken({
		url: "/nfunest/api/events/map-viewed",
		method: "POST",
		showLoading: false
	}).catch(error => {
		console.warn('记录地图查看失败:', error);
		return { success: true };
	});
}

module.exports = {
	fetchEvents,
	fetchMyEvents,
	fetchEventById,
	joinEvent,
	cancelJoinEvent,
	fetchEventParticipants,
	changeEventParticipantStatus,
	removeEventParticipant,
	manageEvent,
	updateEventStatusUnified,
	deleteEventImage,
	fetchEventsMap,
	fetchNearbyEvents,
	recordMapViewed
};
