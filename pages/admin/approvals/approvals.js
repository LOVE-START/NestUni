/**
 * 审核管理页面
 * @description 管理员/老师审核活动、公告等
 */

const {
  fetchPendingApprovals,
  fetchApprovalDetail,
  approveApproval,
  rejectApproval,
  fetchApprovalStats,
  requestSubscribeMessage,
  TEMPLATE_IDS
} = require('../../../utils/api/index');

const app = getApp();
const adminAuthBehavior = require('../../../behaviors/adminAuth');
const { formatEventDate } = require('../../../utils/date');

Page({
  behaviors: [adminAuthBehavior],

  data: {
    stats: {
      total: 0,
      event: 0,
      announcement: 0,
      club: 0
    },
    currentTab: 'all',
    approvals: [],
    pagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    },
    // 自定义导航栏状态栏高度（px），用于页头让出系统状态栏
    statusBarHeight: 0,
    loading: false,
    showRejectModal: false,
    rejectForm: {
      approvalId: null,
      rejectReason: ''
    },
    rejectReasonLength: 0,
    detailModal: {
      show: false,
      data: null
    }
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  /**
   * 阻止事件冒泡（空操作）
   */
  preventBubble() {
    // 空操作，仅用于 catchtap 阻止事件冒泡到抽屉遮罩
  },

  /**
   * 页面加载
   */
  onLoad() {
    // 全局使用自定义导航栏，需要自行让出系统状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    });

    // 检查权限并加载数据
    this.checkPermissionWithCallback(() => {
      this.loadStats();
      this.loadApprovals();
    });
  },

  /**
   * 页面显示
   */
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 3
      });
    }
    this.requestPendingAuditSubscription();
  },

  /**
   * 请求待审核提醒订阅
   * @description 老师/管理员进入审核页面时订阅待审核提醒，确保能收到新审核通知
   */
  async requestPendingAuditSubscription() {
    try {
      const templateIds = [TEMPLATE_IDS.PENDING_AUDIT_NOTICE];
      await requestSubscribeMessage(templateIds);
      console.log('已请求待审核提醒订阅');
    } catch (error) {
      console.log('待审核提醒订阅失败或用户拒绝:', error);
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadStats();
    await this.loadApprovals(true);
    wx.stopPullDownRefresh();
  },

  /**
   * 加载统计数据
   */
  async loadStats() {
    try {
      const result = await fetchApprovalStats();
      if (result && result.success) {
        this.setData({
          stats: result.data
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  },

  /**
   * 加载审核列表
   * @param {boolean} refresh - 是否刷新
   */
  async loadApprovals(refresh = false) {
    if (this.data.loading) return;

    const page = refresh ? 1 : this.data.pagination.page;
    const targetType = this.data.currentTab === 'all' ? null : this.data.currentTab;

    this.setData({ loading: true });

    try {
      const result = await fetchPendingApprovals({
        targetType,
        page,
        pageSize: this.data.pagination.pageSize
      });

      if (result && result.success) {
        const approvals = result.data.map(item => ({
          ...item,
          created_at_formatted: this.formatDate(item.created_at),
          target_type_label: this.getTargetTypeLabel(item.target_type),
          target_title: this.getTargetTitle(item)
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
      console.error('加载审核列表失败:', error);
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
   * 查看详情
   * @param {Object} e - 事件对象
   */
  async viewDetail(e) {
    const approvalId = e.currentTarget.dataset.id;
    
    try {
      const result = await fetchApprovalDetail(approvalId);
      if (result && result.success) {
        const detail = result.data;
        this.setData({
          detailModal: {
            show: true,
            data: {
              ...detail,
              created_at_formatted: this.formatDate(detail.created_at),
              target_title: this.getTargetTitle(detail),
              // 活动日期在接口中是 ISO 字符串，展示前统一格式化为 MM.DD,YYYY
              target_date_formatted: detail.target ? formatEventDate(detail.target.date) : ''
            }
          }
        });
      }
    } catch (error) {
      console.error('获取详情失败:', error);
      wx.showToast({
        title: '获取详情失败',
        icon: 'error'
      });
    }
  },

  /**
   * 关闭详情弹窗
   */
  closeDetailModal() {
    this.setData({
      'detailModal.show': false,
      'detailModal.data': null
    });
  },

  /**
   * 审核通过
   * @param {Object} e - 事件对象
   */
  async handleApprove(e) {
    const approvalId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认通过',
      content: '确定要通过此审核吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            const result = await approveApproval(approvalId);
            wx.hideLoading();

            if (result && result.success) {
              wx.showToast({
                title: '审核通过',
                icon: 'success'
              });
              this.loadStats();
              this.loadApprovals(true);
            } else {
              wx.showToast({
                title: result.message || '操作失败',
                icon: 'error'
              });
            }
          } catch (error) {
            wx.hideLoading();
            console.error('审核失败:', error);
            wx.showToast({
              title: '操作失败',
              icon: 'error'
            });
          }
        }
      }
    });
  },

  /**
   * 显示拒绝弹窗
   * @param {Object} e - 事件对象
   */
  showRejectDialog(e) {
    const approvalId = e.currentTarget.dataset.id;
    this.setData({
      showRejectModal: true,
      // 同时关闭详情弹窗，避免两个弹窗重叠
      detailModal: {
        show: false,
        data: null
      },
      rejectForm: {
        approvalId,
        rejectReason: ''
      },
      rejectReasonLength: 0
    });
  },

  /**
   * 输入拒绝原因
   * @param {Object} e - 事件对象
   */
  onRejectReasonInput(e) {
    this.setData({
      'rejectForm.rejectReason': e.detail.value,
      rejectReasonLength: e.detail.value.length
    });
  },

  /**
   * 取消拒绝
   */
  cancelReject() {
    this.setData({
      showRejectModal: false,
      rejectForm: {
        approvalId: null,
        rejectReason: ''
      },
      rejectReasonLength: 0
    });
  },

  /**
   * 确认拒绝
   */
  async confirmReject() {
    const { approvalId, rejectReason } = this.data.rejectForm;

    if (!rejectReason || rejectReason.trim().length === 0) {
      wx.showToast({
        title: '请填写拒绝原因',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '处理中...' });
      const result = await rejectApproval(approvalId, rejectReason);
      wx.hideLoading();

      if (result && result.success) {
        wx.showToast({
          title: '已拒绝',
          icon: 'success'
        });
        this.setData({
          showRejectModal: false,
          rejectForm: {
            approvalId: null,
            rejectReason: ''
          },
          rejectReasonLength: 0
        });
        this.loadStats();
        this.loadApprovals(true);
      } else {
        wx.showToast({
          title: result.message || '操作失败',
          icon: 'error'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('拒绝失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
    }
  },

  /**
   * 格式化日期
   * @param {string} dateStr - 日期字符串
   * @returns {string} 格式化后的日期
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    // 列表与详情空间有限，使用「11月17日 14:30」这种紧凑写法
    return `${month}月${day}日 ${hour}:${minute}`;
  },

  /**
   * 获取审核对象的展示标题
   * @description 社团类审核后端不返回 target，需要用社团名兜底，避免出现「无标题」
   * @param {Object} detail - 审核详情（包含 target、club）
   * @returns {string} 展示标题
   */
  getTargetTitle(detail) {
    if (detail.target) {
      return detail.target.title || detail.target.name || '无标题';
    }
    return (detail.club && detail.club.name) || '无标题';
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
