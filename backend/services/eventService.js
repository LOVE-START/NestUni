/**
 * 活动业务服务层
 * @description 从routes/events.js提取的报名/取消报名核心业务逻辑，
 * 供活动路由与Agent工具共用，保证业务规则（名额/截止时间/重复报名）全局一致
 */
const moment = require('moment');
const db = require('../config/database');
const logger = require('../config/logger');
const { validateEventExists, validateEventParticipation } = require('../utils/validators');
const { checkAndAwardBadge } = require('../routes/badges');
const { updateActivityStats, decrementActivityStats } = require('./activityStatsService');
const { BusinessError } = require('../utils/errors');

/**
 * 报名活动
 * @description 完整校验链：活动存在→已发布→未截止→未重复报名→名额未满→事务写入
 * [MODIFY] 名额校验改为原子条件更新（防并发超卖）：原实现先查current_participants再increment，
 * 两个并发请求可同时通过检查导致超卖；现改为UPDATE ... WHERE current_participants < max_participants
 * 并检查受影响行数，为0即名额已被抢完
 * 通知联动说明：活动开始提醒是活动级定时器（审核通过时调度），触发时动态查询
 * event_participants表获取参与者——报名写入后自动纳入提醒范围，无需在此处额外调度
 * @param {number} eventId - 活动ID
 * @param {number} userId - 报名用户ID（来自JWT，绝不接受模型参数）
 * @returns {Promise<void>} 成功无返回，失败抛BusinessError（用户可读消息）
 */
async function enrollUser(eventId, userId) {
  const event = await validateEventExists(eventId);
  if (!event) {
    throw new BusinessError('活动不存在');
  }

  // 检查活动状态
  if (event.status !== 'published') {
    throw new BusinessError('活动未发布，无法报名');
  }

  // 检查报名截止时间
  if (event.registration_deadline && moment().isAfter(moment(event.registration_deadline))) {
    throw new BusinessError('报名时间已截止');
  }

  // 检查是否已经报名（不包括已取消的）
  const existingParticipation = await validateEventParticipation(eventId, userId);
  if (existingParticipation) {
    throw new BusinessError('您已经报名此活动');
  }

  // 检查是否曾经参加过（包括已取消的，用于判断更新还是插入记录）
  const previousParticipation = await db('event_participants')
    .where({ event_id: eventId, user_id: userId })
    .first();

  // 检查人数限制（快速失败提示；并发安全的最终防线在事务内的原子条件更新）
  if (event.max_participants && event.current_participants >= event.max_participants) {
    throw new BusinessError('活动人数已满');
  }

  // 事务保证参与者记录与计数的一致性
  await db.transaction(async (trx) => {
    if (previousParticipation && previousParticipation.status === 'cancelled') {
      // 如果之前取消过，更新状态为 approved（防止刷活跃度：取消记录保留）
      await trx('event_participants')
        .where({ event_id: eventId, user_id: userId })
        .update({
          status: 'approved',
          registered_at: trx.fn.now()
        });
    } else {
      // 首次报名，插入新记录
      await trx('event_participants').insert({
        event_id: eventId,
        user_id: userId,
        registered_at: trx.fn.now(),
        status: 'approved'
      });
    }

    // [MODIFY] 原子条件递增：WHERE子句内联名额检查，并发下只有一个请求能成功递增
    // 不限人数的活动(max_participants为NULL)直接递增
    const incremented = await trx('events')
      .where({ id: eventId })
      .whereRaw('(? IS NULL OR current_participants < ?)', [event.max_participants, event.max_participants])
      .increment('current_participants', 1);

    // 受影响行数为0说明并发请求已抢完最后名额，回滚整个事务（参与者记录一并回滚）
    if (incremented === 0) {
      throw new BusinessError('活动人数已满');
    }
  });

  logger.info('用户报名活动:', { eventId, userId });

  // 触发羽章检查和活跃度统计更新（异步执行，不阻塞响应）
  setImmediate(async () => {
    try {
      await updateActivityStats(userId, 'event');
      await checkAndAwardBadge(userId, 'event.attended');
      await checkAndAwardBadge(userId, 'user.activity_update');
    } catch (err) {
      logger.error('活跃度统计或羽章检查失败:', {
        error: err.message,
        stack: err.stack,
        userId,
        eventId
      });
    }
  });
}

/**
 * 取消报名
 * @description 校验已报名且未过截止时间后，将状态置为cancelled并递减计数（不删记录，防刷分）
 * 通知联动说明：活动开始提醒触发时动态查询event_participants（仅pending/approved/checked_in状态），
 * 取消后状态变cancelled即自动退出提醒范围，无需额外撤销动作
 * @param {number} eventId - 活动ID
 * @param {number} userId - 用户ID（来自JWT）
 * @returns {Promise<void>}
 */
async function cancelEnrollment(eventId, userId) {
  const participation = await validateEventParticipation(eventId, userId, ['pending', 'approved']);
  if (!participation) {
    throw new BusinessError('您未报名此活动或已取消报名');
  }

  const event = await validateEventExists(eventId);
  if (event.registration_deadline && moment().isAfter(moment(event.registration_deadline))) {
    throw new BusinessError('报名截止后不允许取消报名');
  }

  await db.transaction(async (trx) => {
    // 更新状态为 cancelled，而不是删除记录（防止刷分）
    await trx('event_participants')
      .where({ event_id: eventId, user_id: userId })
      .update({ status: 'cancelled' });

    await trx('events').where({ id: eventId }).decrement('current_participants', 1);
  });

  logger.info('用户取消报名:', { eventId, userId });

  // 减少活跃度统计（异步执行，不阻塞响应）
  setImmediate(async () => {
    try {
      await decrementActivityStats(userId, 'event');
    } catch (err) {
      logger.error('活跃度统计减少失败:', { error: err.message, stack: err.stack, userId });
    }
  });
}

module.exports = { enrollUser, cancelEnrollment };
