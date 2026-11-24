// 引入日期格式化工具函数
const { formatEventDate } = require('../../utils/date.js');

Component({
  properties: {
    // 用户加入的社团列表
    clubs: {
      type: Array,
      value: []
    },
    // 用户参与的活动列表
    events: {
      type: Array,
      value: [],
      observer: function(newVal) {
        // 当events属性变化时，格式化日期
        this.formatEventsDate(newVal);
      }
    }
  },

  data: {
    // 当前显示的标签页（clubs 或 events）
    currentTab: 'clubs',
    // 当前日期
    currentDate: '',
    // 格式化后的活动列表
    formattedEvents: [],
    // 封面图片链接
    coverImage: 'https://wx1.sinaimg.cn/mw690/006DQ7BVly1ibeq3qxjc7j310o27o7kf.jpg'
  },

  lifetimes: {
    attached: function() {
      // 组件实例进入页面节点树时执行
      this.setCurrentDate();
      // 格式化活动日期
      this.formatEventsDate(this.data.events);
      // 加载缓存的封面图片
      this.loadCoverImage();
    }
  },

  methods: {
    // 设置当前日期
    setCurrentDate() {
      const now = new Date();
      const day = now.getDate();
      const month = now.getMonth() + 1;
      
      // 格式化日期为 "DD/MM" 格式
      const formattedDate = day + '/' + month;
      
      this.setData({
        currentDate: formattedDate
      });
    },

    // 格式化活动日期
    formatEventsDate(events) {
      if (!Array.isArray(events)) return;
      
      const formattedEvents = events.map(event => {
        return {
          ...event,
          formattedDate: formatEventDate(event.date)
        };
      });
      
      this.setData({
        formattedEvents: formattedEvents
      });
    },

    // 切换标签页
    switchTab(e) {
      const tab = e.currentTarget.dataset.tab;
      this.setData({
        currentTab: tab
      });
    },

    // 查看社团详情
    viewClubDetail(e) {
      const clubId = e.currentTarget.dataset.id;
      wx.navigateTo({
        url: `/pages/clubDetail/clubDetail?id=${clubId}`
      });
    },

    // 查看活动详情
    viewEventDetail(e) {
      const eventId = e.currentTarget.dataset.id;
      wx.navigateTo({
        url: `/pages/activitiesDetail/activitiesDetail?id=${eventId}`
      });
    },

    // 加载缓存的封面图片
    loadCoverImage() {
      try {
        const cachedImage = wx.getStorageSync('clubsEventsCoverImage');
        if (cachedImage) {
          this.setData({
            coverImage: cachedImage
          });
        }
      } catch (err) {
        console.error('加载缓存图片失败:', err);
      }
    },

    // 封面图片点击事件
    onCoverImageTap(e) {
      // 创建波纹效果
      this.createRipple(e);
      // 选择并缓存图片（不上传到服务器）
      this.selectAndCacheImage();
    },

    // 创建波纹效果
    createRipple(e) {
      // 获取点击位置
      const x = e.detail.x;
      const y = e.detail.y;
      
      // 获取封面图片的位置和尺寸
      const query = wx.createSelectorQuery().in(this);
      query.select('.cover').boundingClientRect(res => {
        if (res) {
          // 计算相对于封面图片的点击位置
          const rippleX = x - res.left;
          const rippleY = y - res.top;
          
          // 创建波纹元素
          const ripple = {
            x: rippleX,
            y: rippleY,
            id: Date.now() // 用于唯一标识
          };
          
          // 添加波纹到页面数据
          const ripples = this.data.ripples || [];
          ripples.push(ripple);
          this.setData({
            ripples: ripples
          });
          
          // 600ms后移除波纹
          setTimeout(() => {
            const newRipples = this.data.ripples.filter(r => r.id !== ripple.id);
            this.setData({
              ripples: newRipples
            });
          }, 600);
        }
      });
      query.exec();
    },

    // 选择并缓存图片（不上传到服务器）
    selectAndCacheImage() {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePath = res.tempFilePaths[0];
          
          // 直接使用本地图片路径，不上传到服务器
          this.setData({
            coverImage: tempFilePath
          });
          
          // 保存到缓存
          wx.setStorageSync('clubsEventsCoverImage', tempFilePath);
          
          wx.showToast({ title: '设置成功', icon: 'success' });
        },
        fail: (err) => {
          console.error('选择图片失败:', err);
          wx.showToast({ title: '选择图片失败', icon: 'error' });
        }
      });
    }
  }
});