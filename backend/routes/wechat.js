/**
 * 微信消息推送路由
 * @description 处理微信服务器的消息推送验证和接收
 * @reference https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/message-push.html
 */

const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const WechatCrypto = require('../utils/wechatCrypto');

/**
 * 微信配置
 * @description 从环境变量读取配置，确保安全性
 */
const WECHAT_CONFIG = {
  token: process.env.WECHAT_TOKEN || '',
  encodingAESKey: process.env.WECHAT_ENCODING_AES_KEY || '',
  appId: process.env.WECHAT_APPID || ''
};

/**
 * 初始化微信加解密工具
 */
const wechatCrypto = new WechatCrypto(
  WECHAT_CONFIG.token,
  WECHAT_CONFIG.encodingAESKey,
  WECHAT_CONFIG.appId
);

/**
 * GET /nestnotif - 服务器地址验证
 * @description 微信服务器发送GET请求验证服务器地址有效性
 * @param {string} signature - 签名
 * @param {string} timestamp - 时间戳
 * @param {string} nonce - 随机数
 * @param {string} echostr - 随机字符串
 * @returns {string} 验证通过返回echostr，失败返回空字符串
 */
router.get('/', (req, res) => {
  const { signature, timestamp, nonce, echostr } = req.query;

  logger.info('微信服务器验证请求', {
    signature,
    timestamp,
    nonce,
    echostr,
    ip: req.ip
  });

  if (!signature || !timestamp || !nonce || !echostr) {
    logger.warn('微信验证参数不完整');
    return res.status(400).send('参数不完整');
  }

  const isValid = wechatCrypto.verifySignature(signature, timestamp, nonce);

  if (isValid) {
    logger.info('微信服务器验证成功');
    return res.send(echostr);
  } else {
    logger.warn('微信服务器验证失败', { signature, timestamp, nonce });
    return res.status(403).send('验证失败');
  }
});

/**
 * POST /nestnotif - 接收消息推送
 * @description 接收微信服务器推送的消息和事件
 * @param {string} signature - 签名（明文模式使用）
 * @param {string} timestamp - 时间戳
 * @param {string} nonce - 随机数
 * @param {string} openid - 用户openid
 * @param {string} encrypt_type - 加密类型（aes表示安全模式）
 * @param {string} msg_signature - 消息签名（安全模式使用）
 * @returns {string} 成功返回success或自定义回复消息
 */
router.post('/', async (req, res) => {
  const { 
    signature, 
    timestamp, 
    nonce, 
    openid,
    encrypt_type,
    msg_signature 
  } = req.query;

  logger.info('收到微信消息推送', {
    signature,
    timestamp,
    nonce,
    openid,
    encrypt_type,
    msg_signature,
    ip: req.ip
  });

  try {
    let message;

    if (encrypt_type === 'aes') {
      message = await handleEncryptedMessage(req.body, msg_signature, timestamp, nonce);
    } else {
      if (!wechatCrypto.verifySignature(signature, timestamp, nonce)) {
        logger.warn('明文模式签名验证失败', { signature, timestamp, nonce });
        return res.status(403).send('签名验证失败');
      }
      message = req.body;
    }

    logger.info('解析后的消息内容', message);

    const reply = await handleMessage(message);

    if (reply) {
      if (encrypt_type === 'aes') {
        const encryptedReply = encryptReply(reply, timestamp, nonce);
        return res.json(encryptedReply);
      } else {
        return res.json(reply);
      }
    }

    return res.send('success');
  } catch (error) {
    logger.error('处理微信消息失败', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    return res.status(500).send('处理失败');
  }
});

/**
 * 处理加密消息
 * @description 解密安全模式下的消息
 * @param {Object} body - 请求体
 * @param {string} msgSignature - 消息签名
 * @param {string} timestamp - 时间戳
 * @param {string} nonce - 随机数
 * @returns {Object} 解密后的消息对象
 */
async function handleEncryptedMessage(body, msgSignature, timestamp, nonce) {
  const { Encrypt } = body;

  if (!Encrypt) {
    throw new Error('缺少加密消息体');
  }

  const isValid = wechatCrypto.verifyMsgSignature(msgSignature, timestamp, nonce, Encrypt);

  if (!isValid) {
    throw new Error('消息签名验证失败');
  }

  return wechatCrypto.decrypt(Encrypt);
}

/**
 * 处理消息内容
 * @description 根据消息类型进行不同的处理
 * @param {Object} message - 消息对象
 * @returns {Object|null} 回复消息对象，不回复返回null
 */
async function handleMessage(message) {
  const { MsgType, Event, Content, FromUserName, ToUserName } = message;

  switch (MsgType) {
    case 'event':
      return handleEvent(message);
    
    case 'text':
      return handleTextMessage(message);
    
    default:
      logger.info('未处理的消息类型', { MsgType });
      return null;
  }
}

/**
 * 处理事件消息
 * @description 处理各种微信事件
 * @param {Object} message - 消息对象
 * @returns {Object|null} 回复消息对象
 */
function handleEvent(message) {
  const { Event, FromUserName, ToUserName } = message;

  switch (Event) {
    case 'subscribe':
      logger.info('用户关注事件', { openid: FromUserName });
      return {
        ToUserName: FromUserName,
        FromUserName: ToUserName,
        CreateTime: Date.now(),
        MsgType: 'text',
        Content: '欢迎关注NFUNest！这里是南方学院社团活动管理平台。'
      };

    case 'unsubscribe':
      logger.info('用户取消关注事件', { openid: FromUserName });
      return null;

    default:
      logger.info('未处理的事件类型', { Event });
      return null;
  }
}

/**
 * 处理文本消息
 * @description 处理用户发送的文本消息
 * @param {Object} message - 消息对象
 * @returns {Object|null} 回复消息对象
 */
function handleTextMessage(message) {
  const { Content, FromUserName, ToUserName } = message;

  logger.info('收到文本消息', { openid: FromUserName, content: Content });

  return {
    ToUserName: FromUserName,
    FromUserName: ToUserName,
    CreateTime: Date.now(),
    MsgType: 'text',
    Content: `收到您的消息：${Content}\n\nNFUNest正在建设中，敬请期待更多功能！`
  };
}

/**
 * 加密回复消息
 * @description 在安全模式下加密回复消息
 * @param {Object} reply - 回复消息对象
 * @param {string} timestamp - 时间戳
 * @param {string} nonce - 随机数
 * @returns {Object} 加密后的回复对象
 */
function encryptReply(reply, timestamp, nonce) {
  const replyStr = JSON.stringify(reply);
  const encrypt = wechatCrypto.encrypt(replyStr);
  const signature = wechatCrypto.generateSignature(timestamp, nonce, encrypt);

  return {
    Encrypt: encrypt,
    MsgSignature: signature,
    TimeStamp: timestamp,
    Nonce: nonce
  };
}

module.exports = router;
