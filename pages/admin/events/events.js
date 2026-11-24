const {
  fetchEvents,
  manageEvent,  
  fetchEventById,
  fetchEventParticipants,  
  changeEventParticipantStatus,
  removeEventParticipant,
  uploadImage, 
  deleteFile,  
  deleteImage: deleteImageApi,  
  fetchClubs, 
  updateEventStatusUnified
} = require("../../../utils/api/index");

// 引入日期格式化工具
const { formatEventDate, formatEventDateTime } = require("../../../utils/date.js");
const adminAuthBehavior = require("../../../behaviors/adminAuth");

Page({
  behaviors: [adminAuthBehavior],

  data: {
    // 自定义导航栏所需的状态栏高度
    statusBarHeight: 20,
    // 活动数据
    events: [],
    eventSearch: '',
    eventPagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    },
    
    // 社团数据
    clubs: [],
    clubOptions: [],
    
    // 模态框状态
    showAddEventModal: false,
    showEventDetailModal: false,
    
    // 活动分类选项
    eventCategories: [
      { name: "学术"}, 
      { name: "文艺"}, 
      { name: "文化"},
      { name: "娱乐"},
      { name: "体育"},
      { name: "公益"}
    ],
    selectedCategoryIndex: 0, // 默认选中第一个分类
    
    // 表单数据
    eventForm: {
      title: '',
      date: '',
      time: '',
      location: '',
      latitude: null, // 活动地点纬度
      longitude: null, // 活动地点经度
      category: '',
      description: '',
      organizer: '',
      contact: '',
      max_participants: '',
      cover_image: '',
      images: [''], // 初始化活动图片数组
      // 修改为支持多选社团
      club_ids: [], // 使用数组存储选中的社团ID
      status: 'published', // 添加状态字段，默认为published
      tags: '', // 添加标签字段
      requirements: '', // 添加要求字段
      registration_deadline: '' // 报名截止时间
    },
    // 临时存储本地图片文件路径
    tempImages: {
      cover_image: '',
      images: []
    },
    // 临时存储已有的服务器图片URL
    tempGalleryUrls: [],
    
    // 编辑状态
    editEventId: null,
    
    // 详情数据
    currentEvent: null,
    eventParticipants: [],
    
    // 调试信息
    debugInfo: {
      lastClubChange: null,
      clubIdsType: null
    },
    
    // 活动状态选项
    eventStatusOptions: [
      { value: 'draft', label: '草稿' },
      { value: 'published', label: '已发布' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' }
    ],
    eventStatusIndex: 1, // 默认选中"已发布"
    selectedStatusLabel: '已发布' // 默认显示标签
  },

  onLoad() {
    // 自定义导航栏需要手动避让状态栏
    this.setData({ statusBarHeight: wx.getSystemInfoSync().statusBarHeight || 20 });

    // 检查权限并加载数据
    this.checkPermissionWithCallback(() => {
      this.loadEvents();
      this.loadClubs();
    });
  },

  // 获取社团列表
  async loadClubs() {
    try {
      const result = await fetchClubs({ page: 1, pageSize: 1000 }); // 获取所有社团
      if (result && result.success) {
        console.log('获取到的社团列表:', result.data);
        this.setData({
          clubs: result.data,
          clubOptions: result.data.map(club => ({
            id: club.id,
            name: club.name
          }))
        });
        console.log('设置后的clubOptions:', this.data.clubOptions);
      }
    } catch (error) {
      console.error('获取社团列表失败:', error);
    }
  },

  // 获取社团名称
  getClubName(clubId) {
    const club = this.data.clubOptions.find(item => item.id === clubId);
    return club ? club.name : '';
  },

  // 获取社团名称列表
  getClubNames(clubIds) {
    return clubIds.map(id => this.getClubName(id)).join(', ');
  },

  // 社团选择处理 - 使用checkbox-group方式
  onClubGroupChange(e) {
    const selectedClubIds = e.detail.value.map(id => parseInt(id)); // value是字符串数组
    console.log('选中的社团IDs:', selectedClubIds);
    
    // 确保至少有一个社团被选中（可以根据业务需求调整）
    if (selectedClubIds.length === 0) {
      wx.showToast({ title: '至少需要选择一个社团', icon: 'none' });
      // 重新设置为之前的值（这里简化处理，实际应该保存之前的选择）
      return;
    }
    
    this.setData({
      'eventForm.club_ids': selectedClubIds
    });
  },

  // 获取活动列表
  async loadEvents(page = 1) {
    try {
      const { eventSearch: keyword } = this.data;
      // 管理员页面直接请求最新数据，不使用缓存
      const result = await fetchEvents({
        page,
        pageSize: this.data.eventPagination.pageSize,
        keyword
      }, false);
      
      if (result && result.success) {
        // 格式化活动日期显示并处理关联社团信息
        const formattedEvents = result.data.map(event => {
          console.log('处理活动数据:', event);
          
          // 获取状态标签
          const status = event.status || 'draft';
          const statusLabel = this.getStatusLabel(status);
          
          const formattedEvent = {
            ...event,
            date: formatEventDate(event.date), // 使用工具函数格式化日期
            related_clubs_names: event.related_clubs ? event.related_clubs.map(club => club.name).join(', ') : '',
            status_label: statusLabel // 添加状态标签
          };
          return formattedEvent;
        });
        
        this.setData({
          events: formattedEvents,
          eventPagination: {
            ...this.data.eventPagination,
            ...result.pagination
          }
        });
      }
    } catch (error) {
      console.error('获取活动列表失败:', error);
      wx.showToast({ title: '获取活动列表失败', icon: 'none' });
    }
  },

  // 获取状态标签
  getStatusLabel(status) {
    const statusMap = {
      'draft': '草稿',
      'published': '已发布',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  },

  // 活动搜索
  onEventSearch(e) {
    this.setData({
      eventSearch: e.detail.value
    });
    // 防抖处理
    clearTimeout(this.eventSearchTimer);
    this.eventSearchTimer = setTimeout(() => {
      this.loadEvents(1);
    }, 500);
  },

  // 活动分页
  prevEventPage() {
    const { page } = this.data.eventPagination;
    if (page > 1) {
      this.loadEvents(page - 1);
    }
  },

  nextEventPage() {
    const { page, totalPages } = this.data.eventPagination;
    if (page < totalPages) {
      this.loadEvents(page + 1);
    }
  },

  // 显示添加活动模态框
  showAddEventModal() {
    // 重置表单状态
    const defaultStatus = 'published';
    const defaultStatusIndex = this.data.eventStatusOptions.findIndex(option => option.value === defaultStatus);
    
    // 设置默认活动分类索引
    const defaultCategoryIndex = 0; // 默认选中第一个分类
    
    this.setData({
      showAddEventModal: true,
      editEventId: null,
      eventForm: {
        title: '',
        date: '',
        time: '',
        location: '',
        latitude: null, // 重置纬度
        longitude: null, // 重置经度
        category: this.data.eventCategories[defaultCategoryIndex].name || '', // 设置默认分类名称
        description: '',
        organizer: '',
        contact: '',
        max_participants: '',
        cover_image: '',
        images: [''], // 初始化活动图片数组
        club_ids: [], // 使用数组存储选中的社团ID
        status: defaultStatus, // 添加状态字段，默认为published
        tags: '', // 重置标签字段
        requirements: '', // 重置要求字段
        registration_deadline: '' // 重置报名截止时间
      },
      eventStatusIndex: defaultStatusIndex,
      selectedStatusLabel: this.data.eventStatusOptions[defaultStatusIndex].label,
      selectedCategoryIndex: defaultCategoryIndex, // 设置默认分类索引
      // 初始化临时图片数据
      tempImages: {
        cover_image: '',
        images: []
      },
      // 清除临时服务器图片URL
      tempGalleryUrls: []
    });
  },

  // 关闭添加活动模态框
  closeAddEventModal() {
    this.setData({
      showAddEventModal: false,
      // 清除临时图片数据
      tempImages: {
        cover_image: '',
        images: []
      },
      // 清除临时服务器图片URL
      tempGalleryUrls: []
    });
  },

  // 活动状态选择处理
  onStatusChange(e) {
    const selectedIndex = e.detail.value;
    const selectedStatus = this.data.eventStatusOptions[selectedIndex];
    
    this.setData({
      eventStatusIndex: selectedIndex,
      selectedStatusLabel: selectedStatus.label,
      'eventForm.status': selectedStatus.value
    });
  },

  // 活动分类选择处理
  onCategoryChange(e) {
    const selectedIndex = e.detail.value;
    const selectedCategory = this.data.eventCategories[selectedIndex].name;
    
    this.setData({
      selectedCategoryIndex: selectedIndex,
      'eventForm.category': selectedCategory
    });
  },

  // 活动日期选择处理
  onDateChange(e) {
    const selectedDate = e.detail.value;
    this.setData({
      'eventForm.date': selectedDate
    });
  },

  // 活动时间选择处理
  onTimeChange(e) {
    const selectedTime = e.detail.value;
    this.setData({
      'eventForm.time': selectedTime
    });
  },

  // 报名截止时间选择处理
  onRegistrationDeadlineChange(e) {
    const selectedDate = e.detail.value;
    this.setData({
      'eventForm.registration_deadline': selectedDate
    });
  },

  // 表单输入处理
  onEventFormChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    // 特殊处理多选社团
    if (field === 'club_ids') {
      this.setData({
        'eventForm.club_ids': value
      });
      return;
    }
    
    // 特殊处理活动图片数组
    if (field === 'images') {
      const index = e.currentTarget.dataset.index;
      const images = this.data.eventForm.images;
      images[index] = value;
      this.setData({
        'eventForm.images': images
      });
      return;
    }
    
    // 一般字段处理
    this.setData({
      [`eventForm.${field}`]: value
    });
  },

  // 选择封面图片
  selectCoverImage() {
    this.selectImage('cover_image');
  },

  // 选择活动图片
  selectEventImage(e) {
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
          const images = [...this.data.eventForm.images];
          
          // 确保tempImages.images数组长度足够
          while (tempImages.images.length <= index) {
            tempImages.images.push('');
          }
          
          tempImages.images[index] = compressedFilePath;
          images[index] = compressedFilePath; // 临时显示本地图片
          
          this.setData({
            [`tempImages.${field}`]: tempImages.images,
            [`eventForm.${field}`]: images
          });
        } else {
          this.setData({
            [`tempImages.${field}`]: compressedFilePath,
            [`eventForm.${field}`]: compressedFilePath // 临时显示本地图片
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

  // 删除封面图片
  async deleteCoverImage() {
    await this.deleteImage('cover_image');
    // 清除表单中的封面图片URL
    this.setData({
      'eventForm.cover_image': ''
    });
  },

  // 删除活动图片
  async deleteEventImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.eventForm.images];
    const tempImages = [...this.data.tempImages.images];
    const imageUrl = images[index];
    
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
        if (this.data.editEventId) {
          await deleteImageApi('event', this.data.editEventId, imageUrl, 'images');
          console.log('数据库图片URL删除成功:', imageUrl);
          
          // 重新加载活动数据以反映更改
          await this.loadEvents();
        }
      } catch (error) {
        console.error('删除图片失败:', error);
        wx.showToast({ title: '删除图片失败', icon: 'none' });
        // 即使删除失败，也要更新UI
      }
    }
    
    // 更新UI，清除对应位置的图片URL
    images[index] = '';
    if (tempImages[index]) {
      tempImages[index] = '';
    }
    
    this.setData({
      'eventForm.images': images,
      'tempImages.images': tempImages
    });
  },

  // 通用图片删除函数
  async deleteImage(field) {
    const imageUrl = this.data.eventForm[field];
    
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
        if (this.data.editEventId && field === 'cover_image') {
          await deleteImageApi('event', this.data.editEventId, imageUrl, 'cover_image');
          console.log('数据库图片URL删除成功:', imageUrl);
          
          // 重新加载活动数据以反映更改
          await this.loadEvents();
        }
      } catch (error) {
        console.error('删除图片失败:', error);
        wx.showToast({ title: '删除图片失败', icon: 'none' });
        // 即使删除失败，也要更新UI
      }
    }
    
    // 更新UI，清除表单中的图片URL
    this.setData({
      [`eventForm.${field}`]: '',
      [`tempImages.${field}`]: '' // 同时清除临时图片路径
    });
  },

  // 添加活动图片槽位
  addImageSlot() {
    const images = this.data.eventForm.images;
    // 添加新的空槽位
    const newIndex = images.length;
    images.push('');
    
    this.setData({
      'eventForm.images': images
    }, () => {
      // 在setData完成后，自动触发图片选择
      this.selectImage('images', newIndex);
    });
  },

  // 批量上传所有图片
  async uploadAllImages() {
    const { tempImages } = this.data;
    const uploadedUrls = {
      cover_image: '',
      images: []
    };
    
    try {
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
          const coverResult = await uploadImage(tempImages.cover_image, { category: 'events' });
          if (coverResult && coverResult.url) {
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
      
      // 上传活动图片
      if (tempImages.images && tempImages.images.length > 0) {
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
              
              wx.showLoading({ title: `上传图片(${i+1}/${tempImages.images.length})`, mask: true });
              const imageResult = await uploadImage(tempImages.images[i], { category: 'events' });
              if (imageResult && (imageResult.url || imageResult.fullUrl)) {
                // 确保返回的是完整URL
                const imageUrl = imageResult.fullUrl || (imageResult.url.startsWith('http') ? imageResult.url : `https://api.example.com${imageResult.url}`);
                uploadedUrls.images.push(imageUrl);
              }
            } catch (error) {
              console.error(`活动图片${i+1}上传失败:`, error);
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

  // 保存活动
  async saveEvent() {
    try {
      const { editEventId, eventForm, tempImages } = this.data;
      
      // 表单验证
      if (!eventForm.title || !eventForm.date || !eventForm.time || !eventForm.location) {
        wx.showToast({ title: '请填写必填信息', icon: 'none' });
        return;
      }
      
      // 上传图片并获取URL
      const uploadedUrls = await this.uploadAllImages();
      
      // 使用上传后的URL替换临时本地路径，明确指定需要发送的字段
      const processedForm = {
        title: eventForm.title,
        date: eventForm.date,
        time: eventForm.time,
        location: eventForm.location,
        latitude: eventForm.latitude || null, // 活动地点纬度
        longitude: eventForm.longitude || null, // 活动地点经度
        category: eventForm.category || '',
        description: eventForm.description || '',
        organizer: eventForm.organizer || '',
        contact: eventForm.contact || '',
        max_participants: eventForm.max_participants || '',
        status: eventForm.status || 'draft',
        club_ids: eventForm.club_ids || [],
        cover_image: uploadedUrls.cover_image || eventForm.cover_image || '',
        images: [],
        tags: eventForm.tags || '', // 添加标签字段
        requirements: eventForm.requirements || '', // 添加要求字段
        registration_deadline: eventForm.registration_deadline || null // 报名截止时间
      };
      
      // 处理活动图片数据 - 只保留有效的服务器图片URL，过滤掉临时图片路径
      const existingImages = Array.isArray(eventForm.images) ? eventForm.images : [];
      
      // 过滤出已有的有效图片URL（服务器上的图片），排除临时图片路径
      const validExistingUrls = existingImages
        .filter(url => url && url.trim() !== '' && (url.startsWith('http') || url.startsWith('/uploads/')) && !url.startsWith('http://tmp'))
        .map(url => {
          // 确保URL是完整的
          if (url.startsWith('/uploads/')) {
            return `https://api.example.com${url}`;
          }
          return url;
        });
      
      // 合并已有的服务器图片URL和新上传的图片URL
      processedForm.images = [...validExistingUrls, ...uploadedUrls.images];
      
      // 确保images字段始终是数组格式
      if (!Array.isArray(processedForm.images)) {
        processedForm.images = [];
      }
      
      // 如果是编辑模式，更新活动；否则创建新活动
      let result;
      if (editEventId) {
        result = await manageEvent('update', editEventId, processedForm);  // 使用通用活动管理函数
      } else {
        result = await manageEvent('create', null, processedForm);  // 使用通用活动管理函数
      }
      
      if (result && result.success) {
        wx.showToast({ title: `${editEventId ? '更新' : '创建'}成功`, icon: 'success' });
        this.closeAddEventModal();
        // 清除活动缓存并重新加载数据
        this.clearEventsCache();
        this.loadEvents();
      } else {
        wx.showToast({ title: result.message || `${editEventId ? '更新' : '创建'}失败`, icon: 'none' });
      }
    } catch (error) {
      console.error(`${this.data.editEventId ? '更新' : '创建'}活动失败:`, error);
      wx.showToast({ title: `${this.data.editEventId ? '更新' : '创建'}活动失败`, icon: 'none' });
    }
  },

  // 清除活动缓存
  clearEventsCache() {
    try {
      const app = getApp();
      wx.removeStorageSync(app.globalData.eventsKey);
    } catch (e) {
      console.error('清除活动缓存失败:', e);
    }
  },

  // 编辑活动
  async editEvent(e) {
    const eventId = e.currentTarget.dataset.id;
    
    // 显示加载状态
    wx.showLoading({ title: '加载中...', mask: true });
    
    try {
      // 通过API获取完整的活动详情（包含 related_clubs 等完整字段）
      const eventResult = await fetchEventById(eventId);
      wx.hideLoading();
      
      if (!eventResult || !eventResult.success || !eventResult.data) {
        wx.showToast({ title: '获取活动详情失败', icon: 'none' });
        return;
      }
      
      const event = eventResult.data;
      
      // 处理活动图片数据
      let imagesArray = [''];
      if (event.images && Array.isArray(event.images) && event.images.length > 0) {
        imagesArray = [...event.images];
      }
      
      // 确保至少有一个空槽位用于添加新图片
      if (imagesArray.length === 0 || imagesArray[imagesArray.length - 1] !== '') {
        imagesArray.push('');
      }
      
      // 处理社团IDs - 从API返回的 related_clubs 字段获取完整关联信息
      let clubIds = [];
      if (event.related_clubs && Array.isArray(event.related_clubs)) {
        clubIds = event.related_clubs.map(club => club.id);
      }
      
      // 处理标签数据
      let tagsArray = [];
      if (Array.isArray(event.tags)) {
        tagsArray = event.tags;
      } else if (typeof event.tags === 'string') {
        try {
          // 尝试解析JSON格式的标签
          tagsArray = JSON.parse(event.tags);
        } catch (e) {
          // 如果不是JSON格式，按逗号分隔处理
          tagsArray = event.tags ? event.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        }
      }
      
      // 处理要求数据
      let requirementsArray = [];
      if (Array.isArray(event.requirements)) {
        requirementsArray = event.requirements;
      } else if (typeof event.requirements === 'string') {
        try {
          // 尝试解析JSON格式的要求
          requirementsArray = JSON.parse(event.requirements);
        } catch (e) {
          // 如果不是JSON格式，按换行符分隔处理
          requirementsArray = event.requirements ? event.requirements.split('\n').map(req => req.trim()).filter(req => req) : [];
        }
      }
      
      // 处理状态选择
      const statusIndex = this.data.eventStatusOptions.findIndex(option => option.value === (event.status || 'published'));
      const statusLabel = statusIndex >= 0 ? this.data.eventStatusOptions[statusIndex].label : '已发布';
      
      // 处理活动分类选择
      const categoryIndex = this.data.eventCategories.findIndex(category => category.name === (event.category || ''));
      const selectedCategoryIndex = categoryIndex >= 0 ? categoryIndex : 0;
      
      // 格式化报名截止时间
      let registrationDeadline = '';
      if (event.registration_deadline) {
        try {
          const deadlineDate = new Date(event.registration_deadline);
          registrationDeadline = deadlineDate.toISOString().split('T')[0];
        } catch (e) {
          console.warn('格式化报名截止时间失败:', e);
        }
      }
      
      // 格式化日期（API返回的是ISO格式，需要转换为日期选择器格式）
      let eventDate = event.date || '';
      if (eventDate && eventDate.includes('T')) {
        eventDate = eventDate.split('T')[0];
      }
      
      this.setData({
        showAddEventModal: true,
        editEventId: eventId,
        eventForm: {
          title: event.title || '',
          date: eventDate,
          time: event.time || '',
          location: event.location || '',
          latitude: event.latitude || null, // 加载活动地点纬度
          longitude: event.longitude || null, // 加载活动地点经度
          category: event.category || '',
          description: event.description || '',
          organizer: event.organizer || '',
          contact: event.contact || '',
          max_participants: event.max_participants || '',
          cover_image: event.cover_image || '',
          images: imagesArray,
          club_ids: clubIds || [],
          status: event.status || 'published',
          tags: Array.isArray(tagsArray) ? tagsArray.join(', ') : (event.tags || ''), // 将标签数组转换为逗号分隔的字符串
          requirements: Array.isArray(requirementsArray) ? requirementsArray.join('\n') : (event.requirements || ''), // 将要求数组转换为换行符分隔的字符串
          registration_deadline: registrationDeadline
        },
        eventStatusIndex: statusIndex >= 0 ? statusIndex : 1,
        selectedStatusLabel: statusLabel,
        selectedCategoryIndex: selectedCategoryIndex, // 设置活动分类索引
        // 初始化临时图片数据，区分服务器URL和本地路径
        tempImages: {
          cover_image: event.cover_image && event.cover_image.startsWith('http') ? '' : event.cover_image,
          images: []
        },
        // 如果已有活动图片URL，需要复制到tempImages.images中
        tempGalleryUrls: Array.isArray(event.images) ? event.images : []
      });
      
      console.log('编辑活动时设置的表单数据:', this.data.eventForm);
      console.log('编辑活动时设置的社团IDs:', this.data.eventForm.club_ids);
    } catch (error) {
      wx.hideLoading();
      console.error('获取活动详情失败:', error);
      wx.showToast({ title: '加载活动详情失败', icon: 'none' });
    }
  },

  // 删除活动
  deleteEvent(e) {
    const eventId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个活动吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await manageEvent('delete', eventId);  // 使用通用活动管理函数
            if (result && result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              // 清除活动缓存并重新加载数据
              this.clearEventsCache();
              this.loadEvents();
            } else {
              wx.showToast({ title: result.message || '删除失败', icon: 'none' });
            }
          } catch (error) {
            console.error('删除活动失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 查看活动详情
  async viewEventDetail(e) {
    const eventId = e.currentTarget.dataset.id;
    
    try {
      // 获取活动详情
      const eventResult = await fetchEventById(eventId);
      if (eventResult && eventResult.success) {
        // 格式化详情中的日期显示并处理关联社团信息
        const formattedEvent = {
          ...eventResult.data,
          date: formatEventDate(eventResult.data.date), // 使用工具函数格式化日期
          related_clubs_names: eventResult.data.related_clubs ? eventResult.data.related_clubs.map(club => club.name).join(', ') : ''
        };
        
        this.setData({
          currentEvent: formattedEvent,
          showEventDetailModal: true
        });
        
        // 获取活动参与者
        this.loadEventParticipants(eventId);
      }
    } catch (error) {
      console.error('获取活动详情失败:', error);
      wx.showToast({ title: '获取活动详情失败', icon: 'none' });
    }
  },

  // 修改活动状态
  async changeEventStatus(e) {
    const eventId = e.currentTarget.dataset.id;
    const currentStatus = e.currentTarget.dataset.status;
    
    // 显示选择器让用户选择新状态
    const statusOptions = this.data.eventStatusOptions.map(item => item.label);
    const statusValues = this.data.eventStatusOptions.map(item => item.value);
    
    wx.showActionSheet({
      itemList: statusOptions,
      success: async (res) => {
        const newStatus = statusValues[res.tapIndex];
        
        if (newStatus !== currentStatus) {
          try {
            const result = await updateEventStatusUnified(eventId, newStatus);
            
            if (result && result.success) {
              wx.showToast({ title: '状态更改成功', icon: 'success' });
              // 重新加载活动列表
              this.loadEvents();
              // 如果详情模态框打开，也更新详情
              if (this.data.currentEvent && this.data.currentEvent.id === eventId) {
                this.viewEventDetail({ currentTarget: { dataset: { id: eventId } } });
              }
            } else {
              wx.showToast({ title: result.message || '更改失败', icon: 'none' });
            }
          } catch (error) {
            console.error('更改活动状态失败:', error);
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 加载活动参与者
  async loadEventParticipants(eventId) {
    try {
      const result = await fetchEventParticipants(eventId, {}, true);
      if (result && result.success) {
        // 处理参与者数据，确保必要的字段存在
        const participants = result.data.map(participant => ({
          ...participant,
          nickname: participant.nickname || '未知用户',
          student_id: participant.student_id || '未知学号',
          avatar_url: participant.avatar_url || '/images/default-avatar.png'
        }));
        
        this.setData({
          eventParticipants: participants
        });
      }
    } catch (error) {
      console.error('获取活动参与者失败:', error);
      wx.showToast({ title: '获取活动参与者失败', icon: 'none' });
    }
  },

  // 处理图片加载错误，显示默认头像
  onAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    const participants = this.data.eventParticipants;
    participants[index].avatar_url = '/images/default-avatar.png';
    this.setData({
      eventParticipants: participants
    });
  },

  // 关闭活动详情模态框
  closeEventDetailModal() {
    this.setData({
      showEventDetailModal: false,
      currentEvent: null
    });
  },

  // 更改参与者状态
  async changeParticipantStatus(e) {
    const userId = e.currentTarget.dataset.userId;
    const currentStatus = e.currentTarget.dataset.currentStatus;
    
    // 显示选择器让用户选择新状态
    const statusOptions = ['pending', 'approved', 'rejected', 'checked_in'];
    const statusLabels = ['待审核', '已批准', '已拒绝', '已签到'];
    
    wx.showActionSheet({
      itemList: statusLabels,
      success: async (res) => {
        const newStatus = statusOptions[res.tapIndex];
        
        if (newStatus !== currentStatus) {
          try {
            const { currentEvent } = this.data;
            const result = await changeEventParticipantStatus(currentEvent.id, userId, newStatus);
            
            if (result && result.success) {
              wx.showToast({ title: '状态更改成功', icon: 'success' });
              this.loadEventParticipants(currentEvent.id);
            } else {
              wx.showToast({ title: result.message || '更改失败', icon: 'none' });
            }
          } catch (error) {
            console.error('更改参与者状态失败:', error);
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 移除活动参与者
  async removeParticipant(e) {
    const userId = e.currentTarget.dataset.userId;
    
    wx.showModal({
      title: '确认移除',
      content: '确定要将该用户从活动中移除吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const { currentEvent } = this.data;
            const result = await removeEventParticipant(currentEvent.id, userId);
            
            if (result && result.success) {
              wx.showToast({ title: '参与者移除成功', icon: 'success' });
              this.loadEventParticipants(currentEvent.id);
            } else {
              wx.showToast({ title: result.message || '移除失败', icon: 'none' });
            }
          } catch (error) {
            console.error('移除参与者失败:', error);
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 图片预览功能
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const gallery = this.data.currentEvent.images || [];
    
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
    if (field === 'images') {
      urls = this.data.eventForm.images.filter(item => item && item.trim() !== '');
    } else {
      urls = [this.data.eventForm[field]];
    }
    
    wx.previewImage({
      current: url,
      urls: urls
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  /**
   * 打开地图选择位置
   * @description 调用微信地图选点功能，选择活动地点
   */
  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        // res.name: 位置名称
        // res.address: 详细地址
        // res.latitude: 纬度
        // res.longitude: 经度
        this.setData({
          'eventForm.location': res.name || res.address,
          'eventForm.latitude': res.latitude,
          'eventForm.longitude': res.longitude
        });
      },
      fail: (err) => {
        console.error('选择位置失败:', err);
        // 用户取消选择不提示错误
        if (err.errMsg !== 'chooseLocation:fail cancel') {
          wx.showToast({ title: '选择位置失败', icon: 'none' });
        }
      }
    });
  },

  /**
   * 清除已选择的位置
   * @description 清除活动地点的坐标信息
   */
  clearLocation() {
    this.setData({
      'eventForm.location': '',
      'eventForm.latitude': null,
      'eventForm.longitude': null
    });
  }
});