/**
 * 用户认证相关API模块
 * @description 处理用户登录、注册、认证状态检查等功能
 */

const { request, setUserToken, setUserInfo, setAdminToken, setAdminInfo, getToken, getUserInfo, getAdminInfo } = require('./core');

/**
 * 管理员登录
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise} 登录结果
 */
function adminLogin(username, password) {
	return request({ 
		url: "/nfunest/api/admin/login", 
		method: "POST", 
		data: { username, password } 
	}).then((res) => {
		if (res && res.data && res.data.token) {
			setAdminToken(res.data.token);
			if (res.data.userInfo) {
				setAdminInfo(res.data.userInfo);
			}
		}
		return res;
	});
}

/**
 * 用户登录
 * @description 支持学号和微信号的版本
 * @param {string} wxCode - 微信登录code
 * @param {Object} userInfo - 用户信息
 * @param {string|null} studentId - 学号
 * @param {string|null} wechat - 微信号
 * @returns {Promise} 登录结果
 */
function userLogin(wxCode, userInfo = {}, studentId = null, wechat = null) {
	return request({
		url: "/nfunest/api/auth/login",
		method: "POST",
		data: { 
			code: wxCode, 
			userInfo: userInfo,
			studentId: studentId,
			wechat: wechat
		}
	}).then((res) => {
		if (res && res.data && res.data.token) {
			setUserToken(res.data.token);
			if (res.data.userInfo) {
				setUserInfo(res.data.userInfo);
			}
		}
		return res;
	});
}

/**
 * 检查登录状态
 * @returns {Object} 认证状态信息
 */
function checkAuthStatus() {
	const userToken = wx.getStorageSync('userToken') || "";
	const adminToken = wx.getStorageSync('adminToken') || "";
	const userInfo = getUserInfo();
	return {
		isLoggedIn: !!(userToken || adminToken),
		isUser: !!userToken,
		isAdmin: !!adminToken,
		token: userToken || adminToken,
		userInfo: userInfo
	};
}

/**
 * 获取当前用户信息
 * @returns {Promise} 用户信息
 */
function fetchUserProfile() {
	return request({
		url: "/nfunest/api/auth/profile",
		method: "GET"
	});
}

/**
 * 更新用户资料
 * @param {Object} data - 用户资料数据
 * @returns {Promise} 更新结果
 */
function updateUserProfile(data) {
	return request({
		url: "/nfunest/api/auth/profile",
		method: "PUT",
		data: data
	});
}

/**
 * 验证token有效性
 * @returns {Promise} 验证结果
 */
function verifyToken() {
	return request({
		url: "/nfunest/api/auth/verify",
		method: "GET"
	});
}

/**
 * 获取管理员统计数据
 * @returns {Promise} 统计数据
 */
function getAdminStats() {
	return request({
		url: "/nfunest/api/admin/stats",
		method: "GET"
	});
}

/**
 * 记录页面访问（用于活跃度统计）
 * @param {string} page - 页面标识
 * @returns {Promise} 记录结果
 */
function recordPageView(page = 'unknown') {
	return request({
		url: "/nfunest/api/auth/page-view",
		method: "POST",
		data: { page }
	});
}

/**
 * 绑定微信openid（管理员/老师）
 * @description 将微信openid绑定到管理员账号，用于接收订阅消息通知
 * @returns {Promise} 绑定结果
 */
function bindAdminWechat() {
	return new Promise((resolve, reject) => {
		wx.login({
			success: async (loginRes) => {
				try {
					const result = await request({
						url: "/nfunest/api/admin/bind-wechat",
						method: "POST",
						data: { code: loginRes.code }
					});
					resolve(result);
				} catch (error) {
					reject(error);
				}
			},
			fail: (err) => {
				reject({ success: false, error: '微信登录失败' });
			}
		});
	});
}

/**
 * 获取管理员信息（包含绑定状态）
 * @returns {Promise} 管理员信息
 */
function getAdminProfile() {
	return request({
		url: "/nfunest/api/admin/profile",
		method: "GET"
	});
}

/**
 * 解绑微信openid
 * @returns {Promise} 解绑结果
 */
function unbindAdminWechat() {
	return request({
		url: "/nfunest/api/admin/unbind-wechat",
		method: "DELETE"
	});
}

module.exports = {
	adminLogin,
	userLogin,
	checkAuthStatus,
	fetchUserProfile,
	updateUserProfile,
	verifyToken,
	getAdminStats,
	recordPageView,
	bindAdminWechat,
	getAdminProfile,
	unbindAdminWechat
};
