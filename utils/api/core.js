/**
 * API核心模块
 * @description 提供基础的请求封装和Token管理功能
 */

const USER_TOKEN_KEY = "userToken";
const ADMIN_TOKEN_KEY = "adminToken";
const USER_INFO_KEY = "userInfo";
const ADMIN_INFO_KEY = "admininfo";

/**
 * 延迟获取app实例，避免启动时getApp()返回undefined
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
 * 获取Token
 * @description 优先获取管理员token，如果没有则获取用户token
 * @returns {string} Token字符串
 */
function getToken() {
	const adminToken = wx.getStorageSync(ADMIN_TOKEN_KEY) || "";
	if (adminToken) {
		return adminToken;
	}
	return wx.getStorageSync(USER_TOKEN_KEY) || "";
}

/**
 * 设置用户Token
 * @param {string} token - Token值
 */
function setUserToken(token) {
	wx.setStorageSync(USER_TOKEN_KEY, token || "");
}

/**
 * 设置管理员Token
 * @param {string} token - Token值
 */
function setAdminToken(token) {
	wx.setStorageSync(ADMIN_TOKEN_KEY, token || "");
}

/**
 * 清除所有Token
 */
function clearToken() {
	wx.removeStorageSync(USER_TOKEN_KEY);
	wx.removeStorageSync(ADMIN_TOKEN_KEY);
}

/**
 * 清除管理员Token
 */
function clearAdminToken() {
	wx.removeStorageSync(ADMIN_TOKEN_KEY);
}

/**
 * 清除管理员Token和信息
 */
function clearAdminSession() {
	wx.removeStorageSync(ADMIN_TOKEN_KEY);
	wx.removeStorageSync(ADMIN_INFO_KEY);
}

/**
 * 获取用户信息
 * @returns {Object|null} 用户信息对象
 */
function getUserInfo() {
	return wx.getStorageSync(USER_INFO_KEY) || null;
}

/**
 * 设置用户信息
 * @param {Object} userInfo - 用户信息对象
 */
function setUserInfo(userInfo) {
	wx.setStorageSync(USER_INFO_KEY, userInfo || null);
}

/**
 * 清除用户信息
 */
function clearUserInfo() {
	wx.removeStorageSync(USER_INFO_KEY);
}

/**
 * 获取管理员信息
 * @returns {Object|null} 管理员信息对象
 */
function getAdminInfo() {
	return wx.getStorageSync(ADMIN_INFO_KEY) || null;
}

/**
 * 设置管理员信息
 * @param {Object} adminInfo - 管理员信息对象
 */
function setAdminInfo(adminInfo) {
	wx.setStorageSync(ADMIN_INFO_KEY, adminInfo || null);
}

/**
 * 清除管理员信息
 */
function clearAdminInfo() {
	wx.removeStorageSync(ADMIN_INFO_KEY);
}

/**
 * 处理Token刷新
 * @param {Object} header - 响应头对象
 */
function handleTokenRefresh(header) {
	if (!header) return;
	
	const newToken = header['X-New-Token'] || header['x-new-token'];
	const tokenRefreshed = header['X-Token-Refreshed'] || header['x-token-refreshed'];
	
	if (newToken && tokenRefreshed === 'true') {
		console.log('Token已自动刷新，更新本地存储');
		const currentUserToken = wx.getStorageSync(USER_TOKEN_KEY) || "";
		if (currentUserToken) {
			setUserToken(newToken);
		} else {
			setAdminToken(newToken);
		}
	}
}

/**
 * 核心请求函数（内部实现）
 * @description 抽取公共请求逻辑，避免代码重复
 * @param {Object} options - 请求选项
 * @param {string} options.url - 请求URL
 * @param {string} [options.method='GET'] - 请求方法
 * @param {Object} [options.data={}] - 请求数据
 * @param {Object} [options.header={}] - 请求头
 * @param {boolean} [options.showLoading=true] - 是否显示加载提示
 * @param {boolean} [options.showError=true] - 是否显示错误提示
 * @param {string} [token] - 可选的Token，不传则使用默认Token
 * @returns {Promise} 请求Promise
 */
function executeRequest(options, token) {
	const app = getAppInstance();
	if (!app) {
		return Promise.reject(new Error('App实例未初始化'));
	}
	
	const headers = Object.assign({
		'Content-Type': 'application/json'
	}, options.header || {});
	
	// 使用传入的token或默认获取token
	const requestToken = token !== undefined ? token : getToken();
	if (requestToken) {
		headers["Authorization"] = `Bearer ${requestToken}`;
	}
	
	if (options.showLoading !== false) {
		wx.showLoading({ title: '加载中...', mask: true });
	}
	
	console.log(`API请求: ${options.method || 'GET'} ${options.url}`, options.data);
	
	return app.request({
		url: options.url,
		method: options.method || "GET",
		data: options.data || {},
		header: headers
	}).then((response) => {
		console.log(`API响应: ${options.url}`, response);
		
		handleTokenRefresh(response.header);
		
		const statusCode = response.statusCode;
		if (statusCode >= 200 && statusCode < 300) {
			return response.data;
		}
		
		const error = new Error(response.data?.message || `请求失败(${statusCode})`);
		error.statusCode = statusCode;
		error.data = response.data;
		throw error;
	}).catch((error) => {
		console.error(`API错误: ${options.url}`, error);
		if (options.showError !== false) {
			const errorMsg = error.data?.message || error.message || '网络请求失败';
			wx.showToast({ 
				title: errorMsg, 
				icon: 'none',
				duration: 2500
			});
		}
		throw error;
	}).finally(() => {
		if (options.showLoading !== false) {
			wx.hideLoading();
		}
	});
}

/**
 * 网络请求封装
 * @description 自动获取Token（优先管理员Token）
 * @param {Object} options - 请求选项
 * @param {string} options.url - 请求URL
 * @param {string} [options.method='GET'] - 请求方法
 * @param {Object} [options.data={}] - 请求数据
 * @param {Object} [options.header={}] - 请求头
 * @param {boolean} [options.showLoading=true] - 是否显示加载提示
 * @param {boolean} [options.showError=true] - 是否显示错误提示
 * @returns {Promise} 请求Promise
 */
function request(options) {
	return executeRequest(options);
}

/**
 * 使用用户Token的请求封装
 * @description 用于社团会长操作，强制使用用户Token
 * @param {Object} options - 请求选项
 * @returns {Promise} 请求Promise
 */
function requestWithUserToken(options) {
	const userToken = wx.getStorageSync(USER_TOKEN_KEY) || "";
	return executeRequest(options, userToken);
}

module.exports = {
	getAppInstance,
	getToken,
	setUserToken,
	setAdminToken,
	clearToken,
	clearAdminToken,
	clearAdminSession,
	getUserInfo,
	setUserInfo,
	clearUserInfo,
	getAdminInfo,
	setAdminInfo,
	clearAdminInfo,
	handleTokenRefresh,
	request,
	requestWithUserToken,
	
	USER_TOKEN_KEY,
	ADMIN_TOKEN_KEY,
	USER_INFO_KEY,
	ADMIN_INFO_KEY
};
