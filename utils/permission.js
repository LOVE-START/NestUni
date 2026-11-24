/**
 * 权限检查工具
 * @description 提供页面权限检查的通用方法
 */

const { checkAuthStatus, fetchMyClubs, getAdminInfo } = require('./api/index');

/**
 * 权限类型枚举
 */
const PermissionType = {
  USER: 'user',           // 普通用户登录
  ADMIN: 'admin',         // 管理员登录
  LEADER: 'leader'        // 社长权限
};

/**
 * 检查用户登录状态
 * @returns {boolean} 是否已登录
 */
function checkUserLogin() {
  const authStatus = checkAuthStatus();
  return authStatus.isLoggedIn;
}

/**
 * 检查管理员登录状态
 * @returns {boolean} 是否已登录管理员
 */
function checkAdminLogin() {
  const adminInfo = getAdminInfo();
  return !!adminInfo;
}

/**
 * 检查社长权限
 * @returns {Promise<boolean>} 是否是社长
 */
async function checkLeaderPermission() {
  try {
    const authStatus = checkAuthStatus();
    if (!authStatus.isLoggedIn) {
      return false;
    }
    
    const response = await fetchMyClubs();
    return response && response.success && response.data && response.data.length > 0;
  } catch (error) {
    console.error('检查社长权限失败:', error);
    return false;
  }
}

/**
 * 检查是否是某个社团的社长
 * @param {string} clubId - 社团ID
 * @returns {Promise<boolean>} 是否是该社团的社长
 */
async function checkClubLeader(clubId) {
  try {
    const authStatus = checkAuthStatus();
    if (!authStatus.isLoggedIn) {
      return false;
    }
    
    const response = await fetchMyClubs();
    if (response && response.success) {
      const userClubs = response.data || [];
      return userClubs.some(club =>
        `${club.id}` === `${clubId}` && club.role === 'leader'
      );
    }
    return false;
  } catch (error) {
    console.error('检查社团社长权限失败:', error);
    return false;
  }
}

module.exports = {
  PermissionType,
  checkUserLogin,
  checkAdminLogin,
  checkLeaderPermission,
  checkClubLeader
};
