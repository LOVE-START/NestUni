/**
 * 我的报名卡片组件
 * @description 在 my 页面展示用户的报名记录
 */
const { formatEventDateTime } = require('../../utils/date');

/**
 * 名言数组 - 开心简单的名人名言
 */
const QUOTES = [
  { text: 'Be yourself, everyone else is already taken.', author: 'Oscar Wilde' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Someone is glad you exist.', author: 'Steve Jobs' },
  { text: 'Life is what happens when you\'re busy making other plans.', author: 'John Lennon' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
  { text: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'Your time is limited, don\'t waste it living someone else\'s life.', author: 'Steve Jobs' },
  { text: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins' },
  { text: 'Happiness is not something ready made. It comes from your own actions.', author: 'Dalai Lama' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'Everything you\'ve ever wanted is on the other side of fear.', author: 'George Addair' },
  { text: 'We are all broken, that\'s how the light gets in.', author: 'Ernest Hemingway' },
  { text: 'To the world you may be one person, but to one person you may be the world.', author: 'Dr. Seuss' },
  { text: 'Joy is not in things; it is in us.', author: 'Richard Wagner' }
];

Component({
  properties: {
    // 用户报名列表
    applications: {
      type: Array,
      value: [],
      observer: 'formatApplicationsTime'
    },
    // 主题配置
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
    }
  },

  data: {
    // 当前日期
    currentDate: '',
    // 封面图片链接
    coverImage: 'https://wx4.sinaimg.cn/mw690/008AzBLagy1i8d2x860czj30u01t0785.jpg',
    // 波纹效果数组
    ripples: [],
    // 格式化后的报名列表
    formattedApplications: [],
    // 当前显示的名言
    currentQuote: '',
    // 默认报名样式 - 展示"Love Yourself"理念
    defaultApplication: {
      id: 'default',
      recruitment_cover: 'https://c-ssl.duitang.com/uploads/blog/202509/26/5zS3Xz2zSOLOD87.jpeg',
      recruitment_title: 'Be happy now.',
      club_name: 'Love Yourself',
      submitted_at: '',
      status: 'accepted',
      statusText: '已录取',
      isDefault: true
    }
  },

  lifetimes: {
    attached: function() {
      this.setCurrentDate();
      this.loadCoverImage();
      this.selectRandomQuote();
    }
  },

  methods: {
    /**
     * 随机选择一条名言
     */
    selectRandomQuote() {
      const randomIndex = Math.floor(Math.random() * QUOTES.length);
      const quote = QUOTES[randomIndex];
      this.setData({
        currentQuote: quote
      });
    },

    /**
     * 格式化报名列表的时间字段
     * @description 过滤掉 rejected 状态的申请，避免用户看到被拒绝的记录
     * @param {Array} applications - 报名列表数据
     */
    formatApplicationsTime(applications) {
      if (!applications || applications.length === 0) {
        // 没有报名记录时，显示默认报名样式，时间为当前时间
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const defaultApp = {
          ...this.data.defaultApplication,
          submitted_at: `${hours}:${minutes}`
        };
        this.setData({ formattedApplications: [defaultApp] });
        return;
      }
      
      // 过滤掉 rejected 状态的申请（双重保险，后端已过滤）
      const filteredApplications = applications.filter(item => item.status !== 'rejected');
      
      // 如果过滤后没有数据，显示默认卡片
      if (filteredApplications.length === 0) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const defaultApp = {
          ...this.data.defaultApplication,
          submitted_at: `${hours}:${minutes}`
        };
        this.setData({ formattedApplications: [defaultApp] });
        return;
      }
      
      const formatted = filteredApplications.map(item => ({
        ...item,
        submitted_at: formatEventDateTime(item.submitted_at)
      }));
      
      this.setData({ formattedApplications: formatted });
    },

    /**
     * 设置当前日期
     */
    setCurrentDate() {
      const now = new Date();
      const day = now.getDate();
      const month = now.getMonth() + 1;
      const formattedDate = day + '/' + month;
      this.setData({
        currentDate: formattedDate
      });
    },

    /**
     * 加载缓存的封面图片
     */
    loadCoverImage() {
      try {
        const cachedImage = wx.getStorageSync('myApplicationsCoverImage');
        if (cachedImage) {
          this.setData({
            coverImage: cachedImage
          });
        }
      } catch (err) {
        console.error('加载缓存图片失败:', err);
      }
    },

    /**
     * 封面图片点击事件
     */
    onCoverImageTap(e) {
      this.createRipple(e);
      this.selectAndCacheImage();
    },

    /**
     * 创建波纹效果
     */
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

    /**
     * 选择并缓存图片
     */
    selectAndCacheImage() {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePath = res.tempFilePaths[0];
          this.setData({
            coverImage: tempFilePath
          });
          wx.setStorageSync('myApplicationsCoverImage', tempFilePath);
          wx.showToast({ title: '设置成功', icon: 'success' });
        },
        fail: (err) => {
          console.error('选择图片失败:', err);
          wx.showToast({ title: '选择图片失败', icon: 'error' });
        }
      });
    },

    /**
     * 查看报名详情
     * @description 默认卡片（id为'default'）不会跳转
     */
    viewApplicationDetail(e) {
      const id = e.currentTarget.dataset.id;
      // 默认卡片不跳转
      if (id === 'default') {
        return;
      }
      wx.navigateTo({
        url: `/pages/applicationDetail/applicationDetail?id=${id}`
      });
    },

    /**
     * 跳转到我的报名页面
     */
    goToMyApplications() {
      wx.navigateTo({
        url: '/pages/myApplications/myApplications'
      });
    },

    /**
     * 跳转到首页浏览社团
     */
    goToRecruitment() {
      wx.switchTab({
        url: '/pages/home/home'
      });
    }
  }
});
