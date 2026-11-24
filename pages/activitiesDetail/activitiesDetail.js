const { 
  fetchEventById, 
  joinEvent, 
  cancelJoinEvent, 
  checkAuthStatus,
  requestSubscribeMessage,
  TEMPLATE_IDS
} = require("../../utils/api/index");
const { getEventsCached } = require("../../utils/cache");
const { formatEventDate } = require("../../utils/date");
const { themeManager } = require("../../utils/theme");
const { getCachedImage, preloadAndCacheImages } = require("../../utils/imageCache");
const userAuthBehavior = require("../../behaviors/userAuth");

Page({
  behaviors: [userAuthBehavior],

  data: {
    eventId: "",
    event: null,
    userInfo: null,
    isJoined: false,
    theme: {},
    cachedCoverImage: '', // 添加缓存的封面图片路径
    cachedImages: [] // 添加缓存的活动图片路径
  },

  onLoad(query) {
    const id = query.id;
    // 获取当前主题
    const theme = themeManager.getCurrentTheme();
    
    this.setData({ 
      eventId: id,
      theme
    });
    
    this.loadUserInfo();
    this.loadEvent(id);
    this.checkUserPermission();
  },
  
  // 主题变更处理函数
  onThemeChange(e) {
    const theme = e.detail.theme;
    this.setData({ theme });
  },
  
  onShow() {
    this.loadUserInfo();
    this.checkUserPermission();
    // 页面显示时重新加载活动信息
    this.loadEvent(this.data.eventId);
  },
  
  onShareAppMessage() {
    if (this.data.event) {
      // 尝试使用缓存的图片
      const coverImage = this.data.event.coverImage || this.data.event.cover_image;
      let imageUrl = coverImage;
      
      // 如果有缓存的图片，使用缓存的本地路径
      if (coverImage) {
        const cachedImage = getCachedImage(coverImage);
        if (cachedImage) {
          imageUrl = cachedImage;
        }
      }
      
      return {
        title: this.data.event.title,
        path: `/pages/activitiesDetail/activitiesDetail?id=${this.data.eventId}`,
        imageUrl: imageUrl
      };
    }
  },
  
  // 下拉刷新
  onPullDownRefresh() {
    this.loadEvent(this.data.eventId, true).finally(() => {
      wx.stopPullDownRefresh();
    });
  },
  
  /**
   * 加载当前用户信息
   */
  loadUserInfo() {
    try {
      const authStatus = checkAuthStatus();
      this.setData({ userInfo: authStatus.isLoggedIn ? authStatus.userInfo : null });
    } catch (e) {
      console.log('获取用户信息失败:', e);
    }
  },

  async loadEvent(id, forceNetwork = false) {
    try {
      let event = null;
      
      // 如果不强制网络请求，先尝试从缓存获取
      if (!forceNetwork) {
        try {
          const cached = getEventsCached();
          if (cached.data && Array.isArray(cached.data)) {
            // 在缓存数据中查找对应的活动
            event = cached.data.find(item => item.id == id);
          }
        } catch (e) {
          console.warn('读取缓存失败:', e);
        }
      }
      
      // 如果缓存中没有找到或者强制网络请求，则从网络获取
      if (!event || forceNetwork) {
        const response = await fetchEventById(id);
        // 适配API响应格式，提取data字段
        event = response.data || response;
        
        // 更新缓存中的活动数据
        if (forceNetwork) {
          this.updateEventInCache(event);
        }
      }
      
      // 检查用户是否已报名
      // 注意：这里需要根据后端实际返回的数据结构调整
      const isJoined = event.isJoined || false;
      
      // 格式化日期
      if (event.date) {
        event.formattedDate = formatEventDate(event.date);
        
        // 计算活动状态
        const eventDate = new Date(event.date);
        const currentDate = new Date();
        // 将当前时间和活动日期都设置为当天的开始时间进行比较
        const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        
        if (eventDay > today) {
          event.statusText = '准备中';
          event.statusClass = 'preparing';
        } else {
          event.statusText = '进行中';
          event.statusClass = 'ongoing';
        }
      }
      
      // 格式化报名截止日期
      const registrationDeadline = event.registrationDeadline || event.registration_deadline;
      if (registrationDeadline) {
        event.formattedRegistrationDeadline = formatEventDate(registrationDeadline);
      }
      
      // 处理地点显示，优先使用location_name
      event.shortLocation = this.formatShortLocation(event.location_name || event.location);
      
      // 确保coverImage字段存在，兼容不同数据格式
      event.coverImage = event.cover_image || '';
      
      // 处理标签和要求字段
      if (typeof event.tags === 'string') {
        try {
          // 尝试解析JSON格式的标签
          event.tags = JSON.parse(event.tags);
        } catch (e) {
          // 如果不是JSON格式，按逗号分隔处理
          event.tags = event.tags ? event.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        }
      } else if (!Array.isArray(event.tags)) {
        event.tags = [];
      }
      
      if (typeof event.requirements === 'string') {
        try {
          // 尝试解析JSON格式的要求
          event.requirements = JSON.parse(event.requirements);
        } catch (e) {
          // 如果不是JSON格式，按换行符分隔处理
          event.requirements = event.requirements ? event.requirements.split('\n').map(req => req.trim()).filter(req => req) : [];
        }
      } else if (!Array.isArray(event.requirements)) {
        event.requirements = [];
      }
      
      // 预加载并缓存图片
      const imageUrls = [];
      if (event.coverImage) {
        imageUrls.push(event.coverImage);
      }
      if (event.images && Array.isArray(event.images)) {
        imageUrls.push(...event.images);
      }
      
      // 预加载图片（不阻塞UI）
      preloadAndCacheImages(imageUrls).catch(err => {
        console.warn('预加载图片失败:', err);
      });
      
      // 获取缓存的图片路径
      let cachedCoverImage = event.coverImage;
      if (event.coverImage) {
        const cached = getCachedImage(event.coverImage);
        if (cached) {
          cachedCoverImage = cached;
        }
      }
      
      let cachedImages = event.images || [];
      if (event.images && Array.isArray(event.images)) {
        cachedImages = event.images.map(imageUrl => {
          const cached = getCachedImage(imageUrl);
          return cached || imageUrl;
        });
      }
      
      this.setData({ 
        event: event,
        isJoined: isJoined,
        cachedCoverImage: cachedCoverImage,
        cachedImages: cachedImages
      });
      
      wx.setNavigationBarTitle({ title: event.title || "活动详情" });
    } catch (e) {
      console.error('加载活动详情失败:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      // 不再隐藏加载提示，因为我们一开始就没有显示
    }
  },
  
  // 更新缓存中的活动数据
  updateEventInCache(updatedEvent) {
    try {
      const app = getApp();
      if (!app) return;
      
      const { getTimedCached, setTimedCached } = require("../../utils/cache");
      const cached = getTimedCached(app.globalData.eventsKey, []);
      
      if (cached.data && Array.isArray(cached.data)) {
        // 查找并更新缓存中的活动
        const eventIndex = cached.data.findIndex(item => item.id == updatedEvent.id);
        if (eventIndex !== -1) {
          // 更新活动数据
          cached.data[eventIndex] = updatedEvent;
        } else {
          // 如果缓存中没有该活动，则添加到缓存
          cached.data.push(updatedEvent);
        }
        
        // 保存更新后的缓存
        setTimedCached(app.globalData.eventsKey, cached.data);
      }
    } catch (e) {
      console.warn('更新活动缓存失败:', e);
    }
  },
  

  onCommentPosted(e) {
    console.log('评论发表成功', e.detail);
  
  },
  
 
  onCommentDeleted(e) {
    console.log('评论删除成功', e.detail);
  
  },
  
  /**
   * 报名参加活动
   * @description 报名成功后请求订阅消息授权，用于接收活动开始提醒
   */
  async joinEvent() {
    if (!this.data.userInfo) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    const event = this.data.event;
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
    if (this.data.isJoined) {
      wx.showToast({ title: '已经报名此活动', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '报名中...' });
    
    try {
      await joinEvent(this.data.eventId);
      wx.hideLoading();
      wx.showToast({ title: '报名成功', icon: 'success' });
      
      // 更新本地数据
      this.setData({ 
        isJoined: true
      });
      
      // 报名成功后请求订阅消息授权（用于活动开始提醒）
      try {
        await requestSubscribeMessage([TEMPLATE_IDS.EVENT_START_REMINDER]);
        console.log('活动开始提醒授权完成');
      } catch (subscribeError) {
        // 授权失败不影响报名结果，只是无法收到提醒
        console.log('订阅消息授权失败或用户拒绝:', subscribeError);
      }
      
      // 刷新活动详情以更新缓存
      this.refreshEvent();
    } catch (error) {
      console.error('报名失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '报名失败', icon: 'none' });
    }
  },
  
  // 取消报名
  async cancelJoin() {
    if (!this.data.userInfo) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '取消中...' });
    
    try {
      await cancelJoinEvent(this.data.eventId);
      wx.showToast({ title: '已取消报名', icon: 'success' });
      // 更新本地数据
      this.setData({ 
        isJoined: false
      });
      
      // 刷新活动详情以更新缓存
      this.refreshEvent();
    } catch (error) {
      console.error('取消报名失败:', error);
      wx.showToast({ title: '取消失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
  
  // 图片预览功能
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const images = this.data.cachedImages;
    
    wx.previewImage({
      current: url,
      urls: images
    });
  },
  
  // 预览封面图片
  previewCoverImage(e) {
    const url = e.currentTarget.dataset.url;
    
    wx.previewImage({
      current: this.data.cachedCoverImage,
      urls: [this.data.cachedCoverImage]
    });
  },
  
  // 获取缓存图片的方法（供WXML使用）
  getCachedImage(url) {
    return getCachedImage(url) || url;
  },
  
  // 返回上一页
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/home/home'
        });
      }
    });
  },
  

  /**
   * 跳转到活动地图页面
   * @description 携带活动ID跳转到地图页面，地图页面会定位并显示该活动
   */
  goToEventMap() {
    const event = this.data.event;
    if (!event) return;
    
    wx.navigateTo({
      url: `/pages/eventMap/eventMap?eventId=${this.data.eventId}`
    });
  },
  
  openMap() {
    const event = this.data.event;
    if (!event || !event.latitude || !event.longitude) return;
    
    const displayName = event.location_name || event.location || event.title;
    wx.openLocation({
      latitude: event.latitude,
      longitude: event.longitude,
      name: displayName,
      address: event.location || ''
    });
  },
  
  
  refreshEvent() {
    this.loadEvent(this.data.eventId, true);
  },
  
  /**
   * 格式化地点显示
   * @description 优先处理location_name字段，如果地点超过8个字，显示"..."加后4个字；否则显示完整地点
   * @param {string} location - 地点字符串（优先传入location_name）
   * @returns {string} 格式化后的地点
   */
  formatShortLocation(location) {
    if (!location) return '';
    // 如果地点超过8个字，显示"..."加后4个字
    if (location.length > 8) {
      return '...' + location.slice(-4);
    }
    return location;
  }
});