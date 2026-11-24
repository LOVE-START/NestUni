/**
 * Agent调用引擎
 * @description 核心调用循环：模型决策(tool_calls) → 执行器执行 → 结果回填 →
 * 继续决策或生成最终回复。循环上限maxIterations防刷Token，
 * callModel由aiService注入（避免循环依赖，同时便于测试mock）
 */
const aiConfig = require('../../config/ai');
const { getVisibleTools, getToolSchemasForModel } = require('./toolRegistry');
const { executeToolCall } = require('./toolExecutor');
const { buildAgentSystemPrompt } = require('./agentSystemPrompt');
const logger = require('../../config/logger');

/**
 * 工具查询结果 → 前端推荐卡片
 * @description 集中维护"工具→卡片类型"映射，避免在循环里堆叠if分支；
 * 卡片只传ID列表，前端按类型拉取展示详情（活动/社团/羽章卡片已有现成渲染）
 * @param {string} type - 卡片类型：events/clubs/badges
 * @param {Array} ids - 元素ID列表
 * @param {number} max - 最多展示数量
 * @returns {Object|null} { type, ids }，无有效ID时返回null
 */
function buildRecommendation(type, ids, max = 10) {
  // 去重并过滤非整数的无效ID（ID来源链路经过模型/数据库，入口处统一防御）
  const uniqueIds = [...new Set(ids.filter(id => Number.isInteger(id)))].slice(0, max);
  return uniqueIds.length > 0 ? { type, ids: uniqueIds } : null;
}

/**
 * 判断用户本轮问题是否在关注"社团"
 * @description get_my_overview同时返回已加入社团与即将参加的活动，
 * 需要按用户关注点选择卡片类型，避免问活动却只展示社团卡片（反之亦然）
 * @param {string} message - 用户消息
 * @returns {boolean} true=关注社团，false=关注活动
 */
function isClubQuestion(message) {
  return /社团|社團|club/i.test(message || '');
}

/**
 * 判断是否为"社团推荐"类问题（区别于"我的社团"）
 * @description "推荐适合我的社团/有什么社团推荐"需要展示候选社团卡片；
 * "我的社团有哪些"展示已加入社团卡片，两者不能混用
 * @param {string} message - 用户消息
 * @returns {boolean} true=社团推荐
 */
function isClubRecommendQuestion(message) {
  const text = message || '';
  return /社团|社團|club/i.test(text) && /推荐|适合/.test(text);
}

/**
 * 各查询工具的推荐卡片提取规则（新增查询工具时在此登记即可）
 * 提取函数签名：(data, message) => 卡片数据|null
 * [ADD] 招新场景复用社团卡片：前端无招新卡片，展示招新社团卡片可点击进入详情页报名
 * [ADD] 补齐get_my_overview：此前模型只调该工具回答"我的社团"时无任何卡片可用
 */
const RECOMMENDATION_EXTRACTORS = {
  search_events: data => buildRecommendation('events', (data.events || []).map(e => e.id)),
  search_nearby_events: data => buildRecommendation('events', (data.nearbyEvents || []).map(e => e.id)),
  search_clubs: data => buildRecommendation('clubs', (data.clubs || []).map(c => c.id)),
  get_my_badges: data => buildRecommendation('badges', (data.userBadges || []).map(b => b.id)),
  list_recruitments: data => buildRecommendation('clubs', (data.recruitments || []).map(r => r.clubId)),
  // 我的概览：问社团展示已加入社团卡片，问活动展示即将参加的活动卡片；
  // "推荐社团"问题不在这里出卡片（否则会把"我的社团"当成推荐结果）
  get_my_overview: (data, message) => {
    if (isClubRecommendQuestion(message)) return null;
    return isClubQuestion(message)
      ? buildRecommendation('clubs', (data.joinedClubs || []).map(c => c.id))
      : buildRecommendation('events', (data.upcomingEvents || []).map(e => e.id));
  }
};

/**
 * Agent错误（携带失败阶段，供aiService判断能否安全降级）
 * phase=initial：首轮调用失败，未执行任何工具，可降级到Pipeline重试
 * phase=loop/final：已执行过工具，降级会导致重复执行，禁止降级
 */
class AgentError extends Error {
  constructor(message, phase) {
    super(message);
    this.name = 'AgentError';
    this.phase = phase;
  }
}

/**
 * 运行Agent处理一条用户消息
 * @param {Object} params
 * @param {Object} params.actor - 操作者 { id, type, name }
 * @param {number} params.sessionId - 会话ID
 * @param {string} params.message - 用户消息
 * @param {Array} params.history - 历史消息 [{role, content}]
 * @param {string} params.profileContext - 用户画像上下文
 * @param {Object} [params.location] - 本次请求的用户定位 { latitude, longitude }（用于附近活动）
 * @param {Function} params.callModel - 模型调用函数 (messages, tools) => message完整对象（choices[0].message，含content与tool_calls）
 * @returns {Promise<{reply: string, steps: Array, pendingAction: Object|null, recommendations: Object|null}>}
 */
async function runAgent({ actor, sessionId, message, history, profileContext, location, callModel }) {
  // 按身份过滤工具：模型只能"看到"当前身份可用的工具（安全设计第3层）
  const visibleTools = getVisibleTools(actor);

  const messages = [
    { role: 'system', content: buildAgentSystemPrompt(actor) },
    // 画像作为独立system消息注入（个性化推荐的上下文依据）
    ...(profileContext ? [{ role: 'system', content: profileContext }] : []),
    ...history,
    { role: 'user', content: message }
  ];

  const steps = [];          // 工具执行步骤（前端展示）
  let pendingAction = null;  // 待确认操作（写工具，等待用户点击确认）
  let toolCallCount = 0;
  // [MODIFY] 推荐卡片数据：查询工具成功后由RECOMMENDATION_EXTRACTORS生成，
  // 前端按type（events/clubs/badges）渲染可点击卡片
  let recommendations = null;

  for (let i = 0; i < aiConfig.agent.maxIterations; i++) {
    let resp;
    try {
      resp = await callModel(messages, getToolSchemasForModel(visibleTools));
    } catch (error) {
      // 关键安全规则：只有"未执行过任何工具"的失败才允许降级重试，
      // 否则降级会重复执行已完成的操作（如重复报名）
      throw new AgentError(error.message, toolCallCount === 0 ? 'initial' : 'loop');
    }

    // [MODIFY] callModel（callQwenAPIRaw）直接返回choices[0].message对象本身，
    // 不能再取.message（否则为undefined，读tool会抛TypeError）
    const msg = resp;
    // 模型未请求工具 → 已生成最终回复，循环结束
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      // [FIX] content可能为null（内容审查/异常输出），chat_messages.content有NOT NULL约束，兜底防DB报错500
      return { reply: msg.content || '（抱歉，我暂时没有生成有效回复，请换个说法再试一次）', steps, pendingAction, recommendations };
    }

    // assistant消息（含tool_calls）原样回填对话
    messages.push(msg);

    for (const call of msg.tool_calls) {
      // 单轮工具调用总数上限（防模型循环刷工具）
      if (++toolCallCount > aiConfig.agent.maxToolCallsPerTurn) {
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ status: 'SKIPPED', message: '本轮工具调用次数已达上限，请直接回答用户' })
        });
        continue;
      }

      // 定位随上下文下传（附近活动等工具使用，模型参数中不包含位置）
      const result = await executeToolCall({ call, actor, sessionId, context: { location } });
      steps.push(result.step);
      if (result.pendingAction) {
        pendingAction = result.pendingAction;
      }
      // 查询成功则生成/更新推荐卡片（以最后一次有效结果为准）
      const extractor = RECOMMENDATION_EXTRACTORS[call.function.name];
      if (extractor && result.modelPayload.status === 'OK') {
        recommendations = extractor(result.modelPayload.data, message) || recommendations;
      }
      // 工具结果以role=tool消息回传，供模型下一轮决策
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result.modelPayload)
      });
    }
  }

  // 轮次耗尽：注入系统提示并去掉tools，强制模型立即收尾
  logger.warn('Agent工具调用轮次达到上限，强制收尾', { sessionId, actorId: actor.id });
  messages.push({ role: 'user', content: '（系统提示：工具调用轮次已达上限，请立即基于已获得的信息直接回答用户，不要再请求工具）' });
  try {
    const finalResp = await callModel(messages, []);
    // [MODIFY] finalResp就是message对象本身；content兜底防null（同上，NOT NULL约束）
    return { reply: finalResp.content || '（本轮工具调用已达上限，且未能生成最终回复，请重新提问）', steps, pendingAction, recommendations };
  } catch (error) {
    throw new AgentError(error.message, 'final');
  }
}

module.exports = { runAgent, AgentError };
