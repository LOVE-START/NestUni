/**
 * 缓存配置文件
 * @description 管理缓存版本和公告版本检测
 */

const CACHE_VERSION_KEY = 'cacheVersion';
const CACHE_VERSION = 1;

// 公告版本相关常量
const ANNOUNCEMENT_VERSION_KEY = 'announcementVersion';
// 公告内容缓存键（缓存公告标题、内容、图片）
const ANNOUNCEMENT_DATA_KEY = 'announcementData';
// 版本检测时间缓存键
const VERSION_CHECK_TIME_KEY = 'versionCheckTime';
// 版本检测间隔（1天，单位毫秒）
const VERSION_CHECK_INTERVAL = 1 * 24 * 60 * 60 * 1000;

// 用户相关缓存键（cacheVersion不匹配时清除）
const USER_CACHE_KEYS = ['userToken', 'userInfo'];

const PRESERVED_KEYS = [];

/**
 * 检查缓存版本
 * @description 当缓存版本不匹配时清除用户相关缓存（userToken和userInfo）
 * @returns {boolean} 是否清除了缓存
 */
function checkCacheVersion() {
	try {
		const storedVersion = wx.getStorageSync(CACHE_VERSION_KEY);
		
		if (storedVersion !== CACHE_VERSION) {
			console.log(`缓存版本不匹配，当前: ${storedVersion}, 最新: ${CACHE_VERSION}，清除用户缓存`);
			clearUserCache();
			wx.setStorageSync(CACHE_VERSION_KEY, CACHE_VERSION);
			console.log('缓存已更新到最新版本');
			return true;
		}
		
		console.log('缓存版本检查通过');
		return false;
	} catch (error) {
		console.error('检查缓存版本失败:', error);
		return false;
	}
}

/**
 * 清除用户相关缓存
 * @description 仅清除userToken和userInfo，保留其他数据
 */
function clearUserCache() {
	try {
		USER_CACHE_KEYS.forEach(key => {
			wx.removeStorageSync(key);
			console.log(`已清除缓存: ${key}`);
		});
		console.log(`已清除 ${USER_CACHE_KEYS.length} 个用户缓存项`);
	} catch (error) {
		console.error('清除用户缓存失败:', error);
	}
}

/**
 * 检查公告版本
 * @description 对比服务器版本和本地缓存版本
 * @param {number} serverVersion - 服务器公告版本
 * @returns {Object} { needShow: boolean, needUpdate: boolean }
 */
function checkAnnouncementVersion(serverVersion) {
	if (!serverVersion || serverVersion === 0) {
		return { needShow: false, needUpdate: false };
	}
	
	try {
		let storedVersion = wx.getStorageSync(ANNOUNCEMENT_VERSION_KEY);
		
		// 统一转换为数字类型进行比较
		storedVersion = parseInt(storedVersion) || 0;
		
		// 没有缓存版本或版本不匹配，需要显示公告
		if (storedVersion === 0 || storedVersion !== serverVersion) {
			console.log(`公告版本不匹配，存储: ${storedVersion}, 服务器: ${serverVersion}，需要显示公告`);
			return { needShow: true, needUpdate: true };
		}
		
		console.log('公告版本匹配，无需显示公告');
		return { needShow: false, needUpdate: false };
	} catch (e) {
		console.error('检查公告版本失败:', e);
		return { needShow: false, needUpdate: false };
	}
}

/**
 * 更新公告版本缓存
 * @description 用户确认公告后，更新本地公告版本
 * @param {number} version - 公告版本号
 */
function updateAnnouncementVersion(version) {
	try {
		wx.setStorageSync(ANNOUNCEMENT_VERSION_KEY, version);
		console.log('公告版本已更新:', version);
	} catch (e) {
		console.error('更新公告版本失败:', e);
	}
}

/**
 * 获取存储的公告版本
 * @returns {number|null} 存储的公告版本号
 */
function getStoredAnnouncementVersion() {
	try {
		return wx.getStorageSync(ANNOUNCEMENT_VERSION_KEY) || null;
	} catch (e) {
		console.error('获取公告版本失败:', e);
		return null;
	}
}

/**
 * 缓存公告数据
 * @description 缓存公告的标题、内容、图片等信息
 * @param {Object} data - 公告数据 { version, title, content, image }
 */
function cacheAnnouncementData(data) {
	try {
		wx.setStorageSync(ANNOUNCEMENT_DATA_KEY, JSON.stringify(data));
		console.log('公告数据已缓存:', data.version);
	} catch (e) {
		console.error('缓存公告数据失败:', e);
	}
}

/**
 * 获取缓存的公告数据
 * @returns {Object|null} 公告数据 { version, title, content, image }
 */
function getCachedAnnouncementData() {
	try {
		const data = wx.getStorageSync(ANNOUNCEMENT_DATA_KEY);
		if (data) {
			return JSON.parse(data);
		}
		return null;
	} catch (e) {
		console.error('获取缓存公告数据失败:', e);
		return null;
	}
}

/**
 * 检查是否需要从服务器获取版本信息
 * @description 超过1天未检测则返回true
 * @returns {boolean} 是否需要请求版本
 */
function shouldCheckVersion() {
	try {
		const lastCheckTime = wx.getStorageSync(VERSION_CHECK_TIME_KEY);
		
		if (!lastCheckTime) {
			console.log('首次检测版本');
			return true;
		}
		
		const now = Date.now();
		const timeDiff = now - lastCheckTime;
		
		if (timeDiff >= VERSION_CHECK_INTERVAL) {
			const hours = Math.floor(timeDiff / (60 * 60 * 1000));
			console.log(`距上次检测已过${hours}小时，需要重新检测版本`);
			return true;
		}
		
		const remainingHours = Math.ceil((VERSION_CHECK_INTERVAL - timeDiff) / (60 * 60 * 1000));
		console.log(`距下次版本检测还有${remainingHours}小时`);
		return false;
	} catch (e) {
		console.error('检查版本检测时间失败:', e);
		return true;
	}
}

/**
 * 更新版本检测时间
 * @description 记录本次检测时间
 */
function updateVersionCheckTime() {
	try {
		wx.setStorageSync(VERSION_CHECK_TIME_KEY, Date.now());
		console.log('版本检测时间已更新');
	} catch (e) {
		console.error('更新版本检测时间失败:', e);
	}
}

/**
 * 获取上次版本检测时间
 * @returns {number|null} 上次检测时间戳
 */
function getLastVersionCheckTime() {
	try {
		return wx.getStorageSync(VERSION_CHECK_TIME_KEY) || null;
	} catch (e) {
		console.error('获取版本检测时间失败:', e);
		return null;
	}
}

/**
 * 检查是否需要显示公告（核心逻辑）
 * @description 综合判断：本地公告版本 vs 缓存的公告数据
 * @returns {Object} { needShow: boolean, needFetch: boolean, cachedData: Object|null }
 *   - needShow: 是否需要显示公告
 *   - needFetch: 是否需要从服务器获取公告数据
 *   - cachedData: 缓存的公告数据（如果有）
 */
function checkAnnouncementStatus() {
	try {
		const storedVersion = parseInt(wx.getStorageSync(ANNOUNCEMENT_VERSION_KEY)) || 0;
		const cachedData = getCachedAnnouncementData();
		const cachedVersion = cachedData ? cachedData.version : 0;
		
		// 情况1：本地没有确认过任何公告版本
		if (storedVersion === 0) {
			// 如果有缓存的公告数据，直接显示
			if (cachedData && cachedVersion > 0) {
				console.log('用户未确认公告，显示缓存的公告:', cachedVersion);
				return { needShow: true, needFetch: false, cachedData };
			}
			// 没有缓存数据，需要从服务器获取
			console.log('用户未确认公告，需要获取公告数据');
			return { needShow: false, needFetch: true, cachedData: null };
		}
		
		// 情况2：本地有确认版本，但缓存中有更新的公告
		if (cachedVersion > storedVersion) {
			console.log(`有新公告版本: ${cachedVersion}，用户已确认: ${storedVersion}`);
			return { needShow: true, needFetch: false, cachedData };
		}
		
		// 情况3：版本一致，用户已确认
		console.log('公告已确认，无需显示');
		return { needShow: false, needFetch: false, cachedData: null };
	} catch (e) {
		console.error('检查公告状态失败:', e);
		return { needShow: false, needFetch: true, cachedData: null };
	}
}

/**
 * 清除所有缓存
 * @description 清除所有本地缓存数据
 */
function clearAllCache() {
	try {
		const res = wx.getStorageInfoSync();
		const keys = res.keys || [];
		
		keys.forEach(key => {
			wx.removeStorageSync(key);
		});
		
		console.log(`已清除所有 ${keys.length} 个缓存项`);
	} catch (error) {
		console.error('清除缓存失败:', error);
	}
}

/**
 * 强制清除所有缓存（包括用户登录信息）
 * @description 清除所有缓存，不保留任何数据
 */
function forceClearAllCache() {
	try {
		const res = wx.getStorageInfoSync();
		const keys = res.keys || [];
		
		keys.forEach(key => {
			wx.removeStorageSync(key);
		});
		
		console.log(`已强制清除所有 ${keys.length} 个缓存项`);
	} catch (error) {
		console.error('强制清除缓存失败:', error);
	}
}

/**
 * 获取当前缓存版本
 * @returns {number} 当前缓存版本号
 */
function getCacheVersion() {
	return CACHE_VERSION;
}

/**
 * 获取存储的缓存版本
 * @returns {number|null} 存储的缓存版本号
 */
function getStoredCacheVersion() {
	return wx.getStorageSync(CACHE_VERSION_KEY) || null;
}

module.exports = {
	CACHE_VERSION,
	CACHE_VERSION_KEY,
	ANNOUNCEMENT_VERSION_KEY,
	ANNOUNCEMENT_DATA_KEY,
	VERSION_CHECK_TIME_KEY,
	VERSION_CHECK_INTERVAL,
	USER_CACHE_KEYS,
	PRESERVED_KEYS,
	checkCacheVersion,
	clearUserCache,
	clearAllCache,
	forceClearAllCache,
	getCacheVersion,
	getStoredCacheVersion,
	checkAnnouncementVersion,
	updateAnnouncementVersion,
	getStoredAnnouncementVersion,
	cacheAnnouncementData,
	getCachedAnnouncementData,
	shouldCheckVersion,
	updateVersionCheckTime,
	getLastVersionCheckTime,
	checkAnnouncementStatus
};
