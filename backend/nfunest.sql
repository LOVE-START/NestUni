-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- 主机： localhost
-- 生成日期： 2026-08-26 21:45:08
-- 服务器版本： 5.7.44-log
-- PHP 版本： 8.0.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- 数据库： `nfunest`
--

-- --------------------------------------------------------

--
-- 表的结构 `admins`
--

CREATE TABLE `admins` (
  `id` int(11) NOT NULL COMMENT '管理员ID',
  `username` varchar(50) NOT NULL COMMENT '管理员登录账号',
  `password` varchar(255) NOT NULL COMMENT '密码',
  `level` enum('super','moderator','teacher') DEFAULT 'super' COMMENT '权限等级：super=超级管理员, moderator=普通管理员, teacher=教师',
  `openid` varchar(100) DEFAULT NULL COMMENT '微信openid',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表';

-- --------------------------------------------------------

--
-- 表的结构 `agent_tool_logs`
--

CREATE TABLE `agent_tool_logs` (
  `id` int(11) NOT NULL COMMENT '自增ID',
  `session_id` int(11) DEFAULT NULL COMMENT '聊天会话ID',
  `actor_id` int(11) NOT NULL COMMENT '操作者ID(users.id或admins.id)',
  `actor_type` enum('user','admin') NOT NULL DEFAULT 'user' COMMENT '操作者身份类型',
  `tool_name` varchar(64) NOT NULL COMMENT '工具名称',
  `arguments` json DEFAULT NULL COMMENT '工具参数(模型提取)',
  `status` enum('pending_confirm','executing','success','failed','denied','cancelled') NOT NULL COMMENT '调用状态(pending_confirm=待确认 executing=已抢占执行中 success/failed=执行结果 denied=权限拒绝 cancelled=用户取消或令牌过期)',
  `error_message` varchar(500) DEFAULT NULL COMMENT '失败/拒绝原因',
  `duration_ms` int(11) DEFAULT NULL COMMENT '执行耗时(毫秒)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '调用时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent工具调用审计日志';

-- --------------------------------------------------------

--
-- 表的结构 `announcements`
--

CREATE TABLE `announcements` (
  `id` int(11) NOT NULL COMMENT '公告ID',
  `title` varchar(200) NOT NULL COMMENT '公告标题',
  `content` text NOT NULL COMMENT '公告内容',
  `images` json DEFAULT NULL COMMENT '图片列表(JSON数组，存放图片URL)',
  `club_id` int(11) DEFAULT NULL COMMENT '所属社团（可空表示全局）',
  `approval_status` enum('pending','approved','rejected') DEFAULT 'approved' COMMENT '审核状态：pending=待审核, approved=已通过, rejected=已拒绝',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公告表';

-- --------------------------------------------------------

--
-- 表的结构 `applications`
--

CREATE TABLE `applications` (
  `id` int(11) NOT NULL COMMENT '报名ID',
  `recruitment_id` int(11) NOT NULL COMMENT '招新ID',
  `user_id` int(11) NOT NULL COMMENT '申请人ID',
  `form_data` json DEFAULT NULL COMMENT '表单数据(JSON)',
  `status` enum('submitted','viewed','interviewing','accepted','rejected') DEFAULT 'submitted' COMMENT '申请状态',
  `submitted_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  `viewed_at` datetime DEFAULT NULL COMMENT '查看时间',
  `interview_time` datetime DEFAULT NULL COMMENT '面试时间',
  `interview_location` varchar(200) DEFAULT NULL COMMENT '面试地点',
  `interview_type` enum('offline','online') DEFAULT 'offline' COMMENT '面试形式',
  `interview_contact` varchar(100) DEFAULT NULL COMMENT '面试联系人',
  `interview_notes` text COMMENT '面试备注',
  `result_notes` text COMMENT '结果备注',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报名申请表';

-- --------------------------------------------------------

--
-- 表的结构 `application_logs`
--

CREATE TABLE `application_logs` (
  `id` int(11) NOT NULL COMMENT '日志ID',
  `application_id` int(11) NOT NULL COMMENT '报名ID',
  `operator_id` int(11) NOT NULL COMMENT '操作人ID',
  `operator_name` varchar(50) DEFAULT NULL COMMENT '操作人姓名',
  `operator_role` varchar(20) DEFAULT NULL COMMENT '操作人角色(leader/admin)',
  `action` varchar(50) NOT NULL COMMENT '操作类型',
  `old_status` varchar(20) DEFAULT NULL COMMENT '原状态',
  `new_status` varchar(20) DEFAULT NULL COMMENT '新状态',
  `remark` text COMMENT '操作备注',
  `extra_data` json DEFAULT NULL COMMENT '额外数据(面试信息等)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报名操作日志表';

-- --------------------------------------------------------

--
-- 表的结构 `approvals`
--

CREATE TABLE `approvals` (
  `id` int(11) NOT NULL COMMENT '审核ID',
  `target_type` enum('event','announcement','club') NOT NULL COMMENT '审核对象类型',
  `target_id` int(11) NOT NULL COMMENT '审核对象ID',
  `club_id` int(11) DEFAULT NULL COMMENT '所属社团ID',
  `applicant_id` int(11) NOT NULL COMMENT '申请人ID（会长）',
  `approver_id` int(11) DEFAULT NULL COMMENT '审核人ID（管理员/老师）',
  `status` enum('pending','approved','rejected') DEFAULT 'pending' COMMENT '审核状态',
  `reject_reason` text COMMENT '拒绝原因',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  `approved_at` datetime DEFAULT NULL COMMENT '审核时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审核记录表';

-- --------------------------------------------------------

--
-- 表的结构 `badges`
--

CREATE TABLE `badges` (
  `id` int(11) NOT NULL COMMENT '羽章ID',
  `code` varchar(50) NOT NULL COMMENT '羽章代码（唯一标识）',
  `name` varchar(100) NOT NULL COMMENT '羽章名称',
  `description` text COMMENT '羽章描述',
  `icon` varchar(255) DEFAULT NULL COMMENT '羽章图标URL',
  `type` enum('achievement','level','identity') NOT NULL COMMENT '羽章类型',
  `rarity` enum('common','rare','epic','legendary') DEFAULT 'common' COMMENT '稀有度',
  `category` varchar(50) DEFAULT NULL COMMENT '羽章分类',
  `trigger_type` varchar(50) DEFAULT NULL COMMENT '触发类型',
  `trigger_condition` json DEFAULT NULL COMMENT '触发条件',
  `points` int(11) DEFAULT '0' COMMENT '羽章积分值',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序权重',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='羽章定义表';

-- --------------------------------------------------------

--
-- 表的结构 `badge_logs`
--

CREATE TABLE `badge_logs` (
  `id` int(11) NOT NULL COMMENT '日志ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `badge_id` int(11) NOT NULL COMMENT '羽章ID',
  `action` enum('earned','upgraded','downgraded','lost') NOT NULL COMMENT '动作类型',
  `old_value` json DEFAULT NULL COMMENT '旧值',
  `new_value` json DEFAULT NULL COMMENT '新值',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='羽章获取日志表';

-- --------------------------------------------------------

--
-- 表的结构 `chat_messages`
--

CREATE TABLE `chat_messages` (
  `id` int(11) NOT NULL COMMENT '消息ID',
  `session_id` int(11) NOT NULL COMMENT '会话ID',
  `role` enum('user','assistant','system') NOT NULL COMMENT '消息角色',
  `content` text NOT NULL COMMENT '消息内容',
  `metadata` json DEFAULT NULL COMMENT '元数据(检索的数据源等)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI聊天消息表';

-- --------------------------------------------------------

--
-- 表的结构 `chat_sessions`
--

CREATE TABLE `chat_sessions` (
  `id` int(11) NOT NULL COMMENT '会话ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `title` varchar(100) DEFAULT '新对话' COMMENT '会话标题',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `owner_type` enum('user','admin') NOT NULL DEFAULT 'user' COMMENT '会话归属身份(user=学生/admin=管理员)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI聊天会话表';

-- --------------------------------------------------------

--
-- 表的结构 `clubs`
--

CREATE TABLE `clubs` (
  `id` int(11) NOT NULL COMMENT '社团ID',
  `name` varchar(100) NOT NULL COMMENT '社团名称',
  `short_intro` varchar(255) DEFAULT NULL COMMENT '简短介绍（用于列表显示）',
  `description` text COMMENT '社团详细介绍',
  `category` varchar(50) DEFAULT '未分类' COMMENT '社团分类',
  `level` enum('school','college') DEFAULT 'college' COMMENT '社团级别（school=学校级，college=学院级）',
  `logo` varchar(255) DEFAULT NULL COMMENT '社团Logo',
  `cover_image` varchar(255) DEFAULT NULL COMMENT '社团封面图',
  `gallery` text COMMENT '社团相册（JSON数组存多张图片URL）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='社团表';

-- --------------------------------------------------------

--
-- 表的结构 `club_members`
--

CREATE TABLE `club_members` (
  `club_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `role` enum('member','leader') DEFAULT 'member' COMMENT '社团内角色',
  `status` enum('active','graduated') DEFAULT 'active' COMMENT '成员状态（active=在任, graduated=已毕业）',
  `graduated_at` datetime DEFAULT NULL COMMENT '毕业标记时间',
  `joined_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='社团成员表（用户-社团多对多）';

-- --------------------------------------------------------

--
-- 表的结构 `comments`
--

CREATE TABLE `comments` (
  `id` int(11) NOT NULL COMMENT '评论ID',
  `user_id` int(11) NOT NULL COMMENT '评论者',
  `content` text NOT NULL COMMENT '评论内容',
  `target_type` enum('event','announcement','club') NOT NULL COMMENT '评论目标类型',
  `target_id` int(11) NOT NULL COMMENT '目标对象ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评论表';

-- --------------------------------------------------------

--
-- 表的结构 `events`
--

CREATE TABLE `events` (
  `id` int(11) NOT NULL COMMENT '活动ID',
  `title` varchar(200) NOT NULL COMMENT '活动标题',
  `date` date DEFAULT NULL COMMENT '活动日期',
  `time` varchar(50) DEFAULT NULL COMMENT '活动时间段',
  `location` varchar(200) DEFAULT NULL COMMENT '活动地点',
  `latitude` decimal(10,7) DEFAULT NULL COMMENT '活动地点纬度',
  `longitude` decimal(10,7) DEFAULT NULL COMMENT '活动地点经度',
  `location_name` varchar(200) DEFAULT NULL COMMENT '活动地点名称（用于地图显示）',
  `cover_image` varchar(255) DEFAULT NULL COMMENT '封面图',
  `images` text COMMENT '活动图片JSON数组',
  `category` varchar(50) DEFAULT NULL COMMENT '活动类型/分类',
  `status` enum('draft','published','completed','cancelled') DEFAULT 'draft' COMMENT '状态',
  `approval_status` enum('pending','approved','rejected') DEFAULT 'approved' COMMENT '审核状态：pending=待审核, approved=已通过, rejected=已拒绝',
  `max_participants` int(11) DEFAULT NULL COMMENT '最大报名人数',
  `current_participants` int(11) DEFAULT '0' COMMENT '当前报名人数',
  `registration_deadline` datetime DEFAULT NULL COMMENT '报名截止时间',
  `description` text COMMENT '活动描述',
  `organizer` varchar(100) DEFAULT NULL COMMENT '主办方名称（展示用）',
  `contact` varchar(100) DEFAULT NULL COMMENT '联系方式',
  `tags` varchar(255) DEFAULT NULL COMMENT '标签（逗号分隔）',
  `requirements` text COMMENT '报名要求',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者（用户ID）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动表';

-- --------------------------------------------------------

--
-- 表的结构 `event_clubs`
--

CREATE TABLE `event_clubs` (
  `event_id` int(11) NOT NULL,
  `club_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动-社团关联表（多对多）';

-- --------------------------------------------------------

--
-- 表的结构 `event_participants`
--

CREATE TABLE `event_participants` (
  `event_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `status` enum('pending','approved','rejected','checked_in','cancelled') DEFAULT 'pending' COMMENT '报名状态: pending-待审核, approved-已通过, rejected-已拒绝, checked_in-已签到, cancelled-已取消',
  `registered_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '报名时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动参与表';

-- --------------------------------------------------------

--
-- 表的结构 `event_reminders`
--

CREATE TABLE `event_reminders` (
  `id` int(11) NOT NULL COMMENT '提醒记录ID',
  `event_id` int(11) NOT NULL COMMENT '活动ID',
  `reminder_type` enum('before_start','after_end','custom') DEFAULT 'before_start' COMMENT '提醒类型',
  `recipient_count` int(11) DEFAULT '0' COMMENT '接收者数量',
  `sent_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动提醒记录表';

-- --------------------------------------------------------

--
-- 表的结构 `recruitments`
--

CREATE TABLE `recruitments` (
  `id` int(11) NOT NULL COMMENT '招新ID',
  `club_id` int(11) NOT NULL COMMENT '所属社团ID',
  `title` varchar(200) NOT NULL COMMENT '招新标题',
  `description` text COMMENT '招新描述',
  `cover_image` varchar(255) DEFAULT NULL COMMENT '封面图片',
  `poster` varchar(255) DEFAULT NULL COMMENT '招新海报图片',
  `qr_code` varchar(255) DEFAULT NULL COMMENT '招新群二维码图片',
  `requirements` text COMMENT '招新要求(JSON数组)',
  `form_fields` json DEFAULT NULL COMMENT '报名表单字段配置(JSON)',
  `status` enum('draft','published','closed') DEFAULT 'draft' COMMENT '招新状态',
  `start_time` datetime DEFAULT NULL COMMENT '招新开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '招新截止时间',
  `max_applicants` int(11) DEFAULT NULL COMMENT '最大招募人数',
  `current_applicants` int(11) DEFAULT '0' COMMENT '当前报名人数',
  `interview_info` json DEFAULT NULL COMMENT '面试信息(JSON)',
  `contact_info` varchar(255) DEFAULT NULL COMMENT '联系方式',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='招新信息表';

-- --------------------------------------------------------

--
-- 表的结构 `system_config`
--

CREATE TABLE `system_config` (
  `id` int(11) NOT NULL COMMENT '配置ID',
  `config_key` varchar(100) NOT NULL COMMENT '配置键名',
  `config_value` text COMMENT '配置值',
  `description` varchar(255) DEFAULT NULL COMMENT '配置描述',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- --------------------------------------------------------

--
-- 表的结构 `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL COMMENT '自增ID',
  `openid` varchar(64) NOT NULL COMMENT '微信用户唯一标识',
  `student_id` varchar(20) DEFAULT NULL COMMENT '学号或校园唯一ID',
  `nickname` varchar(50) DEFAULT NULL COMMENT '昵称',
  `avatar` varchar(255) DEFAULT NULL COMMENT '头像URL',
  `wechat` varchar(50) DEFAULT NULL COMMENT '微信号',
  `role` enum('user','club_member','club_admin') DEFAULT 'user' COMMENT '用户角色',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- --------------------------------------------------------

--
-- 表的结构 `user_activity_stats`
--

CREATE TABLE `user_activity_stats` (
  `id` int(11) NOT NULL COMMENT '统计ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `stat_date` date NOT NULL COMMENT '统计日期',
  `login_count` int(11) DEFAULT '0' COMMENT '登录次数',
  `event_count` int(11) DEFAULT '0' COMMENT '参与活动数',
  `comment_count` int(11) DEFAULT '0' COMMENT '评论数',
  `application_count` int(11) DEFAULT '0' COMMENT '报名数',
  `activity_score` int(11) DEFAULT '0' COMMENT '活跃度得分',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户活跃度统计表';

-- --------------------------------------------------------

--
-- 表的结构 `user_badges`
--

CREATE TABLE `user_badges` (
  `id` int(11) NOT NULL COMMENT '记录ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `badge_id` int(11) NOT NULL COMMENT '羽章ID',
  `earned_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '获得时间',
  `is_displayed` tinyint(1) DEFAULT '1' COMMENT '是否在个人中心展示',
  `display_order` int(11) DEFAULT '0' COMMENT '展示顺序',
  `metadata` json DEFAULT NULL COMMENT '额外元数据',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户羽章关联表';

-- --------------------------------------------------------

--
-- 替换视图以便查看 `v_announcement`
-- （参见下面的实际视图）
--
CREATE TABLE `v_announcement` (
`cacheVersion` mediumtext
,`announcementVersion` mediumtext
,`announcementTitle` mediumtext
,`announcementContent` mediumtext
,`announcementImage` mediumtext
);

-- --------------------------------------------------------

--
-- 视图结构 `v_announcement`
--
DROP TABLE IF EXISTS `v_announcement`;

CREATE ALGORITHM=UNDEFINED DEFINER=`nfunest`@`localhost` SQL SECURITY DEFINER VIEW `v_announcement`  AS SELECT (select `system_config`.`config_value` from `system_config` where (`system_config`.`config_key` = 'cacheVersion')) AS `cacheVersion`, (select `system_config`.`config_value` from `system_config` where (`system_config`.`config_key` = 'announcementVersion')) AS `announcementVersion`, (select `system_config`.`config_value` from `system_config` where (`system_config`.`config_key` = 'announcementTitle')) AS `announcementTitle`, (select `system_config`.`config_value` from `system_config` where (`system_config`.`config_key` = 'announcementContent')) AS `announcementContent`, (select `system_config`.`config_value` from `system_config` where (`system_config`.`config_key` = 'announcementImage')) AS `announcementImage` ;

--
-- 转储表的索引
--

--
-- 表的索引 `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- 表的索引 `agent_tool_logs`
--
ALTER TABLE `agent_tool_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_actor_time` (`actor_id`,`actor_type`,`created_at`) COMMENT '频控统计与审计查询索引',
  ADD KEY `idx_session` (`session_id`);

--
-- 表的索引 `announcements`
--
ALTER TABLE `announcements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `club_id` (`club_id`);

--
-- 表的索引 `applications`
--
ALTER TABLE `applications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_recruitment_user` (`recruitment_id`,`user_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_applications_status` (`recruitment_id`,`status`),
  ADD KEY `idx_applications_submitted_at` (`submitted_at`);

--
-- 表的索引 `application_logs`
--
ALTER TABLE `application_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_application_id` (`application_id`),
  ADD KEY `idx_operator_id` (`operator_id`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- 表的索引 `approvals`
--
ALTER TABLE `approvals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_target` (`target_type`,`target_id`),
  ADD KEY `idx_club` (`club_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_applicant` (`applicant_id`);

--
-- 表的索引 `badges`
--
ALTER TABLE `badges`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_code` (`code`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_rarity` (`rarity`),
  ADD KEY `idx_category` (`category`);

--
-- 表的索引 `badge_logs`
--
ALTER TABLE `badge_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_badge_id` (`badge_id`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- 表的索引 `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chat_messages_session_id` (`session_id`);

--
-- 表的索引 `chat_sessions`
--
ALTER TABLE `chat_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chat_sessions_user_id` (`user_id`);

--
-- 表的索引 `clubs`
--
ALTER TABLE `clubs`
  ADD PRIMARY KEY (`id`);

--
-- 表的索引 `club_members`
--
ALTER TABLE `club_members`
  ADD PRIMARY KEY (`club_id`,`user_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_status` (`status`);

--
-- 表的索引 `comments`
--
ALTER TABLE `comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- 表的索引 `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`);

--
-- 表的索引 `event_clubs`
--
ALTER TABLE `event_clubs`
  ADD PRIMARY KEY (`event_id`,`club_id`),
  ADD KEY `idx_event_clubs_club` (`club_id`);

--
-- 表的索引 `event_participants`
--
ALTER TABLE `event_participants`
  ADD PRIMARY KEY (`event_id`,`user_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_event_participants_status` (`event_id`,`status`);

--
-- 表的索引 `event_reminders`
--
ALTER TABLE `event_reminders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_event_type` (`event_id`,`reminder_type`),
  ADD KEY `idx_event_id` (`event_id`);

--
-- 表的索引 `recruitments`
--
ALTER TABLE `recruitments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_club_id` (`club_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_end_time` (`end_time`);

--
-- 表的索引 `system_config`
--
ALTER TABLE `system_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_config_key` (`config_key`);

--
-- 表的索引 `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `openid` (`openid`);

--
-- 表的索引 `user_activity_stats`
--
ALTER TABLE `user_activity_stats`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_user_date` (`user_id`,`stat_date`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_stat_date` (`stat_date`),
  ADD KEY `idx_activity_stats_date` (`stat_date`,`user_id`);

--
-- 表的索引 `user_badges`
--
ALTER TABLE `user_badges`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_user_badge` (`user_id`,`badge_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_badge_id` (`badge_id`),
  ADD KEY `idx_earned_at` (`earned_at`);

--
-- 在导出的表使用AUTO_INCREMENT
--

--
-- 使用表AUTO_INCREMENT `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '管理员ID';

--
-- 使用表AUTO_INCREMENT `agent_tool_logs`
--
ALTER TABLE `agent_tool_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增ID';

--
-- 使用表AUTO_INCREMENT `announcements`
--
ALTER TABLE `announcements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '公告ID';

--
-- 使用表AUTO_INCREMENT `applications`
--
ALTER TABLE `applications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '报名ID';

--
-- 使用表AUTO_INCREMENT `application_logs`
--
ALTER TABLE `application_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '日志ID';

--
-- 使用表AUTO_INCREMENT `approvals`
--
ALTER TABLE `approvals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '审核ID';

--
-- 使用表AUTO_INCREMENT `badges`
--
ALTER TABLE `badges`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '羽章ID';

--
-- 使用表AUTO_INCREMENT `badge_logs`
--
ALTER TABLE `badge_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '日志ID';

--
-- 使用表AUTO_INCREMENT `chat_messages`
--
ALTER TABLE `chat_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '消息ID';

--
-- 使用表AUTO_INCREMENT `chat_sessions`
--
ALTER TABLE `chat_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '会话ID';

--
-- 使用表AUTO_INCREMENT `clubs`
--
ALTER TABLE `clubs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '社团ID';

--
-- 使用表AUTO_INCREMENT `comments`
--
ALTER TABLE `comments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '评论ID';

--
-- 使用表AUTO_INCREMENT `events`
--
ALTER TABLE `events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '活动ID';

--
-- 使用表AUTO_INCREMENT `event_reminders`
--
ALTER TABLE `event_reminders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '提醒记录ID';

--
-- 使用表AUTO_INCREMENT `recruitments`
--
ALTER TABLE `recruitments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '招新ID';

--
-- 使用表AUTO_INCREMENT `system_config`
--
ALTER TABLE `system_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '配置ID';

--
-- 使用表AUTO_INCREMENT `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增ID';

--
-- 使用表AUTO_INCREMENT `user_activity_stats`
--
ALTER TABLE `user_activity_stats`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '统计ID';

--
-- 使用表AUTO_INCREMENT `user_badges`
--
ALTER TABLE `user_badges`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '记录ID';

--
-- 限制导出的表
--

--
-- 限制表 `announcements`
--
ALTER TABLE `announcements`
  ADD CONSTRAINT `announcements_ibfk_1` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`) ON DELETE SET NULL;

--
-- 限制表 `applications`
--
ALTER TABLE `applications`
  ADD CONSTRAINT `fk_applications_recruitment` FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_applications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- 限制表 `badge_logs`
--
ALTER TABLE `badge_logs`
  ADD CONSTRAINT `fk_badge_logs_badge` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_badge_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- 限制表 `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD CONSTRAINT `fk_chat_messages_session` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE;

--
-- 限制表 `chat_sessions`
--
-- 注意：chat_sessions.user_id 与 owner_type 构成多态引用（user→users表 / admin→admins表），
-- 无法建立单一外键（管理员会话的user_id在users表不存在，会触发1452外键错误），
-- 故不设外键约束，归属校验由应用层（aiService按user_id+owner_type过滤）保证

--
-- 限制表 `club_members`
--
ALTER TABLE `club_members`
  ADD CONSTRAINT `club_members_ibfk_1` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `club_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- 限制表 `comments`
--
ALTER TABLE `comments`
  ADD CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- 限制表 `events`
--
ALTER TABLE `events`
  ADD CONSTRAINT `events_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- 限制表 `event_clubs`
--
ALTER TABLE `event_clubs`
  ADD CONSTRAINT `event_clubs_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `event_clubs_ibfk_2` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`) ON DELETE CASCADE;

--
-- 限制表 `event_participants`
--
ALTER TABLE `event_participants`
  ADD CONSTRAINT `event_participants_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `event_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- 限制表 `recruitments`
--
ALTER TABLE `recruitments`
  ADD CONSTRAINT `fk_recruitments_club` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`) ON DELETE CASCADE;

--
-- 限制表 `user_activity_stats`
--
ALTER TABLE `user_activity_stats`
  ADD CONSTRAINT `fk_activity_stats_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- 限制表 `user_badges`
--
ALTER TABLE `user_badges`
  ADD CONSTRAINT `fk_user_badges_badge` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_user_badges_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
