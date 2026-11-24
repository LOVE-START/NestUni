/**
 * 报名详情页面
 * @description 展示报名申请的详细信息和状态，社长可更新状态
 */
const { request, checkAuthStatus, fetchMyClubs, requestSubscribeMessage, TEMPLATE_IDS } = require('../../utils/api/index');
const { themeManager } = require('../../utils/theme');
const { formatEventDateTime } = require('../../utils/date');

Page({
  data: {
    statusBarHeight: 0,
    applicationId: '',
    application: {},
    formData: { basic: [], contact: [], intro: [] },
    statusIconImage: '/images/summary.png', /* 默认状态图标图片 */
    isLeader: false,
    showStatusPicker: false,
    statusOptions: [
      { value: 'viewed', label: '已查看', desc: '已阅读报名信息', icon: '/images/viewed.png' },
      { value: 'interviewing', label: '面试中', desc: '安排面试时间地点', icon: '/images/video.png' },
      { value: 'accepted', label: '已录取', desc: '欢迎加入社团', icon: '/images/people.png' },
      { value: 'rejected', label: '已拒绝', desc: '暂不符合要求', icon: '/images/rejected.png' }
    ],
    theme: {},
    // 权限控制
    hasPermission: false,
    permissionChecked: false,
    // 操作日志
    operationLogs: []
  },

  onLoad(query) {
    const systemInfo = wx.getSystemInfoSync();
    const theme = themeManager.getCurrentTheme();
    
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      theme,
      isLeader: query.isLeader === 'true'
    });

    const id = query.id;
    if (id) {
      this.setData({ applicationId: id });
      // 先检查权限
      this.checkPermission(id, query.isLeader === 'true');
    } else {
      this.setData({ hasPermission: false, permissionChecked: true });
    }
  },

  /**
   * 检查用户权限
   * @description 社长需要验证社长权限，普通用户需要验证登录状态
   * @param {string} applicationId - 报名ID
   * @param {boolean} isLeader - 是否是社长查看
   */
  async checkPermission(applicationId, isLeader) {
    const authStatus = checkAuthStatus();
    if (!authStatus.isLoggedIn) {
      this.setData({ hasPermission: false, permissionChecked: true });
      return;
    }

    if (isLeader) {
      // 社长查看，需要验证社长权限
      try {
        const response = await fetchMyClubs();
        if (response && response.success && response.data && response.data.length > 0) {
          // 用户是社长，允许访问
          this.setData({ hasPermission: true, permissionChecked: true });
          this.loadApplicationDetail(applicationId);
        } else {
          this.setData({ hasPermission: false, permissionChecked: true });
        }
      } catch (error) {
        console.error('检查权限失败:', error);
        this.setData({ hasPermission: false, permissionChecked: true });
      }
    } else {
      // 普通用户查看自己的报名，已登录即可
      this.setData({ hasPermission: true, permissionChecked: true });
      this.loadApplicationDetail(applicationId);
    }
  },

  /**
   * 页面显示时刷新数据
   */
  onShow() {
    if (this.data.applicationId) {
      this.loadApplicationDetail(this.data.applicationId);
    }
  },

  /**
   * 主题变更处理
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
   * 加载报名详情
   * @param {string} id - 报名ID
   */
  async loadApplicationDetail(id) {
    try {
      const response = await request({
        url: `/nfunest/api/recruitments/applications/${id}`,
        method: 'GET'
      });

      console.log('报名详情响应:', response);

      if (response.success) {
        const application = response.data;
        console.log('原始报名数据:', application);
        console.log('form_data:', application.form_data);
        
        /* 格式化提交时间 */
        if (application.submitted_at) {
          application.submitted_at = formatEventDateTime(application.submitted_at);
        }

        /* 格式化面试时间 */
        if (application.interview_time) {
          application.interview_time_display = formatEventDateTime(application.interview_time);
        }

        /* 将表单数据分类整理 */
        const formData = this.formatFormData(application.form_data);
        console.log('分类后的表单数据:', formData);

        /* 根据状态设置图标 */
        const statusIconImageMap = {
          'submitted': '/images/summary.png',
          'viewed': '/images/viewed.png',
          'interviewing': '/images/video.png',
          'accepted': '/images/people.png',
          'rejected': '/images/rejected.png'
        };
        const statusIconImage = statusIconImageMap[application.status] || '/images/summary.png';

        this.setData({
          application,
          formData,
          statusIconImage
        });

        // 加载操作日志
        this.loadOperationLogs(id);
      }
    } catch (error) {
      console.error('加载报名详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 加载操作日志
   * @description 获取报名状态变更的历史记录
   * @param {string} id - 报名ID
   */
  async loadOperationLogs(id) {
    try {
      const response = await request({
        url: `/nfunest/api/recruitments/applications/${id}/logs`,
        method: 'GET'
      });

      if (response.success && response.data) {
        // 格式化日志时间
        const logs = response.data.map(log => ({
          ...log,
          createdAt: formatEventDateTime(log.createdAt)
        }));

        this.setData({ operationLogs: logs });
      }
    } catch (error) {
      console.error('加载操作日志失败:', error);
    }
  },

  /**
   * 格式化表单数据
   * @param {Object} formData - 表单数据对象
   * @returns {Object} 分类后的数据
   */
  formatFormData(formData) {
    if (!formData) return { basic: [], contact: [], intro: [] };

    const labelMap = {
      name: '姓名',
      gender: '性别',
      grade: '年级',
      major: '专业',
      class: '班级',
      contact: '联系方式',
      phone: '联系电话',
      wechat: '微信号',
      intro: '自我介绍',
      skills: '技能/特长',
      works: '作品链接',
      experience: '相关经历',
      reason: '报名理由'
    };

    const basicKeys = ['name', 'gender', 'grade', 'major', 'class'];
    const contactKeys = ['contact', 'phone', 'wechat'];
    const introKeys = ['intro', 'skills', 'works', 'experience', 'reason'];

    const formatItem = (key) => ({
      key,
      label: labelMap[key] || key,
      value: formData[key]
    });

    return {
      basic: basicKeys.filter(key => formData[key]).map(formatItem),
      contact: contactKeys.filter(key => formData[key]).map(formatItem),
      intro: introKeys.filter(key => formData[key]).map(formatItem)
    };
  },

  /**
   * 跳转到招新详情
   */
  goToRecruitment() {
    const { application } = this.data;
    if (application.recruitment_id) {
      wx.navigateTo({
        url: `/pages/recruitmentDetail/recruitmentDetail?id=${application.recruitment_id}`
      });
    }
  },

  /**
   * 加入社团
   */
  async joinClub() {
    const { application } = this.data;
    
    if (!application.club_id) {
      wx.showToast({ title: '社团信息不存在', icon: 'none' });
      return;
    }
    
    try {
      const response = await request({
        url: `/nfunest/api/clubs/${application.club_id}/join`,
        method: 'POST'
      });

      if (response.success) {
        wx.showToast({ title: '加入成功', icon: 'success' });
        this.requestNewEventSubscription();
      } else {
        wx.showToast({ title: response.error || '加入失败', icon: 'none' });
      }
    } catch (error) {
      console.error('加入社团失败:', error);
      const errorMsg = error.data?.error || error.message || '加入失败';
      wx.showToast({ title: errorMsg, icon: 'none' });
    }
  },

  /**
   * 请求新活动通知订阅
   * @description 加入社团后请求用户订阅新活动通知，确保能收到社团新活动通知
   */
  async requestNewEventSubscription() {
    try {
      const templateIds = [TEMPLATE_IDS.NEW_EVENT_NOTICE];
      await requestSubscribeMessage(templateIds);
      console.log('已请求新活动通知订阅');
    } catch (error) {
      console.log('新活动通知订阅失败或用户拒绝:', error);
    }
  },

  /**
   * 显示状态选择器
   */
  showStatusPicker() {
    this.setData({ showStatusPicker: true });
  },

  /**
   * 隐藏状态选择器
   */
  hideStatusPicker() {
    this.setData({ showStatusPicker: false });
  },

  /**
   * 选择状态
   */
  onStatusSelect(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ showStatusPicker: false });

    if (status === 'interviewing') {
      /* 面试中需要填写面试信息，跳转到面试表单页面 */
      this.goToInterviewForm();
    } else {
      this.updateStatus(status);
    }
  },

  /**
   * 跳转到面试表单页面
   */
  goToInterviewForm() {
    const { applicationId, application } = this.data;
    const params = [
      `id=${applicationId}`,
      `interview_time=${encodeURIComponent(application.interview_time || '')}`,
      `interview_location=${encodeURIComponent(application.interview_location || '')}`,
      `interview_type=${application.interview_type || 'offline'}`,
      `interview_contact=${encodeURIComponent(application.interview_contact || '')}`,
      `interview_notes=${encodeURIComponent(application.interview_notes || '')}`
    ].join('&');
    
    wx.navigateTo({
      url: `/pages/interviewForm/interviewForm?${params}`
    });
  },

  /**
   * 更新报名状态
   * @param {string} status - 新状态
   */
  async updateStatus(status) {
    const { applicationId } = this.data;
    
    try {
      const response = await request({
        url: `/nfunest/api/recruitments/applications/${applicationId}/status`,
        method: 'PUT',
        data: { status }
      });

      if (response.success) {
        wx.showToast({ title: '状态已更新', icon: 'success' });
        this.loadApplicationDetail(applicationId);
      }
    } catch (error) {
      console.error('更新状态失败:', error);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  /**
   * 快速标记为已查看
   */
  async markAsViewed() {
    await this.updateStatus('viewed');
  },

  /**
   * 快速录取
   */
  async quickAccept() {
    wx.showModal({
      title: '确认录取',
      content: '确定录取该申请人吗？',
      success: async (res) => {
        if (res.confirm) {
          await this.updateStatus('accepted');
        }
      }
    });
  },

  /**
   * 快速拒绝
   */
  async quickReject() {
    wx.showModal({
      title: '确认拒绝',
      content: '确定拒绝该申请人吗？',
      success: async (res) => {
        if (res.confirm) {
          await this.updateStatus('rejected');
        }
      }
    });
  },

  /**
   * 复制文本到剪贴板
   * @param {Object} e - 事件对象
   */
  copyText(e) {
    const text = e.currentTarget.dataset.text;
    if (!text) return;
    
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '已复制联系方式',
          icon: 'success'
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  }
});
