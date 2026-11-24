/**
 * 社团编辑页面主模块
 * @description 处理社团信息编辑、页面切换、模块协调等功能
 */

const {
  fetchClubById,
  manageClub,
  uploadImage,
  deleteFile,
  deleteImage,
  fetchMyClubs
} = require("../../utils/api/index");

const {
  chooseSingleImage,
  uploadSingleImage,
  uploadMultipleImages,
  isValidImageUrl,
  formatImageUrl,
  mergeImageUrls,
  isLocalTempPath
} = require("../../utils/image-handler");

const eventModule = require("./event.js");
const announcementModule = require("./announcement.js");
const recruitmentModule = require("./recruitment.js");
const memberModule = require("./member.js");
const { formatEventDate } = require("../../utils/date.js");
const { themeManager } = require("../../utils/theme.js");
const leaderAuthBehavior = require("../../behaviors/leaderAuth");

Page({
  behaviors: [leaderAuthBehavior],

  data: {
    currentTab: 'club',

    // 社团数据
    clubId: null,
    clubInfo: {
      name: '',
      short_intro: '',
      description: '',
      category: '',
      level: 'college',
      logo: '',
      cover_image: '',
      gallery: []
    },
    categories: ['学术', '艺术', '体育', '文化', '公益'],
    levels: [
      { value: 'college', label: '学院级' },
      { value: 'school', label: '校级' }
    ],
    eventCategories: [
      { name: "学术" },
      { name: "文艺" },
      { name: "文化" },
      { name: "娱乐" },
      { name: "体育" },
      { name: "公益" }
    ],
    selectedCategoryIndex: 0,
    tempImages: {
      logo: '',
      cover_image: '',
      gallery: []
    },
    imageUploading: {
      logo: false,
      cover: false,
      gallery: false
    },

    // 公告数据
    announcements: [],
    announcementPagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    },

    // 活动数据
    events: [],
    eventPagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    },

    // 社团成员数据
    clubMembers: [],
    memberPagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    },

    // 招新数据
    recruitments: [],
    recruitmentPagination: {
      currentPage: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0
    },

    // 社团列表数据
    allClubs: [],

    // 模态框状态
    showAddAnnouncementModal: false,
    showAddEventModal: false,
    showAddMemberModal: false,
    showAddRecruitmentModal: false,

    // 表单数据
    announcementForm: {
      title: '',
      content: '',
      images: ['']
    },
    eventForm: {
      title: '',
      date: '',
      time: '',
      location: '',
      latitude: null,
      longitude: null,
      category: '',
      description: '',
      organizer: '',
      contact: '',
      max_participants: '',
      cover_image: '',
      images: [''],
      status: 'published',
      club_ids: [],
      tags: '',
      requirements: '',
      registration_deadline: ''
    },
    memberForm: {
      userId: '',
      role: 'member'
    },
    recruitmentForm: {
      title: '',
      description: '',
      cover_image: '',
      requirements: [''],
      status: 'draft',
      start_time: '',
      end_time: '',
      max_applicants: '',
      interview_info: {
        type: 'offline',
        location: '',
        contact: '',
        notes: ''
      },
      contact_info: ''
    },

    // 临时图片存储
    tempGalleryUrls: [],
    tempAnnouncementImages: {
      images: []
    },
    tempEventImages: {
      cover_image: '',
      images: []
    },
    tempRecruitmentImages: {
      cover_image: ''
    },

    // 编辑状态
    editAnnouncementId: null,
    editEventId: null,
    editRecruitmentId: null,

    // 用户搜索相关
    searchStudentId: '',
    searchResults: [],
    showSearchResults: false,
    selectedUser: null,

    // 活动状态选项
    eventStatusOptions: [
      { value: 'draft', label: '草稿' },
      { value: 'published', label: '已发布' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' }
    ],
    eventStatusIndex: 1,
    selectedStatusLabel: '已发布',

    // 招新状态选项
    recruitmentStatusOptions: [
      { value: 'draft', label: '草稿' },
      { value: 'published', label: '已发布' },
      { value: 'closed', label: '已结束' }
    ],

    // 主题色
    theme: null
  },

  onLoad(options) {
    // 初始化主题
    const theme = themeManager.getTheme();
    this.setData({ theme });

    if (options.id) {
      const clubId = parseInt(options.id, 10);
      this.setData({ clubId });
      
      // 检查是否是该社团的社长
      this.checkClubPermission(clubId);
    }
  },

  /**
   * 检查社团社长权限并加载数据
   * @param {number} clubId - 社团ID
   */
  async checkClubPermission(clubId) {
    const hasPermission = await this.checkClubLeaderPermission(clubId);
    if (hasPermission) {
      this.loadClubInfo(clubId);
      announcementModule.loadAnnouncements(this, clubId);
      eventModule.loadEvents(this, clubId);
      eventModule.loadAllClubs(this);
      memberModule.loadClubMembers(this, clubId);
      recruitmentModule.loadRecruitments(this, clubId);
    }
  },

  /**
   * 页面显示时更新主题色
   * @description 确保主题色与其他页面同步
   */
  onShow() {
    // 更新主题色，确保与其他页面同步
    const theme = themeManager.getTheme();
    this.setData({ theme });
  },

  /**
   * 切换标签页
   * @param {Object} e - 事件对象
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });

    // 懒加载各模块数据
    const loadActions = {
      announcement: () => this.data.announcements.length === 0 && announcementModule.loadAnnouncements(this, this.data.clubId),
      event: () => this.data.events.length === 0 && eventModule.loadEvents(this, this.data.clubId),
      member: () => this.data.clubMembers.length === 0 && memberModule.loadClubMembers(this, this.data.clubId),
      recruitment: () => this.data.recruitments.length === 0 && recruitmentModule.loadRecruitments(this, this.data.clubId)
    };

    if (loadActions[tab]) {
      loadActions[tab]();
    }
  },

  // ========== 成员管理功能 ==========

  prevMemberPage() {
    memberModule.prevMemberPage(this);
  },

  nextMemberPage() {
    memberModule.nextMemberPage(this);
  },

  showAddMemberModal() {
    memberModule.showAddMemberModal(this);
  },

  closeAddMemberModal() {
    memberModule.closeAddMemberModal(this);
  },

  onStudentIdInput(e) {
    memberModule.onStudentIdInput(this, e);
  },

  selectUser(e) {
    memberModule.selectUser(this, e);
  },

  clearUserSelection() {
    memberModule.clearUserSelection(this);
  },

  onMemberFormChange(e) {
    memberModule.onMemberFormChange(this, e);
  },

  onMemberRoleChange(e) {
    memberModule.onMemberRoleChange(this, e);
  },

  addMember() {
    memberModule.addMember(this);
  },

  changeMemberRole(e) {
    memberModule.changeMemberRole(this, e);
  },

  removeMember(e) {
    memberModule.removeMember(this, e);
  },

  toggleMemberStatus(e) {
    memberModule.toggleMemberStatus(this, e);
  },

  // ========== 活动管理功能 ==========

  prevEventPage() {
    eventModule.prevEventPage(this);
  },

  nextEventPage() {
    eventModule.nextEventPage(this);
  },

  showAddEventModal() {
    eventModule.showAddEventModal(this);
  },

  closeAddEventModal() {
    eventModule.closeAddEventModal(this);
  },

  onEventStatusChange(e) {
    eventModule.onEventStatusChange(this, e);
  },

  onEventDateChange(e) {
    eventModule.onEventDateChange(this, e);
  },

  onEventTimeChange(e) {
    eventModule.onEventTimeChange(this, e);
  },

  onEventRegistrationDeadlineChange(e) {
    this.setData({
      'eventForm.registration_deadline': e.detail.value
    });
  },

  onEventCategoryChange(e) {
    const selectedIndex = e.detail.value;
    const selectedCategory = this.data.eventCategories[selectedIndex].name;
    this.setData({
      selectedCategoryIndex: selectedIndex,
      'eventForm.category': selectedCategory
    });
  },

  onClubGroupChange(e) {
    eventModule.onClubGroupChange(this, e);
  },

  onEventFormChange(e) {
    eventModule.onEventFormChange(this, e);
  },

  selectEventCoverImage() {
    eventModule.selectEventCoverImage(this);
  },

  selectEventImage(e) {
    eventModule.selectEventImage(this, e);
  },

  deleteEventCoverImage() {
    eventModule.deleteEventCoverImage(this);
  },

  deleteEventImage(e) {
    eventModule.deleteEventImage(this, e);
  },

  removeEventImageSlot(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.eventForm.images];
    const tempImages = [...this.data.tempEventImages.images];

    images.splice(index, 1);
    if (tempImages[index]) {
      tempImages.splice(index, 1);
    }

    if (images.length === 0) {
      images.push('');
      tempImages.push('');
    }

    this.setData({
      'eventForm.images': images,
      tempEventImages: { ...this.data.tempEventImages, images: tempImages }
    });
  },

  addEventImageSlot() {
    eventModule.addEventImageSlot(this);
  },

  saveEvent() {
    eventModule.saveEvent(this);
  },

  editEvent(e) {
    eventModule.editEvent(this, e);
  },

  deleteEvent(e) {
    eventModule.deleteEvent(this, e);
  },

  /**
   * 发送活动开始提醒
   * @description 社长发送活动提醒给已报名用户
   * @param {Object} e - 事件对象
   */
  sendEventNotify(e) {
    eventModule.sendEventNotify(this, e);
  },

  chooseLocation() {
    eventModule.chooseLocation(this);
  },

  clearLocation() {
    eventModule.clearLocation(this);
  },

  // ========== 公告管理功能 ==========

  prevAnnouncementPage() {
    announcementModule.prevAnnouncementPage(this);
  },

  nextAnnouncementPage() {
    announcementModule.nextAnnouncementPage(this);
  },

  showAddAnnouncementModal() {
    announcementModule.showAddAnnouncementModal(this);
  },

  closeAddAnnouncementModal() {
    announcementModule.closeAddAnnouncementModal(this);
  },

  onAnnouncementFormChange(e) {
    announcementModule.onAnnouncementFormChange(this, e);
  },

  selectAnnouncementImage(e) {
    announcementModule.selectAnnouncementImage(this, e);
  },

  deleteAnnouncementImage(e) {
    announcementModule.deleteAnnouncementImage(this, e);
  },

  addImageSlot() {
    announcementModule.addImageSlot(this);
  },

  removeImageSlot(e) {
    announcementModule.removeImageSlot(this, e);
  },

  saveAnnouncement() {
    announcementModule.saveAnnouncement(this);
  },

  editAnnouncement(e) {
    if (e.detail && e.detail.id) {
      e.currentTarget = { dataset: { id: e.detail.id } };
    }
    announcementModule.editAnnouncement(this, e);
  },

  deleteAnnouncement(e) {
    if (e.detail && e.detail.id) {
      e.currentTarget = { dataset: { id: e.detail.id } };
    }
    announcementModule.deleteAnnouncement(this, e);
  },

  previewFormImage(e) {
    const url = e.currentTarget.dataset.url;
    const field = e.currentTarget.dataset.field;

    let urls = [];
    if (field === 'gallery') {
      urls = this.data.clubInfo.gallery.filter(item => item && item.trim() !== '');
    } else {
      urls = [this.data.clubInfo[field]];
    }

    wx.previewImage({ current: url, urls });
  },

  previewAnnouncementListImage(e) {
    if (e.detail && e.detail.url) {
      wx.previewImage({
        current: e.detail.url,
        urls: e.detail.images
      });
    } else {
      announcementModule.previewAnnouncementListImage(this, e);
    }
  },

  previewEventListImage(e) {
    eventModule.previewEventListImage(this, e);
  },

  // ========== 社团信息编辑 ==========

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`clubInfo.${field}`]: value });
  },

  onCategoryChange(e) {
    const selectedIndex = e.detail.value;
    const selectedCategory = this.data.categories[selectedIndex];
    this.setData({ 'clubInfo.category': selectedCategory });
  },

  onLevelChange(e) {
    const levels = ['college', 'school'];
    const selectedLevel = levels[e.detail.value];
    this.setData({ 'clubInfo.level': selectedLevel });
  },

  selectLogo() {
    this.selectImage('logo');
  },

  selectCoverImage() {
    this.selectImage('cover_image');
  },

  selectGalleryImage(e) {
    const index = e.currentTarget.dataset.index;
    this.selectImage('gallery', index);
  },

  /**
   * 通用图片选择函数
   * @param {string} field - 字段名
   * @param {number} index - 索引（相册用）
   */
  async selectImage(field, index = null) {
    try {
      const compressedPath = await chooseSingleImage();

      if (field === 'gallery') {
        const tempImages = this.data.tempImages;
        const gallery = [...this.data.clubInfo.gallery];

        while (tempImages.gallery.length <= index) {
          tempImages.gallery.push('');
        }

        tempImages.gallery[index] = compressedPath;
        gallery[index] = compressedPath;

        this.setData({
          [`tempImages.${field}`]: tempImages.gallery,
          [`clubInfo.${field}`]: gallery
        });
      } else {
        this.setData({
          [`tempImages.${field}`]: compressedPath,
          [`clubInfo.${field}`]: compressedPath
        });
      }

      wx.showToast({ title: '图片已选择，保存时将自动上传', icon: 'success', duration: 2000 });
    } catch (error) {
      // 用户取消选择
    }
  },

  async deleteLogo() {
    await this.deleteImageFromServer('logo');
  },

  async deleteCoverImage() {
    await this.deleteImageFromServer('cover_image');
  },

  async removeGalleryImage(e) {
    const index = e.currentTarget.dataset.index;
    await this.deleteImageFromServer('gallery', index);
  },

  /**
   * 从服务器删除图片
   * @param {string} field - 字段名
   * @param {number} index - 索引（相册用）
   */
  async deleteImageFromServer(field, index = null) {
    const imageUrl = index !== null ? this.data.clubInfo.gallery[index] : this.data.clubInfo[field];

    if (imageUrl && isValidImageUrl(imageUrl)) {
      try {
        let relativeUrl = imageUrl;
        if (imageUrl.startsWith('http')) {
          relativeUrl = imageUrl.replace('https://api.example.com', '');
        }

        await deleteFile(relativeUrl);
        console.log('服务器文件删除成功:', relativeUrl);

        if (this.data.clubId) {
          await deleteImage('club', this.data.clubId, imageUrl, field);
          console.log('数据库图片URL删除成功:', imageUrl);
        }
      } catch (error) {
        console.error('删除图片文件失败:', error);
        wx.showToast({ title: '删除图片文件失败', icon: 'none' });
      }
    }

    // 更新UI
    if (field === 'gallery') {
      const gallery = [...this.data.clubInfo.gallery];
      const tempGallery = [...this.data.tempImages.gallery];
      gallery[index] = '';
      if (tempGallery[index]) {
        tempGallery[index] = '';
      }
      this.setData({
        'clubInfo.gallery': gallery,
        'tempImages.gallery': tempGallery
      });
    } else {
      this.setData({
        [`clubInfo.${field}`]: '',
        [`tempImages.${field}`]: ''
      });
    }
  },

  addGallerySlot() {
    const gallery = this.data.clubInfo.gallery;
    const newIndex = gallery.length;
    gallery.push('');

    this.setData({ 'clubInfo.gallery': gallery }, () => {
      this.selectImage('gallery', newIndex);
    });
  },

  /**
   * 批量上传所有图片
   * @returns {Promise<Object>} 上传后的URL对象
   */
  async uploadAllImages() {
    const { tempImages } = this.data;
    const uploadedUrls = {
      logo: '',
      cover_image: '',
      gallery: []
    };

    try {
      // 上传Logo
      if (tempImages.logo && isLocalTempPath(tempImages.logo)) {
        uploadedUrls.logo = await uploadSingleImage(tempImages.logo, 'clubs', '上传Logo...');
      } else if (this.data.clubInfo.logo && isValidImageUrl(this.data.clubInfo.logo)) {
        uploadedUrls.logo = this.data.clubInfo.logo;
      }

      // 上传封面图片
      if (tempImages.cover_image && isLocalTempPath(tempImages.cover_image)) {
        uploadedUrls.cover_image = await uploadSingleImage(tempImages.cover_image, 'clubs', '上传封面...');
      } else if (this.data.clubInfo.cover_image && isValidImageUrl(this.data.clubInfo.cover_image)) {
        uploadedUrls.cover_image = this.data.clubInfo.cover_image;
      }

      // 上传相册图片
      if (tempImages.gallery && tempImages.gallery.length > 0) {
        const localImages = tempImages.gallery.filter(img => img && isLocalTempPath(img));
        if (localImages.length > 0) {
          uploadedUrls.gallery = await uploadMultipleImages(localImages, 'clubs', '上传图片');
        }
      }

      return uploadedUrls;
    } catch (error) {
      console.error('批量上传图片失败:', error);
      throw error;
    }
  },

  /**
   * 保存社团信息
   */
  async saveClubInfo() {
    if (!this.data.clubInfo.name) {
      wx.showToast({ title: '请输入社团名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const { clubId, clubInfo } = this.data;
      const uploadedUrls = await this.uploadAllImages();

      // 构建表单数据
      const processedForm = {
        name: clubInfo.name,
        short_intro: clubInfo.short_intro,
        description: clubInfo.description,
        category: clubInfo.category,
        level: clubInfo.level,
        logo: uploadedUrls.logo || '',
        cover_image: uploadedUrls.cover_image || ''
      };

      // 处理相册数据
      const existingGallery = Array.isArray(clubInfo.gallery) ? clubInfo.gallery : [];
      const mergedGallery = mergeImageUrls(existingGallery, uploadedUrls.gallery);
      if (mergedGallery.length > 0) {
        processedForm.gallery = mergedGallery;
      }

      const result = await manageClub('update', clubId, processedForm);

      if (result && result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        await this.loadClubInfo(clubId);
        this.updateClubCache(clubId);

        wx.navigateBack({
          fail: () => {
            wx.switchTab({ url: '/pages/home/home' });
          }
        });
      } else {
        wx.showToast({ title: result.message || '保存失败', icon: 'none' });
      }
    } catch (error) {
      console.error('保存社团信息失败:', error);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 更新缓存中的社团数据
   * @param {number} clubId - 社团ID
   */
  updateClubCache(clubId) {
    try {
      const { getTimedCached, setTimedCached } = require("../../utils/cache");
      const app = getApp();
      const cached = getTimedCached(app.globalData.clubListKey);

      if (cached.data && !cached.expired) {
        const updatedClubs = cached.data.map(club => {
          if (`${club.id}` === `${clubId}`) {
            return { ...club, ...this.data.clubInfo };
          }
          return club;
        });

        setTimedCached(app.globalData.clubListKey, updatedClubs);
      }
    } catch (e) {
      console.warn('更新社团缓存失败:', e);
    }
  },

  /**
   * 加载社团信息
   * @param {number} clubId - 社团ID
   */
  async loadClubInfo(clubId) {
    try {
      const result = await fetchClubById(clubId);

      if (result && result.success) {
        const clubData = {
          ...result.data,
          gallery: result.data.gallery && Array.isArray(result.data.gallery)
            ? result.data.gallery
            : []
        };

        if (clubData.gallery.length === 0) {
          clubData.gallery = [''];
        }

        this.setData({
          clubInfo: clubData,
          tempImages: {
            logo: '',
            cover_image: '',
            gallery: []
          }
        });
      } else {
        wx.showToast({ title: result.message || '加载失败', icon: 'none' });
      }
    } catch (error) {
      console.error('加载社团信息失败:', error);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  // ========== 招新管理功能 ==========

  prevRecruitmentPage() {
    recruitmentModule.prevRecruitmentPage(this);
  },

  nextRecruitmentPage() {
    recruitmentModule.nextRecruitmentPage(this);
  },

  showAddRecruitmentModal() {
    recruitmentModule.showAddRecruitmentModal(this);
  },

  closeAddRecruitmentModal() {
    recruitmentModule.closeAddRecruitmentModal(this);
  },

  onStartTimeChange(e) {
    recruitmentModule.onStartTimeChange(this, e);
  },

  onEndTimeChange(e) {
    recruitmentModule.onEndTimeChange(this, e);
  },

  onRecruitmentFormChange(e) {
    recruitmentModule.onRecruitmentFormChange(this, e);
  },

  onInterviewInfoChange(e) {
    recruitmentModule.onInterviewInfoChange(this, e);
  },

  onInterviewTypeChange(e) {
    recruitmentModule.onInterviewTypeChange(this, e);
  },

  addRequirement() {
    recruitmentModule.addRequirement(this);
  },

  removeRequirement(e) {
    recruitmentModule.removeRequirement(this, e);
  },

  onRequirementChange(e) {
    recruitmentModule.onRequirementChange(this, e);
  },

  selectRecruitmentCoverImage() {
    recruitmentModule.selectRecruitmentCoverImage(this);
  },

  deleteRecruitmentCoverImage() {
    recruitmentModule.deleteRecruitmentCoverImage(this);
  },

  selectRecruitmentPoster() {
    recruitmentModule.selectRecruitmentPoster(this);
  },

  deleteRecruitmentPoster() {
    recruitmentModule.deleteRecruitmentPoster(this);
  },

  selectRecruitmentQrCode() {
    recruitmentModule.selectRecruitmentQrCode(this);
  },

  deleteRecruitmentQrCode() {
    recruitmentModule.deleteRecruitmentQrCode(this);
  },

  saveRecruitment() {
    recruitmentModule.saveRecruitment(this);
  },

  editRecruitment(e) {
    recruitmentModule.editRecruitment(this, e);
  },

  deleteRecruitment(e) {
    recruitmentModule.deleteRecruitment(this, e);
  },

  previewRecruitmentListImage(e) {
    recruitmentModule.previewRecruitmentListImage(this, e);
  },

  // ========== 图片上传组件事件处理 ==========

  onLogoChange(e) {
    const { imageUrl, tempImage } = e.detail;
    this.setData({
      'clubInfo.logo': imageUrl || tempImage,
      'tempImages.logo': tempImage || ''
    });
  },

  onLogoDelete() {
    this.deleteLogo();
  },

  onCoverImageChange(e) {
    const { imageUrl, tempImage } = e.detail;
    this.setData({
      'clubInfo.cover_image': imageUrl || tempImage,
      'tempImages.cover_image': tempImage || ''
    });
  },

  onCoverImageDelete() {
    this.deleteCoverImage();
  },

  onGalleryChange(e) {
    const { images, tempImages } = e.detail;
    const currentTempGallery = this.data.tempImages.gallery || [];
    const newTempGallery = [...currentTempGallery, ...(tempImages || [])];

    this.setData({
      'clubInfo.gallery': images,
      'tempImages.gallery': newTempGallery.filter(img => img && img.trim() !== '')
    });
  },

  onGalleryImageDelete(e) {
    const { index, images } = e.detail;
    const currentTempGallery = this.data.tempImages.gallery || [];
    const newTempGallery = [...currentTempGallery];

    if (index < newTempGallery.length) {
      newTempGallery.splice(index, 1);
    }

    this.setData({
      'clubInfo.gallery': images,
      'tempImages.gallery': newTempGallery
    });
  },

  onGalleryPreview(e) {
    const { url, urls } = e.detail;
    wx.previewImage({ current: url, urls });
  }
});
