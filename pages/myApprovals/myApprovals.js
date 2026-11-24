/**
 * 我的审核记录页面
 * @description 会长查看自己的审核记录
 */

const { fetchMyApprovals } = require('../../utils/api/index');
const leaderAuthBehavior = require('../../behaviors/leaderAuth');

Page({
  behaviors: [leaderAuthBehavior],

  data: {
    currentTab: 'all',
    approvals: [],
    pagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    },
    loading: false
  },

  /**
   * 页面加载
   */
  async onLoad() {
    // 检查权限并加载数据
    await this.checkPermissionWithCallback(() => {
      this.loadApprovals();
    });
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadApprovals(true);
    wx.stopPullDownRefresh();
  },

  /**
   * 加载审核记录
   * @param {boolean} refresh - 是否刷新
   */
  async loadApprovals(refresh = false) {
    if (this.data.loading) return;

    const page = refresh ? 1 : this.data.pagination.page;
    const status = this.data.currentTab === 'all' ? null : this.data.currentTab;

    this.setData({ loading: true });

    try {
      const result = await fetchMyApprovals({
        status,
        page,
        pageSize: this.data.pagination.pageSize
      });

      if (result && result.success) {
        const approvals = result.data.map(item => ({
          ...item,
          created_at_formatted: this.formatDate(item.created_at),
          approved_at_formatted: item.approved_at ? this.formatDate(item.approved_at) : '-',
          target_type_label: this.getTargetTypeLabel(item.target_type),
          status_label: this.getStatusLabel(item.status)
        }));

        this.setData({
          approvals: refresh ? approvals : [...this.data.approvals, ...approvals],
          pagination: {
            ...this.data.pagination,
            ...result.pagination
          }
        });
      }
    } catch (error) {
      console.error('加载审核记录失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 切换标签页
   * @param {Object} e - 事件对象
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab,
      approvals: [],
      'pagination.page': 1
    });
    this.loadApprovals(true);
  },

  /**
   * 格式化日期
   * @param {string} dateStr - 日期字符串
   * @returns {string} 格式化后的日期
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  /**
   * 获取审核对象类型标签
   * @param {string} type - 类型
   * @returns {string} 标签文本
   */
  getTargetTypeLabel(type) {
    const typeMap = {
      'event': '活动',
      'announcement': '公告',
      'club': '社团'
    };
    return typeMap[type] || '未知';
  },

  /**
   * 获取审核状态标签
   * @param {string} status - 状态
   * @returns {string} 标签文本
   */
  getStatusLabel(status) {
    const statusMap = {
      'pending': '待审核',
      'approved': '已通过',
      'rejected': '已拒绝'
    };
    return statusMap[status] || '未知';
  },

  /**
   * 加载更多
   */
  onReachBottom() {
    if (this.data.pagination.page < this.data.pagination.totalPages) {
      this.setData({
        'pagination.page': this.data.pagination.page + 1
      });
      this.loadApprovals();
    }
  }
});
