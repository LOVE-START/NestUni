/**
 * 首页 Hero 壁纸模块
 * @description 负责用户自定义壁纸的选择、持久化保存与读取
 * 注意：wx.chooseImage 返回的是临时文件路径（如 http://tmp/），系统会不定时回收，
 *      必须复制到 USER_DATA_PATH 后才能跨启动长期使用，因此不能直接把临时路径写入缓存
 */

const { chooseSingleImage } = require('./image-handler')

const STORAGE_KEY = 'homeHeroWallpaper' // 自定义壁纸缓存键
const FILE_NAME_PREFIX = 'hero_wallpaper_' // 壁纸文件前缀，便于识别与清理
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 壁纸大小上限 5MB

/**
 * 提取图片扩展名
 * @param {string} filePath - 图片路径
 * @returns {string} 小写扩展名，识别失败时默认 jpg
 */
function getFileExtension(filePath) {
  const match = (filePath || '').match(/\.(jpe?g|png|gif|webp|bmp)(?=$|\?)/i)
  return match ? match[1].toLowerCase() : 'jpg'
}

/**
 * 删除本地文件
 * @description 文件不存在（被系统清理或重复删除）属于正常情况，直接忽略
 * @param {string} filePath - 文件路径
 */
function removeFile(filePath) {
  if (!filePath) return
  try {
    wx.getFileSystemManager().unlinkSync(filePath)
  } catch (e) {
    // 文件不存在无需处理
  }
}

/**
 * 读取缓存中已保存的自定义壁纸
 * @returns {string} 本地壁纸路径；未设置或文件已失效时返回空字符串
 */
function getCustomWallpaper() {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY)
    const filePath = stored && stored.path
    if (!filePath) return ''

    // 缓存文件可能被系统回收，使用前校验；失效时同步清除缓存记录，避免 image 组件加载破图
    wx.getFileSystemManager().accessSync(filePath)
    return filePath
  } catch (e) {
    removeCustomWallpaper()
    return ''
  }
}

/**
 * 保存临时图片为自定义壁纸
 * @description 先复制新文件，成功后再清理旧文件并写入缓存，避免更新失败时丢失原有壁纸
 * @param {string} tempFilePath - 图片临时路径
 * @returns {Promise<string>} 持久化后的本地壁纸路径
 */
function saveCustomWallpaper(tempFilePath) {
  return new Promise((resolve, reject) => {
    if (!tempFilePath) {
      reject(new Error('壁纸文件为空'))
      return
    }

    const fs = wx.getFileSystemManager()
    const targetPath = `${wx.env.USER_DATA_PATH}/${FILE_NAME_PREFIX}${Date.now()}.${getFileExtension(tempFilePath)}`

    fs.copyFile({
      srcPath: tempFilePath,
      destPath: targetPath,
      success: () => {
        try {
          const previous = wx.getStorageSync(STORAGE_KEY)
          if (previous && previous.path) {
            removeFile(previous.path)
          }
          wx.setStorageSync(STORAGE_KEY, { path: targetPath, updatedAt: Date.now() })
          resolve(targetPath)
        } catch (e) {
          // 本地缓存写入失败（如存储空间不足）时清理刚复制的文件，保持状态一致
          removeFile(targetPath)
          console.error('写入壁纸缓存失败:', e)
          reject(e)
        }
      },
      fail: (err) => {
        console.error('保存壁纸失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 清除自定义壁纸
 * @description 同时删除缓存记录与本地文件，恢复到默认壁纸
 */
function removeCustomWallpaper() {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY)
    if (stored && stored.path) {
      removeFile(stored.path)
    }
    wx.removeStorageSync(STORAGE_KEY)
  } catch (e) {
    console.error('清除壁纸缓存失败:', e)
  }
}

/**
 * 选择并保存自定义壁纸
 * @description 复用公共图片选择逻辑（含大小校验与压缩），再持久化到本地
 * @returns {Promise<string>} 保存后的本地壁纸路径
 */
async function pickAndSaveWallpaper() {
  const tempFilePath = await chooseSingleImage({ maxSize: MAX_FILE_SIZE })
  return saveCustomWallpaper(tempFilePath)
}

/**
 * 判断是否为用户取消选择
 * @param {Object} error - 错误对象
 * @returns {boolean} 是否为取消操作
 */
function isCancelError(error) {
  const errMsg = (error && (error.errMsg || error.message)) || ''
  return /cancel/i.test(errMsg)
}

module.exports = {
  getCustomWallpaper,
  saveCustomWallpaper,
  removeCustomWallpaper,
  pickAndSaveWallpaper,
  isCancelError
}
