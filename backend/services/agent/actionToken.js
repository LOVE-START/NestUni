/**
 * 敏感操作确认令牌
 * @description 写操作执行前的二次确认机制：引擎生成HMAC签名令牌随卡片下发，
 * 用户点击确认后前端携带令牌请求执行，服务端验签+验期+验身份后才真正执行
 * 安全设计：令牌绑定操作者/会话/参数，5分钟过期，防篡改防重放
 */
const crypto = require('crypto');

// 确认令牌密钥，从环境变量读取
const SECRET = process.env.AGENT_ACTION_SECRET || process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('AGENT_ACTION_SECRET 或 JWT_SECRET 未配置');
}

/**
 * 生成确认令牌
 * @param {Object} payload - { tool, args, actorId, actorType, sessionId }
 * @param {number} ttlMs - 有效期（毫秒）
 * @returns {string} base64url(payload).hmac格式令牌
 */
function signActionToken(payload, ttlMs) {
  const body = { ...payload, exp: Date.now() + ttlMs };
  const data = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/**
 * 校验令牌签名（不校验过期时间）
 * @description 签名验证与过期验证分离：confirm流程遇到verifyActionToken为null时，
 * 用本函数判断"签名有效但已过期"的情形，取回payload中的logId将审计记录
 * 惰性标记为cancelled——避免过期未处理的令牌在审计表留下永久pending记录
 * @param {string} token - 待校验令牌
 * @returns {Object|null} 签名有效返回payload（含exp），否则null
 */
function verifySignature(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

  // 时间安全比较，防止时序攻击
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * 校验确认令牌（签名+有效期）
 * @param {string} token - 待校验令牌
 * @returns {Object|null} 校验通过返回payload（含exp），失败返回null
 */
function verifyActionToken(token) {
  const payload = verifySignature(token);
  if (!payload || !payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

module.exports = { signActionToken, verifyActionToken, verifySignature };
