/**
 * 活跃度统计服务
 * @description 管理用户活跃度统计数据的更新和计算
 */

const knex = require('../config/database');
const logger = require('../config/logger');

/**
 * 统计类型映射
 * @description 将统计类型映射到数据库字段
 * 注意：login_count 字段实际用于记录页面访问次数
 */
const STAT_TYPE_MAP = {
  login: 'login_count',      // 实际记录页面访问次数
  event: 'event_count',
  comment: 'comment_count',
  application: 'application_count'
};

/**
 * 每日统计上限配置
 * @description 限制每种类型每天最多增加的次数，防止刷分
 */
const DAILY_LIMITS = {
  login_count: 5,            // 页面访问每天最多计5次
  event_count: null,         // 活动参与无上限
  comment_count: null,       // 评论无上限
  application_count: null    // 招新报名无上限
};

/**
 * 计算用户活跃度分数
 * @description 基于最近30天的统计数据计算活跃度分数
 * 计算规则：页面访问×1 + 参与活动×5 + 评论×2 + 报名×3，最高100分
 * @param {number} userId - 用户ID
 * @returns {Promise<number>} 活跃度分数（0-100）
 */
async function calculateActivityScore(userId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const stats = await knex('user_activity_stats')
    .where('user_id', userId)
    .where('stat_date', '>=', thirtyDaysAgo)
    .select(
      knex.raw('SUM(login_count) as total_logins'),        // 页面访问次数
      knex.raw('SUM(event_count) as total_events'),
      knex.raw('SUM(comment_count) as total_comments'),
      knex.raw('SUM(application_count) as total_applications')
    )
    .first();

  const score = Math.min(100, Math.floor(
    (stats.total_logins || 0) * 1 +      // 页面访问：每次 +1 分
    (stats.total_events || 0) * 5 +      // 参与活动：每次 +5 分
    (stats.total_comments || 0) * 2 +    // 发表评论：每条 +2 分
    (stats.total_applications || 0) * 3  // 招新报名：每次 +3 分
  ));

  return score;
}

/**
 * 获取本地日期字符串（YYYY-MM-DD格式）
 * @description 解决时区问题，使用服务器本地时间而非UTC时间
 * @returns {string} 本地日期字符串
 */
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 更新用户活跃度统计
 * @description 更新指定类型的统计数据，并重新计算活跃度分数
 * @param {number} userId - 用户ID
 * @param {string} type - 统计类型: 'login' | 'event' | 'comment' | 'application'
 * @returns {Promise<void>}
 */
async function updateActivityStats(userId, type) {
  const field = STAT_TYPE_MAP[type];
  if (!field) {
    logger.warn('无效的活跃度统计类型:', { userId, type });
    return;
  }

  logger.info('开始更新活跃度统计:', { userId, type, field });

  const today = getLocalDateString();
  logger.info('活跃度统计日期:', { today, timezone: 'local' });
  let trx;

  try {
    trx = await knex.transaction();

    // 使用 INSERT ... ON DUPLICATE KEY UPDATE 解决并发竞态问题
    // 原子操作：存在则更新，不存在则插入，避免 TOCTOU 问题
    const dailyLimit = DAILY_LIMITS[field];
    
    if (dailyLimit !== null) {
      // 有每日上限的情况：先检查当前值
      const existing = await trx('user_activity_stats')
        .where({ user_id: userId, stat_date: today })
        .first();
      
      const currentValue = existing ? (existing[field] || 0) : 0;
      if (currentValue >= dailyLimit) {
        logger.info('活跃度统计已达每日上限，跳过更新:', { 
          userId, 
          type, 
          field, 
          currentValue, 
          dailyLimit 
        });
        await trx.commit();
        return;
      }
    }

    // 使用 ON DUPLICATE KEY UPDATE 进行原子操作
    await trx.raw(`
      INSERT INTO user_activity_stats (user_id, stat_date, ${field}, activity_score)
      VALUES (?, ?, 1, 0)
      ON DUPLICATE KEY UPDATE ${field} = ${field} + 1
    `, [userId, today]);

    logger.info('活跃度统计记录已更新:', { userId, type, field, today });

    const score = await calculateActivityScore(userId);
    
    await trx('user_activity_stats')
      .where({ user_id: userId, stat_date: today })
      .update({ activity_score: score });

    await trx.commit();

    logger.info('活跃度统计更新成功:', { 
      userId, 
      type, 
      field,
      activityScore: score 
    });
  } catch (error) {
    if (trx) {
      try {
        await trx.rollback();
      } catch (rollbackError) {
        logger.error('事务回滚失败:', { 
          rollbackError: rollbackError.message, 
          userId, 
          type 
        });
      }
    }
    logger.error('活跃度统计更新失败:', { 
      error: error.message, 
      stack: error.stack,
      userId, 
      type,
      field,
      today
    });
    throw error;
  }
}

/**
 * 减少用户活跃度统计
 * @description 减少指定类型的统计数据，并重新计算活跃度分数
 * @param {number} userId - 用户ID
 * @param {string} type - 统计类型: 'login' | 'event' | 'comment' | 'application'
 * @returns {Promise<void>}
 */
async function decrementActivityStats(userId, type) {
  const field = STAT_TYPE_MAP[type];
  if (!field) {
    logger.warn('无效的活跃度统计类型:', { userId, type });
    return;
  }

  logger.info('开始减少活跃度统计:', { userId, type, field });

  const today = getLocalDateString();
  logger.info('活跃度统计日期:', { today, timezone: 'local' });
  let trx;

  try {
    trx = await knex.transaction();

    const existing = await trx('user_activity_stats')
      .where({ user_id: userId, stat_date: today })
      .first();

    logger.info('查询今日统计记录:', { 
      userId, 
      today, 
      found: !!existing,
      currentValue: existing ? existing[field] : 0
    });

    if (existing && existing[field] > 0) {
      await trx('user_activity_stats')
        .where({ id: existing.id })
        .decrement(field, 1);

      const score = await calculateActivityScore(userId);
      
      await trx('user_activity_stats')
        .where({ user_id: userId, stat_date: today })
        .update({ activity_score: score });

      logger.info('活跃度统计减少成功:', { 
        userId, 
        type, 
        field,
        activityScore: score 
      });
    } else {
      logger.warn('无法减少活跃度统计: 今日无记录或值为0', { 
        userId, 
        type, 
        field,
        today,
        hasRecord: !!existing,
        currentValue: existing ? existing[field] : 0
      });
    }

    await trx.commit();
  } catch (error) {
    if (trx) {
      try {
        await trx.rollback();
      } catch (rollbackError) {
        logger.error('事务回滚失败:', { 
          rollbackError: rollbackError.message, 
          userId, 
          type 
        });
      }
    }
    logger.error('活跃度统计减少失败:', { 
      error: error.message, 
      stack: error.stack,
      userId, 
      type 
    });
    throw error;
  }
}

/**
 * 批量更新活跃度统计
 * @description 一次更新多个统计类型
 * @param {number} userId - 用户ID
 * @param {string[]} types - 统计类型数组
 * @returns {Promise<void>}
 */
async function batchUpdateActivityStats(userId, types) {
  for (const type of types) {
    await updateActivityStats(userId, type);
  }
}

/**
 * 获取用户活跃度统计详情
 * @description 获取用户最近30天的详细统计数据
 * @param {number} userId - 用户ID
 * @returns {Promise<Object>} 统计详情
 */
async function getActivityStatsDetail(userId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalStats, dailyStats, activityScore] = await Promise.all([
    knex('user_activity_stats')
      .where('user_id', userId)
      .where('stat_date', '>=', thirtyDaysAgo)
      .select(
        knex.raw('SUM(login_count) as total_logins'),
        knex.raw('SUM(event_count) as total_events'),
        knex.raw('SUM(comment_count) as total_comments'),
        knex.raw('SUM(application_count) as total_applications')
      )
      .first(),
    
    knex('user_activity_stats')
      .where('user_id', userId)
      .where('stat_date', '>=', thirtyDaysAgo)
      .orderBy('stat_date', 'desc')
      .limit(7),
    
    calculateActivityScore(userId)
  ]);

  return {
    totalStats: {
      logins: totalStats.total_logins || 0,
      events: totalStats.total_events || 0,
      comments: totalStats.total_comments || 0,
      applications: totalStats.total_applications || 0
    },
    dailyStats,
    activityScore
  };
}

module.exports = {
  updateActivityStats,
  decrementActivityStats,
  batchUpdateActivityStats,
  calculateActivityScore,
  getActivityStatsDetail
};
