/**
 * Agent工具执行器——安全流水线核心
 * @description 每次工具调用的固定处理顺序：
 * 白名单校验 → 参数解析与Schema校验 → 执行层权限校验 →
 * [读工具]直接执行 / [写工具]频控检查+预检+签发含logId的确认令牌（本轮不执行）
 * 全路径审计留痕（安全设计第1/2/3/4/5层的实际执行点）
 * 写工具审计状态机：pending_confirm →(用户确认)→ executing → success/failed，
 * 或 pending_confirm →(用户取消/令牌过期)→ cancelled，令牌单次消费
 */
const aiConfig = require('../../config/ai');
const { findTool, getVisibleTools, getWriteToolNames } = require('./toolRegistry');
const { checkToolPermission } = require('./permissionGuard');
const { validateParams } = require('./paramValidator');
const { signActionToken } = require('./actionToken');
const { logToolCall, countRecentWriteOps } = require('./auditLogger');
const { ValidationError, PermissionError, BusinessError } = require('../../utils/errors');

// 工具步骤展示名（前端渲染步骤条用）
const TOOL_STEP_LABELS = {
  search_events: '查询活动',
  search_nearby_events: '查询附近活动',
  search_clubs: '查询社团',
  get_my_overview: '读取我的信息',
  get_my_badges: '查询我的羽章',
  list_recruitments: '查询招新信息',
  list_pending_approvals: '获取待审核列表',
  enroll_activity: '活动报名',
  cancel_enrollment: '取消报名',
  review_approval: '审核操作',
  add_club_member: '添加成员'
};

/** 按错误类型映射调用状态（审计用） */
function statusOf(error) {
  if (error instanceof PermissionError) return 'denied';
  if (error instanceof ValidationError) return 'denied';
  return 'failed';
}

/**
 * 执行一次模型发起的工具调用（Agent循环内调用）
 * @param {Object} params
 * @param {Object} params.call - 模型返回的tool_call {id, function:{name, arguments}}
 * @param {Object} params.actor - 操作者（身份来自JWT）
 * @param {number} params.sessionId - 会话ID
 * @param {Object} [params.context] - 服务端执行上下文（如本次请求的定位），不来自模型输出
 * @returns {Promise<{modelPayload: Object, step: Object, pendingAction: Object|null}>}
 *          modelPayload回传给模型；step供前端展示；pendingAction为待确认操作（写工具）
 */
async function executeToolCall({ call, actor, sessionId, context = {} }) {
  const start = Date.now();
  const toolName = call.function.name;
  let args = {};

  try {
    // ── 1. 白名单+可见性校验：模型幻觉出的工具名在此拦截 ──
    const tool = findTool(toolName);
    const visible = getVisibleTools(actor).some(t => t.name === toolName);
    if (!tool || !visible) {
      throw new PermissionError(`无权使用工具 ${toolName}`);
    }

    // ── 2. 参数解析与Schema校验（模型输出视为不可信输入） ──
    try {
      args = JSON.parse(call.function.arguments || '{}');
    } catch (e) {
      throw new ValidationError('工具参数不是合法的JSON');
    }
    const { valid, errors, value } = validateParams(tool.parameters, args);
    if (!valid) {
      throw new ValidationError(`参数校验失败: ${errors.join('; ')}`);
    }
    args = value; // 使用清洗后的参数（仅保留声明字段）

    // ── 3. 执行层权限校验（与可见性过滤双保险） ──
    await checkToolPermission(tool, actor, args);

    // ── 4a. 读工具：直接执行（context携带服务端可信信息，如定位） ──
    if (tool.type === 'read') {
      const data = await tool.execute(actor, args, context);
      await logToolCall({ sessionId, actor, toolName, args, status: 'success', durationMs: Date.now() - start });
      return {
        modelPayload: { status: 'OK', data },
        step: { tool: toolName, label: TOOL_STEP_LABELS[toolName] || toolName, status: 'success' },
        pendingAction: null
      };
    }

    // ── 4b. 写工具：频控检查 → 预检 → 审计落库 → 签发含logId令牌（本轮绝不执行！） ──
    const recentOps = await countRecentWriteOps(actor, 1, getWriteToolNames());
    if (recentOps >= aiConfig.agent.maxWriteOpsPerHour) {
      throw new BusinessError(`操作过于频繁（每小时限${aiConfig.agent.maxWriteOpsPerHour}次写操作），请稍后再试`);
    }

    // 构建确认卡片摘要：同时前置预检业务条件（已报名/已截止/已满/已是成员等），
    // 可预见的失败在此抛出，不会弹出注定失败的确认卡片
    const summary = await tool.buildSummary(actor, args);

    // 先写pending_confirm审计记录拿到logId（令牌与审计记录绑定，确认/取消/过期均可回写终态）
    const logId = await logToolCall({
      sessionId, actor, toolName, args,
      status: 'pending_confirm', durationMs: Date.now() - start
    });
    if (!logId) {
      // 审计写入失败则拒绝发起确认（不留不可追溯的操作）
      throw new BusinessError('系统繁忙，请稍后重试');
    }

    // 签名令牌绑定：工具+参数+操作者+会话+审计记录ID，5分钟有效
    const token = signActionToken(
      { tool: toolName, args, actorId: actor.id, actorType: actor.type, sessionId, logId },
      aiConfig.agent.confirmTokenTTLms
    );

    return {
      modelPayload: {
        status: 'CONFIRMATION_REQUIRED',
        message: '已向用户展示操作确认卡片，本次操作尚未执行。请在回复中提示用户：需要点击卡片上的【确认执行】按钮，操作才会真正生效。'
      },
      step: { tool: toolName, label: TOOL_STEP_LABELS[toolName] || toolName, status: 'confirm_required' },
      pendingAction: { token, tool: toolName, summary }
    };
  } catch (error) {
    // ── 全路径审计：被拒绝/失败的调用同样留痕 ──
    await logToolCall({
      sessionId, actor, toolName, args,
      status: statusOf(error),
      errorMessage: error.message,
      durationMs: Date.now() - start
    });
    return {
      modelPayload: { status: statusOf(error).toUpperCase(), message: error.message },
      step: { tool: toolName, label: TOOL_STEP_LABELS[toolName] || toolName, status: statusOf(error) === 'denied' ? 'denied' : 'error' },
      pendingAction: null
    };
  }
}

/**
 * 执行用户确认后的写操作（由chat路由的/confirm端点调用）
 * @description 令牌已验签通过，此处做防御性重校验（权限/参数可能在等待期变化）后执行。
 * 注意：logId的原子抢占（pending_confirm→executing）由调用方aiService在验签后完成，
 * 本函数只负责重校验+执行+终态回写
 * @param {Object} params
 * @param {Object} params.payload - 验签后的令牌内容 { tool, args, actorId, actorType, sessionId, logId }
 * @param {Object} params.actor - 当前操作者
 * @returns {Promise<{success: boolean, message: string}>} 执行结果
 */
async function executeConfirmedAction({ payload, actor }) {
  const start = Date.now();
  const tool = findTool(payload.tool);

  try {
    if (!tool || tool.type !== 'write') {
      throw new PermissionError('无效的操作类型');
    }

    // 防御性重校验：参数Schema（令牌中的args已是验签数据，但仍走一遍清洗）
    const { valid, errors, value } = validateParams(tool.parameters, payload.args || {});
    if (!valid) {
      throw new ValidationError(`参数校验失败: ${errors.join('; ')}`);
    }

    // 防御性重校验：权限（等待确认期间身份/会长角色可能已变化）
    await checkToolPermission(tool, actor, value);

    const result = await tool.execute(actor, value);
    return result;
  } catch (error) {
    // 抛给调用方，由调用方统一回写审计终态（failed）
    throw error;
  }
}

module.exports = { executeToolCall, executeConfirmedAction };
