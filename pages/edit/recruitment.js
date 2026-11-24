/**
 * 招新管理模块
 * @description 处理招新信息的创建、编辑、删除等功能
 */

const {
  createRecruitment,
  updateRecruitment,
  deleteRecruitment,
  fetchRecruitments
} = require("../../utils/api/index");

const {
  prevPage,
  nextPage,
  onFormChange,
  confirmDelete,
  selectImage,
  deleteImage,
  uploadSingleImageField,
  showSuccess,
  showError,
  showLoading,
  hideLoading,
  getStatusText,
  getStatusClass,
  formatEventDate
} = require("./edit-utils.js");

/**
 * 加载社团的招新列表
 * @param {Object} page - 页面实例
 * @param {number} clubId - 社团ID
 * @param {number} pageNum - 页码
 */
async function loadRecruitments(page, clubId, pageNum = 1) {
  try {
    const result = await fetchRecruitments({
      clubId: clubId,
      page: pageNum,
      pageSize: 10,
      status: 'all'
    });

    if (result && result.success) {
      const processedRecruitments = result.data.map(item => ({
        ...item,
        statusText: getStatusText(item.status, 'recruitment'),
        statusClass: getStatusClass(item.status),
        start_time: formatEventDate(item.start_time),
        end_time: formatEventDate(item.end_time)
      }));

      page.setData({
        recruitments: processedRecruitments,
        recruitmentPagination: {
          ...page.data.recruitmentPagination,
          ...result.pagination
        }
      });
    }
  } catch (error) {
    console.error('加载招新列表失败:', error);
    showError('加载招新列表失败');
  }
}

/**
 * 招新分页 - 上一页
 * @param {Object} page - 页面实例
 */
function prevRecruitmentPage(page) {
  prevPage(page, 'recruitmentPagination', loadRecruitments);
}

/**
 * 招新分页 - 下一页
 * @param {Object} page - 页面实例
 */
function nextRecruitmentPage(page) {
  nextPage(page, 'recruitmentPagination', loadRecruitments);
}

/**
 * 显示添加招新模态框
 * @param {Object} page - 页面实例
 */
function showAddRecruitmentModal(page) {
  page.setData({
    showAddRecruitmentModal: true,
    editRecruitmentId: null,
    recruitmentForm: {
      title: '',
      description: '',
      cover_image: '',
      poster: '',
      qr_code: '',
      requirements: [''],
      status: 'published',
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
    tempRecruitmentImages: {
      cover_image: '',
      poster: '',
      qr_code: ''
    }
  });
}

/**
 * 关闭添加招新模态框
 * @param {Object} page - 页面实例
 */
function closeAddRecruitmentModal(page) {
  page.setData({
    showAddRecruitmentModal: false
  });
}

/**
 * 招新开始日期选择处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onStartTimeChange(page, e) {
  page.setData({
    'recruitmentForm.start_time': e.detail.value
  });
}

/**
 * 招新截止日期选择处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onEndTimeChange(page, e) {
  page.setData({
    'recruitmentForm.end_time': e.detail.value
  });
}

/**
 * 招新表单输入处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onRecruitmentFormChange(page, e) {
  onFormChange(page, e, 'recruitmentForm');
}

/**
 * 面试信息输入处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onInterviewInfoChange(page, e) {
  const field = e.currentTarget.dataset.field;
  const value = e.detail.value;

  page.setData({
    [`recruitmentForm.interview_info.${field}`]: value
  });
}

/**
 * 面试类型选择处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onInterviewTypeChange(page, e) {
  const types = ['offline', 'online'];
  const selectedType = types[e.detail.value];

  page.setData({
    'recruitmentForm.interview_info.type': selectedType
  });
}

/**
 * 添加要求项
 * @param {Object} page - 页面实例
 */
function addRequirement(page) {
  const requirements = [...page.data.recruitmentForm.requirements];
  requirements.push('');
  page.setData({
    'recruitmentForm.requirements': requirements
  });
}

/**
 * 移除要求项
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function removeRequirement(page, e) {
  const index = e.currentTarget.dataset.index;
  const requirements = [...page.data.recruitmentForm.requirements];

  if (requirements.length > 1) {
    requirements.splice(index, 1);
  } else {
    requirements[index] = '';
  }

  page.setData({
    'recruitmentForm.requirements': requirements
  });
}

/**
 * 要求项输入处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onRequirementChange(page, e) {
  const index = e.currentTarget.dataset.index;
  const value = e.detail.value;
  const requirements = [...page.data.recruitmentForm.requirements];
  requirements[index] = value;

  page.setData({
    'recruitmentForm.requirements': requirements
  });
}

/**
 * 选择招新封面图片
 * @param {Object} page - 页面实例
 */
async function selectRecruitmentCoverImage(page) {
  await selectImage(page, 'recruitmentForm.cover_image', 'tempRecruitmentImages.cover_image');
}

/**
 * 删除招新封面图片
 * @param {Object} page - 页面实例
 */
function deleteRecruitmentCoverImage(page) {
  deleteImage(page, 'recruitmentForm.cover_image', 'tempRecruitmentImages.cover_image');
}

/**
 * 选择招新海报图片
 * @param {Object} page - 页面实例
 */
async function selectRecruitmentPoster(page) {
  await selectImage(page, 'recruitmentForm.poster', 'tempRecruitmentImages.poster');
}

/**
 * 删除招新海报图片
 * @param {Object} page - 页面实例
 */
function deleteRecruitmentPoster(page) {
  deleteImage(page, 'recruitmentForm.poster', 'tempRecruitmentImages.poster');
}

/**
 * 选择招新群二维码图片
 * @param {Object} page - 页面实例
 */
async function selectRecruitmentQrCode(page) {
  await selectImage(page, 'recruitmentForm.qr_code', 'tempRecruitmentImages.qr_code');
}

/**
 * 删除招新群二维码图片
 * @param {Object} page - 页面实例
 */
function deleteRecruitmentQrCode(page) {
  deleteImage(page, 'recruitmentForm.qr_code', 'tempRecruitmentImages.qr_code');
}

/**
 * 上传招新图片
 * @param {Object} page - 页面实例
 * @returns {Promise<Object>} 上传后的图片URL对象
 */
async function uploadRecruitmentImages(page) {
  const { tempRecruitmentImages, recruitmentForm } = page.data;
  const uploadedUrls = {
    cover_image: '',
    poster: '',
    qr_code: ''
  };

  try {
    // 上传封面图片
    uploadedUrls.cover_image = await uploadSingleImageField(page, {
      tempField: 'tempRecruitmentImages.cover_image',
      formField: 'recruitmentForm.cover_image',
      folder: 'recruitments',
      loadingText: '上传封面...'
    });

    // 上传海报
    uploadedUrls.poster = await uploadSingleImageField(page, {
      tempField: 'tempRecruitmentImages.poster',
      formField: 'recruitmentForm.poster',
      folder: 'recruitments',
      loadingText: '上传海报...'
    });

    // 上传二维码
    uploadedUrls.qr_code = await uploadSingleImageField(page, {
      tempField: 'tempRecruitmentImages.qr_code',
      formField: 'recruitmentForm.qr_code',
      folder: 'recruitments',
      loadingText: '上传二维码...'
    });

    return uploadedUrls;
  } catch (error) {
    console.error('上传图片失败:', error);
    throw error;
  }
}

/**
 * 保存招新信息
 * @param {Object} page - 页面实例
 */
async function saveRecruitment(page) {
  const { recruitmentForm, editRecruitmentId, clubId } = page.data;

  if (!recruitmentForm.title) {
    showError('请输入招新标题');
    return;
  }

  showLoading('保存中...');

  try {
    const uploadedUrls = await uploadRecruitmentImages(page);

    const requirements = recruitmentForm.requirements.filter(r => r && r.trim() !== '');

    const formData = {
      title: recruitmentForm.title,
      description: recruitmentForm.description || '',
      cover_image: uploadedUrls.cover_image,
      poster: uploadedUrls.poster,
      qr_code: uploadedUrls.qr_code,
      requirements: requirements.length > 0 ? requirements : null,
      status: recruitmentForm.status,
      start_time: recruitmentForm.start_time || null,
      end_time: recruitmentForm.end_time || null,
      max_applicants: recruitmentForm.max_applicants ? parseInt(recruitmentForm.max_applicants) : null,
      interview_info: recruitmentForm.interview_info,
      contact_info: recruitmentForm.contact_info || ''
    };

    let result;
    if (editRecruitmentId) {
      result = await updateRecruitment(editRecruitmentId, clubId, formData);
    } else {
      result = await createRecruitment(clubId, formData);
    }

    hideLoading();

    if (result && result.success) {
      showSuccess(editRecruitmentId ? '更新成功' : '添加成功');
      closeAddRecruitmentModal(page);
      loadRecruitments(page, clubId);
    } else {
      showError(result.message || '保存失败');
    }
  } catch (error) {
    console.error('保存招新信息失败:', error);
    hideLoading();
    showError('保存失败');
  }
}

/**
 * 编辑招新信息
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function editRecruitment(page, e) {
  const id = e.currentTarget.dataset.id;
  const recruitment = page.data.recruitments.find(item => item.id === id);

  if (!recruitment) {
    showError('招新信息不存在');
    return;
  }

  const requirements = recruitment.requirements && recruitment.requirements.length > 0
    ? recruitment.requirements
    : [''];

  const interviewInfo = recruitment.interview_info || {
    type: 'offline',
    location: '',
    contact: '',
    notes: ''
  };

  page.setData({
    showAddRecruitmentModal: true,
    editRecruitmentId: id,
    recruitmentForm: {
      title: recruitment.title,
      description: recruitment.description || '',
      cover_image: recruitment.cover_image || '',
      poster: recruitment.poster || '',
      qr_code: recruitment.qr_code || '',
      requirements: requirements,
      status: 'published',
      start_time: recruitment.start_time ? recruitment.start_time.split(' ')[0] : '',
      end_time: recruitment.end_time ? recruitment.end_time.split(' ')[0] : '',
      max_applicants: recruitment.max_applicants ? String(recruitment.max_applicants) : '',
      interview_info: interviewInfo,
      contact_info: recruitment.contact_info || ''
    },
    tempRecruitmentImages: {
      cover_image: '',
      poster: '',
      qr_code: ''
    }
  });
}

/**
 * 删除招新信息
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function deleteRecruitmentConfirm(page, e) {
  const id = e.currentTarget.dataset.id;

  confirmDelete({
    title: '确认删除',
    content: '确定要删除这条招新信息吗？删除后无法恢复。',
    onConfirm: async () => {
      try {
        const result = await deleteRecruitment(id, page.data.clubId);

        if (result && result.success) {
          showSuccess('删除成功');
          loadRecruitments(page, page.data.clubId);
        } else {
          showError(result.message || '删除失败');
        }
      } catch (error) {
        console.error('删除招新信息失败:', error);
        showError('删除失败');
      }
    }
  });
}

/**
 * 预览招新列表中的图片
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function previewRecruitmentListImage(page, e) {
  const url = e.currentTarget.dataset.url;

  wx.previewImage({
    current: url,
    urls: [url]
  });
}

module.exports = {
  loadRecruitments,
  showAddRecruitmentModal,
  closeAddRecruitmentModal,
  prevRecruitmentPage,
  nextRecruitmentPage,
  onStartTimeChange,
  onEndTimeChange,
  onRecruitmentFormChange,
  onInterviewInfoChange,
  onInterviewTypeChange,
  addRequirement,
  removeRequirement,
  onRequirementChange,
  selectRecruitmentCoverImage,
  deleteRecruitmentCoverImage,
  selectRecruitmentPoster,
  deleteRecruitmentPoster,
  selectRecruitmentQrCode,
  deleteRecruitmentQrCode,
  saveRecruitment,
  editRecruitment,
  deleteRecruitment: deleteRecruitmentConfirm,
  previewRecruitmentListImage
};
