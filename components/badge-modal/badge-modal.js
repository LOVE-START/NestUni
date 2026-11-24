/**
 * 羽章详情弹窗组件
 * @description 暗色沉浸式设计，展示羽章大图、名称、描述、奖励等信息，支持佩戴功能
 */
const { formatEventDate } = require('../../utils/date');

Component({
  properties: {
    show: { type: Boolean, value: false },
    badge: { type: Object, value: {} },
    badgeList: { type: Array, value: [] },
    isWorn: { type: Boolean, value: false },
    displayedCount: { type: Number, value: 0 },
    maxDisplay: { type: Number, value: 2 }
  },

  data: {
    formattedDate: ''
  },

  observers: {
    'badge.earned_at': function(earnedAt) {
      if (earnedAt) {
        this.setData({ formattedDate: formatEventDate(earnedAt) });
      } else {
        this.setData({ formattedDate: '' });
      }
    }
  },

  methods: {
    /** 关闭弹窗 */
    onClose() {
      this.triggerEvent('close');
    },

    /** 切换查看其他羽章 */
    onSwitchBadge(e) {
      const id = e.currentTarget.dataset.id;
      if (id !== this.data.badge.id) {
        this.triggerEvent('switch', { id });
      }
    },

    /** 领取奖励 */
    onClaimReward() {
      this.triggerEvent('claim', { badge: this.data.badge });
    },

    /**
     * 佩戴/取消佩戴羽章
     * @description 最多同时佩戴maxDisplay个羽章
     */
    onToggleWear() {
      const { badge, isWorn, displayedCount, maxDisplay } = this.data;

      if (isWorn) {
        this.triggerEvent('unwear', { badge });
      } else {
        if (displayedCount >= maxDisplay) {
          wx.showToast({
            title: `最多同时佩戴${maxDisplay}个羽章`,
            icon: 'none'
          });
          return;
        }
        this.triggerEvent('wear', { badge });
      }
    }
  }
});
