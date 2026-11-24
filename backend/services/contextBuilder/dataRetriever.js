/**
 * 数据检索模块
 * @description 负责从数据库检索各种数据，包括用户画像、社团、活动、羽章等
 */

const db = require('../../config/database');
const logger = require('../../config/logger');
const { LEVEL_MAP, INTEREST_TO_CATEGORY_MAP, ACTIVITY_LEVELS } = require('./constants');
const { formatDate, safeJsonParse, mapClubData, calculateDistance, escapeLikeString } = require('./utils');
const { extractInterestKeywords, extractClubName } = require('./intentDetector');

/**
 * 获取用户画像数据
 * @param {number} userId - 用户ID
 * @returns {Object} 用户画像信息
 */
async function getUserProfile(userId) {
  const user = await db('users')
    .select('id', 'nickname', 'student_id', 'wechat', 'role')
    .where({ id: userId })
    .first();

  if (!user) return null;

  const joinedClubs = await db('club_members')
    .select('clubs.id', 'clubs.name', 'clubs.category', 'club_members.role')
    .join('clubs', 'club_members.club_id', 'clubs.id')
    .where({ 'club_members.user_id': userId, 'club_members.status': 'active' });

  const participatedEvents = await db('event_participants')
    .count('event_id as count')
    .where({ user_id: userId })
    .whereIn('status', ['pending', 'approved', 'checked_in'])
    .first();

  const activityStats = await db('user_activity_stats')
    .select('activity_score', 'event_count', 'comment_count')
    .where({ user_id: userId })
    .orderBy('stat_date', 'desc')
    .first();

  return {
    nickname: user.nickname,
    studentId: user.student_id,
    role: user.role,
    joinedClubs: joinedClubs.map(c => ({ name: c.name, category: c.category, role: c.role })),
    totalEvents: participatedEvents ? participatedEvents.count : 0,
    activityScore: activityStats ? activityStats.activity_score : 0
  };
}

/**
 * 获取社团推荐数据
 * @description 使用数据库模糊匹配，让AI理解用户兴趣并推荐相关社团
 * @param {number} userId - 用户ID
 * @param {string} message - 用户消息（用于提取兴趣关键词）
 * @returns {Object} 社团推荐上下文
 */
async function getClubRecommendationData(userId, message = '') {
  const userProfile = await getUserProfile(userId);
  const joinedClubIds = userProfile ? userProfile.joinedClubs.map(c => c.id) : [];

  const interestInfo = extractInterestKeywords(message || '');
  const { keywords, categories, expandedKeywords } = interestInfo;

  let clubs = [];
  let matchedByKeyword = false;
  let hasExactMatch = false;
  let exactMatchCount = 0;
  let sameCategoryCount = 0;

  if (keywords.length > 0) {
    const matchedCategories = categories
      .map(cat => INTEREST_TO_CATEGORY_MAP[cat])
      .filter((cat, index, self) => cat && self.indexOf(cat) === index);

    if (matchedCategories.length > 0) {
      matchedByKeyword = true;

      const exactMatchQuery = db('clubs')
        .select('id', 'name', 'short_intro', 'description', 'category', 'level', 'logo', 'cover_image', 'gallery')
        .where(function() {
          expandedKeywords.forEach(keyword => {
            const escapedKeyword = escapeLikeString(keyword);
            this.orWhere('name', 'like', `%${escapedKeyword}%`)
                .orWhere('short_intro', 'like', `%${escapedKeyword}%`)
                .orWhere('description', 'like', `%${escapedKeyword}%`);
          });
        });

      const exactMatchClubs = await exactMatchQuery;

      if (exactMatchClubs.length > 0) {
        hasExactMatch = true;
        exactMatchCount = exactMatchClubs.length;
        clubs = exactMatchClubs;
      } else {
        const sameCategoryClubs = await db('clubs')
          .select('id', 'name', 'short_intro', 'category', 'level', 'logo', 'cover_image', 'gallery')
          .whereIn('category', matchedCategories);
        
        sameCategoryCount = sameCategoryClubs.length;
        clubs = sameCategoryClubs;
      }
    }
  }

  if (!matchedByKeyword) {
    clubs = await db('clubs')
      .select('id', 'name', 'short_intro', 'category', 'level', 'logo', 'cover_image', 'gallery')
      .orderBy('id', 'asc');
  }

  const clubIds = clubs.map(c => c.id);
  const [leaders, allClubsData] = await Promise.all([
    db('club_members')
      .select('club_members.club_id', 'users.nickname', 'users.wechat', 'users.avatar')
      .join('users', 'club_members.user_id', 'users.id')
      .whereIn('club_members.club_id', clubIds)
      .where({ 'club_members.role': 'leader', 'club_members.status': 'active' }),
    db('clubs')
      .select('id', 'name', 'short_intro', 'category', 'level', 'logo', 'cover_image', 'gallery')
  ]);

  const leadersMap = {};
  leaders.forEach(l => {
    if (!leadersMap[l.club_id]) leadersMap[l.club_id] = [];
    leadersMap[l.club_id].push({
      nickname: l.nickname,
      wechat: l.wechat || null,
      avatar: l.avatar
    });
  });

  const clubsData = clubs.map(club => ({
    ...mapClubData(club, joinedClubIds),
    leaders: leadersMap[club.id] || []
  }));

  const categoryCount = {};
  allClubsData.forEach(c => {
    categoryCount[c.category] = (categoryCount[c.category] || 0) + 1;
  });

  return {
    userProfile,
    clubs: clubsData,
    categoryCount,
    totalClubs: allClubsData.length,
    matchedCount: clubsData.length,
    interestKeywords: keywords,
    interestCategories: categories,
    expandedKeywords,
    hasInterestMatch: matchedByKeyword,
    hasExactMatch,
    exactMatchCount,
    sameCategoryCount,
    userMessage: message
  };
}

/**
 * 获取社团详细信息
 * @description 使用批量查询避免 N+1 问题
 * @param {string} message - 用户消息（用于提取社团名）
 * @returns {Object} 社团详情上下文
 */
async function getClubInfoByName(message) {
  const clubName = extractClubName(message);

  let query = db('clubs')
    .select('id', 'name', 'short_intro', 'description', 'category', 'level', 'logo', 'cover_image', 'gallery');

  if (clubName) {
    const escapedName = escapeLikeString(clubName);
    query = query.where('name', 'like', `%${escapedName}%`);
  } else {
    const keywords = message.replace(/[，。？！、\s]/g, '').split('').filter(c => c.trim());
    if (keywords.length > 0) {
      const escapedKeywords = keywords.join('').replace(/[%_]/g, '\\$&');
      query = query.where(function() {
        this.where('name', 'like', `%${escapedKeywords}%`)
            .orWhere('short_intro', 'like', `%${escapedKeywords}%`);
      });
    }
  }

  const clubs = await query.limit(5);

  if (clubs.length === 0) {
    return { clubs: [] };
  }

  const clubIds = clubs.map(c => c.id);

  const [leaders, memberCounts] = await Promise.all([
    db('club_members')
      .select('club_members.club_id', 'users.nickname', 'users.wechat', 'users.avatar')
      .join('users', 'club_members.user_id', 'users.id')
      .whereIn('club_members.club_id', clubIds)
      .where({ 'club_members.role': 'leader', 'club_members.status': 'active' }),
    db('club_members')
      .select('club_id')
      .count('* as count')
      .whereIn('club_id', clubIds)
      .where({ status: 'active' })
      .groupBy('club_id')
  ]);

  const leadersMap = {};
  leaders.forEach(l => {
    if (!leadersMap[l.club_id]) leadersMap[l.club_id] = [];
    leadersMap[l.club_id].push({
      nickname: l.nickname,
      wechat: l.wechat || null,
      avatar: l.avatar
    });
  });

  const memberCountMap = {};
  memberCounts.forEach(m => {
    memberCountMap[m.club_id] = m.count;
  });

  const clubDetails = clubs.map(club => ({
    id: club.id,
    name: club.name,
    shortIntro: club.short_intro,
    description: club.description,
    category: club.category,
    level: LEVEL_MAP[club.level] || club.level,
    logo: club.logo,
    coverImage: club.cover_image,
    gallery: safeJsonParse(club.gallery),
    memberCount: memberCountMap[club.id] || 0,
    leaders: leadersMap[club.id] || []
  }));

  return { clubs: clubDetails };
}

/**
 * 获取活动推荐数据
 * @description 使用批量查询避免 N+1 问题,包含用户参与状态,支持兴趣关键词搜索
 * @param {number} userId - 用户ID
 * @param {string} message - 用户消息(用于提取兴趣关键词)
 * @returns {Object} 活动推荐上下文
 */
async function getEventRecommendationData(userId, message = '') {
  const userProfile = await getUserProfile(userId);

  const interestInfo = extractInterestKeywords(message || '');
  const { keywords, expandedKeywords } = interestInfo;

  let events = [];
  let matchedByKeyword = false;
  let hasInterestMatch = false;

  if (keywords.length > 0 && expandedKeywords.length > 0) {
    matchedByKeyword = true;
    hasInterestMatch = true;

    events = await db('events')
      .select('id', 'title', 'date', 'time', 'location', 'category', 'status',
              'cover_image', 'description', 'organizer', 'contact', 'tags',
              'max_participants', 'current_participants', 'registration_deadline')
      .where({ status: 'published' })
      .where('date', '>=', db.raw('CURDATE()'))
      .where(function() {
        expandedKeywords.forEach(keyword => {
          const escapedKeyword = escapeLikeString(keyword);
          this.orWhere('title', 'like', `%${escapedKeyword}%`)
              .orWhere('description', 'like', `%${escapedKeyword}%`)
              .orWhere('tags', 'like', `%${escapedKeyword}%`);
        });
      })
      .orderBy('date', 'asc')
      .limit(15);
  }

  if (!matchedByKeyword) {
    events = await db('events')
      .select('id', 'title', 'date', 'time', 'location', 'category', 'status',
              'cover_image', 'description', 'organizer', 'contact', 'tags',
              'max_participants', 'current_participants', 'registration_deadline')
      .where({ status: 'published' })
      .where('date', '>=', db.raw('CURDATE()'))
      .orderBy('date', 'asc')
      .limit(15);
  }

  if (events.length === 0) {
    return { 
      userProfile, 
      events: [], 
      totalUpcoming: 0,
      interestKeywords: keywords,
      expandedKeywords,
      hasInterestMatch
    };
  }

  const eventIds = events.map(e => e.id);

  const [eventClubs, userParticipations] = await Promise.all([
    db('clubs')
      .select('clubs.id', 'clubs.name', 'event_clubs.event_id')
      .join('event_clubs', 'clubs.id', 'event_clubs.club_id')
      .whereIn('event_clubs.event_id', eventIds),
    db('event_participants')
      .select('event_id')
      .where({ user_id: userId })
      .whereIn('status', ['pending', 'approved', 'checked_in'])
  ]);

  const eventClubsMap = {};
  eventClubs.forEach(ec => {
    if (!eventClubsMap[ec.event_id]) eventClubsMap[ec.event_id] = [];
    eventClubsMap[ec.event_id].push(ec.name);
  });

  const joinedEventIds = new Set(userParticipations.map(p => p.event_id));

  const processedEvents = events.map(event => ({
    id: event.id,
    title: event.title,
    date: formatDate(event.date),
    time: event.time,
    location: event.location,
    category: event.category,
    description: event.description ? event.description.substring(0, 200) : '',
    organizer: event.organizer,
    contact: event.contact,
    tags: safeJsonParse(event.tags),
    maxParticipants: event.max_participants,
    currentParticipants: event.current_participants,
    registrationDeadline: formatDate(event.registration_deadline),
    coverImage: event.cover_image,
    relatedClubs: eventClubsMap[event.id] || [],
    isJoined: joinedEventIds.has(event.id)
  }));

  const joinedCount = processedEvents.filter(e => e.isJoined).length;

  return {
    userProfile,
    events: processedEvents,
    totalUpcoming: processedEvents.length,
    joinedEventCount: joinedCount,
    interestKeywords: keywords,
    expandedKeywords,
    hasInterestMatch,
    userMessage: message
  };
}

/**
 * 获取附近活动数据
 * @description 包含用户参与状态
 * @param {number} latitude - 用户纬度
 * @param {number} longitude - 用户经度
 * @param {number} userId - 用户ID
 * @returns {Object} 附近活动上下文
 */
async function getNearbyEventsData(latitude, longitude, userId) {
  const events = await db('events')
    .select('id', 'title', 'date', 'time', 'location', 'latitude', 'longitude',
            'location_name', 'category', 'cover_image', 'description', 'organizer', 'contact')
    .where({ status: 'published' })
    .where('date', '>=', db.raw('CURDATE()'))
    .whereNotNull('latitude')
    .whereNotNull('longitude')
    .orderBy('date', 'asc')
    .limit(50);

  const eventIds = events.map(e => e.id);
  const userParticipations = userId ? await db('event_participants')
    .select('event_id')
    .where({ user_id: userId })
    .whereIn('status', ['pending', 'approved', 'checked_in'])
    .whereIn('event_id', eventIds) : [];
  const joinedEventIds = new Set(userParticipations.map(p => p.event_id));

  const eventsWithDistance = events.map(event => {
    const distance = calculateDistance(
      latitude, longitude,
      parseFloat(event.latitude), parseFloat(event.longitude)
    );

    return {
      id: event.id,
      title: event.title,
      date: formatDate(event.date),
      time: event.time,
      location: event.location,
      locationName: event.location_name,
      category: event.category,
      coverImage: event.cover_image,
      description: event.description ? event.description.substring(0, 200) : '',
      organizer: event.organizer,
      contact: event.contact,
      distance: Math.round(distance),
      isJoined: joinedEventIds.has(event.id)
    };
  });

  eventsWithDistance.sort((a, b) => a.distance - b.distance);

  return {
    userLocation: { latitude, longitude },
    nearbyEvents: eventsWithDistance.slice(0, 10)
  };
}

/**
 * 获取招新信息数据
 * @description 包含用户报名状态和社团详细信息
 * @param {number} userId - 用户ID
 * @returns {Object} 招新信息上下文
 */
async function getRecruitmentData(userId) {
  const recruitments = await db('recruitments')
    .select(
      'recruitments.id', 'recruitments.title', 'recruitments.description',
      'recruitments.cover_image', 'recruitments.status', 'recruitments.end_time',
      'recruitments.contact_info', 'recruitments.requirements',
      'recruitments.current_applicants', 'recruitments.max_applicants',
      'recruitments.club_id',
      'clubs.name as club_name', 'clubs.category as club_category', 'clubs.logo as club_logo',
      'clubs.short_intro as club_short_intro', 'clubs.level as club_level', 'clubs.cover_image as club_cover_image'
    )
    .join('clubs', 'recruitments.club_id', 'clubs.id')
    .where('recruitments.status', 'published')
    .where(function() {
      this.whereNull('recruitments.end_time')
          .orWhere('recruitments.end_time', '>', db.fn.now());
    })
    .orderBy('recruitments.created_at', 'desc');

  if (recruitments.length === 0) {
    return { recruitments: [], totalRecruitments: 0 };
  }

  const recruitmentIds = recruitments.map(r => r.id);
  const userApplications = userId ? await db('applications')
    .select('recruitment_id', 'status')
    .where({ user_id: userId })
    .whereIn('recruitment_id', recruitmentIds) : [];

  const appliedMap = {};
  userApplications.forEach(app => {
    appliedMap[app.recruitment_id] = app.status;
  });

  const joinedClubs = userId ? await db('club_members')
    .select('club_id')
    .where({ user_id: userId, status: 'active' }) : [];
  const joinedClubIds = new Set(joinedClubs.map(c => c.club_id));

  const processedRecruitments = recruitments.map(r => ({
    id: r.id,
    title: r.title,
    description: r.description ? r.description.substring(0, 300) : '',
    coverImage: r.cover_image,
    endTime: formatDate(r.end_time),
    contactInfo: r.contact_info,
    requirements: safeJsonParse(r.requirements),
    currentApplicants: r.current_applicants,
    maxApplicants: r.max_applicants,
    club: {
      id: r.club_id,
      name: r.club_name,
      category: r.club_category,
      level: LEVEL_MAP[r.club_level] || r.club_level,
      logo: r.club_logo,
      coverImage: r.club_cover_image,
      shortIntro: r.club_short_intro,
      isJoined: joinedClubIds.has(r.club_id)
    },
    applicationStatus: appliedMap[r.id] || null,
    isApplied: !!appliedMap[r.id]
  }));

  const appliedCount = processedRecruitments.filter(r => r.isApplied).length;

  return {
    recruitments: processedRecruitments,
    totalRecruitments: processedRecruitments.length,
    appliedCount
  };
}

/**
 * 获取帮助上下文
 * @description 提供平台功能说明
 * @returns {Object} 帮助上下文
 */
function getHelpContext() {
  return {
    features: [
      { name: '社团推荐', desc: '根据你的兴趣推荐合适的社团', examples: ['推荐社团', '有什么社团', '我喜欢音乐'] },
      { name: '活动推荐', desc: '查看即将举行的校园活动', examples: ['有什么活动', '近期活动', '活动推荐'] },
      { name: '社团详情', desc: '了解社团的具体信息', examples: ['音乐社怎么样', '社团社长是谁'] },
      { name: '招新信息', desc: '查看正在招新的社团', examples: ['有哪些社团在招新', '怎么加入社团'] },
      { name: '附近活动', desc: '根据位置推荐周边活动', examples: ['附近有什么活动', '最近的活动'] }
    ]
  };
}

/**
 * 获取通用上下文（兜底）
 * @description 即使用户意图不明确，也提供完整的社团列表，避免AI幻觉
 * @param {number} userId - 用户ID
 * @returns {Object} 通用上下文
 */
async function getGeneralContext(userId) {
  const userProfile = await getUserProfile(userId);
  const joinedClubIds = userProfile ? userProfile.joinedClubs.map(c => c.id) : [];

  const allClubs = await db('clubs')
    .select('id', 'name', 'short_intro', 'category', 'level', 'logo', 'cover_image', 'gallery')
    .orderBy('id', 'asc');

  const clubs = allClubs.map(club => mapClubData(club, joinedClubIds));

  const [clubCount, eventCount, recruitmentCount, categories] = await Promise.all([
    db('clubs').count('id as count').first(),
    db('events').where({ status: 'published' }).count('id as count').first(),
    db('recruitments')
      .where({ status: 'published' })
      .where(function() {
        this.whereNull('end_time').orWhere('end_time', '>', db.fn.now());
      })
      .count('id as count')
      .first(),
    db('clubs')
      .select('category')
      .count('id as count')
      .groupBy('category')
  ]);

  return {
    userProfile,
    clubs,
    stats: {
      totalClubs: clubCount ? clubCount.count : 0,
      activeEvents: eventCount ? eventCount.count : 0,
      activeRecruitments: recruitmentCount ? recruitmentCount.count : 0
    },
    categories: categories.map(c => ({ name: c.category, count: c.count }))
  };
}

/**
 * 根据意图检索上下文数据
 * @param {string} intent - 意图类型
 * @param {number} userId - 用户ID
 * @param {string} message - 用户消息
 * @param {Object} options - 额外选项（如位置信息）
 * @returns {Object} 上下文数据
 */
async function retrieveContext(intent, userId, message, options = {}) {
  try {
    switch (intent) {
      case 'club_recommend':
        return await getClubRecommendationData(userId, message);
      case 'club_info':
        return await getClubInfoByName(message);
      case 'event_recommend':
        return await getEventRecommendationData(userId, message);
      case 'nearby_event':
        if (options.latitude && options.longitude) {
          return await getNearbyEventsData(options.latitude, options.longitude, userId);
        }
        return { note: '用户未提供位置信息，无法查询附近活动，请引导用户提供位置或查看所有活动' };
      case 'recruitment_info':
        return await getRecruitmentData(userId);
      case 'help':
        return getHelpContext();
      case 'badge_info':
        return await getBadgeInfoData(userId);
      case 'badge_recommend':
        return await getBadgeRecommendationData(userId, message);
      case 'activity_info':
        return await getActivityInfoData(userId);
      default:
        return await getGeneralContext(userId);
    }
  } catch (error) {
    logger.error('上下文检索失败:', { error: error.message, intent, userId });
    return { error: '数据检索失败' };
  }
}

/**
 * 获取用户羽章信息
 * @description 包含用户已获得的羽章、统计数据、活跃度信息
 * @param {number} userId - 用户ID
 * @returns {Object} 羽章信息上下文
 */
async function getBadgeInfoData(userId) {
  const { calculateActivityScore } = require('../activityStatsService');
  
  const [userBadges, allBadges, activityScore, userProfile] = await Promise.all([
    db('user_badges')
      .join('badges', 'user_badges.badge_id', 'badges.id')
      .where('user_badges.user_id', userId)
      .select(
        'badges.id', 'badges.code', 'badges.name', 'badges.description',
        'badges.icon', 'badges.type', 'badges.rarity', 'badges.category',
        'badges.points', 'badges.trigger_type', 'badges.trigger_condition',
        'user_badges.earned_at', 'user_badges.is_displayed', 'user_badges.display_order'
      )
      .orderBy('user_badges.earned_at', 'desc'),
    
    db('badges')
      .where('is_active', true)
      .select('id', 'code', 'name', 'type', 'rarity', 'category', 'points'),
    
    calculateActivityScore(userId),
    
    getUserProfile(userId)
  ]);
  
  const stats = {
    total: userBadges.length,
    totalPoints: userBadges.reduce((sum, b) => sum + b.points, 0),
    byType: { achievement: 0, level: 0, identity: 0 },
    byRarity: { common: 0, rare: 0, epic: 0, legendary: 0 }
  };
  
  userBadges.forEach(badge => {
    stats.byType[badge.type]++;
    stats.byRarity[badge.rarity]++;
  });
  
  const earnedBadgeIds = new Set(userBadges.map(b => b.id));
  const unearnedBadges = allBadges.filter(b => !earnedBadgeIds.has(b.id));
  
  return {
    userProfile,
    userBadges: userBadges.map(b => ({
      id: b.id,
      code: b.code,
      name: b.name,
      description: b.description,
      icon: b.icon,
      type: b.type,
      rarity: b.rarity,
      category: b.category,
      points: b.points,
      earnedAt: formatDate(b.earned_at),
      isDisplayed: b.is_displayed,
      displayOrder: b.display_order
    })),
    unearnedBadges: unearnedBadges.map(b => ({
      id: b.id,
      code: b.code,
      name: b.name,
      type: b.type,
      rarity: b.rarity,
      category: b.category,
      points: b.points
    })),
    stats,
    activityScore
  };
}

/**
 * 获取羽章推荐数据
 * @description 根据用户画像和活跃度，智能推荐适合的羽章
 * @param {number} userId - 用户ID
 * @param {string} message - 用户消息（用于提取兴趣）
 * @returns {Object} 羽章推荐上下文
 */
async function getBadgeRecommendationData(userId, message) {
  const { calculateActivityScore } = require('../activityStatsService');
  
  const [userBadges, allBadges, activityScore, userProfile] = await Promise.all([
    db('user_badges')
      .join('badges', 'user_badges.badge_id', 'badges.id')
      .where('user_badges.user_id', userId)
      .select('badges.id', 'badges.type', 'badges.rarity', 'badges.category'),
    
    db('badges')
      .where('is_active', true)
      .select('id', 'code', 'name', 'description', 'icon', 'type', 'rarity', 
              'category', 'points', 'trigger_type', 'trigger_condition'),
    
    calculateActivityScore(userId),
    
    getUserProfile(userId)
  ]);
  
  const earnedBadgeIds = new Set(userBadges.map(b => b.id));
  const unearnedBadges = allBadges.filter(b => !earnedBadgeIds.has(b.id));
  
  const recommendations = await generateBadgeRecommendations(
    userId, 
    unearnedBadges, 
    userProfile, 
    activityScore,
    message
  );
  
  return {
    userProfile,
    activityScore,
    earnedBadges: userBadges,
    unearnedBadges,
    recommendations
  };
}

/**
 * 生成羽章推荐
 * @description 根据用户画像、活跃度、兴趣关键词智能推荐羽章
 */
async function generateBadgeRecommendations(userId, unearnedBadges, userProfile, activityScore, message) {
  const recommendations = [];
  
  const interestInfo = extractInterestKeywords(message || '');
  
  for (const badge of unearnedBadges) {
    const recommendation = {
      badge: {
        id: badge.id,
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        type: badge.type,
        rarity: badge.rarity,
        category: badge.category,
        points: badge.points
      },
      matchScore: 0,
      reasons: [],
      progress: null
    };
    
    const condition = typeof badge.trigger_condition === 'string'
      ? JSON.parse(badge.trigger_condition || '{}')
      : badge.trigger_condition;
    
    if (badge.type === 'level' && condition.conditions) {
      const { min, max } = condition.conditions.activity_score || {};
      if (min !== undefined && max !== undefined) {
        if (activityScore >= min && activityScore <= max) {
          recommendation.matchScore = 100;
          recommendation.reasons.push(`你的活跃度${activityScore}分，正好符合此羽章要求`);
        } else if (activityScore < min) {
          recommendation.matchScore = Math.max(0, 100 - (min - activityScore) * 2);
          recommendation.reasons.push(`再提升${min - activityScore}分活跃度即可获得`);
          recommendation.progress = {
            current: activityScore,
            target: min,
            percentage: Math.round((activityScore / min) * 100)
          };
        }
      }
    }
    
    if (badge.type === 'achievement' && condition.conditions) {
      const progress = await calculateAchievementProgress(userId, condition.conditions);
      recommendation.progress = progress;
      
      if (progress.percentage >= 80) {
        recommendation.matchScore = 90;
        recommendation.reasons.push(`即将完成！进度${progress.percentage}%`);
      } else if (progress.percentage >= 50) {
        recommendation.matchScore = 70;
        recommendation.reasons.push(`进度良好，已完成${progress.percentage}%`);
      } else {
        recommendation.matchScore = 40;
      }
    }
    
    if (interestInfo.categories.length > 0 && badge.category) {
      if (interestInfo.categories.includes(badge.category.toLowerCase())) {
        recommendation.matchScore += 20;
        recommendation.reasons.push(`符合你提到的兴趣：${interestInfo.keywords.join('、')}`);
      }
    }
    
    if (recommendation.matchScore > 0) {
      recommendations.push(recommendation);
    }
  }
  
  recommendations.sort((a, b) => b.matchScore - a.matchScore);
  
  return recommendations.slice(0, 10);
}

/**
 * 计算成就羽章进度
 */
async function calculateAchievementProgress(userId, conditions) {
  let current = 0;
  let target = 0;
  
  if (conditions.total_clubs) {
    const count = await db('club_members')
      .where('user_id', userId)
      .where('status', 'active')
      .count('club_id as count')
      .first();
    current = count.count;
    target = conditions.total_clubs.gte || 0;
  }
  
  if (conditions.total_events) {
    const count = await db('event_participants')
      .where('user_id', userId)
      .whereIn('status', ['approved', 'checked_in'])
      .count('event_id as count')
      .first();
    current = count.count;
    target = conditions.total_events.gte || 0;
  }
  
  if (conditions.total_comments) {
    const count = await db('comments')
      .where('user_id', userId)
      .count('id as count')
      .first();
    current = count.count;
    target = conditions.total_comments.gte || 0;
  }
  
  const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  
  return {
    current,
    target,
    percentage
  };
}

/**
 * 获取用户活跃度信息
 * @description 包含活跃度分数、等级、提升建议
 * @param {number} userId - 用户ID
 * @returns {Object} 活跃度信息上下文
 */
async function getActivityInfoData(userId) {
  const { calculateActivityScore } = require('../activityStatsService');
  
  const [activityScore, userProfile, recentActivity] = await Promise.all([
    calculateActivityScore(userId),
    getUserProfile(userId),
    
    db('user_activity_stats')
      .where('user_id', userId)
      .where('stat_date', '>=', db.raw('DATE_SUB(CURDATE(), INTERVAL 30 DAY)'))
      .select(
        db.raw('SUM(login_count) as total_logins'),
        db.raw('SUM(event_count) as total_events'),
        db.raw('SUM(comment_count) as total_comments'),
        db.raw('SUM(application_count) as total_applications')
      )
      .first()
  ]);
  
  let level = 'bronze';
  let levelName = '青铜';
  let nextLevel = 'silver';
  let nextLevelName = '白银';
  let pointsToNext = 31 - activityScore;
  
  if (activityScore >= 81) {
    level = 'diamond';
    levelName = '钻石';
    nextLevel = null;
    nextLevelName = null;
    pointsToNext = 0;
  } else if (activityScore >= 61) {
    level = 'gold';
    levelName = '黄金';
    nextLevel = 'diamond';
    nextLevelName = '钻石';
    pointsToNext = 81 - activityScore;
  } else if (activityScore >= 31) {
    level = 'silver';
    levelName = '白银';
    nextLevel = 'gold';
    nextLevelName = '黄金';
    pointsToNext = 61 - activityScore;
  }
  
  const suggestions = generateActivitySuggestions(
    recentActivity || { total_logins: 0, total_events: 0, total_comments: 0, total_applications: 0 },
    userProfile
  );
  
  return {
    userProfile,
    activityScore,
    level,
    levelName,
    nextLevel,
    nextLevelName,
    pointsToNext,
    recentActivity: {
      logins: recentActivity?.total_logins || 0,
      events: recentActivity?.total_events || 0,
      comments: recentActivity?.total_comments || 0,
      applications: recentActivity?.total_applications || 0
    },
    suggestions
  };
}

/**
 * 生成活跃度提升建议
 */
function generateActivitySuggestions(recentActivity, userProfile) {
  const suggestions = [];
  
  if (recentActivity.total_events < 3) {
    suggestions.push({
      type: 'event',
      priority: 'high',
      suggestion: '多参加活动可以快速提升活跃度，每个活动+5分',
      action: '查看近期活动'
    });
  }
  
  if (recentActivity.total_comments < 5) {
    suggestions.push({
      type: 'comment',
      priority: 'medium',
      suggestion: '多发表评论可以提升活跃度，每条评论+2分',
      action: '去评论'
    });
  }
  
  if (recentActivity.total_applications < 2) {
    suggestions.push({
      type: 'application',
      priority: 'medium',
      suggestion: '报名参加社团招新可以提升活跃度，每次报名+3分',
      action: '查看招新信息'
    });
  }
  
  if (userProfile.joinedClubs.length < 3) {
    suggestions.push({
      type: 'club',
      priority: 'low',
      suggestion: '加入更多社团可以解锁更多羽章',
      action: '浏览社团'
    });
  }
  
  return suggestions;
}

module.exports = {
  getUserProfile,
  getClubRecommendationData,
  getClubInfoByName,
  getEventRecommendationData,
  getNearbyEventsData,
  getRecruitmentData,
  getHelpContext,
  getGeneralContext,
  retrieveContext,
  getBadgeInfoData,
  getBadgeRecommendationData,
  getActivityInfoData
};
