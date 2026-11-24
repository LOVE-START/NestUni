const { themeManager } = require('../../utils/theme.js');

Component({
  options: {
    multipleSlots: true // 在组件定义时的选项中启用多slot支持
  },
  
  properties: {
    // 这里可以定义一些属性
  },
  
  data: {
    theme: {
      gradient: '',
      gradientButton: '',
      colors: {
        primary: '',
        secondary: ''
      }
    }
  },
  
  lifetimes: {
    attached: function() {
      // 组件实例进入页面节点树时执行
      this.initTheme();
    }
  },
  
  methods: {
    initTheme: function() {
      // 初始化主题
      const theme = themeManager.getCurrentTheme();
      
      this.setData({
        theme: theme
      });
      
      // 触发自定义事件，向父组件传递主题数据
      this.triggerEvent('themeChange', { theme: theme });
    }
  }
});