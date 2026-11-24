const { getClubListCached } = require('../../utils/cache.js')
const { cleanExpiredCache } = require('../../utils/imageCache.js')
const { preloadCriticalImages } = require('../../utils/imageLoader.js')
const { themeManager } = require('../../utils/theme.js')
const wallpaper = require('../../utils/wallpaper.js')
const { 
	checkAnnouncementStatus, 
	shouldCheckVersion, 
	updateVersionCheckTime,
	cacheAnnouncementData 
} = require('../../utils/cacheConfig.js')
const api = require('../../utils/api/index.js')

// 默认 Hero 壁纸按主题色标识绑定（与 utils/theme.js 中的 colorName 对应）
// 当前主题是什么颜色，未设置自定义壁纸时就展示对应颜色的壁纸
const DEFAULT_HERO_IMAGES = {
	pink: "https://wx4.sinaimg.cn/mw690/00633F4mly1ij1vzknj76j30u01t6n38.jpg",
	blue: "https://wx4.sinaimg.cn/mw690/008sH0XJgy1ij532u8x5qj31ca2wn7fq.jpg",
	green: "https://wx1.sinaimg.cn/mw690/720dfcc8gy1ij4in626tgj22yo1o07wj.jpg"
}

Page({
	data: {
		allClubs: [],
		clubs: [],
		keyword: "",
		categories: [
			{ name: "全部", color: "#eef2f7", icon: "/images/all.png" },
			{ name: "艺术", color: "#ffebee", icon: "/images/art.png" },
			{ name: "公益", color: "#e8f5e9", icon: "/images/welfare.png" },
			{ name: "体育", color: "#e3f2fd", icon: "/images/pc.png" },
			{ name: "文化", color: "#f3e5f5", icon: "/images/culture.png" },
			{ name: "学术", color: "#fff3e0", icon: "/images/academic.png" }
		],
		currentCategory: "全部",
		// 当前主题色对应的默认 Hero 壁纸（onShow 时根据主题的 colorName 同步）
		defaultHeroImage: '',
		// 用户自定义壁纸的本地持久化路径，空字符串表示使用默认壁纸
		heroWallpaper: "",
		theme: {
			gradient: ''
		},
		isLoading: false,
		showAnnouncement: false,
		announcementVersion: 0,
		announcementTitle: '',
		announcementContent: '',
		announcementImage: ''
	},
	
	onLoad() {
		// 清理过期缓存
		cleanExpiredCache();

		// 读取用户自定义壁纸（纯本地缓存，无需等待网络）
		// 未设置自定义壁纸时，由 onShow 根据当前主题色展示对应颜色的壁纸
		this.setData({
			heroWallpaper: wallpaper.getCustomWallpaper()
		});
		
		this.loadFromCache();
		this.loadLatestData();
		this.checkAnnouncement();
		wx.setNavigationBarColor({ frontColor: '#ffffff', backgroundColor: '#000000' });
	},
	
	onPullDownRefresh() {
		const app = getApp();
		app.syncAllData().finally(() => {
			this.loadFromCache();
			wx.stopPullDownRefresh();
		});
	},
	
	loadFromCache() {
		const { data } = getClubListCached();
		const adaptedData = this.adaptClubData(data);
		
		// [MODIFY] 只预加载首屏可见的关键图片（前5张）
		// 其他图片由微信小程序的 lazy-load 自动处理
		const imageUrls = [];
		adaptedData.slice(0, 5).forEach(club => {
			if (club.cover_image) {
				imageUrls.push(club.cover_image);
			}
		});
		preloadCriticalImages(imageUrls, 5);
		
		const randomizedData = this.shuffleArray(adaptedData);
		
		this.setData({ 
			allClubs: randomizedData, 
			clubs: this.filterClubs(randomizedData, this.data.keyword, this.data.currentCategory) 
		});
	},
	
	shuffleArray(array) {
		const newArray = [...array];
		for (let i = newArray.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[newArray[i], newArray[j]] = [newArray[j], newArray[i]];
		}
		return newArray;
	},

	/**
	 * 应用主题并同步对应配色的默认壁纸
	 * @description 壁纸与主题色绑定：当前主题是什么颜色就展示对应颜色的壁纸
	 * @param {Object} theme - themeManager 返回的主题对象（含 colorName）
	 */
	applyTheme(theme) {
		this.setData({
			theme,
			// colorName 无法匹配时（如旧数据异常）回退到第一种壁纸，保证 Hero 不为空
			defaultHeroImage: DEFAULT_HERO_IMAGES[theme.colorName] || DEFAULT_HERO_IMAGES.pink
		});
	},
	
	onShow() {
		this.applyTheme(themeManager.getCurrentTheme());
	},
	
	onThemeChange: function(e) {
		this.applyTheme(e.detail.theme);
	},
	
	loadLatestData() {
		this.setData({ isLoading: true });
		
		const app = getApp();
		app.syncAllData().then(() => {
			this.loadFromCache();
		}).catch(err => {
			console.error('加载最新数据失败:', err);
			this.loadFromCache();
		}).finally(() => {
			this.setData({ isLoading: false });
		});
	},
	
	adaptClubData(clubs) {
		return (clubs || []).map(club => ({
			...club,
			shortIntro: club.short_intro || "",
			coverImage: club.cover_image || "",
			memberCount: club.member_count || 0,
			level: club.level || "college",
			tags: Array.isArray(club.tags) ? club.tags : (typeof club.tags === 'string' ? JSON.parse(club.tags) : []),
			images: Array.isArray(club.gallery) ? club.gallery : (typeof club.gallery === 'string' ? JSON.parse(club.gallery) : []),
			isRecruiting: club.isRecruiting || false
		}));
	},
	
	onSearchInput(e) {
		this.setData({ keyword: e.detail.value || "" });
		this.setData({ clubs: this.filterClubs(this.data.allClubs, this.data.keyword, this.data.currentCategory) });
	},
	
	onSearchConfirm() {
		this.setData({ clubs: this.filterClubs(this.data.allClubs, this.data.keyword, this.data.currentCategory) });
	},
	
	filterClubs(list, keyword, category) {
		let result = list || [];
		if (keyword) {
			const lower = keyword.toLowerCase();
			result = result.filter((c) => {
				const inName = (c.name || "").toLowerCase().includes(lower);
				const inTags = (c.tags || []).join(" ").toLowerCase().includes(lower);
				const inShortIntro = (c.shortIntro || "").toLowerCase().includes(lower);
				return inName || inTags || inShortIntro;
			});
		}
		if (category && category !== "全部") {
			result = result.filter((c) => c.category === category);
		}
		return result;
	},
	
	onTapCategory(e) {
		const name = e.currentTarget.dataset.name;
		this.setData({ currentCategory: name });
		this.setData({ clubs: this.filterClubs(this.data.allClubs, this.data.keyword, name) });
	},
	
	goDetail(e) {
		const id = e.currentTarget.dataset.id;
		wx.navigateTo({ url: `/pages/clubDetail/clubDetail?id=${id}` });
	},
	
	onShareAppMessage() {
		return {
			title: "What's my passion!",
			path: '/pages/home/home',
			imageUrl: 'https://c-ssl.duitang.com/uploads/blog/202502/11/pGSv6xwdSBx5v9x.jpeg'
		};
	},
	
	onShareTimeline() {
		return {
			title: "What's my passion!",
			query: '',
			imageUrl: 'https://c-ssl.duitang.com/uploads/blog/202502/11/pGSv6xwdSBx5v9x.jpeg'
		};
	},
	
	/**
	 * 检查公告版本
	 * @description 新逻辑：
	 * 1. 每次进入页面都检查本地公告状态（用户是否已确认）
	 * 2. 如果用户未确认，显示缓存的公告或从服务器获取
	 * 3. 版本检测时间(3天间隔)只影响是否从服务器获取新公告
	 */
	checkAnnouncement() {
		// 步骤1：检查本地公告状态（每次都检查）
		const status = checkAnnouncementStatus();
		
		// 如果有缓存的公告数据且需要显示，直接显示
		if (status.needShow && status.cachedData) {
			console.log('显示缓存的公告');
			this.showAnnouncementFromData(status.cachedData);
			return;
		}
		
		// 步骤2：判断是否需要从服务器获取公告数据
		// 条件：需要获取 或 超过3天未检测
		if (status.needFetch || shouldCheckVersion()) {
			this.fetchAnnouncementFromServer();
		}
	},
	
	/**
	 * 从服务器获取公告数据
	 * @description 获取最新公告并缓存
	 */
	fetchAnnouncementFromServer() {
		api.getAnnouncementVersion().then(result => {
			const { version, title, content, image } = result;
			
			// 更新版本检测时间
			updateVersionCheckTime();
			
			// 如果版本为0，表示没有公告
			if (version === 0) {
				console.log('服务器没有公告');
				return;
			}
			
			// 缓存公告数据
			const announcementData = { version, title, content, image };
			cacheAnnouncementData(announcementData);
			
			// 检查用户是否已确认此版本
			const status = checkAnnouncementStatus();
			if (status.needShow) {
				this.showAnnouncementFromData(announcementData);
			}
		}).catch(err => {
			console.error('获取公告失败:', err);
		});
	},
	
	/**
	 * 显示公告弹窗
	 * @param {Object} data - 公告数据 { version, title, content, image }
	 */
	showAnnouncementFromData(data) {
		this.setData({
			showAnnouncement: true,
			announcementVersion: data.version,
			announcementTitle: data.title || '公告通知',
			announcementContent: data.content || '',
			announcementImage: data.image || ''
		});
	},
	
	/**
	 * 公告确认事件
	 * @description 用户点击确认后关闭公告弹窗
	 */
	onAnnouncementConfirm() {
		this.setData({
			showAnnouncement: false
		});
	},

	/**
	 * 公告关闭事件（点击遮罩层）
	 * @description 用户点击遮罩层关闭公告弹窗，不写入缓存，下次还会显示
	 */
	onAnnouncementClose() {
		this.setData({
			showAnnouncement: false
		});
	},

	/**
	 * 跳转到AI助手聊天页面
	 */
	goToAIChat() {
		wx.navigateTo({ url: '/pages/chat/chat' });
	},

	/**
	 * 点击 Hero 区域自定义壁纸
	 * @description 已有自定义壁纸时提供更换/恢复默认选项，否则直接进入图片选择
	 */
	onHeroWallpaperTap() {
		if (!this.data.heroWallpaper) {
			this.chooseHeroWallpaper();
			return;
		}
		wx.showActionSheet({
			itemList: ['更换壁纸', '恢复默认壁纸'],
			success: (res) => {
				if (res.tapIndex === 0) {
					this.chooseHeroWallpaper();
				} else {
					this.resetHeroWallpaper();
				}
			}
		});
	},

	/**
	 * 选择并保存自定义壁纸
	 * @description 选择成功后立即写入缓存并刷新页面展示
	 */
	chooseHeroWallpaper() {
		wallpaper.pickAndSaveWallpaper().then((wallpaperPath) => {
			this.setData({ heroWallpaper: wallpaperPath });
			wx.showToast({ title: '壁纸已更新', icon: 'success' });
		}).catch((err) => {
			// 用户取消选择不需要任何提示
			if (wallpaper.isCancelError(err)) return;
			console.error('设置壁纸失败:', err);
			wx.showToast({ title: '壁纸保存失败，请重试', icon: 'none' });
		});
	},

	/**
	 * 恢复默认壁纸
	 * @description 清除壁纸缓存记录与本地文件
	 */
	resetHeroWallpaper() {
		wallpaper.removeCustomWallpaper();
		this.setData({ heroWallpaper: '' });
		wx.showToast({ title: '已恢复默认壁纸', icon: 'none' });
	}
})
