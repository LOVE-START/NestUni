/**
 * 图片处理公共模块
 * @description 提供图片选择、压缩、上传等通用功能
 */

const { uploadImage } = require("./api/index");

/**
 * 图片大小限制常量
 */
const IMAGE_SIZE_LIMIT = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  COMPRESS_THRESHOLD: 1 * 1024 * 1024, // 1MB 以上才压缩
  COMPRESS_QUALITY: 80 // 压缩质量
};

/**
 * 选择单张图片
 * @description 选择图片并进行压缩处理
 * @param {Object} options - 配置选项
 * @param {number} options.maxSize - 最大文件大小（字节）
 * @param {number} options.compressThreshold - 压缩阈值（字节）
 * @param {number} options.quality - 压缩质量
 * @returns {Promise<string>} 压缩后的临时文件路径
 */
async function chooseSingleImage(options = {}) {
  const {
    maxSize = IMAGE_SIZE_LIMIT.MAX_SIZE,
    compressThreshold = IMAGE_SIZE_LIMIT.COMPRESS_THRESHOLD,
    quality = IMAGE_SIZE_LIMIT.COMPRESS_QUALITY
  } = options;

  return new Promise((resolve, reject) => {
    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        const originalSize = res.tempFiles[0].size;

        // 检查文件大小
        if (originalSize > maxSize) {
          const sizeMB = (maxSize / (1024 * 1024)).toFixed(0);
          wx.showToast({ title: `图片过大，请选择小于${sizeMB}MB的图片`, icon: 'none' });
          reject(new Error(`图片大小超过${sizeMB}MB限制`));
          return;
        }

        // 压缩图片
        let compressedFilePath = tempFilePath;
        if (originalSize > compressThreshold) {
          try {
            compressedFilePath = await compressImage(tempFilePath, quality);
            // [FIX] 压缩后大小仅用于日志展示，开发者工具上读取 http://tmp/ 路径可能失败；
            // 读取失败按0处理，避免误入"压缩失败使用原图"的降级分支（压缩实际已成功）
            let compressedSize = 0;
            try {
              compressedSize = await getFileSize(compressedFilePath);
            } catch (sizeError) {
              console.warn('获取压缩后图片大小失败:', sizeError);
            }
            console.log('图片压缩完成:', {
              originalSize: formatFileSize(originalSize),
              compressedSize: formatFileSize(compressedSize)
            });
          } catch (compressError) {
            console.warn('图片压缩失败，使用原图:', compressError);
          }
        }

        resolve(compressedFilePath);
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        // 用户主动取消属于正常操作，静默返回，避免误报错误提示
        const errMsg = (err && err.errMsg) || '';
        if (!/cancel/i.test(errMsg)) {
          wx.showToast({ title: '选择图片失败', icon: 'none' });
        }
        reject(err);
      }
    });
  });
}

/**
 * 选择多张图片
 * @description 选择多张图片并进行压缩处理
 * @param {Object} options - 配置选项
 * @param {number} options.count - 最大选择数量
 * @param {number} options.maxSize - 最大文件大小（字节）
 * @returns {Promise<string[]>} 压缩后的临时文件路径数组
 */
async function chooseMultipleImages(options = {}) {
  const {
    count = 9,
    maxSize = IMAGE_SIZE_LIMIT.MAX_SIZE
  } = options;

  return new Promise((resolve, reject) => {
    wx.chooseImage({
      count: count,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePaths = res.tempFilePaths;
        const compressedPaths = [];

        for (let i = 0; i < tempFilePaths.length; i++) {
          const filePath = tempFilePaths[i];
          const fileInfo = res.tempFiles[i];

          // 检查文件大小
          if (fileInfo.size > maxSize) {
            const sizeMB = (maxSize / (1024 * 1024)).toFixed(0);
            wx.showToast({ title: `第${i + 1}张图片过大`, icon: 'none' });
            continue;
          }

          // 压缩图片
          try {
            const compressedPath = fileInfo.size > IMAGE_SIZE_LIMIT.COMPRESS_THRESHOLD
              ? await compressImage(filePath)
              : filePath;
            compressedPaths.push(compressedPath);
          } catch (error) {
            console.warn(`第${i + 1}张图片压缩失败:`, error);
            compressedPaths.push(filePath);
          }
        }

        resolve(compressedPaths);
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({ title: '选择图片失败', icon: 'none' });
        reject(err);
      }
    });
  });
}

/**
 * 压缩图片
 * @description 使用微信API压缩图片
 * @param {string} srcPath - 源文件路径
 * @param {number} quality - 压缩质量 (0-100)
 * @returns {Promise<string>} 压缩后的文件路径
 */
async function compressImage(srcPath, quality = IMAGE_SIZE_LIMIT.COMPRESS_QUALITY) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: srcPath,
      quality: quality,
      success: (res) => resolve(res.tempFilePath),
      fail: reject
    });
  });
}

/**
 * 获取文件大小
 * @param {string} filePath - 文件路径
 * @returns {Promise<number>} 文件大小（字节）
 */
async function getFileSize(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath: filePath,
      success: (res) => resolve(res.size),
      fail: reject
    });
  });
}

/**
 * 格式化文件大小显示
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的字符串
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(2) + 'MB';
}

/**
 * 上传单张图片到服务器
 * @description 上传图片并返回完整URL
 * @param {string} filePath - 本地文件路径
 * @param {string} category - 图片分类 (clubs/events/announcements/recruitments)
 * @param {string} loadingText - 加载提示文字
 * @returns {Promise<string>} 上传后的完整URL
 */
async function uploadSingleImage(filePath, category = 'common', loadingText = '上传中...') {
  if (!filePath) return '';

  // 检查是否为需要上传的本地路径
  if (!isLocalTempPath(filePath)) {
    return filePath; // 已经是服务器URL，直接返回
  }

  // [FIX] 大小检查降级为"尽力而为"：Windows开发者工具上 wx.getFileInfo 无法读取
  // http://tmp/ 临时路径，会误报"no such file or directory"（工具兼容bug，与
  // imageCache.js 中 wx.saveFile 的问题相同），但文件实际存在且 wx.uploadFile 可正常上传；
  // 若文件真的已被系统清理，下方 uploadFile 会失败并转为友好提示，因此这里不阻断上传
  let fileSize = 0;
  try {
    fileSize = await getFileSize(filePath);
  } catch (sizeError) {
    console.warn('获取图片大小失败，跳过大小检查:', sizeError);
  }

  if (fileSize > IMAGE_SIZE_LIMIT.MAX_SIZE) {
    throw new Error('图片大小超过5MB限制');
  }

  wx.showLoading({ title: loadingText, mask: true });

  try {
    const result = await uploadImage(filePath, { category });

    wx.hideLoading();

    if (result) {
      // 确保返回完整URL
      if (result.fullUrl) {
        return result.fullUrl;
      } else if (result.url) {
        return result.url.startsWith('http') ? result.url : `https://api.example.com${result.url}`;
      } else {
        return result.startsWith('http') ? result : `https://api.example.com${result}`;
      }
    }

    return '';
  } catch (error) {
    wx.hideLoading();
    console.error('上传图片失败:', error);
    // [FIX] 临时文件被系统清理时上传会报"no such file or directory"，
    // 把底层错误转为用户可理解的提示，避免暴露技术性错误信息
    const errMsg = (error && (error.errMsg || error.message)) || '';
    if (/no such file|not found|文件不存在/i.test(errMsg)) {
      throw new Error('图片文件已失效，请重新选择图片后再保存');
    }
    throw error;
  }
}

/**
 * 批量上传图片
 * @description 批量上传多张图片并返回URL数组
 * @param {string[]} filePaths - 本地文件路径数组
 * @param {string} category - 图片分类
 * @param {string} loadingTextPrefix - 加载提示前缀
 * @returns {Promise<string[]>} 上传后的URL数组
 */
async function uploadMultipleImages(filePaths, category = 'common', loadingTextPrefix = '上传图片') {
  if (!filePaths || filePaths.length === 0) return [];

  const uploadedUrls = [];
  const total = filePaths.filter(p => p && isLocalTempPath(p)).length;
  let uploaded = 0;

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];

    if (!filePath) {
      uploadedUrls.push('');
      continue;
    }

    // 如果不是本地临时路径，直接保留原值
    if (!isLocalTempPath(filePath)) {
      uploadedUrls.push(filePath);
      continue;
    }

    try {
      uploaded++;
      const loadingText = total > 1 ? `${loadingTextPrefix}(${uploaded}/${total})` : loadingTextPrefix;
      const url = await uploadSingleImage(filePath, category, loadingText);
      uploadedUrls.push(url);
    } catch (error) {
      console.error(`上传第${i + 1}张图片失败:`, error);
      uploadedUrls.push('');
    }
  }

  return uploadedUrls;
}

/**
 * 判断是否为本地临时路径
 * @param {string} path - 文件路径
 * @returns {boolean} 是否为本地临时路径
 */
function isLocalTempPath(path) {
  if (!path) return false;

  // 微信临时路径格式
  if (path.startsWith('http://tmp/') || path.startsWith('wxfile://')) {
    return true;
  }

  // 服务器URL不需要上传
  if (path.startsWith('https://api.example.com') || path.startsWith('/uploads/')) {
    return false;
  }

  // 其他http/https开头的路径（外部链接）
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return false;
  }

  // 其他情况视为本地路径
  return true;
}

/**
 * 判断是否为有效的图片URL
 * @param {string} url - 图片URL
 * @returns {boolean} 是否为有效URL
 */
function isValidImageUrl(url) {
  if (!url) return false;
  return typeof url === 'string' && url.length > 0 &&
    (url.startsWith('http') || url.startsWith('https') || url.startsWith('/uploads/')) &&
    !url.startsWith('http://tmp');
}

/**
 * 格式化图片URL为完整路径
 * @param {string} url - 图片URL
 * @returns {string} 完整的图片URL
 */
function formatImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('/uploads/')) {
    return `https://api.example.com${url}`;
  }
  return url;
}

/**
 * 处理图片数组，合并已有URL和新上传URL
 * @param {string[]} existingUrls - 已有的图片URL数组
 * @param {string[]} newUrls - 新上传的图片URL数组
 * @returns {string[]} 合并去重后的URL数组
 */
function mergeImageUrls(existingUrls = [], newUrls = []) {
  // 过滤有效的已有URL
  const validExisting = (existingUrls || [])
    .filter(url => url && isValidImageUrl(url))
    .map(url => formatImageUrl(url));

  // 过滤有效的新URL
  const validNew = (newUrls || [])
    .filter(url => url && isValidImageUrl(url))
    .map(url => formatImageUrl(url));

  // 合并去重
  const allUrls = [...validExisting, ...validNew];
  return [...new Set(allUrls)];
}

/**
 * 选择图片并更新表单数据（通用方法）
 * @description 用于表单中的图片选择，支持单图和多图模式
 * @param {Object} pageInstance - 页面实例
 * @param {string} field - 字段名 (如 'cover_image' 或 'images')
 * @param {Object} options - 配置选项
 * @param {number} options.index - 多图模式下的索引
 * @param {boolean} options.multiple - 是否多选模式
 * @param {string} options.tempField - 临时图片存储字段
 */
async function chooseAndUpdateImage(pageInstance, field, options = {}) {
  const { index = null, multiple = false, tempField = null } = options;

  try {
    let selectedPaths;

    if (multiple) {
      selectedPaths = await chooseMultipleImages();
    } else {
      const singlePath = await chooseSingleImage();
      selectedPaths = [singlePath];
    }

    if (selectedPaths.length === 0) return;

    // 更新表单数据
    if (field === 'images' || multiple) {
      // 多图模式
      const images = [...(pageInstance.data.tempImages?.[field] || pageInstance.data[field] || [])];

      if (index !== null) {
        // 更新指定索引
        while (images.length <= index) {
          images.push('');
        }
        images[index] = selectedPaths[0];
      } else {
        // 追加图片
        images.push(...selectedPaths);
      }

      pageInstance.setData({
        [field]: images
      });

      // 同时更新临时图片存储
      if (tempField) {
        const tempImages = [...(pageInstance.data[tempField]?.[field] || [])];
        if (index !== null) {
          while (tempImages.length <= index) {
            tempImages.push('');
          }
          tempImages[index] = selectedPaths[0];
        } else {
          tempImages.push(...selectedPaths);
        }
        pageInstance.setData({
          [`${tempField}.${field}`]: tempImages
        });
      }
    } else {
      // 单图模式
      pageInstance.setData({
        [field]: selectedPaths[0]
      });

      if (tempField) {
        pageInstance.setData({
          [`${tempField}.${field}`]: selectedPaths[0]
        });
      }
    }

    wx.showToast({ title: '图片已选择，保存时将自动上传', icon: 'success', duration: 2000 });

  } catch (error) {
    if (error.errMsg !== 'chooseImage:fail cancel') {
      console.error('选择图片失败:', error);
    }
  }
}

module.exports = {
  // 常量
  IMAGE_SIZE_LIMIT,

  // 选择图片
  chooseSingleImage,
  chooseMultipleImages,
  chooseAndUpdateImage,

  // 压缩相关
  compressImage,
  getFileSize,
  formatFileSize,

  // 上传相关
  uploadSingleImage,
  uploadMultipleImages,

  // URL处理
  isLocalTempPath,
  isValidImageUrl,
  formatImageUrl,
  mergeImageUrls
};
