/**
 * utils/helpers.js - 公共工具函数
 * @description 提供JSON解析、日期处理、分页等通用功能
 */

/**
 * 安全解析JSON
 * @description 处理数据库返回的JSON字段，支持字符串和已解析对象
 * @param {string|Object} str - JSON字符串或已解析的对象
 * @param {*} defaultValue - 解析失败时的默认值
 * @returns {*} 解析结果
 */
function safeJsonParse(str, defaultValue) {
  if (!str) return defaultValue;
  
  // 如果已经是对象（knex + mysql2 会自动解析 JSON 类型字段），直接返回
  if (typeof str === 'object') {
    return str;
  }
  
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error('JSON解析失败:', str, e.message);
    return defaultValue;
  }
}

/**
 * 处理图片数组字段
 * @description 将图片数组转换为JSON字符串，过滤无效URL
 * @param {Array|string} images - 图片数组或JSON字符串
 * @returns {string|null} JSON字符串或null
 */
function processImagesField(images) {
  if (!images) return null;
  
  // 如果已经是字符串且是有效JSON，直接返回
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(url => typeof url === 'string' && url.length > 0);
        return filtered.length > 0 ? JSON.stringify(filtered) : null;
      }
    } catch (e) {
      // 解析失败，返回null
    }
    return null;
  }
  
  // 如果是数组，过滤并转换
  if (Array.isArray(images)) {
    const filtered = images.filter(url => typeof url === 'string' && url.length > 0);
    return filtered.length > 0 ? JSON.stringify(filtered) : null;
  }
  
  return null;
}

/**
 * 解析图片字段为数组
 * @description 将数据库中的图片字段解析为数组
 * @param {string|Array} images - 图片字段
 * @returns {Array} 图片URL数组
 */
function parseImagesField(images) {
  if (!images) return [];
  
  if (Array.isArray(images)) return images;
  
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  
  return [];
}

/**
 * 处理日期格式
 * @description 将各种日期格式转换为MySQL兼容格式 (YYYY-MM-DD)
 * @param {string} date - 日期字符串
 * @returns {string|null} 格式化后的日期
 */
function formatDate(date) {
  if (!date || typeof date !== 'string') return null;
  
  // 如果是ISO格式的日期字符串，提取日期部分
  if (date.includes('T')) {
    return date.split('T')[0];
  }
  
  // 如果是MM.DD,YYYY格式，转换为YYYY-MM-DD格式
  if (date.includes('.') && date.includes(',')) {
    const parts = date.split(',');
    const year = parts[1];
    const [month, day] = parts[0].split('.');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return date;
}

/**
 * 处理日期时间格式
 * @description 将ISO 8601格式转换为MySQL DATETIME格式
 * @param {string} datetime - ISO日期时间字符串
 * @returns {string|null} MySQL格式日期时间
 */
function formatDateTime(datetime) {
  if (!datetime) return null;
  
  const date = new Date(datetime);
  if (isNaN(date.getTime())) return null;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 处理空字符串字段
 * @description 将空字符串转换为null
 * @param {*} value - 字段值
 * @returns {*} 处理后的值
 */
function parseEmptyAsNull(value) {
  if (value === '' || value === undefined) return null;
  return value;
}

/**
 * 处理数字字段
 * @description 将空字符串或无效值转换为null
 * @param {*} value - 字段值
 * @returns {number|null} 数字或null
 */
function parseNumberField(value) {
  if (value === '' || value === undefined || value === null) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * 构建分页参数
 * @description 从请求中提取并计算分页参数
 * @param {Object} params - 参数对象 (query或body)
 * @param {number} defaultPageSize - 默认每页数量
 * @returns {Object} 分页参数 { page, pageSize, offset }
 */
function getPaginationParams(params, defaultPageSize = 20) {
  const page = parseInt(params.page) || 1;
  const pageSize = parseInt(params.pageSize) || defaultPageSize;
  const offset = (page - 1) * pageSize;
  
  return { page, pageSize, offset };
}

/**
 * 构建分页响应数据
 * @description 构建标准的分页响应结构
 * @param {number} page - 当前页码
 * @param {number} pageSize - 每页数量
 * @param {number} total - 总记录数
 * @returns {Object} 分页响应对象
 */
function buildPaginationResponse(page, pageSize, total) {
  return {
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    total: total,
    totalPages: Math.ceil(total / pageSize)
  };
}

/**
 * 处理JSON字段数组
 * @description 批量处理对象中的多个JSON字段
 * @param {Object} obj - 目标对象
 * @param {Array<{field: string, defaultValue: *}>} fields - 字段配置数组
 * @returns {Object} 处理后的对象
 */
function processJsonFields(obj, fields) {
  if (!obj || !fields) return obj;
  
  const result = { ...obj };
  fields.forEach(({ field, defaultValue }) => {
    result[field] = safeJsonParse(result[field], defaultValue);
  });
  
  return result;
}

/**
 * 清理更新数据
 * @description 移除不应在更新操作中包含的字段
 * @param {Object} data - 更新数据
 * @param {Array<string>} excludeFields - 额外排除的字段
 * @returns {Object} 清理后的数据
 */
function cleanUpdateData(data, excludeFields = []) {
  const defaultExclude = ['id', 'created_at', 'current_participants', 'current_applicants'];
  const allExclude = [...defaultExclude, ...excludeFields];
  
  const result = { ...data };
  allExclude.forEach(field => {
    delete result[field];
  });
  
  return result;
}

/**
 * 处理标签字段
 * @description 将标签数组或字符串转换为JSON字符串
 * @param {Array|string} tags - 标签数据
 * @returns {string|null} JSON字符串
 */
function processTagsField(tags) {
  if (!tags) return null;
  
  if (Array.isArray(tags)) {
    return JSON.stringify(tags);
  }
  
  if (typeof tags === 'string') {
    try {
      // 尝试解析，如果已经是JSON格式则直接使用
      JSON.parse(tags);
      return tags;
    } catch (e) {
      // 不是JSON格式，按逗号分隔转换为数组
      const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      return tagsArray.length > 0 ? JSON.stringify(tagsArray) : null;
    }
  }
  
  return null;
}

/**
 * 处理要求字段
 * @description 将要求数组或字符串转换为JSON字符串
 * @param {Array|string} requirements - 要求数据
 * @returns {string|null} JSON字符串
 */
function processRequirementsField(requirements) {
  if (!requirements) return null;
  
  if (Array.isArray(requirements)) {
    return JSON.stringify(requirements);
  }
  
  if (typeof requirements === 'string') {
    try {
      JSON.parse(requirements);
      return requirements;
    } catch (e) {
      // 不是JSON格式，按换行符分隔转换为数组
      const reqArray = requirements.split('\n').map(req => req.trim()).filter(req => req);
      return reqArray.length > 0 ? JSON.stringify(reqArray) : null;
    }
  }
  
  return null;
}

module.exports = {
  safeJsonParse,
  processImagesField,
  parseImagesField,
  formatDate,
  formatDateTime,
  parseEmptyAsNull,
  parseNumberField,
  getPaginationParams,
  buildPaginationResponse,
  processJsonFields,
  cleanUpdateData,
  processTagsField,
  processRequirementsField
};
