/**
 * 轻量JSON Schema参数校验器
 * @description 仅实现工具定义所需的语法子集（type/required/enum/maxLength/min/max）
 * 安全设计：拒绝一切未在Schema中声明的字段（additionalProperties:false语义），
 * 防止模型通过多余参数注入未预期数据
 */

/**
 * 校验工具参数
 * @param {Object} schema - 工具的parameters定义
 * @param {*} args - 模型输出的参数（视为不可信输入）
 * @returns {{valid: boolean, errors: string[], value: Object|null}} 校验结果，value为仅保留声明字段的清洗值
 */
function validateParams(schema, args) {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return { valid: false, errors: ['参数必须是对象'], value: null };
  }

  const errors = [];
  const props = (schema && schema.properties) || {};

  // 安全策略：任何未声明字段直接拒绝
  for (const key of Object.keys(args)) {
    if (!props[key]) {
      errors.push(`不允许的字段: ${key}`);
    }
  }

  // 必填字段检查（undefined/null视为缺失）
  for (const key of (schema.required || [])) {
    if (args[key] === undefined || args[key] === null) {
      errors.push(`缺少必填字段: ${key}`);
    }
  }

  // 已声明字段的类型与取值范围检查
  for (const [key, rule] of Object.entries(props)) {
    const v = args[key];
    if (v === undefined || v === null) continue;

    if (rule.type === 'integer' && !Number.isInteger(v)) {
      errors.push(`${key}必须是整数`);
    } else if (rule.type === 'number' && typeof v !== 'number') {
      errors.push(`${key}必须是数字`);
    } else if (rule.type === 'string' && typeof v !== 'string') {
      errors.push(`${key}必须是字符串`);
    } else if (rule.type === 'boolean' && typeof v !== 'boolean') {
      errors.push(`${key}必须是布尔值`);
    }

    if (rule.enum && !rule.enum.includes(v)) {
      errors.push(`${key}必须是 ${rule.enum.join('/')} 之一`);
    }
    if (rule.maxLength && typeof v === 'string' && v.length > rule.maxLength) {
      errors.push(`${key}长度不能超过${rule.maxLength}`);
    }
    if (typeof v === 'number') {
      if (rule.min !== undefined && v < rule.min) errors.push(`${key}不能小于${rule.min}`);
      if (rule.max !== undefined && v > rule.max) errors.push(`${key}不能大于${rule.max}`);
    }
  }

  // 清洗：只保留Schema声明过的字段，杜绝多余数据流入业务层
  const value = {};
  for (const key of Object.keys(props)) {
    if (args[key] !== undefined && args[key] !== null) {
      value[key] = args[key];
    }
  }

  return { valid: errors.length === 0, errors, value };
}

module.exports = { validateParams };
