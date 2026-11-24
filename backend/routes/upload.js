// routes/upload.js - 文件上传路由
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middleware/auth');
const logger = require('../config/logger');
const { deletePhysicalFile, isPathSafe, extractRelativePath, constructFilePath } = require('../utils/fileUtils');

const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads');
const categories = ['clubs', 'events', 'announcements', 'avatars', 'recruitments', 'general'];

logger.info('初始化上传目录:', {
  cwd: process.cwd(),
  uploadDir: uploadDir,
  uploadDirExists: fs.existsSync(uploadDir)
});

// 创建主上传目录和子目录
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info('创建上传主目录成功:', uploadDir);
  } catch (err) {
    logger.error('创建上传主目录失败:', { error: err.message, uploadDir });
  }
}

categories.forEach(category => {
  const dir = path.join(uploadDir, category);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      logger.info('创建分类目录成功:', dir);
    } catch (err) {
      logger.error('创建分类目录失败:', { error: err.message, category, dir });
    }
  } else {
    logger.info('分类目录已存在:', dir);
  }
});

// 配置multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.body.category || 'general';
    const dir = path.join(uploadDir, category);
    
    // 确保目录存在
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('动态创建分类目录:', dir);
      } catch (err) {
        logger.error('动态创建分类目录失败:', { error: err.message, dir });
      }
    }
    
    logger.info('设置文件存储目录:', { dir, category });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + '-' + uniqueSuffix + ext;
    logger.info('生成文件名:', { originalName: file.originalname, filename });
    cb(null, filename);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,image/webp').split(',');
  
  if (allowedTypes.includes(file.mimetype)) {
    logger.info('文件类型验证通过:', { mimetype: file.mimetype, originalName: file.originalname });
    cb(null, true);
  } else {
    logger.warn('文件类型不支持:', { mimetype: file.mimetype, originalName: file.originalname });
    cb(new Error('不支持的文件类型'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 默认5MB
  },
  fileFilter: fileFilter
});

// 上传图片
router.post('/image', verifyToken, upload.single('file'), async (req, res, next) => {
  try {
    logger.info('开始处理图片上传请求');
    
    if (!req.file) {
      logger.warn('没有上传文件');
      return res.status(400).json({
        success: false,
        error: '请选择要上传的文件'
      });
    }

    const category = req.body.category || 'general';
    logger.info('上传文件信息:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      category: category,
      destination: req.file.destination
    });
    
    // 构造正确的URL路径，与Nginx配置匹配
    const fileUrl = `/uploads/nest/${category}/${req.file.filename}`;
    
    // 添加文件存在性检查
    const fullPath = req.file.path;
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      logger.info('文件上传成功并已保存:', {
        userId: req.user.id,
        userType: req.userType,
        fullPath: fullPath,
        fileSize: stats.size,
        url: fileUrl
      });
    } else {
      logger.error('文件上传但未找到文件:', {
        userId: req.user.id,
        fullPath: fullPath,
        url: fileUrl
      });
    }
    
    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        url: fileUrl,
        fullUrl: `https://api.example.com${fileUrl}`,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        category: category
      }
    });
  } catch (error) {
    logger.error('文件上传错误:', { error: error.message, stack: error.stack });
    next(error);
  }
});

// 上传多个图片
router.post('/images', verifyToken, upload.array('files', 10), async (req, res, next) => {
  try {
    logger.info('开始处理多图片上传请求');
    
    if (!req.files || req.files.length === 0) {
      logger.warn('没有上传文件');
      return res.status(400).json({
        success: false,
        error: '请选择要上传的文件'
      });
    }

    const category = req.body.category || 'general';
    logger.info('批量上传文件信息:', {
      fileCount: req.files.length,
      category: category
    });
    
    const uploadedFiles = req.files.map(file => {
      // 构造正确的URL路径，与Nginx配置匹配
      const fileUrl = `/uploads/nest/${category}/${file.filename}`;
      
      // 添加文件存在性检查
      const fullPath = file.path;
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        logger.info('文件上传成功并已保存:', {
          userId: req.user.id,
          userType: req.userType,
          fullPath: fullPath,
          fileSize: stats.size,
          url: fileUrl
        });
      } else {
        logger.error('文件上传但未找到文件:', {
          userId: req.user.id,
          fullPath: fullPath,
          url: fileUrl
        });
      }
      
      return {
        url: fileUrl,
        fullUrl: `https://api.example.com${fileUrl}`,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        category: category
      };
    });

    res.json({
      success: true,
      message: `成功上传 ${req.files.length} 个文件`,
      data: uploadedFiles
    });
  } catch (error) {
    logger.error('批量文件上传错误:', { error: error.message, stack: error.stack });
    next(error);
  }
});

// 删除文件（仅允许删除自己上传的文件或管理员权限）
router.delete('/file', verifyToken, async (req, res, next) => {
  try {
    const { url } = req.body;
    logger.info('开始处理文件删除请求:', { url });

    if (!url) {
      logger.warn('删除文件请求缺少URL参数');
      return res.status(400).json({
        success: false,
        error: '请提供要删除的文件URL'
      });
    }

    // 验证URL格式，确保是合法的上传文件URL
    if (!url.startsWith('/uploads/nest/')) {
      logger.warn('无效的文件URL格式:', { url });
      return res.status(400).json({
        success: false,
        error: '无效的文件URL'
      });
    }

    // 防止路径遍历攻击
    if (url.includes('..') || url.includes('./') || url.includes('.\\')) {
      logger.warn('检测到潜在的路径遍历攻击:', { url });
      return res.status(400).json({
        success: false,
        error: '无效的文件URL'
      });
    }

    // 从URL构造实际文件路径
    const relativePath = url.replace('/uploads/nest/', '');
    const filePath = constructFilePath(relativePath);
    
    // 确保文件路径在上传目录内，防止路径遍历攻击
    if (!isPathSafe(filePath)) {
      logger.warn('文件路径超出上传目录范围:', { filePath, uploadDir });
      return res.status(400).json({
        success: false,
        error: '无效的文件路径'
      });
    }
    
    logger.info('准备删除文件:', { 
      url: url, 
      relativePath: relativePath, 
      filePath: filePath,
      fileExists: fs.existsSync(filePath)
    });

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger.warn('要删除的文件不存在:', { filePath });
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      });
    }

    // 删除文件
    fs.unlinkSync(filePath);
    logger.info('文件删除成功:', {
      userId: req.user.id,
      userType: req.userType,
      fileUrl: url,
      filePath: filePath
    });

    res.json({
      success: true,
      message: '文件删除成功'
    });
  } catch (error) {
    logger.error('文件删除错误:', { error: error.message, stack: error.stack });
    // 检查是否是权限错误
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return res.status(403).json({
        success: false,
        error: '没有权限删除文件'
      });
    }
    next(error);
  }
});

module.exports = router;