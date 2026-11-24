/**
 * routes/badges.js - 羽章系统路由
 * @description 处理羽章的发放、查询、更新等操作
 */
const express = require('express');
const router = express.Router();
const knex = require('../config/database');
const { verifyToken, optionalAuth, requireAdmin } = require('../middleware/auth');
const logger = require('../config/logger');
const { calculateActivityScore } = require('../services/activityStatsService');

// ============================================
// 羽章核心业务逻辑
// ============================================

/**
 * 检查并发放羽章
 * @param {number} userId - 用户ID
 * @param {string} triggerEvent - 触发事件
 * @param {object} eventData - 事件数据
 * @returns {Promise<Array>} 发放的羽章列表
 */
async function checkAndAwardBadge(userId, triggerEvent, eventData = {}) {
  try {
    const badges = await knex('badges')
      .where('trigger_type', triggerEvent)
      .where('is_active', true);
    
    const awardedBadges = [];
    
    for (const badge of badges) {
      const existingBadge = await knex('user_badges')
        .where('user_id', userId)
        .where('badge_id', badge.id)
        .first();
      
      if (existingBadge && badge.type !== 'level') {
        continue;
      }
      
      const condition = typeof badge.trigger_condition === 'string' 
        ? JSON.parse(badge.trigger_condition || '{}') 
        : badge.trigger_condition;
      const shouldAward = await checkCondition(userId, condition, eventData);
      
      if (shouldAward) {
        await awardBadge(userId, badge.id, badge.type, existingBadge);
        awardedBadges.push(badge);
      }
    }
    
    return awardedBadges;
  } catch (error) {
    logger.error('检查并发放羽章失败:', error);
    throw error;
  }
}

/**
 * 检查触发条件
 */
async function checkCondition(userId, condition, eventData) {
  const { check_type, conditions } = condition;
  
  switch (check_type) {
    case 'immediate':
      return checkImmediateCondition(userId, conditions, eventData);
    case 'aggregate':
      return checkAggregateCondition(userId, conditions);
    case 'level':
      return checkLevelCondition(userId, conditions);
    case 'manual':
      return false;
    default:
      return false;
  }
}

/**
 * 检查即时条件
 */
async function checkImmediateCondition(userId, conditions, eventData) {
  if (!conditions) return true;
  
  if (conditions.user_id && conditions.user_id.lte) {
    if (userId > conditions.user_id.lte) return false;
  }
  
  if (conditions.role) {
    const user = await knex('users').where('id', userId).first();
    if (!user || user.role !== conditions.role) return false;
  }
  
  if (conditions.has_student_id) {
    const user = await knex('users').where('id', userId).first();
    if (!user || !user.student_id) return false;
  }
  
  if (conditions.has_wechat) {
    const user = await knex('users').where('id', userId).first();
    if (!user || !user.wechat) return false;
  }
  
  return true;
}

/**
 * 检查聚合条件
 */
async function checkAggregateCondition(userId, conditions) {
  if (!conditions) return false;
  
  if (conditions.total_clubs) {
    const count = await knex('club_members')
      .where('user_id', userId)
      .count('club_id as count')
      .first();
    if (conditions.total_clubs.gte && count.count < conditions.total_clubs.gte) {
      return false;
    }
  }
  
  if (conditions.total_events) {
    const count = await knex('event_participants')
      .where('user_id', userId)
      .where('status', 'approved')
      .count('event_id as count')
      .first();
    if (conditions.total_events.gte && count.count < conditions.total_events.gte) {
      return false;
    }
  }
  
  if (conditions.total_comments) {
    const count = await knex('comments')
      .where('user_id', userId)
      .count('id as count')
      .first();
    if (conditions.total_comments.gte && count.count < conditions.total_comments.gte) {
      return false;
    }
  }
  
  if (conditions.total_applications) {
    const count = await knex('applications')
      .where('user_id', userId)
      .count('id as count')
      .first();
    if (conditions.total_applications.gte && count.count < conditions.total_applications.gte) {
      return false;
    }
  }
  
  if (conditions.membership_days) {
    const membership = await knex('club_members')
      .where('user_id', userId)
      .min('joined_at as earliest')
      .first();
    if (membership.earliest) {
      const days = Math.floor((new Date() - new Date(membership.earliest)) / (1000 * 60 * 60 * 24));
      if (conditions.membership_days.gte && days < conditions.membership_days.gte) {
        return false;
      }
    } else {
      return false;
    }
  }
  
  return true;
}

/**
 * 检查等级条件
 */
async function checkLevelCondition(userId, conditions) {
  if (!conditions || !conditions.activity_score) return false;
  
  const activityScore = await calculateActivityScore(userId);
  const { min, max } = conditions.activity_score;
  
  return activityScore >= min && activityScore <= max;
}

/**
 * 发放羽章
 */
async function awardBadge(userId, badgeId, badgeType, existingBadge) {
  const trx = await knex.transaction();
  
  try {
    if (badgeType === 'level' && existingBadge) {
      await trx('user_badges')
        .where('id', existingBadge.id)
        .update({
          earned_at: new Date(),
          updated_at: new Date()
        });
      
      await trx('badge_logs').insert({
        user_id: userId,
        badge_id: badgeId,
        action: 'upgraded',
        created_at: new Date()
      });
    } else {
      await trx('user_badges').insert({
        user_id: userId,
        badge_id: badgeId,
        earned_at: new Date(),
        is_displayed: false
      });
      
      await trx('badge_logs').insert({
        user_id: userId,
        badge_id: badgeId,
        action: 'earned',
        created_at: new Date()
      });
    }
    
    await trx.commit();
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

/**
 * 获取用户羽章列表
 */
async function getUserBadges(userId) {
  const badges = await knex('user_badges')
    .join('badges', 'user_badges.badge_id', 'badges.id')
    .where('user_badges.user_id', userId)
    .select(
      'badges.*',
      'user_badges.earned_at',
      'user_badges.is_displayed',
      'user_badges.display_order',
      'user_badges.metadata'
    )
    .orderBy('user_badges.earned_at', 'desc');
  
  const stats = {
    achievement: 0,
    level: 0,
    identity: 0
  };
  
  badges.forEach(badge => {
    stats[badge.type]++;
  });
  
  return {
    total: badges.length,
    badges,
    stats
  };
}

/**
 * 获取所有羽章列表
 */
async function getAllBadges(userId = null) {
  let query = knex('badges')
    .where('is_active', true)
    .orderBy('sort_order', 'asc');
  
  const badges = await query;
  
  if (userId) {
    const userBadges = await knex('user_badges')
      .where('user_id', userId)
      .select('badge_id', 'earned_at');
    
    const userBadgeMap = {};
    userBadges.forEach(ub => {
      userBadgeMap[ub.badge_id] = ub.earned_at;
    });
    
    badges.forEach(badge => {
      badge.is_earned = !!userBadgeMap[badge.id];
      badge.earned_at = userBadgeMap[badge.id] || null;
    });
  }
  
  return badges;
}

/**
 * 更新羽章展示设置
 */
async function updateDisplaySettings(userId, badgeIds, displayOrders) {
  const trx = await knex.transaction();
  
  try {
    await trx('user_badges')
      .where('user_id', userId)
      .update({ is_displayed: false, display_order: 0 });
    
    for (let i = 0; i < badgeIds.length; i++) {
      const badgeId = badgeIds[i];
      await trx('user_badges')
        .where('user_id', userId)
        .where('badge_id', badgeId)
        .update({
          is_displayed: true,
          display_order: displayOrders[badgeId] || i
        });
    }
    
    await trx.commit();
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

/**
 * 手动发放羽章（管理员）
 */
async function manualAwardBadge(userId, badgeId) {
  const badge = await knex('badges').where('id', badgeId).first();
  if (!badge) {
    throw new Error('羽章不存在');
  }
  
  const existingBadge = await knex('user_badges')
    .where('user_id', userId)
    .where('badge_id', badgeId)
    .first();
  
  if (existingBadge) {
    throw new Error('用户已获得该羽章');
  }
  
  await awardBadge(userId, badgeId, badge.type, null);
}

/**
 * 获取用户羽章统计
 */
async function getUserBadgeStats(userId) {
  const result = await getUserBadges(userId);
  
  let totalPoints = 0;
  const byRarity = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const byType = { achievement: 0, level: 0, identity: 0 };
  
  result.badges.forEach(badge => {
    totalPoints += badge.points;
    byRarity[badge.rarity]++;
    byType[badge.type]++;
  });
  
  const recentBadges = result.badges.slice(0, 5).map(b => ({
    id: b.id,
    name: b.name,
    earned_at: b.earned_at
  }));
  
  return {
    total_badges: result.total,
    total_points: totalPoints,
    by_rarity: byRarity,
    by_type: byType,
    recent_badges: recentBadges
  };
}

// ============================================
// 路由定义
// ============================================

/**
 * 批量获取羽章详情
 * GET /nfunest/api/badges/by-ids
 */
router.get('/by-ids', verifyToken, async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.json({ success: true, data: [] });
    }
    
    const idList = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (idList.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const badges = await knex('badges')
      .whereIn('id', idList)
      .where('is_active', true);
    
    const badgeMap = {};
    badges.forEach(badge => {
      badgeMap[badge.id] = badge;
    });
    
    const orderedBadges = idList
      .filter(id => badgeMap[id])
      .map(id => badgeMap[id]);
    
    res.json({ success: true, data: orderedBadges });
  } catch (error) {
    console.error('批量获取羽章失败:', error);
    res.status(500).json({ success: false, message: '获取羽章失败' });
  }
});

/**
 * 获取所有羽章列表
 * GET /nfunest/api/badges
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, rarity, category, sort } = req.query;
    
    let badges = await getAllBadges(userId);
    
    if (type) {
      badges = badges.filter(b => b.type === type);
    }
    if (rarity) {
      badges = badges.filter(b => b.rarity === rarity);
    }
    if (category) {
      badges = badges.filter(b => b.category === category);
    }
    
    if (sort === 'rarity') {
      const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
      badges.sort((a, b) => rarityOrder[b.rarity] - rarityOrder[a.rarity]);
    } else if (sort === 'earned_at') {
      badges.sort((a, b) => {
        if (!a.earned_at && !b.earned_at) return 0;
        if (!a.earned_at) return 1;
        if (!b.earned_at) return -1;
        return new Date(b.earned_at) - new Date(a.earned_at);
      });
    }
    
    res.json({ success: true, data: badges });
  } catch (error) {
    console.error('获取羽章列表失败:', error);
    res.status(500).json({ success: false, message: '获取羽章列表失败' });
  }
});

/**
 * 获取用户羽章列表
 * GET /nfunest/api/badges/my
 */
router.get('/my', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserBadges(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取用户羽章失败:', error);
    res.status(500).json({ success: false, message: '获取用户羽章失败' });
  }
});

/**
 * 获取羽章详情
 * GET /nfunest/api/badges/:id
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const badgeId = req.params.id;
    
    const badges = await getAllBadges(userId);
    const badge = badges.find(b => b.id === parseInt(badgeId));
    
    if (!badge) {
      return res.status(404).json({ success: false, message: '羽章不存在' });
    }
    
    res.json({ success: true, data: badge });
  } catch (error) {
    console.error('获取羽章详情失败:', error);
    res.status(500).json({ success: false, message: '获取羽章详情失败' });
  }
});

/**
 * 更新羽章展示设置
 * PUT /nfunest/api/badges/my/display
 */
router.put('/my/display', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { badge_ids, display_orders } = req.body;
    
    await updateDisplaySettings(userId, badge_ids, display_orders);
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新羽章展示设置失败:', error);
    res.status(500).json({ success: false, message: '更新羽章展示设置失败' });
  }
});

/**
 * 获取用户羽章统计
 * GET /nfunest/api/badges/my/stats
 */
router.get('/my/stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getUserBadgeStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取羽章统计失败:', error);
    res.status(500).json({ success: false, message: '获取羽章统计失败' });
  }
});

/**
 * 获取用户活跃度
 * GET /nfunest/api/badges/my/activity
 */
router.get('/my/activity', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const activityScore = await calculateActivityScore(userId);
    
    let level = 'bronze';
    if (activityScore >= 81) level = 'diamond';
    else if (activityScore >= 61) level = 'gold';
    else if (activityScore >= 31) level = 'silver';
    
    res.json({
      success: true,
      data: {
        activity_score: activityScore,
        level: level
      }
    });
  } catch (error) {
    console.error('获取用户活跃度失败:', error);
    res.status(500).json({ success: false, message: '获取用户活跃度失败' });
  }
});

/**
 * 手动发放羽章（管理员）
 * POST /nfunest/api/badges/:id/award
 */
router.post('/:id/award', verifyToken, requireAdmin, async (req, res) => {
  try {
    const badgeId = req.params.id;
    const { user_id } = req.body;

    // 参数验证
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '请指定要授予的用户'
      });
    }

    await manualAwardBadge(user_id, badgeId);

    res.json({ success: true, message: '羽章发放成功' });
  } catch (error) {
    logger.error('发放羽章失败:', error);

    // 区分业务错误和服务器错误
    const businessErrors = ['羽章不存在', '用户已获得该羽章'];
    const isBusinessError = businessErrors.some(msg => error.message.includes(msg));

    if (isBusinessError) {
      // 业务错误返回400状态码
      res.status(400).json({
        success: false,
        message: error.message
      });
    } else {
      // 服务器错误返回500状态码
      res.status(500).json({
        success: false,
        message: '服务器内部错误，请稍后重试'
      });
    }
  }
});

// 导出路由和核心函数（供其他模块调用）
module.exports = router;
module.exports.checkAndAwardBadge = checkAndAwardBadge;
module.exports.calculateActivityScore = calculateActivityScore;
