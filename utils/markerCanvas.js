/**
 * 地图标记 Canvas 工具
 * @description 使用离屏 Canvas 生成标记，支持永久缓存
 */

/* 标记配置 */
const MARKER_CONFIG = {
  size: 144,
  innerRadius: 60,
  borderWidth: 12,
  markerSize: 40
};

/* 缓存目录 */
const CACHE_DIR = `${wx.env.USER_DATA_PATH}/marker_cache`;

/**
 * 确保缓存目录存在
 */
function ensureCacheDir() {
  try {
    const fs = wx.getFileSystemManager();
    fs.accessSync(CACHE_DIR);
  } catch (e) {
    try {
      const fs = wx.getFileSystemManager();
      fs.mkdirSync(CACHE_DIR, true);
    } catch (err) {
      console.error('创建缓存目录失败:', err);
    }
  }
}

/**
 * 生成缓存键
 */
function generateCacheKey(coverUrl, borderColor) {
  const urlHash = coverUrl ? coverUrl.split('?')[0].split('/').pop() : 'default';
  const colorHash = borderColor.replace(/[^a-zA-Z0-9]/g, '');
  return `${urlHash}_${colorHash}`;
}

/**
 * 获取缓存文件路径
 */
function getCachePath(cacheKey) {
  return `${CACHE_DIR}/${cacheKey}.png`;
}

/**
 * 检查缓存是否存在
 */
function checkCache(cacheKey) {
  try {
    const fs = wx.getFileSystemManager();
    const cachePath = getCachePath(cacheKey);
    fs.accessSync(cachePath);
    return cachePath;
  } catch (e) {
    return null;
  }
}

/**
 * 创建离屏 Canvas
 */
function createCanvas() {
  try {
    return wx.createOffscreenCanvas({
      type: '2d',
      width: MARKER_CONFIG.size,
      height: MARKER_CONFIG.size
    });
  } catch (e) {
    console.error('创建离屏 Canvas 失败:', e);
    return null;
  }
}

/**
 * 绘制标记底图
 */
function drawMarkerBase(ctx, size, innerRadius, borderColor) {
  ctx.clearRect(0, 0, size, size);
  
  /* 绘制外圈边框 */
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = borderColor;
  ctx.fill();
  
  /* 绘制白色内圈 */
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, innerRadius - 1, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

/**
 * 绘制封面图片
 */
function drawCoverImage(ctx, canvas, img, size, innerRadius) {
  const targetSize = innerRadius * 2 - 4;
  const imgRatio = img.width / img.height;
  let drawWidth, drawHeight, drawX, drawY;
  
  if (imgRatio > 1) {
    drawHeight = targetSize;
    drawWidth = targetSize * imgRatio;
    drawX = (size - drawWidth) / 2;
    drawY = (size - drawHeight) / 2;
  } else {
    drawWidth = targetSize;
    drawHeight = targetSize / imgRatio;
    drawX = (size - drawWidth) / 2;
    drawY = (size - drawHeight) / 2;
  }
  
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, innerRadius - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

/**
 * 导出 Canvas 为文件
 */
async function exportCanvas(canvas, cacheKey) {
  return new Promise((resolve) => {
    wx.canvasToTempFilePath({
      canvas: canvas,
      success: (res) => {
        /* 保存到缓存目录 */
        const cachePath = getCachePath(cacheKey);
        try {
          const fs = wx.getFileSystemManager();
          fs.saveFileSync(res.tempFilePath, cachePath);
          resolve(cachePath);
        } catch (e) {
          console.error('保存缓存失败:', e);
          resolve(res.tempFilePath);
        }
      },
      fail: (err) => {
        console.error('导出 Canvas 失败:', err);
        resolve(null);
      }
    });
  });
}

/**
 * 下载网络图片
 */
async function downloadImage(url) {
  return new Promise((resolve) => {
    wx.downloadFile({
      url: url,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.tempFilePath);
        } else {
          resolve(null);
        }
      },
      fail: () => resolve(null)
    });
  });
}

/**
 * 生成单个标记
 */
async function generateMarker(coverUrl, borderColor) {
  const { size, innerRadius } = MARKER_CONFIG;
  
  /* 生成缓存键 */
  const cacheKey = generateCacheKey(coverUrl, borderColor);
  
  /* 确保缓存目录存在 */
  ensureCacheDir();
  
  /* 检查缓存 */
  const cachedPath = checkCache(cacheKey);
  if (cachedPath) {
    return cachedPath;
  }
  
  /* 创建 Canvas */
  const canvas = createCanvas();
  if (!canvas) {
    return '/images/location.png';
  }
  
  const ctx = canvas.getContext('2d');
  
  /* 绘制底图 */
  drawMarkerBase(ctx, size, innerRadius, borderColor);
  
  /* 加载并绘制封面图 */
  if (coverUrl && coverUrl.startsWith('http')) {
    const localPath = await downloadImage(coverUrl);
    if (localPath) {
      const img = canvas.createImage();
      await new Promise((resolve) => {
        img.onload = () => {
          drawCoverImage(ctx, canvas, img, size, innerRadius);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = localPath;
      });
    }
  } else if (coverUrl) {
    const img = canvas.createImage();
    await new Promise((resolve) => {
      img.onload = () => {
        drawCoverImage(ctx, canvas, img, size, innerRadius);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = coverUrl;
    });
  }
  
  /* 导出图片 */
  const result = await exportCanvas(canvas, cacheKey);
  return result || '/images/location.png';
}

/**
 * 批量生成活动标记
 */
async function generateMarkers(events, getStatusColor) {
  if (!events || !events.length) return [];

  const markers = [];
  
  for (const event of events) {
    const borderColor = getStatusColor(event.statusClass);
    const coverUrl = event.cover_image || event.coverImage;
    
    const iconPath = await generateMarker(coverUrl, borderColor);
    
    markers.push({
      id: event.id,
      latitude: event.latitude,
      longitude: event.longitude,
      width: MARKER_CONFIG.markerSize,
      height: MARKER_CONFIG.markerSize,
      iconPath: iconPath,
      anchor: { x: 0.5, y: 1 },
      callout: {
        content: event.title,
        color: '#333333',
        fontSize: 12,
        bgColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: borderColor,
        padding: 8,
        display: 'ALWAYS',
        textAlign: 'center'
      }
    });
  }
  
  return markers;
}

/**
 * 清除所有标记缓存
 */
function clearMarkerCache() {
  try {
    const fs = wx.getFileSystemManager();
    const files = fs.readdirSync(CACHE_DIR);
    files.forEach(file => {
      try {
        fs.unlinkSync(`${CACHE_DIR}/${file}`);
      } catch (e) {}
    });
    console.log('已清除所有标记缓存');
  } catch (e) {
    console.error('清除缓存失败:', e);
  }
}

module.exports = {
  generateMarkers,
  generateMarker,
  clearMarkerCache,
  MARKER_CONFIG
};
