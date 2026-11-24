/**
 * 评论相关API模块
 * @description 处理评论列表、发表、删除等功能
 */

const { request, getAppInstance, setUserToken } = require('./core');

/**
 * 获取评论列表
 * @param {Object} params - 查询参数
 * @returns {Promise} 评论列表
 */
function fetchComments(params = {}) {
	return request({ 
		url: "/nfunest/api/comments",
		method: "GET",
		data: params
	});
}

/**
 * 发表评论
 * @param {Object} data - 评论数据
 * @returns {Promise} 发表结果
 */
function createComment(data) {
	const userToken = wx.getStorageSync('userToken') || "";
	
	if (!userToken) {
		return Promise.reject(new Error('请先登录'));
	}
	
	const app = getAppInstance();
	if (!app) {
		return Promise.reject(new Error('App实例未初始化'));
	}
	
	const headers = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${userToken}`
	};
	
	wx.showLoading({ title: '发表中...', mask: true });
	
	console.log(`API请求: POST /nfunest/api/comments`, data);
	
	return app.request({
		url: "/nfunest/api/comments",
		method: "POST",
		data: data,
		header: headers
	}).then((response) => {
		console.log(`API响应: /nfunest/api/comments`, response);
		
		if (response.header) {
			const newToken = response.header['X-New-Token'] || response.header['x-new-token'];
			const tokenRefreshed = response.header['X-Token-Refreshed'] || response.header['x-token-refreshed'];
			if (newToken && tokenRefreshed === 'true') {
				setUserToken(newToken);
			}
		}
		
		return response.data;
	}).catch((error) => {
		console.error(`API错误: /nfunest/api/comments`, error);
		wx.showToast({ 
			title: error.message || '网络请求失败', 
			icon: 'none' 
		});
		throw error;
	}).finally(() => {
		wx.hideLoading();
	});
}

/**
 * 删除评论
 * @param {string|number} commentId - 评论ID
 * @returns {Promise} 删除结果
 */
function deleteComment(commentId) {
	return request({ 
		url: `/nfunest/api/comments/${commentId}`,
		method: "DELETE"
	});
}

module.exports = {
	fetchComments,
	createComment,
	deleteComment
};
