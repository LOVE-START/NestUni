/**
 * 图片缓存管理工具
 * @description 实现图片的智能缓存，支持过期清理和大小限制
 */

// 缓存键前缀
const IMAGE_CACHE_PREFIX = 'image_cache_';
// 缓存索引键
const IMAGE_CACHE_INDEX_KEY = 'image_cache_index';
// 最大并发下载数
const MAX_CONCURRENT_DOWNLOADS = 3;
// 缓存过期时间（7天，单位毫秒）
const CACHE_EXPIRY_TIME = 30 * 24 * 60 * 60 * 1000;
// 最大缓存大小（50MB，单位字节）
const MAX_CACHE_SIZE = 100 * 1024 * 1024;
// 是否暂停下载
let isPaused = false;
// 待下载队列
let downloadQueue = [];
// 当前下载数量
let currentDownloads = 0;

/**
 * 生成图片缓存键
 * @param {string} url - 图片URL
 * @returns {string} 缓存键
 */
function generateCacheKey(url) {
  return IMAGE_CACHE_PREFIX + url;
}

/**
 * 获取缓存索引
 * @returns {object} 缓存索引对象
 */
function getCacheIndex() {
  try {
    const index = wx.getStorageSync(IMAGE_CACHE_INDEX_KEY);
    return index || {};
  } catch (e) {
    console.error('获取图片缓存索引失败:', e);
    return {};
  }
}

/**
 * 保存缓存索引
 * @param {object} index - 缓存索引对象
 */
function saveCacheIndex(index) {
  try {
    wx.setStorageSync(IMAGE_CACHE_INDEX_KEY, index);
  } catch (e) {
    console.error('保存图片缓存索引失败:', e);
  }
}

/**
 * 缓存图片
 * @param {string} url - 图片URL
 * @param {string} localPath - 本地图片路径
 * @param {number} fileSize - 文件大小（字节）
 */
function cacheImage(url, localPath, fileSize = 0) {
  try {
    // 保存图片路径到缓存
    const cacheKey = generateCacheKey(url);
    wx.setStorageSync(cacheKey, localPath);
    
    // 更新缓存索引
    const index = getCacheIndex();
    index[url] = {
      cacheKey: cacheKey,
      timestamp: Date.now(),
      size: fileSize
    };
    saveCacheIndex(index);
    
    console.log(`图片已缓存: ${url}, 大小: ${(fileSize / 1024).toFixed(2)}KB`);
    
    // 检查缓存大小，必要时清理
    checkAndCleanCache();
  } catch (e) {
    console.error('缓存图片失败:', e);
  }
}

/**
 * 获取缓存的图片路径
 * @param {string} url - 图片URL
 * @returns {string|null} 本地图片路径，如果未缓存则返回null
 */
function getCachedImage(url) {
  try {
    const cacheKey = generateCacheKey(url);
    const localPath = wx.getStorageSync(cacheKey);
    if (!localPath) return null;

    // [FIX] 历史坏缓存清洗：旧版saveFile失败分支曾把临时路径(http://tmp/、wxfile://)写入缓存，
    // 临时文件会被系统回收导致缓存永久失效，检测到即删除记录，下次重新下载到持久目录
    if (typeof localPath === 'string'
      && (localPath.startsWith('http://tmp/') || localPath.startsWith('wxfile://'))) {
      removeCachedImage(url);
      return null;
    }

    return localPath;
  } catch (e) {
    console.error('获取缓存图片失败:', e);
    return null;
  }
}

/**
 * 删除单个图片缓存
 * @param {string} url - 图片URL
 */
function removeCachedImage(url) {
  try {
    const cacheKey = generateCacheKey(url);
    const localPath = wx.getStorageSync(cacheKey);
    
    // 删除本地文件
    if (localPath) {
      const fs = wx.getFileSystemManager();
      try {
        fs.unlinkSync(localPath);
        console.log(`已删除文件: ${localPath}`);
      } catch (e) {
        // 文件可能不存在，忽略错误
      }
    }
    
    // 删除缓存记录
    wx.removeStorageSync(cacheKey);
    
    // 更新缓存索引
    const index = getCacheIndex();
    delete index[url];
    saveCacheIndex(index);
    
    console.log(`已删除缓存: ${url}`);
  } catch (e) {
    console.error('删除缓存图片失败:', e);
  }
}

/**
 * 按URL前缀清除缓存
 * @param {string} prefix - URL前缀
 * @returns {number} 删除的缓存数量
 */
function clearCacheByPrefix(prefix) {
  try {
    const index = getCacheIndex();
    let count = 0;
    
    Object.keys(index).forEach(url => {
      if (url.startsWith(prefix)) {
        const cacheInfo = index[url];
        wx.removeStorageSync(cacheInfo.cacheKey);
        delete index[url];
        count++;
      }
    });
    
    saveCacheIndex(index);
    console.log(`已清除 ${count} 个前缀为 ${prefix} 的缓存`);
    return count;
  } catch (e) {
    console.error('按前缀清除缓存失败:', e);
    return 0;
  }
}

/**
 * 暂停图片缓存下载
 * @description 当需要优先处理其他网络请求时调用（如登录上传头像）
 */
function pauseDownloads() {
  isPaused = true;
  console.log('图片缓存下载已暂停');
}

/**
 * 恢复图片缓存下载
 * @description 恢复被暂停的下载任务
 */
function resumeDownloads() {
  isPaused = false;
  console.log('图片缓存下载已恢复');
  processQueue();
}

/**
 * 处理下载队列
 * @description 按并发限制处理待下载的图片
 */
function processQueue() {
  if (isPaused || currentDownloads >= MAX_CONCURRENT_DOWNLOADS || downloadQueue.length === 0) {
    return;
  }
  
  while (currentDownloads < MAX_CONCURRENT_DOWNLOADS && downloadQueue.length > 0) {
    const task = downloadQueue.shift();
    currentDownloads++;
    
    downloadSingleImage(task.url)
      .then(task.resolve)
      .catch(task.reject)
      .finally(() => {
        currentDownloads--;
        processQueue();
      });
  }
}

/**
 * 生成缓存文件名（djb2哈希 + 原扩展名）
 * @description URL直接做文件名会含非法字符，用哈希规避；保留扩展名便于调试与系统识别
 * @param {string} baseUrl - 去除查询参数后的URL
 * @returns {string} 缓存文件名，如 img_1a2b3c4d.jpeg
 */
function buildCacheFileName(baseUrl) {
  let hash = 5381;
  for (let i = 0; i < baseUrl.length; i++) {
    hash = ((hash << 5) + hash + baseUrl.charCodeAt(i)) & 0xffffffff;
  }
  // 提取原扩展名（默认.img，识别失败也不影响显示）
  const extMatch = baseUrl.match(/\.(jpe?g|png|gif|webp|bmp|svg)(?=($|\?))/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : '.img';
  return `img_${(hash >>> 0).toString(36)}${ext}`;
}

/**
 * 下载单张图片
 * @param {string} url - 图片URL
 * @returns {Promise} 下载完成的Promise
 * [MODIFY] 修复两个问题：
 * 1. 原wx.saveFile是废弃API，且Windows开发者工具上处理http://tmp/临时路径会报
 *    "saveFile:fail no such file or directory"（工具兼容bug，真机部分版本同样存在）
 *    → 改用FileSystemManager.copyFile复制到USER_DATA_PATH，工具与真机均兼容
 * 2. 原fail分支把tempFilePath当永久缓存路径写入storage是错误的：临时文件会被系统
 *    回收，且0KB空文件也照存，形成"看似已缓存实则失效"的坏缓存
 *    → 保存失败时直接放弃缓存（图片显示走远程URL，不受影响），严禁写入坏路径
 */
function downloadSingleImage(url) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      resolve();
      return;
    }

    wx.downloadFile({
      url: url,
      success: (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`下载图片失败，状态码: ${res.statusCode}`));
          return;
        }

        // 获取文件大小（statSync失败时按0处理，下方会因空文件跳过缓存）
        const fs = wx.getFileSystemManager();
        let fileSize = 0;
        try {
          const stats = fs.statSync(res.tempFilePath);
          fileSize = stats.size;
        } catch (e) {
          console.warn('获取文件大小失败:', e);
        }

        // [FIX] 0字节文件无缓存价值（服务器返回空body或下载异常），跳过避免坏缓存
        if (!fileSize) {
          console.warn(`跳过空文件缓存: ${url}`);
          resolve();
          return;
        }

        const baseUrl = url.split('?')[0];
        const targetPath = `${wx.env.USER_DATA_PATH}/${buildCacheFileName(baseUrl)}`;

        // 先清理旧缓存文件再复制（forceRefresh重下场景，忽略不存在的错误）
        try {
          fs.unlinkSync(targetPath);
        } catch (e) {
          // 旧文件不存在属正常情况，忽略
        }

        // [MODIFY] 复制临时文件到用户目录作为持久缓存（替代废弃的wx.saveFile）
        fs.copyFile({
          srcPath: res.tempFilePath,
          destPath: targetPath,
          success: () => {
            cacheImage(baseUrl, targetPath, fileSize);
            console.log(`图片已保存: ${baseUrl}`);
            resolve();
          },
          fail: (err) => {
            // 保存失败仅放弃本次缓存，不写入任何缓存记录（防坏缓存），图片显示不受影响
            console.warn('复制缓存图片失败:', err);
            resolve();
          }
        });
      },
      fail: (err) => {
        reject(new Error(`下载图片失败: ${err.errMsg}`));
      }
    });
  });
}

/**
 * 预加载并缓存图片
 * @param {string|string[]} urls - 图片URL或URL数组
 * @param {boolean} forceRefresh - 是否强制刷新（删除旧缓存重新下载）
 * @returns {Promise} 预加载完成的Promise
 */
function preloadAndCacheImages(urls, forceRefresh = false) {
  const urlArray = Array.isArray(urls) ? urls : [urls];
  
  // 如果强制刷新，先删除这些URL的旧缓存
  if (forceRefresh) {
    urlArray.forEach(url => {
      if (url && typeof url === 'string' && url.startsWith('http')) {
        const baseUrl = url.split('?')[0];
        removeCachedImage(baseUrl);
      }
    });
  }
  
  // 过滤掉已经缓存的图片（除非强制刷新）
  const uncachedUrls = forceRefresh 
    ? urlArray.filter(url => url && typeof url === 'string' && url.startsWith('http'))
    : urlArray.filter(url => {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
        const cached = getCachedImage(url);
        if (cached) {
          const fs = wx.getFileSystemManager();
          try {
            fs.accessSync(cached);
            return false;
          } catch (e) {
            removeCachedImage(url);
            return true;
          }
        }
        return true;
      });
  
  if (uncachedUrls.length === 0) {
    console.log('所有图片都已缓存，无需预加载');
    return Promise.resolve();
  }
  
  console.log(`开始预加载 ${uncachedUrls.length} 张图片（并发限制: ${MAX_CONCURRENT_DOWNLOADS}）${forceRefresh ? '（强制刷新）' : ''}`);
  
  // 创建下载任务并加入队列
  const downloadPromises = uncachedUrls.map(url => {
    return new Promise((resolve, reject) => {
      downloadQueue.push({ url, resolve, reject });
    });
  });
  
  // 开始处理队列
  processQueue();
  
  return Promise.allSettled(downloadPromises)
    .then((results) => {
      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      const rejected = results.filter(r => r.status === 'rejected').length;
      console.log(`预加载完成: 成功 ${fulfilled}, 失败 ${rejected}`);
    });
}

/**
 * 清除所有图片缓存
 */
function clearAllImageCache() {
  try {
    const index = getCacheIndex();
    const fs = wx.getFileSystemManager();
    
    // 删除所有缓存的图片文件
    Object.keys(index).forEach(url => {
      const cacheInfo = index[url];
      // 获取实际存储的路径
      const localPath = wx.getStorageSync(cacheInfo.cacheKey);
      if (localPath) {
        try {
          fs.unlinkSync(localPath);
        } catch (e) {
          // 文件可能不存在，忽略错误
        }
      }
      // 删除缓存记录
      wx.removeStorageSync(cacheInfo.cacheKey);
    });
    
    // 删除缓存索引
    wx.removeStorageSync(IMAGE_CACHE_INDEX_KEY);
    
    console.log('已清除所有图片缓存');
  } catch (e) {
    console.error('清除图片缓存失败:', e);
  }
}

/**
 * 获取缓存统计信息
 * @returns {object} 缓存统计信息
 */
function getCacheStats() {
  try {
    const index = getCacheIndex();
    const count = Object.keys(index).length;
    
    // 计算总缓存大小
    let totalSize = 0;
    Object.values(index).forEach(item => {
      totalSize += item.size || 0;
    });
    
    return {
      count: count,
      size: totalSize,
      sizeMB: (totalSize / (1024 * 1024)).toFixed(2)
    };
  } catch (e) {
    console.error('获取缓存统计信息失败:', e);
    return {
      count: 0,
      size: 0,
      sizeMB: '0.00'
    };
  }
}

/**
 * 检查并清理过期缓存
 * @description 删除超过7天的缓存文件
 * @returns {number} 清理的缓存数量
 */
function cleanExpiredCache() {
  try {
    const index = getCacheIndex();
    const now = Date.now();
    const fs = wx.getFileSystemManager();
    let cleanedCount = 0;
    
    Object.keys(index).forEach(url => {
      const cacheInfo = index[url];
      const age = now - cacheInfo.timestamp;
      
      // 如果缓存超过过期时间，删除
      if (age > CACHE_EXPIRY_TIME) {
        const localPath = wx.getStorageSync(cacheInfo.cacheKey);
        if (localPath) {
          try {
            fs.unlinkSync(localPath);
          } catch (e) {
            // 文件可能不存在，忽略错误
          }
        }
        wx.removeStorageSync(cacheInfo.cacheKey);
        delete index[url];
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      saveCacheIndex(index);
      console.log(`已清理 ${cleanedCount} 个过期缓存`);
    }
    
    return cleanedCount;
  } catch (e) {
    console.error('清理过期缓存失败:', e);
    return 0;
  }
}

/**
 * 检查缓存大小并清理
 * @description 当缓存超过最大限制时，删除最旧的缓存
 */
function checkAndCleanCache() {
  try {
    const stats = getCacheStats();
    
    // 如果缓存大小超过限制，清理最旧的缓存
    if (stats.size > MAX_CACHE_SIZE) {
      console.log(`缓存大小 ${(stats.sizeMB)}MB 超过限制 ${(MAX_CACHE_SIZE / (1024 * 1024)).toFixed(0)}MB，开始清理`);
      
      const index = getCacheIndex();
      const fs = wx.getFileSystemManager();
      
      // 按时间戳排序，删除最旧的缓存
      const sortedItems = Object.entries(index)
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      let currentSize = stats.size;
      let cleanedCount = 0;
      
      for (const [url, cacheInfo] of sortedItems) {
        if (currentSize <= MAX_CACHE_SIZE * 0.8) { // 清理到80%
          break;
        }
        
        const localPath = wx.getStorageSync(cacheInfo.cacheKey);
        if (localPath) {
          try {
            fs.unlinkSync(localPath);
          } catch (e) {
            // 文件可能不存在，忽略错误
          }
        }
        
        wx.removeStorageSync(cacheInfo.cacheKey);
        currentSize -= cacheInfo.size || 0;
        delete index[url];
        cleanedCount++;
      }
      
      saveCacheIndex(index);
      console.log(`已清理 ${cleanedCount} 个缓存，释放空间`);
    }
  } catch (e) {
    console.error('检查缓存大小失败:', e);
  }
}

/**
 * 智能预加载图片（按需缓存）
 * @description 只缓存用户查看过的图片，不预加载所有图片
 * @param {string} url - 图片URL
 * @returns {Promise<string>} 返回图片路径（本地缓存或原URL）
 */
function smartCacheImage(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      resolve(url);
      return;
    }
    
    // 检查是否已缓存
    const cachedPath = getCachedImage(url);
    if (cachedPath) {
      const fs = wx.getFileSystemManager();
      try {
        fs.accessSync(cachedPath);
        resolve(cachedPath);
        return;
      } catch (e) {
        // 缓存文件不存在，删除缓存记录
        removeCachedImage(url);
      }
    }
    
    // 未缓存：后台异步下载（结果由downloadSingleImage内部写入缓存），立即返回原URL不阻塞显示
    // [MODIFY] 删除原then/catch中无效的二次resolve——Promise只会resolve一次，
    // 立即resolve已生效，后面的resolve链是永不执行的死代码
    downloadSingleImage(url).catch(() => {});
    resolve(url);
  });
}

module.exports = {
  cacheImage,
  getCachedImage,
  removeCachedImage,
  preloadAndCacheImages,
  clearCacheByPrefix,
  clearAllImageCache,
  getCacheStats,
  pauseDownloads,
  resumeDownloads,
  cleanExpiredCache,
  checkAndCleanCache,
  smartCacheImage
};
