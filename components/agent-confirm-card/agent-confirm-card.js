/**
 * Agent操作确认卡片组件
 * @description 安全护栏的交互层：写操作经用户在本卡片上二次确认后才真正执行。
 * 视觉调性与聊天页统一：柔和渐变点缀 + 毛玻璃质感 + 药丸按钮
 */
Component({
  properties: {
    // 待确认操作 { tool, summary: { title, rows: [{label, value}], contentLabel, content }, resolved }
    action: {
      type: Object,
      value: null
    },
    // 主题渐变（来自聊天页theme.gradient）；页面未传时由 wxml 统一回退到默认渐变
    gradient: {
      type: String
    }
  },
  methods: {
    /** 用户点击确认执行 */
    onConfirm() {
      this.triggerEvent('confirm');
    },
    /** 用户点击取消 */
    onCancel() {
      this.triggerEvent('cancel');
    }
  }
});
