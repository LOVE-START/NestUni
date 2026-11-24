// utils/fileUtils.js - 文件操作工具函数
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

// 上传目录路径
const UPLOAD_DIR = path.join(__dirname, '../uploads');

/**
 * 验证文件路径是否在上传目录内，防止路径遍历攻击
 * @param {string} filePath - 要验证的文件路径
 * @returns {boolean} 路径是否安全
 */
function isPathSafe(filePath) {
  const normalizedFilePath = path.normalize(filePath);
  const normalizedUploadDir = path.normalize(UPLOAD_DIR);
  return normalizedFilePath.startsWith(normalizedUploadDir);
}

/**
 * 从完整URL中提取相对路径
 * @param {string} fullUrl - 完整的URL
 * @returns {string} 相对路径
 */
function extractRelativePath(fullUrl) {
  let relativeUrl = fullUrl;
  if (fullUrl.startsWith('https://api.example.com')) {
    relativeUrl = fullUrl.replace('https://api.example.com', '');
  }
  return relativeUrl.replace('/uploads/nest/', '');
}

/**
 * 构造文件的完整路径
 * @param {string} relativePath - 相对路径
 * @returns {string} 完整文件路径
 */
function constructFilePath(relativePath) {
  return path.join(UPLOAD_DIR, relativePath);
}

/**
 * 删除服务器上的物理文件
 * @param {string} imageUrl - 文件的URL
 * @param {string} userId - 用户ID（用于日志记录）
 * @param {string} userType - 用户类型（用于日志记录）
 * @returns {Promise<boolean>} 删除是否成功
 */
async function deletePhysicalFile(imageUrl, userId, userType = 'user') {
  try {
    // 检查URL是否有效
    if (!imageUrl || !imageUrl.startsWith('http')) {
      logger.warn('无效的文件URL:', { imageUrl, userId, userType });
      return false;
    }

    // 从完整URL中提取相对路径
    let relativeUrl = imageUrl;
    if (imageUrl.startsWith('https://api.example.com')) {
      relativeUrl = imageUrl.replace('https://api.example.com', '');
    }
    
    // 验证URL格式，确保是合法的上传文件URL
    if (!relativeUrl.startsWith('/uploads/nest/')) {
      logger.warn('无效的文件URL格式:', { relativeUrl, userId, userType });
      return false;
    }

    // 从URL构造实际文件路径
    const relativePath = relativeUrl.replace('/uploads/nest/', '');
    const filePath = constructFilePath(relativePath);
    
    // 确保文件路径在上传目录内，防止路径遍历攻击
    if (!isPathSafe(filePath)) {
      logger.warn('文件路径超出上传目录范围:', { filePath, uploadDir: UPLOAD_DIR, userId, userType });
      return false;
    }
    
    logger.info('准备删除文件:', { 
      relativeUrl, 
      relativePath, 
      filePath,
      fileExists: fs.existsSync(filePath),
      userId,
      userType
    });

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger.warn('要删除的文件不存在:', { filePath, userId, userType });
      return false;
    }

    // 删除文件
    fs.unlinkSync(filePath);
    logger.info('文件删除成功:', {
      userId,
      userType,
      fileUrl: relativeUrl,
      filePath
    });
    
    return true;
  } catch (error) {
    logger.error('文件删除错误:', { error: error.message, stack: error.stack, imageUrl, userId, userType });
    return false;
  }
}

/**
 * 批量删除服务器上的物理文件
 * @param {string[]} imageUrls - 文件URL数组
 * @param {string} userId - 用户ID（用于日志记录）
 * @param {string} userType - 用户类型（用于日志记录）
 * @returns {Promise<{success: number, failed: number}>} 删除统计结果
 */
async function deletePhysicalFiles(imageUrls, userId, userType = 'user') {
  let successCount = 0;
  let failedCount = 0;
  
  if (!Array.isArray(imageUrls)) {
    logger.warn('批量删除文件时参数不是数组:', { imageUrls, userId, userType });
    return { success: 0, failed: 0 };
  }
  
  for (const imageUrl of imageUrls) {
    try {
      const result = await deletePhysicalFile(imageUrl, userId, userType);
      if (result) {
        successCount++;
      } else {
        failedCount++;
      }
    } catch (error) {
      logger.error('批量删除文件时出错:', { error: error.message, imageUrl, userId, userType });
      failedCount++;
    }
  }
  
  logger.info('批量文件删除完成:', { successCount, failedCount, total: imageUrls.length, userId, userType });
  return { success: successCount, failed: failedCount };
}

/**
 * 确保目录存在，如果不存在则创建
 * @param {string} dirPath - 目录路径
 * @returns {boolean} 是否成功
 */
function ensureDirExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info('创建目录成功:', dirPath);
    }
    return true;
  } catch (error) {
    logger.error('创建目录失败:', { error: error.message, dirPath });
    return false;
  }
}

/**
 * 获取文件信息
 * @param {string} filePath - 文件路径
 * @returns {object|null} 文件信息或null
 */
function getFileInfo(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    }
    return null;
  } catch (error) {
    logger.error('获取文件信息失败:', { error: error.message, filePath });
    return null;
  }
}

module.exports = {
  deletePhysicalFile,
  deletePhysicalFiles,
  ensureDirExists,
  getFileInfo,
  isPathSafe,
  extractRelativePath,
  constructFilePath,
  UPLOAD_DIR
};