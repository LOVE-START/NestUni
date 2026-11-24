/**
 * 编辑页面公共工具模块
 * @description 提取各模块重复的公共逻辑，提高代码复用性
 */

const {
  chooseSingleImage,
  uploadSingleImage,
  uploadMultipleImages,
  isValidImageUrl,
  formatImageUrl,
  mergeImageUrls,
  isLocalTempPath
} = require("../../utils/image-handler");

const { formatEventDate } = require("../../utils/date.js");

/**
 * 通用图片选择函数
 * @description 选择单张图片并更新表单数据
 * @param {Object} page - 页面实例
 * @param {string} formField - 表单字段路径，如 'eventForm.cover_image'
 * @param {string} tempField - 临时图片字段路径，如 'tempEventImages.cover_image'
 * @param {Object} options - 配置选项
 * @param {number} options.index - 图片索引（多图时使用）
 * @param {Array} options.tempArray - 临时图片数组路径，如 'tempEventImages.images'
 * @param {Array} options.formArray - 表单图片数组路径，如 'eventForm.images'
 */
async function selectImage(page, formField, tempField, options = {}) {
  try {
    const compressedPath = await chooseSingleImage();

    if (options.index !== undefined && options.tempArray && options.formArray) {
      // 多图模式：更新数组中指定索引的图片
      const tempImages = [...(getNestedValue(page.data, options.tempArray) || [])];
      const formImages = [...(getNestedValue(page.data, options.formArray) || [''])];

      // 确保数组长度足够
      while (tempImages.length <= options.index) {
        tempImages.push('');
      }

      tempImages[options.index] = compressedPath;
      formImages[options.index] = compressedPath;

      page.setData({
        [options.tempArray]: tempImages,
        [options.formArray]: formImages
      });
    } else {
      // 单图模式：直接更新字段
      page.setData({
        [formField]: compressedPath,
        [tempField]: compressedPath
      });
    }

    wx.showToast({ title: '图片已选择，保存时将自动上传', icon: 'success', duration: 2000 });
  } catch (error) {
    // 用户取消选择不提示错误
  }
}

/**
 * 通用图片删除函数
 * @description 删除表单中的图片
 * @param {Object} page - 页面实例
 * @param {string} formField - 表单字段路径
 * @param {string} tempField - 临时图片字段路径
 */
function deleteImage(page, formField, tempField) {
  page.setData({
    [formField]: '',
    [tempField]: ''
  });
}

/**
 * 通用图片数组项删除函数
 * @description 删除图片数组中指定索引的项
 * @param {Object} page - 页面实例
 * @param {string} formArray - 表单图片数组路径
 * @param {string} tempArray - 临时图片数组路径
 * @param {number} index - 要删除的索引
 */
function deleteImageFromArray(page, formArray, tempArray, index) {
  const formImages = [...(getNestedValue(page.data, formArray) || [])];
  const tempImages = [...(getNestedValue(page.data, tempArray) || [])];

  formImages.splice(index, 1);
  if (tempImages[index] !== undefined) {
    tempImages.splice(index, 1);
  }

  page.setData({
    [formArray]: formImages,
    [tempArray]: tempImages
  });
}

/**
 * 通用分页 - 上一页
 * @description 加载上一页数据
 * @param {Object} page - 页面实例
 * @param {string} paginationKey - 分页状态字段名，如 'eventPagination'
 * @param {Function} loadFunction - 加载数据的函数
 */
function prevPage(page, paginationKey, loadFunction) {
  const pagination = page.data[paginationKey];
  const currentPageKey = paginationKey === 'recruitmentPagination' ? 'currentPage' : 'page';
  
  if (pagination[currentPageKey] > 1) {
    loadFunction(page, page.data.clubId, pagination[currentPageKey] - 1);
  }
}

/**
 * 通用分页 - 下一页
 * @description 加载下一页数据
 * @param {Object} page - 页面实例
 * @param {string} paginationKey - 分页状态字段名
 * @param {Function} loadFunction - 加载数据的函数
 */
function nextPage(page, paginationKey, loadFunction) {
  const pagination = page.data[paginationKey];
  const currentPageKey = paginationKey === 'recruitmentPagination' ? 'currentPage' : 'page';
  
  if (pagination[currentPageKey] < pagination.totalPages) {
    loadFunction(page, page.data.clubId, pagination[currentPageKey] + 1);
  }
}

/**
 * 通用表单输入处理
 * @description 处理表单输入事件，更新对应字段
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 * @param {string} formPrefix - 表单前缀，如 'eventForm'
 */
function onFormChange(page, e, formPrefix) {
  const field = e.currentTarget.dataset.field;
  const value = e.detail.value;

  page.setData({
    [`${formPrefix}.${field}`]: value
  });
}

/**
 * 通用删除确认对话框
 * @description 显示删除确认对话框，确认后执行删除操作
 * @param {Object} options - 配置选项
 * @param {string} options.title - 对话框标题
 * @param {string} options.content - 对话框内容
 * @param {Function} options.onConfirm - 确认后的回调函数
 */
function confirmDelete(options) {
  const { title = '确认删除', content = '确定要删除吗？此操作不可恢复。', onConfirm } = options;

  wx.showModal({
    title,
    content,
    success: async (res) => {
      if (res.confirm && onConfirm) {
        await onConfirm();
      }
    }
  });
}

/**
 * 获取嵌套属性值
 * @description 通过路径字符串获取嵌套对象的值，如 'announcementForm.images'
 * @param {Object} obj - 对象
 * @param {string} path - 属性路径
 * @param {*} defaultValue - 默认值
 * @returns {*} 属性值
 */
function getNestedValue(obj, path, defaultValue = undefined) {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return defaultValue;
    }
  }
  return result;
}

/**
 * 通用图片槽位添加函数
 * @description 直接选择图片并添加到数组末尾
 * @param {Object} page - 页面实例
 * @param {string} formArray - 表单图片数组路径
 * @param {string} tempArray - 临时图片数组路径
 */
async function addImageSlot(page, formArray, tempArray) {
  try {
    const compressedPath = await chooseSingleImage();

    const formImages = [...(getNestedValue(page.data, formArray) || [])];
    const tempImages = [...(getNestedValue(page.data, tempArray) || [])];

    formImages.push(compressedPath);
    tempImages.push(compressedPath);

    page.setData({
      [formArray]: formImages,
      [tempArray]: tempImages
    });

    wx.showToast({ title: '图片已选择，保存时将自动上传', icon: 'success', duration: 2000 });
  } catch (error) {
    // 用户取消选择不提示错误
  }
}

/**
 * 通用图片槽位移除函数
 * @description 移除指定索引的图片槽位
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 * @param {string} formArray - 表单图片数组路径
 * @param {string} tempArray - 临时图片数组路径
 */
function removeImageSlot(page, e, formArray, tempArray) {
  const index = e.currentTarget.dataset.index;
  const formImages = [...(getNestedValue(page.data, formArray) || [''])];
  const tempImages = [...(getNestedValue(page.data, tempArray) || [])];

  formImages.splice(index, 1);
  if (tempImages[index] !== undefined) {
    tempImages.splice(index, 1);
  }

  // 确保至少有一个空槽位
  if (formImages.length === 0) {
    formImages.push('');
    tempImages.push('');
  }

  page.setData({
    [formArray]: formImages,
    [tempArray]: tempImages
  });
}

/**
 * 通用图片预览函数
 * @description 预览指定图片
 * @param {string} current - 当前图片URL
 * @param {Array} urls - 所有图片URL数组
 */
function previewImage(current, urls) {
  wx.previewImage({
    current,
    urls: urls.filter(url => url && url.trim() !== '')
  });
}

/**
 * 通用列表图片预览函数
 * @description 预览列表项中的图片
 * @param {Object} e - 事件对象，包含 dataset.url 和 dataset.images
 */
function previewListImage(e) {
  const { url, images } = e.currentTarget.dataset;
  const imageArray = images ? (Array.isArray(images) ? images : JSON.parse(images)) : [];
  previewImage(url, imageArray);
}

/**
 * 通用图片上传函数
 * @description 批量上传图片
 * @param {Object} page - 页面实例
 * @param {Object} config - 上传配置
 * @param {string} config.tempField - 临时图片字段路径
 * @param {string} config.formField - 表单图片字段路径
 * @param {string} config.folder - 上传目标文件夹
 * @param {string} config.loadingText - 上传时的提示文字
 * @returns {Promise<string>} 上传后的图片URL
 */
async function uploadSingleImageField(page, config) {
  const { tempField, formField, folder, loadingText } = config;
  const tempImage = getNestedValue(page.data, tempField);
  const formImage = getNestedValue(page.data, formField);

  if (tempImage && isLocalTempPath(tempImage)) {
    return await uploadSingleImage(tempImage, folder, loadingText);
  } else if (formImage && isValidImageUrl(formImage)) {
    return formImage;
  }

  return '';
}

/**
 * 通用多图上传函数
 * @description 批量上传多张图片
 * @param {Object} page - 页面实例
 * @param {Object} config - 上传配置
 * @param {string} config.tempArray - 临时图片数组路径
 * @param {string} config.formArray - 表单图片数组路径
 * @param {string} config.folder - 上传目标文件夹
 * @param {string} config.loadingText - 上传时的提示文字
 * @returns {Promise<Array>} 上传后的图片URL数组
 */
async function uploadMultipleImageFields(page, config) {
  const { tempArray, formArray, folder, loadingText } = config;
  const tempImages = getNestedValue(page.data, tempArray) || [];

  const localImages = tempImages.filter(img => img && isLocalTempPath(img));

  if (localImages.length === 0) {
    return [];
  }

  return await uploadMultipleImages(localImages, folder, loadingText);
}

/**
 * 处理图片数组数据（用于编辑时加载）
 * @description 格式化图片数组，确保格式正确
 * @param {Array|string} images - 图片数据
 * @returns {Array} 格式化后的图片数组
 */
function processImagesArray(images) {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return [];
  }

  return images.map(url => formatImageUrl(url)).filter(url => url && url.trim() !== '');
}

/**
 * 通用状态文本获取函数
 * @description 根据状态码获取状态文本
 * @param {string} status - 状态码
 * @param {string} type - 类型：'event' | 'recruitment'
 * @returns {string} 状态文本
 */
function getStatusText(status, type = 'event') {
  const statusMaps = {
    event: {
      'draft': '草稿',
      'published': '已发布',
      'completed': '已完成',
      'cancelled': '已取消'
    },
    recruitment: {
      'draft': '草稿',
      'published': '已发布',
      'closed': '已结束'
    }
  };

  return statusMaps[type]?.[status] || '已发布';
}

/**
 * 通用状态样式类获取函数
 * @description 根据状态码获取样式类名
 * @param {string} status - 状态码
 * @returns {string} 样式类名
 */
function getStatusClass(status) {
  const classMap = {
    'draft': 'draft',
    'published': 'published',
    'completed': 'completed',
    'cancelled': 'cancelled',
    'closed': 'closed'
  };

  return classMap[status] || '';
}

/**
 * 格式化列表数据中的日期
 * @description 为列表项添加格式化后的日期字段
 * @param {Array} list - 列表数据
 * @param {Array} dateFields - 需要格式化的日期字段名数组
 * @returns {Array} 格式化后的列表
 */
function formatListDates(list, dateFields = ['created_at']) {
  return list.map(item => {
    const formatted = { ...item };
    dateFields.forEach(field => {
      if (item[field]) {
        formatted[`formatted_${field}`] = formatEventDate(item[field]);
      }
    });
    return formatted;
  });
}

/**
 * 显示操作成功提示
 * @param {string} message - 提示消息
 */
function showSuccess(message) {
  wx.showToast({ title: message, icon: 'success' });
}

/**
 * 显示操作失败提示
 * @param {string} message - 提示消息
 */
function showError(message) {
  wx.showToast({ title: message, icon: 'none' });
}

/**
 * 显示加载中
 * @param {string} message - 加载提示
 */
function showLoading(message = '加载中...') {
  wx.showLoading({ title: message, mask: true });
}

/**
 * 隐藏加载中
 */
function hideLoading() {
  wx.hideLoading();
}

module.exports = {
  // 图片相关
  selectImage,
  deleteImage,
  deleteImageFromArray,
  addImageSlot,
  removeImageSlot,
  previewImage,
  previewListImage,
  uploadSingleImageField,
  uploadMultipleImageFields,
  processImagesArray,

  // 分页相关
  prevPage,
  nextPage,

  // 表单相关
  onFormChange,
  confirmDelete,

  // 状态相关
  getStatusText,
  getStatusClass,

  // 数据处理
  formatListDates,

  // 提示相关
  showSuccess,
  showError,
  showLoading,
  hideLoading,

  // 工具函数引用（方便模块使用）
  isValidImageUrl,
  formatImageUrl,
  mergeImageUrls,
  isLocalTempPath,
  formatEventDate
};
