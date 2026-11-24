/**
 * Agent工具注册中心
 * @description 安全设计第1层（工具白名单）+ 第3层（身份可见性过滤）：
 * 1. 只有在此登记的工具才可能被调用，且全部是纯业务函数——物理上不存在SQL/文件/Shell类工具
 * 2. getVisibleTools按操作者身份过滤下发模型的工具列表（学生看不到审核工具）
 * 3. 写工具声明requiresConfirmation，由执行器强制走二次确认流程
 */
const db = require('../../config/database');
const moment = require('moment');
const eventService = require('../eventService');
const clubMemberService = require('../clubMemberService');
// [ADD] 复用Pipeline的数据检索能力，避免Agent与Pipeline两套查询逻辑重复实现
const { getNearbyEventsData, getBadgeInfoData, getRecruitmentData } = require('../contextBuilder/dataRetriever');
const { getApprovalDetail, approveApproval, rejectApproval } = require('../../utils/approvalHelper');
const { BusinessError } = require('../../utils/errors');

/**
 * 解析添加成员的目标用户（学号/昵称 → 唯一用户）
 * @description 严谨性设计：
 * 1. 只能添加平台已注册用户（users表存在记录），未注册直接失败并引导
 * 2. 学号走精确匹配（student_id = kw，学号唯一标识，绝不允许模糊误匹配）；
 *    昵称走模糊匹配（昵称可重复）
 * 3. 多个候选时抛业务错误，由模型引导用户澄清，杜绝误加
 */
async function resolveTargetUser(args) {
  const keyword = args.studentNumber || args.nickname;
  if (!keyword) {
    throw new BusinessError('请提供目标用户的学号或昵称');
  }

  // 学号精确匹配优先：学号是唯一键，必须精确相等
  let candidates;
  if (args.studentNumber) {
    candidates = await db('users')
      .select('id', 'nickname', 'student_id', 'avatar')
      .where({ student_id: args.studentNumber })
      .limit(2);
  } else {
    // 昵称模糊匹配（可能重名）
    candidates = await clubMemberService.searchUsers(args.nickname);
  }

  if (candidates.length === 0) {
    throw new BusinessError(
      args.studentNumber
        ? `学号「${args.studentNumber}」尚未注册本平台，请确认对方已使用微信登录小程序并填写学号`
        : `未找到昵称匹配「${args.nickname}」的用户，请确认对方已注册本平台`
    );
  }
  if (candidates.length > 1) {
    throw new BusinessError(`「${keyword}」匹配到多位用户，请提供学号以精确定位`);
  }
  return candidates[0];
}

/**
 * 格式化活动日期为YYYY-MM-DD纯日期字符串
 * @description 修复两个数据流bug：
 * 1. MySQL DATE列经mysql2驱动转为JS Date对象，JSON序列化回传模型时变成UTC ISO字符串
 *    （东八区日期早1天且带出虚假16:00时刻，模型会误报错误的活动时间）
 * 2. Date对象直接模板拼接会输出"Wed Aug 26 2026..."长串，污染确认卡片展示
 * 统一在工具出口格式化，与活动详情页的日期语义（纯日期）保持一致
 * @param {*} date - 数据库读出的date字段（Date对象或字符串）
 * @returns {string} YYYY-MM-DD，无值返回空串
 */
function formatEventDate(date) {
  return date ? moment(date).format('YYYY-MM-DD') : '';
}

/**
 * 从审核详情中提取目标标题
 * @description getApprovalDetail返回{...approval, target, club, applicant}，
 * 标题位于target.title（events/announcements两表均有title字段），不存在时回退到记录ID
 */
function pickTargetTitle(detail, targetId) {
  return (detail && detail.target && detail.target.title) || `记录#${targetId}`;
}

/**
 * 构建待审核列表项（供list_pending_approvals返回给模型）
 * @description 提取标题/内容摘要/时间/地点/主办方/所属社团/申请人，
 * 让管理员在对话中即可了解审核对象全貌，无需跳转审核页面
 * @param {Object} approval - approvals表记录
 * @param {Object|null} detail - getApprovalDetail返回的详情
 * @returns {Object} 列表项
 */
function buildApprovalListItem(approval, detail) {
  const target = (detail && detail.target) || {};

  const item = {
    approvalId: approval.id,
    targetType: approval.target_type,
    targetTitle: pickTargetTitle(detail, approval.target_id),
    createdAt: approval.created_at
  };

  // 内容摘要：活动取description、公告取content，截断控制token成本
  const content = target.description || target.content;
  if (content) {
    item.contentSummary = content.length > 100 ? `${content.slice(0, 100)}...` : content;
  }

  // 活动特有字段：时间/地点/主办方
  // [FIX] target.date是Date对象，直接模板拼接会输出"Wed Aug 26 2026..."长串，统一格式化
  if (approval.target_type === 'event') {
    const eventTime = `${formatEventDate(target.date)} ${target.time || ''}`.trim();
    if (eventTime) item.eventTime = eventTime;
    if (target.location_name || target.location) {
      item.location = target.location_name || target.location;
    }
    if (target.organizer) item.organizer = target.organizer;
  }

  // 归属信息：所属社团 + 申请人
  if (detail && detail.club) item.clubName = detail.club.name;
  if (detail && detail.applicant) item.applicantName = detail.applicant.nickname;

  return item;
}

/**
 * 防御性读取审核详情字段（approvalHelper返回结构存在差异，做兼容读取）
 * [MODIFY] 改从detail.target提取标题，并补充社团/申请人/活动时间，确认卡片信息完整
 */
function pickApprovalSummary(detail, args) {
  const target = (detail && detail.target) || {};
  const isEvent = detail.target_type === 'event';
  return {
    title: `确认${args.action === 'approve' ? '通过' : '拒绝'}审核`,
    rows: [
      { label: '审核对象', value: pickTargetTitle(detail, detail.target_id) },
      { label: '对象类型', value: isEvent ? '活动' : '公告' },
      ...(detail.club ? [{ label: '所属社团', value: detail.club.name }] : []),
      ...(detail.applicant ? [{ label: '申请人', value: detail.applicant.nickname || `用户#${detail.applicant.id}` }] : []),
      ...(isEvent && target.date
        ? [{ label: '活动时间', value: `${formatEventDate(target.date)} ${target.time || ''}`.trim() }]
        : []),
      ...(args.action === 'reject' && args.reason ? [{ label: '拒绝原因', value: args.reason }] : [])
    ],
    // 审核正文：活动取description、公告取content（getApprovalDetail已返回完整记录），
    // 确认卡片必须展示正文，管理员才能判断是否通过，不能只凭标题审核
    contentLabel: isEvent ? '活动描述' : '公告内容',
    content: (isEvent ? target.description : target.content) || ''
  };
}

// ═══════════════ 工具定义（8个） ═══════════════
const ALL_TOOLS = [
  // ─────── 查询类：直接执行，无确认 ───────
  {
    name: 'search_events',
    description: '搜索可报名的校园活动。用户想了解/报名/取消活动时，先用此工具获取活动列表（含eventId），再进行后续操作。支持按关键词和分类过滤。',
    access: 'any',
    type: 'read',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '活动标题关键词，如"羽毛球"', maxLength: 50 },
        category: { type: 'string', description: '活动分类', maxLength: 20 },
        onlyJoinable: { type: 'boolean', description: 'true时只返回报名未截止的活动' }
      }
    },
    /** 查询已发布且审核通过的活动（只读，无风险） */
    execute: async (actor, args) => {
      const query = db('events')
        .select('id', 'title', 'date', 'time', 'location', 'location_name', 'category',
          'max_participants', 'current_participants', 'registration_deadline')
        .where({ status: 'published', approval_status: 'approved' });
      if (args.keyword) query.andWhere('title', 'like', `%${args.keyword}%`);
      if (args.category) query.andWhere('category', args.category);
      if (args.onlyJoinable) {
        // 未截止 = 截止时间为空 或 晚于当前时间
        query.andWhere(builder =>
          builder.whereNull('registration_deadline').orWhere('registration_deadline', '>', db.fn.now())
        );
      }
      const events = await query.orderBy('date', 'asc').limit(10);
      // [FIX] 出口归一化（模型只应看到可直接转述的干净数据）：
      // 1. date转YYYY-MM-DD纯日期——DATE序列化成UTC ISO会让模型误报日期+编造出16:00假时间
      // 2. location合并为location_name||location（与详情页显示逻辑一致）——
      //    只查location_name时，未选地图位置的活动为NULL，模型会错误回答"暂无地点"
      const normalized = events.map(({ location_name, ...rest }) => ({
        ...rest,
        date: formatEventDate(rest.date),
        location: location_name || rest.location || null
      }));
      // 空结果时附加显式提示：明确告知模型"没有"，压缩编造空间
      return {
        total: normalized.length,
        events: normalized,
        message: normalized.length === 0
          ? '数据库中没有符合条件的活动。请如实告知用户没有找到相关活动，严禁编造活动信息。'
          : null
      };
    }
  },
  {
    name: 'search_nearby_events',
    // [ADD] 补齐"附近有什么活动"快捷问题：位置由请求上下文自动注入，模型无需也不应向用户索要
    description: '查询当前位置附近的校园活动，按距离由近到远返回（含距离米数）。用户问"附近/最近有什么活动"时使用。定位由系统自动提供；若系统未获得定位，工具会返回提示，此时改用search_events查询全部近期活动。',
    access: 'user',
    type: 'read',
    requiresConfirmation: false,
    parameters: { type: 'object', properties: {} },
    /**
     * 查询附近活动（只读）
     * @param {Object} actor - 当前用户
     * @param {Object} args - 无参数（位置不信任模型输出，只取服务端上下文）
     * @param {Object} context - 执行上下文，含请求带来的定位信息（执行器保证传入）
     */
    execute: async (actor, args, context) => {
      const { latitude, longitude } = context.location || {};
      if (!latitude || !longitude) {
        return {
          total: 0,
          nearbyEvents: [],
          message: '未能获取用户定位，无法查询附近活动。请如实告知用户：需要允许小程序获取位置后重新提问，或改用search_events查询全部近期活动。'
        };
      }
      const { nearbyEvents } = await getNearbyEventsData(latitude, longitude, actor.id);
      return {
        total: nearbyEvents.length,
        nearbyEvents,
        message: nearbyEvents.length === 0
          ? '附近暂时没有已发布的活动。请如实告知用户，严禁编造活动信息。'
          : null
      };
    }
  },
  {
    name: 'search_clubs',
    // [MODIFY] 移除"加入社团"的代办诱导：Agent不能替用户入社，只能查询后推荐卡片
    description: '搜索社团信息（仅查询）。用户想了解社团、想加入社团、需要社团推荐（如"推荐适合我的社团/有哪些社团"）时，必须用此工具获取候选社团列表用于推荐，可结合用户画像中的兴趣选择category过滤；会长需要获取自己社团的clubId时也可使用。注意：入社必须由用户自己在社团详情页填写报名表完成，Agent无法代办。',
    access: 'any',
    type: 'read',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '社团名称关键词', maxLength: 50 },
        category: { type: 'string', description: '社团分类：艺术/学术/文化/体育/公益', maxLength: 20 }
      }
    },
    /** 查询社团列表（只读） */
    execute: async (actor, args) => {
      const query = db('clubs').select('id', 'name', 'category', 'level', 'short_intro');
      if (args.keyword) query.andWhere('name', 'like', `%${args.keyword}%`);
      if (args.category) query.andWhere('category', args.category);
      const clubs = await query.limit(10);
      // 空结果显式提示（同search_events，压缩编造空间）
      return {
        total: clubs.length,
        clubs,
        message: clubs.length === 0
          ? '数据库中没有符合条件的社团。请如实告知用户没有找到相关社团，严禁编造社团信息。'
          : null
      };
    }
  },
  {
    name: 'get_my_overview',
    description: '获取当前用户本人的概览信息：已加入的社团（含是否会长）、即将参加的活动。用户问"我的社团/我的活动"时使用，也可帮助会长确认自己管理的clubId。注意：用户想要社团推荐（如"推荐适合我的社团"）时不要只用此工具，必须调用search_clubs获取候选社团，系统会展示可点击的社团卡片。',
    access: 'user',
    type: 'read',
    requiresConfirmation: false,
    parameters: { type: 'object', properties: {} },
    /** 查询当前用户画像（只读自己，userId来自JWT而非模型参数） */
    execute: async (actor) => {
      const user = await db('users').where({ id: actor.id }).first()
        .select('id', 'nickname', 'student_id');
      const joinedClubs = await db('club_members as cm')
        .join('clubs as c', 'c.id', 'cm.club_id')
        .where({ 'cm.user_id': actor.id, 'cm.status': 'active' })
        .select('c.id', 'c.name', 'cm.role');
      // [FIX] e.date是DATE类型，与NOW()(DATETIME)比较时'2026-08-23' >= '2026-08-23 14:00:00'
      // 为false会漏掉今天的活动——改用CURDATE()按日比较
      const upcomingEvents = await db('event_participants as ep')
        .join('events as e', 'e.id', 'ep.event_id')
        .where({ 'ep.user_id': actor.id })
        .whereIn('ep.status', ['pending', 'approved'])
        .where('e.date', '>=', db.raw('CURDATE()'))
        .select('e.id', 'e.title', 'e.date', 'e.time')
        .limit(5);
      // [FIX] date同样出口归一化，防UTC ISO导致模型把日期读偏/编造时间
      upcomingEvents.forEach(e => { e.date = formatEventDate(e.date); });
      return { user, joinedClubs, upcomingEvents };
    }
  },
  {
    name: 'get_my_badges',
    // [ADD] 补齐羽章盲区：画像只含activityScore，模型原无羽章数据可查
    description: '获取当前用户已获得的羽章列表及统计（总数、总积分、按类型/稀有度分布、活跃度分数、未获得数量）。用户问"我有哪些羽章/徽章""还差多少分升级"时使用。系统会自动展示羽章卡片。',
    access: 'user',
    type: 'read',
    requiresConfirmation: false,
    parameters: { type: 'object', properties: {} },
    /** 查询当前用户羽章（复用Pipeline的羽章检索，只读本人数据） */
    execute: async (actor) => {
      const data = await getBadgeInfoData(actor.id);
      // 只回传模型可直接转述的字段，图标等展示字段由前端卡片自行拉取，控制token成本
      const userBadges = data.userBadges.slice(0, 10).map(b => ({
        id: b.id,
        name: b.name,
        type: b.type,
        rarity: b.rarity,
        points: b.points,
        earnedAt: b.earnedAt
      }));
      return {
        total: data.stats.total,
        totalPoints: data.stats.totalPoints,
        byType: data.stats.byType,
        byRarity: data.stats.byRarity,
        activityScore: data.activityScore,
        unearnedCount: data.unearnedBadges.length,
        userBadges,
        message: userBadges.length === 0
          ? '该用户尚未获得任何羽章。请如实告知，并引导其参加活动、加入社团、发表评论来获取羽章。'
          : null
      };
    }
  },
  {
    name: 'list_recruitments',
    // [ADD] 补齐招新盲区：Pipeline有recruitment_info意图，Agent原先无对应工具
    description: '查询当前正在招新的社团招新信息（社团名称、报名截止时间、名额、要求、用户报名状态）。用户问"哪些社团在招新/怎么加入社团/招新报名"时使用。系统会展示对应社团卡片，入社仍须用户进入社团详情页自行提交报名。',
    access: 'user',
    type: 'read',
    requiresConfirmation: false,
    parameters: { type: 'object', properties: {} },
    /** 查询招新信息（复用Pipeline招新检索，含用户报名状态） */
    execute: async (actor) => {
      const data = await getRecruitmentData(actor.id);
      const recruitments = data.recruitments.slice(0, 10).map(r => ({
        id: r.id,
        title: r.title,
        clubId: r.club.id,
        clubName: r.club.name,
        clubCategory: r.club.category,
        endTime: r.endTime,
        applicants: r.maxApplicants ? `${r.currentApplicants}/${r.maxApplicants}` : `${r.currentApplicants}/不限`,
        requirements: r.requirements,
        applicationStatus: r.applicationStatus,
        isJoinedClub: r.club.isJoined
      }));
      return {
        total: data.totalRecruitments,
        appliedCount: data.appliedCount,
        recruitments,
        message: recruitments.length === 0
          ? '当前没有正在招新的社团。请如实告知用户，严禁编造招新信息。'
          : null
      };
    }
  },
  {
    name: 'list_pending_approvals',
    // [MODIFY] 说明返回字段，引导模型向管理员完整转述审核对象信息
    description: '获取待管理员审核的活动/公告列表（含标题、内容摘要、时间、地点、主办方、所属社团、申请人）。管理员想审核内容、查看待办时使用。',
    access: 'admin',
    type: 'read',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        targetType: { type: 'string', enum: ['event', 'announcement'], description: '审核对象类型筛选' }
      }
    },
    /** 查询待审核列表（仅管理员可见此工具） */
    execute: async (actor, args) => {
      const query = db('approvals')
        .where({ status: 'pending' })
        .select('id', 'target_type', 'target_id', 'club_id', 'applicant_id', 'created_at')
        .orderBy('created_at', 'asc')
        .limit(10);
      if (args.targetType) query.andWhere('target_type', args.targetType);
      const list = await query;
      // 逐条取详情获取标题等信息（最多5条，控制查询成本与token）
      const details = await Promise.all(list.slice(0, 5).map(a => getApprovalDetail(a.id)));
      // [MODIFY] 用buildApprovalListItem构建富信息列表项（标题/摘要/时间/地点/主办方/社团/申请人）
      const items = details.map((d, i) => buildApprovalListItem(list[i], d));
      return { total: list.length, items };
    }
  },

  // ─────── 写操作类：需二次确认后才真正执行 ───────
  {
    name: 'enroll_activity',
    description: '为当前用户报名指定活动。必须先用search_events确认eventId。调用后系统会向用户展示确认卡片，用户点击确认才真正执行。',
    access: 'user',
    type: 'write',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        eventId: { type: 'integer', description: '活动ID（来自search_events结果）', min: 1 }
      },
      required: ['eventId']
    },
    /** 确认后执行：复用eventService完整校验链（名额/截止/重复） */
    execute: async (actor, args) => {
      await eventService.enrollUser(args.eventId, actor.id);
      return { success: true, message: '报名成功' };
    },
    /**
     * 确认卡片摘要：展示活动关键信息供用户确认
     * [MODIFY] 前置预检业务条件（已报名/已截止/已满），把可预见的失败挡在弹卡片之前，
     * 避免用户点确认后才报错；执行时仍会完整重校验（防TOCTOU：等待确认期间名额可能被抢完）
     */
    buildSummary: async (actor, args) => {
      const event = await db('events').where({ id: args.eventId }).first();
      if (!event) throw new BusinessError('活动不存在');
      if (event.status !== 'published' || event.approval_status !== 'approved') {
        throw new BusinessError('该活动当前不可报名');
      }
      if (event.registration_deadline && moment().isAfter(moment(event.registration_deadline))) {
        throw new BusinessError('该活动报名时间已截止');
      }
      const participation = await db('event_participants')
        .where({ event_id: args.eventId, user_id: actor.id })
        .whereIn('status', ['pending', 'approved', 'checked_in'])
        .first();
      if (participation) {
        throw new BusinessError('您已经报名过该活动，无需重复报名');
      }
      if (event.max_participants && event.current_participants >= event.max_participants) {
        throw new BusinessError('该活动人数已满');
      }
      return {
        title: '确认报名活动',
        rows: [
          { label: '活动', value: event.title },
          // [FIX] date格式化防Date对象拼接长串；地点回退location，与详情页一致
          { label: '时间', value: `${formatEventDate(event.date)} ${event.time || ''}`.trim() || '待定' },
          { label: '地点', value: event.location_name || event.location || '待定' },
          { label: '人数', value: event.max_participants ? `${event.current_participants}/${event.max_participants}` : '不限' }
        ]
      };
    }
  },
  {
    name: 'cancel_enrollment',
    description: '取消当前用户对指定活动的报名。必须先用search_events或get_my_overview确认eventId。调用后需用户在确认卡片上点击确认。',
    access: 'user',
    type: 'write',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        eventId: { type: 'integer', description: '活动ID', min: 1 }
      },
      required: ['eventId']
    },
    /** 确认后执行：复用eventService取消逻辑 */
    execute: async (actor, args) => {
      await eventService.cancelEnrollment(args.eventId, actor.id);
      return { success: true, message: '已取消报名' };
    },
    /**
     * 确认卡片摘要
     * [MODIFY] 前置预检：未报名/已截止时直接抛错，不弹无意义卡片
     */
    buildSummary: async (actor, args) => {
      const event = await db('events').where({ id: args.eventId }).first();
      if (!event) throw new BusinessError('活动不存在');
      const participation = await db('event_participants')
        .where({ event_id: args.eventId, user_id: actor.id })
        .whereIn('status', ['pending', 'approved'])
        .first();
      if (!participation) {
        throw new BusinessError('您尚未报名该活动（或已取消过），无需取消');
      }
      if (event.registration_deadline && moment().isAfter(moment(event.registration_deadline))) {
        throw new BusinessError('该活动报名已截止，不允许取消报名');
      }
      return {
        title: '确认取消报名',
        rows: [
          { label: '活动', value: event.title },
          // [FIX] date格式化防Date对象拼接长串
          { label: '时间', value: `${formatEventDate(event.date)} ${event.time || ''}`.trim() || '待定' }
        ]
      };
    }
  },
  {
    name: 'review_approval',
    description: '管理员审核活动/公告（通过或拒绝）。必须先用list_pending_approvals确认approvalId。拒绝时必须提供reason。调用后需管理员在确认卡片上点击确认。',
    access: 'admin',
    type: 'write',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        approvalId: { type: 'integer', description: '审核记录ID（来自list_pending_approvals）', min: 1 },
        action: { type: 'string', enum: ['approve', 'reject'], description: '审核动作' },
        reason: { type: 'string', description: '拒绝原因（action=reject时必填）', maxLength: 200 }
      },
      required: ['approvalId', 'action']
    },
    /** 确认后执行：复用approvalHelper的审核逻辑 */
    execute: async (actor, args) => {
      if (args.action === 'approve') {
        await approveApproval(args.approvalId, actor.id);
        return { success: true, message: '已通过该审核' };
      }
      if (!args.reason || !args.reason.trim()) {
        throw new BusinessError('拒绝审核时必须填写原因');
      }
      await rejectApproval(args.approvalId, actor.id, args.reason.trim());
      return { success: true, message: '已拒绝该审核' };
    },
    /**
     * 确认卡片摘要
     * [MODIFY] 前置预检：拒绝缺原因、记录不存在、记录已被审核（等待期间被其他管理员处理）时直接抛错
     * 通知联动：approveApproval/rejectApproval内部已自动发送审核结果通知给社长，
     * 活动审核通过还会调度活动提醒并通知社团成员——工具无需额外通知逻辑
     */
    buildSummary: async (actor, args) => {
      if (args.action === 'reject' && !(args.reason && args.reason.trim())) {
        throw new BusinessError('拒绝审核时必须填写原因');
      }
      const detail = await getApprovalDetail(args.approvalId);
      if (!detail) throw new BusinessError('审核记录不存在');
      if (detail.status !== 'pending') {
        throw new BusinessError(`该记录已被${detail.status === 'approved' ? '通过' : '拒绝'}，无法重复审核`);
      }
      return pickApprovalSummary(detail, args);
    }
  },
  {
    name: 'add_club_member',
    // [MODIFY] 强化用途边界：仅限会长补录成员，严禁把"用户想加入社团"引导到此工具
    description: '【仅限社团会长补录成员】将指定用户添加为本社团的成员（适用于线下招新后录入等场景）。只能添加已在平台注册的用户：需提供clubId和目标用户的学号（精确匹配，推荐）或昵称（可能重名，重名时需用户澄清）。未注册平台的学号无法添加。严禁用于帮用户本人或其他普通用户加入社团——普通入社必须由用户自己在社团详情页填写报名表申请。调用后需会长在确认卡片上点击确认。',
    access: 'club_leader',
    type: 'write',
    requiresConfirmation: true,
    // 会长权限校验依赖args中的clubId（执行层查库验证role=leader）
    getClubId: (args) => args.clubId,
    parameters: {
      type: 'object',
      properties: {
        clubId: { type: 'integer', description: '社团ID（会长可先用get_my_overview查看自己管理的社团）', min: 1 },
        studentNumber: { type: 'string', description: '目标用户学号（与nickname二选一，精确匹配，推荐使用）', maxLength: 20 },
        nickname: { type: 'string', description: '目标用户昵称（与studentNumber二选一，可能重名）', maxLength: 50 }
      },
      required: ['clubId']
    },
    /** 确认后执行：定位唯一用户→复用clubMemberService添加 */
    execute: async (actor, args) => {
      const target = await resolveTargetUser(args);
      await clubMemberService.addMember(args.clubId, target.id);
      return { success: true, message: `已将「${target.nickname}」添加为社团成员` };
    },
    /**
     * 确认卡片摘要（同时预检：目标用户存在且唯一、尚未是该社团成员）
     */
    buildSummary: async (actor, args) => {
      const club = await db('clubs').where({ id: args.clubId }).first();
      if (!club) throw new BusinessError('社团不存在');
      const target = await resolveTargetUser(args);
      // 前置预检重复成员：点确认前就发现"已加入"，避免无意义确认流程
      const existing = await db('club_members')
        .where({ club_id: args.clubId, user_id: target.id })
        .first();
      if (existing && existing.status === 'active') {
        throw new BusinessError(`「${target.nickname}」已经是该社团成员，无需重复添加`);
      }
      return {
        title: '确认添加社团成员',
        rows: [
          { label: '社团', value: club.name },
          { label: '成员', value: `${target.nickname}（${target.student_id || '无学号'}）` }
        ]
      };
    }
  }
];

// ═══════════════ 注册中心对外接口 ═══════════════

/** 按名称查找工具（白名单查找，未登记返回null） */
function findTool(name) {
  return ALL_TOOLS.find(t => t.name === name) || null;
}

/**
 * 获取操作者可见的工具列表（安全设计第3层：身份过滤第一道）
 * @description club_leader工具对所有学生可见（是否真为会长由执行层查库判定），
 * 其余access按身份严格过滤
 */
function getVisibleTools(actor) {
  return ALL_TOOLS.filter(tool => {
    switch (tool.access) {
      case 'any': return true;
      case 'user': return actor.type === 'user';
      case 'admin': return actor.type === 'admin';
      case 'club_leader': return actor.type === 'user';
      default: return false;
    }
  });
}

/**
 * 导出下发模型的工具Schema（仅name/description/parameters，实现细节绝不外泄）
 */
function getToolSchemasForModel(visibleTools) {
  return visibleTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

/** 获取全部写工具名（频控统计用） */
function getWriteToolNames() {
  return ALL_TOOLS.filter(t => t.type === 'write').map(t => t.name);
}

module.exports = {
  ALL_TOOLS,
  findTool,
  getVisibleTools,
  getToolSchemasForModel,
  getWriteToolNames
};
