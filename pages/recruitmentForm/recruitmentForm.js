/**
 * 报名表单页面
 * @description 动态表单，根据招新配置显示字段
 */
const { request, checkAuthStatus, requestSubscribeMessage, TEMPLATE_IDS } = require('../../utils/api/index');
const { themeManager } = require('../../utils/theme');

Page({
  data: {
    statusBarHeight: 0,
    recruitmentId: '',
    recruitment: {},
    formData: {},
    submitting: false,
    genderOptions: ['男', '女'],
    gradeOptions: [],
    theme: {},
    // 权限控制
    hasPermission: false,
    permissionChecked: false
  },

  onLoad(query) {
    const systemInfo = wx.getSystemInfoSync();
    const theme = themeManager.getCurrentTheme();
    
    const currentYear = new Date().getFullYear();
    const gradeOptions = [];
    for (let i = 0; i < 5; i++) {
      gradeOptions.push(`${currentYear - i}级`);
    }
    
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      gradeOptions,
      theme
    });

    const id = query.id;
    if (id) {
      this.setData({ recruitmentId: id });
      // 先检查权限，权限通过后再加载数据
      this.checkPermission(id);
    }
  },

  /**
   * 检查用户权限
   * @description 只有登录用户才能填写报名表
   */
  checkPermission(recruitmentId) {
    const authStatus = checkAuthStatus();
    if (!authStatus.isLoggedIn) {
      this.setData({ hasPermission: false, permissionChecked: true });
      return;
    }
    // 已登录，允许访问
    this.setData({ hasPermission: true, permissionChecked: true });
    this.loadRecruitment(recruitmentId);
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
   * 加载招新信息
   * @param {string} id - 招新ID
   */
  async loadRecruitment(id) {
    try {
      const response = await request({
        url: `/nfunest/api/recruitments/${id}`,
        method: 'GET'
      });

      if (response.success) {
        const recruitment = response.data;

        // 初始化表单数据（默认字段）
        const formData = {
          name: '',
          gender: '',
          grade: '',
          major: '',
          contact: '',
          intro: ''
        };

        this.setData({
          recruitment,
          formData
        });
      }
    } catch (error) {
      console.error('加载招新信息失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 输入框变更
   * @param {Object} e - 事件对象
   */
  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`formData.${field}`]: value
    });
  },

  /**
   * 性别选择变更
   * @param {Object} e - 事件对象
   */
  onGenderChange(e) {
    const index = e.detail.value;
    this.setData({
      'formData.gender': this.data.genderOptions[index]
    });
  },

  /**
   * 年级选择变更
   * @param {Object} e - 事件对象
   */
  onGradeChange(e) {
    const index = e.detail.value;
    this.setData({
      'formData.grade': this.data.gradeOptions[index]
    });
  },

  /**
   * 验证表单
   * @returns {boolean} 是否验证通过
   */
  validateForm() {
    const { formData } = this.data;

    if (!formData.name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return false;
    }
    if (!formData.gender) {
      wx.showToast({ title: '请选择性别', icon: 'none' });
      return false;
    }
    if (!formData.grade) {
      wx.showToast({ title: '请选择年级', icon: 'none' });
      return false;
    }
    if (!formData.major) {
      wx.showToast({ title: '请输入专业', icon: 'none' });
      return false;
    }
    if (!formData.contact) {
      wx.showToast({ title: '请输入联系方式', icon: 'none' });
      return false;
    }
    if (!formData.intro) {
      wx.showToast({ title: '请填写自我介绍', icon: 'none' });
      return false;
    }

    return true;
  },

  /**
   * 提交表单
   * @description 提交成功后请求订阅消息授权，用于接收面试通知
   */
  async submitForm() {
    const authStatus = checkAuthStatus();
    if (!authStatus.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    this.setData({ submitting: true });

    try {
      const response = await request({
        url: `/nfunest/api/recruitments/${this.data.recruitmentId}/apply`,
        method: 'POST',
        data: {
          form_data: this.data.formData
        }
      });

      if (response.success) {
        wx.showToast({ title: '报名成功', icon: 'success' });
        
        // 报名成功后请求订阅消息授权（用于接收面试通知）
        try {
          await requestSubscribeMessage([TEMPLATE_IDS.INTERVIEW_NOTICE]);
          console.log('面试通知授权完成');
        } catch (subscribeError) {
          // 授权失败不影响报名结果，只是无法收到通知
          console.log('订阅消息授权失败或用户拒绝:', subscribeError);
        }
        
        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (error) {
      console.error('报名失败:', error);
      wx.showToast({ title: error.message || '报名失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
