/**
 * 图片加载优化工具
 * @description 提供图片懒加载、占位图、按需缓存等功能
 */

const imageCache = require('./imageCache');

/**
 * 默认占位图（1x1透明像素）
 */
const DEFAULT_PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * 优化图片URL（添加缓存处理）
 * @description 返回缓存的图片路径或原URL，同时异步缓存图片
 * @param {string} url - 图片URL
 * @returns {string} 图片路径（本地缓存或原URL）
 */
function optimizeImageUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return url || DEFAULT_PLACEHOLDER;
  }
  
  // 检查是否已缓存
  const cachedPath = imageCache.getCachedImage(url);
  if (cachedPath) {
    const fs = wx.getFileSystemManager();
    try {
      fs.accessSync(cachedPath);
      return cachedPath;
    } catch (e) {
      // 缓存文件不存在，删除缓存记录
      imageCache.removeCachedImage(url);
    }
  }
  
  // 未缓存，异步下载并缓存（不阻塞当前渲染）
  imageCache.smartCacheImage(url);
  
  // 返回原URL
  return url;
}

/**
 * 批量优化图片URL
 * @description 批量处理图片URL，返回优化后的URL数组
 * @param {string[]} urls - 图片URL数组
 * @returns {string[]} 优化后的URL数组
 */
function optimizeImageUrls(urls) {
  if (!Array.isArray(urls)) {
    return [];
  }
  
  return urls.map(url => optimizeImageUrl(url));
}

/**
 * 预加载关键图片
 * @description 预加载首屏可见的关键图片，提升用户体验
 * @param {string[]} urls - 图片URL数组
 * @param {number} maxCount - 最多预加载的数量（默认5张）
 */
function preloadCriticalImages(urls, maxCount = 5) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return;
  }
  
  // 只预加载前N张图片
  const criticalUrls = urls.slice(0, maxCount);
  
  criticalUrls.forEach(url => {
    if (url && typeof url === 'string' && url.startsWith('http')) {
      imageCache.smartCacheImage(url);
    }
  });
}

/**
 * 获取图片加载状态
 * @description 检查图片是否已缓存
 * @param {string} url - 图片URL
 * @returns {boolean} 是否已缓存
 */
function isImageCached(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return true;
  }
  
  const cachedPath = imageCache.getCachedImage(url);
  if (cachedPath) {
    const fs = wx.getFileSystemManager();
    try {
      fs.accessSync(cachedPath);
      return true;
    } catch (e) {
      imageCache.removeCachedImage(url);
      return false;
    }
  }
  
  return false;
}

module.exports = {
  DEFAULT_PLACEHOLDER,
  optimizeImageUrl,
  optimizeImageUrls,
  preloadCriticalImages,
  isImageCached
};
