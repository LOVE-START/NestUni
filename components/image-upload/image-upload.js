/**
 * 图片上传组件
 * @description 提供统一的图片上传功能，支持单图和多图上传
 */
Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'apply-shared'
  },

  properties: {
    // 当前图片URL
    imageUrl: {
      type: String,
      value: ''
    },
    // 图片数组（多图模式）
    images: {
      type: Array,
      value: []
    },
    // 是否多图模式
    multiple: {
      type: Boolean,
      value: false
    },
    // 最大图片数量（多图模式）
    maxCount: {
      type: Number,
      value: 9
    },
    // 上传区域大小: 'normal' | 'small'
    size: {
      type: String,
      value: 'normal'
    },
    // 提示文字
    placeholder: {
      type: String,
      value: '上传图片'
    },
    // 提示信息
    hint: {
      type: String,
      value: ''
    },
    // 是否显示删除按钮
    showDelete: {
      type: Boolean,
      value: true
    },
    // 是否显示添加按钮（多图模式）
    showAdd: {
      type: Boolean,
      value: true
    },
    // 图片预览模式: 'cover' | 'contain'
    previewMode: {
      type: String,
      value: 'cover'
    },
    // 自定义类名
    customClass: {
      type: String,
      value: ''
    }
  },

  data: {
    // 内部图片列表
    internalImages: []
  },

  observers: {
    'images': function(images) {
      if (this.properties.multiple && Array.isArray(images)) {
        this.setData({
          internalImages: images.filter(img => img && img.trim() !== '')
        });
      }
    }
  },

  methods: {
    /**
     * 选择图片
     */
    chooseImage() {
      const { multiple, maxCount, internalImages } = this.data;
      const remainingCount = multiple ? maxCount - internalImages.length : 1;
      
      if (remainingCount <= 0) {
        wx.showToast({ title: `最多上传${maxCount}张图片`, icon: 'none' });
        return;
      }

      wx.chooseImage({
        count: remainingCount,
        sizeType: ['original'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const tempFilePaths = res.tempFilePaths;
          
          // 检查文件大小
          for (let i = 0; i < tempFilePaths.length; i++) {
            const fileInfo = await this.getFileInfo(tempFilePaths[i]);
            if (fileInfo.size > 5 * 1024 * 1024) {
              wx.showToast({ title: '图片不能超过5MB', icon: 'none' });
              return;
            }
          }

          // 压缩图片
          const compressedPaths = await this.compressImages(tempFilePaths);

          if (multiple) {
            const newImages = [...internalImages, ...compressedPaths];
            this.setData({ internalImages: newImages });
            this.triggerEvent('change', { images: newImages, tempImages: compressedPaths });
          } else {
            this.triggerEvent('change', { imageUrl: compressedPaths[0], tempImage: compressedPaths[0] });
          }
        },
        fail: (err) => {
          console.error('选择图片失败:', err);
          if (err.errMsg !== 'chooseImage:fail cancel') {
            wx.showToast({ title: '选择图片失败', icon: 'none' });
          }
        }
      });
    },

    /**
     * 获取文件信息
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} 文件信息
     */
    getFileInfo(filePath) {
      return new Promise((resolve, reject) => {
        wx.getFileInfo({
          filePath,
          success: resolve,
          fail: reject
        });
      });
    },

    /**
     * 压缩图片
     * @param {string[]} filePaths - 文件路径数组
     * @returns {Promise<string[]>} 压缩后的路径数组
     */
    async compressImages(filePaths) {
      const results = [];
      for (const filePath of filePaths) {
        const fileInfo = await this.getFileInfo(filePath);
        
        if (fileInfo.size > 1024 * 1024) {
          try {
            const compressResult = await new Promise((resolve, reject) => {
              wx.compressImage({
                src: filePath,
                quality: 80,
                success: resolve,
                fail: reject
              });
            });
            results.push(compressResult.tempFilePath);
          } catch (error) {
            console.warn('图片压缩失败，使用原图:', error);
            results.push(filePath);
          }
        } else {
          results.push(filePath);
        }
      }
      return results;
    },

    /**
     * 预览图片
     * @param {Object} e - 事件对象
     */
    previewImage(e) {
      const { url, index } = e.currentTarget.dataset;
      const { multiple, internalImages, imageUrl } = this.data;
      
      const urls = multiple ? internalImages : [imageUrl];
      const current = multiple ? internalImages[index] : imageUrl;
      
      this.triggerEvent('preview', { url: current, urls, index });
    },

    /**
     * 删除图片
     * @param {Object} e - 事件对象
     */
    deleteImage(e) {
      const { index } = e.currentTarget.dataset;
      const { multiple, internalImages, imageUrl } = this.data;
      
      if (multiple) {
        const newImages = [...internalImages];
        newImages.splice(index, 1);
        this.setData({ internalImages: newImages });
        this.triggerEvent('delete', { index, images: newImages });
      } else {
        this.triggerEvent('delete', { imageUrl: '' });
      }
    },

    /**
     * 阻止事件冒泡
     */
    stopPropagation() {}
  }
});
