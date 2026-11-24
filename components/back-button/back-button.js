Component({
  options: {
    multipleSlots: true
  },
  properties: {
    /**
     * 是否使用固定定位
     * @type {Boolean}
     * @default true
     */
    fixed: {
      type: Boolean,
      value: true
    },
    /**
     * 是否使用绝对定位（覆盖在封面等定位父容器内），优先级高于 fixed
     * @type {Boolean}
     * @default false
     */
    absolute: {
      type: Boolean,
      value: false
    },
    /**
     * 是否使用白色实心圆底样式（适合图片封面等复杂背景）
     * @type {Boolean}
     * @default false
     */
    solid: {
      type: Boolean,
      value: false
    },
    /**
     * 是否返回首页
     * @type {Boolean}
     * @default false
     */
    home: {
      type: Boolean,
      value: false
    },
    /**
     * 是否交由页面处理返回（仅派发 back 事件，组件内不执行跳转）
     * @description 页面需要在返回前做资源清理或自定义兜底跳转时开启
     * @type {Boolean}
     * @default false
     */
    customBack: {
      type: Boolean,
      value: false
    }
  },
  data: {},
  methods: {
    /**
     * 返回上一页或首页
     * @description 根据 home / customBack 属性决定返回首页、派发事件还是返回上一页
     */
    goBack() {
      if (this.properties.customBack) {
        this.triggerEvent('back');
        return;
      }
      if (this.properties.home) {
        wx.reLaunch({
          url: '/pages/home/home'
        });
      } else {
        wx.navigateBack({
          delta: 1
        });
      }
    }
  }
});
