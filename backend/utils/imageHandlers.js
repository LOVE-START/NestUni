/**
 * utils/imageHandlers.js - 图片处理工具函数
 * @description 提供图片删除、处理等通用功能
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { deletePhysicalFile, deletePhysicalFiles } = require('./fileUtils');
const { parseImagesField } = require('./helpers');

/**
 * 从记录中移除指定图片
 * @description 删除物理文件并更新数据库记录
 * @param {Object} options - 配置选项
 * @param {string} options.table - 表名
 * @param {number} options.id - 记录ID
 * @param {string} options.imageUrl - 要删除的图片URL
 * @param {string} options.imageType - 图片类型 (cover_image, images, logo, gallery等)
 * @param {Object} options.record - 当前记录对象
 * @param {number} options.userId - 操作用户ID
 * @param {string} options.userType - 用户类型
 * @returns {Promise<boolean>} 是否成功
 */
async function removeImageFromRecord(options) {
  const { table, id, imageUrl, imageType, record, userId, userType } = options;
  
  try {
    // 删除物理文件
    await deletePhysicalFile(imageUrl, userId, userType);
    
    const updateData = {};
    
    // 根据图片类型处理：单图字段直接置空，数组字段从数组中移除
    const singleImageFields = ['cover_image', 'logo', 'poster', 'qr_code'];
    
    if (singleImageFields.includes(imageType)) {
      // 单图字段，直接置空
      if (record[imageType] === imageUrl) {
        updateData[imageType] = null;
      }
    } else if (imageType === 'images' || imageType === 'gallery') {
      // 数组字段，从数组中移除指定URL
      if (record[imageType]) {
        const imagesArray = parseImagesField(record[imageType]);
        const filteredArray = imagesArray.filter(url => url !== imageUrl);
        updateData[imageType] = filteredArray.length > 0 ? JSON.stringify(filteredArray) : null;
      }
    }
    
    // 执行更新
    if (Object.keys(updateData).length > 0) {
      await db(table).where({ id }).update(updateData);
    }
    
    logger.info(`删除${table}图片URL成功:`, { table, id, imageUrl, imageType, userId });
    return true;
  } catch (error) {
    logger.error(`删除${table}图片URL失败:`, { error: error.message, table, id, imageUrl, imageType, userId });
    return false;
  }
}

/**
 * 删除记录关联的所有图片
 * @description 批量删除记录中的所有图片字段
 * @param {Object} options - 配置选项
 * @param {string} options.table - 表名
 * @param {Object} options.record - 记录对象
 * @param {Array<string>} options.singleImageFields - 单图字段列表
 * @param {Array<string>} options.arrayImageFields - 数组图片字段列表
 * @param {number} options.userId - 操作用户ID
 * @param {string} options.userType - 用户类型
 * @returns {Promise<{success: number, failed: number}>} 删除统计
 */
async function deleteAllRecordImages(options) {
  const { record, singleImageFields = [], arrayImageFields = [], userId, userType } = options;
  
  let successCount = 0;
  let failedCount = 0;
  
  // 删除单图字段
  for (const field of singleImageFields) {
    if (record[field]) {
      try {
        const result = await deletePhysicalFile(record[field], userId, userType);
        if (result) successCount++;
        else failedCount++;
      } catch (error) {
        logger.error(`删除${field}图片失败:`, { error: error.message });
        failedCount++;
      }
    }
  }
  
  // 删除数组图片字段
  for (const field of arrayImageFields) {
    if (record[field]) {
      try {
        const imagesArray = parseImagesField(record[field]);
        if (imagesArray.length > 0) {
          const result = await deletePhysicalFiles(imagesArray, userId, userType);
          successCount += result.success;
          failedCount += result.failed;
        }
      } catch (error) {
        logger.error(`删除${field}图片数组失败:`, { error: error.message, field });
      }
    }
  }
  
  return { success: successCount, failed: failedCount };
}

/**
 * 删除活动所有图片
 * @param {Object} event - 活动记录
 * @param {number} userId - 用户ID
 * @param {string} userType - 用户类型
 * @returns {Promise<{success: number, failed: number}>}
 */
async function deleteAllEventImages(event, userId, userType) {
  return deleteAllRecordImages({
    record: event,
    singleImageFields: ['cover_image'],
    arrayImageFields: ['images'],
    userId,
    userType
  });
}

/**
 * 删除社团所有图片
 * @param {Object} club - 社团记录
 * @param {number} userId - 用户ID
 * @param {string} userType - 用户类型
 * @returns {Promise<{success: number, failed: number}>}
 */
async function deleteAllClubImages(club, userId, userType) {
  return deleteAllRecordImages({
    record: club,
    singleImageFields: ['logo', 'cover_image'],
    arrayImageFields: ['gallery'],
    userId,
    userType
  });
}

/**
 * 删除公告所有图片
 * @param {Object} announcement - 公告记录
 * @param {number} userId - 用户ID
 * @param {string} userType - 用户类型
 * @returns {Promise<{success: number, failed: number}>}
 */
async function deleteAllAnnouncementImages(announcement, userId, userType) {
  return deleteAllRecordImages({
    record: announcement,
    singleImageFields: [],
    arrayImageFields: ['images'],
    userId,
    userType
  });
}

/**
 * 删除招新所有图片
 * @param {Object} recruitment - 招新记录
 * @param {number} userId - 用户ID
 * @param {string} userType - 用户类型
 * @returns {Promise<{success: number, failed: number}>}
 */
async function deleteAllRecruitmentImages(recruitment, userId, userType) {
  return deleteAllRecordImages({
    record: recruitment,
    singleImageFields: ['cover_image', 'poster', 'qr_code'],
    arrayImageFields: [],
    userId,
    userType
  });
}

module.exports = {
  removeImageFromRecord,
  deleteAllRecordImages,
  deleteAllEventImages,
  deleteAllClubImages,
  deleteAllAnnouncementImages,
  deleteAllRecruitmentImages
};
