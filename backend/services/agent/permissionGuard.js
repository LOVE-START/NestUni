/**
 * Agent工具权限守卫
 * @description 安全设计第3层的执行层部分：无论模型如何决策，工具执行前
 * 必须在此完成身份校验。与"工具可见性过滤"形成双保险——即使模型幻觉
 * 调用了不可见工具，也会在此被拦截并审计为denied
 */
const db = require('../../config/database');
const { PermissionError } = require('../../utils/errors');

/**
 * 校验操作者是否有权执行指定工具
 * @param {Object} tool - 工具定义（含access字段）
 * @param {Object} actor - 操作者 { id, type: 'user'|'admin', name, level }
 * @param {Object} args - 已清洗的工具参数（用于club_leader类工具提取clubId）
 * @returns {Promise<boolean>} 通过返回true，无权抛PermissionError
 */
async function checkToolPermission(tool, actor, args) {
  switch (tool.access) {
    // 任意登录身份（学生/管理员均可查询）
    case 'any':
      return true;

    // 仅学生身份（管理员账号在users表无记录，报名/查画像无意义）
    case 'user':
      if (actor.type !== 'user') {
        throw new PermissionError('该操作仅限学生账号使用');
      }
      return true;

    // 仅管理员
    case 'admin':
      if (actor.type !== 'admin') {
        throw new PermissionError('该操作需要管理员权限');
      }
      return true;

    // 社团会长：动态查库校验（学生身份 + 该社团role=leader）
    case 'club_leader': {
      if (actor.type !== 'user') {
        throw new PermissionError('该操作仅限社团会长使用');
      }
      const clubId = tool.getClubId ? tool.getClubId(args) : args.clubId;
      if (!Number.isInteger(clubId)) {
        throw new PermissionError('缺少有效的社团参数');
      }
      const membership = await db('club_members')
        .where({ club_id: clubId, user_id: actor.id })
        .first();
      if (!membership || membership.role !== 'leader') {
        throw new PermissionError('只有该社团的会长才能执行此操作');
      }
      return true;
    }

    default:
      // 未定义的权限类型一律拒绝（白名单思想）
      throw new PermissionError('未知的工具权限类型');
  }
}

module.exports = { checkToolPermission };
