Page({
  data: {
    // 用户信息
    userInfo: {
      id: '',
      nickname: '',
      avatar: '',
      student_id: '',
      wechat: '',
      role: ''
    },
    
    // 页面状态
    isLoggedIn: false,
    
    // 登录表单数据
    studentId: '',
    wechat: '',
    
    // 当前日期和时间
    currentDate: '',
    currentTime: '',
    
    // 随机生成的座位号和通行证密钥
    randomSeats: '',
    randomPassKey: '',
    
    // 登录弹窗显示状态
    showLoginModal: false,
    
    // 当前票卡索引
    currentTicketIndex: 0,
    
    // 操作按钮显示状态（用于淡入淡出动画）
    showActions: true,
    
    // 用户加入的社团和活动
    userClubs: [],
    userEvents: [],
    
    // 用户报名记录
    userApplications: [],
    
    // 用户羽章
    userBadges: [],
    
    // 个人资料图片
    profileImage: 'https://s3.bmp.ovh/imgs/2025/11/04/59671331f3895264.png',
    
    // 主题数据
    theme: {},
    
    // 解密游戏相关数据
    showAdminButton: false, // 默认隐藏管理员按钮
    decryptionSequence: ['nickname', 'date', 'time', 'seats', 'barcode', 'barcode'], // 解密顺序
    currentSequenceIndex: 0, // 当前步骤索引
    clickedElements: [], // 已点击的元素记录
    decryptionSuccess: false, // 是否解密成功
    
    // 背景图片数组
    backgroundImages: [
      'https://c-ssl.duitang.com/uploads/item/202003/18/20200318003022_zeuwn.jpg',
      'https://c-ssl.duitang.com/uploads/item/202003/18/20200318003019_pulnp.jpg',
      'https://c-ssl.duitang.com/uploads/item/202003/18/20200318003013_tuvnm.jpg'
    ],
    
    // 当前背景图片
    currentBackgroundImage: ''
  },

  onLoad() {
    // 设置当前日期和时间
    this.setCurrentDateTime();
    
    // 生成随机座位号和通行证密钥
    this.generateRandomValues();
    
    // 页面加载时检查登录状态
    this.checkLoginStatus();
    
    // 加载缓存的个人资料图片
    this.loadProfileImage();
    
    // 初始化主题
    this.initTheme();
    
    // 随机选择背景图片
    this.selectRandomBackground();
    
    // 初始化解密游戏数据
    this.setData({
      showAdminButton: false,
      currentSequenceIndex: 0,
      clickedElements: [],
      decryptionSuccess: false
    });
  },

  onShow() {
    // 页面显示时检查登录状态并加载用户信息
    this.checkLoginStatus();
    if (this.data.isLoggedIn) {
      this.loadUserInfo();
      // 加载用户加入的社团和活动
      this.loadUserClubsAndEvents();
      // 加载用户报名记录
      this.loadUserApplications();
      // 加载用户羽章
      this.loadUserBadges();
    }
    
    // 更新主题
    this.updateTheme();
  },

  // 启用下拉刷新
  onPullDownRefresh() {
    if (this.data.isLoggedIn) {
      // 刷新用户信息和社团活动数据
      this.loadUserInfo();
      Promise.all([
        this.loadUserClubsAndEvents(),
        this.loadUserApplications()
      ]).finally(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      wx.stopPullDownRefresh();
    }
  },

  // 主题变更处理函数
  onThemeChange(e) {
    const theme = e.detail.theme;
    this.setData({ theme });
  },

  // 初始化主题
  initTheme() {
    try {
      const themeManager = require('../../utils/theme.js').themeManager;
      const theme = themeManager.getCurrentTheme();
      this.setData({ theme });
    } catch (e) {
      console.error('初始化主题失败:', e);
    }
  },

  // 更新主题
  updateTheme() {
    try {
      const themeManager = require('../../utils/theme.js').themeManager;
      const theme = themeManager.getCurrentTheme();
      this.setData({ theme });
    } catch (e) {
      console.error('更新主题失败:', e);
    }
  },

  // 随机选择背景图片
  selectRandomBackground() {
    const backgroundImages = this.data.backgroundImages;
    const randomIndex = Math.floor(Math.random() * backgroundImages.length);
    const selectedImage = backgroundImages[randomIndex];
    
    this.setData({
      currentBackgroundImage: selectedImage
    });
  },

  /**
   * 解密游戏：处理点击步骤
   * @description 按顺序点击元素，第3步正确时显示emoji提示，错误时重置
   */
  handleDecryptionStep(element) {
    if (this.data.decryptionSuccess) return;
    
    const { decryptionSequence, currentSequenceIndex, clickedElements } = this.data;
    
    if (decryptionSequence[currentSequenceIndex] === element) {
      const newClickedElements = [...clickedElements, element];
      const nextIndex = currentSequenceIndex + 1;
      
      this.setData({
        currentSequenceIndex: nextIndex,
        clickedElements: newClickedElements
      });
      
      // 第3步正确时显示emoji提示
      if (nextIndex === 3) {
        wx.showToast({
          title: '✨ 道路正确 ✨',
          icon: 'none',
          duration: 1500
        });
      }
      
      // 完成所有步骤，解密成功
      if (nextIndex === decryptionSequence.length) {
        this.setData({
          decryptionSuccess: true,
          showAdminButton: true
        });
        wx.showToast({
          title: '🎉 解密成功！',
          icon: 'none',
          duration: 2000
        });
      }
    } else {
      // 错误步骤，重置到第一步
      this.setData({
        currentSequenceIndex: 0,
        clickedElements: []
      });
    }
  },

  // 点击名字触发解密
  onNicknameTap() {
    this.handleDecryptionStep('nickname');
  },

  // 点击日期触发解密
  onDateTap() {
    this.handleDecryptionStep('date');
  },

  // 点击时间触发解密
  onTimeTap() {
    this.handleDecryptionStep('time');
  },

  // 点击座位号触发解密
  onSeatsTap() {
    this.handleDecryptionStep('seats');
  },

  // 点击条形码触发解密
  onBarcodeTap() {
    this.handleDecryptionStep('barcode');
  },

  // 生成随机座位号和通行证密钥
  generateRandomValues() {
    // 生成随机座位号，格式为大写字母+数字，例如 G10, G11
    const generateRandomSeat = () => {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const randomLetter = letters.charAt(Math.floor(Math.random() * letters.length));
      const randomNumber = Math.floor(Math.random() * 20) + 1; // 1-20之间的数字
      return randomLetter + randomNumber;
    };
    
    // 生成两个随机座位号
    const seat1 = generateRandomSeat();
    const seat2 = generateRandomSeat();
    const randomSeats = seat1 + ', ' + seat2;
    
    // 生成6位随机数字作为通行证密钥
    const randomPassKey = Math.floor(100000 + Math.random() * 900000).toString();
    
    this.setData({
      randomSeats: randomSeats,
      randomPassKey: randomPassKey
    });
  },

  // 设置当前日期和时间
  setCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    
    // 格式化日期为 "20 Nov" 格式
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = day + ' ' + monthNames[month - 1];
    
    // 格式化时间为 "HH:MM" 格式
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const formattedTime = hours + ':' + minutes;
    
    this.setData({
      currentDate: formattedDate,
      currentTime: formattedTime
    });
  },

  // 检查登录状态
  checkLoginStatus() {
    // 修复：使用正确的token键名
    const userToken = wx.getStorageSync('userToken');
    const adminToken = wx.getStorageSync('adminToken');
    const userInfo = wx.getStorageSync('userInfo');
    const adminInfo = wx.getStorageSync('admininfo');
    
    if ((userToken && userInfo) || (adminToken && adminInfo)) {
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo || adminInfo
      });
    } else {
      // 如果未登录，不跳转到首页，而是留在当前页面等待用户点击头像登录
      this.setData({
        isLoggedIn: false,
        userInfo: {
          id: '',
          nickname: '',
          avatar: '',
          student_id: '',
          wechat: '',
          role: ''
        }
      });
    }
  },

  // 加载用户信息 - 直接从服务器获取，不使用缓存
  async loadUserInfo() {
    try {
      // 直接向服务器发送请求获取最新用户信息
      console.log('向服务器请求用户信息');
      const api = require('../../utils/api/index');
      const res = await api.fetchUserProfile();
      
      if (res && res.success && res.data) {
        // 更新用户信息
        this.setData({
          userInfo: res.data
        });
        
        // 更新本地存储
        wx.setStorageSync('userInfo', res.data);
      }
    } catch (err) {
      console.error('获取用户信息失败:', err);
      wx.showToast({ title: '获取用户信息失败', icon: 'error' });
    }
  },

  // 加载用户加入的社团和活动 - 直接从服务器获取，不使用缓存
  async loadUserClubsAndEvents() {
    try {
      const api = require('../../utils/api/index');
      
      // 显示加载提示
      wx.showLoading({ title: '加载中...' });
      
      // 并行获取用户加入的社团和参与的活动
      const [clubsRes, eventsRes] = await Promise.all([
        api.fetchMyClubs(),
        api.fetchMyEvents()
      ]);
      
      // 处理社团数据
      let clubs = [];
      if (clubsRes && clubsRes.success && clubsRes.data) {
        clubs = clubsRes.data.slice(0, 3); // 只取前3个社团
      }
      
      // 处理活动数据
      let events = [];
      if (eventsRes && eventsRes.success && eventsRes.data) {
        events = eventsRes.data.slice(0, 3); // 只取前3个活动
      }
      
      // 更新页面数据
      this.setData({
        userClubs: clubs,
        userEvents: events
      });
      
      wx.hideLoading();
    } catch (err) {
      console.error('获取用户社团和活动失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '获取社团活动失败', icon: 'error' });
    }
  },

  /**
   * 加载用户报名记录
   * @description 获取用户的报名记录，只取前3条用于卡片展示
   */
  async loadUserApplications() {
    try {
      const api = require('../../utils/api/index');
      
      const response = await api.request({
        url: '/nfunest/api/recruitments/my/applications',
        method: 'GET',
        showLoading: false
      });
      
      let applications = [];
      if (response && response.success && response.data) {
        // 只取前3条记录用于卡片展示
        applications = response.data.slice(0, 3);
      }
      
      this.setData({
        userApplications: applications
      });
    } catch (err) {
      console.error('获取用户报名记录失败:', err);
    }
  },

  /**
   * 加载用户羽章
   * @description 获取用户的羽章，只取前2个用于卡片展示
   */
  async loadUserBadges() {
    try {
      const api = require('../../utils/api/index');
      
      const response = await api.fetchMyBadges();
      
      let badges = [];
      if (response && response.success && response.data && response.data.badges) {
        // 只取前2个羽章用于卡片展示
        badges = response.data.badges
          .filter(b => b.is_displayed)
          .slice(0, 2);
      }
      
      this.setData({
        userBadges: badges
      });
    } catch (err) {
      console.error('获取用户羽章失败:', err);
    }
  },

  // 点击头像事件 - 触发微信登录获取code
  onAvatarTap() {
    if (!this.data.isLoggedIn) {
      // 如果未登录，执行微信登录流程获取code
      this.getWechatCode();
    } else {
      // 如果已登录，显示已登录状态
      wx.showToast({ title: '已登录', icon: 'success' });
    }
  },

  // 点击badge事件 - 触发登录或显示已登录状态
  onBadgeTap() {
    if (!this.data.isLoggedIn) {
      // 如果未登录，执行微信登录流程
      this.getWechatCode();
    } else {
      // 如果已登录，显示已登录状态
      wx.showToast({ title: '已登录', icon: 'success' });
    }
  },

  // 获取微信登录code
  getWechatCode() {
    wx.showLoading({ title: '获取授权...' });
    
    wx.login({
      success: (res) => {
        wx.hideLoading();
        if (res.code) {
          // 保存code到页面数据中
          this.setData({
            wechatCode: res.code
          });
          
          // 显示登录弹窗
          this.setData({
            showLoginModal: true
          });
        } else {
          wx.showToast({ title: '授权失败', icon: 'error' });
          console.error('登录失败！' + res.errMsg);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '授权失败', icon: 'error' });
        console.error('wx.login调用失败:', err);
      }
    });
  },

  // 登录弹窗取消事件
  onLoginCancel() {
    this.setData({
      showLoginModal: false
    });
  },

  // 登录弹窗确认事件
  async onLoginConfirm(e) {
    const { studentId, wechat, avatarUrl, tempAvatarPath, nickname } = e.detail;
    
    // 添加调试日志
    console.log('登录确认事件数据:', {
      studentId,
      wechat,
      avatarUrl,
      tempAvatarPath,
      nickname
    });
    
    // 隐藏弹窗
    this.setData({
      showLoginModal: false
    });
    
    // 保存输入的学号和微信号到页面数据中
    this.setData({
      studentId: studentId || '',
      wechat: wechat || ''
    });
    
    // 检查是否已获取微信code
    if (!this.data.wechatCode) {
      wx.showToast({ title: '请先点击头像获取授权', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在登录...', mask: true });
    
    try {
      // 修复：使用正确的导入路径
      const api = require('../../utils/api/index');
      
      // 先登录获取token
      const loginResult = await api.userLogin(
        this.data.wechatCode, 
        null, // userInfo参数，这里不需要传，后端会通过code获取
        studentId || null, 
        wechat || null
      );
      
      if (loginResult && loginResult.success) {
        // 保存旧头像URL，用于后续删除
        const oldAvatarUrl = this.data.userInfo.avatar;
        
        // 登录成功后再上传头像（如果有临时头像路径）
        let uploadedAvatarUrl = null;
        if (tempAvatarPath) {
          try {
            // 更新加载提示
            wx.showLoading({ title: '上传头像...', mask: true });
            console.log('开始上传头像:', tempAvatarPath);
            
            // 压缩图片后再上传，设置较短的超时时间
            const compressedImagePath = await this.compressImage(tempAvatarPath);
            console.log('压缩后图片路径:', compressedImagePath);
            
            // 使用较短的超时时间（15秒）上传头像
            const uploadResult = await api.uploadImage(compressedImagePath, { 
              category: 'avatars',
              timeout: 15000  // 15秒超时
            });
            console.log('头像上传结果:', uploadResult);
            uploadedAvatarUrl = uploadResult.fullUrl || uploadResult.url;
          } catch (uploadError) {
            console.error('头像上传失败:', uploadError);
            // 头像上传失败不阻塞登录流程，使用默认头像
            wx.showToast({ title: '头像上传失败，使用默认头像', icon: 'none', duration: 2000 });
          }
        }
        
        // 准备更新用户信息的数据
        const updateData = {};
        
        // 如果有昵称，添加到更新数据
        if (nickname) {
          updateData.nickname = nickname;
        }
        
        // 如果有上传的头像URL，使用上传的头像
        if (uploadedAvatarUrl) {
          updateData.avatar = uploadedAvatarUrl;
        } else if (avatarUrl) {
          // 如果没有上传头像，使用默认头像（login-modal 组件随机选择的）
          updateData.avatar = avatarUrl;
        }
        
        // 如果有需要更新的数据，调用更新接口
        if (Object.keys(updateData).length > 0) {
          try {
            wx.showLoading({ title: '更新信息...', mask: true });
            const updateResult = await api.updateUserProfile(updateData);
            if (updateResult && updateResult.success) {
              // 更新本地存储
              const updatedUserInfo = {
                ...loginResult.data.userInfo,
                ...updateResult.data
              };
              
              // 如果上传了新头像且旧头像存在，删除旧头像文件
              if (oldAvatarUrl && uploadedAvatarUrl && oldAvatarUrl !== uploadedAvatarUrl && oldAvatarUrl.startsWith('http')) {
                try {
                  // 异步删除旧头像文件，不阻塞主流程
                  setTimeout(async () => {
                    try {
                      await api.deleteFile(oldAvatarUrl);
                      console.log('旧头像文件删除成功:', oldAvatarUrl);
                    } catch (deleteError) {
                      console.error('删除旧头像文件失败:', deleteError);
                    }
                  }, 0);
                } catch (error) {
                  console.error('处理旧头像删除时出错:', error);
                }
              }
              
              wx.setStorageSync('userInfo', updatedUserInfo);
              
              // 更新页面数据
              this.setData({
                userInfo: updatedUserInfo
              });
            }
          } catch (updateError) {
            console.error('用户信息更新失败:', updateError);
            // 更新失败不影响登录成功
          }
        }
        
        wx.hideLoading();
        wx.showToast({ title: '登录成功', icon: 'success' });
        
        // 记录页面访问（登录成功后触发一次，确保活跃度统计正常）
        api.recordPageView('app_show').catch((err) => {
          console.warn('记录页面访问失败:', err);
        });
        
        // 更新页面数据
        this.setData({
          isLoggedIn: true,
          userInfo: loginResult.data.userInfo
        });
        
        // 触发页面重新加载以刷新用户信息
        this.onShow();
      } else {
        wx.hideLoading();
        wx.showToast({ title: loginResult?.message || '登录失败', icon: 'error' });
      }
    } catch (error) {
      console.error('登录失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '登录失败，请重试', icon: 'error' });
    }
  },

  // 学号输入事件（保留用于其他可能的用途）
  onStudentIdInput(e) {
    this.setData({
      studentId: e.detail.value
    });
  },

  // 微信号输入事件（保留用于其他可能的用途）
  onWechatInput(e) {
    this.setData({
      wechat: e.detail.value
    });
  },
  
  // swiper触摸开始事件 - 立即隐藏按钮
  onSwiperTouchStart() {
    this.setData({
      showActions: false
    });
  },
  
  // swiper动画完成事件 - 延迟显示按钮
  onSwiperAnimationFinish(e) {
    // 更新当前索引
    this.setData({
      currentTicketIndex: e.detail.current
    });
    
    // 延迟显示按钮，实现淡入效果
    setTimeout(() => {
      this.setData({
        showActions: true
      });
    }, 1000); // 1s 后显示按钮，实现优雅的延迟动画效果
  },
  
  // 票卡滑动切换事件（保留兼容）
  onTicketSwiperChange(e) {
    // 主要逻辑已移到 onSwiperAnimationFinish
  },
  
  // 手动切换票卡
  switchToTicket(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    
    // 切换时立即隐藏按钮
    this.setData({
      showActions: false,
      currentTicketIndex: index
    });
    
    // 延迟显示按钮，实现淡入效果
    setTimeout(() => {
      this.setData({
        showActions: true
      });
    }, 1000); // 1s 后显示按钮
  },
  
  // 加载缓存的个人资料图片
  loadProfileImage() {
    try {
      const cachedImage = wx.getStorageSync('profileImage');
      if (cachedImage) {
        this.setData({
          profileImage: cachedImage
        });
      }
    } catch (err) {
      console.error('加载缓存图片失败:', err);
    }
  },
  
  // 选择并缓存个人资料图片（不上传到服务器）
  selectAndCacheProfileImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        
        // 直接使用本地图片路径，不上传到服务器
        this.setData({
          profileImage: tempFilePath
        });
        
        // 保存到缓存
        wx.setStorageSync('profileImage', tempFilePath);
        
        wx.showToast({ title: '设置成功', icon: 'success' });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({ title: '选择图片失败', icon: 'error' });
      }
    });
  },
  
  // 跳转到管理员登录页面
  goToAdminLogin() {
    wx.navigateTo({
      url: '/pages/admin/login/login'
    });
  },
  
  // 跳转到关于页面
  goToAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  },
  
  // 跳转到反馈页面
  goToFeedback() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    });
  },
  
  // 跳转到羽章页面
  goToBadges() {
    wx.navigateTo({
      url: '/pages/badges/badges'
    });
  },
  
  // 新增：图片压缩函数
  compressImage(tempFilePath) {
    return new Promise((resolve, reject) => {
      // 使用微信的图片压缩功能
      wx.compressImage({
        src: tempFilePath,
        quality: 80, // 压缩质量
        success: (res) => {
          resolve(res.tempFilePath);
        },
        fail: (err) => {
          console.error('图片压缩失败:', err);
          // 压缩失败时使用原图
          resolve(tempFilePath);
        }
      });
    });
  }
});