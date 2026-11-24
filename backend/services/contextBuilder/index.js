/**
 * 上下文构建器 - 主入口
 * @description 整合所有子模块，提供统一的对外接口
 * 
 * 模块结构：
 * - constants.js: 常量定义
 * - utils.js: 工具函数
 * - intentDetector.js: 意图识别
 * - dataRetriever.js: 数据检索
 * - dataFormatter.js: 数据格式化
 */

const { detectIntent } = require('./intentDetector');
const { retrieveContext, getUserProfile } = require('./dataRetriever');
const { buildContextMessage } = require('./dataFormatter');

module.exports = {
  detectIntent,
  retrieveContext,
  buildContextMessage,
  getUserProfile
};
