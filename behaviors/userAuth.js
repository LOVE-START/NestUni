/**
 * 用户登录权限 Behavior
 * @description 用于需要用户登录才能访问的页面
 * @usage 
 * 1. 引入: const userAuthBehavior = require('../../behaviors/userAuth');
 * 2. 注册: behaviors: [userAuthBehavior]
 * 3. 在 onLoad 中调用: this.checkUserPermission()
 * 4. wxml 中使用: wx:if="{{permissionChecked && hasPermission}}"
 */

const { checkUserLogin } = require('../utils/permission');

const userAuthBehavior = Behavior({
  data: {
    // 权限控制
    hasPermission: false,
    permissionChecked: false
  },

  methods: {
    /**
     * 检查用户登录权限
     * @returns {boolean} 是否有权限
     */
    checkUserPermission() {
      const isLoggedIn = checkUserLogin();
      this.setData({
        hasPermission: isLoggedIn,
        permissionChecked: true
      });
      return isLoggedIn;
    },

    /**
     * 检查权限并执行回调
     * @param {Function} onSuccess - 有权限时的回调
     * @param {Function} onFail - 无权限时的回调（可选）
     */
    checkPermissionWithCallback(onSuccess, onFail) {
      const hasPermission = this.checkUserPermission();
      if (hasPermission && typeof onSuccess === 'function') {
        onSuccess.call(this);
      } else if (!hasPermission && typeof onFail === 'function') {
        onFail.call(this);
      }
      return hasPermission;
    }
  }
});

module.exports = userAuthBehavior;
