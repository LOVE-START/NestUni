/**
 * 审核路由
 * @description 处理活动、公告等内容的审核流程
 */

const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const {
  getPendingApprovals,
  approveApproval,
  rejectApproval,
  getApprovalDetail,
  getUserApprovals,
  ApprovalTargetType
} = require('../utils/approvalHelper');
const { getPaginationParams, buildPaginationResponse } = require('../utils/helpers');
const logger = require('../config/logger');

const router = express.Router();

/**
 * 获取待审核列表（管理员/老师）
 * @route GET /nfunest/api/approvals/pending
 * @query {string} targetType - 审核对象类型 (event/announcement)
 * @query {number} clubId - 社团ID（可选）
 * @query {number} page - 页码
 * @query {number} pageSize - 每页数量
 */
router.get('/pending', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { targetType, clubId, page, pageSize } = req.query;

    if (targetType && !Object.values(ApprovalTargetType).includes(targetType)) {
      return res.status(400).json({
        success: false,
        error: '无效的审核对象类型'
      });
    }

    const result = await getPendingApprovals({
      targetType,
      clubId: clubId ? parseInt(clubId) : undefined,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    });

    const approvalsWithDetail = await Promise.all(
      result.list.map(async (approval) => {
        const detail = await getApprovalDetail(approval.id);
        return detail;
      })
    );

    res.json({
      success: true,
      data: approvalsWithDetail,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('获取待审核列表失败:', { error: error.message });
    next(error);
  }
});

/**
 * 获取审核详情
 * @route GET /nfunest/api/approvals/:id
 */
router.get('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const approval = await getApprovalDetail(parseInt(id));

    if (!approval) {
      return res.status(404).json({
        success: false,
        error: '审核记录不存在'
      });
    }

    res.json({
      success: true,
      data: approval
    });
  } catch (error) {
    logger.error('获取审核详情失败:', { error: error.message });
    next(error);
  }
});

/**
 * 审核通过
 * @route PUT /nfunest/api/approvals/:id/approve
 */
router.put('/:id/approve', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const approval = await approveApproval(parseInt(id), req.user.id);

    res.json({
      success: true,
      message: '审核通过',
      data: approval
    });
  } catch (error) {
    logger.error('审核通过失败:', { error: error.message });
    
    if (error.message.includes('不存在') || error.message.includes('已审核')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

/**
 * 审核拒绝
 * @route PUT /nfunest/api/approvals/:id/reject
 */
router.put('/:id/reject', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectReason } = req.body;

    if (!rejectReason || rejectReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '请填写拒绝原因'
      });
    }

    const approval = await rejectApproval(parseInt(id), req.user.id, rejectReason);

    res.json({
      success: true,
      message: '已拒绝',
      data: approval
    });
  } catch (error) {
    logger.error('审核拒绝失败:', { error: error.message });
    
    if (error.message.includes('不存在') || error.message.includes('已审核')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

/**
 * 获取用户的审核记录（会长查看自己的申请）
 * @route GET /nfunest/api/approvals/my-applications
 */
router.get('/my-applications/list', verifyToken, async (req, res, next) => {
  try {
    const { status, page, pageSize } = req.query;

    const result = await getUserApprovals(req.user.id, {
      status,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    });

    const approvalsWithDetail = await Promise.all(
      result.list.map(async (approval) => {
        const detail = await getApprovalDetail(approval.id);
        return detail;
      })
    );

    res.json({
      success: true,
      data: approvalsWithDetail,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('获取用户审核记录失败:', { error: error.message });
    next(error);
  }
});

/**
 * 获取待审核数量统计（管理员/老师）
 * @route GET /nfunest/api/approvals/stats
 */
router.get('/stats/count', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const db = require('../config/database');

    const stats = await db('approvals')
      .where({ status: 'pending' })
      .groupBy('target_type')
      .select('target_type')
      .count('id as count');

    const totalPending = await db('approvals')
      .where({ status: 'pending' })
      .count('id as count')
      .first();

    const result = {
      total: totalPending.count,
      event: 0,
      announcement: 0,
      club: 0
    };

    stats.forEach(stat => {
      result[stat.target_type] = stat.count;
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('获取审核统计失败:', { error: error.message });
    next(error);
  }
});

module.exports = router;
