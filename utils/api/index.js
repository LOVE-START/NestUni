/**
 * API模块主入口
 * @description 统一导出所有API模块，保持与原api.js完全兼容的接口
 */

const core = require('./core');
const auth = require('./auth');
const club = require('./club');
const event = require('./event');
const announcement = require('./announcement');
const comment = require('./comment');
const upload = require('./upload');
const sync = require('./sync');
const recruitment = require('./recruitment');
const badge = require('./badge');
const chat = require('./chat');
const notification = require('./notification');
const approval = require('./approval');

module.exports = {
	request: core.request,
	requestWithUserToken: core.requestWithUserToken,
	
	getUserInfo: core.getUserInfo,
	setUserInfo: core.setUserInfo,
	clearUserInfo: core.clearUserInfo,
	getAdminInfo: core.getAdminInfo,
	setAdminInfo: core.setAdminInfo,
	clearAdminInfo: core.clearAdminInfo,
	checkAuthStatus: auth.checkAuthStatus,
	fetchUserProfile: auth.fetchUserProfile,
	updateUserProfile: auth.updateUserProfile,
	verifyToken: auth.verifyToken,
	
	userLogin: auth.userLogin,
	adminLogin: auth.adminLogin,
	
	clearAdminToken: core.clearAdminToken,
	clearAdminSession: core.clearAdminSession,
	
	fetchClubs: club.fetchClubs,
	fetchMyClubs: club.fetchMyClubs,
	fetchClubById: club.fetchClubById,
	fetchClubAnnouncements: club.fetchClubAnnouncements,
	fetchClubMembers: club.fetchClubMembers,
	fetchClubEvents: club.fetchClubEvents,
	changeClubMemberRole: club.changeClubMemberRole,
	removeClubMember: club.removeClubMember,
	addClubMember: club.addClubMember,
	searchUsersByStudentId: club.searchUsersByStudentId,
	fetchClubMembersAsLeader: club.fetchClubMembersAsLeader,
	addClubMemberAsLeader: club.addClubMemberAsLeader,
	changeClubMemberRoleAsLeader: club.changeClubMemberRoleAsLeader,
	removeClubMemberAsLeader: club.removeClubMemberAsLeader,
	searchUsersByStudentIdAsLeader: club.searchUsersByStudentIdAsLeader,
	manageAnnouncement: announcement.manageAnnouncement,
	
	fetchComments: comment.fetchComments,
	createComment: comment.createComment,
	deleteComment: comment.deleteComment,
	
	fetchEvents: event.fetchEvents,
	fetchMyEvents: event.fetchMyEvents,
	fetchEventById: event.fetchEventById,
	joinEvent: event.joinEvent,
	cancelJoinEvent: event.cancelJoinEvent,
	fetchEventParticipants: event.fetchEventParticipants,
	changeEventParticipantStatus: event.changeEventParticipantStatus,
	removeEventParticipant: event.removeEventParticipant,
	updateEventStatusUnified: event.updateEventStatusUnified,
	
	manageEvent: event.manageEvent,
	
	fetchAnnouncements: announcement.fetchAnnouncements,
	createAnnouncement: announcement.createAnnouncement,
	updateAnnouncement: announcement.updateAnnouncement,
	deleteAnnouncement: announcement.deleteAnnouncement,
	
	updateClub: club.updateClub,
	createClub: club.createClub,
	deleteClub: club.deleteClub,
	getAdminStats: auth.getAdminStats,
	
	manageClub: club.manageClub,
	
	uploadImage: upload.uploadImage,
	uploadMultipleFiles: upload.uploadMultipleFiles,
	deleteFile: upload.deleteFile,
	deleteImage: upload.deleteImage,
	
	getVersions: sync.getVersions,
	getDataVersion: sync.getDataVersion,
	getAnnouncementVersion: sync.getAnnouncementVersion,
	fetchAllClubs: sync.fetchAllClubs,
	fetchAllAnnouncements: sync.fetchAllAnnouncements,
	fetchAllEvents: sync.fetchAllEvents,
	syncAllData: sync.syncAllData,
	
	fetchEventsMap: event.fetchEventsMap,
	fetchNearbyEvents: event.fetchNearbyEvents,
	
	fetchRecruitments: recruitment.fetchRecruitments,
	fetchRecruitmentById: recruitment.fetchRecruitmentById,
	submitApplication: recruitment.submitApplication,
	fetchMyApplications: recruitment.fetchMyApplications,
	fetchApplicationById: recruitment.fetchApplicationById,
	createRecruitment: recruitment.createRecruitment,
	updateRecruitment: recruitment.updateRecruitment,
	deleteRecruitment: recruitment.deleteRecruitment,
	updateRecruitmentStatus: recruitment.updateRecruitmentStatus,
	fetchClubApplications: recruitment.fetchClubApplications,
	updateApplicationStatus: recruitment.updateApplicationStatus,
	
	changeClubMemberStatusAsLeader: club.changeClubMemberStatusAsLeader,
	
	getStatsOverview: club.getStatsOverview,
	getStatsEvents: club.getStatsEvents,
	getStatsMembers: club.getStatsMembers,
	getStatsRecruitments: club.getStatsRecruitments,

	fetchAllBadges: badge.fetchAllBadges,
	fetchMyBadges: badge.fetchMyBadges,
	fetchBadgeDetail: badge.fetchBadgeDetail,
	updateBadgeDisplay: badge.updateBadgeDisplay,
	fetchBadgeStats: badge.fetchBadgeStats,
	fetchUserActivity: badge.fetchUserActivity,
	awardBadge: badge.awardBadge,

	createChatSession: chat.createChatSession,
	fetchChatSessions: chat.fetchChatSessions,
	deleteChatSession: chat.deleteChatSession,
	fetchChatMessages: chat.fetchChatMessages,
	sendChatMessage: chat.sendChatMessage,
	fetchEventsByIds: chat.fetchEventsByIds,
	fetchClubsByIds: chat.fetchClubsByIds,
	fetchBadgesByIds: chat.fetchBadgesByIds,
	confirmAgentAction: chat.confirmAgentAction,
	cancelAgentAction: chat.cancelAgentAction,

	getNotificationTemplates: notification.getNotificationTemplates,
	sendInterviewNotification: notification.sendInterviewNotification,
	sendEventReminder: notification.sendEventReminder,
	sendNewEventNotification: notification.sendNewEventNotification,
	requestSubscribeMessage: notification.requestSubscribeMessage,
	TEMPLATE_IDS: notification.TEMPLATE_IDS,

	fetchPendingApprovals: approval.fetchPendingApprovals,
	fetchApprovalDetail: approval.fetchApprovalDetail,
	approveApproval: approval.approveApproval,
	rejectApproval: approval.rejectApproval,
	fetchMyApprovals: approval.fetchMyApprovals,
	fetchApprovalStats: approval.fetchApprovalStats,
	createAnnouncementAsLeader: approval.createAnnouncementAsLeader,

	recordPageView: auth.recordPageView,
	bindAdminWechat: auth.bindAdminWechat,
	getAdminProfile: auth.getAdminProfile,
	unbindAdminWechat: auth.unbindAdminWechat
};
