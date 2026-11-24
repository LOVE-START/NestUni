const {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  fetchClubs,
  uploadImage,
  deleteFile,
  deleteImage: deleteImageApi
} = require("../../../utils/api/index");

// 引入日期格式化工具
const { formatEventDate } = require("../../../utils/date.js");
const adminAuthBehavior = require("../../../behaviors/adminAuth");

Page({
  behaviors: [adminAuthBehavior],

  data: {
    // 自定义导航栏所需的状态栏高度
    statusBarHeight: 20,
    announcements: [],
    announcementSearch: '',
    announcementPagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    },
    
    // 社团数据（用于选择关联社团）
    clubs: [],
    
    // 模态框状态
    showAddAnnouncementModal: false,
    showAnnouncementDetailModal: false, // 添加详情模态框状态
    
    // 表单数据
    announcementForm: {
      title: '',
      content: '',
      club_id: null,
      images: [''] // 初始化公告图片数组
    },
    // 临时存储本地图片文件路径
    tempImages: {
      images: []
    },
    // 临时存储已有的服务器图片URL
    tempGalleryUrls: [],
    
    // 编辑状态
    editAnnouncementId: null,
    
    // 选择器数据
    selectedClubIndex: 0,
    selectedClubName: '',
    
    // 详情数据
    currentAnnouncement: null, // 添加当前公告数据
  },

  // 格式化公告数据中的日期
  formatAnnouncements(announcements) {
    return announcements.map(announcement => ({
      ...announcement,
      formatted_created_at: formatEventDate(announcement.created_at),
      // 如果有更新时间也需要格式化
      formatted_updated_at: announcement.updated_at ? formatEventDate(announcement.updated_at) : null
    }));
  },

  // 格式化单个公告详情中的日期
  formatAnnouncementDetail(announcement) {
    if (!announcement) return null;
    return {
      ...announcement,
      formatted_created_at: formatEventDate(announcement.created_at),
      formatted_updated_at: announcement.updated_at ? formatEventDate(announcement.updated_at) : null
    };
  },

  // 社团选择器变更处理
  onClubPickerChange(e) {
    const selectedIndex = e.detail.value;
    const selectedClub = this.data.clubs[selectedIndex];
    
    this.setData({
      selectedClubIndex: selectedIndex,
      selectedClubName: selectedClub ? selectedClub.name : '',
      'announcementForm.club_id': selectedClub ? selectedClub.id : null
    });
  },

  onLoad() {
    // 自定义导航栏需要手动避让状态栏
    this.setData({ statusBarHeight: wx.getSystemInfoSync().statusBarHeight || 20 });

    // 检查权限并加载数据
    this.checkPermissionWithCallback(() => {
      this.loadAnnouncements();
      this.loadClubs();
    });
  },

  // 获取公告列表
  async loadAnnouncements(page = 1) {
    try {
      const { announcementSearch: keyword } = this.data;
      // 管理员页面直接请求最新数据，不使用缓存
      const result = await fetchAnnouncements({
        page,
        pageSize: this.data.announcementPagination.pageSize,
        keyword
      }, false); // 第二个参数设为false，禁用缓存
      
      if (result && result.success) {
        // 格式化公告数据中的日期
        const formattedAnnouncements = this.formatAnnouncements(result.data);
        
        this.setData({
          announcements: formattedAnnouncements,
          announcementPagination: {
            ...this.data.announcementPagination,
            ...result.pagination
          }
        });
      }
    } catch (error) {
      console.error('获取公告列表失败:', error);
      wx.showToast({ title: '获取公告列表失败', icon: 'none' });
    }
  },

  // 获取社团列表（用于选择关联社团）
  async loadClubs() {
    try {
      // 管理员页面直接请求最新数据，不使用缓存
      const result = await fetchClubs({
        page: 1,
        pageSize: 1000 // 获取所有社团
      }, false); // 第二个参数设为false，禁用缓存
      
      if (result && result.success) {
        this.setData({
          clubs: result.data
        });
      }
    } catch (error) {
      console.error('获取社团列表失败:', error);
      wx.showToast({ title: '获取社团列表失败', icon: 'none' });
    }
  },

  // 公告搜索
  onAnnouncementSearch(e) {
    this.setData({
      announcementSearch: e.detail.value
    });
    // 防抖处理
    clearTimeout(this.announcementSearchTimer);
    this.announcementSearchTimer = setTimeout(() => {
      this.loadAnnouncements(1);
    }, 500);
  },

  // 公告分页
  prevAnnouncementPage() {
    const { page } = this.data.announcementPagination;
    if (page > 1) {
      this.loadAnnouncements(page - 1);
    }
  },

  nextAnnouncementPage() {
    const { page, totalPages } = this.data.announcementPagination;
    if (page < totalPages) {
      this.loadAnnouncements(page + 1);
    }
  },

  // 显示发布公告模态框
  showAddAnnouncementModal() {
    this.setData({
      showAddAnnouncementModal: true,
      editAnnouncementId: null,
      announcementForm: {
        title: '',
        content: '',
        club_id: null,
        images: [''] // 初始化公告图片数组
      },
      // 初始化临时图片数据
      tempImages: {
        images: []
      },
      // 初始化临时服务器图片URL
      tempGalleryUrls: [],
      selectedClubIndex: 0,
      selectedClubName: ''
    });
  },

  // 关闭发布公告模态框
  closeAddAnnouncementModal() {
    this.setData({
      showAddAnnouncementModal: false,
      // 清除临时图片数据
      tempImages: {
        images: []
      },
      // 清除临时服务器图片URL
      tempGalleryUrls: []
    });
  },

  // 公告表单输入
  onAnnouncementFormChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`announcementForm.${field}`]: value
    });
  },

  // 选择公告图片
  selectAnnouncementImage(e) {
    const index = e.currentTarget.dataset.index;
    this.selectImage('images', index);
  },

  // 通用图片选择函数（不立即上传）
  selectImage(field, index = null) {
    wx.chooseImage({
      count: 1,
      sizeType: ['original'], // 先选择原图，然后手动压缩
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        const originalSize = res.tempFiles[0].size; // 原始文件大小
        
        // 检查文件大小（5MB限制）
        if (originalSize > 5 * 1024 * 1024) { // 5MB
          wx.showToast({ title: '图片过大，请选择小于5MB的图片', icon: 'none' });
          return;
        }
        
        // 手动压缩图片以减小文件大小
        let compressedFilePath = tempFilePath;
        if (originalSize > 1024 * 1024) { // 如果原图大于1MB才压缩
          try {
            const compressResult = await new Promise((resolve, reject) => {
              wx.compressImage({
                src: tempFilePath,
                quality: 80, // 压缩质量
                success: resolve,
                fail: reject
              });
            });
            compressedFilePath = compressResult.tempFilePath;
            
            // 检查压缩后的大小
            const compressedFileInfo = await new Promise((resolve, reject) => {
              wx.getFileInfo({
                filePath: compressedFilePath,
                success: resolve,
                fail: reject
              });
            });
            
            console.log('图片压缩信息:', {
              originalSize: originalSize,
              compressedSize: compressedFileInfo.size,
              compressionRatio: ((originalSize - compressedFileInfo.size) / originalSize * 100).toFixed(2) + '%'
            });
          } catch (compressError) {
            console.warn('图片压缩失败，使用原图:', compressError);
          }
        }
        
        // 更新临时图片数据
        if (field === 'images') {
          const tempImages = this.data.tempImages;
          const images = [...this.data.announcementForm.images];
          
          // 确保tempImages.images数组长度足够
          while (tempImages.images.length <= index) {
            tempImages.images.push('');
          }
          
          tempImages.images[index] = compressedFilePath;
          // 为了在UI上显示本地图片，我们需要更新表单字段
          // 但在保存时会过滤掉临时路径
          images[index] = compressedFilePath;
          
          this.setData({
            [`tempImages.${field}`]: tempImages.images,
            [`announcementForm.${field}`]: images
          });
          
          wx.showToast({ title: '图片已选择，保存时将自动上传', icon: 'success', duration: 2000 });
        }
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    });
  },

  // 删除公告图片
  async deleteAnnouncementImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.announcementForm.images];
    const tempImages = [...this.data.tempImages.images];
    const imageUrl = images[index];
    
    // 显示确认对话框
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张图片吗？',
      success: async (res) => {
        if (res.confirm) {
          // 如果是服务器上的图片URL，删除服务器文件和数据库记录
          if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('/uploads/'))) {
            wx.showLoading({ title: '删除中...', mask: true });
            try {
              // 从完整URL中提取相对路径
              let relativeUrl = imageUrl;
              if (imageUrl.startsWith('http')) {
                relativeUrl = imageUrl.replace('https://api.example.com', '');
              }
              
              // 调用后端删除文件接口
              await deleteFile(relativeUrl);
              console.log('服务器文件删除成功:', relativeUrl);
              
              // 如果在编辑模式下，同时删除数据库中的URL记录
              if (this.data.editAnnouncementId) {
                await deleteImageApi('announcement', this.data.editAnnouncementId, imageUrl, 'images');
                console.log('数据库图片URL删除成功:', imageUrl);
                
                // 重新加载公告数据以反映更改
                await this.loadAnnouncements();
              }
              
              wx.hideLoading();
              wx.showToast({ title: '删除成功', icon: 'success' });
            } catch (error) {
              wx.hideLoading();
              console.error('删除图片失败:', error);
              wx.showToast({ title: '删除图片失败', icon: 'none' });
              // 即使删除失败，也要继续执行UI更新
            }
          }
          
          // 更新UI，清除对应位置的图片URL
          images[index] = '';
          if (tempImages[index]) {
            tempImages[index] = '';
          }
          
          this.setData({
            'announcementForm.images': images,
            'tempImages.images': tempImages
          });
        }
      }
    });
  },

  // 添加公告图片槽位
  addImageSlot() {
    const images = this.data.announcementForm.images;
    images.push('');
    this.setData({
      'announcementForm.images': images
    });
  },

  // 批量上传所有图片
  async uploadAllImages() {
    const { tempImages } = this.data;
    const uploadedUrls = {
      images: []
    };
    
    try {
      // 上传公告图片
      let uploadCount = 0;
      const totalUploads = tempImages.images ? tempImages.images.filter(img => img).length : 0;
      
      if (tempImages.images && tempImages.images.length > 0 && totalUploads > 0) {
        wx.showLoading({ title: `上传图片(0/${totalUploads})`, mask: true });
        
        for (let i = 0; i < tempImages.images.length; i++) {
          if (tempImages.images[i]) {
            try {
              // 检查文件大小（5MB限制）
              const imageFileInfo = await new Promise((resolve, reject) => {
                wx.getFileInfo({
                  filePath: tempImages.images[i],
                  success: resolve,
                  fail: reject
                });
              });
              
              if (imageFileInfo.size > 5 * 1024 * 1024) { // 5MB
                wx.showToast({ title: `图片${i+1}过大(>5MB)`, icon: 'none' });
                throw new Error(`图片${i+1}过大`);
              }
              
              uploadCount++;
              wx.showLoading({ title: `上传图片(${uploadCount}/${totalUploads})`, mask: true });
              const imageResult = await uploadImage(tempImages.images[i], { category: 'announcements' });
              if (imageResult && (imageResult.url || imageResult.fullUrl)) {
                // 确保使用完整的URL
                const imageUrl = imageResult.fullUrl || (imageResult.url.startsWith('http') ? imageResult.url : `https://api.example.com${imageResult.url}`);
                uploadedUrls.images.push(imageUrl);
              }
            } catch (error) {
              console.error(`公告图片${i+1}上传失败:`, error);
              if (!error.message.includes('过大')) {
                wx.showToast({ title: `图片${i+1}上传失败`, icon: 'none' });
              }
              throw error;
            }
          }
        }
      }
      
      wx.hideLoading();
      if (totalUploads > 0) {
        wx.showToast({ title: `成功上传${totalUploads}张图片`, icon: 'success', duration: 2000 });
      }
      return uploadedUrls;
    } catch (error) {
      console.error('批量上传图片失败:', error);
      wx.hideLoading();
      if (!error.message.includes('过大')) {
        wx.showToast({ title: '图片上传过程出错', icon: 'none' });
      }
      throw error;
    }
  },

  // 保存公告
  async saveAnnouncement() {
    try {
      const { editAnnouncementId, announcementForm, tempImages } = this.data;
      
      // 表单验证
      if (!announcementForm.title || !announcementForm.content) {
        wx.showToast({ title: '请填写标题和内容', icon: 'none' });
        return;
      }
      
      console.log('开始上传图片，临时图片数据:', tempImages);
      
      // 上传图片并获取URL
      const uploadedUrls = await this.uploadAllImages();
      
      console.log('图片上传完成，上传结果:', uploadedUrls);
      
      // 使用上传后的URL替换临时本地路径
      const processedForm = {
        ...announcementForm,
        images: []
      };
      
      // 处理公告图片数据 - 只保留有效的服务器图片URL，过滤掉临时图片路径
      const existingImages = Array.isArray(announcementForm.images) ? announcementForm.images : [];
      
      // 过滤出已有的有效图片URL（服务器上的图片），排除临时图片路径
      const validExistingUrls = existingImages
        .filter(url => this.isValidImageUrl(url))
        .map(url => this.formatImageUrl(url));
      
      // 处理新上传的图片URL
      const newImagesUrls = uploadedUrls.images.length > 0 ? 
        uploadedUrls.images.map(item => (item.fullUrl || item.url || item)) : [];
      
      // 过滤掉空字符串和临时图片路径，只保留有效的URL
      const validNewUrls = newImagesUrls
        .filter(url => this.isValidImageUrl(url))
        .map(url => this.formatImageUrl(url));
      
      // 合并已有的图片和新上传的图片，去重
      const allUrls = [...validExistingUrls, ...validNewUrls];
      const uniqueUrls = [...new Set(allUrls)]; // 使用Set去重
      
      processedForm.images = uniqueUrls;
      
      console.log('最终处理的图片URL列表:', processedForm.images);
      
      console.log('处理后的表单数据:', processedForm);
      
      // 确保images字段是数组格式，后端会处理序列化
      // 不需要在这里转换为JSON字符串
      
      let result;
      if (editAnnouncementId) {
        // 更新公告
        result = await updateAnnouncement(editAnnouncementId, processedForm);
      } else {
        // 创建公告
        result = await createAnnouncement(processedForm);
      }
      
      if (result && result.success) {
        wx.showToast({ title: editAnnouncementId ? '更新成功' : '发布成功', icon: 'success' });
        this.closeAddAnnouncementModal();
        this.loadAnnouncements();
      } else {
        wx.showToast({ title: result.message || (editAnnouncementId ? '更新失败' : '发布失败'), icon: 'none' });
      }
    } catch (error) {
      console.error('保存公告失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 编辑公告
  editAnnouncement(e) {
    const announcementId = e.currentTarget.dataset.id;
    // 注意：这里我们需要获取原始数据而不是格式化后的数据
    // 但由于我们在setData时已经替换了announcements数组为格式化后的数据，
    // 所以我们需要额外保存原始数据或者重新获取
    
    // 为了简化，我们可以直接使用格式化后的数据，但在实际应用中可能需要保存原始数据
    const announcement = this.data.announcements.find(item => item.id == announcementId);
    if (announcement) {
      // 找到关联的社团索引
      let selectedClubIndex = 0;
      let selectedClubName = '';
      if (announcement.club_id) {
        const clubIndex = this.data.clubs.findIndex(club => club.id == announcement.club_id);
        if (clubIndex !== -1) {
          selectedClubIndex = clubIndex;
          selectedClubName = this.data.clubs[clubIndex].name;
        }
      }
      
      // 处理公告图片数据
      let imagesArray = [''];
      if (announcement.images && Array.isArray(announcement.images) && announcement.images.length > 0) {
        imagesArray = [...announcement.images];
      }
      
      // 确保图片URL是完整的
      const processedImagesArray = imagesArray.map(url => this.formatImageUrl(url));
      
      this.setData({
        showAddAnnouncementModal: true,
        editAnnouncementId: announcementId,
        announcementForm: {
          title: announcement.title,
          content: announcement.content,
          club_id: announcement.club_id,
          images: processedImagesArray
        },
        // 初始化临时图片数据，区分服务器URL和本地路径
        tempImages: {
          images: []
        },
        // 如果已有公告图片URL，需要复制到tempImages.images中
        tempGalleryUrls: Array.isArray(announcement.images) ? announcement.images : [],
        selectedClubIndex,
        selectedClubName
      });
    }
  },

  // 删除公告
  deleteAnnouncement(e) {
    const announcementId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个公告吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await deleteAnnouncement(announcementId);
            if (result && result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.loadAnnouncements();
            } else {
              wx.showToast({ title: result.message || '删除失败', icon: 'none' });
            }
          } catch (error) {
            console.error('删除公告失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 预览表单中的图片
  previewFormImage(e) {
    const url = e.currentTarget.dataset.url;
    // 合并现有的图片URL和临时选择的本地图片路径
    const existingImages = this.data.announcementForm.images || [];
    const tempImages = this.data.tempImages.images || [];
    
    // 合并所有有效的图片URL
    const allUrls = [...existingImages, ...tempImages].filter(item => item && item.trim() !== '');
    
    wx.previewImage({
      current: url,
      urls: allUrls
    });
  },

  // 预览公告详情中的图片
  previewAnnouncementImage(e) {
    const { url, images } = e.currentTarget.dataset;
    wx.previewImage({
      current: url,
      urls: images || []
    });
  },

  // 预览公告列表中的图片
  previewAnnouncementListImage(e) {
    const { url, images } = e.currentTarget.dataset;
    const imageArray = images ? (Array.isArray(images) ? images : JSON.parse(images)) : [];
    wx.previewImage({
      current: url,
      urls: imageArray
    });
  },

    // 检查图片是否为本地临时图片
  isTempImage(url) {
    return url && (url.startsWith('http://tmp') || url.startsWith('wxfile://'));
  },

  // 检查图片是否为服务器图片
  isServerImage(url) {
    return url && (url.startsWith('http') || url.startsWith('/uploads/')) && !this.isTempImage(url);
  },

  // 格式化图片URL
  formatImageUrl(url) {
    if (!url) return '';
    // 如果是相对路径，拼接完整URL
    if (url.startsWith('/uploads/')) {
      return `https://api.example.com${url}`;
    }
    return url;
  },

  // 图片加载失败处理
  onImageLoadError(e) {
    console.log('图片加载失败:', e);
    // 可以在这里添加默认图片或者错误提示
  },

  // 检查图片URL是否有效
  isValidImageUrl(url) {
    if (!url) return false;
    // 检查是否为有效的URL格式
    return typeof url === 'string' && url.length > 0 && 
           (url.startsWith('http') || url.startsWith('https') || url.startsWith('/uploads/')) &&
           !url.startsWith('http://tmp');
  },

  // 查看公告详情
  async viewAnnouncementDetail(e) {
    const announcementId = e.currentTarget.dataset.id;
    
    try {
      // 获取公告详情
      const announcement = this.data.announcements.find(item => item.id == announcementId);
      if (announcement) {
        // 格式化公告详情中的日期
        const formattedAnnouncement = this.formatAnnouncementDetail(announcement);
        
        this.setData({
          currentAnnouncement: formattedAnnouncement,
          showAnnouncementDetailModal: true
        });
      }
    } catch (error) {
      console.error('获取公告详情失败:', error);
      wx.showToast({ title: '获取公告详情失败', icon: 'none' });
    }
  },

  // 关闭公告详情模态框
  closeAnnouncementDetailModal() {
    this.setData({
      showAnnouncementDetailModal: false,
      currentAnnouncement: null
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});
