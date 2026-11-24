/**
 * 管理员AI聊天页面
 * @description 管理员专用AI对话页，复用chat会话API（后端按owner_type=admin隔离会话），
 * 请求自动携带管理员Token，AI以管理员身份调用审核类工具（list_pending_approvals/review_approval等）。
 * 与学生版chat页的差异：
 * 1. 权限校验走adminAuthBehavior（管理员登录态）
 * 2. 会话记忆使用独立存储键，管理员与学生最近会话互不覆盖
 * 3. 快捷问题面向审核/查询场景
 * 4. 不采集地理位置（附近活动是学生场景）
 * 5. 推荐卡片仅保留社团类（Agent路径仅search_clubs产生推荐数据）
 */
const api = require('../../../utils/api/index.js');
const { themeManager } = require('../../../utils/theme.js');
const adminAuthBehavior = require('../../../behaviors/adminAuth');

// 管理员最近会话独立存储键，避免与学生端last_chat_session_id互相覆盖
const LAST_SESSION_KEY = 'last_admin_chat_session_id';

Page({
  behaviors: [adminAuthBehavior],

  data: {
    sessionId: null,
    messages: [],
    inputText: '',
    isLoading: false,
    theme: { gradient: '' },
    scrollToId: '',
    hasInput: false,
    adminAvatar: '',
    // 快捷问题：对齐管理员可用工具（待审核查询/审核操作/社团活动搜索）
    quickQuestions: [
      '当前有哪些待审核的内容？',
      '查看待审核的活动',
      '查看待审核的公告',
      '帮我查一下羽毛球社团'
    ]
  },

  /**
   * 保存最近使用的管理员会话ID到本地存储
   * @param {number} sessionId - 会话ID
   */
  saveLastSessionId(sessionId) {
    if (sessionId) {
      wx.setStorageSync(LAST_SESSION_KEY, sessionId);
    }
  },

  /**
   * 获取最近使用的管理员会话ID
   * @returns {number|null} 会话ID或null
   */
  getLastSessionId() {
    return wx.getStorageSync(LAST_SESSION_KEY) || null;
  },

  /**
   * 清除保存的会话ID
   */
  clearLastSessionId() {
    wx.removeStorageSync(LAST_SESSION_KEY);
  },

  /**
   * 页面加载
   * @description 管理员登录校验后，根据参数决定加载历史会话还是创建新会话
   */
  async onLoad(options) {
    const theme = themeManager.getCurrentTheme();
    this.setData({ theme });

    // 先检查管理员权限
    if (!this.checkAdminPermission()) {
      return;
    }

    this.loadAdminAvatar();

    if (options.sessionId) {
      this.setData({ sessionId: parseInt(options.sessionId) });
      this.saveLastSessionId(parseInt(options.sessionId));
      this.loadMessages();
    }
    else if (options.new === 'true') {
      await this.initSession();
    }
    else {
      await this.loadLastSession();
    }
  },

  /**
   * 加载管理员头像
   * @description 从本地存储获取管理员信息，admins表无头像字段时使用默认头像
   */
  loadAdminAvatar() {
    const adminInfo = api.getAdminInfo();
    const defaultAvatar = '/images/aichat.png';
    const adminAvatar = (adminInfo && adminInfo.avatar) ? adminInfo.avatar : defaultAvatar;
    this.setData({ adminAvatar });
  },

  /**
   * 加载上一次的管理员会话
   * @description 尝试加载最近使用的会话，如果失效则从历史列表获取最后一个
   */
  async loadLastSession() {
    const lastSessionId = this.getLastSessionId();

    if (lastSessionId) {
      try {
        this.setData({ sessionId: lastSessionId });
        await this.loadMessages();
      } catch (error) {
        console.error('加载上次会话失败:', error);
        this.clearLastSessionId();
        // 尝试从历史列表获取最后一个会话
        await this.loadLatestSessionFromHistory();
      }
    } else {
      // 尝试从历史列表获取最后一个会话
      await this.loadLatestSessionFromHistory();
    }
  },

  /**
   * 从历史列表加载最新的管理员会话
   * @description 管理员Token请求sessions接口，后端只返回owner_type=admin的会话；
   * 无历史会话时保持空白，发送第一条消息或点"新建对话"时才创建（避免预创建空白会话浪费资源）
   */
  async loadLatestSessionFromHistory() {
    try {
      const result = await api.fetchChatSessions();
      if (result.success && result.data && result.data.length > 0) {
        // 获取最新的会话（列表第一个）
        const latestSession = result.data[0];
        this.setData({ sessionId: latestSession.id });
        this.saveLastSessionId(latestSession.id);
        await this.loadMessages();
      }
    } catch (error) {
      console.error('获取会话列表失败:', error);
    }
  },

  /**
   * 页面显示时检查会话状态
   * @description 处理会话在其他入口被删除的情况
   */
  async onShow() {
    // 如果有会话ID，验证会话是否仍然有效
    if (this.data.sessionId && this.data.showContent) {
      try {
        // 尝试加载消息来验证会话是否存在
        await api.fetchChatMessages(this.data.sessionId);
      } catch (error) {
        // 会话已被删除，重新初始化
        console.log('当前会话已失效，重新初始化');
        this.clearLastSessionId();
        this.setData({ sessionId: null, messages: [] });
        await this.loadLatestSessionFromHistory();
      }
    }
  },

  /**
   * 初始化新的聊天会话
   * @description 管理员Token创建，后端会话归属owner_type=admin；
   * 后端幂等复用空白会话，已有空白会话则返回已有的、不重复创建
   */
  async initSession() {
    try {
      const result = await api.createChatSession();
      if (result.success) {
        const sessionId = result.data.id;
        this.saveLastSessionId(sessionId);
        this.setData({
          sessionId,
          messages: [],
          inputText: '',
          hasInput: false,
          isLoading: false,
          scrollToId: ''
        });
      } else {
        wx.showToast({ title: '创建会话失败', icon: 'none' });
      }
    } catch (error) {
      console.error('创建会话失败:', error);
      wx.showToast({ title: '创建会话失败', icon: 'none' });
    }
  },

  /**
   * 加载会话历史消息
   * @description 加载失败时会抛出错误，让调用方处理；
   * 从metadata中恢复recommendations与agent数据（确认卡片状态由后端回写，刷新后保持一致）
   */
  async loadMessages() {
    if (!this.data.sessionId) return;

    try {
      const result = await api.fetchChatMessages(this.data.sessionId);
      if (result.success) {
        const messages = result.data.map(m => {
          const msg = {
            id: m.id,
            role: m.role,
            content: m.content,
            time: this.formatTime(m.created_at)
          };

          // 从metadata中恢复recommendations数据（社团推荐卡片）
          if (m.metadata) {
            try {
              const metadata = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
              if (metadata.recommendations && metadata.recommendations.ids && metadata.recommendations.ids.length > 0) {
                msg.recommendations = metadata.recommendations;
              }
              // 从metadata中恢复agent步骤与待确认操作
              if (metadata.agent) {
                msg.agent = metadata.agent;
              }
            } catch (e) {
              // metadata解析失败，忽略
            }
          }

          return msg;
        });

        this.setData({ messages });
        this.scrollToBottom();

        // 异步加载所有历史消息中的推荐项详情
        messages.forEach(msg => {
          if (msg.recommendations && msg.recommendations.ids && msg.recommendations.ids.length > 0) {
            this.loadRecommendationItems(msg.id, msg.recommendations);
          }
        });
      } else {
        throw new Error(result.error || '加载消息失败');
      }
    } catch (error) {
      console.error('加载消息失败:', error);
      throw error;
    }
  },

  /**
   * 输入框内容变化
   * @param {Object} e - 输入事件对象
   */
  onInputChange(e) {
    const value = e.detail.value;
    this.setData({
      inputText: value,
      hasInput: value.trim().length > 0
    });
  },

  /**
   * 点击快捷问题
   * @param {Object} e - 点击事件对象
   */
  onQuickQuestion(e) {
    const question = e.currentTarget.dataset.question;
    this.setData({
      inputText: question,
      hasInput: true
    });
    this.sendMessage();
  },

  /**
   * 发送消息
   * @description 管理员Token直连chat接口，AI以管理员身份执行审核/查询工具
   */
  async sendMessage() {
    let { inputText, sessionId, isLoading } = this.data;

    if (!inputText.trim() || isLoading) return;

    // 如果没有会话ID，先创建新会话
    if (!sessionId) {
      try {
        const result = await api.createChatSession();
        if (result.success) {
          sessionId = result.data.id;
          this.setData({ sessionId });
          this.saveLastSessionId(sessionId);
        } else {
          wx.showToast({ title: '创建会话失败', icon: 'none' });
          return;
        }
      } catch (error) {
        console.error('创建会话失败:', error);
        wx.showToast({ title: '创建会话失败', icon: 'none' });
        return;
      }
    }

    const content = inputText.trim();
    const userMessageId = `msg_${Date.now()}`;
    const userMessage = {
      id: userMessageId,
      role: 'user',
      content: content,
      time: this.formatTime(new Date().toISOString())
    };

    // 先清空输入框，让用户立即看到反馈
    this.setData({
      messages: [...this.data.messages, userMessage],
      inputText: '',
      hasInput: false,
      isLoading: true,
      scrollToId: userMessageId
    });

    const loadingMessageId = `msg_${Date.now() + 1}`;
    const loadingMessage = {
      id: loadingMessageId,
      role: 'assistant',
      content: '',
      isLoading: true,
      time: this.formatTime(new Date().toISOString())
    };

    this.setData({
      messages: [...this.data.messages, loadingMessage],
      scrollToId: loadingMessageId
    });

    try {
      // 管理员场景不采集地理位置（附近活动是学生侧功能）
      const result = await api.sendChatMessage(sessionId, content);

      if (result.success) {
        const aiMessageId = `msg_${Date.now() + 2}`;
        const aiMessage = {
          id: aiMessageId,
          role: 'assistant',
          content: result.data.reply,
          isLoading: false,
          time: this.formatTime(new Date().toISOString()),
          recommendations: result.data.recommendations, // 社团推荐数据
          agent: result.data.agent || null // Agent工具步骤+待确认操作
        };

        // 替换loading消息为实际回复
        const newMessages = [...this.data.messages];
        newMessages[newMessages.length - 1] = aiMessage;

        this.setData({
          messages: newMessages,
          isLoading: false,
          scrollToId: aiMessageId
        });

        // 如果有社团推荐数据，加载推荐项详情
        if (result.data.recommendations && result.data.recommendations.ids && result.data.recommendations.ids.length > 0) {
          this.loadRecommendationItems(aiMessageId, result.data.recommendations);
        }

        // 保存当前会话ID，确保下次打开能恢复
        this.saveLastSessionId(sessionId);
      } else {
        throw new Error(result.error || '发送失败');
      }
    } catch (error) {
      console.error('发送消息失败:', error);

      const errorMessageId = `msg_${Date.now() + 2}`;
      const errorMessage = {
        id: errorMessageId,
        role: 'assistant',
        content: '抱歉，我暂时无法回复，请稍后再试 🙏',
        isLoading: false,
        isError: true,
        time: this.formatTime(new Date().toISOString())
      };

      const newMessages = [...this.data.messages];
      newMessages[newMessages.length - 1] = errorMessage;

      this.setData({
        messages: newMessages,
        isLoading: false,
        scrollToId: errorMessageId
      });
    }
  },

  /**
   * 确认执行Agent待确认操作
   * @description 携带后端签发的actionToken请求执行；成功后卡片标记已处理并追加结果消息
   * @param {Object} e - 事件对象（dataset.msgId为携带确认卡片的消息ID）
   */
  async onAgentConfirm(e) {
    const msgId = e.currentTarget.dataset.msgId;
    const message = this.data.messages.find(m => m.id === msgId);
    if (!message || !message.agent || !message.agent.pendingAction) return;

    const pendingAction = message.agent.pendingAction;
    try {
      const result = await api.confirmAgentAction(
        this.data.sessionId,
        pendingAction.token,
        pendingAction.messageId
      );

      if (result.success) {
        // 卡片标记已处理
        const messages = this.data.messages.map(m => {
          if (m.id === msgId) {
            return { ...m, agent: { ...m.agent, pendingAction: { ...pendingAction, resolved: true } } };
          }
          return m;
        });

        // 追加执行结果消息
        const resultMsgId = `msg_${Date.now()}`;
        const resultMessage = {
          id: resultMsgId,
          role: 'assistant',
          content: result.data.message,
          time: this.formatTime(new Date().toISOString())
        };

        this.setData({
          messages: [...messages, resultMessage],
          scrollToId: resultMsgId
        });
      } else {
        wx.showToast({ title: result.error || '操作失败', icon: 'none' });
      }
    } catch (error) {
      console.error('确认Agent操作失败:', error);
      wx.showToast({ title: error.message || '操作失败，请重试', icon: 'none' });
    }
  },

  /**
   * 取消Agent待确认操作
   * @description 取消走后端闭环：审计记录置cancelled+落库取消消息，不残留pending僵尸记录
   * @param {Object} e - 事件对象（dataset.msgId为携带确认卡片的消息ID）
   */
  async onAgentCancel(e) {
    const msgId = e.currentTarget.dataset.msgId;
    const message = this.data.messages.find(m => m.id === msgId);
    if (!message || !message.agent || !message.agent.pendingAction) return;

    const pendingAction = message.agent.pendingAction;
    try {
      const result = await api.cancelAgentAction(
        this.data.sessionId,
        pendingAction.token,
        pendingAction.messageId
      );

      if (result.success) {
        // 卡片标记已处理 + 追加取消提示消息（后端已同步落库，刷新后状态一致）
        const messages = this.data.messages.map(m => {
          if (m.id === msgId) {
            return { ...m, agent: { ...m.agent, pendingAction: { ...pendingAction, resolved: true } } };
          }
          return m;
        });

        const cancelMsgId = `msg_${Date.now()}`;
        this.setData({
          messages: [...messages, {
            id: cancelMsgId,
            role: 'assistant',
            content: result.data.message,
            time: this.formatTime(new Date().toISOString())
          }],
          scrollToId: cancelMsgId
        });
      } else {
        // 后端拒绝（如令牌无效）：仍标记卡片已处理，防止重复点击
        this._markPendingActionResolved(msgId);
        wx.showToast({ title: result.error || '取消失败', icon: 'none' });
      }
    } catch (error) {
      console.error('取消Agent操作失败:', error);
      this._markPendingActionResolved(msgId);
      wx.showToast({ title: error.message || '操作失败，请重试', icon: 'none' });
    }
  },

  /**
   * 将指定消息上的确认卡片标记为已处理
   * @param {number|string} msgId - 消息ID
   */
  _markPendingActionResolved(msgId) {
    const messages = this.data.messages.map(m => {
      if (m.id === msgId && m.agent && m.agent.pendingAction) {
        return { ...m, agent: { ...m.agent, pendingAction: { ...m.agent.pendingAction, resolved: true } } };
      }
      return m;
    });
    this.setData({ messages });
  },

  /**
   * 加载推荐项详情
   * @description 管理员场景仅处理社团类型推荐（Agent路径只有search_clubs产生推荐）
   * @param {string} messageId - 消息ID
   * @param {Object} recommendations - 推荐数据
   */
  async loadRecommendationItems(messageId, recommendations) {
    try {
      let items = [];

      if (recommendations.type === 'clubs') {
        const result = await api.fetchClubsByIds(recommendations.ids);
        if (result.success) {
          items = result.data;
        }
      }

      // 更新消息中的推荐项数据
      const messages = this.data.messages.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            recommendations: {
              ...msg.recommendations,
              items
            }
          };
        }
        return msg;
      });

      this.setData({ messages });
    } catch (error) {
      console.error('加载推荐项失败:', error);
    }
  },

  /**
   * 社团卡片swiper滑动切换事件
   * @description 更新当前消息的社团swiper索引，用于显示页码指示器
   * @param {Object} e - swiper切换事件对象
   */
  onClubSwiperChange(e) {
    const { msgId } = e.currentTarget.dataset;
    const current = e.detail.current;

    const messages = this.data.messages.map(msg => {
      if (msg.id === msgId) {
        return { ...msg, currentClubIndex: current };
      }
      return msg;
    });

    this.setData({ messages });
  },

  /**
   * 查看社团详情
   * @description 点击社团卡片跳转到社团详情页
   * @param {Object} e - 事件对象
   */
  goToClub(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/clubDetail/clubDetail?id=${id}`
    });
  },

  /**
   * 滚动到底部
   */
  scrollToBottom() {
    const messages = this.data.messages;
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      this.setData({
        scrollToId: lastMessage.id
      });
    }
  },

  /**
   * 格式化时间
   * @param {string} dateStr - ISO时间字符串
   * @returns {string} 格式化后的时间
   */
  formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  /**
   * 新建对话
   * @description 已在空白会话中则无需重建；否则复用/创建空白会话（后端幂等）
   */
  async newChat() {
    if (this.data.messages.length === 0 && this.data.sessionId) {
      wx.showToast({ title: '当前是新对话', icon: 'none' });
      return;
    }

    await this.initSession();
  },

  /**
   * 主题变化回调
   * @param {Object} e - 主题变化事件
   */
  onThemeChange(e) {
    const theme = e.detail.theme;
    this.setData({ theme });
  }
});
