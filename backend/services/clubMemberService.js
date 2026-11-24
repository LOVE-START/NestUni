/**
 * 社团成员业务服务层
 * @description 从routes/clubs.js提取的成员添加逻辑与用户搜索，
 * 供社团路由与Agent的add_club_member工具共用
 */
const db = require('../config/database');
const logger = require('../config/logger');
const { validateClubExists, validateUserExists, validateClubMembership, isValidMemberRole } = require('../utils/validators');
const { BusinessError } = require('../utils/errors');

/**
 * 按学号或昵称搜索用户
 * @description 会长通过Agent添加成员时，先用关键词定位目标用户
 * @param {string} keyword - 学号或昵称关键词
 * @returns {Promise<Array>} 候选用户列表（最多10个）
 */
async function searchUsers(keyword) {
  const kw = `%${String(keyword).trim()}%`;
  if (!keyword || !String(keyword).trim()) {
    throw new BusinessError('搜索关键词不能为空');
  }
  return await db('users')
    .select('id', 'nickname', 'student_id', 'avatar')
    .where(builder => builder.where('nickname', 'like', kw).orWhere('student_id', 'like', kw))
    .limit(10);
}

/**
 * 添加社团成员
 * @description 逻辑提取自clubs.js的POST /:id/members：校验社团/用户存在、角色合法、未重复入社后写入
 * @param {number} clubId - 社团ID
 * @param {number} targetUserId - 被添加的用户ID
 * @param {string} [role='member'] - 成员角色（member/leader）
 * @returns {Promise<void>}
 */
async function addMember(clubId, targetUserId, role = 'member') {
  if (!Number.isInteger(clubId) || !Number.isInteger(targetUserId)) {
    throw new BusinessError('社团ID与用户ID必须为整数');
  }
  if (!isValidMemberRole(role)) {
    throw new BusinessError('无效的成员角色');
  }
  if (!(await validateClubExists(clubId))) {
    throw new BusinessError('社团不存在');
  }
  if (!(await validateUserExists(targetUserId))) {
    throw new BusinessError('目标用户不存在');
  }
  if (await validateClubMembership(clubId, targetUserId)) {
    throw new BusinessError('该用户已经是社团成员');
  }

  await db('club_members').insert({
    club_id: clubId,
    user_id: targetUserId,
    role,
    status: 'active',
    joined_at: db.fn.now()
  });

  logger.info('添加社团成员:', { clubId, targetUserId, role });
}

module.exports = { searchUsers, addMember };
