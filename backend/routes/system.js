/**
 * 系统相关路由
 * @description 处理版本管理、系统状态等接口
 */
const express = require('express');
const db = require('../config/database');
const { optionalAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * 获取系统版本信息
 * @description 返回缓存版本和公告版本信息
 */
router.get('/version', optionalAuth, async (req, res, next) => {
  try {
    // 从 system_config 表获取所有配置
    const configs = await db('system_config')
      .whereIn('config_key', [
        'cacheVersion',
        'announcementVersion', 
        'announcementTitle',
        'announcementContent',
        'announcementImage'
      ]);

    // 转换为对象格式
    const configMap = {};
    configs.forEach(config => {
      configMap[config.config_key] = config.config_value;
    });

    res.json({
      success: true,
      data: {
        cacheVersion: parseInt(configMap.cacheVersion) || 1,
        announcementVersion: parseInt(configMap.announcementVersion) || 0,
        announcementTitle: configMap.announcementTitle || '公告通知',
        announcementContent: configMap.announcementContent || '',
        announcementImage: configMap.announcementImage || ''
      }
    });
  } catch (error) {
    // 如果表不存在，返回默认值
    console.error('获取版本信息失败:', error);
    res.json({
      success: true,
      data: {
        cacheVersion: 1,
        announcementVersion: 0,
        announcementTitle: '公告通知',
        announcementContent: '',
        announcementImage: ''
      }
    });
  }
});

/**
 * 更新公告配置（管理员）
 * @description 更新公告版本、标题、内容和图片
 */
router.put('/announcement', requireAdmin, async (req, res, next) => {
  try {
    const { version, title, content, image } = req.body;

    // 开启事务
    await db.transaction(async (trx) => {
      const updates = [];
      
      if (version !== undefined) {
        updates.push(
          trx('system_config')
            .where({ config_key: 'announcementVersion' })
            .update({ config_value: String(version) })
        );
      }
      
      if (title !== undefined) {
        updates.push(
          trx('system_config')
            .where({ config_key: 'announcementTitle' })
            .update({ config_value: title })
        );
      }
      
      if (content !== undefined) {
        updates.push(
          trx('system_config')
            .where({ config_key: 'announcementContent' })
            .update({ config_value: content })
        );
      }
      
      if (image !== undefined) {
        updates.push(
          trx('system_config')
            .where({ config_key: 'announcementImage' })
            .update({ config_value: image })
        );
      }

      await Promise.all(updates);
    });

    res.json({
      success: true,
      message: '公告配置更新成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 更新缓存版本（管理员）
 * @description 更新缓存版本，会触发客户端清除用户登录态
 */
router.put('/cache-version', requireAdmin, async (req, res, next) => {
  try {
    const { version } = req.body;

    if (!version || version < 1) {
      return res.status(400).json({
        success: false,
        error: '版本号必须大于0'
      });
    }

    await db('system_config')
      .where({ config_key: 'cacheVersion' })
      .update({ config_value: String(version) });

    res.json({
      success: true,
      message: '缓存版本更新成功',
      data: { cacheVersion: version }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 系统状态检查
 */
router.get('/status', optionalAuth, async (req, res, next) => {
  try {
    // 检查数据库连接
    let dbStatus = 'healthy';
    let dbLatency = 0;
    
    try {
      const start = Date.now();
      await db.raw('SELECT 1');
      dbLatency = Date.now() - start;
    } catch (error) {
      dbStatus = 'error';
      dbLatency = -1;
    }

    // 获取基本统计
    const stats = await Promise.all([
      db('users').count('id as count').first().catch(() => ({ count: 0 })),
      db('clubs').count('id as count').first().catch(() => ({ count: 0 })),
      db('events').count('id as count').first().catch(() => ({ count: 0 })),
      db('announcements').count('id as count').first().catch(() => ({ count: 0 }))
    ]);

    res.json({
      success: true,
      data: {
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: {
          status: dbStatus,
          latency: `${dbLatency}ms`
        },
        statistics: {
          users: stats[0].count,
          clubs: stats[1].count,
          events: stats[2].count,
          announcements: stats[3].count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取系统配置（公开部分）
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      maxFileSize: process.env.MAX_FILE_SIZE || 5242880,
      allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,image/webp').split(','),
      pagination: {
        defaultPageSize: 20,
        maxPageSize: 100
      },
      features: {
        userRegistration: true,
        fileUpload: true,
        eventRegistration: true,
        comments: true
      }
    }
  });
});

module.exports = router;
