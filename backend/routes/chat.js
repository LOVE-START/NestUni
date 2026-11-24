/**
 * AI聊天路由
 * @description 提供AI助手聊天相关的API端点
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const logger = require('../config/logger');
const db = require('../config/database');
const aiService = require('../services/aiService');
const { BusinessError, PermissionError } = require('../utils/errors');

const router = express.Router();

/**
 * Agent对话专用限流（比全局限流更严格）
 * @description Agent每条消息触发多次模型调用，成本高，单独收紧频率防恶意刷Token
 */
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // 每分钟每IP最多20次
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试' }
});

/**
 * 构造Agent操作者对象
 * @description 身份唯一来源是JWT解析出的req.user/req.userType——
 * 安全设计第2层：模型与前端传来的任何身份字段一律不采信
 * @param {Object} req - 请求对象（含JWT解析结果）
 * @returns {Object} actor对象 { id, type, name, level }
 */
function buildActor(req) {
  return {
    id: req.user.id,
    type: req.userType, // 'user' | 'admin'
    name: req.user.nickname || req.user.username || '用户', // admins表无nickname字段，用username兜底
    level: req.user.level || null
  };
}

/**
 * 创建新的聊天会话
 * @route POST /nfunest/api/chat/sessions
 */
router.post('/sessions', verifyToken, agentLimiter, async (req, res, next) => {
  try {
    const session = await aiService.createSession(buildActor(req));
    logger.info('创建聊天会话:', { userId: req.user.id, sessionId: session.id });
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('创建聊天会话失败:', { error: error.message, userId: req.user.id });
    next(error);
  }
});

/**
 * 获取用户的会话列表
 * @route GET /nfunest/api/chat/sessions
 */
router.get('/sessions', verifyToken, async (req, res, next) => {
  try {
    const sessions = await aiService.getUserSessions(buildActor(req));
    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error('获取会话列表失败:', { error: error.message, userId: req.user.id });
    next(error);
  }
});

/**
 * 删除聊天会话
 * @route DELETE /nfunest/api/chat/sessions/:id
 */
router.delete('/sessions/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await aiService.deleteSession(parseInt(id), buildActor(req));

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: '会话不存在或无权删除'
      });
    }

    logger.info('删除聊天会话:', { sessionId: id, userId: req.user.id });
    res.json({
      success: true,
      message: '会话删除成功'
    });
  } catch (error) {
    logger.error('删除会话失败:', { error: error.message, sessionId: req.params.id });
    next(error);
  }
});

/**
 * 获取会话消息列表
 * @route GET /nfunest/api/chat/sessions/:id/messages
 */
router.get('/sessions/:id/messages', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const messages = await aiService.getSessionMessages(parseInt(id), buildActor(req));

    if (messages === null) {
      return res.status(404).json({
        success: false,
        error: '会话不存在或无权访问'
      });
    }

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    logger.error('获取会话消息失败:', { error: error.message, sessionId: req.params.id });
    next(error);
  }
});

/**
 * 发送聊天消息（核心接口）
 * @route POST /nfunest/api/chat/sessions/:id/messages
 * @body {string} message - 用户消息
 * @body {number} [latitude] - 用户纬度（用于附近活动查询）
 * @body {number} [longitude] - 用户经度（用于附近活动查询）
 * [MODIFY] 接入Agent模式：响应新增agent字段（工具步骤+待确认操作）
 */
router.post('/sessions/:id/messages', verifyToken, agentLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, latitude, longitude } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: '消息内容不能为空'
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        error: '消息内容不能超过2000字'
      });
    }

    const actor = buildActor(req);
    // [MODIFY] 会话归属校验加owner_type，管理员与学生身份的会话相互隔离
    const session = await db('chat_sessions')
      .where({ id: parseInt(id), user_id: actor.id, owner_type: actor.type })
      .first();

    if (!session) {
      return res.status(404).json({
        success: false,
        error: '会话不存在或无权访问'
      });
    }

    const options = {};
    if (latitude && longitude) {
      options.latitude = parseFloat(latitude);
      options.longitude = parseFloat(longitude);
    }

    const result = await aiService.handleChatMessage(
      actor,
      parseInt(id),
      message.trim(),
      options
    );

    res.json({
      success: true,
      data: {
        reply: result.reply,
        intent: result.intent,
        sessionId: result.sessionId,
        recommendations: result.recommendations,
        agent: result.agent || null // [MODIFY] Agent步骤与待确认操作
      }
    });
  } catch (error) {
    logger.error('处理聊天消息失败:', {
      error: error.message,
      stack: error.stack,
      sessionId: req.params.id,
      userId: req.user?.id
    });

    if (error.message.includes('QWEN_API_KEY')) {
      return res.status(503).json({
        success: false,
        error: 'AI服务未配置，请联系管理员'
      });
    }

    if (error.message.includes('超时')) {
      return res.status(504).json({
        success: false,
        error: 'AI服务响应超时，请稍后重试'
      });
    }

    next(error);
  }
});

/**
 * 确认执行Agent待确认操作（写操作二次确认的执行入口）
 * @route POST /nfunest/api/chat/sessions/:id/confirm
 * @body {string} actionToken - 确认令牌（来自响应的agent.pendingAction.token）
 * @body {number} [messageId] - 携带确认卡片的消息ID
 */
router.post('/sessions/:id/confirm', verifyToken, agentLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actionToken, messageId } = req.body;

    if (!actionToken) {
      return res.status(400).json({
        success: false,
        error: '缺少确认令牌'
      });
    }

    const actor = buildActor(req);
    const result = await aiService.confirmAgentAction(
      actor,
      parseInt(id),
      actionToken,
      messageId ? parseInt(messageId) : null
    );

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('确认Agent操作失败:', {
      error: error.message,
      sessionId: req.params.id,
      userId: req.user?.id
    });

    // 业务/令牌错误返回可读消息（前端用resultMessage展示）
    if (error instanceof BusinessError || error instanceof PermissionError) {
      return res.status(error instanceof PermissionError ? 403 : 400).json({
        success: false,
        error: error.resultMessage || error.message
      });
    }
    next(error);
  }
});

/**
 * 取消Agent待确认操作
 * @description 用户点击确认卡片"取消"按钮时调用：审计记录置cancelled、卡片标记已处理、
 * 落取消结果消息。取消必须走后端（不能只改前端状态），否则审计表会留下永久pending记录
 * @route POST /nfunest/api/chat/sessions/:id/cancel-action
 * @body {string} actionToken - 确认令牌
 * @body {number} [messageId] - 携带确认卡片的消息ID
 */
router.post('/sessions/:id/cancel-action', verifyToken, agentLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actionToken, messageId } = req.body;

    if (!actionToken) {
      return res.status(400).json({
        success: false,
        error: '缺少确认令牌'
      });
    }

    const actor = buildActor(req);
    const result = await aiService.cancelAgentAction(
      actor,
      parseInt(id),
      actionToken,
      messageId ? parseInt(messageId) : null
    );

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('取消Agent操作失败:', {
      error: error.message,
      sessionId: req.params.id,
      userId: req.user?.id
    });

    if (error instanceof BusinessError || error instanceof PermissionError) {
      return res.status(error instanceof PermissionError ? 403 : 400).json({
        success: false,
        error: error.resultMessage || error.message
      });
    }
    next(error);
  }
});

module.exports = router;
