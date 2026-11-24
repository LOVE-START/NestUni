// middleware/auth.js - 认证中间件（支持Token自动刷新）
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // 1天内过期时自动刷新

// 生成新Token
function generateToken(user, type) {
  return jwt.sign(
    { 
      id: user.id, 
      openid: user.openid,
      role: user.role,
      type: type
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// 检查Token是否需要刷新（剩余时间少于阈值）
function shouldRefreshToken(decoded) {
  const now = Math.floor(Date.now() / 1000);
  const remainingTime = decoded.exp - now;
  return remainingTime > 0 && remainingTime < REFRESH_THRESHOLD / 1000;
}

// 验证JWT Token（支持自动刷新）
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '缺少认证令牌'
      });
    }

    const token = authHeader.substring(7);
    let decoded = null;
    let isExpired = false;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        isExpired = true;
        decoded = jwt.decode(token);
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: '无效的认证令牌',
          errorType: 'TOKEN_INVALID'
        });
      } else {
        return res.status(401).json({
          success: false,
          error: '认证令牌验证失败',
          errorType: 'TOKEN_ERROR'
        });
      }
    }
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: '无效的认证令牌',
        errorType: 'TOKEN_INVALID'
      });
    }

    // 根据token类型查询用户信息
    let user = null;
    if (decoded.type === 'admin') {
      user = await db('admins').where({ id: decoded.id }).first();
      if (!user) {
        return res.status(401).json({
          success: false,
          error: '管理员账户不存在',
          errorType: 'USER_NOT_FOUND'
        });
      }
    } else {
      user = await db('users').where({ id: decoded.id }).first();
      if (!user) {
        return res.status(401).json({
          success: false,
          error: '用户账户不存在',
          errorType: 'USER_NOT_FOUND'
        });
      }
    }
    
    req.user = user;
    req.userType = decoded.type;
    
    // Token自动刷新逻辑
    if (isExpired) {
      // Token已过期，生成新Token
      const newToken = generateToken(user, decoded.type);
      res.setHeader('X-New-Token', newToken);
      res.setHeader('X-Token-Refreshed', 'true');
      console.log(`Token已过期，自动刷新: userId=${user.id}`);
    } else if (shouldRefreshToken(decoded)) {
      // Token即将过期，预刷新
      const newToken = generateToken(user, decoded.type);
      res.setHeader('X-New-Token', newToken);
      res.setHeader('X-Token-Refreshed', 'true');
      console.log(`Token即将过期，预刷新: userId=${user.id}`);
    }
    
    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    return res.status(500).json({
      success: false,
      error: '认证服务器错误'
    });
  }
};

/**
 * 验证管理员权限
 * @description 包括超级管理员、普通管理员和教师
 */
const requireAdmin = async (req, res, next) => {
  if (req.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      error: '需要管理员权限'
    });
  }
  next();
};

/**
 * 验证教师权限
 * @description 仅限教师角色
 */
const requireTeacher = async (req, res, next) => {
  if (req.userType !== 'admin' || req.user.level !== 'teacher') {
    return res.status(403).json({
      success: false,
      error: '需要教师权限'
    });
  }
  next();
};

// 验证超级管理员权限
const requireSuperAdmin = async (req, res, next) => {
  if (req.userType !== 'admin' || req.user.level !== 'super') {
    return res.status(403).json({
      success: false,
      error: '需要超级管理员权限'
    });
  }
  next();
};

// 可选认证（用户可选登录，支持Token刷新）
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    req.user = null;
    req.userType = null;
    return next();
  }

  try {
    const token = authHeader.substring(7);
    let decoded = null;
    let isExpired = false;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        isExpired = true;
        decoded = jwt.decode(token);
      }
    }
    
    if (!decoded) {
      req.user = null;
      req.userType = null;
      return next();
    }
    
    let user = null;
    if (decoded.type === 'admin') {
      user = await db('admins').where({ id: decoded.id }).first();
    } else {
      user = await db('users').where({ id: decoded.id }).first();
    }
    
    req.user = user;
    req.userType = decoded.type;
    
    // Token自动刷新
    if (user && (isExpired || shouldRefreshToken(decoded))) {
      const newToken = generateToken(user, decoded.type);
      res.setHeader('X-New-Token', newToken);
      res.setHeader('X-Token-Refreshed', 'true');
    }
  } catch (error) {
    req.user = null;
    req.userType = null;
  }
  
  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireSuperAdmin,
  requireTeacher,
  optionalAuth,
  generateToken
};
