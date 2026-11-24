/**
 * 报名操作日志服务
 * @description 记录报名状态变更历史，实现操作可追溯
 */

const db = require('../config/database');
const logger = require('../config/logger');

/**
 * 操作类型枚举
 */
const ActionTypes = {
  SUBMIT: 'submit',
  VIEW: 'view',
  INTERVIEW: 'interview',
  ACCEPT: 'accept',
  REJECT: 'reject',
  UPDATE: 'update'
};

/**
 * 获取操作类型文本
 * @param {string} action - 操作类型
 * @returns {string} 操作文本
 */
function getActionText(action) {
  const actionMap = {
    [ActionTypes.SUBMIT]: '提交报名',
    [ActionTypes.VIEW]: '查看报名',
    [ActionTypes.INTERVIEW]: '安排面试',
    [ActionTypes.ACCEPT]: '录取',
    [ActionTypes.REJECT]: '拒绝',
    [ActionTypes.UPDATE]: '更新信息'
  };
  return actionMap[action] || action;
}

/**
 * 记录操作日志
 * @description 记录报名状态变更的完整信息
 * @param {Object} params - 日志参数
 * @param {number} params.applicationId - 报名ID
 * @param {number} params.operatorId - 操作人ID
 * @param {string} params.operatorName - 操作人姓名
 * @param {string} params.operatorRole - 操作人角色
 * @param {string} params.action - 操作类型
 * @param {string} [params.oldStatus] - 原状态
 * @param {string} [params.newStatus] - 新状态
 * @param {string} [params.remark] - 操作备注
 * @param {Object} [params.extraData] - 额外数据
 * @returns {Promise<number>} 日志ID
 */
async function logApplicationAction(params) {
  const {
    applicationId,
    operatorId,
    operatorName,
    operatorRole,
    action,
    oldStatus,
    newStatus,
    remark,
    extraData
  } = params;

  try {
    const [logId] = await db('application_logs').insert({
      application_id: applicationId,
      operator_id: operatorId,
      operator_name: operatorName,
      operator_role: operatorRole,
      action,
      old_status: oldStatus,
      new_status: newStatus,
      remark,
      extra_data: extraData ? JSON.stringify(extraData) : null,
      created_at: db.fn.now()
    });

    logger.info('记录操作日志成功:', {
      applicationId,
      action: getActionText(action),
      operatorId,
      operatorName
    });

    return logId;
  } catch (error) {
    logger.error('记录操作日志失败:', {
      error: error.message,
      params
    });
    throw error;
  }
}

/**
 * 获取报名的操作历史
 * @description 获取指定报名的所有操作记录
 * @param {number} applicationId - 报名ID
 * @returns {Promise<Array>} 操作记录列表
 */
async function getApplicationLogs(applicationId) {
  try {
    const logs = await db('application_logs')
      .where('application_id', applicationId)
      .orderBy('created_at', 'desc');

    return logs.map(log => ({
      id: log.id,
      applicationId: log.application_id,
      operatorId: log.operator_id,
      operatorName: log.operator_name,
      operatorRole: log.operator_role,
      action: log.action,
      actionText: getActionText(log.action),
      oldStatus: log.old_status,
      newStatus: log.new_status,
      remark: log.remark,
      extraData: log.extra_data ? JSON.parse(log.extra_data) : null,
      createdAt: log.created_at
    }));
  } catch (error) {
    logger.error('获取操作日志失败:', {
      error: error.message,
      applicationId
    });
    throw error;
  }
}

/**
 * 根据状态变更自动确定操作类型
 * @param {string} newStatus - 新状态
 * @returns {string} 操作类型
 */
function determineActionByStatus(newStatus) {
  const statusActionMap = {
    'submitted': ActionTypes.SUBMIT,
    'viewed': ActionTypes.VIEW,
    'interviewing': ActionTypes.INTERVIEW,
    'accepted': ActionTypes.ACCEPT,
    'rejected': ActionTypes.REJECT
  };
  return statusActionMap[newStatus] || ActionTypes.UPDATE;
}

module.exports = {
  ActionTypes,
  getActionText,
  logApplicationAction,
  getApplicationLogs,
  determineActionByStatus
};
