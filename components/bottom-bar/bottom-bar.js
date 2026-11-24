// 引入主题管理模块
const { themeManager } = require('../../utils/theme');

Component({
  properties: {
    active: {
      type: String,
      value: "home"
    }
  },

  data: {
    list: [{
      key: "home",
      text: "首页",
      iconPath: "/images/home1.png"
    }, {
      key: "events",
      text: "活动",
      iconPath: "/images/home2.png"
    }, {
      key: "my",
      text: "我的",
      iconPath: "/images/home3.png"
    }],
    themeStyles: {
      gradient: '',
      gradientButton: '',
      primaryColor: '',
      secondaryColor: ''
    }
  },

  lifetimes: {
    attached() {
      // 初始化主题
      this.initTheme();
    }
  },

  methods: {
    // 初始化主题
    initTheme() {
      try {
        const theme = themeManager.getCurrentTheme();
        this.setData({
          themeStyles: {
            gradient: theme.gradient,
            gradientButton: theme.gradientButton,
            primaryColor: theme.colors?.primary || "#1f1b17",
            secondaryColor: theme.colors?.secondary || "#1f1b17"
          }
        });
      } catch (error) {
        console.error('初始化底部导航栏主题失败:', error);
      }
    },

    onTap(e) {
      const key = e.currentTarget.dataset.key;
      const current = this.data.active;

      if (key === current) {
        console.log('✅ Already on this page, skip navigation');
        return;
      }

      let url = '';
      switch (key) {
        case 'home':
          url = '/pages/home/home';
          break;
        case 'events':
          url = '/pages/activities/activities';
          break;
        case 'my':
          url = '/pages/my/my';
          break;
        default:
          console.error('❌ Unknown tab key:', key);
          return;
      }

      console.log(`📍 Navigate to: ${url}`);

      // 使用 reLaunch 代替 switchTab
      wx.reLaunch({ url });
    }
  }
});