/**
 * 日期格式化工具函数
 * AI辅助生成：通义千问网页端, 2026-03-15
 * 说明：AI提供了基础日期格式化框架，经人工审查后优化了错误处理和边界情况
 */

/**
 * 将 ISO 日期字符串格式化为 "MM.DD,YYYY" 格式
 * AI辅助生成：通义千问网页端, 2026-03-15
 * @param {string} isoDate - ISO 日期字符串，例如 "2025-09-09T16:00:00.000Z"
 * @returns {string} 格式化后的日期字符串，例如 "09.09,2025"
 */
function formatEventDate(isoDate) {
  if (!isoDate) return '';
  
  try {
    // 创建 Date 对象
    const date = new Date(isoDate);
    
    // 获取月份和日期
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    
    // 返回格式化后的日期
    return `${month}.${day},${year}`;
  } catch (error) {
    console.error('日期格式化错误:', error);
    return isoDate; // 如果格式化失败，返回原始日期
  }
}

/**
 * 将 ISO 日期时间字符串格式化为 "MM.DD,YYYY HH:mm" 格式
 * AI辅助生成：通义千问网页端, 2026-03-15
 * @param {string} isoDateTime - ISO 日期时间字符串，例如 "2025-09-09T16:00:00.000Z"
 * @returns {string} 格式化后的日期时间字符串，例如 "09.09,2025 16:00"
 */
function formatEventDateTime(isoDateTime) {
  if (!isoDateTime) return '';
  
  try {
    // 创建 Date 对象
    const date = new Date(isoDateTime);
    
    // 获取月份和日期
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    
    // 获取小时和分钟
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    // 返回格式化后的日期时间
    return `${month}.${day},${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error('日期时间格式化错误:', error);
    return isoDateTime; // 如果格式化失败，返回原始日期时间
  }
}

/**
 * 格式化为相对时间（可选功能）
 * @param {string} isoDate - ISO 日期字符串
 * @returns {string} 相对时间描述
 */
function formatRelativeTime(isoDate) {
  if (!isoDate) return '';
  
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '明天';
    if (diffDays <= 7) return `${diffDays}天后`;
    return formatEventDate(isoDate);
  } catch (error) {
    console.error('相对时间格式化错误:', error);
    return isoDate;
  }
}

module.exports = {
  formatEventDate,
  formatEventDateTime,
  formatRelativeTime
};