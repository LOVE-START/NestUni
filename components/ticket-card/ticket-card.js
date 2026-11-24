const { forceClearAllCache } = require('../../utils/cacheConfig');
const { requestSubscribeMessage, TEMPLATE_IDS } = require('../../utils/api/index');

Component({
  properties: {
    alternative: {
      type: Boolean,
      value: false
    },
    image: {
      type: String,
      value: ''
    },
    nickname: {
      type: String,
      value: ''
    },
    isLoggedIn: {
      type: Boolean,
      value: false
    },
    date: {
      type: String,
      value: ''
    },
    time: {
      type: String,
      value: ''
    },
    seats: {
      type: String,
      value: ''
    },
    studentId: {
      type: String,
      value: ''
    },
    passKey: {
      type: String,
      value: ''
    },
    theme: {
      type: Object,
      value: {
        gradient: '',
        gradientButton: '',
        colors: {
          primary: '',
          secondary: ''
        }
      }
    },
    badges: {
      type: Array,
      value: []
    }
  },

  data: {
    cachedImage: ''
  },

  lifetimes: {
    attached: function() {
      this.loadCachedImage();
    }
  },

  methods: {
    loadCachedImage() {
      try {
        const cachedImage = wx.getStorageSync('ticketCardImage');
        if (cachedImage) {
          this.setData({
            cachedImage: cachedImage
          });
        }
      } catch (err) {
        console.error('加载缓存图片失败:', err);
      }
    },
    
    onNicknameTap() {
      this.triggerEvent('nicknameTap');
    },
    
    onDateTap() {
      this.triggerEvent('dateTap');
    },
    
    onTimeTap() {
      this.triggerEvent('timeTap');
    },
    
    onSeatsTap() {
      this.triggerEvent('seatsTap');
    },
    
    onBarcodeTap() {
      this.triggerEvent('barcodeTap');
    },
    
    /**
     * Student ID 区域点击事件
     * @description 点击学号区域订阅：面试通知、活动提醒、新活动通知（共3个）
     */
    async onStudentIdTap() {
      if (!this.properties.isLoggedIn) {
        wx.showToast({
          title: '请先登录',
          icon: 'none',
          duration: 2000
        });
        this.triggerEvent('studentIdTap');
        return;
      }

      wx.showModal({
        title: '订阅消息通知',
        content: '订阅后将收到：\n• 面试通知\n• 活动开始提醒\n• 新活动通知',
        confirmText: '立即订阅',
        cancelText: '取消',
        success: async (res) => {
          if (res.confirm) {
            try {
              const templateIds = [
                TEMPLATE_IDS.INTERVIEW_NOTICE,
                TEMPLATE_IDS.EVENT_START_REMINDER,
                TEMPLATE_IDS.NEW_EVENT_NOTICE
              ];

              const result = await requestSubscribeMessage(templateIds);

              if (result.success) {
                const allowedTemplates = Object.entries(result.results)
                  .filter(([id, status]) => status === 'accept')
                  .map(([id]) => id);
                
                if (allowedTemplates.length > 0) {
                  wx.showToast({
                    title: `已授权${allowedTemplates.length}项通知`,
                    icon: 'success',
                    duration: 2000
                  });
                } else {
                  wx.showToast({
                    title: '您取消了订阅',
                    icon: 'none',
                    duration: 2000
                  });
                }
              }
            } catch (error) {
              console.log('Student ID 订阅授权:', error);
              wx.showToast({
                title: '订阅失败，请重试',
                icon: 'none',
                duration: 2000
              });
            }
          }
        }
      });
      
      this.triggerEvent('studentIdTap');
    },
    
    /**
     * Pass Key 区域点击事件
     * @description 点击 Pass Key 区域订阅：审核结果通知、待审核提醒、公告通知（共3个）
     */
    async onPassKeyTap() {
      if (!this.properties.isLoggedIn) {
        wx.showToast({
          title: '请先登录',
          icon: 'none',
          duration: 2000
        });
        this.triggerEvent('passKeyTap');
        return;
      }

      wx.showModal({
        title: '订阅消息通知',
        content: '订阅后将收到：\n• 审核结果通知\n• 待审核提醒（老师）\n• 公告通知',
        confirmText: '立即订阅',
        cancelText: '取消',
        success: async (res) => {
          if (res.confirm) {
            try {
              const templateIds = [
                TEMPLATE_IDS.AUDIT_RESULT_NOTICE,
                TEMPLATE_IDS.PENDING_AUDIT_NOTICE,
                TEMPLATE_IDS.ANNOUNCEMENT_NOTICE
              ];

              const result = await requestSubscribeMessage(templateIds);

              if (result.success) {
                const allowedTemplates = Object.entries(result.results)
                  .filter(([id, status]) => status === 'accept')
                  .map(([id]) => id);
                
                if (allowedTemplates.length > 0) {
                  wx.showToast({
                    title: `已授权${allowedTemplates.length}项通知`,
                    icon: 'success',
                    duration: 2000
                  });
                } else {
                  wx.showToast({
                    title: '您取消了订阅',
                    icon: 'none',
                    duration: 2000
                  });
                }
              }
            } catch (error) {
              console.log('Pass Key 订阅授权:', error);
              wx.showToast({
                title: '订阅失败，请重试',
                icon: 'none',
                duration: 2000
              });
            }
          }
        }
      });
      
      this.triggerEvent('passKeyTap');
    },
    
    onBadgeTap() {
      if (this.properties.isLoggedIn) {
        wx.showModal({
          title: '退出登录',
          content: '确定要退出登录吗？',
          confirmText: '确定',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              forceClearAllCache();
              wx.showToast({
                title: '已退出登录',
                icon: 'success'
              });
              this.triggerEvent('logout');
            }
          }
        });
      } else {
        this.triggerEvent('badgeTap');
      }
    },
    
    /**
     * 羽章图标点击事件处理
     * @description 点击羽章图标跳转到羽章页面
     * @param {Object} e - 事件对象，包含 data-badge 数据
     */
    onBadgeIconTap(e) {
      const badge = e.currentTarget.dataset.badge;
      wx.navigateTo({
        url: '/pages/badges/badges'
      });
    },
    
    onImageTap(e) {
      this.createRipple(e);
      this.triggerEvent('imageTap');
    },
    
    createRipple(e) {
      const x = e.detail.x;
      const y = e.detail.y;
      
      const query = wx.createSelectorQuery().in(this);
      query.select('.cover').boundingClientRect(res => {
        if (res) {
          const rippleX = x - res.left;
          const rippleY = y - res.top;
          
          const ripple = {
            x: rippleX,
            y: rippleY,
            id: Date.now()
          };
          
          const ripples = this.data.ripples || [];
          ripples.push(ripple);
          this.setData({
            ripples: ripples
          });
          
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
    
    selectAndCacheImage() {
      return new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: (res) => {
            const tempFilePath = res.tempFilePaths[0];
            
            wx.setStorageSync('ticketCardImage', tempFilePath);
            
            this.setData({
              cachedImage: tempFilePath
            });
            
            wx.showToast({ title: '设置成功', icon: 'success' });
            resolve(tempFilePath);
          },
          fail: (err) => {
            console.error('选择图片失败:', err);
            wx.showToast({ title: '选择图片失败', icon: 'error' });
            reject(err);
          }
        });
      });
    }
  }
});