/**
 * 活动管理模块
 * @description 处理活动的加载、创建、编辑、删除等功能
 */

const {
  fetchClubEvents,
  fetchEventById,
  manageEvent,
  fetchClubs,
  deleteFile,
  deleteImage,
  requestSubscribeMessage,
  TEMPLATE_IDS,
  sendNewEventNotification,
  sendEventReminder: sendEventReminderAPI
} = require("../../utils/api/index");

const {
  prevPage,
  nextPage,
  onFormChange,
  confirmDelete,
  selectImage,
  deleteImageFromArray,
  addImageSlot,
  removeImageSlot,
  uploadSingleImageField,
  uploadMultipleImageFields,
  processImagesArray,
  previewListImage,
  showSuccess,
  showError,
  showLoading,
  hideLoading,
  getStatusText,
  isValidImageUrl,
  mergeImageUrls,
  isLocalTempPath,
  formatEventDate
} = require("./edit-utils.js");

/**
 * 格式化活动数据中的日期
 * @param {Array} events - 活动列表
 * @returns {Array} 格式化后的活动列表
 */
function formatEvents(events) {
  return events.map(event => ({
    ...event,
    date: formatEventDate(event.date),
    status_label: getStatusText(event.status, 'event'),
    related_clubs_names: event.related_clubs ? event.related_clubs.map(club => club.name).join(', ') : '',
    approval_status_label: getApprovalStatusText(event.approval_status),
    reject_reason: event.reject_reason || ''
  }));
}

/**
 * 获取审核状态文本
 * @param {string} status - 审核状态
 * @returns {string} 状态文本
 */
function getApprovalStatusText(status) {
  const statusMap = {
    'pending': '待审核',
    'approved': '已通过',
    'rejected': '已拒绝'
  };
  return statusMap[status] || '未知';
}

/**
 * 加载活动列表
 * @param {Object} page - 页面实例
 * @param {number} clubId - 社团ID
 * @param {number} pageNum - 页码
 */
async function loadEvents(page, clubId, pageNum = 1) {
  try {
    const result = await fetchClubEvents(clubId, {
      page: pageNum,
      pageSize: page.data.eventPagination.pageSize
    });

    if (result && result.success) {
      // 过滤掉已取消的活动，社长管理页面不显示
      const activeEvents = result.data.filter(event => event.status !== 'cancelled');
      const formattedEvents = formatEvents(activeEvents);

      page.setData({
        events: formattedEvents,
        eventPagination: {
          ...page.data.eventPagination,
          ...result.pagination
        }
      });
    }
  } catch (error) {
    console.error('获取活动列表失败:', error);
    showError('获取活动列表失败');
  }
}

/**
 * 活动分页 - 上一页
 * @param {Object} page - 页面实例
 */
function prevEventPage(page) {
  prevPage(page, 'eventPagination', loadEvents);
}

/**
 * 活动分页 - 下一页
 * @param {Object} page - 页面实例
 */
function nextEventPage(page) {
  nextPage(page, 'eventPagination', loadEvents);
}

/**
 * 显示添加活动模态框
 * @description 初始化活动表单，设置默认值
 * @param {Object} page - 页面实例
 */
function showAddEventModal(page) {
  const defaultStatus = 'published';
  const defaultStatusIndex = page.data.eventStatusOptions.findIndex(option => option.value === defaultStatus);
  const defaultCategoryIndex = 0;

  page.setData({
    showAddEventModal: true,
    editEventId: null,
    eventForm: {
      title: '',
      date: '',
      time: '',
      location: '',
      latitude: null,
      longitude: null,
      category: page.data.eventCategories[defaultCategoryIndex].name || '',
      description: '',
      organizer: '',
      contact: '',
      max_participants: '',
      cover_image: '',
      images: [],
      status: defaultStatus,
      club_ids: [page.data.clubId],
      tags: '',
      requirements: '',
      registration_deadline: ''
    },
    eventStatusIndex: defaultStatusIndex,
    selectedStatusLabel: page.data.eventStatusOptions[defaultStatusIndex].label,
    selectedCategoryIndex: defaultCategoryIndex,
    tempEventImages: {
      cover_image: '',
      images: []
    }
  });
}

/**
 * 关闭添加活动模态框
 * @param {Object} page - 页面实例
 */
function closeAddEventModal(page) {
  page.setData({
    showAddEventModal: false,
    tempEventImages: {
      cover_image: '',
      images: []
    }
  });
}

/**
 * 社团选择处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onClubGroupChange(page, e) {
  const selectedClubIds = e.detail.value.map(id => parseInt(id));
  console.log('选中的社团IDs:', selectedClubIds);

  // 确保自己的社团始终被选中
  if (!selectedClubIds.includes(page.data.clubId)) {
    selectedClubIds.push(page.data.clubId);
  }

  page.setData({
    'eventForm.club_ids': selectedClubIds
  });
}

/**
 * 活动表单输入处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onEventFormChange(page, e) {
  onFormChange(page, e, 'eventForm');
}

/**
 * 活动状态选择处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onEventStatusChange(page, e) {
  const selectedIndex = e.detail.value;
  const selectedStatus = page.data.eventStatusOptions[selectedIndex];

  page.setData({
    eventStatusIndex: selectedIndex,
    selectedStatusLabel: selectedStatus.label,
    'eventForm.status': selectedStatus.value
  });
}

/**
 * 活动日期选择处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onEventDateChange(page, e) {
  page.setData({
    'eventForm.date': e.detail.value
  });
}

/**
 * 活动时间选择处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onEventTimeChange(page, e) {
  page.setData({
    'eventForm.time': e.detail.value
  });
}

/**
 * 选择封面图片
 * @param {Object} page - 页面实例
 */
async function selectEventCoverImage(page) {
  await selectImage(page, 'eventForm.cover_image', 'tempEventImages.cover_image');
}

/**
 * 选择活动图片
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
async function selectEventImage(page, e) {
  const index = e.currentTarget.dataset.index;
  await selectImage(page, 'eventForm.images', 'tempEventImages.images', {
    index,
    tempArray: 'tempEventImages.images',
    formArray: 'eventForm.images'
  });
}

/**
 * 删除封面图片
 * @param {Object} page - 页面实例
 */
async function deleteEventCoverImage(page) {
  const coverImageUrl = page.data.eventForm.cover_image;

  if (coverImageUrl && isValidImageUrl(coverImageUrl)) {
    showLoading('删除中...');
    try {
      let relativeUrl = coverImageUrl;
      if (coverImageUrl.startsWith('http')) {
        relativeUrl = coverImageUrl.replace('https://api.example.com', '');
      }

      await deleteFile(relativeUrl);
      console.log('服务器封面图片删除成功:', relativeUrl);

      if (page.data.editEventId) {
        await deleteImage('event', page.data.editEventId, coverImageUrl, 'cover_image');
        console.log('数据库封面图片URL删除成功:', coverImageUrl);
      }

      hideLoading();
      showSuccess('删除成功');
    } catch (error) {
      hideLoading();
      console.error('删除封面图片失败:', error);
      showError('删除封面图片失败');
    }
  }

  page.setData({
    'eventForm.cover_image': '',
    'tempEventImages.cover_image': ''
  });
}

/**
 * 删除活动图片
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
async function deleteEventImage(page, e) {
  const index = e.currentTarget.dataset.index;
  const imageUrl = page.data.eventForm.images[index];

  confirmDelete({
    title: '确认删除',
    content: '确定要删除这张图片吗？',
    onConfirm: async () => {
      if (imageUrl && isValidImageUrl(imageUrl)) {
        showLoading('删除中...');
        try {
          let relativeUrl = imageUrl;
          if (imageUrl.startsWith('http')) {
            relativeUrl = imageUrl.replace('https://api.example.com', '');
          }

          await deleteFile(relativeUrl);
          console.log('服务器文件删除成功:', relativeUrl);

          if (page.data.editEventId) {
            await deleteImage('event', page.data.editEventId, imageUrl, 'images');
            console.log('数据库图片URL删除成功:', imageUrl);
          }

          hideLoading();
          showSuccess('删除成功');
        } catch (error) {
          hideLoading();
          console.error('删除图片失败:', error);
          showError('删除图片失败');
        }
      }

      deleteImageFromArray(page, 'eventForm.images', 'tempEventImages.images', index);
    }
  });
}

/**
 * 添加活动图片槽位
 * @param {Object} page - 页面实例
 */
async function addEventImageSlot(page) {
  await addImageSlot(page, 'eventForm.images', 'tempEventImages.images');
}

/**
 * 批量上传所有活动图片
 * @param {Object} page - 页面实例
 * @returns {Promise<Object>} 上传后的图片URL对象
 */
async function uploadAllEventImages(page) {
  const { tempEventImages } = page.data;
  const uploadedUrls = {
    cover_image: '',
    images: []
  };

  try {
    // 上传封面图片
    uploadedUrls.cover_image = await uploadSingleImageField(page, {
      tempField: 'tempEventImages.cover_image',
      formField: 'eventForm.cover_image',
      folder: 'events',
      loadingText: '上传封面...'
    });

    // 上传活动图片
    uploadedUrls.images = await uploadMultipleImageFields(page, {
      tempArray: 'tempEventImages.images',
      formArray: 'eventForm.images',
      folder: 'events',
      loadingText: '上传图片'
    });

    return uploadedUrls;
  } catch (error) {
    console.error('批量上传图片失败:', error);
    throw error;
  }
}

/**
 * 保存活动
 * @description 创建/更新活动，发布新活动时通知社团成员
 * @param {Object} page - 页面实例
 */
async function saveEvent(page) {
  try {
    const { eventForm, tempEventImages, clubId, editEventId } = page.data;

    if (!eventForm.title || !eventForm.date || !eventForm.time || !eventForm.location) {
      showError('请填写必填信息');
      return;
    }

    let clubIds = [...eventForm.club_ids].map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (!clubIds.includes(clubId)) {
      clubIds.push(clubId);
    }

    const uploadedUrls = await uploadAllEventImages(page);

    const existingImages = Array.isArray(eventForm.images) ? eventForm.images : [];
    const mergedImages = mergeImageUrls(existingImages, uploadedUrls.images);

    const processedForm = {
      title: eventForm.title,
      date: eventForm.date,
      time: eventForm.time,
      location: eventForm.location,
      latitude: eventForm.latitude || null,
      longitude: eventForm.longitude || null,
      category: eventForm.category || '',
      description: eventForm.description || '',
      organizer: eventForm.organizer || '',
      contact: eventForm.contact || '',
      max_participants: eventForm.max_participants || '',
      status: eventForm.status || 'draft',
      club_ids: clubIds,
      cover_image: uploadedUrls.cover_image || (isValidImageUrl(eventForm.cover_image) ? eventForm.cover_image : ''),
      images: mergedImages,
      tags: eventForm.tags || '',
      requirements: eventForm.requirements || '',
      registration_deadline: eventForm.registration_deadline || null
    };

    let result;
    if (editEventId) {
      result = await manageEvent('update', editEventId, processedForm, clubId);
    } else {
      result = await manageEvent('create', null, processedForm, clubId);
    }

    if (result && result.success) {
      const message = editEventId ? '活动更新成功' : '活动已提交，等待审核';
      showSuccess(message);
      closeAddEventModal(page);
      await loadEvents(page, clubId);

      // [MODIFY] 创建活动后请求审核结果通知订阅，通知在审核通过后由后端自动发送
      if (!editEventId) {
        requestAuditResultSubscription();
      }

      wx.navigateBack({
        fail: () => {
          wx.switchTab({
            url: '/pages/home/home'
          });
        }
      });
    } else {
      showError(result.message || (editEventId ? '活动更新失败' : '活动添加失败'));
    }
  } catch (error) {
    console.error('保存活动失败:', error);
    // [FIX] 优先展示具体错误信息（如"图片文件已失效"），帮助用户定位问题
    showError(error.message || '活动保存失败');
  }
}

/**
 * 请求审核结果通知订阅
 * @description 创建活动后请求用户订阅审核结果通知，确保能收到审核结果
 */
async function requestAuditResultSubscription() {
  try {
    const templateIds = [TEMPLATE_IDS.AUDIT_RESULT_NOTICE];
    await requestSubscribeMessage(templateIds);
    console.log('已请求审核结果通知订阅');
  } catch (error) {
    console.log('审核结果通知订阅失败或用户拒绝:', error);
  }
}

/**
 * 编辑活动
 * @description 通过API获取完整活动详情并加载到编辑表单，确保所有字段正确加载
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
async function editEvent(page, e) {
  const eventId = e.currentTarget.dataset.id;

  // 显示加载状态
  showLoading('加载中...');

  try {
    // 通过API获取完整的活动详情
    const response = await fetchEventById(eventId);
    hideLoading();

    if (!response || !response.success || !response.data) {
      showError('获取活动详情失败');
      return;
    }

    const event = response.data;

    // 使用公共函数处理图片数组
    const imagesArray = processImagesArray(event.images);

    // 处理社团IDs
    let clubIds = [page.data.clubId];
    if (event.related_clubs && Array.isArray(event.related_clubs) && event.related_clubs.length > 0) {
      clubIds = event.related_clubs.map(club => club.id);
      if (!clubIds.includes(page.data.clubId)) {
        clubIds.push(page.data.clubId);
      }
    }

    // 处理标签数据
    let tagsArray = [];
    if (Array.isArray(event.tags)) {
      tagsArray = event.tags;
    } else if (typeof event.tags === 'string') {
      try {
        tagsArray = JSON.parse(event.tags);
      } catch (e) {
        tagsArray = event.tags ? event.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
      }
    }

    // 处理要求数据
    let requirementsArray = [];
    if (Array.isArray(event.requirements)) {
      requirementsArray = event.requirements;
    } else if (typeof event.requirements === 'string') {
      try {
        requirementsArray = JSON.parse(event.requirements);
      } catch (e) {
        requirementsArray = event.requirements ? event.requirements.split('\n').map(req => req.trim()).filter(req => req) : [];
      }
    }

    const statusIndex = page.data.eventStatusOptions.findIndex(option => option.value === (event.status || 'published'));
    const statusLabel = statusIndex >= 0 ? page.data.eventStatusOptions[statusIndex].label : '已发布';

    const categoryIndex = page.data.eventCategories.findIndex(category => category.name === (event.category || ''));
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

    // 格式化日期
    let eventDate = event.date || '';
    if (eventDate && eventDate.includes('T')) {
      eventDate = eventDate.split('T')[0];
    }

    page.setData({
      showAddEventModal: true,
      editEventId: eventId,
      eventForm: {
        title: event.title || '',
        date: eventDate,
        time: event.time || '',
        location: event.location || '',
        latitude: event.latitude || null,
        longitude: event.longitude || null,
        category: event.category || '',
        description: event.description || '',
        organizer: event.organizer || '',
        contact: event.contact || '',
        max_participants: event.max_participants || '',
        cover_image: event.cover_image || '',
        images: imagesArray,
        club_ids: clubIds,
        status: event.status || 'published',
        tags: Array.isArray(tagsArray) ? tagsArray.join(', ') : (event.tags || ''),
        requirements: Array.isArray(requirementsArray) ? requirementsArray.join('\n') : (event.requirements || ''),
        registration_deadline: registrationDeadline
      },
      eventStatusIndex: statusIndex >= 0 ? statusIndex : 1,
      selectedStatusLabel: statusLabel,
      selectedCategoryIndex: selectedCategoryIndex,
      tempEventImages: {
        cover_image: event.cover_image && event.cover_image.startsWith('http') ? '' : event.cover_image,
        images: []
      }
    });
  } catch (error) {
    hideLoading();
    console.error('获取活动详情失败:', error);
    showError('加载活动详情失败');
  }
}

/**
 * 预览表单中的图片
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function previewFormImage(page, e) {
  const url = e.currentTarget.dataset.url;
  const field = e.currentTarget.dataset.field;

  let urls = [];
  if (field === 'images') {
    urls = page.data.eventForm.images.filter(item => item && item.trim() !== '');
  } else {
    urls = [page.data.eventForm[field]];
  }

  wx.previewImage({
    current: url,
    urls: urls
  });
}

/**
 * 预览活动列表中的图片
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function previewEventListImage(page, e) {
  previewListImage(e);
}

/**
 * 删除活动
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function deleteEvent(page, e) {
  const eventId = e.currentTarget.dataset.id;
  const clubId = page.data.clubId;

  confirmDelete({
    title: '确认删除',
    content: '确定要删除这个活动吗？此操作不可恢复。',
    onConfirm: async () => {
      try {
        const result = await manageEvent('delete', eventId, null, clubId);
        if (result && result.success) {
          showSuccess('删除成功');
          loadEvents(page, clubId);
        } else {
          showError(result.message || '删除失败');
        }
      } catch (error) {
        console.error('删除活动失败:', error);
        showError('删除失败');
      }
    }
  });
}

/**
 * 加载所有社团（用于活动关联其他社团）
 * @param {Object} page - 页面实例
 */
async function loadAllClubs(page) {
  try {
    const result = await fetchClubs({ page: 1, pageSize: 1000 });
    if (result && result.success) {
      page.setData({
        allClubs: result.data
      });
    }
  } catch (error) {
    console.error('获取社团列表失败:', error);
  }
}

/**
 * 打开地图选择位置
 * @param {Object} page - 页面实例
 */
function chooseLocation(page) {
  wx.chooseLocation({
    success: (res) => {
      page.setData({
        'eventForm.location': res.name || res.address,
        'eventForm.latitude': res.latitude,
        'eventForm.longitude': res.longitude
      });
    },
    fail: (err) => {
      console.error('选择位置失败:', err);
      if (err.errMsg !== 'chooseLocation:fail cancel') {
        showError('选择位置失败');
      }
    }
  });
}

/**
 * 清除已选择位置
 * @param {Object} page - 页面实例
 */
function clearLocation(page) {
  page.setData({
    'eventForm.location': '',
    'eventForm.latitude': null,
    'eventForm.longitude': null
  });
}

/**
 * 发送活动通知
 * @description 同时发送通知给已报名用户和社团成员
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
async function sendEventNotify(page, e) {
  const eventId = e.currentTarget.dataset.id;
  const eventTitle = e.currentTarget.dataset.title;
  const eventDate = e.currentTarget.dataset.date;
  const eventTime = e.currentTarget.dataset.time;
  const eventLocation = e.currentTarget.dataset.location;
  const clubId = page.data.clubId;

  wx.showModal({
    title: '发送活动通知',
    content: `确定要发送「${eventTitle}」的活动通知吗？将同时通知已报名用户和社团成员`,
    confirmText: '发送',
    cancelText: '取消',
    success: async (res) => {
      if (res.confirm) {
        wx.showLoading({ title: '发送中...' });
        
        try {
          // 同时发送给已报名用户和社团成员
          const [reminderResult, notificationResult] = await Promise.all([
            sendEventReminderAPI({
              eventId: eventId,
              eventName: eventTitle,
              startTime: `${eventDate} ${eventTime}`,
              location: eventLocation
            }),
            sendNewEventNotification({
              clubId: clubId,
              eventId: eventId,
              eventName: eventTitle,
              startTime: `${eventDate} ${eventTime}`,
              location: eventLocation
            })
          ]);

          wx.hideLoading();

          const totalSuccess = (reminderResult.data?.success || 0) + (notificationResult.data?.success || 0);
          wx.showToast({
            title: `成功发送${totalSuccess}条通知`,
            icon: 'success',
            duration: 2000
          });
        } catch (error) {
          wx.hideLoading();
          console.error('发送活动通知失败:', error);
          wx.showToast({
            title: '发送失败',
            icon: 'none'
          });
        }
      }
    }
  });
}

module.exports = {
  formatEvents,
  loadEvents,
  prevEventPage,
  nextEventPage,
  showAddEventModal,
  closeAddEventModal,
  onClubGroupChange,
  onEventFormChange,
  onEventStatusChange,
  onEventDateChange,
  onEventTimeChange,
  selectEventCoverImage,
  selectEventImage,
  deleteEventCoverImage,
  deleteEventImage,
  addEventImageSlot,
  uploadAllEventImages,
  saveEvent,
  editEvent,
  previewFormImage,
  previewEventListImage,
  deleteEvent,
  loadAllClubs,
  chooseLocation,
  clearLocation,
  sendEventNotify
};
