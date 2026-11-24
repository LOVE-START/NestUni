App({
	globalData: {
		apiBaseUrl: "https://api.example.com", 
		lastSyncDateKey: "lastSyncDate",
		clubListKey: "clubList",
		announcementsKey: "announcements",
		eventsKey: "eventList",
		assetsVersionKey: "assetsVersion"
	},
	onLaunch() {
		// 检查缓存版本，必要时清除旧缓存
		const { checkCacheVersion } = require("./utils/cacheConfig");
		checkCacheVersion();
		
		// 延迟执行数据同步，确保App实例完全初始化
		setTimeout(() => {
			this.ensureDailySync();
		}, 100);

		// 记录页面访问（活跃度统计）
		this.recordPageView('app_launch');
	},
	onShow() {
		// 每次小程序切到前台时记录活跃度
		this.recordPageView('app_show');
	},
	/**
	 * 记录页面访问
	 * @param {string} page - 页面标识
	 */
	recordPageView(page) {
		const token = wx.getStorageSync('userToken');
		console.log('[活跃度统计] recordPageView 被调用:', { page, hasToken: !!token });
		if (!token) {
			console.log('[活跃度统计] 未登录，跳过统计');
			return; // 未登录用户不统计
		}
		
		// 直接使用 this.request，避免 getApp() 未初始化的问题
		this.request({
			url: '/nfunest/api/auth/page-view',
			method: 'POST',
			data: { page },
			header: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			}
		}).then((res) => {
			console.log('[活跃度统计] 记录成功:', res);
		}).catch((err) => {
			console.error('[活跃度统计] 记录失败:', err);
		});
	},
	ensureDailySync() {
		const today = new Date();
		const ymd = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
		const lastSync = wx.getStorageSync(this.globalData.lastSyncDateKey);
		if (lastSync !== ymd) {
			console.log('开始执行每日数据同步...');
			this.syncAllData().then(() => {
				wx.setStorageSync(this.globalData.lastSyncDateKey, ymd);
				console.log('数据同步完成，已更新同步日期');
			}).catch((err) => {
				console.error('数据同步失败:', err);
				// swallow errors to avoid blocking app launch
			});
		} else {
			console.log('今日已同步，跳过数据更新');
		}
	},
	async syncAllData() {
		try {
			const api = require("./utils/api/index");
			// 使用新的syncAllData方法
			const result = await api.syncAllData();
			// 保存到本地存储（使用新的带时间戳的缓存）
			const { setTimedCached } = require("./utils/cache");
			setTimedCached(this.globalData.clubListKey, result.clubs || []);
			setTimedCached(this.globalData.announcementsKey, result.announcements || []);
			// 保存活动数据到本地存储
			setTimedCached(this.globalData.eventsKey, result.events || []);
			return result;
		} catch (e) {
			console.log('数据同步失败:', e);
			// 错误情况下返回空数据
			return {
				clubs: [],
				announcements: [],
				events: []
			};
		}
	},
	request({ url, method = "GET", data = {}, header = {} }) {
		const fullUrl = `${this.globalData.apiBaseUrl}${url}`;
		return new Promise((resolve, reject) => {
			wx.request({
				url: fullUrl,
				method,
				data,
				header,
				timeout: 10000,
				success: (res) => {
					if (res.statusCode >= 200 && res.statusCode < 300) {
						resolve({
							data: res.data,
							header: res.header,
							statusCode: res.statusCode
						});
					} else {
						reject({
							data: res.data,
							header: res.header,
							statusCode: res.statusCode,
							message: res.data?.error || '请求失败'
						});
					}
				},
				fail: (err) => {
					reject({
						statusCode: 0,
						message: err.errMsg || '网络请求失败'
					});
				}
			});
		});
	}
});