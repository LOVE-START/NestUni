const { getClubListCached } = require("../../utils/cache");
const { fetchClubById, fetchClubAnnouncements, fetchMyClubs, fetchClubEvents, fetchRecruitments } = require("../../utils/api/index");
const { formatEventDate } = require("../../utils/date");
const { themeManager } = require("../../utils/theme");
const { getCachedImage, preloadAndCacheImages } = require("../../utils/imageCache");

Page({
  data: {
    clubId: "",
    club: null,
    clubAnnouncements: [],
    clubEvents: [],
    theme: {},
    isClubLeader: false,
    showEditButton: false,
    recruitment: null,
    decryptionSequence: ['members', 'events', 'announcements', 'intro-header'],
    currentSequenceIndex: 0,
    clickedElements: [],
    decryptionSuccess: false
  },

  onLoad(query) {
    const id = query.id;
    // 获取当前主题
    const theme = themeManager.getCurrentTheme();
    
    // 设置初始数据
    this.setData({ 
      clubId: id,
      theme,
      isClubLeader: false,
      showEditButton: false,
      currentSequenceIndex: 0,
      clickedElements: [],
      decryptionSuccess: false
    });
    
    // 并行加载数据
    Promise.all([
      this.loadClub(id),
      this.loadClubAnnouncements(id),
      this.loadClubEvents(id),
      this.checkClubLeader(id),
      this.loadRecruitment(id)
    ]).catch(error => {
      console.error('数据加载出错:', error);
    });
  },
  
  onShow() {
    // 页面显示时重新检查会长身份以确保状态正确
    this.checkClubLeader(this.data.clubId);
  },
  
  // 检查用户是否为社团会长
  async checkClubLeader(clubId) {
    try {
      // 检查用户是否已登录
      const userToken = wx.getStorageSync('userToken');
      const adminToken = wx.getStorageSync('adminToken');
      const userInfo = wx.getStorageSync('userInfo');
      const adminInfo = wx.getStorageSync('admininfo');
      const isLoggedIn = (userToken && userInfo) || (adminToken && adminInfo);
      
      // 如果用户未登录，直接设置为非会长
      if (!isLoggedIn) {
        this.setData({ isClubLeader: false });
        return Promise.resolve(false);
      }
      
      // 获取全局应用实例以访问缓存键
      const app = getApp();
      
      // 总是调用API获取最新的用户加入的社团列表，确保数据是最新的
      // 这样可以避免用户角色变更后页面仍然显示旧数据的问题
      const response = await fetchMyClubs();
      
      if (response && response.success) {
        const userClubs = response.data || [];
        // 更新缓存中的用户社团数据
        wx.setStorageSync(app.globalData.myClubsKey || 'userClubs', userClubs);
        
        // 确保社团ID是字符串类型进行比较
        const isLeader = userClubs.some(club => 
          `${club.id}` === `${clubId}` && club.role === 'leader'
        );
        
        this.setData({ isClubLeader: isLeader });
        return Promise.resolve(isLeader);
      } else {
        this.setData({ isClubLeader: false });
        return Promise.resolve(false);
      }
    } catch (error) {
      console.log('检查会长身份失败:', error);
      this.setData({ isClubLeader: false });
      return Promise.resolve(false);
    }
  },
  
  // 编辑社团信息
  editClubInfo() {
    if (this.data.isClubLeader) {
      wx.navigateTo({
        url: `/pages/edit/edit?id=${this.data.clubId}`
      });
    } else {
      // 再次检查会长身份，确保状态正确
      this.checkClubLeader(this.data.clubId).then((isLeader) => {
        if (isLeader) {
          wx.navigateTo({
            url: `/pages/edit/edit?id=${this.data.clubId}`
          });
        } else {
          wx.showToast({
            title: '仅会长可编辑',
            icon: 'none'
          });
        }
      });
    }
  },
  
  // 解密游戏：统计项点击处理
  onStatItemClick(e) {
    // 只有会长且尚未解密成功时才处理点击
    if (!this.data.isClubLeader || this.data.decryptionSuccess) return;
    
    const stat = e.currentTarget.dataset.stat;
    this.handleDecryptionStep(stat);
  },
  
  // 解密游戏：模块标题点击处理
  onSectionHeaderClick(e) {
    // 只有会长且尚未解密成功时才处理点击
    if (!this.data.isClubLeader || this.data.decryptionSuccess) return;
    
    const id = e.currentTarget.id;
    this.handleDecryptionStep(id);
  },
  
  // 解密游戏：处理点击步骤
  handleDecryptionStep(element) {
    // 如果已经解密成功，不再处理
    if (this.data.decryptionSuccess) return;
    
    const { decryptionSequence, currentSequenceIndex, clickedElements } = this.data;
    
    // 检查点击的元素是否符合解密顺序
    if (decryptionSequence[currentSequenceIndex] === element) {
      // 正确步骤，更新状态
      const newClickedElements = [...clickedElements, element];
      const nextIndex = currentSequenceIndex + 1;
      
      this.setData({
        currentSequenceIndex: nextIndex,
        clickedElements: newClickedElements
      });
      
      // 检查是否完成所有步骤
      if (nextIndex === decryptionSequence.length) {
        // 解密成功
        this.setData({
          decryptionSuccess: true,
          showEditButton: true
        });
        
        wx.showToast({
          title: '解密成功！',
          icon: 'success'
        });
      } else {
        // 提示下一步
        const nextElement = decryptionSequence[nextIndex];
        let hint = '';
        switch(nextElement) {
          case 'members':
            hint = '点击成员统计';
            break;
          case 'events':
            hint = '点击活动统计';
            break;
          case 'announcements':
            hint = '点击公告统计';
            break;
          case 'intro-header':
            hint = '点击社团介绍标题';
            break;
          case 'gallery-header':
            hint = '点击社团相册标题';
            break;
          case 'announcement-header':
            hint = '点击社团公告标题';
            break;
          default:
            hint = '继续解密';
        }
        
        wx.showToast({
          title: `正确！下一步：${hint}`,
          icon: 'none'
        });
      }
    } else {
      // 错误步骤，重置
      this.setData({
        currentSequenceIndex: 0,
        clickedElements: []
      });
      
      wx.showToast({
        title: '顺序错误，重新开始',
        icon: 'none'
      });
    }
  },
  
  onShareAppMessage() {
    if (this.data.club) {
      // 尝试使用缓存的图片
      let imageUrl = this.data.club.cover_image;
      
      // 如果有缓存的图片，使用缓存的本地路径
      if (this.data.club.cover_image) {
        const cachedImage = getCachedImage(this.data.club.cover_image);
        if (cachedImage) {
          imageUrl = cachedImage;
        }
      }
      
      return {
        title: `分享给你 我的${this.data.club.name}💌`,
        path: `/pages/clubDetail/clubDetail?id=${this.data.clubId}`,
        imageUrl: imageUrl
      };
    }
  },

  onShareTimeline() {
    if (this.data.club) {
      // 尝试使用缓存的图片
      let imageUrl = this.data.club.cover_image;
      
      // 如果有缓存的图片，使用缓存的本地路径
      if (this.data.club.cover_image) {
        const cachedImage = getCachedImage(this.data.club.cover_image);
        if (cachedImage) {
          imageUrl = cachedImage;
        }
      }
      
      return {
        title: `分享给你 我的${this.data.club.name}💌`,
        query: `id=${this.data.clubId}`,
        imageUrl: imageUrl
      };
    }
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadClub(this.data.clubId, true),
      this.loadClubAnnouncements(this.data.clubId, true),
      this.loadClubEvents(this.data.clubId, true),
      this.checkClubLeader(this.data.clubId)
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },
  
  // 加载社团数据
  async loadClub(id, forceNetwork = false) {
    try {
      // 先尝试从缓存获取
      if (!forceNetwork) {
        const { data } = getClubListCached();
        const fromCache = (data || []).find(c => `${c.id}` === `${id}`);
        if (fromCache) {
          // 格式化日期
          const club = { ...fromCache };
          if (club.created_at) {
            club.formattedCreatedAt = formatEventDate(club.created_at);
          }
          
          // 预加载并缓存图片
          const imageUrls = [];
          if (club.cover_image) {
            imageUrls.push(club.cover_image);
          }
          if (club.gallery && Array.isArray(club.gallery)) {
            imageUrls.push(...club.gallery);
          }
          
          // 预加载图片（不阻塞UI）
          preloadAndCacheImages(imageUrls).catch(err => {
            console.warn('预加载图片失败:', err);
          });
          
          this.setData({ club });
          wx.setNavigationBarTitle({ title: club.name || "社团详情" });
          return;
        }
      }
      
      // 从网络获取
      const response = await fetchClubById(id);
      // 修复：正确处理API响应数据
      const club = response.data || response;
      
      // 添加模拟评级数据
      if (!club.rating) {
        // 生成一个4.0到5.0之间的随机评分作为示例
        club.rating = (Math.random() * 1 + 4).toFixed(1);
      }
      
      // 格式化日期
      if (club.created_at) {
        club.formattedCreatedAt = formatEventDate(club.created_at);
      }
      
      // 预加载并缓存图片
      const imageUrls = [];
      if (club.cover_image) {
        imageUrls.push(club.cover_image);
      }
      if (club.gallery && Array.isArray(club.gallery)) {
        imageUrls.push(...club.gallery);
      }
      
      // 预加载图片（不阻塞UI）
      preloadAndCacheImages(imageUrls).catch(err => {
        console.warn('预加载图片失败:', err);
      });
      
      this.setData({ club });
      
      // 如果是强制刷新（下拉刷新），更新缓存
      if (forceNetwork) {
        const { data: cachedClubs } = getClubListCached();
        if (cachedClubs && Array.isArray(cachedClubs)) {
          const updatedClubs = cachedClubs.map(item => 
            `${item.id}` === `${id}` ? club : item
          );
          wx.setStorageSync(getApp().globalData.clubListKey, updatedClubs);
        }
      }
      
      wx.setNavigationBarTitle({ title: club.name || "社团详情" });
    } catch (e) {
      console.error('加载社团详情失败:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },
  
  async loadClubAnnouncements(id, forceNetwork = false) {
    try {
      const response = await fetchClubAnnouncements(id);
      let list = response.data || response;
      
      // 格式化公告的创建时间
      if (Array.isArray(list)) {
        list = list.map(announcement => {
          return {
            ...announcement,
            formattedCreatedAt: announcement.created_at ? formatEventDate(announcement.created_at) : ''
          };
        });
      }
      
      this.setData({ clubAnnouncements: list });
    } catch (e) {
      console.log('加载社团公告失败:', e);
    }
  },

  // 加载社团相关的活动
  async loadClubEvents(id, forceNetwork = false) {
    try {
      const response = await fetchClubEvents(id);
      let list = response.data || response;
      
      // 只显示发布成功的活动（过滤掉待审核、已拒绝、已取消等状态）
      if (Array.isArray(list)) {
        list = list.filter(event => event.status === 'published');
      }
      
      // 格式化活动的日期和时间
      if (Array.isArray(list)) {
        list = list.map(event => {
          return {
            ...event,
            formattedDate: event.date ? formatEventDate(event.date) : '',
            formattedTime: event.time || ''
          };
        });
      }
      
      this.setData({ clubEvents: list });
    } catch (e) {
      console.log('加载社团活动失败:', e);
    }
  },

  // 查看活动详情
  viewEvent(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activitiesDetail/activitiesDetail?id=${id}`
    });
  },
  
  // 查看更多相册
  viewGallery(e) {
    const index = e.currentTarget.dataset.index;
    if (this.data.club && this.data.club.gallery) {
      // 尝试使用缓存的图片
      const cachedImages = this.data.club.gallery.map(imageUrl => {
        const cachedImage = getCachedImage(imageUrl);
        return cachedImage || imageUrl;
      });
      
      wx.previewImage({
        current: cachedImages[index],
        urls: cachedImages
      });
    }
  },

  // 预览公告图片
  previewAnnouncementImage(e) {
    const { url, images } = e.currentTarget.dataset;
    
    // 确保images是一个数组
    let imageArray = [];
    if (Array.isArray(images)) {
      imageArray = images;
    } else if (typeof images === 'string') {
      try {
        // 尝试解析JSON字符串
        imageArray = JSON.parse(images);
      } catch (err) {
        // 如果解析失败，将其作为单个URL处理
        imageArray = [images];
      }
    } else {
      // 如果是其他类型，作为单个URL处理
      imageArray = [url];
    }
    
    // 尝试使用缓存的图片
    const cachedImages = imageArray.map(imageUrl => {
      const cachedImage = getCachedImage(imageUrl);
      return cachedImage || imageUrl;
    });
    
    // 找到当前图片在数组中的索引
    const currentIndex = cachedImages.indexOf(url);
    
    wx.previewImage({
      current: url,
      urls: cachedImages
    });
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
   * 加载社团招新信息
   * @param {string} id - 社团ID
   */
  async loadRecruitment(id) {
    try {
      const response = await fetchRecruitments({ clubId: id, pageSize: 1 });
      if (response && response.success && response.data && response.data.length > 0) {
        this.setData({ recruitment: response.data[0] });
      } else {
        this.setData({ recruitment: null });
      }
    } catch (error) {
      console.log('该社团暂无招新信息:', error);
      this.setData({ recruitment: null });
    }
  },

  /**
   * 跳转到招新详情
   */
  goToRecruitment() {
    const { recruitment } = this.data;
    if (recruitment && recruitment.id) {
      wx.navigateTo({
        url: `/pages/recruitmentDetail/recruitmentDetail?id=${recruitment.id}`
      });
    } else {
      wx.showToast({
        title: '该社团暂无招新',
        icon: 'none'
      });
    }
  }
});