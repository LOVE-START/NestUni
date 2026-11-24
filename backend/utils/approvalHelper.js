/**
 * 审核工具函数
 * @description 处理活动、公告等内容的审核流程
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { sendAuditResultNotice, sendPendingAuditToTeachers, sendAnnouncementToClubMembers, sendNewEventToClubMembers } = require('../services/notifyService');
const { scheduleEventReminder, cancelEventReminder } = require('../services/schedulerService');

/**
 * 审核对象类型枚举
 */
const ApprovalTargetType = {
  EVENT: 'event',
  ANNOUNCEMENT: 'announcement',
  CLUB: 'club'
};

/**
 * 审核状态枚举
 */
const ApprovalStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

/**
 * 创建审核记录
 * @description 创建审核记录并发送待审核提醒给老师
 * @param {Object} params - 审核参数
 * @param {string} params.targetType - 审核对象类型 (event/announcement/club)
 * @param {number} params.targetId - 审核对象ID
 * @param {number} params.clubId - 所属社团ID
 * @param {number} params.applicantId - 申请人ID
 * @returns {Promise<number>} 审核记录ID
 */
async function createApproval({ targetType, targetId, clubId, applicantId }) {
  try {
    const [approvalId] = await db('approvals').insert({
      target_type: targetType,
      target_id: targetId,
      club_id: clubId || null,
      applicant_id: applicantId,
      status: ApprovalStatus.PENDING,
      created_at: db.fn.now()
    });

    logger.info('创建审核记录:', {
      approvalId,
      targetType,
      targetId,
      clubId,
      applicantId
    });

    // 异步发送待审核提醒给老师
    setImmediate(async () => {
      try {
        await sendPendingAuditNotification(approvalId, targetType, targetId, clubId);
      } catch (error) {
        logger.error('发送待审核提醒失败:', {
          error: error.message,
          approvalId,
          targetType
        });
      }
    });

    return approvalId;
  } catch (error) {
    logger.error('创建审核记录失败:', {
      error: error.message,
      targetType,
      targetId,
      applicantId
    });
    throw error;
  }
}

/**
 * 发送待审核提醒给老师
 * @description 根据审核对象类型获取详细信息并发送通知
 * @param {number} approvalId - 审核记录ID
 * @param {string} targetType - 审核对象类型
 * @param {number} targetId - 审核对象ID
 * @param {number} clubId - 社团ID
 */
async function sendPendingAuditNotification(approvalId, targetType, targetId, clubId) {
  let projectName = '';
  let location = '';
  let startTime = '';
  let applicant = '';
  let remark = '';

  // 获取社团名称
  if (clubId) {
    const club = await db('clubs').where({ id: clubId }).first();
    applicant = club ? club.name : '未知社团';
  }

  // 根据类型获取详细信息
  if (targetType === ApprovalTargetType.EVENT) {
    const event = await db('events').where({ id: targetId }).first();
    if (event) {
      projectName = event.title || '活动';
      location = event.location || '线上活动';
      startTime = event.date && event.time ? `${event.date} ${event.time}` : '';  // 无时间传空值
      remark = event.description || '无';
    }
  } else if (targetType === ApprovalTargetType.ANNOUNCEMENT) {
    const announcement = await db('announcements').where({ id: targetId }).first();
    if (announcement) {
      projectName = announcement.title || '公告';
      location = '公告发布';
      startTime = '';  // 公告无时间，传空值让 formatDateTime 使用默认零点
      remark = announcement.content ? announcement.content.substring(0, 100) : '无';
    }
  }

  // 发送通知给所有绑定了微信的老师
  const result = await sendPendingAuditToTeachers({
    projectName,
    location,
    startTime,
    applicant,
    remark
  });

  logger.info('待审核提醒发送结果:', {
    approvalId,
    targetType,
    result
  });
}

/**
 * 获取待审核列表
 * @param {Object} params - 查询参数
 * @param {string} params.targetType - 审核对象类型（可选）
 * @param {number} params.clubId - 社团ID（可选）
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 * @returns {Promise<Object>} 审核列表及分页信息
 */
async function getPendingApprovals({ targetType, clubId, page = 1, pageSize = 20 }) {
  try {
    const offset = (page - 1) * pageSize;
    
    let query = db('approvals')
      .where({ status: ApprovalStatus.PENDING });

    if (targetType) {
      query = query.where({ target_type: targetType });
    }
    if (clubId) {
      query = query.where({ club_id: clubId });
    }

    const approvals = await query
      .orderBy('created_at', 'asc')
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db('approvals')
      .where({ status: ApprovalStatus.PENDING })
      .modify(qb => {
        if (targetType) qb.where({ target_type: targetType });
        if (clubId) qb.where({ club_id: clubId });
      })
      .count('id as count');

    return {
      list: approvals,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: count,
        totalPages: Math.ceil(count / pageSize)
      }
    };
  } catch (error) {
    logger.error('获取待审核列表失败:', { error: error.message });
    throw error;
  }
}

/**
 * 审核通过
 * @description 审核通过后，同时更新目标对象的 approval_status 和 status（活动），并发送通知给会长
 * @param {number} approvalId - 审核记录ID
 * @param {number} approverId - 审核人ID
 * @returns {Promise<Object>} 更新后的审核记录
 */
async function approveApproval(approvalId, approverId) {
  try {
    const approval = await db('approvals').where({ id: approvalId }).first();

    if (!approval) {
      throw new Error('审核记录不存在');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new Error('该记录已审核，无法重复操作');
    }

    const applicantId = approval.applicant_id;
    let targetTitle = '';

    await db.transaction(async (trx) => {
      await trx('approvals')
        .where({ id: approvalId })
        .update({
          status: ApprovalStatus.APPROVED,
          approver_id: approverId,
          approved_at: db.fn.now()
        });

      if (approval.target_type === ApprovalTargetType.EVENT) {
        const event = await trx('events').where({ id: approval.target_id }).first();
        targetTitle = event ? event.title : '活动';
        await trx('events')
          .where({ id: approval.target_id })
          .update({
            approval_status: ApprovalStatus.APPROVED,
            status: 'published'
          });
        
        if (event) {
          scheduleEventReminder(event);
          
          // [MODIFY] 审核通过后发送新活动通知给社团成员
          if (approval.club_id) {
            const eventTime = event.time || '00:00';
            const eventData = {
              eventName: event.title,
              startTime: `${event.date} ${eventTime}`,
              location: event.location,
              description: event.description || '欢迎参加'
            };
            
            setImmediate(async () => {
              try {
                const result = await sendNewEventToClubMembers(
                  approval.club_id,
                  eventData,
                  `pages/activitiesDetail/activitiesDetail?id=${event.id}`
                );
                logger.info('新活动通知发送结果:', {
                  eventId: event.id,
                  clubId: approval.club_id,
                  result
                });
              } catch (error) {
                logger.error('发送新活动通知失败:', {
                  error: error.message,
                  eventId: event.id,
                  clubId: approval.club_id
                });
              }
            });
          }
        }
      } else if (approval.target_type === ApprovalTargetType.ANNOUNCEMENT) {
        const announcement = await trx('announcements').where({ id: approval.target_id }).first();
        targetTitle = announcement ? announcement.title : '公告';
        await trx('announcements')
          .where({ id: approval.target_id })
          .update({ approval_status: ApprovalStatus.APPROVED });
        
        if (announcement && approval.club_id) {
          const club = await trx('clubs').where({ id: approval.club_id }).first();
          const clubName = club ? club.name : '社团';
          const now = new Date();
          const sendTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          
          setImmediate(async () => {
            try {
              const result = await sendAnnouncementToClubMembers(approval.club_id, {
                title: announcement.title,
                content: announcement.content,
                clubName: clubName,
                sendTime: sendTime
              });
              logger.info('公告通知发送结果:', {
                announcementId: announcement.id,
                clubId: approval.club_id,
                result
              });
            } catch (error) {
              logger.error('发送公告通知失败:', {
                error: error.message,
                announcementId: announcement.id,
                clubId: approval.club_id
              });
            }
          });
        }
      }
    });

    logger.info('审核通过:', {
      approvalId,
      targetType: approval.target_type,
      targetId: approval.target_id,
      approverId
    });

    const now = new Date();
    const submitTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    sendAuditResultNotice(applicantId, {
      title: targetTitle,
      result: '通过',
      submitTime: submitTime,
      remark: '审核通过！'
    }).catch(err => {
      logger.error('发送审核通过通知失败:', { error: err.message, applicantId });
    });

    return await db('approvals').where({ id: approvalId }).first();
  } catch (error) {
    logger.error('审核通过失败:', {
      error: error.message,
      approvalId,
      approverId
    });
    throw error;
  }
}

/**
 * 审核拒绝
 * @description 审核拒绝后，同时更新目标对象的 approval_status，并发送通知给会长
 * @param {number} approvalId - 审核记录ID
 * @param {number} approverId - 审核人ID
 * @param {string} rejectReason - 拒绝原因
 * @returns {Promise<Object>} 更新后的审核记录
 */
async function rejectApproval(approvalId, approverId, rejectReason) {
  try {
    const approval = await db('approvals').where({ id: approvalId }).first();

    if (!approval) {
      throw new Error('审核记录不存在');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new Error('该记录已审核，无法重复操作');
    }

    const applicantId = approval.applicant_id;
    let targetTitle = '';

    await db.transaction(async (trx) => {
      await trx('approvals')
        .where({ id: approvalId })
        .update({
          status: ApprovalStatus.REJECTED,
          approver_id: approverId,
          reject_reason: rejectReason,
          approved_at: db.fn.now()
        });

      if (approval.target_type === ApprovalTargetType.EVENT) {
        const event = await trx('events').where({ id: approval.target_id }).first();
        targetTitle = event ? event.title : '活动';
        await trx('events')
          .where({ id: approval.target_id })
          .update({ approval_status: ApprovalStatus.REJECTED });
      } else if (approval.target_type === ApprovalTargetType.ANNOUNCEMENT) {
        const announcement = await trx('announcements').where({ id: approval.target_id }).first();
        targetTitle = announcement ? announcement.title : '公告';
        await trx('announcements')
          .where({ id: approval.target_id })
          .update({ approval_status: ApprovalStatus.REJECTED });
      }
    });

    logger.info('审核拒绝:', {
      approvalId,
      targetType: approval.target_type,
      targetId: approval.target_id,
      approverId,
      rejectReason
    });

    const now = new Date();
    const submitTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    sendAuditResultNotice(applicantId, {
      title: targetTitle,
      result: '不通过',
      submitTime: submitTime,
      remark: rejectReason || '审核未通过'
    }).catch(err => {
      logger.error('发送审核拒绝通知失败:', { error: err.message, applicantId });
    });

    return await db('approvals').where({ id: approvalId }).first();
  } catch (error) {
    logger.error('审核拒绝失败:', {
      error: error.message,
      approvalId,
      approverId
    });
    throw error;
  }
}

/**
 * 获取审核详情（包含关联的对象信息）
 * @param {number} approvalId - 审核记录ID
 * @returns {Promise<Object>} 审核详情
 */
async function getApprovalDetail(approvalId) {
  try {
    const approval = await db('approvals').where({ id: approvalId }).first();
    
    if (!approval) {
      return null;
    }

    const result = { ...approval };

    if (approval.target_type === ApprovalTargetType.EVENT) {
      const event = await db('events')
        .where({ id: approval.target_id })
        .first();
      result.target = event;
    } else if (approval.target_type === ApprovalTargetType.ANNOUNCEMENT) {
      const announcement = await db('announcements')
        .where({ id: approval.target_id })
        .first();
      result.target = announcement;
    }

    if (approval.club_id) {
      const club = await db('clubs')
        .select('id', 'name', 'logo')
        .where({ id: approval.club_id })
        .first();
      result.club = club;
    }

    const applicant = await db('users')
      .select('id', 'nickname', 'avatar', 'student_id')
      .where({ id: approval.applicant_id })
      .first();
    result.applicant = applicant;

    return result;
  } catch (error) {
    logger.error('获取审核详情失败:', {
      error: error.message,
      approvalId
    });
    throw error;
  }
}

/**
 * 获取用户的审核记录（会长查看自己的申请）
 * @param {number} userId - 用户ID
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 审核记录列表
 */
async function getUserApprovals(userId, { status, page = 1, pageSize = 20 }) {
  try {
    const offset = (page - 1) * pageSize;
    
    let query = db('approvals')
      .where({ applicant_id: userId });

    if (status) {
      query = query.where({ status });
    }

    const approvals = await query
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db('approvals')
      .where({ applicant_id: userId })
      .modify(qb => {
        if (status) qb.where({ status });
      })
      .count('id as count');

    return {
      list: approvals,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: count,
        totalPages: Math.ceil(count / pageSize)
      }
    };
  } catch (error) {
    logger.error('获取用户审核记录失败:', {
      error: error.message,
      userId
    });
    throw error;
  }
}

module.exports = {
  ApprovalTargetType,
  ApprovalStatus,
  createApproval,
  getPendingApprovals,
  approveApproval,
  rejectApproval,
  getApprovalDetail,
  getUserApprovals
};
