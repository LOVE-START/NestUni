/**
 * 我的报名页面
 * @description 展示用户的所有报名记录及状态
 */
const { request } = require('../../utils/api/index');
const { themeManager } = require('../../utils/theme');
const { formatEventDateTime } = require('../../utils/date');
const userAuthBehavior = require('../../behaviors/userAuth');

Page({
  behaviors: [userAuthBehavior],

  data: {
    statusBarHeight: 0,
    applications: [],
    currentStatus: 'all',
    loading: false,
    refreshing: false,
    hasMore: true,
    theme: {},
    // 统计数据
    stats: {
      total: 0,
      interviewing: 0,
      accepted: 0
    }
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const theme = themeManager.getCurrentTheme();

    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      theme
    });

    // 检查权限并加载数据
    this.checkPermissionWithCallback(() => {
      this.loadApplications();
    });
  },

  onShow() {
    // 只有有权限时才刷新数据
    if (this.data.hasPermission) {
      this.refreshList();
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
    this.setData({ refreshing: true });
    await this.loadApplications();
    this.setData({ refreshing: false });
  },

  /**
   * 加载报名列表
   * @description 使用后端状态筛选，避免前端筛选浪费带宽
   */
  async loadApplications() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const { currentStatus } = this.data;

      // 构建查询参数，传递状态给后端筛选
      const queryParams = currentStatus !== 'all' ? `?status=${currentStatus}` : '';

      const response = await request({
        url: `/nfunest/api/recruitments/my/applications${queryParams}`,
        method: 'GET',
        showLoading: false
      });

      if (response.success) {
        const applications = response.data || [];

        // 状态文本映射
        const statusTextMap = {
          'submitted': '已提交',
          'viewed': '已查看',
          'interviewing': '面试中',
          'accepted': '已录取',
          'rejected': '已拒绝'
        };

        // 为每个报名添加状态文本和格式化时间
        applications.forEach(item => {
          item.statusText = statusTextMap[item.status] || '未知';
          // 格式化提交时间
          item.formatted_submitted_at = formatEventDateTime(item.submitted_at);
          // 格式化面试时间
          item.formatted_interview_time = formatEventDateTime(item.interview_time);
        });

        // 过滤掉 rejected 状态的申请（双重保险，后端已过滤）
        const filteredApplications = applications.filter(item => item.status !== 'rejected');

        // 计算统计数据（不包含 rejected）
        const stats = {
          total: filteredApplications.length,
          interviewing: filteredApplications.filter(item => item.status === 'interviewing').length,
          accepted: filteredApplications.filter(item => item.status === 'accepted').length
        };

        this.setData({
          applications: filteredApplications,
          hasMore: false,
          stats
        });
      }
    } catch (error) {
      console.error('加载报名列表失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载更多
   */
  loadMore() {
    // 当前接口返回全部数据，暂不需要分页
  },

  /**
   * 状态变更
   * @param {Object} e - 事件对象
   */
  onStatusChange(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ currentStatus: status });
    this.loadApplications();
  },

  /**
   * 跳转到详情
   * @param {Object} e - 事件对象
   */
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/applicationDetail/applicationDetail?id=${id}`
    });
  },

  /**
   * 跳转到首页浏览社团
   * @description 招新入口已整合到社团详情页，引导用户去首页查看社团
   */
  goToRecruitment() {
    wx.reLaunch({
      url: '/pages/home/home'
    });
  }
});
