/**
 * 工具函数模块
 * @description 包含日期格式化、JSON解析、距离计算等通用工具函数
 */

const { LEVEL_MAP, SYNONYM_MAP } = require('./constants');

/**
 * 格式化日期为简洁格式
 * @description 将Date对象或日期字符串转为"2026.03.10"格式
 * @param {Date|string|null} date - 日期对象或字符串
 * @returns {string} 格式化后的日期文本
 */
function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${month}.${day}`;
}

/**
 * 标准化用户消息中的同义词
 * @description 将用户消息中的同义词统一为标准词，简化意图识别
 * @param {string} message - 用户消息
 * @returns {string} 标准化后的消息
 */
function normalizeMessage(message) {
  let normalized = message;
  for (const [synonym, standard] of Object.entries(SYNONYM_MAP)) {
    normalized = normalized.replace(new RegExp(synonym, 'g'), standard);
  }
  return normalized;
}

/**
 * 安全解析 JSON 字符串
 * @description 避免 JSON.parse 异常，返回默认值
 * @param {string} str - JSON 字符串
 * @param {*} defaultValue - 解析失败时的默认值
 * @returns {*} 解析结果或默认值
 */
function safeJsonParse(str, defaultValue = []) {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * 映射社团数据为统一格式
 * @description 消除重复的社团数据映射逻辑
 * @param {Object} club - 数据库社团记录
 * @param {number[]} joinedClubIds - 用户已加入的社团ID列表
 * @returns {Object} 格式化后的社团数据
 */
function mapClubData(club, joinedClubIds = []) {
  return {
    id: club.id,
    name: club.name,
    shortIntro: club.short_intro,
    category: club.category,
    level: LEVEL_MAP[club.level] || club.level,
    logo: club.logo,
    coverImage: club.cover_image,
    gallery: safeJsonParse(club.gallery),
    isJoined: joinedClubIds.includes(club.id)
  };
}

/**
 * 计算两点之间的距离（Haversine公式）
 * @param {number} lat1 - 起点纬度
 * @param {number} lon1 - 起点经度
 * @param {number} lat2 - 终点纬度
 * @param {number} lon2 - 终点经度
 * @returns {number} 距离（米）
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 格式化距离为易读格式
 * @param {number} distance - 距离（米）
 * @returns {string} 格式化后的距离文本
 */
function formatDistance(distance) {
  return distance >= 1000 
    ? `${(distance / 1000).toFixed(1)}公里` 
    : `${distance}米`;
}

/**
 * 转义 SQL LIKE 特殊字符
 * @description 防止 SQL 注入
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeLikeString(str) {
  return str.replace(/[%_]/g, '\\$&');
}

module.exports = {
  formatDate,
  normalizeMessage,
  safeJsonParse,
  mapClubData,
  calculateDistance,
  formatDistance,
  escapeLikeString
};
