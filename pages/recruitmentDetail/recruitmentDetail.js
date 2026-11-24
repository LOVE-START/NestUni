/**
 * 招新详情页面
 * @description 展示招新详细信息，支持报名操作
 */
const { request, checkAuthStatus, fetchMyClubs } = require('../../utils/api/index');
const { themeManager } = require('../../utils/theme');
const { formatEventDate } = require('../../utils/date');

Page({
  data: {
    statusBarHeight: 0,
    recruitmentId: '',
    recruitment: {
      requirements: [],
      interview_info: null
    },
    canApply: false,
    isLeader: false,
    theme: {}
  },

  onLoad(query) {
    const systemInfo = wx.getSystemInfoSync();
    const theme = themeManager.getCurrentTheme();
    
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      theme
    });

    const id = query.id;
    if (id) {
      this.setData({ recruitmentId: id });
      this.loadRecruitmentDetail(id);
    }
  },

  onShow() {
    if (this.data.recruitmentId) {
      this.loadRecruitmentDetail(this.data.recruitmentId);
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
    this.loadRecruitmentDetail(this.data.recruitmentId).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载招新详情
   * @param {string} id - 招新ID
   */
  async loadRecruitmentDetail(id) {
    try {
      const response = await request({
        url: `/nfunest/api/recruitments/${id}`,
        method: 'GET',
        showLoading: true
      });

      if (response.success) {
        const recruitment = response.data;
        
        // 格式化截止时间
        if (recruitment.end_time) {
          recruitment.end_time = formatEventDate(recruitment.end_time);
        }
        
        // 格式化面试时间
        if (recruitment.interview_info && recruitment.interview_info.time) {
          recruitment.interview_info.time = formatEventDate(recruitment.interview_info.time);
        }
        
        // 判断是否可以报名
        const canApply = !recruitment.hasApplied && 
                        recruitment.statusClass === 'ongoing' &&
                        (!recruitment.max_applicants || recruitment.current_applicants < recruitment.max_applicants);

        this.setData({
          recruitment,
          canApply
        });

        // 检查是否为社长
        this.checkClubLeader(recruitment.club_id);

        wx.setNavigationBarTitle({ title: recruitment.title || '招新详情' });
      }
    } catch (error) {
      console.error('加载招新详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 检查用户是否为该社团社长
   * @param {string} clubId - 社团ID
   */
  async checkClubLeader(clubId) {
    try {
      const userToken = wx.getStorageSync('userToken');
      const userInfo = wx.getStorageSync('userInfo');
      
      if (!userToken || !userInfo) {
        this.setData({ isLeader: false });
        return;
      }

      const response = await fetchMyClubs();
      
      if (response && response.success) {
        const userClubs = response.data || [];
        const isLeader = userClubs.some(club => 
          `${club.id}` === `${clubId}` && club.role === 'leader'
        );
        
        this.setData({ isLeader });
      }
    } catch (error) {
      console.log('检查社长身份失败:', error);
      this.setData({ isLeader: false });
    }
  },

  /**
   * 复制文本
   * @param {Object} e - 事件对象
   */
  /**
   * 复制文本到剪贴板
   * @description 显示详细的复制提示，告知用户复制的内容类型
   * @param {Object} e - 事件对象，包含 dataset.text 和 dataset.label
   */
  copyText(e) {
    const text = e.currentTarget.dataset.text;
    const label = e.currentTarget.dataset.label || '内容';
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: `已复制${label}`,
          icon: 'success'
        });
      }
    });
  },

  /**
   * 预览二维码图片
   * @param {Object} e - 事件对象
   */
  previewQrCode(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: [url]
    });
  },

  /**
   * 预览海报图片
   * @param {Object} e - 事件对象
   */
  previewPoster(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: [url]
    });
  },

  /**
   * 跳转到社团详情
   */
  goToClub() {
    const { recruitment } = this.data;
    if (recruitment.club_id) {
      wx.navigateTo({
        url: `/pages/clubDetail/clubDetail?id=${recruitment.club_id}`
      });
    }
  },

  /**
   * 查看报名列表（会长专用）
   * @description 跳转到报名管理页面查看所有报名
   */
  viewApplications() {
    const { recruitment, recruitmentId } = this.data;
    wx.navigateTo({
      url: `/pages/clubApplications/clubApplications?clubId=${recruitment.club_id}&recruitmentId=${recruitmentId}&title=${encodeURIComponent(recruitment.title || '报名管理')}`
    });
  },

  /**
   * 填写报名（会长测试用）
   * @description 会长也可以填写报名表单，方便测试
   */
  fillApplication() {
    const authStatus = checkAuthStatus();
    if (!authStatus.isLoggedIn) {
      this.promptLoginAndRedirect();
      return;
    }

    const { recruitmentId } = this.data;
    wx.navigateTo({
      url: `/pages/recruitmentForm/recruitmentForm?id=${recruitmentId}`
    });
  },

  /**
   * 报名按钮点击处理（普通用户）
   * @description 普通用户点击后跳转到报名表单
   */
  async apply() {
    const authStatus = checkAuthStatus();
    if (!authStatus.isLoggedIn) {
      this.promptLoginAndRedirect();
      return;
    }

    const { canApply, recruitmentId } = this.data;

    // 检查是否可以报名
    if (!canApply) {
      return;
    }

    // 跳转到报名表单页面
    wx.navigateTo({
      url: `/pages/recruitmentForm/recruitmentForm?id=${recruitmentId}`
    });
  },

  /**
   * 查看我的报名详情
   * @description 已报名用户点击后跳转到报名详情页面
   */
  viewMyApplication() {
    const { recruitment } = this.data;
    if (recruitment.applicationId) {
      wx.navigateTo({
        url: `/pages/applicationDetail/applicationDetail?id=${recruitment.applicationId}`
      });
    } else {
      wx.showToast({
        title: '报名信息不存在',
        icon: 'none'
      });
    }
  },

  /**
   * 提示用户登录并跳转到个人页面
   * @description 未登录时显示提示，然后跳转到 my 页面
   */
  promptLoginAndRedirect() {
    wx.showModal({
      title: '抱歉哦',
      content: '要先登录后再进行报名',
      showCancel: false,
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/my/my'
          });
        }
      }
    });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    const { recruitment } = this.data;
    return {
      title: recruitment.title || '招新报名',
      path: `/pages/recruitmentDetail/recruitmentDetail?id=${this.data.recruitmentId}`,
      imageUrl: recruitment.cover_image
    };
  }
});
