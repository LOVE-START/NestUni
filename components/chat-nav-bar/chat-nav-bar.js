/**
 * 聊天导航栏组件
 * @description chat（聊天）与 chatHistory（聊天历史）页面共用，保证顶部导航栏的
 * 高度、留白、圆角与操作按钮样式完全一致；标题和操作按钮可通过属性按需开启
 */
Component({
  properties: {
    /** 导航栏背景（主题渐变），由页面传入以便跟随主题切换 */
    gradient: {
      type: String,
      value: ''
    },
    /** 中间标题，为空时不显示标题、仅保留左右平衡布局 */
    title: {
      type: String,
      value: ''
    },
    /** 是否显示"新建对话"操作按钮 */
    showNewChat: {
      type: Boolean,
      value: false
    },
    /** 是否显示"聊天历史"操作按钮 */
    showHistory: {
      type: Boolean,
      value: false
    },
    /** 返回键是否直接回到首页（聊天页需要，历史页保持默认返回上一页） */
    home: {
      type: Boolean,
      value: false
    }
  },

  data: {
    // 手机状态栏高度，用于导航栏顶部留白，避免内容被状态栏遮挡
    statusBarHeight: 0
  },

  lifetimes: {
    /**
     * 组件挂载时读取状态栏高度
     * @description 由组件内部统一读取，页面无需重复获取并传参
     */
    attached() {
      const { statusBarHeight } = wx.getSystemInfoSync();
      this.setData({ statusBarHeight });
    }
  },

  methods: {
    /**
     * 新建对话
     * @description 仅触发事件，具体跳转逻辑交由页面处理
     */
    onNewChat() {
      this.triggerEvent('newchat');
    },

    /**
     * 打开聊天历史
     */
    onHistory() {
      this.triggerEvent('history');
    }
  }
});
