// routes/admin.js - 管理员相关路由
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const db = require('../config/database');
const { verifyToken, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { requireClubLeader } = require('../middleware/clubLeader');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');
const { deletePhysicalFile, deletePhysicalFiles } = require('../utils/fileUtils');
const { createApproval, ApprovalTargetType } = require('../utils/approvalHelper');

// 引入公共工具函数
const {
  safeJsonParse,
  processImagesField,
  parseImagesField,
  getPaginationParams,
  buildPaginationResponse,
  processJsonFields,
  cleanUpdateData,
  formatDate,
  parseEmptyAsNull,
  parseNumberField
} = require('../utils/helpers');

const {
  validateEntityExists,
  validateClubExists,
  validateEventExists,
  validateUserExists,
  validateAnnouncementExists,
  isValidClubLevel,
  isValidMemberRole,
  isValidEventStatus,
  isValidParticipantStatus,
  isValidImageType,
  buildNotFoundError,
  buildBadRequestError,
  buildForbiddenError
} = require('../utils/validators');

const {
  removeImageFromRecord,
  deleteAllClubImages,
  deleteAllEventImages,
  deleteAllAnnouncementImages
} = require('../utils/imageHandlers');

const router = express.Router();

/**
 * 管理员登录
 * @route POST /nfunest/api/admin/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json(buildBadRequestError('请输入用户名和密码'));
    }

    // 查找管理员
    const admin = await db('admins').where({ username }).first();

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    // 验证密码
    const isPasswordValid = password === admin.password;
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    // 生成JWT token
    const token = jwt.sign(
      { id: admin.id, username: admin.username, level: admin.level, type: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 返回管理员信息（不包含密码）
    const responseAdmin = {
      id: admin.id,
      username: admin.username,
      level: admin.level,
      created_at: admin.created_at
    };

    logger.info('管理员登录成功:', { adminId: admin.id, username: admin.username });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        userInfo: responseAdmin
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 获取管理员统计数据
 * @route GET /nfunest/api/admin/stats
 */
router.get('/stats', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    // 并行获取各种统计数据
    const [
      { totalClubs },
      { totalEvents },
      { totalUsers },
      recentEvents,
      recentUsers
    ] = await Promise.all([
      db('clubs').count('id as totalClubs').first(),
      db('events').count('id as totalEvents').first(),
      db('users').count('id as totalUsers').first(),
      db('events')
        .select('id', 'title', 'date', 'current_participants', 'max_participants', 'status')
        .orderBy('created_at', 'desc')
        .limit(5),
      db('users')
        .select('id', 'nickname', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(10)
    ]);

    res.json({
      success: true,
      data: {
        overview: { totalClubs, totalEvents, totalUsers },
        recentEvents,
        recentUsers
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 创建公告
 * @route POST /nfunest/api/admin/announcements
 */
router.post('/announcements', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, content, images, club_id } = req.body;

    if (!title || !content) {
      return res.status(400).json(buildBadRequestError('请填写公告标题和内容'));
    }

    // 验证关联的社团是否存在
    if (club_id) {
      const club = await validateClubExists(club_id);
      if (!club) {
        return res.status(400).json(buildBadRequestError('指定的社团不存在'));
      }
    }

    // 处理图片数据
    const processedImages = processImagesField(images);

    const announcementData = {
      title,
      content,
      images: processedImages,
      club_id: club_id || null,
      created_at: db.fn.now()
    };

    const [announcementId] = await db('announcements').insert(announcementData);

    // 获取新创建的公告
    const newAnnouncement = await db('announcements')
      .select('*')
      .where({ id: announcementId })
      .first();
    
    logger.info('创建公告:', { announcementId, adminId: req.user.id });

    res.status(201).json({
      success: true,
      message: '公告创建成功',
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
 * 更新公告
 * @route PUT /nfunest/api/admin/announcements/:id
 */
router.put('/announcements/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // 验证公告是否存在
    const announcement = await validateAnnouncementExists(id);
    if (!announcement) {
      return res.status(404).json(buildNotFoundError('公告'));
    }

    // 验证关联的社团是否存在
    if (updateData.club_id) {
      const club = await validateClubExists(updateData.club_id);
      if (!club) {
        return res.status(400).json(buildBadRequestError('指定的社团不存在'));
      }
    }

    // 处理图片数据
    if (updateData.images !== undefined) {
      updateData.images = processImagesField(updateData.images);
    }

    await db('announcements').where({ id }).update(updateData);

    const updatedAnnouncement = await db('announcements').where({ id }).first();

    logger.info('更新公告:', { announcementId: id, adminId: req.user.id });

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
 * 删除公告
 * @route DELETE /nfunest/api/admin/announcements/:id
 */
router.delete('/announcements/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const announcement = await validateAnnouncementExists(id);
    if (!announcement) {
      return res.status(404).json(buildNotFoundError('公告'));
    }

    // 删除公告中的所有图片文件
    await deleteAllAnnouncementImages(announcement, req.user.id, 'admin');

    // 删除公告
    await db('announcements').where({ id }).del();

    logger.info('删除公告:', { announcementId: id, adminId: req.user.id });

    res.json({
      success: true,
      message: '公告删除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 删除公告图片URL
 * @route DELETE /nfunest/api/admin/announcements/:id/images
 */
router.delete('/announcements/:id/images', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { imageUrl, imageType } = req.body;

    const announcement = await validateAnnouncementExists(id);
    if (!announcement) {
      return res.status(404).json(buildNotFoundError('公告'));
    }

    if (!imageUrl || !imageType) {
      return res.status(400).json(buildBadRequestError('缺少必要参数'));
    }

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
      userType: 'admin'
    });

    logger.info('删除公告图片URL:', { announcementId: id, imageUrl, imageType, adminId: req.user.id });

    res.json({
      success: true,
      message: '图片URL删除成功'
    });
  } catch (error) {
    logger.error('删除公告图片URL失败:', {
      error: error.message,
      stack: error.stack,
      announcementId: req.params.id,
      adminId: req.user?.id
    });
    next(error);
  }
});

/**
 * 更新社团信息
 * @route PUT /nfunest/api/admin/clubs/:id
 */
router.put('/clubs/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    // 处理level字段
    if (updateData.level !== undefined && !isValidClubLevel(updateData.level)) {
      return res.status(400).json(buildBadRequestError('社团级别只能是 school 或 college'));
    }

    // 处理gallery字段
    if (updateData.gallery && Array.isArray(updateData.gallery)) {
      const cleanGallery = updateData.gallery.filter(url => typeof url === 'string' && url.length > 0);
      updateData.gallery = JSON.stringify(cleanGallery);
      logger.info('处理相册数据:', { original: updateData.gallery, cleaned: cleanGallery });
    } else if (updateData.gallery === undefined || updateData.gallery === null) {
      delete updateData.gallery;
      logger.info('相册数据未提供，保持原值');
    } else {
      delete updateData.gallery;
      logger.warn('相册数据格式不正确，保持原值:', { gallery: updateData.gallery });
    }

    updateData.updated_at = db.fn.now();
    delete updateData.id;
    delete updateData.created_at;

    await db('clubs').where({ id }).update(updateData);

    const updatedClub = await db('clubs').where({ id }).first();

    logger.info('更新社团信息:', { clubId: id, adminId: req.user.id });

    res.json({
      success: true,
      message: '社团信息更新成功',
      data: {
        ...updatedClub,
        gallery: safeJsonParse(updatedClub.gallery, [])
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 创建社团
 * @route POST /nfunest/api/admin/clubs
 */
router.post('/clubs', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { name, short_intro, description, category, level, logo, cover_image, gallery } = req.body;

    if (!name) {
      return res.status(400).json(buildBadRequestError('请填写社团名称'));
    }

    // 检查社团名称是否重复
    const existingClub = await db('clubs').where({ name }).first();
    if (existingClub) {
      return res.status(400).json(buildBadRequestError('社团名称已存在'));
    }

    const clubData = {
      name,
      short_intro,
      description,
      category: category || '未分类',
      level: level && isValidClubLevel(level) ? level : 'college',
      logo,
      cover_image,
      gallery: processImagesField(gallery),
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    };

    const [clubId] = await db('clubs').insert(clubData);

    const newClub = await db('clubs').where({ id: clubId }).first();

    logger.info('创建社团:', { clubId, adminId: req.user.id });

    res.status(201).json({
      success: true,
      message: '社团创建成功',
      data: {
        ...newClub,
        gallery: safeJsonParse(newClub.gallery, [])
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 删除社团图片URL
 * @route DELETE /nfunest/api/admin/clubs/:id/images
 */
router.delete('/clubs/:id/images', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { imageUrl, imageType } = req.body;

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    if (!imageUrl || !imageType) {
      return res.status(400).json(buildBadRequestError('缺少必要参数'));
    }

    const validImageTypes = ['logo', 'cover_image', 'gallery'];
    if (!isValidImageType(imageType, validImageTypes)) {
      return res.status(400).json(buildBadRequestError('无效的图片类型'));
    }

    await removeImageFromRecord({
      table: 'clubs',
      id,
      imageUrl,
      imageType,
      record: club,
      userId: req.user.id,
      userType: 'admin'
    });

    logger.info('删除社团图片URL:', { clubId: id, adminId: req.user.id, imageUrl });

    res.json({
      success: true,
      message: '图片URL删除成功'
    });
  } catch (error) {
    logger.error('删除图片URL失败:', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * 删除社团
 * @route DELETE /nfunest/api/admin/clubs/:id
 */
router.delete('/clubs/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    // 删除社团相关的物理文件
    try {
      await deleteAllClubImages(club, req.user.id, 'admin');
    } catch (fileDeleteError) {
      logger.error('删除社团相关文件时出错:', { 
        error: fileDeleteError.message, 
        clubId: id, 
        adminId: req.user.id 
      });
    }

    // 删除社团相关的所有数据
    await db.transaction(async (trx) => {
      await trx('club_members').where({ club_id: id }).del();
      await trx('announcements').where({ club_id: id }).del();
      await trx('event_clubs').where({ club_id: id }).del();
      await trx('clubs').where({ id }).del();
    });

    logger.info('删除社团:', { clubId: id, adminId: req.user.id });

    res.json({
      success: true,
      message: '社团删除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取管理员列表（需要超级管理员权限）
 * @route GET /nfunest/api/admin/admins
 */
router.get('/admins', verifyToken, requireSuperAdmin, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const { offset } = getPaginationParams(req.query);

    const admins = await db('admins')
      .select('id', 'username', 'level', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db('admins').count('id as count');

    res.json({
      success: true,
      data: admins,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 创建管理员（需要超级管理员权限）
 * @route POST /nfunest/api/admin/admins
 */
router.post('/admins', verifyToken, requireSuperAdmin, async (req, res, next) => {
  try {
    const { username, password, level = 'moderator' } = req.body;

    if (!username || !password) {
      return res.status(400).json(buildBadRequestError('请填写用户名和密码'));
    }

    // 检查用户名是否重复
    const existingAdmin = await db('admins').where({ username }).first();
    if (existingAdmin) {
      return res.status(400).json(buildBadRequestError('用户名已存在'));
    }

    const adminData = {
      username,
      password: password,
      level,
      created_at: db.fn.now()
    };

    const [adminId] = await db('admins').insert(adminData);

    const newAdmin = await db('admins')
      .select('id', 'username', 'level', 'created_at')
      .where({ id: adminId })
      .first();

    logger.info('创建管理员:', { newAdminId: adminId, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      message: '管理员创建成功',
      data: newAdmin
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取社团成员列表
 * @route GET /nfunest/api/admin/clubs/:id/members
 */
router.get('/clubs/:id/members', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, pageSize = 20 } = req.query;
    const { offset } = getPaginationParams(req.query);

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    // 获取社团成员
    const members = await db('club_members')
      .select(
        'club_members.club_id', 'club_members.user_id', 'club_members.role', 'club_members.joined_at',
        'users.nickname', 'users.avatar as avatar_url', 'users.student_id'
      )
      .join('users', 'club_members.user_id', 'users.id')
      .where({ 'club_members.club_id': id })
      .orderBy('club_members.joined_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db('club_members')
      .where({ club_id: id })
      .count('club_id as count');

    res.json({
      success: true,
      data: members,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 更改社团成员角色
 * @route PUT /nfunest/api/admin/clubs/:id/members/:userId
 */
router.put('/clubs/:id/members/:userId', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    const user = await validateUserExists(userId);
    if (!user) {
      return res.status(404).json(buildNotFoundError('用户'));
    }

    if (!isValidMemberRole(role)) {
      return res.status(400).json(buildBadRequestError('无效的角色'));
    }

    await db('club_members')
      .where({ club_id: id, user_id: userId })
      .update({ role });

    logger.info('更改社团成员角色:', { clubId: id, userId, newRole: role, adminId: req.user.id });

    res.json({
      success: true,
      message: '成员角色更新成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 移除社团成员
 * @route DELETE /nfunest/api/admin/clubs/:id/members/:userId
 */
router.delete('/clubs/:id/members/:userId', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    const user = await validateUserExists(userId);
    if (!user) {
      return res.status(404).json(buildNotFoundError('用户'));
    }

    await db('club_members')
      .where({ club_id: id, user_id: userId })
      .del();

    logger.info('移除社团成员:', { clubId: id, userId, adminId: req.user.id });

    res.json({
      success: true,
      message: '成员移除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 添加社团成员
 * @route POST /nfunest/api/admin/clubs/:id/members
 */
router.post('/clubs/:id/members', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, role = 'member' } = req.body;

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    const user = await validateUserExists(userId);
    if (!user) {
      return res.status(404).json(buildNotFoundError('用户'));
    }

    if (!isValidMemberRole(role)) {
      return res.status(400).json(buildBadRequestError('无效的角色'));
    }

    // 检查成员是否已存在
    const existingMember = await db('club_members')
      .where({ club_id: id, user_id: userId })
      .first();

    if (existingMember) {
      return res.status(400).json(buildBadRequestError('该用户已经是社团成员'));
    }

    await db('club_members').insert({
      club_id: id,
      user_id: userId,
      role,
      joined_at: db.fn.now()
    });

    logger.info('添加社团成员:', { clubId: id, userId, role, adminId: req.user.id });

    res.status(201).json({
      success: true,
      message: '成员添加成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取社团公告
 * @route GET /nfunest/api/admin/clubs/:id/announcements
 */
router.get('/clubs/:id/announcements', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, pageSize = 20 } = req.query;
    const { offset } = getPaginationParams(req.query);

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    const announcements = await db('announcements')
      .select('*')
      .where({ club_id: id })
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db('announcements')
      .where({ club_id: id })
      .count('id as count');

    res.json({
      success: true,
      data: announcements.map(a => ({
        ...a,
        images: parseImagesField(a.images)
      })),
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 创建社团公告
 * @route POST /nfunest/api/admin/clubs/:id/announcements
 */
router.post('/clubs/:id/announcements', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, images } = req.body;

    const club = await validateClubExists(id);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    if (!title || !content) {
      return res.status(400).json(buildBadRequestError('请填写公告标题和内容'));
    }

    const announcementData = {
      title,
      content,
      images: processImagesField(images),
      club_id: id,
      created_at: db.fn.now()
    };

    const [announcementId] = await db('announcements').insert(announcementData);

    const newAnnouncement = await db('announcements')
      .select('*')
      .where({ id: announcementId })
      .first();

    logger.info('创建社团公告:', { announcementId, clubId: id, adminId: req.user.id });

    res.status(201).json({
      success: true,
      message: '公告创建成功',
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
 * 更新社团公告
 * @route PUT /nfunest/api/admin/clubs/:clubId/announcements/:announcementId
 */
router.put('/clubs/:clubId/announcements/:announcementId', verifyToken, async (req, res, next) => {
  try {
    const { clubId, announcementId } = req.params;
    const updateData = { ...req.body };

    // 处理图片数据
    if (updateData.images !== undefined) {
      updateData.images = processImagesField(updateData.images);
    }

    const club = await validateClubExists(clubId);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    const announcement = await db('announcements')
      .where({ id: announcementId, club_id: clubId })
      .first();

    if (!announcement) {
      return res.status(404).json(buildNotFoundError('公告或不属于该社团'));
    }

    await db('announcements').where({ id: announcementId }).update(updateData);

    const updatedAnnouncement = await db('announcements').where({ id: announcementId }).first();

    logger.info('更新社团公告:', { announcementId, clubId, userId: req.user.id, userType: req.userType });

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
 * 创建社团公告 (会长权限 - 需审核)
 * @route POST /nfunest/api/admin/clubs/:clubId/announcements/leader
 */
router.post('/clubs/:clubId/announcements/leader', verifyToken, requireClubLeader, async (req, res, next) => {
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

    const announcementData = {
      title,
      content,
      images: processImagesField(images),
      club_id: req.clubId,
      approval_status: 'pending',
      created_at: db.fn.now()
    };

    const [announcementId] = await db('announcements').insert(announcementData);

    const newAnnouncement = await db('announcements')
      .select('*')
      .where({ id: announcementId })
      .first();

    await createApproval({
      targetType: ApprovalTargetType.ANNOUNCEMENT,
      targetId: announcementId,
      clubId: req.clubId,
      applicantId: req.user.id
    });

    logger.info('会长创建社团公告（待审核）:', { announcementId, clubId: req.clubId, userId: req.user.id });

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
 * 更新社团公告 (会长权限)
 * @route PUT /nfunest/api/admin/clubs/:clubId/announcements/:announcementId/leader
 */
router.put('/clubs/:clubId/announcements/:announcementId/leader', verifyToken, requireClubLeader, async (req, res, next) => {
  try {
    const { clubId, announcementId } = req.params;
    const updateData = { ...req.body };

    // 处理图片数据
    if (updateData.images !== undefined) {
      updateData.images = processImagesField(updateData.images);
    }

    const club = await validateClubExists(clubId);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    const announcement = await db('announcements')
      .where({ id: announcementId, club_id: req.clubId })
      .first();

    if (!announcement) {
      return res.status(404).json(buildNotFoundError('公告或不属于您的社团'));
    }

    await db('announcements').where({ id: announcementId }).update(updateData);

    const updatedAnnouncement = await db('announcements').where({ id: announcementId }).first();

    logger.info('会长更新社团公告:', { announcementId, clubId, userId: req.user.id });

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
 * 删除社团公告
 * @route DELETE /nfunest/api/admin/clubs/:clubId/announcements/:announcementId
 */
router.delete('/clubs/:clubId/announcements/:announcementId', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { clubId, announcementId } = req.params;

    const club = await validateClubExists(clubId);
    if (!club) {
      return res.status(404).json(buildNotFoundError('社团'));
    }

    const announcement = await db('announcements')
      .where({ id: announcementId, club_id: clubId })
      .first();

    if (!announcement) {
      return res.status(404).json(buildNotFoundError('公告或不属于该社团'));
    }

    // 删除公告中的所有图片文件
    await deleteAllAnnouncementImages(announcement, req.user.id, 'admin');

    // 删除公告
    await db('announcements').where({ id: announcementId }).del();

    logger.info('删除社团公告:', { announcementId, clubId, adminId: req.user.id });

    res.json({
      success: true,
      message: '公告删除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 更改活动参与者状态
 * @route PUT /nfunest/api/admin/events/:id/participants/:userId
 */
router.put('/events/:id/participants/:userId', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const { status } = req.body;

    const event = await validateEventExists(id);
    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    const user = await validateUserExists(userId);
    if (!user) {
      return res.status(404).json(buildNotFoundError('用户'));
    }

    if (!isValidParticipantStatus(status)) {
      return res.status(400).json(buildBadRequestError('无效的状态'));
    }

    await db('event_participants')
      .where({ event_id: id, user_id: userId })
      .update({ status });

    logger.info('更改活动参与者状态:', { eventId: id, userId, newStatus: status, adminId: req.user.id });

    res.json({
      success: true,
      message: '参与者状态更新成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 获取活动参与者列表
 * @route GET /nfunest/api/admin/events/:id/participants
 */
router.get('/events/:id/participants', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, pageSize = 20, status = 'all' } = req.query;
    const { offset } = getPaginationParams(req.query);

    const event = await validateEventExists(id);
    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    const participants = await db('event_participants')
      .select(
        'event_participants.event_id', 'event_participants.user_id', 'event_participants.status', 
        'event_participants.registered_at',
        'users.id as user_id', 'users.nickname', 'users.avatar as avatar_url', 'users.student_id'
      )
      .join('users', 'event_participants.user_id', 'users.id')
      .where({ 'event_participants.event_id': id })
      .modify(function(queryBuilder) {
        if (status !== 'all') {
          queryBuilder.where('event_participants.status', status);
        }
      })
      .orderBy('event_participants.registered_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db('event_participants')
      .where({ event_id: id })
      .modify(function(queryBuilder) {
        if (status !== 'all') {
          queryBuilder.where('status', status);
        }
      })
      .count('event_id as count');

    res.json({
      success: true,
      data: participants,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 移除活动参与者
 * @route DELETE /nfunest/api/admin/events/:id/participants/:userId
 */
router.delete('/events/:id/participants/:userId', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    const event = await validateEventExists(id);
    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    const user = await validateUserExists(userId);
    if (!user) {
      return res.status(404).json(buildNotFoundError('用户'));
    }

    await db('event_participants')
      .where({ event_id: id, user_id: userId })
      .del();

    logger.info('移除活动参与者:', { eventId: id, userId, adminId: req.user.id });

    res.json({
      success: true,
      message: '参与者移除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 修改活动状态
 * @route PATCH /nfunest/api/admin/events/:id/status
 */
router.patch('/events/:id/status', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidEventStatus(status)) {
      return res.status(400).json(buildBadRequestError('无效的状态值'));
    }

    const event = await validateEventExists(id);
    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    await db('events')
      .where({ id })
      .update({ status, updated_at: db.fn.now() });

    logger.info('修改活动状态:', { eventId: id, status, adminId: req.user.id });

    res.json({
      success: true,
      message: '活动状态更新成功',
      data: { id, status }
    });
  } catch (error) {
    logger.error('修改活动状态失败:', {
      error: error.message,
      stack: error.stack,
      eventId: req.params.id,
      adminId: req.user?.id
    });
    next(error);
  }
});

/**
 * 删除活动图片URL
 * @route DELETE /nfunest/api/admin/events/:id/images
 */
router.delete('/events/:id/images', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id: eventId } = req.params;
    const { imageUrl, imageType } = req.body;

    const event = await validateEventExists(eventId);
    if (!event) {
      return res.status(404).json(buildNotFoundError('活动'));
    }

    if (!imageUrl || !imageType) {
      return res.status(400).json(buildBadRequestError('缺少必要参数'));
    }

    const validImageTypes = ['cover_image', 'images'];
    if (!isValidImageType(imageType, validImageTypes)) {
      return res.status(400).json(buildBadRequestError('无效的图片类型'));
    }

    await removeImageFromRecord({
      table: 'events',
      id: eventId,
      imageUrl,
      imageType,
      record: event,
      userId: req.user.id,
      userType: 'admin'
    });

    logger.info('删除活动图片URL:', { eventId, imageUrl, imageType, adminId: req.user.id });

    res.json({
      success: true,
      message: '图片URL删除成功'
    });
  } catch (error) {
    logger.error('删除活动图片URL失败:', {
      error: error.message,
      stack: error.stack,
      eventId: req.params.id,
      adminId: req.user?.id
    });
    next(error);
  }
});

/**
 * 搜索用户
 * @route GET /nfunest/api/admin/users/search
 */
router.get('/users/search', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { studentId, page = 1, pageSize = 20 } = req.query;
    const { offset } = getPaginationParams(req.query);

    if (!studentId) {
      return res.status(400).json(buildBadRequestError('请提供学号参数'));
    }

    // 搜索用户
    const users = await db('users')
      .select('id', 'nickname', 'avatar', 'student_id', 'wechat')
      .where('student_id', 'like', `%${studentId}%`)
      .orderBy('id', 'desc')
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db('users')
      .where('student_id', 'like', `%${studentId}%`)
      .count('id as count');

    res.json({
      success: true,
      data: users,
      pagination: buildPaginationResponse(page, pageSize, count)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 绑定微信openid
 * @description 老师/管理员绑定微信openid，用于接收订阅消息通知
 * @route POST /nfunest/api/admin/bind-wechat
 */
router.post('/bind-wechat', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json(buildBadRequestError('缺少微信授权码'));
    }

    // 向微信服务器获取openid
    const wxResponse = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WECHAT_APPID,
        secret: process.env.WECHAT_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    const { openid, errcode, errmsg } = wxResponse.data;

    if (errcode) {
      logger.error('获取微信openid失败:', { errcode, errmsg });
      return res.status(400).json({
        success: false,
        error: `微信授权失败: ${errmsg}`
      });
    }

    // 检查openid是否已被其他管理员绑定
    const existingAdmin = await db('admins').where({ openid }).first();
    if (existingAdmin && existingAdmin.id !== req.user.id) {
      return res.status(400).json({
        success: false,
        error: '该微信已被其他账号绑定'
      });
    }

    // 更新管理员的openid
    await db('admins')
      .where({ id: req.user.id })
      .update({ openid });

    logger.info('管理员绑定微信成功:', {
      adminId: req.user.id,
      username: req.user.username,
      openid
    });

    res.json({
      success: true,
      message: '绑定成功',
      data: { openid }
    });
  } catch (error) {
    logger.error('绑定微信失败:', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id
    });
    next(error);
  }
});

/**
 * 获取当前管理员信息（包含绑定状态）
 * @route GET /nfunest/api/admin/profile
 */
router.get('/profile', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const admin = await db('admins')
      .select('id', 'username', 'level', 'openid', 'created_at')
      .where({ id: req.user.id })
      .first();

    if (!admin) {
      return res.status(404).json(buildNotFoundError('管理员'));
    }

    res.json({
      success: true,
      data: {
        ...admin,
        hasWechatBind: !!admin.openid
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 解绑微信openid
 * @route DELETE /nfunest/api/admin/unbind-wechat
 */
router.delete('/unbind-wechat', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    await db('admins')
      .where({ id: req.user.id })
      .update({ openid: null });

    logger.info('管理员解绑微信成功:', {
      adminId: req.user.id,
      username: req.user.username
    });

    res.json({
      success: true,
      message: '解绑成功'
    });
  } catch (error) {
    logger.error('解绑微信失败:', {
      error: error.message,
      adminId: req.user?.id
    });
    next(error);
  }
});

module.exports = router;
