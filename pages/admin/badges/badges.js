/**
 * 管理员羽章管理页面
 * @description 管理员可以查看所有羽章并授予用户羽章
 */
const {
  fetchAllBadges,
  awardBadge,
  searchUsersByStudentId,
  getAdminInfo
} = require("../../../utils/api/index");
const adminAuthBehavior = require("../../../behaviors/adminAuth");

Page({
  behaviors: [adminAuthBehavior],

  data: {
    // 自定义导航栏所需的状态栏高度
    statusBarHeight: 20,
    // 羽章列表
    badges: [],
    // 筛选条件
    filterType: '',
    filterRarity: '',
    // 加载状态
    loading: false,
    // 模态框状态
    showAwardModal: false,
    // 当前选中的羽章
    selectedBadge: null,
    // 搜索学号
    searchStudentId: '',
    // 搜索结果
    searchResults: [],
    // 是否显示搜索结果
    showSearchResults: false,
    // 选中的用户
    selectedUser: null,
    // 授予按钮加载状态
    awarding: false
  },

  onLoad() {
    // 自定义导航栏需要手动避让状态栏
    this.setData({ statusBarHeight: wx.getSystemInfoSync().statusBarHeight || 20 });

    // 检查权限并加载数据
    this.checkPermissionWithCallback(() => {
      this.loadBadges();
    });
  },

  /**
   * 加载羽章列表
   */
  async loadBadges() {
    this.setData({ loading: true });
    try {
      const result = await fetchAllBadges({
        type: this.data.filterType,
        rarity: this.data.filterRarity
      });
      if (result && result.success) {
        this.setData({
          badges: result.data,
          loading: false
        });
      } else {
        throw new Error('获取羽章列表失败');
      }
    } catch (error) {
      console.error('获取羽章列表失败:', error);
      wx.showToast({ title: '获取羽章列表失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  /**
   * 类型筛选变化
   */
  onTypeChange(e) {
    const types = ['', 'achievement', 'level', 'identity'];
    const typeLabels = ['全部类型', '成就', '等级', '身份'];
    const index = e.detail.value;
    this.setData({
      filterType: types[index]
    });
    this.loadBadges();
  },

  /**
   * 稀有度筛选变化
   */
  onRarityChange(e) {
    const rarities = ['', 'common', 'rare', 'epic', 'legendary'];
    const rarityLabels = ['全部稀有度', '普通', '稀有', '史诗', '传说'];
    const index = e.detail.value;
    this.setData({
      filterRarity: rarities[index]
    });
    this.loadBadges();
  },

  /**
   * 显示授予羽章模态框
   */
  showAwardModal(e) {
    const badgeId = e.currentTarget.dataset.id;
    const badge = this.data.badges.find(item => item.id === badgeId);
    if (badge) {
      this.setData({
        showAwardModal: true,
        selectedBadge: badge,
        searchStudentId: '',
        searchResults: [],
        showSearchResults: false,
        selectedUser: null
      });
    }
  },

  /**
   * 关闭授予羽章模态框
   */
  closeAwardModal() {
    this.setData({
      showAwardModal: false,
      selectedBadge: null,
      searchStudentId: '',
      searchResults: [],
      showSearchResults: false,
      selectedUser: null
    });
  },

  /**
   * 学号输入处理
   */
  onStudentIdInput(e) {
    const value = e.detail.value;
    this.setData({
      searchStudentId: value
    });

    // 防抖处理
    clearTimeout(this.searchTimer);
    if (value.length >= 2) {
      this.searchTimer = setTimeout(() => {
        this.searchUsers(value);
      }, 500);
    } else {
      this.setData({
        searchResults: [],
        showSearchResults: false
      });
    }
  },

  /**
   * 搜索用户
   */
  async searchUsers(studentId) {
    if (!studentId) return;

    try {
      const result = await searchUsersByStudentId(studentId);
      if (result && result.success) {
        this.setData({
          searchResults: result.data,
          showSearchResults: result.data.length > 0
        });
      }
    } catch (error) {
      console.error('搜索用户失败:', error);
      wx.showToast({ title: '搜索用户失败', icon: 'none' });
    }
  },

  /**
   * 选择用户
   */
  selectUser(e) {
    const index = e.currentTarget.dataset.index;
    const user = this.data.searchResults[index];

    this.setData({
      selectedUser: user,
      searchStudentId: user.student_id,
      searchResults: [],
      showSearchResults: false
    });
  },

  /**
   * 清除用户选择
   */
  clearUserSelection() {
    this.setData({
      selectedUser: null,
      searchStudentId: ''
    });
  },

  /**
   * 授予羽章
   */
  async awardBadge() {
    const { selectedBadge, selectedUser } = this.data;

    if (!selectedUser) {
      wx.showToast({ title: '请先搜索并选择用户', icon: 'none' });
      return;
    }

    this.setData({ awarding: true });

    try {
      const result = await awardBadge(selectedBadge.id, selectedUser.id);
      if (result && result.success) {
        wx.showToast({
          title: '羽章授予成功',
          icon: 'success'
        });
        this.closeAwardModal();
      } else {
        // 显示后端返回的错误消息
        const errorMsg = result?.message || '授予失败';
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 2500
        });
      }
    } catch (error) {
      console.error('授予羽章失败:', error);
      // 从错误对象中提取后端返回的错误消息
      // 微信小程序请求失败时，error可能包含data属性
      let errorMsg = '授予失败';
      if (error && error.data && error.data.message) {
        errorMsg = error.data.message;
      } else if (error && error.message) {
        errorMsg = error.message;
      }
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2500
      });
    } finally {
      this.setData({ awarding: false });
    }
  },

  /**
   * 获取羽章类型标签
   */
  getTypeLabel(type) {
    const labels = {
      achievement: '成就',
      level: '等级',
      identity: '身份'
    };
    return labels[type] || type;
  },

  /**
   * 获取稀有度标签
   */
  getRarityLabel(rarity) {
    const labels = {
      common: '普通',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说'
    };
    return labels[rarity] || rarity;
  },

  /**
   * 获取稀有度颜色类名
   */
  getRarityClass(rarity) {
    const classes = {
      common: 'rarity-common',
      rare: 'rarity-rare',
      epic: 'rarity-epic',
      legendary: 'rarity-legendary'
    };
    return classes[rarity] || '';
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  }
});
