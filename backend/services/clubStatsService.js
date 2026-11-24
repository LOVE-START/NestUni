/**
 * 社团数据分析服务
 * @description 提供社团运营数据的统计和分析功能
 */

const knex = require('../config/database');
const logger = require('../config/logger');

/**
 * 获取时间范围
 * @description 根据周期类型返回起止时间
 * @param {string} period - 周期类型: semester, year
 * @returns {Object} { startDate, endDate }
 */
function getTimeRange(period = 'semester') {
  const now = new Date();
  const endDate = now;
  let startDate;

  if (period === 'semester') {
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 5);
  } else if (period === 'year') {
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 12);
  } else {
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 6);
  }

  return { startDate, endDate };
}

/**
 * 计算趋势百分比
 * @description 计算当前值相对于之前值的变化百分比
 * @param {number} current - 当前值
 * @param {number} previous - 之前值
 * @returns {number} 变化百分比
 */
function calculateTrend(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * 获取社团综合概览数据
 * @description 统计社团的核心运营指标
 * @param {number} clubId - 社团ID
 * @param {string} period - 时间周期
 * @returns {Promise<Object>} 概览数据
 */
async function getClubOverview(clubId, period = 'semester') {
  try {
    const { startDate, endDate } = getTimeRange(period);
    
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - (period === 'year' ? 12 : 5));
    const previousPeriodEnd = new Date(startDate);

    const [
      currentMembers,
      currentEvents,
      currentRecruitments,
      memberIds
    ] = await Promise.all([
      knex('club_members')
        .where('club_id', clubId)
        .where('status', 'active')
        .count('* as count')
        .first(),
      
      knex('events')
        .join('event_clubs', 'events.id', 'event_clubs.event_id')
        .where('event_clubs.club_id', clubId)
        .where('events.status', 'published')
        .where('events.created_at', '>=', startDate)
        .where('events.created_at', '<=', endDate)
        .count('* as count')
        .first(),
      
      knex('applications')
        .join('recruitments', 'applications.recruitment_id', 'recruitments.id')
        .where('recruitments.club_id', clubId)
        .where('applications.submitted_at', '>=', startDate)
        .where('applications.submitted_at', '<=', endDate)
        .count('* as count')
        .first(),
      
      knex('club_members')
        .where('club_id', clubId)
        .where('status', 'active')
        .pluck('user_id')
    ]);

    let avgActivityScore = 0;
    if (memberIds.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activityStats = await knex('user_activity_stats')
        .whereIn('user_id', memberIds)
        .where('stat_date', '>=', thirtyDaysAgo)
        .select(
          'user_id',
          knex.raw('AVG(activity_score) as avg_score')
        )
        .groupBy('user_id');
      
      if (activityStats.length > 0) {
        const totalScore = activityStats.reduce((sum, stat) => sum + parseFloat(stat.avg_score || 0), 0);
        avgActivityScore = Math.round(totalScore / activityStats.length);
      }
    }

    const [
      previousMembers,
      previousEvents,
      previousRecruitments
    ] = await Promise.all([
      knex('club_members')
        .where('club_id', clubId)
        .where('status', 'active')
        .where('joined_at', '>=', previousPeriodStart)
        .where('joined_at', '<', previousPeriodEnd)
        .count('* as count')
        .first(),
      
      knex('events')
        .join('event_clubs', 'events.id', 'event_clubs.event_id')
        .where('event_clubs.club_id', clubId)
        .where('events.status', 'published')
        .where('events.created_at', '>=', previousPeriodStart)
        .where('events.created_at', '<', previousPeriodEnd)
        .count('* as count')
        .first(),
      
      knex('applications')
        .join('recruitments', 'applications.recruitment_id', 'recruitments.id')
        .where('recruitments.club_id', clubId)
        .where('applications.submitted_at', '>=', previousPeriodStart)
        .where('applications.submitted_at', '<', previousPeriodEnd)
        .count('* as count')
        .first()
    ]);

    const result = {
      memberCount: currentMembers.count || 0,
      eventCount: currentEvents.count || 0,
      recruitmentCount: currentRecruitments.count || 0,
      avgActivityScore: avgActivityScore,
      trends: {
        memberTrend: calculateTrend(currentMembers.count || 0, previousMembers.count || 0),
        eventTrend: calculateTrend(currentEvents.count || 0, previousEvents.count || 0),
        recruitmentTrend: calculateTrend(currentRecruitments.count || 0, previousRecruitments.count || 0),
        activityTrend: 0
      }
    };

    logger.info('获取社团概览数据成功:', { clubId, period, result });
    return result;
  } catch (error) {
    logger.error('获取社团概览数据失败:', { 
      error: error.message, 
      clubId, 
      period 
    });
    throw error;
  }
}

/**
 * 获取社团活动数据统计
 * @description 统计活动的参与趋势、类型分布、参与率等
 * @param {number} clubId - 社团ID
 * @param {string} period - 时间周期
 * @param {number} months - 月份数
 * @returns {Promise<Object>} 活动统计数据
 */
async function getClubEventStats(clubId, period = 'semester', months = 6) {
  try {
    const { startDate, endDate } = getTimeRange(period);
    
    const participationTrend = [];
    const trendStartDate = new Date();
    trendStartDate.setMonth(trendStartDate.getMonth() - months);
    
    for (let i = 0; i < months; i++) {
      const monthStart = new Date(trendStartDate);
      monthStart.setMonth(monthStart.getMonth() + i);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      const count = await knex('event_participants')
        .join('events', 'event_participants.event_id', 'events.id')
        .join('event_clubs', 'events.id', 'event_clubs.event_id')
        .where('event_clubs.club_id', clubId)
        .where('event_participants.registered_at', '>=', monthStart)
        .where('event_participants.registered_at', '<', monthEnd)
        .where('event_participants.status', 'approved')
        .count('* as count')
        .first();
      
      const monthStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
      participationTrend.push({
        month: monthStr,
        count: count.count || 0
      });
    }

    const categoryDistribution = await knex('events')
      .join('event_clubs', 'events.id', 'event_clubs.event_id')
      .where('event_clubs.club_id', clubId)
      .where('events.status', 'published')
      .where('events.created_at', '>=', startDate)
      .where('events.created_at', '<=', endDate)
      .select('events.category')
      .count('* as count')
      .groupBy('events.category');

    const events = await knex('events')
      .join('event_clubs', 'events.id', 'event_clubs.event_id')
      .where('event_clubs.club_id', clubId)
      .where('events.status', 'published')
      .whereNotNull('events.max_participants')
      .where('events.max_participants', '>', 0)
      .select(
        'events.id',
        'events.title',
        'events.max_participants',
        'events.current_participants'
      )
      .orderByRaw('(current_participants / max_participants) DESC')
      .limit(10);

    const participationRate = events.map(event => ({
      eventId: event.id,
      eventName: event.title,
      rate: Math.round((event.current_participants / event.max_participants) * 100) / 100
    }));

    const result = {
      participationTrend,
      categoryDistribution: categoryDistribution.map(item => ({
        category: item.category || '未分类',
        count: item.count
      })),
      participationRate
    };

    logger.info('获取社团活动统计成功:', { clubId, period, months });
    return result;
  } catch (error) {
    logger.error('获取社团活动统计失败:', { 
      error: error.message, 
      clubId, 
      period 
    });
    throw error;
  }
}

/**
 * 获取社团成员数据统计
 * @description 统计成员活跃度趋势、等级分布、活跃排行等
 * @param {number} clubId - 社团ID
 * @param {string} period - 时间周期
 * @param {number} months - 月份数
 * @returns {Promise<Object>} 成员统计数据
 */
async function getClubMemberStats(clubId, period = 'semester', months = 6) {
  try {
    const memberIds = await knex('club_members')
      .where('club_id', clubId)
      .where('status', 'active')
      .pluck('user_id');

    if (memberIds.length === 0) {
      return {
        activityTrend: [],
        levelDistribution: [],
        topMembers: []
      };
    }

    const activityTrend = [];
    const trendStartDate = new Date();
    trendStartDate.setMonth(trendStartDate.getMonth() - months);
    
    for (let i = 0; i < months; i++) {
      const monthStart = new Date(trendStartDate);
      monthStart.setMonth(monthStart.getMonth() + i);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      const stats = await knex('user_activity_stats')
        .whereIn('user_id', memberIds)
        .where('stat_date', '>=', monthStart)
        .where('stat_date', '<', monthEnd)
        .select(knex.raw('AVG(activity_score) as avg_score'))
        .first();
      
      const monthStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
      activityTrend.push({
        month: monthStr,
        avgScore: Math.round(stats.avg_score || 0)
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const memberScores = await knex('user_activity_stats')
      .whereIn('user_id', memberIds)
      .where('stat_date', '>=', thirtyDaysAgo)
      .select(
        'user_id',
        knex.raw('AVG(activity_score) as avg_score')
      )
      .groupBy('user_id');

    const levelDistribution = {
      bronze: 0,
      silver: 0,
      gold: 0,
      diamond: 0
    };

    memberScores.forEach(stat => {
      const score = Math.floor(stat.avg_score || 0);
      if (score <= 30) levelDistribution.bronze++;
      else if (score <= 60) levelDistribution.silver++;
      else if (score <= 80) levelDistribution.gold++;
      else levelDistribution.diamond++;
    });

    const totalMembers = memberScores.length;
    const levelDistributionArray = [
      { level: '青铜', count: levelDistribution.bronze, percentage: totalMembers > 0 ? Math.round((levelDistribution.bronze / totalMembers) * 100) : 0 },
      { level: '白银', count: levelDistribution.silver, percentage: totalMembers > 0 ? Math.round((levelDistribution.silver / totalMembers) * 100) : 0 },
      { level: '黄金', count: levelDistribution.gold, percentage: totalMembers > 0 ? Math.round((levelDistribution.gold / totalMembers) * 100) : 0 },
      { level: '钻石', count: levelDistribution.diamond, percentage: totalMembers > 0 ? Math.round((levelDistribution.diamond / totalMembers) * 100) : 0 }
    ];

    const topMembersData = await knex('user_activity_stats')
      .whereIn('user_id', memberIds)
      .where('stat_date', '>=', thirtyDaysAgo)
      .select(
        'user_id',
        knex.raw('AVG(activity_score) as avg_score')
      )
      .groupBy('user_id')
      .orderBy('avg_score', 'desc')
      .limit(10);

    const userIds = topMembersData.map(item => item.user_id);
    const users = await knex('users')
      .whereIn('id', userIds)
      .select('id', 'nickname');

    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user.nickname;
    });

    const topMembers = topMembersData.map(item => {
      const score = Math.floor(item.avg_score || 0);
      let level = '青铜';
      if (score > 80) level = '钻石';
      else if (score > 60) level = '黄金';
      else if (score > 30) level = '白银';
      
      return {
        userId: item.user_id,
        nickname: userMap[item.user_id] || '未知用户',
        score: score,
        level: level
      };
    });

    const result = {
      activityTrend,
      levelDistribution: levelDistributionArray,
      topMembers
    };

    logger.info('获取社团成员统计成功:', { clubId, period, months });
    return result;
  } catch (error) {
    logger.error('获取社团成员统计失败:', { 
      error: error.message, 
      clubId, 
      period 
    });
    throw error;
  }
}

/**
 * 获取社团招新数据统计
 * @description 统计招新转化漏斗、历年对比、来源分析等
 * @param {number} clubId - 社团ID
 * @param {string} period - 时间周期
 * @returns {Promise<Object>} 招新统计数据
 */
async function getClubRecruitmentStats(clubId, period = 'semester') {
  try {
    const { startDate, endDate } = getTimeRange(period);
    
    const applications = await knex('applications')
      .join('recruitments', 'applications.recruitment_id', 'recruitments.id')
      .where('recruitments.club_id', clubId)
      .where('applications.submitted_at', '>=', startDate)
      .where('applications.submitted_at', '<=', endDate)
      .select('applications.status');

    const funnel = {
      views: 0,
      applications: applications.length,
      interviews: applications.filter(a => ['interviewing', 'accepted', 'rejected'].includes(a.status)).length,
      accepted: applications.filter(a => a.status === 'accepted').length,
      conversionRates: {
        application: 0,
        interview: 0,
        accepted: 0
      }
    };

    funnel.views = Math.round(funnel.applications * 2);

    if (funnel.views > 0) {
      funnel.conversionRates.application = Math.round((funnel.applications / funnel.views) * 100) / 100;
    }
    if (funnel.applications > 0) {
      funnel.conversionRates.interview = Math.round((funnel.interviews / funnel.applications) * 100) / 100;
    }
    if (funnel.interviews > 0) {
      funnel.conversionRates.accepted = Math.round((funnel.accepted / funnel.interviews) * 100) / 100;
    }

    const currentYear = new Date().getFullYear();
    const yearlyComparison = [];

    for (let year = currentYear - 2; year <= currentYear; year++) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59);
      
      const yearStats = await knex('applications')
        .join('recruitments', 'applications.recruitment_id', 'recruitments.id')
        .where('recruitments.club_id', clubId)
        .where('applications.submitted_at', '>=', yearStart)
        .where('applications.submitted_at', '<=', yearEnd)
        .select('applications.status');

      yearlyComparison.push({
        year: year,
        applications: yearStats.length,
        accepted: yearStats.filter(a => a.status === 'accepted').length
      });
    }

    const sourceDistribution = await knex('applications')
      .join('recruitments', 'applications.recruitment_id', 'recruitments.id')
      .where('recruitments.club_id', clubId)
      .where('applications.submitted_at', '>=', startDate)
      .where('applications.submitted_at', '<=', endDate)
      .select(
        'recruitments.id',
        'recruitments.title',
        knex.raw('COUNT(*) as count')
      )
      .groupBy('recruitments.id', 'recruitments.title')
      .orderBy('count', 'desc');

    const result = {
      funnel,
      yearlyComparison,
      sourceDistribution: sourceDistribution.map(item => ({
        recruitmentId: item.id,
        title: item.title,
        count: item.count
      }))
    };

    logger.info('获取社团招新统计成功:', { clubId, period });
    return result;
  } catch (error) {
    logger.error('获取社团招新统计失败:', { 
      error: error.message, 
      clubId, 
      period 
    });
    throw error;
  }
}

/**
 * 获取管理员全校数据概览
 * @description 统计全校社团的核心指标
 * @param {string} period - 时间周期
 * @returns {Promise<Object>} 全校概览数据
 */
async function getAdminOverview(period = 'semester') {
  try {
    const { startDate, endDate } = getTimeRange(period);
    
    const [
      clubCount,
      eventCount,
      applicationCount,
      userCount
    ] = await Promise.all([
      knex('clubs').count('* as count').first(),
      
      knex('events')
        .where('status', 'published')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .count('* as count')
        .first(),
      
      knex('applications')
        .where('submitted_at', '>=', startDate)
        .where('submitted_at', '<=', endDate)
        .count('* as count')
        .first(),
      
      knex('users').count('* as count').first()
    ]);

    const clubs = await knex('clubs')
      .select('id', 'name')
      .limit(20);

    const clubActivityScores = [];
    for (const club of clubs) {
      const memberIds = await knex('club_members')
        .where('club_id', club.id)
        .where('status', 'active')
        .pluck('user_id');

      if (memberIds.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const avgScore = await knex('user_activity_stats')
          .whereIn('user_id', memberIds)
          .where('stat_date', '>=', thirtyDaysAgo)
          .select(knex.raw('AVG(activity_score) as avg_score'))
          .first();

        clubActivityScores.push({
          clubId: club.id,
          clubName: club.name,
          avgActivity: Math.round(avgScore.avg_score || 0)
        });
      }
    }

    clubActivityScores.sort((a, b) => b.avgActivity - a.avgActivity);
    const clubRankings = clubActivityScores.slice(0, 10);

    const categoryDistribution = await knex('events')
      .where('status', 'published')
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', endDate)
      .select('category')
      .count('* as count')
      .groupBy('category');

    const totalEvents = categoryDistribution.reduce((sum, item) => sum + item.count, 0);
    const categoryDistributionArray = categoryDistribution.map(item => ({
      category: item.category || '未分类',
      count: item.count,
      percentage: totalEvents > 0 ? Math.round((item.count / totalEvents) * 100) : 0
    }));

    const result = {
      clubCount: clubCount.count || 0,
      eventCount: eventCount.count || 0,
      applicationCount: applicationCount.count || 0,
      userCount: userCount.count || 0,
      clubRankings,
      categoryDistribution: categoryDistributionArray
    };

    logger.info('获取管理员概览数据成功:', { period });
    return result;
  } catch (error) {
    logger.error('获取管理员概览数据失败:', { 
      error: error.message, 
      period 
    });
    throw error;
  }
}

module.exports = {
  getTimeRange,
  calculateTrend,
  getClubOverview,
  getClubEventStats,
  getClubMemberStats,
  getClubRecruitmentStats,
  getAdminOverview
};
