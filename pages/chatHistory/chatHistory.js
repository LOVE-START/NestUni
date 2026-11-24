const api = require('../../utils/api/index.js');
const { themeManager } = require('../../utils/theme.js');
const userAuthBehavior = require('../../behaviors/userAuth');

Page({
  behaviors: [userAuthBehavior],

  data: {
    sessions: [],
    theme: { gradient: '' },
    isLoading: false
  },

  onLoad() {
    const theme = themeManager.getCurrentTheme();
    this.setData({ theme });
    
    // 检查权限
    this.checkUserPermission();
  },

  onShow() {
    // 只有有权限时才加载数据
    if (this.data.hasPermission) {
      this.loadSessions();
    }
  },

  /**
   * 加载会话列表
   */
  async loadSessions() {
    this.setData({ isLoading: true });
    try {
      const result = await api.fetchChatSessions();
      if (result.success) {
        const sessions = result.data.map(s => ({
          ...s,
          displayTime: this.formatDisplayTime(s.updated_at || s.created_at)
        }));
        this.setData({ sessions });
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /**
   * 点击会话进入聊天
   * @description 优先回到下层的聊天页并切换会话，避免堆叠出多个聊天页实例
   * （否则返回时会看到一个遗留的空白聊天页）
   */
  openSession(e) {
    // 防止快速连点导致 navigateBack 连续出栈
    if (this._isLeaving) return;

    const sessionId = parseInt(e.currentTarget.dataset.id);
    const prevPage = this.getPrevChatPage();

    if (prevPage) {
      this._isLeaving = true;
      prevPage.switchSession(sessionId);
      wx.navigateBack({ delta: 1 });
      return;
    }

    wx.redirectTo({ url: `/pages/chat/chat?sessionId=${sessionId}` });
  },

  /**
   * 删除会话
   * @description 至少保留一个会话，不能全部删除
   */
  async deleteSession(e) {
    const sessionId = e.currentTarget.dataset.id;
    const { sessions } = this.data;

    // 至少保留一个会话
    if (sessions.length <= 1) {
      wx.showToast({ title: '至少保留一个对话', icon: 'none' });
      return;
    }

    const res = await new Promise(resolve => {
      wx.showModal({
        title: '删除对话',
        content: '确定要删除这个对话吗？',
        success: resolve
      });
    });

    if (!res.confirm) return;

    try {
      const result = await api.deleteChatSession(sessionId);
      if (result.success) {
        wx.showToast({ title: '已删除', icon: 'success' });
        this.loadSessions();
      }
    } catch (error) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  /**
   * 新建对话
   * @description 优先复用下层的聊天页实例并重置为空白对话，避免页面堆栈重复
   */
  async goToNewChat() {
    // 防止快速连点导致 navigateBack 连续出栈
    if (this._isLeaving) return;

    const prevPage = this.getPrevChatPage();

    if (prevPage) {
      this._isLeaving = true;
      // 等空白会话复用/创建完成后再返回，避免返回后 onShow 用旧会话ID重复校验
      await prevPage.startNewChat();
      wx.navigateBack({ delta: 1 });
      return;
    }

    wx.redirectTo({ url: '/pages/chat/chat?new=true' });
  },

  /**
   * 获取页面堆栈中位于本页下方的聊天页实例
   * @returns {Object|null} 聊天页实例，不存在时返回 null
   */
  getPrevChatPage() {
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    return prevPage && prevPage.route === 'pages/chat/chat' ? prevPage : null;
  },

  /**
   * 格式化显示时间
   * @param {string} dateStr - ISO时间字符串
   * @returns {string} 格式化后的时间
   */
  formatDisplayTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}-${day}`;
  },

  onThemeChange(e) {
    const theme = e.detail.theme;
    this.setData({ theme });
  }
});
