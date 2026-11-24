/**
 * 社长查看报名列表页面
 * @description 社团社长查看招新收到的报名申请
 */
const { request, checkAuthStatus, fetchMyClubs } = require('../../utils/api/index');
const { themeManager } = require('../../utils/theme');
const { formatEventDateTime } = require('../../utils/date');

Page({
  data: {
    statusBarHeight: 0,
    clubId: '',
    recruitmentId: '',
    recruitmentTitle: '',
    applications: [],
    currentStatus: 'all',
    loading: false,
    refreshing: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    theme: {},
    stats: {
      total: 0,
      pending: 0,
      accepted: 0
    },
    // 权限控制
    hasPermission: false,
    permissionChecked: false
  },

  onLoad(query) {
    const systemInfo = wx.getSystemInfoSync();
    const theme = themeManager.getCurrentTheme();
    
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      theme
    });

    const { clubId, recruitmentId, title } = query;
    if (clubId) {
      this.setData({ 
        clubId,
        recruitmentId: recruitmentId || '',
        recruitmentTitle: title ? decodeURIComponent(title) : ''
      });
      // 先检查权限
      this.checkPermission(clubId);
    } else {
      this.setData({ hasPermission: false, permissionChecked: true });
    }
  },

  /**
   * 检查用户权限
   * @description 只有该社团的社长才能查看报名列表
   * @param {string} clubId - 社团ID
   */
  async checkPermission(clubId) {
    const authStatus = checkAuthStatus();
    if (!authStatus.isLoggedIn) {
      this.setData({ hasPermission: false, permissionChecked: true });
      return;
    }

    try {
      // 检查是否是该社团的社长
      const response = await fetchMyClubs();
      if (response && response.success) {
        const userClubs = response.data || [];
        const isLeader = userClubs.some(club =>
          `${club.id}` === `${clubId}` && club.role === 'leader'
        );
        if (isLeader) {
          // 是该社团社长，允许访问
          this.setData({ hasPermission: true, permissionChecked: true });
          this.loadApplications();
        } else {
          this.setData({ hasPermission: false, permissionChecked: true });
        }
      } else {
        this.setData({ hasPermission: false, permissionChecked: true });
      }
    } catch (error) {
      console.error('检查权限失败:', error);
      this.setData({ hasPermission: false, permissionChecked: true });
    }
  },

  /**
   * 主题变更处理
   * @param {Object} e - 事件对象
   */
  onThemeChange(e) {
    const theme = e.detail.theme;
    this.setData({ theme });
  },

  /**
   * 返回上一页
   */
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
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.refreshList().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 刷新列表
   */
  async refreshList() {
    this.setData({ 
      refreshing: true, 
      page: 1,
      hasMore: true 
    });
    await this.loadApplications();
    this.setData({ refreshing: false });
  },

  /**
   * 加载报名列表
   */
  async loadApplications() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const { clubId, recruitmentId, currentStatus, page, pageSize } = this.data;
      
      let url = `/nfunest/api/recruitments/club/${clubId}/applications?page=${page}&pageSize=${pageSize}`;
      if (recruitmentId) {
        url += `&recruitment_id=${recruitmentId}`;
      }
      if (currentStatus !== 'all') {
        url += `&status=${currentStatus}`;
      }

      const response = await request({
        url,
        method: 'GET',
        showLoading: false
      });

      if (response.success) {
        const newApplications = response.data || [];
        
        // 格式化提交时间
        newApplications.forEach(app => {
          if (app.submitted_at) {
            app.submitted_at = formatEventDateTime(app.submitted_at);
          }
        });
        
        const applications = page === 1 ? newApplications : [...this.data.applications, ...newApplications];

        this.setData({
          applications,
          hasMore: newApplications.length >= pageSize
        });

        this.calculateStats(applications);
      }
    } catch (error) {
      console.error('加载报名列表失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 计算统计数据
   * @param {Array} applications - 报名列表
   */
  calculateStats(applications) {
    const stats = {
      total: applications.length,
      pending: 0,
      accepted: 0
    };

    applications.forEach(app => {
      if (app.statusClass === 'submitted' || app.statusClass === 'viewed') {
        stats.pending++;
      }
      if (app.statusClass === 'accepted') {
        stats.accepted++;
      }
    });

    this.setData({ stats });
  },

  /**
   * 加载更多
   */
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    
    this.setData({ page: this.data.page + 1 });
    this.loadApplications();
  },

  /**
   * 状态筛选变更
   * @param {Object} e - 事件对象
   */
  onStatusChange(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ 
      currentStatus: status, 
      page: 1,
      hasMore: true 
    });
    this.loadApplications();
  },

  /**
   * 跳转到报名详情
   * @param {Object} e - 事件对象
   */
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/applicationDetail/applicationDetail?id=${id}&isLeader=true`
    });
  },

  /**
   * 复制联系方式到剪贴板
   * @description 显示详细的复制提示，告知用户复制的内容类型
   * @param {Object} e - 事件对象，包含 dataset.text 和 dataset.label
   */
  copyText(e) {
    const text = e.currentTarget.dataset.text;
    const label = e.currentTarget.dataset.label || '联系方式';
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: `已复制${label}`,
          icon: 'success'
        });
      }
    });
  }
});
