/**
 * 活动提醒调度器服务
 * @description 基于事件驱动的定时器调度，零轮询资源消耗
 * @design 在活动开始前20分钟精确触发提醒，无需定时扫描
 */

const knex = require('../config/database');
const logger = require('../config/logger');
const { sendEventReminderToParticipants } = require('./notifyService');

/**
 * 提醒提前时间（分钟）
 */
const REMINDER_BEFORE_MINUTES = 20;

/**
 * 定时器存储
 * @description key: eventId, value: setTimeout 返回的 timer
 */
const reminderTimers = new Map();

/**
 * 解析活动时间字符串
 * @param {string} date - 日期字符串 (YYYY-MM-DD)
 * @param {string} time - 时间字符串 (HH:mm 或 HH:mm-HH:mm)
 * @returns {Date|null} 活动开始时间的 Date 对象
 */
function parseEventDateTime(date, time) {
  if (!date) return null;

  let startTime = time;
  if (time && time.includes('-')) {
    startTime = time.split('-')[0].trim();
  }

  if (!startTime) {
    startTime = '00:00';
  }

  const dateTimeStr = `${date} ${startTime}:00`;
  const eventDate = new Date(dateTimeStr);

  if (isNaN(eventDate.getTime())) {
    return null;
  }

  return eventDate;
}

/**
 * 计算提醒时间
 * @param {Date} eventStartTime - 活动开始时间
 * @returns {Date} 提醒时间
 */
function calculateReminderTime(eventStartTime) {
  return new Date(eventStartTime.getTime() - REMINDER_BEFORE_MINUTES * 60 * 1000);
}

/**
 * 记录已发送的提醒
 * @param {number} eventId - 活动ID
 * @param {number} recipientCount - 接收者数量
 */
async function recordReminderSent(eventId, recipientCount) {
  try {
    await knex('event_reminders').insert({
      event_id: eventId,
      reminder_type: 'before_start',
      recipient_count: recipientCount,
      sent_at: knex.fn.now()
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      logger.warn('提醒已发送过，跳过记录:', { eventId });
    } else {
      throw error;
    }
  }
}

/**
 * 发送活动提醒
 * @param {Object} event - 活动信息
 */
async function sendReminder(event) {
  try {
    logger.info('开始发送活动提醒:', {
      eventId: event.id,
      eventTitle: event.title
    });

    const eventData = {
      eventName: event.title,
      startTime: `${event.date} ${event.time || '00:00'}`,
      location: event.location || '待定',
      notes: event.description ? event.description.substring(0, 50) : '请准时参加活动'
    };

    const result = await sendEventReminderToParticipants(
      event.id,
      eventData,
      `/pages/events/detail/detail?id=${event.id}`
    );

    await recordReminderSent(event.id, result.success);

    logger.info('活动提醒发送完成:', {
      eventId: event.id,
      eventTitle: event.title,
      successCount: result.success,
      failedCount: result.failed
    });
  } catch (error) {
    logger.error('发送活动提醒失败:', {
      error: error.message,
      stack: error.stack,
      eventId: event.id
    });
  } finally {
    reminderTimers.delete(event.id);
  }
}

/**
 * 为单个活动调度提醒
 * @param {Object} event - 活动信息
 * @returns {boolean} 是否成功调度
 */
function scheduleEventReminder(event) {
  const eventStartTime = parseEventDateTime(event.date, event.time);
  if (!eventStartTime) {
    logger.warn('无法解析活动时间，跳过调度:', { eventId: event.id, date: event.date, time: event.time });
    return false;
  }

  const reminderTime = calculateReminderTime(eventStartTime);
  const now = new Date();

  if (reminderTime <= now) {
    logger.debug('活动提醒时间已过，跳过调度:', {
      eventId: event.id,
      reminderTime: reminderTime.toISOString()
    });
    return false;
  }

  if (reminderTimers.has(event.id)) {
    clearTimeout(reminderTimers.get(event.id));
    reminderTimers.delete(event.id);
  }

  const delay = reminderTime.getTime() - now.getTime();

  const timer = setTimeout(() => {
    sendReminder(event);
  }, delay);

  reminderTimers.set(event.id, timer);

  logger.info('活动提醒已调度:', {
    eventId: event.id,
    eventTitle: event.title,
    eventStartTime: eventStartTime.toISOString(),
    reminderTime: reminderTime.toISOString(),
    delayMinutes: Math.round(delay / 60000)
  });

  return true;
}

/**
 * 取消活动提醒
 * @param {number} eventId - 活动ID
 */
function cancelEventReminder(eventId) {
  if (reminderTimers.has(eventId)) {
    clearTimeout(reminderTimers.get(eventId));
    reminderTimers.delete(eventId);
    logger.info('活动提醒已取消:', { eventId });
  }
}

/**
 * 加载所有需要提醒的活动
 * @description 服务启动时调用，加载所有未来需要提醒的活动
 */
async function loadAllPendingReminders() {
  try {
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

    const events = await knex('events as e')
      .select(
        'e.id',
        'e.title',
        'e.date',
        'e.time',
        'e.location',
        'e.description'
      )
      .where('e.status', 'published')
      .where('e.approval_status', 'approved')
      .whereNotExists(function() {
        this.select('*')
          .from('event_reminders as er')
          .whereRaw('er.event_id = e.id')
          .where('er.reminder_type', 'before_start');
      })
      .whereRaw(`
        STR_TO_DATE(
          CONCAT(e.date, ' ', 
            CASE 
              WHEN e.time LIKE '%-%' THEN SUBSTRING_INDEX(e.time, '-', 1)
              WHEN e.time IS NOT NULL AND e.time != '' THEN e.time
              ELSE '00:00'
            END
          ),
          '%Y-%m-%d %H:%i'
        ) > ?
      `, [nowStr]);

    let scheduledCount = 0;
    for (const event of events) {
      if (scheduleEventReminder(event)) {
        scheduledCount++;
      }
    }

    logger.info(`活动提醒调度完成: 共加载 ${events.length} 个活动，成功调度 ${scheduledCount} 个提醒`);
    return { total: events.length, scheduled: scheduledCount };
  } catch (error) {
    logger.error('加载活动提醒失败:', {
      error: error.message,
      stack: error.stack
    });
    return { total: 0, scheduled: 0, error: error.message };
  }
}

/**
 * 清除所有定时器
 */
function clearAllTimers() {
  for (const [eventId, timer] of reminderTimers) {
    clearTimeout(timer);
  }
  reminderTimers.clear();
  logger.info('所有活动提醒定时器已清除');
}

/**
 * 获取调度器状态
 */
function getSchedulerStatus() {
  return {
    activeTimers: reminderTimers.size,
    eventIds: Array.from(reminderTimers.keys()),
    config: {
      reminderBeforeMinutes: REMINDER_BEFORE_MINUTES
    }
  };
}

module.exports = {
  scheduleEventReminder,
  cancelEventReminder,
  loadAllPendingReminders,
  clearAllTimers,
  getSchedulerStatus,
  REMINDER_BEFORE_MINUTES
};
