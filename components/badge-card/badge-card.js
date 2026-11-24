/**
 * 羽章卡片组件
 * @description 展示羽章图标和基本信息
 */
Component({
  properties: {
    badge: {
      type: Object,
      value: {}
    },
    size: {
      type: String,
      value: 'medium'
    },
    showName: {
      type: Boolean,
      value: true
    },
    isLocked: {
      type: Boolean,
      value: false
    },
    isWorn: {
      type: Boolean,
      value: false
    }
  },

  data: {
    rarityColors: {
      common: '#9E9E9E',
      rare: '#2196F3',
      epic: '#9C27B0',
      legendary: '#FFD700'
    },
    rarityNames: {
      common: '普通',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说'
    },
    isTapped: false
  },

  methods: {
    onTap() {
      if (!this.data.isLocked) {
        // 触发点击动画
        this.setData({ isTapped: true });
        
        // 动画结束后触发事件
        setTimeout(() => {
          this.setData({ isTapped: false });
          this.triggerEvent('tap', { badge: this.data.badge });
        }, 300);
      }
    }
  }
});
