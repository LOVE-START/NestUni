/**
 * 缓存工具模块
 * @description 提供带时间戳的缓存管理功能
 */

// 缓存过期时间（10分钟）
const CACHE_EXPIRY_TIME = 20 * 60 * 1000;

/**
 * 延迟获取App实例，避免模块加载时App未初始化
 * @returns {Object|null} App实例或null
 */
function getAppInstance() {
	try {
		return getApp();
	} catch (e) {
		console.error('获取App实例失败:', e);
		return null;
	}
}

/**
 * 获取带时间戳的缓存数据
 * @param {string} key - 缓存键
 * @param {any} fallback - 默认值
 * @returns {object} 包含数据和时间戳的对象
 */
function getTimedCached(key, fallback = []) {
	try {
		const cachedData = wx.getStorageSync(key);
		if (cachedData) {
			// 检查缓存是否过期
			const now = Date.now();
			if (now - cachedData.timestamp < CACHE_EXPIRY_TIME) {
				console.log(`使用缓存数据: ${key}`);
				return { data: cachedData.data, timestamp: cachedData.timestamp };
			} else {
				console.log(`缓存已过期: ${key}`);
				// 缓存过期，返回过期标识
				return { data: cachedData.data, timestamp: cachedData.timestamp, expired: true };
			}
		}
		return { data: fallback, timestamp: 0 };
	} catch (e) {
		console.error('获取缓存数据失败:', e);
		return { data: fallback, timestamp: 0 };
	}
}

/**
 * 设置带时间戳的缓存数据
 * @param {string} key - 缓存键
 * @param {any} value - 要缓存的值
 */
function setTimedCached(key, value) {
	try {
		const cacheData = {
			data: value,
			timestamp: Date.now()
		};
		wx.setStorageSync(key, cacheData);
	} catch (e) {
		console.error('设置缓存数据失败:', e);
	}
}

/**
 * 获取社团列表缓存
 * @returns {object} 包含数据和时间戳的对象
 */
function getClubListCached() {
	const app = getAppInstance();
	if (!app || !app.globalData) {
		console.warn('App实例未初始化，返回空缓存');
		return { data: [], timestamp: 0 };
	}
	return getTimedCached(app.globalData.clubListKey, []);
}

/**
 * 获取公告列表缓存
 * @returns {object} 包含数据和时间戳的对象
 */
function getAnnouncementsCached() {
	const app = getAppInstance();
	if (!app || !app.globalData) {
		console.warn('App实例未初始化，返回空缓存');
		return { data: [], timestamp: 0 };
	}
	return getTimedCached(app.globalData.announcementsKey, []);
}

/**
 * 获取活动列表缓存
 * @returns {object} 包含数据和时间戳的对象
 */
function getEventsCached() {
	const app = getAppInstance();
	if (!app || !app.globalData) {
		console.warn('App实例未初始化，返回空缓存');
		return { data: [], timestamp: 0 };
	}
	return getTimedCached(app.globalData.eventsKey, []);
}

/**
 * 清除指定缓存
 * @param {string} key - 缓存键
 */
function clearCache(key) {
	try {
		wx.removeStorageSync(key);
		console.log(`缓存已清除: ${key}`);
	} catch (e) {
		console.error('清除缓存失败:', e);
	}
}

/**
 * 清除所有缓存
 */
function clearAllCache() {
	const app = getAppInstance();
	if (!app || !app.globalData) {
		console.warn('App实例未初始化，无法清除所有缓存');
		return;
	}
	
	try {
		wx.removeStorageSync(app.globalData.clubListKey);
		wx.removeStorageSync(app.globalData.announcementsKey);
		wx.removeStorageSync(app.globalData.eventsKey);
		console.log('所有缓存已清除');
	} catch (e) {
		console.error('清除所有缓存失败:', e);
	}
}

module.exports = {
	getAppInstance,
	getTimedCached,
	setTimedCached,
	getClubListCached,
	getAnnouncementsCached,
	getEventsCached,
	clearCache,
	clearAllCache,
	CACHE_EXPIRY_TIME
};
