/**
 * 业务错误类定义
 * @description 统一Agent与Service层的错误类型，便于路由层按类型映射HTTP状态码
 */

/** 业务规则错误（如名额已满、重复报名），映射HTTP 400 */
class BusinessError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BusinessError';
  }
}

/** 权限不足错误，映射HTTP 403 */
class PermissionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PermissionError';
  }
}

/** 参数校验失败错误，映射HTTP 400 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

module.exports = { BusinessError, PermissionError, ValidationError };
