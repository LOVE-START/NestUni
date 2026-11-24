/**
 * 数据同步相关API模块
 * @description 处理数据版本检查、批量同步等功能
 */

const { request } = require('./core');
const { fetchClubs } = require('./club');
const { fetchAnnouncements } = require('./announcement');
const { fetchEvents } = require('./event');

/**
 * 获取所有版本信息
 * @description 从数据库版本管理表获取cacheVersion和announcementVersion
 * @returns {Promise} 版本信息 { cacheVersion, announcementVersion, announcementTitle, announcementContent, announcementImage }
 */
function getVersions() {
	return request({
		url: "/nfunest/api/version",
		method: "GET",
		showLoading: false
	}).then(response => {
		if (response && response.data) {
			return {
				cacheVersion: response.data.cacheVersion || 1,
				announcementVersion: response.data.announcementVersion || 0,
				announcementTitle: response.data.announcementTitle || '公告通知',
				announcementContent: response.data.announcementContent || '',
				announcementImage: response.data.announcementImage || ''
			};
		}
		return {
			cacheVersion: 1,
			announcementVersion: 0,
			announcementTitle: '公告通知',
			announcementContent: '',
			announcementImage: ''
		};
	}).catch(error => {
		console.error('获取版本信息失败:', error);
		return {
			cacheVersion: 1,
			announcementVersion: 0,
			announcementTitle: '公告通知',
			announcementContent: '',
			announcementImage: ''
		};
	});
}

/**
 * 获取数据版本信息
 * @description 兼容旧接口
 * @returns {Promise} 版本信息
 */
function getDataVersion() {
	return getVersions();
}

/**
 * 获取公告版本信息
 * @description 从服务器获取最新公告版本和公告内容（包含图片）
 * @returns {Promise} 公告版本信息 { version, title, content, image }
 */
function getAnnouncementVersion() {
	return getVersions().then(result => {
		return {
			version: result.announcementVersion || 0,
			title: result.announcementTitle || '公告通知',
			content: result.announcementContent || '',
			image: result.announcementImage || ''
		};
	});
}

/**
 * 获取所有社团数据（分页获取全部）
 * @returns {Promise} 所有社团数据
 */
function fetchAllClubs() {
	return new Promise((resolve, reject) => {
		const allClubs = [];
		const pageSize = 50;
		let currentPage = 1;
		
		function fetchPage() {
			fetchClubs({ page: currentPage, pageSize }, false)
				.then(response => {
					if (response && response.data && Array.isArray(response.data)) {
						allClubs.push(...response.data);
						
						const pagination = response.pagination || {};
						const totalPages = pagination.totalPages || 1;
						
						if (currentPage < totalPages) {
							currentPage++;
							fetchPage();
						} else {
							resolve({
								success: true,
								data: allClubs,
								pagination: {
									page: 1,
									pageSize: allClubs.length,
									total: allClubs.length,
									totalPages: 1
								}
							});
						}
					} else {
						reject(new Error('获取社团数据失败'));
					}
				})
				.catch(error => {
					reject(error);
				});
		}
		
		fetchPage();
	});
}

/**
 * 获取所有公告数据（分页获取全部）
 * @returns {Promise} 所有公告数据
 */
function fetchAllAnnouncements() {
	return new Promise((resolve, reject) => {
		const allAnnouncements = [];
		const pageSize = 50;
		let currentPage = 1;
		
		function fetchPage() {
			fetchAnnouncements({ page: currentPage, pageSize }, false)
				.then(response => {
					if (response && response.data && Array.isArray(response.data)) {
						allAnnouncements.push(...response.data);
						
						const pagination = response.pagination || {};
						const totalPages = pagination.totalPages || 1;
						
						if (currentPage < totalPages) {
							currentPage++;
							fetchPage();
						} else {
							resolve({
								success: true,
								data: allAnnouncements,
								pagination: {
									page: 1,
									pageSize: allAnnouncements.length,
									total: allAnnouncements.length,
									totalPages: 1
								}
							});
						}
					} else {
						reject(new Error('获取公告数据失败'));
					}
				})
				.catch(error => {
					reject(error);
				});
		}
		
		fetchPage();
	});
}

/**
 * 获取所有活动数据（分页获取全部）
 * @returns {Promise} 所有活动数据
 */
function fetchAllEvents() {
	return new Promise((resolve, reject) => {
		const allEvents = [];
		const pageSize = 50;
		let currentPage = 1;
		
		function fetchPage() {
			fetchEvents({ page: currentPage, pageSize }, false)
				.then(response => {
					if (response && response.data && Array.isArray(response.data)) {
						allEvents.push(...response.data);
						
						const pagination = response.pagination || {};
						const totalPages = pagination.totalPages || 1;
						
						if (currentPage < totalPages) {
							currentPage++;
							fetchPage();
						} else {
							resolve({
								success: true,
								data: allEvents,
								pagination: {
									page: 1,
									pageSize: allEvents.length,
									total: allEvents.length,
									totalPages: 1
								}
							});
						}
					} else {
						reject(new Error('获取活动数据失败'));
					}
				})
				.catch(error => {
					reject(error);
				});
		}
		
		fetchPage();
	});
}

/**
 * 批量同步数据
 * @description 获取完整的社团、公告、活动数据
 * @returns {Promise} 同步结果
 */
function syncAllData() {
	return Promise.all([
		fetchAllClubs(),
		fetchAllAnnouncements(),
		fetchAllEvents()
	]).then(([clubsRes, announcementsRes, eventsRes]) => {
		const clubs = (clubsRes && clubsRes.data) ? clubsRes.data : [];
		const announcements = (announcementsRes && announcementsRes.data) ? announcementsRes.data : [];
		const events = (eventsRes && eventsRes.data) ? eventsRes.data : [];
		
		console.log('数据同步成功:', {
			clubsCount: clubs.length,
			announcementsCount: announcements.length,
			eventsCount: events.length
		});
		
		return {
			clubs: clubs,
			announcements: announcements,
			events: events,
			lastSyncTime: new Date().toISOString()
		};
	});
}

module.exports = {
	getVersions,
	getDataVersion,
	getAnnouncementVersion,
	fetchAllClubs,
	fetchAllAnnouncements,
	fetchAllEvents,
	syncAllData
};
