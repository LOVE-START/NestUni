// routes/announcements.js - 公告相关路由
const express = require('express');
const db = require('../config/database');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { requireClubLeader } = require('../middleware/clubLeader');
const logger = require('../config/logger');
const { deletePhysicalFile, deletePhysicalFiles } = require('../utils/fileUtils');

// 引入公共工具函数
const {
  safeJsonParse,
  processImagesField,
  parseImagesField,
  getPaginationParams,
  buildPaginationResponse
} = require('../utils/helpers');

const {
  validateClubExists,
  validateAnnouncementExists,
  isValidImageType,
  buildNotFoundError,
  buildBadRequestError
} = require('../utils/validators');

const {
  removeImageFromRecord,
  deleteAllAnnouncementImages
} = require('../utils/imageHandlers');

const { createApproval, ApprovalTargetType } = require('../utils/approvalHelper');

const router = express.Router();

/**
 * 获取公告列表 - 仅支持POST方法（与前端API保持一致）
 * @description 只返回已审核通过的公告
 * @route POST /nfunest/api/announcements
 */
router.post('/', optionalAuth, getAnnouncementsList);

/**
 * 公告列表处理函数
 * @description 只返回 approval_status = 'approved' 的公告
 */
async function getAnnouncementsList(req, res, next) {
  try {
    const { page = 1, pageSize = 20, club_id } = req.body;
    const { offset } = getPaginationParams(req.body);

    let query = db('announcements')
      .select(
        'announcements.id', 'announcements.title', 'announcements.content',
        'announcements.images', 'announcements.club_id', 'announcements.created_at',
        'clubs.name as club_name'
      )
      .leftJoin('clubs', 'announcements.club_id', 'clubs.id')
      .where('announcements.approval_status', 'approved');

    if (club_id) {
      query = query.where('announcements.club_id', club_id);
    }

    const announcements = await query
      .orderBy('announcements.created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const processedAnnouncements = announcements.map(announcement => ({
      ...announcement,
      images: parseImagesField(announcement.images)
    }));

    let countQuery = db('announcements').where('approval_status', 'approved');
    if (club_id) countQuery = countQuery.where('club_id', club_id);
    const [{ count }] = await countQuery.count('id as count');

    res.json({
      success: true,
      data: processedAnnouncements,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 获取公告详情
 * @route GET /nfunest/api/announcements/:id
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const announcement = await db('announcements')
      .select('announcements.*', 'clubs.name as club_name')
      .leftJoin('clubs', 'announcements.club_id', 'clubs.id')
      .where('announcements.id', id)
      .first();

    if (!announcement) {
      return res.status(404).json(buildNotFoundError('公告'));
    }

    // 处理图片字段
    const processedAnnouncement = {
      ...announcement,
      images: parseImagesField(announcement.images)
    };

    res.json({
      success: true,
      data: processedAnnouncement
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 社团会长创建公告
 * @description 创建公告后进入审核流程，审核通过后才对外显示
 * @route POST /nfunest/api/announcements/club/:clubId
 */
router.post('/club/:clubId', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { clubId } = req.params;
    const { title, content, images } = req.body;

    const club = await validateClubExists(clubId);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    if (!title || !content) {
      return res.status(400).json(buildBadRequestError('请填写公告标题和内容'));
    }

    const processedImages = processImagesField(images);

    const announcementData = {
      title,
      content,
      images: processedImages,
      club_id: clubId,
      approval_status: 'pending',
      created_at: db.fn.now()
    };

    const [announcementId] = await db('announcements').insert(announcementData);

    await createApproval({
      targetType: ApprovalTargetType.ANNOUNCEMENT,
      targetId: announcementId,
      clubId: parseInt(clubId, 10),
      applicantId: req.user.id
    });

    const newAnnouncement = await db('announcements')
      .select('*')
      .where({ id: announcementId })
      .first();
    
    logger.info('会长创建社团公告（待审核）:', { announcementId, clubId, userId: req.user.id });

    res.status(201).json({
      success: true,
      message: '公告已提交，等待审核',
      data: {
        ...newAnnouncement,
        images: parseImagesField(newAnnouncement.images)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 社团会长更新公告
 * @route PUT /nfunest/api/announcements/:id
 */
router.put('/:id', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // 处理图片数据
    if (updateData.images !== undefined) {
      updateData.images = processImagesField(updateData.images);
    }

    // 验证公告是否存在且属于该社团
    const announcement = await validateAnnouncementExists(id, { clubId: req.clubId });
    if (!announcement) {
      return res.status(404).json(buildNotFoundError('公告或不属于您的社团'));
    }

    await db('announcements').where({ id }).update(updateData);

    const updatedAnnouncement = await db('announcements').where({ id }).first();

    logger.info('会长更新社团公告:', { announcementId: id, clubId: req.clubId, userId: req.user.id });

    res.json({
      success: true,
      message: '公告更新成功',
      data: {
        ...updatedAnnouncement,
        images: parseImagesField(updatedAnnouncement.images)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 社团会长删除公告中的图片URL
 * @route DELETE /nfunest/api/announcements/:id/images
 */
router.delete('/:id/images', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { imageUrl, imageType } = req.body;

    // 验证公告是否存在且属于该社团
    const announcement = await validateAnnouncementExists(id, { clubId: req.clubId });
    if (!announcement) {
      return res.status(404).json(buildNotFoundError('公告或不属于您的社团'));
    }

    // 验证参数
    if (!imageUrl || !imageType) {
      return res.status(400).json(buildBadRequestError('缺少必要参数'));
    }

    // 验证imageType是否合法
    const validImageTypes = ['images'];
    if (!isValidImageType(imageType, validImageTypes)) {
      return res.status(400).json(buildBadRequestError('无效的图片类型'));
    }

    await removeImageFromRecord({
      table: 'announcements',
      id,
      imageUrl,
      imageType,
      record: announcement,
      userId: req.user.id,
      userType: 'leader'
    });

    logger.info('会长删除公告图片URL:', { announcementId: id, imageUrl, imageType, userId: req.user.id });

    res.json({
      success: true,
      message: '图片URL删除成功'
    });
  } catch (error) {
    logger.error('删除公告图片URL失败:', {
      error: error.message,
      stack: error.stack,
      announcementId: req.params.id,
      userId: req.user?.id
    });
    next(error);
  }
});

/**
 * 社团会长删除公告
 * @route DELETE /nfunest/api/announcements/:id
 */
router.delete('/:id', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { id } = req.params;

    // 验证公告是否存在且属于该社团
    const announcement = await validateAnnouncementExists(id, { clubId: req.clubId });
    if (!announcement) {
      return res.status(404).json(buildNotFoundError('公告或不属于您的社团'));
    }

    // 删除公告中的所有图片文件
    await deleteAllAnnouncementImages(announcement, req.user.id, 'leader');

    // 删除公告
    await db('announcements').where({ id }).del();

    logger.info('会长删除社团公告:', { announcementId: id, clubId: req.clubId, userId: req.user.id });

    res.json({
      success: true,
      message: '公告删除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 社团会长通过指定clubId删除公告
 * @route DELETE /nfunest/api/announcements/:id/club/:clubId
 * @description 与 DELETE /:id 功能相同，保留此路由以兼容前端
 */
router.delete('/:id/club/:clubId', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { id } = req.params;

    // 验证公告是否存在且属于该社团
    const announcement = await validateAnnouncementExists(id, { clubId: req.clubId });
    if (!announcement) {
      return res.status(404).json(buildNotFoundError('公告或不属于您的社团'));
    }

    // 删除公告中的所有图片文件
    await deleteAllAnnouncementImages(announcement, req.user.id, 'leader');

    // 删除公告
    await db('announcements').where({ id }).del();

    logger.info('会长删除社团公告:', { announcementId: id, clubId: req.clubId, userId: req.user.id });

    res.json({
      success: true,
      message: '公告删除成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
