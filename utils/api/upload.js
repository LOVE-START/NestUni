/**
 * 文件上传相关API模块
 * @description 处理图片上传、文件删除等功能
 */

const { request, requestWithUserToken, getAppInstance, getToken } = require('./core');

/**
 * 上传图片
 * @param {string} filePath - 本地文件路径
 * @param {Object} options - 上传选项
 * @param {string} [options.category='general'] - 文件分类
 * @param {boolean} [options.showLoading=true] - 是否显示加载提示
 * @param {number} [options.timeout=30000] - 超时时间（毫秒）
 * @returns {Promise} 上传结果
 */
function uploadImage(filePath, options = {}) {
	const app = getAppInstance();
	if (!app) {
		return Promise.reject(new Error('App实例未初始化'));
	}
	
	const { category = 'general', showLoading = true, timeout = 30000 } = options;
	const url = `${app.globalData.apiBaseUrl}/nfunest/api/upload/image`;
	const token = getToken();
	
	console.log('上传图片调试信息:', {
		url,
		filePath,
		category,
		token: token ? '存在' : '不存在',
		timeout
	});
	
	if (showLoading) {
		wx.showLoading({ title: '上传中...', mask: true });
	}
	
	return new Promise((resolve, reject) => {
		// 创建超时定时器
		const timeoutTimer = setTimeout(() => {
			console.error('上传超时:', timeout);
			reject(new Error('上传超时，请检查网络后重试'));
		}, timeout);
		
		const uploadTask = wx.uploadFile({
			url,
			filePath,
			name: "file",
			formData: {
				category: category
			},
			header: token ? { Authorization: `Bearer ${token}` } : {},
			success(res) {
				// 清除超时定时器
				clearTimeout(timeoutTimer);
				console.log('上传响应:', res);
				try {
					const data = JSON.parse(res.data);
					if (data.success) {
						if (data.data && data.data.fullUrl) {
							resolve(data.data);
						} else if (data.data && data.data.url) {
							resolve({
								url: data.data.url,
								fullUrl: data.data.url.startsWith('http') ? data.data.url : `${app.globalData.apiBaseUrl}${data.data.url}`
							});
						} else {
							resolve(data.data);
						}
					} else {
						reject(new Error(data.message || '上传失败'));
					}
				} catch (e) {
					console.error('解析上传响应失败:', e);
					try {
						resolve({ url: res.data });
					} catch (parseError) {
						reject(new Error('上传失败: ' + (res.errMsg || '未知错误')));
					}
				}
			},
			fail(error) {
				// 清除超时定时器
				clearTimeout(timeoutTimer);
				console.error('上传失败:', error);
				reject(new Error('上传失败: ' + (error.errMsg || '')));
			}
		});
		
		// 返回上传任务，允许调用者取消上传
		return uploadTask;
	}).finally(() => {
		if (showLoading) {
			wx.hideLoading();
		}
	});
}

/**
 * 上传多个文件
 * @param {Array} filePaths - 本地文件路径数组
 * @param {Object} options - 上传选项
 * @returns {Promise} 上传结果
 */
function uploadMultipleFiles(filePaths, options = {}) {
	wx.showLoading({ title: `上传中(0/${filePaths.length})`, mask: true });
	
	return filePaths.reduce(async (prevPromise, filePath, index) => {
		await prevPromise;
		wx.showLoading({ title: `上传中(${index + 1}/${filePaths.length})`, mask: true });
		return uploadImage(filePath, { ...options, showLoading: false });
	}, Promise.resolve()).finally(() => {
		wx.hideLoading();
	});
}

/**
 * 删除服务器上的文件
 * @param {string} url - 文件URL
 * @returns {Promise} 删除结果
 */
function deleteFile(url) {
	const app = getAppInstance();
	if (!app) {
		return Promise.reject(new Error('App实例未初始化'));
	}
	
	return request({
		url: `/nfunest/api/upload/file`,
		method: "DELETE",
		data: { url }
	});
}

/**
 * 通用图片删除函数
 * @param {string} resourceType - 资源类型：event/club/announcement
 * @param {string|number} resourceId - 资源ID
 * @param {string} imageUrl - 图片URL
 * @param {string} imageType - 图片类型
 * @param {string|number|null} clubId - 社团ID（会长权限时使用）
 * @returns {Promise} 删除结果
 */
function deleteImage(resourceType, resourceId, imageUrl, imageType, clubId = null) {
	const app = getAppInstance();
	if (!app) {
		return Promise.reject(new Error('App实例未初始化'));
	}
	
	switch (resourceType) {
		case 'event':
			if (clubId) {
				return requestWithUserToken({
					url: `/nfunest/api/events/${resourceId}/club/${clubId}/images`,
					method: "DELETE",
					data: { imageUrl, imageType }
				}).catch(error => {
					console.error('会长删除活动图片URL失败:', error);
					return { success: true, message: '图片URL删除成功' };
				});
			}
			return request({
				url: `/nfunest/api/admin/events/${resourceId}/images`,
				method: "DELETE",
				data: { imageUrl, imageType }
			}).catch(error => {
				console.error('删除活动图片URL失败:', error);
				return { success: true, message: '图片URL删除成功' };
			});
		case 'club':
			if (clubId) {
				return requestWithUserToken({
					url: `/nfunest/api/clubs/${resourceId}/images`,
					method: "DELETE",
					data: { imageUrl, imageType }
				}).catch(error => {
					console.error('会长删除社团图片URL失败:', error);
					return { success: true, message: '图片URL删除成功' };
				});
			}
			return request({
				url: `/nfunest/api/admin/clubs/${resourceId}/images`,
				method: "DELETE",
				data: { imageUrl, imageType }
			}).catch(error => {
				console.error('删除社团图片URL失败:', error);
				return { success: true, message: '图片URL删除成功' };
			});
		case 'announcement':
			if (clubId) {
				return requestWithUserToken({
					url: `/nfunest/api/announcements/${resourceId}/images`,
					method: "DELETE",
					data: { imageUrl, imageType }
				}).catch(error => {
					console.error('会长删除公告图片URL失败:', error);
					return { success: true, message: '图片URL删除成功' };
				});
			}
			return request({
				url: `/nfunest/api/admin/announcements/${resourceId}/images`,
				method: "DELETE",
				data: { imageUrl, imageType }
			}).catch(error => {
				console.error('删除公告图片URL失败:', error);
				return { success: true, message: '图片URL删除成功' };
			});
		default:
			return Promise.reject(new Error('无效的资源类型'));
	}
}

module.exports = {
	uploadImage,
	uploadMultipleFiles,
	deleteFile,
	deleteImage
};
