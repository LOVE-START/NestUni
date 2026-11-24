/**
 * 网络连接相关工具函数
 * @description 用于检查网络状态和API连接
 */

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
 * 获取API基础URL
 * @returns {string} API基础URL
 */
function getApiBaseUrl() {
	const app = getAppInstance();
	if (app && app.globalData && app.globalData.apiBaseUrl) {
		return app.globalData.apiBaseUrl;
	}
	// 默认API地址
	return 'https://api.example.com';
}

/**
 * 检查网络连接状态
 * @returns {Promise<Object>} 网络状态信息
 */
function checkNetworkStatus() {
	return new Promise((resolve) => {
		wx.getNetworkType({
			success(res) {
				const isConnected = res.networkType !== 'none';
				resolve({
					isConnected,
					networkType: res.networkType,
					isWifi: res.networkType === 'wifi'
				});
			},
			fail() {
				resolve({
					isConnected: false,
					networkType: 'unknown',
					isWifi: false
				});
			}
		});
	});
}

/**
 * 测试API服务器连接
 * @returns {Promise<Object>} 连接测试结果
 */
function testApiConnection() {
	return new Promise((resolve) => {
		const apiBaseUrl = getApiBaseUrl();
		wx.request({
			url: `${apiBaseUrl}/nfunest/api/health`,
			method: 'GET',
			timeout: 5000,
			success(res) {
				resolve({
					connected: res.statusCode === 200,
					responseTime: Date.now(),
					status: res.statusCode
				});
			},
			fail(error) {
				console.log('API连接测试失败:', error);
				resolve({
					connected: false,
					error: error.errMsg || '连接失败',
					responseTime: null
				});
			}
		});
	});
}

/**
 * 网络状态监听
 * @param {Function} callback - 状态变化回调函数
 */
function watchNetworkStatus(callback) {
	// 监听网络状态变化
	wx.onNetworkStatusChange((res) => {
		if (callback && typeof callback === 'function') {
			callback({
				isConnected: res.isConnected,
				networkType: res.networkType
			});
		}
	});
}

/**
 * 显示网络错误提示
 * @param {string} message - 错误消息
 */
function showNetworkError(message = '网络连接失败，请检查网络设置') {
	wx.showModal({
		title: '网络错误',
		content: message,
		showCancel: false,
		confirmText: '知道了'
	});
}

/**
 * 检查并提示网络状态
 * @returns {Promise<boolean>} 网络是否可用
 */
async function checkAndPromptNetwork() {
	const networkStatus = await checkNetworkStatus();
	
	if (!networkStatus.isConnected) {
		showNetworkError('当前无网络连接，部分功能可能无法使用');
		return false;
	}
	
	// 测试API连接
	const apiStatus = await testApiConnection();
	if (!apiStatus.connected) {
		console.log('API服务器连接失败，将使用本地数据');
		// 可以选择是否提示用户
		// showNetworkError('服务器连接失败，正在使用离线模式');
		return false;
	}
	
	return true;
}

/**
 * 检查是否在线
 * @returns {Promise<boolean>} 是否在线
 */
async function isOnline() {
	const networkStatus = await checkNetworkStatus();
	if (!networkStatus.isConnected) {
		return false;
	}
	
	const apiStatus = await testApiConnection();
	return apiStatus.connected;
}

module.exports = {
	getAppInstance,
	getApiBaseUrl,
	checkNetworkStatus,
	testApiConnection,
	watchNetworkStatus,
	showNetworkError,
	checkAndPromptNetwork,
	isOnline
};
