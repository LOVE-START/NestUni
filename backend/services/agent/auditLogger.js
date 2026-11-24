/**
 * Agent工具调用审计日志
 * @description 安全设计第5层：所有工具调用（含被拒绝的）全部落库留痕，
 * 同时为"每小时写操作频控"提供实时统计数据源。
 * 写工具走状态机闭环：pending_confirm → executing → success/failed，
 * 或 pending_confirm → cancelled（用户取消/令牌过期），杜绝僵尸pending记录
 */
const db = require('../../config/database');
const logger = require('../../config/logger');

/**
 * 记录一次工具调用
 * @param {Object} params
 * @param {number|null} params.sessionId - 聊天会话ID
 * @param {Object} params.actor - 操作者 { id, type }
 * @param {string} params.toolName - 工具名
 * @param {Object} params.args - 工具参数
 * @param {string} params.status - 状态机初始状态
 * @param {string|null} [params.errorMessage] - 失败/拒绝原因
 * @param {number|null} [params.durationMs] - 执行耗时
 * @returns {Promise<number|null>} 新插入记录的ID（写工具签发令牌需要嵌入logId，失败返回null）
 */
async function logToolCall({ sessionId, actor, toolName, args, status, errorMessage = null, durationMs = null }) {
  try {
    const [logId] = await db('agent_tool_logs').insert({
      session_id: sessionId || null,
      actor_id: actor.id,
      actor_type: actor.type,
      tool_name: toolName,
      arguments: JSON.stringify(args || {}),
      status,
      error_message: errorMessage ? String(errorMessage).slice(0, 500) : null,
      duration_ms: durationMs
    });
    return logId;
  } catch (error) {
    // 审计写入失败不阻断主流程，但必须记入运行日志供排查
    logger.error('写入Agent审计日志失败:', { error: error.message, toolName, actorId: actor.id });
    return null;
  }
}

/**
 * 原子抢占待确认记录（令牌单次消费的核心）
 * @description 条件更新 pending_confirm → executing：并发/重复请求中只有一个能成功，
 * 其余因受影响行数为0而失败——从机制上杜绝同一确认令牌被执行两次
 * @param {number} logId - 审计记录ID
 * @returns {Promise<boolean>} 抢占成功返回true（记录原本是pending_confirm）
 */
async function claimPendingAction(logId) {
  const updated = await db('agent_tool_logs')
    .where({ id: logId, status: 'pending_confirm' })
    .update({ status: 'executing' });
  return updated > 0;
}

/**
 * 更新记录终态（success/failed/cancelled）
 * @param {number} logId - 审计记录ID
 * @param {string} status - 终态
 * @param {string|null} [errorMessage] - 失败/取消原因
 * @param {number|null} [durationMs] - 执行耗时
 */
async function updateToolCallStatus(logId, status, errorMessage = null, durationMs = null) {
  try {
    await db('agent_tool_logs')
      .where({ id: logId })
      .update({
        status,
        error_message: errorMessage ? String(errorMessage).slice(0, 500) : null,
        duration_ms: durationMs
      });
  } catch (error) {
    logger.error('更新Agent审计日志状态失败:', { error: error.message, logId, status });
  }
}

/**
 * 统计操作者近N小时的写工具成功次数（频控数据源）
 * @param {Object} actor - 操作者 { id, type }
 * @param {number} hours - 统计时间窗口（小时）
 * @param {string[]} writeToolNames - 写工具名列表（由toolRegistry提供）
 * @returns {Promise<number>} 成功执行次数
 */
async function countRecentWriteOps(actor, hours, writeToolNames) {
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const row = await db('agent_tool_logs')
    .where({ actor_id: actor.id, actor_type: actor.type })
    .whereIn('tool_name', writeToolNames)
    .where({ status: 'success' })
    .where('created_at', '>', since)
    .count('id as count')
    .first();
  return row ? Number(row.count) : 0;
}

module.exports = { logToolCall, claimPendingAction, updateToolCallStatus, countRecentWriteOps };
