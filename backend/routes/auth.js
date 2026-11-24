// routes/auth.js - 用户认证路由
const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const logger = require('../config/logger');
const { deletePhysicalFile } = require('../utils/fileUtils');
const { checkAndAwardBadge } = require('./badges');

const router = express.Router();

// 微信登录 
router.post('/login', async (req, res, next) => {
  try {
    
    const { code, userInfo, studentId, wechat } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: '缺少微信授权码'
      });
    }

    // 向微信服务器获取openid和session_key
    const wxResponse = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WECHAT_APPID,
        secret: process.env.WECHAT_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    const { openid, session_key, unionid, errcode, errmsg } = wxResponse.data;

    if (errcode) {
      logger.error('微信登录失败:', { errcode, errmsg });
      return res.status(400).json({
        success: false,
        error: `微信登录失败: ${errmsg}`
      });
    }

    // 查找或创建用户 
    let user = await db('users').where({ openid }).first();
    
    if (user) {
      // 保存旧头像URL，用于后续删除
      const oldAvatarUrl = user.avatar;
      
      // 更新用户信息 
      const updateData = {
        updated_at: db.fn.now()
      };
      
      // 更新微信相关信息
      if (userInfo) {
        Object.assign(updateData, {
          nickname: userInfo.nickName,
          avatar: userInfo.avatarUrl
        });
      }
      
      // 更新学号和微信号 
      if (studentId !== undefined) updateData.student_id = studentId;
      if (wechat !== undefined) updateData.wechat = wechat;
      
      await db('users').where({ openid }).update(updateData);
      user = await db('users').where({ openid }).first();
      
      // 如果用户上传了新头像且旧头像存在，删除旧头像文件
      if (oldAvatarUrl && user.avatar && oldAvatarUrl !== user.avatar && oldAvatarUrl.startsWith('http')) {
        try {
          // 异步删除旧头像文件，不阻塞主流程
          setImmediate(async () => {
            try {
              await deletePhysicalFile(oldAvatarUrl, user.id, 'user');
              logger.info('旧头像文件删除成功:', { userId: user.id, oldAvatarUrl });
            } catch (deleteError) {
              logger.error('删除旧头像文件失败:', { 
                error: deleteError.message, 
                userId: user.id, 
                oldAvatarUrl 
              });
            }
          });
        } catch (error) {
          logger.error('处理旧头像删除时出错:', { 
            error: error.message, 
            userId: user.id, 
            oldAvatarUrl 
          });
        }
      }
    } else {
      // 创建新用户 
      const newUser = {
        openid,
        nickname: userInfo?.nickName,
        avatar: userInfo?.avatarUrl,
        student_id: studentId || null,  
        wechat: wechat || null,        
        role: 'user',                   
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      };
      
      const [userId] = await db('users').insert(newUser);
      user = await db('users').where({ id: userId }).first();
    }

    // 生成JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        openid: user.openid,
        role: user.role,
        type: 'user'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 返回用户信息（不包含敏感数据）
    const responseUser = {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      student_id: user.student_id,  
      wechat: user.wechat,          
      role: user.role
    };

    logger.info('用户登录成功:', { userId: user.id, openid: user.openid });

    // 触发羽章检查（异步执行，不阻塞响应）
    setImmediate(async () => {
      try {
        // 检查并发放羽章
        await checkAndAwardBadge(user.id, 'user.login');
      } catch (badgeError) {
        logger.error('羽章检查失败:', { error: badgeError.message, userId: user.id });
      }
    });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        userInfo: responseUser
      }
    });

  } catch (error) {
    next(error);
  }
});

// 获取当前用户信息 - 严格按照数据库表结构处理
router.get('/profile', verifyToken, async (req, res, next) => {
  try {
    const user = await db('users')
      .select('id', 'nickname', 'avatar', 'student_id', 'wechat', 'role', 'created_at', 'updated_at')
      .where({ id: req.user.id })
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// 更新用户资料 
router.put('/profile', verifyToken, async (req, res, next) => {
  try {
    
    const { nickname, student_id, wechat, avatar } = req.body;
    
    // 获取用户当前信息
    const currentUser = await db('users').where({ id: req.user.id }).first();
    const oldAvatarUrl = currentUser?.avatar;
    
    const updateData = {};
    if (nickname !== undefined) updateData.nickname = nickname;
    if (student_id !== undefined) updateData.student_id = student_id;  
    if (wechat !== undefined) updateData.wechat = wechat;
    if (avatar !== undefined) updateData.avatar = avatar;           
    updateData.updated_at = db.fn.now();

    await db('users').where({ id: req.user.id }).update(updateData);

    const updatedUser = await db('users')
      .select('id', 'nickname', 'avatar', 'student_id', 'wechat', 'role')
      .where({ id: req.user.id })
      .first();
      
    // 如果用户上传了新头像且旧头像存在，删除旧头像文件
    if (oldAvatarUrl && avatar && oldAvatarUrl !== avatar && oldAvatarUrl.startsWith('http')) {
      try {
        // 异步删除旧头像文件，不阻塞主流程
        setImmediate(async () => {
          try {
            await deletePhysicalFile(oldAvatarUrl, req.user.id, req.userType);
            logger.info('旧头像文件删除成功:', { userId: req.user.id, oldAvatarUrl });
          } catch (deleteError) {
            logger.error('删除旧头像文件失败:', { 
              error: deleteError.message, 
              userId: req.user.id, 
              oldAvatarUrl 
            });
          }
        });
      } catch (error) {
        logger.error('处理旧头像删除时出错:', { 
          error: error.message, 
          userId: req.user.id, 
          oldAvatarUrl 
        });
      }
    }

    logger.info('用户资料更新:', { userId: req.user.id });

    // 触发羽章检查（异步执行，不阻塞响应）
    setImmediate(async () => {
      try {
        // 检查是否有学号更新
        if (student_id !== undefined) {
          await checkAndAwardBadge(req.user.id, 'user.profile_update', {
            has_student_id: !!student_id
          });
        }
        // 检查是否有头像更新
        if (avatar !== undefined && avatar) {
          await checkAndAwardBadge(req.user.id, 'user.avatar_upload');
        }
      } catch (badgeError) {
        logger.error('羽章检查失败:', { error: badgeError.message, userId: req.user.id });
      }
    });

    res.json({
      success: true,
      message: '资料更新成功',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

// 验证token有效性
router.get('/verify', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token有效',
    data: {
      id: req.user.id,
      type: req.userType,
      role: req.user.role
    }
  });
});

/**
 * 记录页面访问
 * @description 用于统计用户活跃度，每次打开页面时调用
 * @route POST /nfunest/api/auth/page-view
 */
router.post('/page-view', verifyToken, async (req, res, next) => {
  try {
    const { page } = req.body;
    
    // 触发活跃度统计和勋章检查（异步执行，不阻塞响应）
    setImmediate(async () => {
      try {
        const { updateActivityStats } = require('../services/activityStatsService');
        await updateActivityStats(req.user.id, 'login');
        await checkAndAwardBadge(req.user.id, 'user.activity_update');
      } catch (err) {
        logger.error('活跃度统计或勋章检查失败:', { 
          error: err.message, 
          stack: err.stack,
          userId: req.user.id,
          page: page || 'unknown'
        });
      }
    });

    logger.info('页面访问记录:', { 
      userId: req.user.id, 
      page: page || 'unknown' 
    });

    res.json({
      success: true,
      message: '记录成功'
    });
  } catch (error) {
    logger.error('页面访问记录失败:', {
      error: error.message,
      userId: req.user?.id
    });
    next(error);
  }
});

module.exports = router;