/**
 * 公共模态框组件
 * @description 提供统一的模态框样式和行为，减少重复代码
 */

const { themeManager } = require('../../utils/theme.js');

Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'apply-shared'
  },

  properties: {
    show: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: ''
    },
    showClose: {
      type: Boolean,
      value: true
    },
    showFooter: {
      type: Boolean,
      value: true
    },
    cancelText: {
      type: String,
      value: '取消'
    },
    confirmText: {
      type: String,
      value: '保存'
    },
    confirmDisabled: {
      type: Boolean,
      value: false
    },
    maxHeight: {
      type: String,
      value: '80vh'
    },
    customClass: {
      type: String,
      value: ''
    },
    fullscreen: {
      type: Boolean,
      value: false
    }
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
    attached() {
      this.updateTheme();
    }
  },

  methods: {
    /**
     * 更新主题样式
     */
    updateTheme() {
      const theme = themeManager.getTheme();
      this.setData({ theme });
    },

    /**
     * 关闭模态框
     */
    onClose() {
      this.triggerEvent('close');
    },

    /**
     * 点击取消按钮
     */
    onCancel() {
      this.triggerEvent('cancel');
    },

    /**
     * 点击确认按钮
     */
    onConfirm() {
      if (!this.data.confirmDisabled) {
        this.triggerEvent('confirm');
      }
    },

    /**
     * 阻止事件冒泡
     */
    stopPropagation() {}
  }
});
