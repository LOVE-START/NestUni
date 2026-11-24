/**
 * 管理员登录权限 Behavior
 * @description 用于需要管理员登录才能访问的页面
 * @usage 
 * 1. 引入: const adminAuthBehavior = require('../../behaviors/adminAuth');
 * 2. 注册: behaviors: [adminAuthBehavior]
 * 3. 在 onLoad 中调用: this.checkAdminPermission()
 * 4. wxml 中使用: wx:if="{{showContent}}"
 */

const { checkAdminLogin } = require('../utils/permission');

const adminAuthBehavior = Behavior({
  data: {
    // 权限控制
    showContent: false
  },

  methods: {
    /**
     * 检查管理员登录权限
     * @returns {boolean} 是否有权限
     */
    checkAdminPermission() {
      const isLoggedIn = checkAdminLogin();
      this.setData({
        showContent: isLoggedIn
      });
      return isLoggedIn;
    },

    /**
     * 检查权限并执行回调
     * @param {Function} onSuccess - 有权限时的回调
     * @param {Function} onFail - 无权限时的回调（可选）
     */
    checkPermissionWithCallback(onSuccess, onFail) {
      const hasPermission = this.checkAdminPermission();
      if (hasPermission && typeof onSuccess === 'function') {
        onSuccess.call(this);
      } else if (!hasPermission && typeof onFail === 'function') {
        onFail.call(this);
      }
      return hasPermission;
    }
  }
});

module.exports = adminAuthBehavior;
