/**
 * AI服务模块
 * @description 封装通义千问(Qwen) API调用，支持上下文增强的对话。
 * [MODIFY] 集成Agent模式：Agent优先（工具调用循环），首轮API失败时自动降级到原Pipeline；
 * 会话按身份（user/admin）隔离；新增写操作确认执行/取消闭环
 */

const axios = require('axios');
const db = require('../config/database');
const logger = require('../config/logger');
const aiConfig = require('../config/ai');
const { detectIntent, retrieveContext, buildContextMessage, getUserProfile } = require('./contextBuilder/index');
const { runAgent, AgentError } = require('./agent/engine');
const { buildActorProfileMessage } = require('./agent/agentSystemPrompt');
const { verifyActionToken, verifySignature } = require('./agent/actionToken');
const { executeConfirmedAction } = require('./agent/toolExecutor');
const { claimPendingAction, updateToolCallStatus } = require('./agent/auditLogger');
const { BusinessError, PermissionError } = require('../utils/errors');

/**
 * 获取本次请求的模型候选列表
 * @description 主模型优先，其后依次为降级模型（去重）；均建议使用官方稳定别名，
 * 避免带日期的快照型号下线后服务直接不可用
 * @returns {string[]} 模型列表
 */
function resolveModelCandidates() {
  const { model, fallbackModels = [] } = aiConfig.api;
  return [...new Set([model, ...fallbackModels].filter(Boolean))];
}

/**
 * 判断错误是否属于"模型本身不可用"
 * @description 仅这类错误才值得切换备用模型：404模型不存在、403无权限、429限流；
 * 超时/网络错误不切换，避免重复等待导致响应时间翻倍
 * @param {Error} error - axios错误对象
 * @returns {boolean} 是否需要尝试备用模型
 */
function isModelUnavailableError(error) {
  const status = error.response?.status;
  const code = error.response?.data?.error?.code || error.response?.data?.code;
  return (
    status === 404 || status === 403 || status === 429 ||
    code === 'model_not_found' || code === 'access_denied' || code === 'limit_requests'
  );
}

/**
 * 调用Qwen API（完整版，Agent专用）
 * @description 支持tools参数（Function Calling），返回完整message对象（含tool_calls）；
 * 主模型不可用（下线/无权限/限流）时自动按 fallbackModels 顺序降级重试
 * @param {Array} messages - 消息列表
 * @param {Array} [tools] - 工具Schema列表（空数组表示纯对话）
 * @returns {Object} choices[0].message 完整对象
 */
async function callQwenAPIRaw(messages, tools = []) {
  const { baseUrl, apiKey, maxTokens, temperature, timeout } = aiConfig.api;

  if (!apiKey) {
    throw new Error('QWEN_API_KEY 未配置，请在 .env 文件中设置');
  }

  const body = { messages, max_tokens: maxTokens, temperature };
  // 仅在有工具时携带tools参数（兼容纯对话调用）
  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const candidates = resolveModelCandidates();
  let lastError = null;
  let failedModel = candidates[0];

  for (let i = 0; i < candidates.length; i++) {
    failedModel = candidates[i];
    try {
      const response = await axios.post(`${baseUrl}/chat/completions`, { ...body, model: candidates[i] }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout
      });

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message;
      }
      throw new Error('Qwen API返回数据格式异常');
    } catch (error) {
      lastError = error;
      const hasFallback = i < candidates.length - 1;
      // 仅模型级不可用才切换，其他错误（超时/参数错误/格式异常）直接抛出
      if (!hasFallback || !isModelUnavailableError(error)) {
        break;
      }
      logger.warn('当前模型不可用，自动切换备用模型:', {
        model: candidates[i],
        nextModel: candidates[i + 1],
        status: error.response?.status,
        code: error.response?.data?.error?.code
      });
    }
  }

  if (lastError.response) {
    logger.error('Qwen API错误:', {
      model: failedModel,
      status: lastError.response.status,
      data: lastError.response.data
    });
    throw new Error(`AI服务请求失败: ${lastError.response.status}`);
  }
  if (lastError.code === 'ECONNABORTED') {
    throw new Error('AI服务请求超时，请稍后重试');
  }
  throw lastError;
}

/**
 * 调用Qwen API进行对话（兼容旧Pipeline，只返回文本内容）
 * [MODIFY] 复用callQwenAPIRaw，保持原签名与返回值不变
 */
async function callQwenAPI(messages) {
  const message = await callQwenAPIRaw(messages);
  return message.content;
}

/**
 * 处理用户聊天消息（Agent模式入口）
 * @description Agent优先：走工具调用循环；首轮API失败时自动降级到旧Pipeline
 * （降级条件见AgentError.phase，已执行过工具则绝不降级，防止重复执行）
 * @param {Object} actor - 操作者 { id, type: 'user'|'admin', name }
 * @param {number} sessionId - 会话ID
 * @param {string} message - 用户消息
 * @param {Object} [options] - 额外选项（位置信息等）
 * @returns {Object} AI回复及元数据
 */
async function handleChatMessage(actor, sessionId, message, options = {}) {
  // [MODIFY] 防御性访问：服务器config/ai.js未同步agent配置段时aiConfig.agent为undefined，
  // 直接降级到Pipeline模式，避免TypeError导致整个接口500
  if (aiConfig.agent?.enabled) {
    try {
      return await handleChatMessageViaAgent(actor, sessionId, message, options);
    } catch (error) {
      // 仅"首轮失败且未执行任何工具"才降级；管理员身份无旧Pipeline语义，直接抛出
      const canFallback = error instanceof AgentError && error.phase === 'initial' && actor.type === 'user';
      if (!canFallback) {
        throw error;
      }
      logger.warn('Agent首轮调用失败，降级到Pipeline模式:', {
        error: error.message, sessionId, actorId: actor.id
      });
    }
  }
  return await handleChatMessagePipeline(actor, sessionId, message, options);
}

/**
 * Agent模式消息处理
 * @description 构建上下文→运行引擎→事务持久化（user与assistant两条消息）
 * @returns {Object} { reply, intent, sessionId, recommendations, agent }
 */
async function handleChatMessageViaAgent(actor, sessionId, message, options) {
  const history = await getSessionHistory(sessionId);
  const profileContext = await buildActorProfileMessage(actor);
  // 本次请求携带的定位（附近活动工具的查询依据，避免模型索取/编造坐标）
  const location = options.latitude && options.longitude
    ? { latitude: options.latitude, longitude: options.longitude }
    : null;

  const result = await runAgent({
    actor,
    sessionId,
    message,
    history,
    profileContext,
    location,
    callModel: callQwenAPIRaw // 注入模型调用函数（依赖倒置，避免循环依赖）
  });

  let assistantMessageId = null;
  await db.transaction(async (trx) => {
    await trx('chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: message,
      metadata: JSON.stringify({ intent: 'agent' })
    });

    const ids = await trx('chat_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: result.reply,
      // agent元数据：工具步骤+待确认操作（前端渲染步骤条与确认卡片的依据）
      // [MODIFY] recommendations一并落库：刷新会话后社团推荐卡片仍可恢复展示
      metadata: JSON.stringify({
        intent: 'agent',
        recommendations: result.recommendations,
        agent: { steps: result.steps, pendingAction: result.pendingAction }
      })
    });
    assistantMessageId = ids[0];

    const updateData = { updated_at: db.fn.now() };
    if (history.length === 0) {
      updateData.title = message.length > 20 ? message.substring(0, 20) + '...' : message;
    }
    await trx('chat_sessions').where({ id: sessionId }).update(updateData);
  });

  return {
    reply: result.reply,
    intent: 'agent',
    sessionId,
    // [MODIFY] Agent路径透传推荐卡片数据（search_clubs查询结果），
    // 前端渲染可点击社团卡片引导用户自行填表申请——Agent只推荐不代办入社
    recommendations: result.recommendations,
    agent: {
      steps: result.steps,
      // messageId用于确认后回写"已处理"状态
      pendingAction: result.pendingAction
        ? { ...result.pendingAction, messageId: assistantMessageId }
        : null
    }
  };
}

/**
 * 处理用户聊天消息（旧Pipeline模式，Agent的降级通道）
 * @description 使用事务确保消息存储和会话更新的原子性
 * [MODIFY] 原handleChatMessage重命名，参数userId改为actor
 * @param {Object} actor - 操作者 { id, type }
 * @param {number} sessionId - 会话ID
 * @param {string} message - 用户消息
 * @param {Object} options - 额外选项（位置信息等）
 * @returns {Object} AI回复及元数据
 */
async function handleChatMessagePipeline(actor, sessionId, message, options = {}) {
  // [MODIFY] Pipeline降级通道仅服务学生身份（管理员无画像/检索语义）
  const userId = actor.id;
  const intent = detectIntent(message);
  logger.info('AI聊天意图识别:', { userId, sessionId, intent, messageLength: message.length });

  const contextData = await retrieveContext(intent, userId, message, options);
  const userProfile = await getUserProfile(userId);
  const contextMessage = buildContextMessage(intent, contextData, userProfile, message);

  const historyMessages = await getSessionHistory(sessionId);

  const messages = [
    { role: 'system', content: aiConfig.systemPrompt },
    { role: 'system', content: contextMessage },
    ...historyMessages,
    { role: 'user', content: message }
  ];

  const aiReply = await callQwenAPI(messages);

  // 提取推荐ID列表
  const recommendations = extractRecommendations(intent, contextData);

  // 使用事务确保数据一致性
  await db.transaction(async (trx) => {
    await trx('chat_messages').insert([
      {
        session_id: sessionId,
        role: 'user',
        content: message,
        metadata: JSON.stringify({ intent })
      },
      {
        session_id: sessionId,
        role: 'assistant',
        content: aiReply,
        metadata: JSON.stringify({ intent, contextUsed: true, recommendations })
      }
    ]);

    const updateData = { updated_at: db.fn.now() };
    if (historyMessages.length === 0) {
      updateData.title = message.length > 20 ? message.substring(0, 20) + '...' : message;
    }

    await trx('chat_sessions')
      .where({ id: sessionId })
      .update(updateData);
  });

  return {
    reply: aiReply,
    intent,
    sessionId,
    recommendations
  };
}

/**
 * 从上下文数据中提取推荐ID列表
 * @description 根据意图类型从上下文数据中提取推荐的活动/社团ID
 * 只有在明确匹配到用户兴趣时才返回推荐卡片，避免返回全量数据
 * @param {string} intent - 意图类型
 * @param {Object} contextData - 上下文数据
 * @returns {Object|null} 推荐数据
 */
function extractRecommendations(intent, contextData) {
  switch (intent) {
    case 'club_recommend':
      if (contextData.clubs && contextData.clubs.length > 0) {
        // 没有匹配结果时不返回推荐
        if (contextData.hasInterestMatch && contextData.matchedCount === 0) {
          return null;
        }
        // 没有兴趣关键词匹配时，contextData.clubs是全量社团，不应作为推荐卡片
        // 此时AI会从文字回复中推荐，卡片只展示有明确兴趣匹配的社团
        if (!contextData.hasInterestMatch) {
          return null;
        }
        // 限制推荐数量，避免卡片过多
        const maxRecommend = 10;
        const recommendIds = contextData.clubs.slice(0, maxRecommend).map(c => c.id);
        return {
          type: 'clubs',
          ids: recommendIds,
          reason: contextData.hasExactMatch ? '根据你的兴趣推荐' : '同分类社团推荐'
        };
      }
      break;

    case 'event_recommend':
      if (contextData.events && contextData.events.length > 0) {
        return {
          type: 'events',
          ids: contextData.events.slice(0, 10).map(e => e.id),
          reason: '近期热门活动'
        };
      }
      break;

    case 'nearby_event':
      if (contextData.nearbyEvents && contextData.nearbyEvents.length > 0) {
        return {
          type: 'events',
          ids: contextData.nearbyEvents.slice(0, 10).map(e => e.id),
          reason: '离你最近的活动'
        };
      }
      break;

    case 'recruitment_info':
      if (contextData.recruitments && contextData.recruitments.length > 0) {
        return {
          type: 'recruitments',
          ids: contextData.recruitments.slice(0, 10).map(r => r.id),
          reason: '正在招新'
        };
      }
      break;

    case 'club_info':
      if (contextData.clubs && contextData.clubs.length > 0) {
        return {
          type: 'clubs',
          ids: contextData.clubs.slice(0, 5).map(c => c.id),
          reason: '相关社团信息'
        };
      }
      break;

    case 'badge_info':
      if (contextData.userBadges && contextData.userBadges.length > 0) {
        return {
          type: 'badges',
          ids: contextData.userBadges.slice(0, 10).map(b => b.id),
          reason: '你的羽章'
        };
      }
      break;

    case 'badge_recommend':
      if (contextData.recommendations && contextData.recommendations.length > 0) {
        return {
          type: 'badges',
          ids: contextData.recommendations.slice(0, 10).map(r => r.badge.id),
          reason: '推荐羽章'
        };
      }
      break;
  }

  return null;
}

/**
 * 获取会话历史消息
 * @param {number} sessionId - 会话ID
 * @returns {Array} 历史消息列表
 */
async function getSessionHistory(sessionId) {
  const maxMessages = aiConfig.chat.maxHistoryMessages;

  const messages = await db('chat_messages')
    .select('role', 'content')
    .where({ session_id: sessionId })
    .orderBy('created_at', 'asc');

  const recent = messages.slice(-maxMessages);

  return recent.map(m => ({
    role: m.role,
    content: m.content
  }));
}

/**
 * 创建新的聊天会话
 * @description 使用事务确保会话创建和旧会话清理的原子性
 * [MODIFY] 按身份隔离会话（解决users.id与admins.id冲突问题）
 * @param {Object} actor - 操作者 { id, type }
 * @returns {Object} 新创建的会话
 */
async function createSession(actor) {
  return await db.transaction(async (trx) => {
    // 幂等复用：若该用户已存在空白（无消息）会话，直接返回它，
    // 避免每次"新建对话"都重复创建空白会话、浪费资源
    const existingEmpty = await trx('chat_sessions')
      .where({ user_id: actor.id, owner_type: actor.type })
      .whereNotExists(function () {
        this.select(db.raw('1'))
          .from('chat_messages')
          .whereRaw('chat_messages.session_id = chat_sessions.id');
      })
      .orderBy('created_at', 'desc')
      .first();

    if (existingEmpty) {
      return {
        id: existingEmpty.id,
        title: existingEmpty.title,
        createdAt: existingEmpty.created_at
      };
    }

    const sessionCount = await trx('chat_sessions')
      .where({ user_id: actor.id, owner_type: actor.type })
      .count('id as count')
      .first();

    if (sessionCount.count >= aiConfig.chat.maxSessionsPerUser) {
      const oldestSession = await trx('chat_sessions')
        .where({ user_id: actor.id, owner_type: actor.type })
        .orderBy('updated_at', 'asc')
        .first();

      if (oldestSession) {
        await trx('chat_messages').where({ session_id: oldestSession.id }).del();
        await trx('chat_sessions').where({ id: oldestSession.id }).del();
      }
    }

    const [sessionId] = await trx('chat_sessions').insert({
      user_id: actor.id,
      owner_type: actor.type, // [MODIFY] 记录会话归属身份
      title: aiConfig.chat.defaultSessionTitle
    });

    return {
      id: sessionId,
      title: aiConfig.chat.defaultSessionTitle,
      createdAt: new Date().toISOString()
    };
  });
}

/**
 * 获取用户的会话列表
 * [MODIFY] 按身份过滤
 * [MODIFY] 只返回包含消息的会话，空白会话不进入历史列表
 * @param {Object} actor - 操作者 { id, type }
 * @returns {Array} 会话列表
 */
async function getUserSessions(actor) {
  return await db('chat_sessions')
    .select('id', 'title', 'created_at', 'updated_at')
    .where({ user_id: actor.id, owner_type: actor.type })
    .whereExists(function () {
      this.select(db.raw('1'))
        .from('chat_messages')
        .whereRaw('chat_messages.session_id = chat_sessions.id');
    })
    .orderBy('updated_at', 'desc');
}

/**
 * 获取会话消息列表
 * [MODIFY] 会话归属校验增加身份维度
 * @param {number} sessionId - 会话ID
 * @param {Object} actor - 操作者 { id, type }（用于权限验证）
 * @returns {Array} 消息列表
 */
async function getSessionMessages(sessionId, actor) {
  const session = await db('chat_sessions')
    .where({ id: sessionId, user_id: actor.id, owner_type: actor.type })
    .first();

  if (!session) return null;

  return await db('chat_messages')
    .select('id', 'role', 'content', 'metadata', 'created_at')
    .where({ session_id: sessionId })
    .orderBy('created_at', 'asc');
}

/**
 * 删除聊天会话
 * @description 使用事务确保消息和会话删除的原子性
 * [MODIFY] 会话归属校验增加身份维度
 * @param {number} sessionId - 会话ID
 * @param {Object} actor - 操作者 { id, type }
 * @returns {boolean} 是否删除成功
 */
async function deleteSession(sessionId, actor) {
  return await db.transaction(async (trx) => {
    const session = await trx('chat_sessions')
      .where({ id: sessionId, user_id: actor.id, owner_type: actor.type })
      .first();

    if (!session) return false;

    await trx('chat_messages').where({ session_id: sessionId }).del();
    await trx('chat_sessions').where({ id: sessionId }).del();

    return true;
  });
}

/**
 * 确认执行Agent待确认操作
 * @description 严谨闭环：验签+验期 → 身份/会话匹配 → 原子抢占审计记录（令牌单次消费）
 * → 执行器重校验并执行 → 审计终态回写 → 结果落为助手消息 → 原卡片标记已处理。
 * 注意：前置校验（验签/身份/抢占）失败直接抛错、不插入任何消息——
 * 这些是安全拒绝而非操作结果，不产生对话垃圾；只有真正执行过才有结果消息
 * @param {Object} actor - 操作者
 * @param {number} sessionId - 会话ID
 * @param {string} actionToken - 确认令牌
 * @param {number|null} [messageId] - 携带确认卡片的消息ID（用于回写已处理状态）
 * @returns {Object} { success, message }
 */
async function confirmAgentAction(actor, sessionId, actionToken, messageId = null) {
  // 1. 验签+验期
  const payload = verifyActionToken(actionToken);

  if (!payload) {
    // 签名有效但已过期：惰性把审计记录标记为cancelled（不留僵尸pending记录）
    const expired = verifySignature(actionToken);
    if (expired && expired.logId) {
      await updateToolCallStatus(expired.logId, 'cancelled', '确认令牌已过期');
    }
    throw new BusinessError('确认已过期或无效，请重新发起操作');
  }

  // 2. 令牌绑定校验：操作者与会话必须完全匹配（防跨用户/跨会话重放）
  if (payload.actorId !== actor.id || payload.actorType !== actor.type) {
    throw new PermissionError('确认令牌与当前用户不匹配');
  }
  if (Number(payload.sessionId) !== Number(sessionId)) {
    throw new BusinessError('确认令牌与会话不匹配');
  }

  // 3. 会话归属校验
  const session = await db('chat_sessions')
    .where({ id: sessionId, user_id: actor.id, owner_type: actor.type })
    .first();
  if (!session) {
    throw new BusinessError('会话不存在或无权访问');
  }

  // 4. 原子抢占审计记录（pending_confirm→executing）：同一令牌的并发/重复请求
  // 只有一个能成功，从机制上杜绝二次执行
  const claimed = await claimPendingAction(payload.logId);
  if (!claimed) {
    throw new BusinessError('该操作已被处理或已取消，请重新发起');
  }

  // 5. 执行（执行器内部做权限/参数的防御性重校验），并回写审计终态
  let resultMessage;
  let execError = null;
  try {
    const result = await executeConfirmedAction({ payload, actor });
    resultMessage = `✅ ${result.message || '操作已执行'}`;
    await updateToolCallStatus(payload.logId, 'success');
  } catch (error) {
    resultMessage = `❌ 操作失败：${error.message}`;
    await updateToolCallStatus(payload.logId, 'failed', error.message);
    execError = error;
    execError.resultMessage = resultMessage; // 路由层返回给前端展示用
  }

  // 6. 执行结果写入助手消息（模型下一轮对话可见，保持上下文连贯）
  await db('chat_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: resultMessage,
    metadata: JSON.stringify({ intent: 'agent', agent: { actionResult: true } })
  });
  await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });

  // 7. 标记原消息的确认卡片已处理（重新加载历史时不再显示可点击卡片）
  await markPendingActionResolved(messageId, sessionId);

  // 执行失败时抛出原错误（保留错误类型，路由层按类型映射HTTP状态码）
  if (execError) {
    throw execError;
  }

  return { success: true, message: resultMessage };
}

/**
 * 取消Agent待确认操作
 * @description 用户点击"取消"时调用：审计记录置为cancelled（消灭僵尸pending）、
 * 回写卡片已处理、插入取消结果消息（模型下一轮知道用户取消了，不会追问执行结果）
 * @param {Object} actor - 操作者
 * @param {number} sessionId - 会话ID
 * @param {string} actionToken - 确认令牌
 * @param {number|null} [messageId] - 携带确认卡片的消息ID
 * @returns {Object} { success, message }
 */
async function cancelAgentAction(actor, sessionId, actionToken, messageId = null) {
  // 取消只需验签（令牌可能刚过期，但用户明确取消意图优先），不需抢占成功才允许取消
  const payload = verifySignature(actionToken);
  if (!payload) {
    throw new BusinessError('无效的确认令牌');
  }
  if (payload.actorId !== actor.id || payload.actorType !== actor.type) {
    throw new PermissionError('确认令牌与当前用户不匹配');
  }

  // 审计记录置为cancelled（幂等：已cancelled/executing/success时update条件不匹配，行数0也返回成功）
  if (payload.logId) {
    await db('agent_tool_logs')
      .where({ id: payload.logId, status: 'pending_confirm' })
      .update({ status: 'cancelled', error_message: '用户取消' });
  }

  const cancelMessage = '🚫 您已取消该操作，未执行任何变更。';
  await db('chat_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: cancelMessage,
    metadata: JSON.stringify({ intent: 'agent', agent: { actionResult: true } })
  });
  await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
  await markPendingActionResolved(messageId, sessionId);

  return { success: true, message: cancelMessage };
}

/**
 * 标记原消息的pendingAction已处理
 * @description 独立成函数供confirm/cancel复用；异常不阻断主流程
 * @param {number|null} messageId - 消息ID
 * @param {number} sessionId - 会话ID（校验消息归属）
 */
async function markPendingActionResolved(messageId, sessionId) {
  if (!messageId) return;
  try {
    const original = await db('chat_messages').where({ id: messageId, session_id: sessionId }).first();
    if (original && original.metadata) {
      const meta = typeof original.metadata === 'string' ? JSON.parse(original.metadata) : original.metadata;
      if (meta.agent && meta.agent.pendingAction) {
        meta.agent.pendingAction.resolved = true;
        await db('chat_messages').where({ id: messageId }).update({ metadata: JSON.stringify(meta) });
      }
    }
  } catch (e) {
    logger.warn('标记确认卡片已处理失败:', { messageId, error: e.message });
  }
}

module.exports = {
  handleChatMessage,
  handleChatMessagePipeline,
  confirmAgentAction,
  cancelAgentAction,
  createSession,
  getUserSessions,
  getSessionMessages,
  deleteSession,
  callQwenAPI,
  callQwenAPIRaw
};
