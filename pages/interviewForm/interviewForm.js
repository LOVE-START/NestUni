/**
 * 面试表单页面
 * @description 社长填写面试信息，通知申请人参加面试
 */
const { request, checkAuthStatus, fetchMyClubs, requestSubscribeMessage, TEMPLATE_IDS } = require('../../utils/api/index');
const { themeManager } = require('../../utils/theme');

Page({
  data: {
    statusBarHeight: 0,
    applicationId: '',
    interviewForm: {
      interview_time: '',
      interview_time_display: '',
      interview_location: '',
      interview_type: 'offline',
      interview_contact: '',
      interview_notes: ''
    },
    /* 日期时间选择器数据 */
    dateTimePicker: {
      range: [[], [], [], []],
      value: [0, 0, 0, 0]
    },
    theme: {},
    // 权限控制
    hasPermission: false,
    permissionChecked: false
  },

  onLoad(query) {
    const systemInfo = wx.getSystemInfoSync();
    const theme = themeManager.getCurrentTheme();
    
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      theme,
      applicationId: query.id || ''
    });

    // 先检查权限
    this.checkPermission(query.id);
  },

  /**
   * 检查用户权限
   * @description 只有登录用户且有社长权限才能填写面试信息
   */
  async checkPermission(applicationId) {
    const authStatus = checkAuthStatus();
    if (!authStatus.isLoggedIn) {
      this.setData({ hasPermission: false, permissionChecked: true });
      return;
    }

    try {
      // 检查是否是社长
      const response = await fetchMyClubs();
      if (response && response.success && response.data && response.data.length > 0) {
        // 用户是社长，允许访问
        this.setData({ hasPermission: true, permissionChecked: true });
        // 初始化日期时间选择器
        this.initDateTimePicker();
        // 处理传入的面试信息
        this.initInterviewInfo();
      } else {
        this.setData({ hasPermission: false, permissionChecked: true });
      }
    } catch (error) {
      console.error('检查权限失败:', error);
      this.setData({ hasPermission: false, permissionChecked: true });
    }
  },

  /**
   * 初始化面试信息
   * @description 从URL参数初始化面试信息
   */
  initInterviewInfo() {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const query = currentPage.options;
    
    if (query.interview_time) {
      const interviewTime = decodeURIComponent(query.interview_time);
      /* 将ISO格式转换为中文显示格式 */
      let displayTime = interviewTime;
      const isoMatch = interviewTime.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):\d{2}:\d{2}$/);
      if (isoMatch) {
        displayTime = `${isoMatch[1]}年${parseInt(isoMatch[2])}月${parseInt(isoMatch[3])}日 ${parseInt(isoMatch[4])}:00`;
      }
      this.setData({
        'interviewForm.interview_time': interviewTime,
        'interviewForm.interview_time_display': displayTime,
        'interviewForm.interview_location': decodeURIComponent(query.interview_location || ''),
        'interviewForm.interview_type': query.interview_type || 'offline',
        'interviewForm.interview_contact': decodeURIComponent(query.interview_contact || ''),
        'interviewForm.interview_notes': decodeURIComponent(query.interview_notes || '')
      });
    }
  },

  /**
   * 初始化日期时间选择器
   */
  initDateTimePicker() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    
    /* 日期列表 */
    const years = [];
    const months = [];
    const days = [];
    const hours = [];
    
    /* 年份：当前年到后一年 */
    for (let i = year; i <= year + 1; i++) {
      years.push(i + '年');
    }
    
    /* 月份：1-12月 */
    for (let i = 1; i <= 12; i++) {
      months.push(i + '月');
    }
    
    /* 日期：1-31日 */
    for (let i = 1; i <= 31; i++) {
      days.push(i + '日');
    }
    
    /* 小时：8-22点 */
    for (let i = 8; i <= 22; i++) {
      hours.push(i + ':00');
    }
    
    this.setData({
      'dateTimePicker.range': [years, months, days, hours],
      'dateTimePicker.value': [0, month, day - 1, 0]
    });
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
   * 日期时间选择器列变化
   */
  onDateTimeColumnChange(e) {
    const { column, value } = e.detail;
    this.setData({
      [`dateTimePicker.value[${column}]`]: value
    });
  },

  /**
   * 日期时间选择器确认
   */
  onDateTimeChange(e) {
    const val = e.detail.value;
    const range = this.data.dateTimePicker.range;
    
    /* 解析选择的日期时间 */
    const year = parseInt(range[0][val[0]]);
    const month = parseInt(range[1][val[1]]);
    const day = parseInt(range[2][val[2]]);
    const hour = parseInt(range[3][val[3]]);
    
    /* 格式化为ISO标准格式（用于API请求）和显示格式（用于界面展示） */
    const displayDateTime = `${year}年${month}月${day}日 ${hour}:00`;
    const isoDateTime = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:00:00`;
    
    this.setData({
      'interviewForm.interview_time': isoDateTime,
      'interviewForm.interview_time_display': displayDateTime,
      'dateTimePicker.value': val
    });
  },

  /**
   * 表单输入处理
   */
  onInterviewInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`interviewForm.${field}`]: value
    });
  },

  /**
   * 面试类型选择
   */
  onInterviewTypeChange(e) {
    const index = e.detail.value;
    const type = index === 0 ? 'offline' : 'online';
    this.setData({
      'interviewForm.interview_type': type
    });
  },

  /**
   * 提交面试信息
   * @description 更新申请状态并发送面试通知给申请人
   * 注意：订阅消息授权由申请人在报名时完成，社长发送通知时无需授权
   */
  async submitInterview() {
    const { applicationId, interviewForm } = this.data;
    
    /* 表单验证 */
    if (!interviewForm.interview_time) {
      wx.showToast({ title: '请选择面试时间', icon: 'none' });
      return;
    }
    if (!interviewForm.interview_location) {
      wx.showToast({ title: '请填写面试地点', icon: 'none' });
      return;
    }
    
    /* 手机号格式验证 */
    if (interviewForm.interview_contact) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(interviewForm.interview_contact)) {
        wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
        return;
      }
    }

    try {
      wx.showLoading({ title: '发送中...' });
      
      const data = { 
        status: 'interviewing',
        ...interviewForm
      };

      const response = await request({
        url: `/nfunest/api/recruitments/applications/${applicationId}/status`,
        method: 'PUT',
        data
      });

      wx.hideLoading();

      if (response.success) {
        wx.showToast({ title: '已发送通知', icon: 'success' });
        
        /* 延迟返回上一页 */
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (error) {
      wx.hideLoading();
      console.error('提交面试信息失败:', error);
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  }
});
