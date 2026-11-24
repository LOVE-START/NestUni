// components/comments/comments.js
Component({
  properties: {
    targetType: {
      type: String,
      value: 'event'
    },
    targetId: {
      type: Number,
      value: 0
    },
    showInput: {
      type: Boolean,
      value: true
    }
  },

  data: {
    comments: [],
    newComment: '',
    commentPage: 1,
    commentPageSize: 10,
    commentTotal: 0,
    commentLoading: false,
    hasMore: true,
    userInfo: null,
    theme: {}
  },

  lifetimes: {
    attached: function() {
      this.loadUserInfo();
      this.loadComments();
      this.initTheme();
    }
  },

  methods: {
    initTheme: function() {
      try {
        const themeManager = require('../../utils/theme.js').themeManager;
        const theme = themeManager.getCurrentTheme();
        
        this.setData({
          theme: theme
        });
      } catch (e) {
        console.log('获取主题失败:', e);
      }
    },

    loadUserInfo() {
      try {
        const userInfo = wx.getStorageSync('userInfo');
        if (userInfo) {
          this.setData({
            userInfo: userInfo
          });
          return;
        }
        
        const app = getApp();
        if (app && app.globalData && app.globalData.userInfo) {
          this.setData({
            userInfo: app.globalData.userInfo
          });
        }
      } catch (e) {
        console.log('获取用户信息失败:', e);
      }
    },

    async loadComments(page = 1) {
      if (this.data.commentLoading) return;
      
      if (page > 1 && !this.data.hasMore) return;
      
      this.setData({ commentLoading: true });
      
      try {
        const { fetchComments } = require('../../utils/api/index');
        const { formatEventDate } = require('../../utils/date.js');
        
        const response = await fetchComments({
          targetType: this.data.targetType,
          targetId: this.data.targetId,
          page: page,
          pageSize: this.data.commentPageSize
        });
        
        const comments = response.data || [];
        const pagination = response.pagination || {};
        const hasMore = page * this.data.commentPageSize < pagination.total;
        
        const processedComments = comments.map(comment => ({
          ...comment,
          formattedDate: formatEventDate(comment.created_at)
        }));
        
        this.setData({
          comments: page === 1 ? processedComments : [...this.data.comments, ...processedComments],
          commentPage: pagination.page || page,
          commentTotal: pagination.total || 0,
          commentLoading: false,
          hasMore: hasMore
        });
      } catch (error) {
        console.error('加载评论失败:', error);
        this.setData({ 
          commentLoading: false,
          hasMore: false
        });
        wx.showToast({ title: '加载评论失败', icon: 'none' });
      }
    },

    onCommentInput(e) {
      this.setData({ newComment: e.detail.value });
    },

    async postComment() {
      if (!this.data.userInfo) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      
      if (!this.data.newComment.trim()) {
        wx.showToast({ title: '请输入评论内容', icon: 'none' });
        return;
      }
      
      wx.showLoading({ title: '发表中...' });
      
      try {
        const { createComment } = require('../../utils/api/index');
        const { formatEventDate } = require('../../utils/date.js');
        
        const response = await createComment({
          content: this.data.newComment,
          targetType: this.data.targetType,
          targetId: this.data.targetId
        });
        
        if (response.success) {
          wx.showToast({ title: '发表成功', icon: 'success' });
          
          const formattedComment = {
            ...response.data,
            formattedDate: formatEventDate(response.data.created_at)
          };
          
          this.setData({
            newComment: "",
            comments: [formattedComment, ...this.data.comments],
            commentTotal: this.data.commentTotal + 1
          });
          
          this.triggerEvent('commentPosted', { comment: formattedComment });
        } else {
          throw new Error(response.error || '发表失败');
        }
      } catch (error) {
        console.error('发表评论失败:', error);
        wx.showToast({ title: error.message || '发表失败', icon: 'none' });
      } finally {
        wx.hideLoading();
      }
    },

    onDeleteComment(e) {
      if (!e || !e.currentTarget || !e.currentTarget.dataset) {
        wx.showToast({ title: '操作失败', icon: 'none' });
        return;
      }
      
      const comment = e.currentTarget.dataset.comment;
      
      if (!comment || !comment.id) {
        wx.showToast({ title: '无效的评论', icon: 'none' });
        return;
      }
      
      if (!this.data.userInfo) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      
      if (!this.data.userInfo.id) {
        wx.showToast({ title: '用户信息不完整', icon: 'none' });
        return;
      }
      
      const commentUserId = parseInt(comment.user_id);
      const currentUserId = parseInt(this.data.userInfo.id);
      
      if (isNaN(commentUserId) || isNaN(currentUserId) || commentUserId !== currentUserId) {
        wx.showToast({ title: '只能删除自己的评论', icon: 'none' });
        return;
      }
      
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这条评论吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              const { deleteComment } = require('../../utils/api/index');
              
              const response = await deleteComment(comment.id);
              
              if (response.success) {
                wx.showToast({ title: '删除成功', icon: 'success' });
                
                const updatedComments = this.data.comments.filter(item => item.id !== comment.id);
                this.setData({
                  comments: updatedComments,
                  commentTotal: this.data.commentTotal - 1
                });
                
                this.triggerEvent('commentDeleted', { commentId: comment.id });
              } else {
                throw new Error(response.error || '删除失败');
              }
            } catch (error) {
              console.error('删除评论失败:', error);
              wx.showToast({ title: error.message || '删除失败', icon: 'none' });
            }
          }
        }
      });
    },

    /**
     * 点击羽章图标
     * @description 触发羽章点击事件，可跳转到羽章详情页
     */
    onBadgeTap(e) {
      const badge = e.currentTarget.dataset.badge;
      if (badge) {
        this.triggerEvent('badgeTap', { badge });
      }
    },

    loadMoreComments() {
      if (!this.data.commentLoading && this.data.hasMore) {
        this.loadComments(this.data.commentPage + 1);
      }
    },

    refreshComments() {
      this.setData({
        commentPage: 1,
        hasMore: true
      });
      this.loadComments(1);
    }

  }
})
