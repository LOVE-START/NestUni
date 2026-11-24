/**
 * 调度器服务
 * @description 管理活动提醒定时器的启动和停止
 * @design 基于事件驱动，零轮询资源消耗
 */

const logger = require('../config/logger');
const {
  loadAllPendingReminders,
  clearAllTimers,
  getSchedulerStatus,
  scheduleEventReminder,
  cancelEventReminder,
  REMINDER_BEFORE_MINUTES
} = require('./eventReminderService');

/**
 * 启动调度器
 * @description 服务启动时调用，加载所有需要提醒的活动
 */
async function startScheduler() {
  logger.info('正在启动活动提醒调度器...');
  const result = await loadAllPendingReminders();
  logger.info(`活动提醒调度器启动完成: 加载 ${result.total} 个活动，调度 ${result.scheduled} 个提醒`);
  return result;
}

/**
 * 停止调度器
 * @description 服务关闭时调用，清除所有定时器
 */
function stopScheduler() {
  logger.info('正在停止活动提醒调度器...');
  clearAllTimers();
  logger.info('活动提醒调度器已停止');
}

/**
 * 获取调度器状态
 */
function getStatus() {
  return {
    ...getSchedulerStatus(),
    description: `活动开始前 ${REMINDER_BEFORE_MINUTES} 分钟发送提醒`
  };
}

module.exports = {
  startScheduler,
  stopScheduler,
  getStatus,
  scheduleEventReminder,
  cancelEventReminder,
  REMINDER_BEFORE_MINUTES
};
