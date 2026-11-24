// app.js - 主应用入口
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./config/logger');
const db = require('./config/database');
const schedulerService = require('./services/schedulerService');

// 导入路由
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const clubRoutes = require('./routes/clubs');
const eventRoutes = require('./routes/events');
const announcementRoutes = require('./routes/announcements');
const uploadRoutes = require('./routes/upload');
const systemRoutes = require('./routes/system');
const commentRoutes = require('./routes/comments');
const recruitmentRoutes = require('./routes/recruitments');
const badgeRoutes = require('./routes/badges');
const chatRoutes = require('./routes/chat');
const wechatRoutes = require('./routes/wechat');
const notificationRoutes = require('./routes/notifications');
const approvalRoutes = require('./routes/approvals');
const statsRoutes = require('./routes/stats');

// 中间件
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;
const API_PREFIX = process.env.API_PREFIX || '/nfunest/api';

// 信任代理设置（Nginx反向代理配置：仅信任第一级代理）
app.set('trust proxy', 1);

// 基础中间件
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每个IP最多1000次请求
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use(limiter);

// 解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static('uploads'));

// 请求日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// 健康检查
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({
    success: true,
    message: 'NFUNest API服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 微信消息推送路由（使用API前缀，方便Nginx代理）
app.use(`${API_PREFIX}/nestnotif`, wechatRoutes);

// API路由
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/clubs`, clubRoutes);
app.use(`${API_PREFIX}/events`, eventRoutes);
app.use(`${API_PREFIX}/announcements`, announcementRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);
app.use(`${API_PREFIX}/comments`, commentRoutes);
app.use(`${API_PREFIX}/recruitments`, recruitmentRoutes);
app.use(`${API_PREFIX}/badges`, badgeRoutes);
app.use(`${API_PREFIX}/chat`, chatRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/approvals`, approvalRoutes);
app.use(`${API_PREFIX}`, statsRoutes);
// 系统路由应该放在最后，避免拦截其他路由
app.use(`${API_PREFIX}`, systemRoutes);

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
app.listen(PORT, () => {
  logger.info(`NFUNest API服务已启动 - 端口: ${PORT}`);
  logger.info(`API前缀: ${API_PREFIX}`);
  logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
  
  // 启动活动提醒调度器（异步加载）
  schedulerService.startScheduler().catch(err => {
    logger.error('启动活动提醒调度器失败:', { error: err.message });
  });
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在关闭服务器...');
  schedulerService.stopScheduler();
  db.destroy(() => {
    logger.info('数据库连接已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，正在关闭服务器...');
  schedulerService.stopScheduler();
  db.destroy(() => {
    logger.info('数据库连接已关闭');
    process.exit(0);
  });
});

module.exports = app;