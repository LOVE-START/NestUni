/**
 * 微信消息加解密工具类
 * @description 实现微信消息推送的安全模式加解密功能
 * @reference https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/message-push.html
 */

const crypto = require('crypto');

/**
 * 微信消息加解密类
 */
class WechatCrypto {
  /**
   * 构造函数
   * @param {string} token - 令牌
   * @param {string} encodingAESKey - 消息加密密钥（43位字符）
   * @param {string} appId - 小程序AppID
   */
  constructor(token, encodingAESKey, appId) {
    this.token = token;
    this.appId = appId;
    this.key = Buffer.from(encodingAESKey + '=', 'base64');
    this.iv = this.key.slice(0, 16);
  }

  /**
   * 验证服务器地址有效性
   * @description 微信服务器发送GET请求验证服务器地址
   * @param {string} signature - 签名
   * @param {string} timestamp - 时间戳
   * @param {string} nonce - 随机数
   * @returns {boolean} 验证结果
   */
  verifySignature(signature, timestamp, nonce) {
    const arr = [this.token, timestamp, nonce].sort();
    const sha1 = crypto.createHash('sha1').update(arr.join('')).digest('hex');
    return sha1 === signature;
  }

  /**
   * 验证消息签名（安全模式）
   * @description 安全模式下验证消息体的签名
   * @param {string} msgSignature - 消息签名
   * @param {string} timestamp - 时间戳
   * @param {string} nonce - 随机数
   * @param {string} encrypt - 加密消息体
   * @returns {boolean} 验证结果
   */
  verifyMsgSignature(msgSignature, timestamp, nonce, encrypt) {
    const arr = [this.token, timestamp, nonce, encrypt].sort();
    const sha1 = crypto.createHash('sha1').update(arr.join('')).digest('hex');
    return sha1 === msgSignature;
  }

  /**
   * 解密消息
   * @description 解密微信推送的加密消息
   * @param {string} encrypt - 加密消息（Base64编码）
   * @returns {Object} 解密后的消息对象
   */
  decrypt(encrypt) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
      decipher.setAutoPadding(false);
      
      const decodedBuffer = Buffer.concat([
        decipher.update(encrypt, 'base64'),
        decipher.final()
      ]);
      
      const decoded = this.PKCS7DecodeBuffer(decodedBuffer);
      
      const len = decoded.readUInt32BE(16);
      const msgBuffer = decoded.slice(20, 20 + len);
      const appIdBuffer = decoded.slice(20 + len);
      
      const appId = appIdBuffer.toString('utf8');
      if (appId !== this.appId) {
        throw new Error('AppID不匹配');
      }
      
      const msg = msgBuffer.toString('utf8');
      return JSON.parse(msg);
    } catch (error) {
      throw new Error(`消息解密失败: ${error.message}`);
    }
  }

  /**
   * 加密消息
   * @description 加密回复给微信的消息
   * @param {string} msg - 要加密的消息内容
   * @returns {string} 加密后的消息（Base64编码）
   */
  encrypt(msg) {
    try {
      const msgBuffer = Buffer.from(msg);
      const random = crypto.randomBytes(16);
      const msgLen = Buffer.alloc(4);
      msgLen.writeUInt32BE(msgBuffer.length, 0);
      const appIdBuffer = Buffer.from(this.appId);
      
      const content = Buffer.concat([
        random,
        msgLen,
        msgBuffer,
        appIdBuffer
      ]);
      
      const padded = this.PKCS7Encode(content);
      
      const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
      cipher.setAutoPadding(false);
      
      let encrypted = cipher.update(padded, null, 'base64');
      encrypted += cipher.final('base64');
      
      return encrypted;
    } catch (error) {
      throw new Error(`消息加密失败: ${error.message}`);
    }
  }

  /**
   * 生成签名
   * @description 生成回复消息的签名
   * @param {string} timestamp - 时间戳
   * @param {string} nonce - 随机数
   * @param {string} encrypt - 加密消息
   * @returns {string} 签名
   */
  generateSignature(timestamp, nonce, encrypt) {
    const arr = [this.token, timestamp, nonce, encrypt].sort();
    return crypto.createHash('sha1').update(arr.join('')).digest('hex');
  }

  /**
   * PKCS7填充解码
   * @param {string} text - 填充后的文本
   * @returns {string} 解码后的文本
   */
  PKCS7Decode(text) {
    const pad = text.charCodeAt(text.length - 1);
    return text.slice(0, text.length - pad);
  }

  /**
   * PKCS7填充解码（Buffer版本）
   * @param {Buffer} buffer - 填充后的Buffer
   * @returns {Buffer} 解码后的Buffer
   */
  PKCS7DecodeBuffer(buffer) {
    const pad = buffer[buffer.length - 1];
    return buffer.slice(0, buffer.length - pad);
  }

  /**
   * PKCS7填充编码
   * @param {Buffer} buffer - 原始数据
   * @returns {Buffer} 填充后的数据
   */
  PKCS7Encode(buffer) {
    const blockSize = 32;
    const padLen = blockSize - (buffer.length % blockSize);
    const pad = Buffer.alloc(padLen, padLen);
    return Buffer.concat([buffer, pad]);
  }
}

module.exports = WechatCrypto;
