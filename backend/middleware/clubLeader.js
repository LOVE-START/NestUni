// middleware/clubLeader.js - 社团会长权限验证中间件
const db = require('../config/database');

/**
 * 解析社团ID
 * @param {*} value - 路由参数或请求体中的原始值
 * @returns {number|null} 合法数值或 null
 */
const parseClubId = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
};

/**
 * 校验当前登录用户是否为目标社团的会长
 * @description 成功后把解析出的社团ID挂到 req.clubId 供后续路由使用
 */
const requireClubLeader = async (req, res, next) => {
  try {
    if (!req.user || req.userType !== 'user') {
      return res.status(401).json({
        success: false,
        error: '需要用户登录'
      });
    }

    // 社团ID来源：路由参数 :clubId；无该参数时按 :id 推断；最后取请求体 clubId（新活动通知）
    const hasClubIdParam = req.params.clubId !== undefined;
    let clubId = parseClubId(req.params.clubId);

    if (!clubId && !hasClubIdParam) {
      if (req.params.id) {
        if (req.originalUrl.includes('/announcements/')) {
          // 公告的更新/删除接口只带 :id（公告ID），需要反查公告所属社团
          const announcement = await db('announcements')
            .select('club_id')
            .where({ id: req.params.id })
            .first();
          clubId = announcement ? announcement.club_id : null;
        } else {
          // 社团路由使用 /clubs/:id，:id 即社团ID
          clubId = parseClubId(req.params.id);
        }
      } else {
        clubId = parseClubId(req.body.clubId);
      }
    }

    if (!clubId) {
      return res.status(400).json({
        success: false,
        error: '缺少社团ID参数'
      });
    }

    const membership = await db('club_members')
      .where({
        club_id: clubId,
        user_id: req.user.id
      })
      .first();

    if (!membership || membership.role !== 'leader') {
      return res.status(403).json({
        success: false,
        error: '需要社团会长权限'
      });
    }

    req.clubId = clubId;
    next();
  } catch (error) {
    console.error('社团会长权限验证失败:', error);
    return res.status(500).json({
      success: false,
      error: '权限验证服务器错误'
    });
  }
};

module.exports = {
  requireClubLeader
};
