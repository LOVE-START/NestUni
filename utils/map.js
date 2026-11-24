/**
 * 腾讯地图工具类
 * @description 封装腾讯地图 SDK，提供路线规划等功能
 */

const QQMapWX = require('../lib/qqmap-wx-jssdk.min.js');

const TENCENT_MAP_KEY = 'KWCBZ-COAKM-GEN6K-6YW7U-HA6UT-XUFW3';

/* 签名校验 SK（开启签名校验时使用） */
const TENCENT_MAP_SK = 'cTA8BYKiXVSqKpMj3ETAhdNfEaFLcww9';

/* 初始化 SDK 实例 */
const qqmap = new QQMapWX({
  key: TENCENT_MAP_KEY
});

/**
 * 步行路线规划
 * @param {number} fromLat - 起点纬度
 * @param {number} fromLng - 起点经度
 * @param {number} toLat - 终点纬度
 * @param {number} toLng - 终点经度
 * @returns {Promise<Object>} 路线规划结果
 */
function walkingDirection(fromLat, fromLng, toLat, toLng) {
  return new Promise((resolve, reject) => {
    qqmap.direction({
      mode: 'walking',
      from: {
        latitude: fromLat,
        longitude: fromLng
      },
      to: {
        latitude: toLat,
        longitude: toLng
      },
      sig: TENCENT_MAP_SK,
      success: (res) => {
        const route = res.result.routes[0];
        const polyline = decodePolyline(route.polyline);
        
        /* 验证坐标点是否有效 */
        if (!polyline || polyline.length === 0) {
          reject(new Error('无法解析路线坐标'));
          return;
        }
        
        resolve({
          polyline: polyline,
          distance: route.distance,
          duration: route.duration
        });
      },
      fail: (error) => {
        console.error('路线规划失败:', error);
        let errorMsg = '路线规划失败';
        if (error.status === 121) {
          errorMsg = '今日路线规划次数已用完，请明天再试';
        } else if (error.status === 199) {
          errorMsg = '地图服务未正确配置';
        }
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * 解码腾讯地图压缩的 polyline 数据
 * @description 腾讯地图 polyline 格式：
 *   [坐标1纬度, 坐标1经度, 坐标2纬度差值, 坐标2经度差值, ...]
 *   第一个坐标为原始值，之后使用前向差分压缩，差值需除以 1000000
 * @param {Array} polyline - 压缩的坐标数组
 * @returns {Array} 解码后的坐标点数组 [{latitude, longitude}, ...]
 */
function decodePolyline(polyline) {
  if (!polyline || !Array.isArray(polyline) || polyline.length === 0) {
    return [];
  }
  
  /* 检查是否已经是对象格式 */
  if (typeof polyline[0] === 'object') {
    return polyline.map(point => ({
      latitude: point.lat || point.latitude,
      longitude: point.lng || point.longitude
    }));
  }
  
  /* 复制数组避免修改原数据 */
  const coors = [...polyline];
  
  /* 解压：从索引2开始，每个值 = 前两个位置的值 + 当前值/1000000 */
  for (let i = 2; i < coors.length; i++) {
    coors[i] = coors[i - 2] + coors[i] / 1000000;
  }
  
  /* 转换为坐标点数组：[纬度, 经度, 纬度, 经度, ...] */
  const points = [];
  for (let i = 0; i < coors.length; i += 2) {
    points.push({
      latitude: coors[i],
      longitude: coors[i + 1]
    });
  }
  
  return points;
}

module.exports = {
  walkingDirection,
  TENCENT_MAP_KEY,
  qqmap
};
