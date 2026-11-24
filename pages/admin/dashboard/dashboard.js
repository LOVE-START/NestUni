const { getAdminStats, clearAdminSession, fetchApprovalStats, bindAdminWechat, getAdminProfile, unbindAdminWechat } = require("../../../utils/api/index");
const adminAuthBehavior = require("../../../behaviors/adminAuth");

// 权限等级 → 中文角色名（与后端 admins.level 枚举保持一致）
const ROLE_LABELS = {
  super: '超级管理员',
  moderator: '普通管理员',
  teacher: '教师'
};

/**
 * 管理功能入口配置
 * @description 页面内统一渲染为列表行，后续新增模块只需在此追加一项
 */
const MODULES = [
  { key: 'clubs', name: '社团管理', desc: '浏览与维护社团资料', glyph: '社', route: '/pages/admin/clubs/clubs' },
  { key: 'events', name: '活动管理', desc: '发布与维护校园活动', glyph: '活', route: '/pages/admin/events/events' },
  { key: 'announcements', name: '公告管理', desc: '发布面向全校的公告', glyph: '公', route: '/pages/admin/announcements/announcements' },
  { key: 'badges', name: '羽章管理', desc: '管理羽章与发放记录', glyph: '章', route: '/pages/admin/badges/badges' },
  { key: 'approvals', name: '审核中心', desc: '处理待审核的活动与公告', glyph: '审', route: '/pages/admin/approvals/approvals' },
  { key: 'ai', name: 'AI 助手', desc: '智能问答与数据查询', glyph: 'AI', latin: true, accent: true, route: '/pages/admin/adminChat/adminChat' }
];

/**
 * 生成页头日期文案
 * @returns {string} 形如「11月17日 · 周一」
 */
function formatTodayLabel() {
  const now = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${now.getMonth() + 1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`;
}

Page({
  behaviors: [adminAuthBehavior],

  data: {
    // 统计数据
    stats: {
      totalClubs: 0,
      totalEvents: 0,
      totalUsers: 0
    },
    // 统计数据是否已成功加载（未完成时展示占位符，避免把 0 误当真实数据）
    statsReady: false,
    // 待审核数量
    pendingApprovals: 0,
    // 管理员信息
    adminInfo: {
      level: ''
    },
    // 角色中文名，用于页头展示
    roleLabel: '',
    // 微信绑定状态
    hasWechatBind: false,
    // 自定义导航栏状态栏高度（px）
    statusBarHeight: 0,
    // 页头日期文案
    todayLabel: '',
    // 管理功能入口
    modules: MODULES
  },

  onLoad() {
    // 全局使用自定义导航栏，需要自行让出系统状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20,
      todayLabel: formatTodayLabel()
    });

    // 检查权限并加载数据
    this.checkPermissionWithCallback(() => {
      this.loadStats();
      this.loadAdminProfile();
    });
  },

  // 获取统计数据
  async loadStats() {
    try {
      // 管理员页面直接请求最新数据，不使用缓存
      const [statsResult, approvalResult] = await Promise.all([
        getAdminStats(),
        fetchApprovalStats()
      ]);

      if (statsResult && statsResult.success) {
        this.setData({
          stats: statsResult.data.overview,
          statsReady: true
        });
      } else {
        throw new Error('获取数据失败');
      }

      if (approvalResult && approvalResult.success) {
        this.setData({
          pendingApprovals: approvalResult.data.total
        });
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
      wx.showToast({ title: '获取统计数据失败', icon: 'none' });
    }
  },

  /**
   * 获取管理员信息（包含绑定状态）
   */
  async loadAdminProfile() {
    try {
      const result = await getAdminProfile();
      if (result && result.success) {
        this.setData({
          adminInfo: result.data,
          roleLabel: ROLE_LABELS[result.data.level] || '管理员',
          hasWechatBind: result.data.hasWechatBind
        });
      }
    } catch (error) {
      console.error('获取管理员信息失败:', error);
    }
  },

  /**
   * 处理微信绑定/解绑
   */
  async handleWechatBind() {
    const { hasWechatBind } = this.data;

    if (hasWechatBind) {
      // 解绑操作
      wx.showModal({
        title: '确认解绑',
        content: '解绑后将无法接收审核通知提醒，确定要解绑吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              wx.showLoading({ title: '解绑中...' });
              const result = await unbindAdminWechat();
              wx.hideLoading();

              if (result && result.success) {
                this.setData({ hasWechatBind: false });
                wx.showToast({ title: '解绑成功', icon: 'success' });
              } else {
                wx.showToast({ title: result.message || '解绑失败', icon: 'none' });
              }
            } catch (error) {
              wx.hideLoading();
              console.error('解绑失败:', error);
              wx.showToast({ title: '解绑失败', icon: 'none' });
            }
          }
        }
      });
    } else {
      // 绑定操作
      try {
        wx.showLoading({ title: '绑定中...' });
        const result = await bindAdminWechat();
        wx.hideLoading();

        if (result && result.success) {
          this.setData({ hasWechatBind: true });
          wx.showToast({ title: '绑定成功', icon: 'success' });
        } else {
          wx.showToast({ title: result.message || '绑定失败', icon: 'none' });
        }
      } catch (error) {
        wx.hideLoading();
        console.error('绑定失败:', error);
        wx.showToast({ title: '绑定失败', icon: 'none' });
      }
    }
  },

  /**
   * 管理功能入口点击
   * @description 通过 data-key 匹配 MODULES 中的路由，避免为每个入口单独写方法
   * @param {Object} e - 事件对象
   */
  onModuleTap(e) {
    const { key } = e.currentTarget.dataset;
    const target = MODULES.find(item => item.key === key);
    if (!target) return;

    wx.navigateTo({
      url: target.route
    });
  },

  // 跳转到审核管理页面
  goToApprovals() {
    wx.navigateTo({
      url: '/pages/admin/approvals/approvals'
    });
  },

  // 登出功能
  logout() {
    wx.showModal({
      title: "确认退出",
      content: "确定要退出管理员后台吗？",
      success: (res) => {
        if (res.confirm) {
          // 清除管理员token和信息
          clearAdminSession();
          // 跳转到首页
          wx.reLaunch({
            url: "/pages/home/home"
          });
        }
      }
    });
  }
});
