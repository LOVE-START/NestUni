const {
  fetchClubs,
  createClub,
  updateClub,
  deleteClub,
  fetchClubById,
  fetchClubAnnouncements,
  fetchClubMembers,
  changeClubMemberRole,
  removeClubMember,
  addClubMember,
  manageAnnouncement,
  searchUsersByStudentId,
  uploadImage,
  deleteFile,
  deleteImage: deleteImageApi
} = require("../../../utils/api/index");

const adminAuthBehavior = require("../../../behaviors/adminAuth");

Page({
  behaviors: [adminAuthBehavior],

  data: {
    // 自定义导航栏所需的状态栏高度
    statusBarHeight: 20,
    // 社团数据
    clubs: [],
    clubSearch: '',
    clubPagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    },
    
    // 社团分类选项
    categories: ['学术', '艺术', '体育', '文化', '公益'],
    selectedCategoryIndex: 0, // 默认选中第一个分类
    
    // 模态框状态
    showAddClubModal: false,
    showClubDetailModal: false,
    showAddMemberModal: false,
    showAddClubAnnouncementModal: false,
    
    // 表单数据
    clubForm: {
      name: '',
      category: '',
      short_intro: '',
      description: '',
      level: 'college',
      logo: '',
      cover_image: '',
      gallery: [''] // 初始化相册数组
    },
    // 临时存储本地图片文件路径
    tempImages: {
      logo: '',
      cover_image: '',
      gallery: []
    },
    // 临时存储已有的服务器图片URL
    tempGalleryUrls: [],
    memberForm: {
      userId: '',
      role: 'member'
    },
    clubAnnouncementForm: {
      title: '',
      content: ''
    },
    
    // 编辑状态
    editClubId: null,
    editClubAnnouncementId: null,
    
    // 详情数据
    currentClub: null,
    clubMembers: [],
    clubAnnouncements: [],
    
    // 用户搜索相关数据（新增）
    searchStudentId: '',
    searchResults: [],
    showSearchResults: false,
    selectedUser: null
  },

  onLoad() {
    // 自定义导航栏需要手动避让状态栏
    this.setData({ statusBarHeight: wx.getSystemInfoSync().statusBarHeight || 20 });

    // 检查权限并加载数据
    this.checkPermissionWithCallback(() => {
      this.loadClubs();
    });
  },

  // 获取社团列表
  async loadClubs(page = 1) {
    try {
      const { clubSearch: search } = this.data;
      // 管理员页面直接请求最新数据，不使用缓存
      const result = await fetchClubs({
        page,
        pageSize: this.data.clubPagination.pageSize,
        search
      }, false); // 第二个参数设为false，禁用缓存
      
      if (result && result.success) {
        // 处理社团数据，确保图片URL是完整的
        const processedClubs = result.data.map(club => {
          // 处理Logo URL
          if (club.logo && club.logo.startsWith('/uploads/')) {
            club.logo = `https://api.example.com${club.logo}`;
          }
          
          // 处理封面图片URL
          if (club.cover_image && club.cover_image.startsWith('/uploads/')) {
            club.cover_image = `https://api.example.com${club.cover_image}`;
          }
          
          // 处理相册数据
          if (Array.isArray(club.gallery)) {
            club.gallery = club.gallery
              .filter(url => url && (url.startsWith('http') || url.startsWith('/uploads/')))
              .map(url => {
                if (url.startsWith('/uploads/')) {
                  return `https://api.example.com${url}`;
                }
                return url;
              });
          } else {
            club.gallery = [];
          }
          
          return club;
        });
        
        this.setData({
          clubs: processedClubs,
          clubPagination: {
            ...this.data.clubPagination,
            ...result.pagination
          }
        });
      }
    } catch (error) {
      console.error('获取社团列表失败:', error);
      wx.showToast({ title: '获取社团列表失败', icon: 'none' });
    }
  },

  // 社团搜索
  onClubSearch(e) {
    this.setData({
      clubSearch: e.detail.value
    });
    // 防抖处理
    clearTimeout(this.clubSearchTimer);
    this.clubSearchTimer = setTimeout(() => {
      this.loadClubs(1);
    }, 500);
  },

  // 社团分页
  prevClubPage() {
    const { page } = this.data.clubPagination;
    if (page > 1) {
      this.loadClubs(page - 1);
    }
  },

  nextClubPage() {
    const { page, totalPages } = this.data.clubPagination;
    if (page < totalPages) {
      this.loadClubs(page + 1);
    }
  },

  // 显示添加社团模态框
  showAddClubModal() {
    // 设置默认分类索引
    const defaultCategoryIndex = 0; // 默认选中第一个分类
    
    this.setData({
      showAddClubModal: true,
      editClubId: null,
      clubForm: {
        name: '',
        category: this.data.categories[defaultCategoryIndex] || '', // 设置默认分类名称
        short_intro: '',
        description: '',
        level: 'college',
        logo: '',
        cover_image: '',
        gallery: [''] // 初始化相册数组
      },
      selectedCategoryIndex: defaultCategoryIndex, // 设置默认分类索引
      // 初始化临时图片数据
      tempImages: {
        logo: '',
        cover_image: '',
        gallery: []
      },
      // 初始化临时服务器图片URL
      tempGalleryUrls: []
    });
  },

  // 关闭添加社团模态框
  closeAddClubModal() {
    this.setData({
      showAddClubModal: false,
      // 清除临时图片数据
      tempImages: {
        logo: '',
        cover_image: '',
        gallery: []
      },
      // 清除临时服务器图片URL
      tempGalleryUrls: []
    });
  },

  // 社团表单输入
  onClubFormChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`clubForm.${field}`]: value
    });
  },

  // 社团级别选择
  onLevelChange(e) {
    const levels = ['college', 'school'];
    const selectedLevel = levels[e.detail.value];
    
    this.setData({
      'clubForm.level': selectedLevel
    });
  },

  // 社团分类选择
  onCategoryChange(e) {
    const selectedIndex = e.detail.value;
    const selectedCategory = this.data.categories[selectedIndex];
    
    this.setData({
      selectedCategoryIndex: selectedIndex,
      'clubForm.category': selectedCategory
    });
  },

  // 相册图片输入处理
  onGalleryInputChange(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const gallery = this.data.clubForm.gallery;
    
    gallery[index] = value;
    this.setData({
      'clubForm.gallery': gallery
    });
  },

  // 添加相册图片输入框
  addGalleryImage() {
    const gallery = this.data.clubForm.gallery;
    gallery.push('');
    this.setData({
      'clubForm.gallery': gallery
    });
  },

  // 删除相册图片输入框
  removeGalleryImage(e) {
    const index = e.currentTarget.dataset.index;
    const gallery = this.data.clubForm.gallery;
    
    if (gallery.length > 1) {
      gallery.splice(index, 1);
      this.setData({
        'clubForm.gallery': gallery
      });
    } else {
      // 如果只剩一个输入框，清空其内容而不是删除
      gallery[0] = '';
      this.setData({
        'clubForm.gallery': gallery
      });
    }
  },

  // 选择Logo
  selectLogo() {
    this.selectImage('logo');
  },

  // 选择封面图片
  selectCoverImage() {
    this.selectImage('cover_image');
  },

  // 选择相册图片
  selectGalleryImage(e) {
    const index = e.currentTarget.dataset.index;
    this.selectImage('gallery', index);
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
        if (field === 'gallery') {
          const tempImages = this.data.tempImages;
          const gallery = [...this.data.clubForm.gallery];
          
          // 确保tempImages.gallery数组长度足够
          while (tempImages.gallery.length <= index) {
            tempImages.gallery.push('');
          }
          
          tempImages.gallery[index] = compressedFilePath;
          gallery[index] = compressedFilePath; // 临时显示本地图片
          
          this.setData({
            [`tempImages.${field}`]: tempImages.gallery,
            [`clubForm.${field}`]: gallery
          });
        } else {
          this.setData({
            [`tempImages.${field}`]: compressedFilePath,
            [`clubForm.${field}`]: compressedFilePath // 临时显示本地图片
          });
        }
        
        wx.showToast({ title: '图片已选择', icon: 'success' });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    });
  },

  // 删除Logo
  async deleteLogo() {
    await this.deleteImage('logo', 'logo');
    // 清除表单中的Logo URL
    this.setData({
      'clubForm.logo': ''
    });
  },

  // 删除封面图片
  async deleteCoverImage() {
    await this.deleteImage('cover_image', 'cover_image');
    // 清除表单中的封面图片URL
    this.setData({
      'clubForm.cover_image': ''
    });
  },

  // 通用图片删除函数
  async deleteImage(field, imageType) {
    const imageUrl = this.data.clubForm[field];
    
    // 如果是服务器上的图片URL，删除服务器文件和数据库记录
    if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('/uploads/'))) {
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
        if (this.data.editClubId && imageType) {
          await deleteImageApi('club', this.data.editClubId, imageUrl, imageType);
          console.log('数据库图片URL删除成功:', imageUrl);
          
          // 重新加载社团数据以反映更改
          await this.loadClubs();
        }
      } catch (error) {
        console.error('删除图片失败:', error);
        wx.showToast({ title: '删除图片失败', icon: 'none' });
        // 即使删除失败，也要更新UI
      }
    }
    
    // 更新UI，清除表单中的图片URL
    this.setData({
      [`clubForm.${field}`]: '',
      [`tempImages.${field}`]: '' // 同时清除临时图片路径
    });
  },

  // 删除相册图片
  async deleteGalleryImage(e) {
    const index = e.currentTarget.dataset.index;
    const gallery = [...this.data.clubForm.gallery];
    const tempGallery = [...this.data.tempImages.gallery];
    const imageUrl = gallery[index];
    
    // 如果是服务器上的图片URL，删除服务器文件和数据库记录
    if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('/uploads/'))) {
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
        if (this.data.editClubId) {
          await deleteImageApi('club', this.data.editClubId, imageUrl, 'gallery');
          console.log('数据库图片URL删除成功:', imageUrl);
          
          // 重新加载社团数据以反映更改
          await this.loadClubs();
        }
      } catch (error) {
        console.error('删除图片失败:', error);
        wx.showToast({ title: '删除图片失败', icon: 'none' });
        // 即使删除失败，也要更新UI
      }
    }
    
    // 更新UI，清除对应位置的图片URL
    gallery[index] = '';
    if (tempGallery[index]) {
      tempGallery[index] = '';
    }
    
    this.setData({
      'clubForm.gallery': gallery,
      'tempImages.gallery': tempGallery
    });
  },

  // 添加相册图片槽位
  addGallerySlot() {
    const gallery = this.data.clubForm.gallery;
    gallery.push('');
    this.setData({
      'clubForm.gallery': gallery
    });
  },

  // 批量上传所有图片
  async uploadAllImages() {
    const { tempImages } = this.data;
    const uploadedUrls = {
      logo: '',
      cover_image: '',
      gallery: []
    };
    
    try {
      // 上传Logo
      if (tempImages.logo) {
        try {
          // 检查文件大小（5MB限制）
          const logoFileInfo = await new Promise((resolve, reject) => {
            wx.getFileInfo({
              filePath: tempImages.logo,
              success: resolve,
              fail: reject
            });
          });
          
          if (logoFileInfo.size > 5 * 1024 * 1024) { // 5MB
            wx.showToast({ title: 'Logo文件过大(>5MB)', icon: 'none' });
            throw new Error('Logo文件过大');
          }
          
          wx.showLoading({ title: '上传Logo...', mask: true });
          const logoResult = await uploadImage(tempImages.logo, { category: 'clubs' });
          if (logoResult && (logoResult.url || logoResult.fullUrl)) {
            // 确保返回的是完整URL
            uploadedUrls.logo = logoResult.fullUrl || (logoResult.url.startsWith('http') ? logoResult.url : `https://api.example.com${logoResult.url}`);
          }
        } catch (error) {
          console.error('Logo上传失败:', error);
          if (error.message !== 'Logo文件过大') {
            wx.showToast({ title: 'Logo上传失败', icon: 'none' });
          }
          throw error;
        }
      }
      
      // 上传封面图片
      if (tempImages.cover_image) {
        try {
          // 检查文件大小（5MB限制）
          const coverFileInfo = await new Promise((resolve, reject) => {
            wx.getFileInfo({
              filePath: tempImages.cover_image,
              success: resolve,
              fail: reject
            });
          });
          
          if (coverFileInfo.size > 5 * 1024 * 1024) { // 5MB
            wx.showToast({ title: '封面图片过大(>5MB)', icon: 'none' });
            throw new Error('封面图片过大');
          }
          
          wx.showLoading({ title: '上传封面...', mask: true });
          const coverResult = await uploadImage(tempImages.cover_image, { category: 'clubs' });
          if (coverResult && (coverResult.url || coverResult.fullUrl)) {
            // 确保返回的是完整URL
            uploadedUrls.cover_image = coverResult.fullUrl || (coverResult.url.startsWith('http') ? coverResult.url : `https://api.example.com${coverResult.url}`);
          }
        } catch (error) {
          console.error('封面图片上传失败:', error);
          if (error.message !== '封面图片过大') {
            wx.showToast({ title: '封面图片上传失败', icon: 'none' });
          }
          throw error;
        }
      }
      
      // 上传相册图片
      if (tempImages.gallery && tempImages.gallery.length > 0) {
        for (let i = 0; i < tempImages.gallery.length; i++) {
          if (tempImages.gallery[i]) {
            try {
              // 检查文件大小（5MB限制）
              const galleryFileInfo = await new Promise((resolve, reject) => {
                wx.getFileInfo({
                  filePath: tempImages.gallery[i],
                  success: resolve,
                  fail: reject
                });
              });
              
              if (galleryFileInfo.size > 5 * 1024 * 1024) { // 5MB
                wx.showToast({ title: `图片${i+1}过大(>5MB)`, icon: 'none' });
                throw new Error(`图片${i+1}过大`);
              }
              
              wx.showLoading({ title: `上传图片(${i+1}/${tempImages.gallery.length})`, mask: true });
              const galleryResult = await uploadImage(tempImages.gallery[i], { category: 'clubs' });
              if (galleryResult && (galleryResult.url || galleryResult.fullUrl)) {
                // 确保返回的是完整URL
                const imageUrl = galleryResult.fullUrl || (galleryResult.url.startsWith('http') ? galleryResult.url : `https://api.example.com${galleryResult.url}`);
                uploadedUrls.gallery.push(imageUrl);
              }
            } catch (error) {
              console.error(`相册图片${i+1}上传失败:`, error);
              if (!error.message.includes('过大')) {
                wx.showToast({ title: `图片${i+1}上传失败`, icon: 'none' });
              }
              throw error;
            }
          }
        }
      }
      
      wx.hideLoading();
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

  // 保存社团
  async saveClub() {
    try {
      const { editClubId, clubForm, tempImages } = this.data;
      
      // 表单验证
      if (!clubForm.name) {
        wx.showToast({ title: '请输入社团名称', icon: 'none' });
        return;
      }
      
      console.log('开始上传图片，临时图片数据:', tempImages);
      
      // 上传图片并获取URL
      const uploadedUrls = await this.uploadAllImages();
      
      console.log('图片上传完成，上传结果:', uploadedUrls);
      
      // 使用上传后的URL替换临时本地路径
      const processedForm = {
        ...clubForm,
        logo: (uploadedUrls.logo && uploadedUrls.logo.fullUrl) || uploadedUrls.logo || clubForm.logo || '',
        cover_image: (uploadedUrls.cover_image && uploadedUrls.cover_image.fullUrl) || uploadedUrls.cover_image || clubForm.cover_image || '',
        gallery: []
      };
      
      // 处理相册数据 - 只保留有效的服务器图片URL，过滤掉临时图片路径
      const existingGallery = Array.isArray(clubForm.gallery) ? clubForm.gallery : [];
      
      // 过滤出已有的有效图片URL（服务器上的图片），排除临时图片路径
      const validExistingUrls = existingGallery
        .filter(url => url && url.trim() !== '' && (url.startsWith('http') || url.startsWith('/uploads/')) && !url.startsWith('http://tmp'))
        .map(url => {
          // 确保URL是完整的
          if (url.startsWith('/uploads/')) {
            return `https://api.example.com${url}`;
          }
          return url;
        });
      
      // 处理新上传的图片URL
      const newGalleryUrls = uploadedUrls.gallery.length > 0 ? 
        uploadedUrls.gallery.map(item => (item.fullUrl || item.url || item)) : [];
      
      // 过滤掉空字符串和临时图片路径，只保留有效的URL
      const validNewUrls = newGalleryUrls
        .filter(url => url && url.trim() !== '' && !url.startsWith('http://tmp'))
        .map(url => {
          // 如果是相对路径，拼接完整URL
          if (url.startsWith('/uploads/')) {
            return `https://api.example.com${url}`;
          }
          return url;
        });
      
      // 合并已有的图片和新上传的图片，去重
      const allUrls = [...validExistingUrls, ...validNewUrls];
      const uniqueUrls = [...new Set(allUrls)]; // 使用Set去重
      
      processedForm.gallery = uniqueUrls;
      
      // 处理Logo URL
      if (processedForm.logo && processedForm.logo.startsWith('/uploads/')) {
        // 拼接完整URL
        processedForm.logo = `https://api.example.com${processedForm.logo}`;
      } else if (processedForm.logo && !processedForm.logo.startsWith('http')) {
        // 清除无效的本地路径
        processedForm.logo = '';
      }
      
      // 处理封面图片URL
      if (processedForm.cover_image && processedForm.cover_image.startsWith('/uploads/')) {
        // 拼接完整URL
        processedForm.cover_image = `https://api.example.com${processedForm.cover_image}`;
      } else if (processedForm.cover_image && !processedForm.cover_image.startsWith('http')) {
        // 清除无效的本地路径
        processedForm.cover_image = '';
      }
      
      console.log('处理后的表单数据:', processedForm);
      
      // 添加更多调试信息
      console.log('发送到服务器的数据:', {
        editClubId: editClubId,
        gallery: processedForm.gallery,
        galleryType: typeof processedForm.gallery,
        galleryLength: Array.isArray(processedForm.gallery) ? processedForm.gallery.length : 'not array'
      });
      
      let result;
      if (editClubId) {
        // 更新社团
        result = await updateClub(editClubId, processedForm);
      } else {
        // 创建社团
        result = await createClub(processedForm);
      }
      
      if (result && result.success) {
        wx.showToast({ title: editClubId ? '更新成功' : '创建成功', icon: 'success' });
        this.closeAddClubModal();
        this.loadClubs();
      } else {
        wx.showToast({ title: result.message || (editClubId ? '更新失败' : '创建失败'), icon: 'none' });
      }
    } catch (error) {
      console.error('保存社团失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 编辑社团
  editClub(e) {
    const clubId = e.currentTarget.dataset.id;
    // 这里应该获取社团详细信息并填充表单
    // 为简化实现，我们直接使用列表中的数据
    const club = this.data.clubs.find(item => item.id == clubId);
    if (club) {
      // 处理分类选择
      const categoryIndex = this.data.categories.findIndex(category => category === (club.category || ''));
      const selectedCategoryIndex = categoryIndex >= 0 ? categoryIndex : 0;
      
      this.setData({
        showAddClubModal: true,
        editClubId: clubId,
        clubForm: {
          name: club.name,
          category: club.category || this.data.categories[0],
          short_intro: club.short_intro,
          description: club.description,
          level: club.level || 'college',
          logo: club.logo,
          cover_image: club.cover_image,
          gallery: club.gallery && Array.isArray(club.gallery) && club.gallery.length > 0 ? club.gallery : [''] // 处理相册数据
        },
        selectedCategoryIndex: selectedCategoryIndex, // 设置分类索引
        // 初始化临时图片数据，区分服务器URL和本地路径
        tempImages: {
          logo: club.logo && club.logo.startsWith('http') ? '' : club.logo,
          cover_image: club.cover_image && club.cover_image.startsWith('http') ? '' : club.cover_image,
          gallery: []
        },
        // 如果已有相册图片URL，需要复制到tempImages.gallery中
        tempGalleryUrls: club.gallery && Array.isArray(club.gallery) ? club.gallery : []
      });
    }
  },

  // 删除社团
  deleteClub(e) {
    const clubId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个社团吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await deleteClub(clubId);
            if (result && result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.loadClubs();
            } else {
              wx.showToast({ title: result.message || '删除失败', icon: 'none' });
            }
          } catch (error) {
            console.error('删除社团失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 查看社团详情
  async viewClubDetail(e) {
    const clubId = e.currentTarget.dataset.id;
    
    try {
      // 获取社团详情
      const clubResult = await fetchClubById(clubId);
      if (clubResult && clubResult.success) {
        // 确保相册数据存在且为数组
        const clubData = {
          ...clubResult.data,
          gallery: clubResult.data.gallery && Array.isArray(clubResult.data.gallery) 
            ? clubResult.data.gallery 
            : []
        };
        
        this.setData({
          currentClub: clubData,
          showClubDetailModal: true
        });
        
        // 获取社团成员
        this.loadClubMembers(clubId);
        
        // 获取社团公告
        this.loadClubAnnouncements(clubId);
      }
    } catch (error) {
      console.error('获取社团详情失败:', error);
      wx.showToast({ title: '获取社团详情失败', icon: 'none' });
    }
  },

  // 加载社团成员
  async loadClubMembers(clubId) {
    try {
      const result = await fetchClubMembers(clubId);
      if (result && result.success) {
        this.setData({
          clubMembers: result.data
        });
      }
    } catch (error) {
      console.error('获取社团成员失败:', error);
      wx.showToast({ title: '获取社团成员失败', icon: 'none' });
    }
  },

  // 加载社团公告
  async loadClubAnnouncements(clubId) {
    try {
      const result = await fetchClubAnnouncements(clubId);
      if (result && result.success) {
        this.setData({
          clubAnnouncements: result.data
        });
      }
    } catch (error) {
      console.error('获取社团公告失败:', error);
      wx.showToast({ title: '获取社团公告失败', icon: 'none' });
    }
  },

  // 关闭社团详情模态框
  closeClubDetailModal() {
    this.setData({
      showClubDetailModal: false,
      currentClub: null
    });
  },

  // 显示添加成员模态框
  showAddMemberModal() {
    this.setData({
      showAddMemberModal: true,
      memberForm: {
        userId: '',
        role: 'member'
      },
      // 重置搜索相关数据
      searchStudentId: '',
      searchResults: [],
      showSearchResults: false,
      selectedUser: null
    });
  },

  // 关闭添加成员模态框
  closeAddMemberModal() {
    this.setData({
      showAddMemberModal: false
    });
  },

  // 学号输入（新增函数）
  onStudentIdInput(e) {
    const value = e.detail.value;
    this.setData({
      searchStudentId: value
    });
    
    // 防抖处理
    clearTimeout(this.searchTimer);
    if (value.length >= 2) {  // 至少输入2个字符才开始搜索
      this.searchTimer = setTimeout(() => {
        this.searchUsers(value);
      }, 500);
    } else {
      this.setData({
        searchResults: [],
        showSearchResults: false
      });
    }
  },

  // 搜索用户（新增函数）
  async searchUsers(studentId) {
    if (!studentId) return;
    
    try {
      const result = await searchUsersByStudentId(studentId);
      if (result && result.success) {
        this.setData({
          searchResults: result.data,
          showSearchResults: result.data.length > 0
        });
      }
    } catch (error) {
      console.error('搜索用户失败:', error);
      wx.showToast({ title: '搜索用户失败', icon: 'none' });
    }
  },

  // 选择用户（新增函数）
  selectUser(e) {
    const index = e.currentTarget.dataset.index;
    const user = this.data.searchResults[index];
    
    this.setData({
      selectedUser: user,
      searchStudentId: user.student_id,
      searchResults: [],
      showSearchResults: false
    });
  },

  // 清除用户选择（新增函数）
  clearUserSelection() {
    this.setData({
      selectedUser: null,
      memberForm: {
        userId: '',
        role: 'member'
      }
    });
  },

  // 成员表单输入
  onMemberFormChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`memberForm.${field}`]: value
    });
  },

  // 成员角色选择
  onMemberRoleChange(e) {
    const roles = ['member', 'leader'];
    const selectedRole = roles[e.detail.value];
    
    this.setData({
      'memberForm.role': selectedRole
    });
  },

  // 添加成员
  async addMember() {
    try {
      const { currentClub, memberForm, selectedUser } = this.data;
      
      // 表单验证
      if (!selectedUser) {
        wx.showToast({ title: '请先搜索并选择用户', icon: 'none' });
        return;
      }
      
      const result = await addClubMember(currentClub.id, selectedUser.id, memberForm.role);
      
      if (result && result.success) {
        wx.showToast({ title: '成员添加成功', icon: 'success' });
        this.closeAddMemberModal();
        this.loadClubMembers(currentClub.id);
      } else {
        wx.showToast({ title: result.message || '添加失败', icon: 'none' });
      }
    } catch (error) {
      console.error('添加成员失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 更改成员角色
  async changeMemberRole(e) {
    const userId = e.currentTarget.dataset.userId;
    const currentRole = e.currentTarget.dataset.currentRole;
    const newRole = currentRole === 'leader' ? 'member' : 'leader';
    
    wx.showModal({
      title: '确认更改',
      content: `确定要将该成员的角色更改为${newRole === 'leader' ? '团长' : '成员'}吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const { currentClub } = this.data;
            const result = await changeClubMemberRole(currentClub.id, userId, newRole);
            
            if (result && result.success) {
              wx.showToast({ title: '角色更改成功', icon: 'success' });
              this.loadClubMembers(currentClub.id);
            } else {
              wx.showToast({ title: result.message || '更改失败', icon: 'none' });
            }
          } catch (error) {
            console.error('更改成员角色失败:', error);
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 移除成员
  async removeMember(e) {
    const userId = e.currentTarget.dataset.userId;
    
    wx.showModal({
      title: '确认移除',
      content: '确定要将该成员从社团中移除吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const { currentClub } = this.data;
            const result = await removeClubMember(currentClub.id, userId);
            
            if (result && result.success) {
              wx.showToast({ title: '成员移除成功', icon: 'success' });
              this.loadClubMembers(currentClub.id);
            } else {
              wx.showToast({ title: result.message || '移除失败', icon: 'none' });
            }
          } catch (error) {
            console.error('移除成员失败:', error);
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 显示添加社团公告模态框
  showAddClubAnnouncementModal() {
    this.setData({
      showAddClubAnnouncementModal: true,
      editClubAnnouncementId: null,
      clubAnnouncementForm: {
        title: '',
        content: ''
      }
    });
  },

  // 关闭添加社团公告模态框
  closeAddClubAnnouncementModal() {
    this.setData({
      showAddClubAnnouncementModal: false
    });
  },

  // 社团公告表单输入
  onClubAnnouncementFormChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`clubAnnouncementForm.${field}`]: value
    });
  },

  // 保存社团公告
  async saveClubAnnouncement() {
    try {
      const { currentClub, editClubAnnouncementId, clubAnnouncementForm } = this.data;
      
      // 表单验证
      if (!clubAnnouncementForm.title || !clubAnnouncementForm.content) {
        wx.showToast({ title: '请填写标题和内容', icon: 'none' });
        return;
      }
      
      let result;
      if (editClubAnnouncementId) {
        // 更新公告
        result = await manageAnnouncement('update', clubAnnouncementForm, currentClub.id, editClubAnnouncementId);
      } else {
        // 创建公告
        result = await manageAnnouncement('create', clubAnnouncementForm, currentClub.id);
      }
      
      if (result && result.success) {
        wx.showToast({ title: editClubAnnouncementId ? '更新成功' : '发布成功', icon: 'success' });
        this.closeAddClubAnnouncementModal();
        this.loadClubAnnouncements(currentClub.id);
      } else {
        wx.showToast({ title: result.message || (editClubAnnouncementId ? '更新失败' : '发布失败'), icon: 'none' });
      }
    } catch (error) {
      console.error('保存社团公告失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 编辑社团公告
  editClubAnnouncement(e) {
    const announcementId = e.currentTarget.dataset.id;
    const announcement = this.data.clubAnnouncements.find(item => item.id == announcementId);
    if (announcement) {
      this.setData({
        showAddClubAnnouncementModal: true,
        editClubAnnouncementId: announcementId,
        clubAnnouncementForm: {
          title: announcement.title,
          content: announcement.content
        }
      });
    }
  },

  // 删除社团公告
  async deleteClubAnnouncement(e) {
    const announcementId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个公告吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            const { currentClub } = this.data;
            const result = await manageAnnouncement('delete', null, currentClub.id, announcementId);
            if (result && result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.loadClubAnnouncements(currentClub.id);
            } else {
              wx.showToast({ title: result.message || '删除失败', icon: 'none' });
            }
          } catch (error) {
            console.error('删除社团公告失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 图片预览功能
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const gallery = this.data.currentClub.gallery || [];
    
    wx.previewImage({
      current: url,
      urls: gallery
    });
  },

  // 预览表单中的图片
  previewFormImage(e) {
    const url = e.currentTarget.dataset.url;
    const field = e.currentTarget.dataset.field;
    
    let urls = [];
    if (field === 'gallery') {
      urls = this.data.clubForm.gallery.filter(item => item && item.trim() !== '');
    } else {
      urls = [this.data.clubForm[field]];
    }
    
    wx.previewImage({
      current: url,
      urls: urls
    });
  },

  // 获取文件信息
  getFileInfo(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileInfo({
        filePath: filePath,
        success: (res) => {
          resolve(res);
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});
