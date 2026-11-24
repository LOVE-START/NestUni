/**
 * 通知相关API
 * @description 处理订阅消息通知相关的前端调用
 */

const { request } = require('./core');

/**
 * 获取模板ID列表
 * @description 返回所有可用的订阅消息模板ID
 * @returns {Promise<Object>} 模板列表
 */
function getNotificationTemplates() {
	return request({
		url: '/nfunest/api/notifications/templates',
		method: 'GET'
	});
}

/**
 * 发送面试通知
 * @description 社团会长发送面试通知给申请人
 * @param {Object} data - 通知数据
 * @param {number} data.applicationId - 报名ID
 * @param {string} [data.clubName] - 社团名称
 * @param {string} [data.interviewTime] - 面试时间
 * @param {string} [data.interviewLocation] - 面试地点
 * @param {string} [data.notes] - 通知事项
 * @param {string} [data.contact] - 联系电话
 * @param {string} [data.page] - 跳转页面
 * @returns {Promise<Object>} 发送结果
 */
function sendInterviewNotification(data) {
	return request({
		url: '/nfunest/api/notifications/interview',
		method: 'POST',
		data
	});
}

/**
 * 发送活动开始提醒
 * @description 向活动参与者发送活动开始提醒
 * @param {Object} data - 通知数据
 * @param {number} data.eventId - 活动ID
 * @param {string} [data.eventName] - 活动名称
 * @param {string} [data.startTime] - 开始时间
 * @param {string} [data.location] - 活动地点
 * @param {string} [data.page] - 跳转页面
 * @returns {Promise<Object>} 发送结果
 */
function sendEventReminder(data) {
	return request({
		url: '/nfunest/api/notifications/event-reminder',
		method: 'POST',
		data
	});
}

/**
 * 发送新活动通知
 * @description 向社团成员发送新活动通知
 * @param {Object} data - 通知数据
 * @param {number} data.clubId - 社团ID
 * @param {number} data.eventId - 活动ID
 * @param {string} [data.eventName] - 活动名称
 * @param {string} [data.startTime] - 开始时间
 * @param {string} [data.location] - 活动地点
 * @param {string} [data.description] - 活动介绍
 * @param {string} [data.page] - 跳转页面
 * @returns {Promise<Object>} 发送结果
 */
function sendNewEventNotification(data) {
	return request({
		url: '/nfunest/api/notifications/new-event',
		method: 'POST',
		data
	});
}

/**
 * 请求订阅消息授权
 * @description 调用微信API请求用户授权订阅消息
 * @param {Array<string>} templateIds - 模板ID数组（最多3个，超出自动截取）
 * @returns {Promise<Object>} 授权结果
 * 
 * 重要限制：
 * 1. 每次最多只能订阅3个模板
 * 2. 必须由用户点击事件直接触发（不能在异步代码中调用）
 * 3. 超过3个模板会自动截取前3个
 */
function requestSubscribeMessage(templateIds) {
	return new Promise((resolve, reject) => {
		if (!wx.requestSubscribeMessage) {
			console.warn('当前微信版本不支持订阅消息');
			resolve({ success: false, error: '当前微信版本不支持订阅消息' });
			return;
		}

		// 微信限制每次最多订阅3个模板
		const MAX_TEMPLATES_PER_CALL = 3;
		const templatesToUse = templateIds.slice(0, MAX_TEMPLATES_PER_CALL);
		
		// 如果超过3个模板，给出警告
		if (templateIds.length > MAX_TEMPLATES_PER_CALL) {
			console.warn(`订阅消息模板数量(${templateIds.length})超过限制(${MAX_TEMPLATES_PER_CALL})，仅使用前${MAX_TEMPLATES_PER_CALL}个`);
		}

		wx.requestSubscribeMessage({
			tmplIds: templatesToUse,
			success: (res) => {
				console.log('订阅消息授权结果:', res);
				resolve({
					success: true,
					results: res,
					subscribedCount: templatesToUse.length
				});
			},
			fail: (err) => {
				console.error('订阅消息授权失败:', err);
				reject({
					success: false,
					error: err.errMsg || '授权失败'
				});
			}
		});
	});
}

/**
 * 模板ID常量
 * @description 与后端保持一致的模板ID
 */
const TEMPLATE_IDS = {
	INTERVIEW_NOTICE: 'BE_IaJluW-i29Qz9PBxDgnMqZzaKXCc_2PJefQUscGY',
	EVENT_START_REMINDER: 'HxjOE56MfKSvESDQEpqkyM86SIJahP-8nEWQCdzg6QU',
	NEW_EVENT_NOTICE: 'lRR1mfKOjgoUSEEwUqiQGcnohGDVktI0YF1v1YOhqM8',
	AUDIT_RESULT_NOTICE: '4A3LQazO04CMTM_Koi2Tfof8acYYnmivJvFhtJBTs90',
	PENDING_AUDIT_NOTICE: 'zI3D-tfTKJbiL0rAxXpiKLWmHOUGTlKO4PUaanUYLP8',
	ANNOUNCEMENT_NOTICE: '4XIdqTmL8ODJhXQPxe9_f84KvlmW5DNYsQpwxll3qlI'
};

module.exports = {
	getNotificationTemplates,
	sendInterviewNotification,
	sendEventReminder,
	sendNewEventNotification,
	requestSubscribeMessage,
	TEMPLATE_IDS
};
