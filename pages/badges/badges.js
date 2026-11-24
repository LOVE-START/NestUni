/**
 * 羽章系统页面
 * @description 展示所有羽章和用户已获得的羽章，支持佩戴功能
 */

const api = require('../../utils/api/index');
const imageCache = require('../../utils/imageCache');
const { optimizeImageUrl } = require('../../utils/imageLoader');

Page({
  data: {
    badges: [],
    myBadges: [],
    stats: {},
    progressPercent: 0,
    loading: true,
    activeTab: 'all',
    activeRarity: 'all',
    showBadgeModal: false,
    selectedBadge: null,
    filteredBadges: [],
    displayedBadges: [],
    displayedCount: 0,
    maxDisplay: 2,
    isWorn: false
  },

  onLoad() {
    this.loadBadges(false);
  },

  /**
   * 加载羽章数据
   * @param {boolean} forceRefresh - 是否强制刷新图片缓存
   */
  async loadBadges(forceRefresh = false) {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const [allBadgesRes, myBadgesRes, statsRes] = await Promise.all([
        api.fetchAllBadges(),
        api.fetchMyBadges(),
        api.fetchBadgeStats()
      ]);
      
      let badges = allBadgesRes.data || [];
      const myBadges = myBadgesRes.data.badges || [];
      const stats = statsRes.data || {};
      
      /**
       * 图片缓存处理
       * @description 使用优化的图片加载策略，按需缓存
       */
      badges = badges.map(badge => {
        if (badge.icon && badge.icon.startsWith('http')) {
          let iconUrl = badge.icon;
          
          if (forceRefresh) {
            // 下拉刷新时：删除旧缓存并重新下载
            imageCache.removeCachedImage(badge.icon);
            // 使用优化后的URL（会异步缓存）
            iconUrl = optimizeImageUrl(badge.icon);
          } else {
            // 正常加载时：使用优化后的URL（优先使用缓存）
            iconUrl = optimizeImageUrl(badge.icon);
          }
          
          return { ...badge, icon: iconUrl };
        }
        return badge;
      });
      
      // 计算收藏统计数据
      const myBadgeIds = new Set(myBadges.map(b => b.id));
      const calculatedStats = {
        total_badges: myBadgeIds.size,
        legendary_count: 0,
        epic_count: 0,
        rare_count: 0,
        common_count: 0
      };
      
      badges.forEach(badge => {
        if (myBadgeIds.has(badge.id)) {
          switch (badge.rarity) {
            case 'legendary':
              calculatedStats.legendary_count++;
              break;
            case 'epic':
              calculatedStats.epic_count++;
              break;
            case 'rare':
              calculatedStats.rare_count++;
              break;
            case 'common':
              calculatedStats.common_count++;
              break;
          }
        }
      });
      
      // 合并后端统计和前端计算的数据，优先使用后端数据
      const finalStats = {
        ...calculatedStats,
        ...stats,
        total_badges: stats.total_badges ?? calculatedStats.total_badges
      };
      
      // 获取已佩戴的羽章
      const displayedBadges = myBadges.filter(b => b.is_displayed);
      
      // 标记已获得的羽章和佩戴状态
      const displayedBadgeIds = new Set(displayedBadges.map(b => b.id));
      
      const processedBadges = badges.map(badge => ({
        ...badge,
        is_earned: myBadgeIds.has(badge.id),
        is_worn: displayedBadgeIds.has(badge.id)
      }));
      
      // 计算收集进度百分比
      const progressPercent = badges.length > 0 
        ? Math.round((finalStats.total_badges || 0) / badges.length * 100) 
        : 0;
      
      this.setData({
        badges: processedBadges,
        myBadges,
        stats: finalStats,
        progressPercent,
        displayedBadges,
        displayedCount: displayedBadges.length,
        loading: false
      });
      
      // 计算筛选后的羽章列表
      this.updateFilteredBadges();
      
      wx.hideLoading();
    } catch (error) {
      console.error('加载羽章失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'error' });
      this.setData({ loading: false });
    }
  },

  /**
   * 切换类型标签
   * @param {Object} e - 事件对象
   */
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.updateFilteredBadges();
  },

  /**
   * 切换稀有度筛选
   * @param {Object} e - 事件对象
   */
  onRarityChange(e) {
    const rarity = e.currentTarget.dataset.rarity;
    this.setData({ activeRarity: rarity });
    this.updateFilteredBadges();
  },

  /**
   * 更新筛选后的羽章列表
   * @description 根据当前筛选条件过滤羽章
   */
  updateFilteredBadges() {
    let filtered = this.data.badges;
    
    // 按类型筛选
    if (this.data.activeTab !== 'all') {
      filtered = filtered.filter(b => b.type === this.data.activeTab);
    }
    
    // 按稀有度筛选
    if (this.data.activeRarity !== 'all') {
      filtered = filtered.filter(b => b.rarity === this.data.activeRarity);
    }
    
    // 按稀有度排序：传说 > 史诗 > 稀有 > 普通
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
    filtered.sort((a, b) => {
      const orderA = rarityOrder[a.rarity] ?? 4;
      const orderB = rarityOrder[b.rarity] ?? 4;
      // 已获得的排在前面
      if (a.is_earned !== b.is_earned) {
        return a.is_earned ? -1 : 1;
      }
      return orderA - orderB;
    });
    
    this.setData({ filteredBadges: filtered });
  },

  /**
   * 点击羽章卡片
   * @param {Object} e - 事件对象
   */
  onBadgeTap(e) {
    const badge = e.detail?.badge;
    if (!badge || !badge.id) {
      console.warn('无效的羽章数据:', e);
      return;
    }
    
    const displayedBadgeIds = new Set(this.data.displayedBadges.map(b => b.id));
    
    this.setData({
      selectedBadge: badge,
      showBadgeModal: true,
      isWorn: displayedBadgeIds.has(badge.id)
    });
  },

  /**
   * 关闭羽章详情弹窗
   */
  onModalClose() {
    this.setData({
      showBadgeModal: false,
      selectedBadge: null
    });
  },

  /**
   * 佩戴羽章
   * @param {Object} e - 事件对象
   */
  async onWearBadge(e) {
    const badge = e.detail.badge;
    const { displayedBadges, maxDisplay } = this.data;
    
    if (displayedBadges.length >= maxDisplay) {
      wx.showToast({
        title: `最多同时佩戴${maxDisplay}个羽章`,
        icon: 'none'
      });
      return;
    }
    
    try {
      wx.showLoading({ title: '佩戴中...' });
      
      // 更新佩戴列表
      const newDisplayedBadges = [...displayedBadges, badge];
      const badgeIds = newDisplayedBadges.map(b => b.id);
      const displayOrders = {};
      newDisplayedBadges.forEach((b, index) => {
        displayOrders[b.id] = index;
      });
      
      await api.updateBadgeDisplay(badgeIds, displayOrders);
      
      // 更新本地状态
      const displayedBadgeIds = new Set(badgeIds);
      const processedBadges = this.data.badges.map(b => ({
        ...b,
        is_worn: displayedBadgeIds.has(b.id)
      }));
      
      this.setData({
        displayedBadges: newDisplayedBadges,
        displayedCount: newDisplayedBadges.length,
        isWorn: true,
        badges: processedBadges
      });
      
      this.updateFilteredBadges();
      
      wx.hideLoading();
      wx.showToast({
        title: '佩戴成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('佩戴羽章失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '佩戴失败',
        icon: 'error'
      });
    }
  },

  /**
   * 取消佩戴羽章
   * @param {Object} e - 事件对象
   */
  async onUnwearBadge(e) {
    const badge = e.detail.badge;
    const { displayedBadges } = this.data;
    
    try {
      wx.showLoading({ title: '取消佩戴中...' });
      
      // 更新佩戴列表
      const newDisplayedBadges = displayedBadges.filter(b => b.id !== badge.id);
      const badgeIds = newDisplayedBadges.map(b => b.id);
      const displayOrders = {};
      newDisplayedBadges.forEach((b, index) => {
        displayOrders[b.id] = index;
      });
      
      await api.updateBadgeDisplay(badgeIds, displayOrders);
      
      // 更新本地状态
      const displayedBadgeIds = new Set(badgeIds);
      const processedBadges = this.data.badges.map(b => ({
        ...b,
        is_worn: displayedBadgeIds.has(b.id)
      }));
      
      this.setData({
        displayedBadges: newDisplayedBadges,
        displayedCount: newDisplayedBadges.length,
        isWorn: false,
        badges: processedBadges
      });
      
      this.updateFilteredBadges();
      
      wx.hideLoading();
      wx.showToast({
        title: '已取消佩戴',
        icon: 'success'
      });
    } catch (error) {
      console.error('取消佩戴失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
    }
  },

  /**
   * 下拉刷新
   * @description 下拉刷新时强制刷新图片缓存（删除旧缓存，重新下载并缓存）
   */
  async onPullDownRefresh() {
    await this.loadBadges(true);
    wx.stopPullDownRefresh();
  }
});
