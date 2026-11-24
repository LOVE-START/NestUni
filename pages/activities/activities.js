const { fetchEvents, joinEvent, cancelJoinEvent, checkAuthStatus } = require("../../utils/api/index");
const { formatEventDate } = require("../../utils/date");
const { getCachedImage } = require("../../utils/imageCache");
const { preloadCriticalImages, optimizeImageUrl } = require("../../utils/imageLoader");
const { themeManager } = require("../../utils/theme");

Page({
	data: {
		allEvents: [],
		events: [],
		keyword: "",
		categories: [ 
			{ name: "全部", color: "#eef2f7", icon: "/images/all.png" },     // 更柔和的灰色
			{ name: "学术", color: "#fff3e0", icon: "/images/academic.png" },      // 柔和的橙色
			{ name: "文艺", color: "#ffebee", icon: "/images/art.png" },     // 更柔和的粉色
			{ name: "文化", color: "#f3e5f5", icon: "/images/culture.png" },     // 柔和的紫色
			{ name: "娱乐", color: "#e1f5fe", icon: "/images/amusement.png" },     // 柔和的青色
			{ name: "体育", color: "#e3f2fd", icon: "/images/pc.png" },     // 柔和的蓝色
			{ name: "公益", color: "#e8f5e9", icon: "/images/welfare.png" }      // 柔和的绿色
		],
		currentCategory: "全部",
		viewMode: "card", // card 或 list
		userInfo: null,
		loading: false,
		hasMore: true,
		page: 1,
		pageSize: 10,
		theme: {} // 添加主题数据
	},
	onLoad() {
		this.loadUserInfo();
		this.loadEvents();
		// 初始化主题
		const theme = themeManager.getCurrentTheme();
		this.setData({ theme });
	},
	onPullDownRefresh() {
		this.setData({ page: 1, hasMore: true });
		// 下拉刷新时强制从网络获取最新数据并更新缓存
		this.loadEvents(true, false).finally(() => wx.stopPullDownRefresh());
	},
	// 上拉加载更多
	onReachBottom() {
		if (!this.data.hasMore || this.data.loading) return;
		this.loadMoreEvents();
	},
	// 主题变更处理函数
	onThemeChange(e) {
		const theme = e.detail.theme;
		this.setData({ theme });
	},
	// 加载用户信息
	async loadUserInfo() {
		try {
			// 使用新的认证状态检查
			const authStatus = checkAuthStatus();
			if (authStatus.isLoggedIn) {
				this.setData({ userInfo: authStatus.userInfo });
			} else {
				// 未登录时读取本地缓存的用户信息
				const userInfo = wx.getStorageSync('userInfo');
				this.setData({ userInfo });
			}
		} catch (e) {
			console.log('获取用户信息失败:', e);
		}
	},
	// 加载活动列表
	async loadEvents(refresh = false, useCache = true) {
		if (this.data.loading) return;
		this.setData({ loading: true });
		
		try {
			const response = await fetchEvents({
				page: refresh ? 1 : this.data.page,
				pageSize: this.data.pageSize,
				category: this.data.currentCategory !== '全部' ? this.data.currentCategory : '',
				keyword: this.data.keyword
			}, useCache && this.data.page === 1); // 根据参数决定是否使用缓存
			
			// 适配API响应格式，提取data字段
			const list = response.data || [];
			const pagination = response.pagination || {};
			
			// 格式化日期
			const formattedList = list.map(item => {
				// 计算活动状态
				let statusText = '';
				let statusClass = '';
				
				if (item.date) {
					const eventDate = new Date(item.date);
					const currentDate = new Date();
					// 将当前时间和活动日期都设置为当天的开始时间进行比较
					const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
					const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
					
					if (eventDay > today) {
						statusText = '准备中';
						statusClass = 'preparing';
					} else {
						statusText = '进行中';
						statusClass = 'ongoing';
					}
				}
				
				return {
					...item,
					formattedDate: formatEventDate(item.date),
					coverImage: item.cover_image || '',
					statusText: statusText,
					statusClass: statusClass
				};
			});
			
			// [MODIFY] 只预加载首屏可见的关键图片（前5张）
			// 其他图片由微信小程序的 lazy-load 自动处理
			const imageUrls = [];
			formattedList.slice(0, 5).forEach(item => {
				if (item.coverImage) {
					imageUrls.push(item.coverImage);
				}
			});
			preloadCriticalImages(imageUrls, 5);
			
			// 为每个活动优化图片URL（使用缓存）
			const cachedList = formattedList.map(item => {
				return {
					...item,
					cachedCoverImage: optimizeImageUrl(item.coverImage)
				};
			});
			
			const filteredList = this.filter(cachedList, this.data.keyword, this.data.currentCategory);
			
			if (refresh || this.data.page === 1) {
				this.setData({ 
					allEvents: cachedList, 
					events: filteredList,
					page: 1
				});
			} else {
				// 追加数据
				this.setData({ 
					allEvents: [...this.data.allEvents, ...cachedList],
					events: [...this.data.events, ...filteredList]
				});
			}
			
			// 检查是否还有更多数据
			this.setData({ hasMore: cachedList.length >= this.data.pageSize });
			
		} catch (e) {
			console.error('加载活动失败:', e);
			if (this.data.page === 1) {
				this.setData({ allEvents: [], events: [] });
			}
			wx.showToast({ title: '加载失败', icon: 'none' });
		} finally {
			this.setData({ loading: false });
		}
	},
	// 加载更多活动
	async loadMoreEvents() {
		this.setData({ page: this.data.page + 1 });
		await this.loadEvents(false, true);
	},
	onSearchInput(e) {
		const kw = e.detail.value || "";
		this.setData({ keyword: kw, events: this.filter(this.data.allEvents, kw, this.data.currentCategory) });
	},
	onTapCategory(e) {
		const name = e.currentTarget.dataset.name;
		this.setData({ currentCategory: name, events: this.filter(this.data.allEvents, this.data.keyword, name) });
	},
	filter(list, keyword, category) {
		let result = list || [];
		if (keyword) {
			const lower = keyword.toLowerCase();
			result = result.filter(ev => (ev.title || "").toLowerCase().includes(lower));
		}
		if (category && category !== "全部") {
			result = result.filter(ev => (ev.category || "") === category);
		}
		return result;
	},
	// 查看活动详情
	goToEvent(e) {
		const id = e.currentTarget.dataset.id;
		wx.navigateTo({ 
			url: `/pages/activitiesDetail/activitiesDetail?id=${id}` 
		});
	},
	// 报名参加活动
	async joinEvent(e) {
		e.stopPropagation(); // 阻止冒泡到goToEvent
		const id = e.currentTarget.dataset.id;
		const event = this.data.events.find(item => item.id == id);
		
		if (!event) return;
		
		// 检查活动状态
		if (event.status !== 'published') {
			wx.showToast({ title: '活动未发布，无法报名', icon: 'none' });
			return;
		}
		
		// 检查报名截止时间
		if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
			wx.showToast({ title: '报名已截止', icon: 'none' });
			return;
		}
		
		// 检查是否已报名
		if (event.isJoined) {
			wx.showToast({ title: '已经报名此活动', icon: 'none' });
			return;
		}
		
		// 检查人数限制
		if (event.maxParticipants && event.currentParticipants >= event.maxParticipants) {
			wx.showToast({ title: '活动人数已满', icon: 'none' });
			return;
		}
		
		try {
			await joinEvent(id);
			wx.showToast({ title: '报名成功', icon: 'success' });
			// 更新本地数据
			const updatedEvents = this.data.events.map(item => {
				if (item.id == id) {
					return { ...item, isJoined: true, currentParticipants: (item.currentParticipants || 0) + 1 };
				}
				return item;
			});
			this.setData({ events: updatedEvents });
		} catch (error) {
			console.error('报名失败:', error);
			wx.showToast({ title: '报名失败', icon: 'none' });
		}
	}
});