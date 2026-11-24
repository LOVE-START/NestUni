/**
 * 数据统计路由
 * @description 提供社团数据分析相关的 API 接口
 */

const express = require('express');
const router = express.Router();
const clubStatsService = require('../services/clubStatsService');
const { verifyToken } = require('../middleware/auth');
const { requireClubLeader } = require('../middleware/clubLeader');
const logger = require('../config/logger');

/**
 * 获取社团综合概览数据
 * @route GET /api/clubs/:clubId/stats/overview
 */
router.get('/clubs/:clubId/stats/overview', verifyToken, requireClubLeader, async (req, res) => {
  try {
    const { clubId } = req.params;
    const { period } = req.query;
    
    const data = await clubStatsService.getClubOverview(clubId, period);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取社团概览失败:', error);
    res.status(500).json({
      success: false,
      message: '获取社团概览失败',
      error: error.message
    });
  }
});

/**
 * 获取社团活动数据统计
 * @route GET /api/clubs/:clubId/stats/events
 */
router.get('/clubs/:clubId/stats/events', verifyToken, requireClubLeader, async (req, res) => {
  try {
    const { clubId } = req.params;
    const { period, months } = req.query;
    
    const data = await clubStatsService.getClubEventStats(
      clubId, 
      period, 
      months ? parseInt(months) : 6
    );
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取活动统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取活动统计失败',
      error: error.message
    });
  }
});

/**
 * 获取社团成员数据统计
 * @route GET /api/clubs/:clubId/stats/members
 */
router.get('/clubs/:clubId/stats/members', verifyToken, requireClubLeader, async (req, res) => {
  try {
    const { clubId } = req.params;
    const { period, months } = req.query;
    
    const data = await clubStatsService.getClubMemberStats(
      clubId, 
      period, 
      months ? parseInt(months) : 6
    );
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取成员统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取成员统计失败',
      error: error.message
    });
  }
});

/**
 * 获取社团招新数据统计
 * @route GET /api/clubs/:clubId/stats/recruitments
 */
router.get('/clubs/:clubId/stats/recruitments', verifyToken, requireClubLeader, async (req, res) => {
  try {
    const { clubId } = req.params;
    const { period } = req.query;
    
    const data = await clubStatsService.getClubRecruitmentStats(clubId, period);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取招新统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取招新统计失败',
      error: error.message
    });
  }
});

/**
 * 管理员 - 获取全校数据概览
 * @route GET /api/admin/stats/overview
 */
router.get('/admin/stats/overview', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { period } = req.query;
    const data = await clubStatsService.getAdminOverview(period);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取管理员概览失败:', error);
    res.status(500).json({
      success: false,
      message: '获取管理员概览失败',
      error: error.message
    });
  }
});

module.exports = router;
