// 引入主题管理器
const { themeManager } = require('../../utils/theme.js');
// 引入图片缓存管理
const { pauseDownloads, resumeDownloads } = require('../../utils/imageCache.js');

// 默认头像URL列表
const DEFAULT_AVATAR_URLS = [
  'https://wx4.sinaimg.cn/mw690/008x1Cpaly1i32uxsgukzj30u00u0aau.jpg',
  'https://wx4.sinaimg.cn/mw690/008x1Cpaly1i32uxtcoz2j30u00u0gmm.jpg',
  'https://wx2.sinaimg.cn/mw690/008x1Cpaly1i32uxtp5npj30u00u03z8.jpg',
  'https://wx4.sinaimg.cn/mw690/008x1Cpaly1i32uxsyzauj30u00u0gmc.jpg',
  'https://wx2.sinaimg.cn/mw690/006uDpocgy1hzyylltdzcj30u00t1ac8.jpg',
  'https://wx3.sinaimg.cn/mw690/006uDpocgy1hzyyln6fd8j30u00t2jt1.jpg',
  'https://wx1.sinaimg.cn/mw690/006uDpocgy1hzyyloz2ayj30u00sw76o.jpg'
];

/**
 * 获取随机默认头像URL
 * @returns {string} 随机选择的头像URL
 */
function getRandomAvatarUrl() {
  const randomIndex = Math.floor(Math.random() * DEFAULT_AVATAR_URLS.length);
  return DEFAULT_AVATAR_URLS[randomIndex];
}

Component({
  options: {
    multipleSlots: true // 在组件定义时的选项中启用多slot支持
  },
  
  properties: {
    // 是否显示弹窗
    show: {
      type: Boolean,
      value: false,
      observer: function(newVal, oldVal) {
        // 当弹窗显示时，重置所有状态
        if (newVal === true) {
          this._resetAllStates();
        }
      }
    }
  },

  data: {
    // 本地存储的输入值
    localStudentId: '',
    localWechat: '',
    // 头像和昵称相关数据
    avatarUrl: getRandomAvatarUrl(),
    nickname: '',
    // 临时头像路径
    tempAvatarPath: '',
    // 上传状态
    isUploading: false,
    // 头像选择中状态
    isChoosingAvatar: false,
    // 主题相关
    theme: null
  },

  // 组件内部状态，不用于视图渲染
  _isChoosingAvatar: false,
  // chooseAvatar 超时定时器
  _chooseAvatarTimer: null,

  lifetimes: {
    attached: function() {
      // 在组件实例进入页面节点树时执行，初始化所有状态
      this._isChoosingAvatar = false;
      this._clearChooseAvatarTimer();
      
      // 获取当前主题
      const theme = themeManager.getTheme();
      
      this.setData({
        localStudentId: '',
        localWechat: '',
        avatarUrl: getRandomAvatarUrl(),
        nickname: '',
        tempAvatarPath: '',
        isUploading: false,
        isChoosingAvatar: false,
        theme: theme
      });
    },
    detached: function() {
      // 在组件实例被从页面节点树移除时执行
      this._isChoosingAvatar = false;
      this._clearChooseAvatarTimer();
    },
  },

  methods: {
    /**
     * 重置所有状态
     * @description 当弹窗显示时调用，确保每次打开弹窗都是干净的初始状态
     */
    _resetAllStates: function() {
      // 清除定时器
      this._clearChooseAvatarTimer();
      
      // 重置内部状态
      this._isChoosingAvatar = false;
      
      // 重置视图数据
      this.setData({
        localStudentId: '',
        localWechat: '',
        avatarUrl: getRandomAvatarUrl(),
        nickname: '',
        tempAvatarPath: '',
        isUploading: false,
        isChoosingAvatar: false
      });
    },

    /**
     * 清除 chooseAvatar 超时定时器
     */
    _clearChooseAvatarTimer: function() {
      if (this._chooseAvatarTimer) {
        clearTimeout(this._chooseAvatarTimer);
        this._chooseAvatarTimer = null;
      }
    },

    /**
     * 头像按钮点击事件
     * @description 在点击时立即锁定内部状态，暂停图片缓存下载确保头像选择流畅
     */
    onAvatarTap() {
      if (this._isChoosingAvatar) {
        console.log('头像选择中，请勿重复点击');
        return false;
      }
      
      // 暂停图片缓存下载，释放网络资源
      pauseDownloads();
      
      // 立即设置内部状态，防止重复点击
      this._isChoosingAvatar = true;
      
      // 延迟设置 UI 状态，确保 open-type 先触发
      setTimeout(() => {
        if (this._isChoosingAvatar && !this.data.avatarUrl) {
          this.setData({ isChoosingAvatar: true });
        }
      }, 100);
      
      // 设置安全超时，防止用户取消选择后状态未重置
      this._clearChooseAvatarTimer();
      this._chooseAvatarTimer = setTimeout(() => {
        if (this._isChoosingAvatar) {
          console.log('头像选择超时，自动重置状态');
          this._isChoosingAvatar = false;
          this.setData({ isChoosingAvatar: false });
          // 恢复图片缓存下载
          resumeDownloads();
        }
      }, 10000);
    },

    /**
     * 选择头像回调事件
     * @description 处理用户选择的头像，立即重置状态并恢复图片缓存下载
     * @param {Object} e - 事件对象
     */
    onChooseAvatar(e) {
      // 清除超时定时器
      this._clearChooseAvatarTimer();
      
      const { avatarUrl } = e.detail;
      if (!avatarUrl) {
        console.log('未获取到头像URL');
        this._isChoosingAvatar = false;
        this.setData({ isChoosingAvatar: false });
        // 恢复图片缓存下载
        resumeDownloads();
        return;
      }
      
      // 立即更新头像并重置状态
      this._isChoosingAvatar = false;
      this.setData({
        avatarUrl,
        tempAvatarPath: avatarUrl,
        isChoosingAvatar: false
      });
      
      // 恢复图片缓存下载
      resumeDownloads();
    },

    /**
     * 昵称输入事件处理
     * @param {Object} e - 事件对象
     */
    onNicknameInput(e) {
      this.setData({
        nickname: e.detail.value
      });
    },

    /**
     * 学号输入事件
     * @param {Object} e - 事件对象
     */
    onStudentIdInput: function(e) {
      this.setData({
        localStudentId: e.detail.value
      });
    },

    /**
     * 微信号输入事件
     * @param {Object} e - 事件对象
     */
    onWechatInput: function(e) {
      this.setData({
        localWechat: e.detail.value
      });
    },

    /**
     * 取消按钮点击事件
     * @description 重置所有状态并触发取消事件，恢复图片缓存下载
     */
    onCancel: function() {
      this._isChoosingAvatar = false;
      this.setData({
        localStudentId: '',
        localWechat: '',
        avatarUrl: getRandomAvatarUrl(),
        nickname: '',
        tempAvatarPath: '',
        isUploading: false,
        isChoosingAvatar: false
      });
      // 恢复图片缓存下载
      resumeDownloads();
      this.triggerEvent('cancel');
    },

    /**
     * 确认按钮点击事件
     * @description 验证输入并触发确认事件
     */
    onConfirm: function() {
      // 检查昵称是否填写
      if (!this.data.nickname || this.data.nickname.trim() === '') {
        wx.showToast({
          title: '请输入昵称',
          icon: 'none'
        });
        return;
      }
      
      // 检查学号和微信号是否至少填写了一个
      if (!this.data.localStudentId && !this.data.localWechat) {
        wx.showToast({
          title: '请至少填写学号或微信号',
          icon: 'none'
        });
        return;
      }

      // 如果有临时头像路径，先上传头像
      if (this.data.tempAvatarPath) {
        this.uploadAvatarAndConfirm();
      } else {
        // 没有新头像，直接确认
        this.triggerConfirmEvent();
      }
    },

    /**
     * 上传头像并确认
     * @description 不再在登录前上传头像，让父页面在登录成功后再处理头像上传
     */
    async uploadAvatarAndConfirm() {
      this.triggerConfirmEvent();
    },

    /**
     * 触发确认事件
     * @param {string} uploadedAvatarUrl - 已上传的头像URL（可选）
     */
    triggerConfirmEvent(uploadedAvatarUrl = null) {
      // 触发confirm事件，将数据传递给父组件
      this.triggerEvent('confirm', {
        studentId: this.data.localStudentId,
        wechat: this.data.localWechat,
        avatarUrl: uploadedAvatarUrl || this.data.avatarUrl,
        tempAvatarPath: this.data.tempAvatarPath,
        nickname: this.data.nickname
      });
      
      // 重置所有状态
      this._isChoosingAvatar = false;
      this.setData({
        localStudentId: '',
        localWechat: '',
        avatarUrl: getRandomAvatarUrl(),
        nickname: '',
        tempAvatarPath: '',
        isUploading: false,
        isChoosingAvatar: false
      });
    }
  }
})
