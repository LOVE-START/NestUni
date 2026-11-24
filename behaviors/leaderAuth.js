/**
 * 社长权限 Behavior
 * @description 用于需要社长权限才能访问的页面
 * @usage 
 * 1. 引入: const leaderAuthBehavior = require('../../behaviors/leaderAuth');
 * 2. 注册: behaviors: [leaderAuthBehavior]
 * 3. 在 onLoad 中调用: await this.checkLeaderPermission()
 * 4. wxml 中使用: wx:if="{{permissionChecked && hasPermission}}"
 */

const { checkLeaderPermission, checkClubLeader } = require('../utils/permission');

const leaderAuthBehavior = Behavior({
  data: {
    // 权限控制
    hasPermission: false,
    permissionChecked: false
  },

  methods: {
    /**
     * 检查社长权限（任意社团）
     * @returns {Promise<boolean>} 是否有权限
     */
    async checkLeaderPermission() {
      this.setData({ permissionChecked: false });
      
      const isLeader = await checkLeaderPermission();
      this.setData({
        hasPermission: isLeader,
        permissionChecked: true
      });
      return isLeader;
    },

    /**
     * 检查是否是某个社团的社长
     * @param {string} clubId - 社团ID
     * @returns {Promise<boolean>} 是否是该社团的社长
     */
    async checkClubLeaderPermission(clubId) {
      this.setData({ permissionChecked: false });
      
      const isLeader = await checkClubLeader(clubId);
      this.setData({
        hasPermission: isLeader,
        permissionChecked: true
      });
      return isLeader;
    },

    /**
     * 检查权限并执行回调
     * @param {Function} onSuccess - 有权限时的回调
     * @param {Function} onFail - 无权限时的回调（可选）
     */
    async checkPermissionWithCallback(onSuccess, onFail) {
      const hasPermission = await this.checkLeaderPermission();
      if (hasPermission && typeof onSuccess === 'function') {
        onSuccess.call(this);
      } else if (!hasPermission && typeof onFail === 'function') {
        onFail.call(this);
      }
      return hasPermission;
    }
  }
});

module.exports = leaderAuthBehavior;
