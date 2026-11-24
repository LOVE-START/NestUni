// 导入主题管理器
const { themeManager } = require('../../utils/theme');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 添加主题样式数据
    themeStyles: {
      gradientStyle: '',
      buttonStyle: '',
      primaryColor: '',
      secondaryColor: ''
    },
    // 控制段落显示的数据
    showParagraph1: false,
    showParagraph2: false,
    showParagraph3: false,
    showParagraph4: false,
    showParagraph5: false,
    showParagraph6: false,
    showParagraph7: false,
    showHighlight: false,
    showSignature: false,
    showDivider: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取并应用主题样式
    this.updateThemeStyles();
    // 开始逐条显示内容
    this.showContentSequentially();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 在页面显示时更新主题样式
    this.updateThemeStyles();
  },

  /**
   * 更新主题样式
   */
  updateThemeStyles: function () {
    const theme = themeManager.getTheme();
    this.setData({
      themeStyles: {
        buttonStyle: theme.gradientButton,
        gradientStyle: theme.gradient,
        primaryColor: theme.colors.primary,
        secondaryColor: theme.colors.secondary
      }
    });
  },

  /**
   * 返回上一页
   */
  goBack: function () {
    wx.navigateBack();
  },

  /**
   * 复制微信号
   */
  copyWechat: function () {
    wx.setClipboardData({
      data: 'Zero__Night',
      success: function() {
        // 静默复制，无需提示
      }
    });
  },

  /**
   * 复制邮箱
   */
  copyEmail: function () {
    wx.setClipboardData({
      data: 'candy_night@163.com',
      success: function() {
        // 静默复制，无需提示
      }
    });
  },

  /**
   * 逐条显示内容
   */
  showContentSequentially: function() {
    const that = this;
    const delay = 600; // 每条内容之间的间隔时间（毫秒）

    // 依次显示各个段落
    setTimeout(() => {
      that.setData({ showParagraph1: true });
    }, delay * 1);

    setTimeout(() => {
      that.setData({ showParagraph2: true });
    }, delay * 2);

    setTimeout(() => {
      that.setData({ showParagraph3: true });
    }, delay * 3);

    setTimeout(() => {
      that.setData({ showParagraph4: true });
    }, delay * 4);

    setTimeout(() => {
      that.setData({ showParagraph5: true });
    }, delay * 5);

    setTimeout(() => {
      that.setData({ showParagraph6: true });
    }, delay * 6);

    setTimeout(() => {
      that.setData({ showParagraph7: true });
    }, delay * 7);

    setTimeout(() => {
      that.setData({ showHighlight: true });
    }, delay * 8);

    setTimeout(() => {
      that.setData({ showSignature: true });
    }, delay * 9);

    setTimeout(() => {
      that.setData({ showDivider: true });
    }, delay * 10);
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: 'Contact Zero Night - NFU Yummy',
      path: '/pages/feedback/feedback',
      imageUrl: '/images/share-cover.jpg' // 可选的自定义分享图片
    };
  }
});