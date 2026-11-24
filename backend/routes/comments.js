// routes/comments.js - 评论相关路由
const express = require('express');
const db = require('../config/database');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const logger = require('../config/logger');
const { checkAndAwardBadge } = require('./badges');
const { updateActivityStats, decrementActivityStats } = require('../services/activityStatsService');

const router = express.Router();

/**
 * 获取用户已佩戴的羽章
 * @param {number} userId - 用户ID
 * @returns {Promise<Array>} 已佩戴的羽章列表
 */
async function getUserDisplayedBadges(userId) {
  const badges = await db('user_badges')
    .join('badges', 'user_badges.badge_id', 'badges.id')
    .where('user_badges.user_id', userId)
    .where('user_badges.is_displayed', true)
    .select(
      'badges.id',
      'badges.name',
      'badges.icon',
      'badges.rarity',
      'badges.type'
    )
    .orderBy('user_badges.display_order', 'asc')
    .limit(2);
  
  return badges;
}

/**
 * 处理评论列表，为每条评论添加用户羽章信息
 * @param {Array} comments - 评论列表
 * @param {number|null} currentUserId - 当前登录用户ID（可选）
 */
async function attachBadgesToComments(comments, currentUserId = null) {
  // 收集所有评论的用户ID
  const userIds = [...new Set(comments.map(c => c.user_id))];
  
  // 批量查询用户的已佩戴羽章
  const userBadgeMap = {};
  if (userIds.length > 0) {
    const userBadges = await db('user_badges')
      .join('badges', 'user_badges.badge_id', 'badges.id')
      .whereIn('user_badges.user_id', userIds)
      .where('user_badges.is_displayed', true)
      .select(
        'user_badges.user_id',
        'badges.id',
        'badges.name',
        'badges.icon',
        'badges.rarity',
        'badges.type'
      )
      .orderBy('user_badges.display_order', 'asc');
    
    // 按用户分组
    userBadges.forEach(badge => {
      if (!userBadgeMap[badge.user_id]) {
        userBadgeMap[badge.user_id] = [];
      }
      userBadgeMap[badge.user_id].push({
        id: badge.id,
        name: badge.name,
        icon: badge.icon,
        rarity: badge.rarity,
        type: badge.type
      });
    });
  }
  
  // 为每条评论附加羽章信息
  return comments.map(comment => ({
    ...comment,
    badges: userBadgeMap[comment.user_id] || []
  }));
}

// 获取评论列表
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { 
      targetType, 
      targetId, 
      page = 1, 
      pageSize = 20 
    } = req.query;

    const offset = (page - 1) * pageSize;

    // 构建查询
    let query = db('comments')
      .select(
        'comments.id',
        'comments.content',
        'comments.created_at',
        'users.id as user_id',
        'users.nickname',
        'users.avatar as avatar_url'
      )
      .join('users', 'comments.user_id', 'users.id')
      .orderBy('comments.created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    // 添加过滤条件
    if (targetType) {
      query = query.where('comments.target_type', targetType);
    }
    
    if (targetId) {
      query = query.where('comments.target_id', targetId);
    }

    let comments = await query;

    // 为评论附加羽章信息
    comments = await attachBadgesToComments(comments, req.user?.id);

    // 获取总数
    let countQuery = db('comments');
    if (targetType) {
      countQuery = countQuery.where('target_type', targetType);
    }
    if (targetId) {
      countQuery = countQuery.where('target_id', targetId);
    }
    const [{ count }] = await countQuery.count('id as count');

    res.json({
      success: true,
      data: comments,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: count,
        totalPages: Math.ceil(count / pageSize)
      }
    });
  } catch (error) {
    next(error);
  }
});

// 发表评论（需要登录）
router.post('/', verifyToken, async (req, res, next) => {
  try {
    // 只有普通用户可以发表评论
    if (req.userType !== 'user') {
      return res.status(403).json({
        success: false,
        error: '只有普通用户可以发表评论'
      });
    }

    const { content, targetType, targetId } = req.body;

    // 验证参数
    if (!content || !targetType || !targetId) {
      return res.status(400).json({
        success: false,
        error: '请提供评论内容、目标类型和目标ID'
      });
    }

    // 验证目标类型是否合法
    const validTargetTypes = ['event', 'announcement', 'club'];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        error: '无效的目标类型'
      });
    }

    // 验证目标对象是否存在
    let targetExists = false;
    switch (targetType) {
      case 'event':
        targetExists = await db('events').where({ id: targetId }).first();
        break;
      case 'announcement':
        targetExists = await db('announcements').where({ id: targetId }).first();
        break;
      case 'club':
        targetExists = await db('clubs').where({ id: targetId }).first();
        break;
    }

    if (!targetExists) {
      return res.status(404).json({
        success: false,
        error: '目标对象不存在'
      });
    }

    // 插入评论
    const [commentId] = await db('comments').insert({
      user_id: req.user.id,
      content,
      target_type: targetType,
      target_id: targetId,
      created_at: db.fn.now()
    });

    // 获取新创建的评论，并附加羽章信息
    let newComment = await db('comments')
      .select(
        'comments.id',
        'comments.content',
        'comments.created_at',
        'users.id as user_id',
        'users.nickname',
        'users.avatar as avatar_url'
      )
      .join('users', 'comments.user_id', 'users.id')
      .where('comments.id', commentId)
      .first();

    // 附加当前用户的羽章信息
    const userBadges = await getUserDisplayedBadges(req.user.id);
    newComment.badges = userBadges;

    logger.info('用户发表评论:', { 
      commentId, 
      userId: req.user.id, 
      targetType, 
      targetId 
    });

    // 触发羽章检查和活跃度统计更新（异步执行，不阻塞响应）
    setImmediate(async () => {
      try {
        // 更新活跃度统计
        await updateActivityStats(req.user.id, 'comment');
        // 检查并发放羽章
        await checkAndAwardBadge(req.user.id, 'comment.created');
        // 检查活跃度等级羽章
        await checkAndAwardBadge(req.user.id, 'user.activity_update');
      } catch (err) {
        logger.error('活跃度统计或羽章检查失败:', { 
          error: err.message, 
          stack: err.stack,
          userId: req.user.id,
          commentId
        });
      }
    });

    res.status(201).json({
      success: true,
      message: '评论发表成功',
      data: newComment
    });
  } catch (error) {
    logger.error('发表评论失败:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      body: req.body
    });
    next(error);
  }
});

// 删除评论（需要是评论作者或管理员）
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // 获取评论信息
    const comment = await db('comments')
      .select('id', 'user_id')
      .where({ id })
      .first();

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: '评论不存在'
      });
    }

    // 检查权限：必须是评论作者或管理员
    if (req.userType !== 'admin' && comment.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: '无权限删除此评论'
      });
    }

    // 删除评论
    await db('comments').where({ id }).delete();

    logger.info('删除评论:', { 
      commentId: id, 
      userId: req.user.id,
      userType: req.userType
    });

    // 减少活跃度统计（异步执行，不阻塞响应）
    setImmediate(async () => {
      try {
        await decrementActivityStats(comment.user_id, 'comment');
      } catch (error) {
        logger.error('活跃度统计减少失败:', { error: error.message, userId: comment.user_id });
      }
    });

    res.json({
      success: true,
      message: '评论删除成功'
    });
  } catch (error) {
    logger.error('删除评论失败:', {
      error: error.message,
      stack: error.stack,
      commentId: req.params.id,
      userId: req.user?.id
    });
    next(error);
  }
});

module.exports = router;
