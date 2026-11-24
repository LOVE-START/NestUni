/**
 * 公告管理模块
 * @description 处理公告的加载、创建、编辑、删除等功能
 */

const {
  fetchClubAnnouncements,
  manageAnnouncement,
  deleteFile,
  deleteImage,
  requestSubscribeMessage,
  TEMPLATE_IDS
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
  uploadMultipleImageFields,
  processImagesArray,
  previewListImage,
  showSuccess,
  showError,
  showLoading,
  hideLoading,
  isValidImageUrl,
  mergeImageUrls,
  formatListDates
} = require("./edit-utils.js");

/**
 * 加载公告列表
 * @param {Object} page - 页面实例
 * @param {number} clubId - 社团ID
 * @param {number} pageNum - 页码
 */
async function loadAnnouncements(page, clubId, pageNum = 1) {
  try {
    const result = await fetchClubAnnouncements(clubId, {
      page: pageNum,
      pageSize: page.data.announcementPagination.pageSize
    });

    if (result && result.success) {
      const formattedAnnouncements = formatListDates(result.data, ['created_at', 'updated_at']);
      const announcementsWithStatus = formattedAnnouncements.map(announcement => ({
        ...announcement,
        approval_status_label: getApprovalStatusText(announcement.approval_status),
        reject_reason: announcement.reject_reason || ''
      }));

      page.setData({
        announcements: announcementsWithStatus,
        announcementPagination: {
          ...page.data.announcementPagination,
          ...result.pagination
        }
      });
    }
  } catch (error) {
    console.error('获取公告列表失败:', error);
    showError('获取公告列表失败');
  }
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
 * 公告分页 - 上一页
 * @param {Object} page - 页面实例
 */
function prevAnnouncementPage(page) {
  prevPage(page, 'announcementPagination', loadAnnouncements);
}

/**
 * 公告分页 - 下一页
 * @param {Object} page - 页面实例
 */
function nextAnnouncementPage(page) {
  nextPage(page, 'announcementPagination', loadAnnouncements);
}

/**
 * 显示添加公告模态框
 * @param {Object} page - 页面实例
 */
function showAddAnnouncementModal(page) {
  page.setData({
    showAddAnnouncementModal: true,
    editAnnouncementId: null,
    announcementForm: {
      title: '',
      content: '',
      images: []
    },
    tempAnnouncementImages: {
      images: []
    }
  });
}

/**
 * 关闭添加公告模态框
 * @param {Object} page - 页面实例
 */
function closeAddAnnouncementModal(page) {
  page.setData({
    showAddAnnouncementModal: false,
    tempAnnouncementImages: {
      images: []
    }
  });
}

/**
 * 公告表单输入处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onAnnouncementFormChange(page, e) {
  onFormChange(page, e, 'announcementForm');
}

/**
 * 选择公告图片
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
async function selectAnnouncementImage(page, e) {
  const index = e.currentTarget.dataset.index;
  await selectImage(page, 'announcementForm.images', 'tempAnnouncementImages.images', {
    index,
    tempArray: 'tempAnnouncementImages.images',
    formArray: 'announcementForm.images'
  });
}

/**
 * 删除公告图片
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
async function deleteAnnouncementImage(page, e) {
  const index = e.currentTarget.dataset.index;
  const imageUrl = page.data.announcementForm.images[index];

  confirmDelete({
    title: '确认删除',
    content: '确定要删除这张图片吗？',
    onConfirm: async () => {
      // 如果是服务器上的图片URL，删除服务器文件和数据库记录
      if (imageUrl && isValidImageUrl(imageUrl)) {
        showLoading('删除中...');
        try {
          let relativeUrl = imageUrl;
          if (imageUrl.startsWith('http')) {
            relativeUrl = imageUrl.replace('https://api.example.com', '');
          }

          await deleteFile(relativeUrl);
          console.log('服务器文件删除成功:', relativeUrl);

          if (page.data.editAnnouncementId) {
            await deleteImage('announcement', page.data.editAnnouncementId, imageUrl, 'images');
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

      // 更新UI
      deleteImageFromArray(page, 'announcementForm.images', 'tempAnnouncementImages.images', index);
    }
  });
}

/**
 * 添加公告图片槽位
 * @param {Object} page - 页面实例
 */
async function addAnnouncementImageSlot(page) {
  await addImageSlot(page, 'announcementForm.images', 'tempAnnouncementImages.images');
}

/**
 * 移除公告图片槽位
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function removeAnnouncementImageSlot(page, e) {
  removeImageSlot(page, e, 'announcementForm.images', 'tempAnnouncementImages.images');
}

/**
 * 批量上传所有公告图片
 * @param {Object} page - 页面实例
 * @returns {Promise<Object>} 上传后的图片URL对象
 */
async function uploadAllAnnouncementImages(page) {
  const { tempAnnouncementImages } = page.data;

  if (!tempAnnouncementImages.images || tempAnnouncementImages.images.length === 0) {
    return { images: [] };
  }

  const localImages = tempAnnouncementImages.images.filter(img => img && img.startsWith('wxfile://') || img && img.startsWith('http://tmp/') || img && img.startsWith('wx'));

  if (localImages.length === 0) {
    return { images: [] };
  }

  try {
    const uploadedUrls = await uploadMultipleImageFields(page, {
      tempArray: 'tempAnnouncementImages.images',
      formArray: 'announcementForm.images',
      folder: 'announcements',
      loadingText: '上传图片'
    });
    return { images: uploadedUrls };
  } catch (error) {
    console.error('批量上传图片失败:', error);
    throw error;
  }
}

/**
 * 保存公告
 * @param {Object} page - 页面实例
 */
async function saveAnnouncement(page) {
  try {
    const { editAnnouncementId, announcementForm, tempAnnouncementImages, clubId } = page.data;

    if (!announcementForm.title || !announcementForm.content) {
      showError('请填写标题和内容');
      return;
    }

    console.log('开始上传图片，临时图片数据:', tempAnnouncementImages);

    const uploadedUrls = await uploadAllAnnouncementImages(page);

    console.log('图片上传完成，上传结果:', uploadedUrls);

    const existingImages = Array.isArray(announcementForm.images) ? announcementForm.images : [];
    const newImages = uploadedUrls.images || [];

    const mergedImages = mergeImageUrls(existingImages, newImages);

    const processedForm = {
      title: announcementForm.title,
      content: announcementForm.content,
      images: mergedImages
    };

    console.log('最终处理的图片URL列表:', processedForm.images);

    let result;
    if (editAnnouncementId) {
      result = await manageAnnouncement('update', processedForm, clubId, editAnnouncementId);
    } else {
      result = await manageAnnouncement('create', processedForm, clubId);
    }

    if (result && result.success) {
      const message = editAnnouncementId ? '更新成功' : '公告已提交，等待审核';
      showSuccess(message);
      closeAddAnnouncementModal(page);
      await loadAnnouncements(page, clubId);

      if (!editAnnouncementId) {
        requestAuditResultSubscription();
      }
    } else {
      showError(result.message || (editAnnouncementId ? '更新失败' : '添加失败'));
    }
  } catch (error) {
    console.error('保存公告失败:', error);
    // [FIX] 优先展示具体错误信息（如"图片文件已失效"），帮助用户定位问题
    showError(error.message || '操作失败');
  }
}

/**
 * 请求审核结果通知订阅
 * @description 创建公告后请求用户订阅审核结果通知，确保能收到审核结果
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
 * 编辑公告
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function editAnnouncement(page, e) {
  const announcementId = e.currentTarget.dataset.id;
  const announcement = page.data.announcements.find(item => item.id == announcementId);

  if (announcement) {
    // 使用公共函数处理图片数组
    const imagesArray = processImagesArray(announcement.images);

    page.setData({
      showAddAnnouncementModal: true,
      editAnnouncementId: announcementId,
      announcementForm: {
        title: announcement.title,
        content: announcement.content,
        images: imagesArray
      },
      tempAnnouncementImages: {
        images: []
      }
    });
  }
}

/**
 * 删除公告
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function deleteAnnouncement(page, e) {
  const announcementId = e.currentTarget.dataset.id;
  const clubId = page.data.clubId;

  confirmDelete({
    title: '确认删除',
    content: '确定要删除这个公告吗？此操作不可恢复。',
    onConfirm: async () => {
      try {
        const result = await manageAnnouncement('delete', null, clubId, announcementId);
        if (result && result.success) {
          showSuccess('删除成功');
          loadAnnouncements(page, clubId);
        } else {
          showError(result.message || '删除失败');
        }
      } catch (error) {
        console.error('删除公告失败:', error);
        showError('删除失败');
      }
    }
  });
}

/**
 * 预览表单中的图片
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function previewFormImage(page, e) {
  const url = e.currentTarget.dataset.url;
  const existingImages = page.data.announcementForm.images || [];
  const tempImages = page.data.tempAnnouncementImages.images || [];

  const allUrls = [...existingImages, ...tempImages].filter(item => item && item.trim() !== '');

  wx.previewImage({
    current: url,
    urls: allUrls
  });
}

/**
 * 预览公告列表中的图片
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function previewAnnouncementListImage(page, e) {
  previewListImage(e);
}

module.exports = {
  loadAnnouncements,
  prevAnnouncementPage,
  nextAnnouncementPage,
  showAddAnnouncementModal,
  closeAddAnnouncementModal,
  onAnnouncementFormChange,
  selectAnnouncementImage,
  deleteAnnouncementImage,
  addImageSlot: addAnnouncementImageSlot,
  removeImageSlot: removeAnnouncementImageSlot,
  uploadAllAnnouncementImages,
  saveAnnouncement,
  editAnnouncement,
  deleteAnnouncement,
  previewFormImage,
  previewAnnouncementListImage
};
