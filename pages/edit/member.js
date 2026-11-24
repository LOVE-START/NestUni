/**
 * 成员管理模块
 * @description 处理社团成员的加载、添加、角色更改、移除、状态管理等功能
 */

const {
  fetchClubMembersAsLeader,
  addClubMemberAsLeader,
  changeClubMemberRoleAsLeader,
  removeClubMemberAsLeader,
  searchUsersByStudentIdAsLeader,
  changeClubMemberStatusAsLeader
} = require("../../utils/api/index");

const {
  prevPage,
  nextPage,
  onFormChange,
  confirmDelete,
  showSuccess,
  showError
} = require("./edit-utils.js");

/**
 * 加载社团成员列表
 * @param {Object} page - 页面实例
 * @param {number} clubId - 社团ID
 * @param {number} pageNum - 页码
 */
async function loadClubMembers(page, clubId, pageNum = 1) {
  try {
    const result = await fetchClubMembersAsLeader(clubId, {
      page: pageNum,
      pageSize: page.data.memberPagination.pageSize
    });

    if (result && result.success) {
      page.setData({
        clubMembers: result.data,
        memberPagination: {
          ...page.data.memberPagination,
          ...result.pagination
        }
      });
    }
  } catch (error) {
    console.error('获取社团成员失败:', error);
    showError('获取社团成员失败');
  }
}

/**
 * 成员分页 - 上一页
 * @param {Object} page - 页面实例
 */
function prevMemberPage(page) {
  prevPage(page, 'memberPagination', loadClubMembers);
}

/**
 * 成员分页 - 下一页
 * @param {Object} page - 页面实例
 */
function nextMemberPage(page) {
  nextPage(page, 'memberPagination', loadClubMembers);
}

/**
 * 显示添加成员模态框
 * @param {Object} page - 页面实例
 */
function showAddMemberModal(page) {
  page.setData({
    showAddMemberModal: true,
    memberForm: {
      userId: '',
      role: 'member'
    },
    searchStudentId: '',
    searchResults: [],
    showSearchResults: false,
    selectedUser: null
  });
}

/**
 * 关闭添加成员模态框
 * @param {Object} page - 页面实例
 */
function closeAddMemberModal(page) {
  page.setData({
    showAddMemberModal: false
  });
}

/**
 * 学号输入处理（带防抖）
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onStudentIdInput(page, e) {
  const value = e.detail.value;
  page.setData({
    searchStudentId: value
  });

  // 清除之前的定时器
  if (page.searchTimer) {
    clearTimeout(page.searchTimer);
  }

  // 至少输入2个字符才开始搜索
  if (value.length >= 2) {
    page.searchTimer = setTimeout(() => {
      searchUsers(page, value);
    }, 500);
  } else {
    page.setData({
      searchResults: [],
      showSearchResults: false
    });
  }
}

/**
 * 搜索用户
 * @param {Object} page - 页面实例
 * @param {string} studentId - 学号关键词
 */
async function searchUsers(page, studentId) {
  if (!studentId) return;

  try {
    const result = await searchUsersByStudentIdAsLeader(page.data.clubId, studentId);
    if (result && result.success) {
      page.setData({
        searchResults: result.data,
        showSearchResults: result.data.length > 0
      });
    }
  } catch (error) {
    console.error('搜索用户失败:', error);
    showError('搜索用户失败');
  }
}

/**
 * 选择用户
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function selectUser(page, e) {
  const index = e.currentTarget.dataset.index;
  const user = page.data.searchResults[index];

  page.setData({
    selectedUser: user,
    searchStudentId: user.student_id,
    searchResults: [],
    showSearchResults: false
  });
}

/**
 * 清除用户选择
 * @param {Object} page - 页面实例
 */
function clearUserSelection(page) {
  page.setData({
    selectedUser: null,
    memberForm: {
      userId: '',
      role: 'member'
    }
  });
}

/**
 * 成员表单输入处理
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onMemberFormChange(page, e) {
  onFormChange(page, e, 'memberForm');
}

/**
 * 成员角色选择
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
function onMemberRoleChange(page, e) {
  const roles = ['member', 'leader'];
  const selectedRole = roles[e.detail.value];

  page.setData({
    'memberForm.role': selectedRole
  });
}

/**
 * 添加成员
 * @param {Object} page - 页面实例
 */
async function addMember(page) {
  try {
    const { memberForm, selectedUser } = page.data;

    // 表单验证
    if (!selectedUser) {
      showError('请先搜索并选择用户');
      return;
    }

    const result = await addClubMemberAsLeader(page.data.clubId, selectedUser.id, memberForm.role);

    if (result && result.success) {
      showSuccess('成员添加成功');
      closeAddMemberModal(page);
      loadClubMembers(page, page.data.clubId);
    } else {
      showError(result.message || '添加失败');
    }
  } catch (error) {
    console.error('添加成员失败:', error);
    showError('操作失败');
  }
}

/**
 * 更改成员角色
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
async function changeMemberRole(page, e) {
  const userId = e.currentTarget.dataset.userId;
  const currentRole = e.currentTarget.dataset.currentRole;
  const newRole = currentRole === 'leader' ? 'member' : 'leader';

  confirmDelete({
    title: '确认更改',
    content: `确定要将该成员的角色更改为${newRole === 'leader' ? '团长' : '成员'}吗？`,
    onConfirm: async () => {
      try {
        const result = await changeClubMemberRoleAsLeader(page.data.clubId, userId, newRole);

        if (result && result.success) {
          showSuccess('角色更改成功');
          loadClubMembers(page, page.data.clubId);
        } else {
          showError(result.message || '更改失败');
        }
      } catch (error) {
        console.error('更改成员角色失败:', error);
        showError('操作失败');
      }
    }
  });
}

/**
 * 移除成员
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
async function removeMember(page, e) {
  const userId = e.currentTarget.dataset.userId;

  confirmDelete({
    title: '确认移除',
    content: '确定要将该成员从社团中移除吗？',
    onConfirm: async () => {
      try {
        const result = await removeClubMemberAsLeader(page.data.clubId, userId);

        if (result && result.success) {
          showSuccess('成员移除成功');
          loadClubMembers(page, page.data.clubId);
        } else {
          showError(result.message || '移除失败');
        }
      } catch (error) {
        console.error('移除成员失败:', error);
        showError('操作失败');
      }
    }
  });
}

/**
 * 切换成员状态（毕业/在任）
 * @description 换届系统核心功能，标记成员是否已毕业
 * @param {Object} page - 页面实例
 * @param {Object} e - 事件对象
 */
async function toggleMemberStatus(page, e) {
  const userId = e.currentTarget.dataset.userId;
  const currentStatus = e.currentTarget.dataset.currentStatus;
  const newStatus = currentStatus === 'active' ? 'graduated' : 'active';
  const statusText = newStatus === 'graduated' ? '毕业' : '在任';

  confirmDelete({
    title: '确认状态变更',
    content: `确定要将该成员标记为${statusText}吗？${newStatus === 'graduated' ? '毕业成员将不再计入社团人数。' : ''}`,
    onConfirm: async () => {
      try {
        const result = await changeClubMemberStatusAsLeader(page.data.clubId, userId, newStatus);

        if (result && result.success) {
          showSuccess(result.message || `已标记为${statusText}成员`);
          loadClubMembers(page, page.data.clubId);
        } else {
          showError(result.message || '状态更新失败');
        }
      } catch (error) {
        console.error('更改成员状态失败:', error);
        showError('操作失败');
      }
    }
  });
}

module.exports = {
  loadClubMembers,
  prevMemberPage,
  nextMemberPage,
  showAddMemberModal,
  closeAddMemberModal,
  onStudentIdInput,
  searchUsers,
  selectUser,
  clearUserSelection,
  onMemberFormChange,
  onMemberRoleChange,
  addMember,
  changeMemberRole,
  removeMember,
  toggleMemberStatus
};
