# 社团数据分析可视化功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为社团会长和管理员提供轻量级数据分析面板，通过可视化图表展示活动参与度、成员活跃度、招新转化率等关键指标。

**Architecture:** 采用前后端分离架构，后端提供数据分析 API，前端使用 ECharts 图表库进行可视化展示。后端基于现有的数据库结构，通过聚合查询计算统计指标。前端在社团管理页和管理员面板中新增数据分析组件。

**Tech Stack:** Node.js + Express + Knex.js (后端), 微信小程序 + ECharts (前端)

---

## 阶段一：后端 API 开发

### Task 1: 创建数据分析服务基础结构

**Files:**
- Create: `backend/services/clubStatsService.js`

**Step 1: 创建服务文件并添加基础结构**

```javascript
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
    // 本学期：假设每学期5个月
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 5);
  } else if (period === 'year') {
    // 本学年：12个月
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 12);
  } else {
    // 默认6个月
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

module.exports = {
  getTimeRange,
  calculateTrend
};
```

**Step 2: 验证文件创建成功**

检查文件是否存在并确认代码结构正确。

**Step 3: 提交**

```bash
git add backend/services/clubStatsService.js
git commit -m "feat: 创建社团数据分析服务基础结构"
```

---

### Task 2: 实现综合概览 API

**Files:**
- Modify: `backend/services/clubStatsService.js`

**Step 1: 添加综合概览统计函数**

在 `clubStatsService.js` 中添加以下代码：

```javascript
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
    
    // 计算上一周期的时间范围
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - (period === 'year' ? 12 : 5));
    const previousPeriodEnd = new Date(startDate);

    // 并行查询当前周期数据
    const [
      currentMembers,
      currentEvents,
      currentRecruitments,
      memberIds
    ] = await Promise.all([
      // 成员总数
      knex('club_members')
        .where('club_id', clubId)
        .where('status', 'active')
        .count('* as count')
        .first(),
      
      // 活动总数
      knex('events')
        .join('event_clubs', 'events.id', 'event_clubs.event_id')
        .where('event_clubs.club_id', clubId)
        .where('events.status', 'published')
        .where('events.created_at', '>=', startDate)
        .where('events.created_at', '<=', endDate)
        .count('* as count')
        .first(),
      
      // 招新人数
      knex('applications')
        .join('recruitments', 'applications.recruitment_id', 'recruitments.id')
        .where('recruitments.club_id', clubId)
        .where('applications.submitted_at', '>=', startDate)
        .where('applications.submitted_at', '<=', endDate)
        .count('* as count')
        .first(),
      
      // 获取成员ID列表
      knex('club_members')
        .where('club_id', clubId)
        .where('status', 'active')
        .pluck('user_id')
    ]);

    // 计算平均活跃度
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

    // 查询上一周期数据（用于趋势对比）
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
        activityTrend: 0 // 活跃度趋势需要历史数据支持，暂时设为0
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

module.exports = {
  getTimeRange,
  calculateTrend,
  getClubOverview
};
```

**Step 2: 提交**

```bash
git add backend/services/clubStatsService.js
git commit -m "feat: 实现社团综合概览统计功能"
```

---

### Task 3: 实现活动数据统计 API

**Files:**
- Modify: `backend/services/clubStatsService.js`

**Step 1: 添加活动数据统计函数**

在 `clubStatsService.js` 中添加以下代码：

```javascript
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
    
    // 1. 活动参与趋势（按月统计）
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

    // 2. 活动类型分布
    const categoryDistribution = await knex('events')
      .join('event_clubs', 'events.id', 'event_clubs.event_id')
      .where('event_clubs.club_id', clubId)
      .where('events.status', 'published')
      .where('events.created_at', '>=', startDate)
      .where('events.created_at', '<=', endDate)
      .select('events.category')
      .count('* as count')
      .groupBy('events.category');

    // 3. 活动参与率排行（Top 10）
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

module.exports = {
  getTimeRange,
  calculateTrend,
  getClubOverview,
  getClubEventStats
};
```

**Step 2: 提交**

```bash
git add backend/services/clubStatsService.js
git commit -m "feat: 实现社团活动数据统计功能"
```

---

### Task 4: 实现成员数据统计 API

**Files:**
- Modify: `backend/services/clubStatsService.js`

**Step 1: 添加成员数据统计函数**

在 `clubStatsService.js` 中添加以下代码：

```javascript
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
    // 获取成员ID列表
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

    // 1. 成员活跃度趋势（按月统计）
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

    // 2. 成员等级分布
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
      bronze: 0,    // 0-30
      silver: 0,    // 31-60
      gold: 0,      // 61-80
      diamond: 0    // 81-100
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

    // 3. 活跃成员排行（Top 10）
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

    // 获取用户信息
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

module.exports = {
  getTimeRange,
  calculateTrend,
  getClubOverview,
  getClubEventStats,
  getClubMemberStats
};
```

**Step 2: 提交**

```bash
git add backend/services/clubStatsService.js
git commit -m "feat: 实现社团成员数据统计功能"
```

---

### Task 5: 实现招新数据统计 API

**Files:**
- Modify: `backend/services/clubStatsService.js`

**Step 1: 添加招新数据统计函数**

在 `clubStatsService.js` 中添加以下代码：

```javascript
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
    
    // 1. 招新转化漏斗
    const applications = await knex('applications')
      .join('recruitments', 'applications.recruitment_id', 'recruitments.id')
      .where('recruitments.club_id', clubId)
      .where('applications.submitted_at', '>=', startDate)
      .where('applications.submitted_at', '<=', endDate)
      .select('applications.status');

    const funnel = {
      views: 0, // 浏览量需要新增字段支持，暂时用报名数的2倍估算
      applications: applications.length,
      interviews: applications.filter(a => ['interviewing', 'accepted', 'rejected'].includes(a.status)).length,
      accepted: applications.filter(a => a.status === 'accepted').length,
      conversionRates: {
        application: 0,
        interview: 0,
        accepted: 0
      }
    };

    // 估算浏览量
    funnel.views = Math.round(funnel.applications * 2);

    // 计算转化率
    if (funnel.views > 0) {
      funnel.conversionRates.application = Math.round((funnel.applications / funnel.views) * 100) / 100;
    }
    if (funnel.applications > 0) {
      funnel.conversionRates.interview = Math.round((funnel.interviews / funnel.applications) * 100) / 100;
    }
    if (funnel.interviews > 0) {
      funnel.conversionRates.accepted = Math.round((funnel.accepted / funnel.interviews) * 100) / 100;
    }

    // 2. 历年招新对比（最近3年）
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

    // 3. 报名来源分析（按招新活动）
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

module.exports = {
  getTimeRange,
  calculateTrend,
  getClubOverview,
  getClubEventStats,
  getClubMemberStats,
  getClubRecruitmentStats
};
```

**Step 2: 提交**

```bash
git add backend/services/clubStatsService.js
git commit -m "feat: 实现社团招新数据统计功能"
```

---

### Task 6: 实现管理员统计 API

**Files:**
- Modify: `backend/services/clubStatsService.js`

**Step 1: 添加管理员统计函数**

在 `clubStatsService.js` 中添加以下代码：

```javascript
/**
 * 获取管理员全校数据概览
 * @description 统计全校社团的核心指标
 * @param {string} period - 时间周期
 * @returns {Promise<Object>} 全校概览数据
 */
async function getAdminOverview(period = 'semester') {
  try {
    const { startDate, endDate } = getTimeRange(period);
    
    // 并行查询基础统计数据
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

    // 社团活跃度排行（Top 10）
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

    // 排序并取前10
    clubActivityScores.sort((a, b) => b.avgActivity - a.avgActivity);
    const clubRankings = clubActivityScores.slice(0, 10);

    // 活动类型分布
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
```

**Step 2: 提交**

```bash
git add backend/services/clubStatsService.js
git commit -m "feat: 实现管理员全校数据统计功能"
```

---

### Task 7: 创建统计路由文件

**Files:**
- Create: `backend/routes/stats.js`

**Step 1: 创建路由文件**

```javascript
/**
 * 数据统计路由
 * @description 提供社团数据分析相关的 API 接口
 */

const express = require('express');
const router = express.Router();
const clubStatsService = require('../services/clubStatsService');
const { authenticateToken, requireClubLeader } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * 获取社团综合概览数据
 * @route GET /api/clubs/:clubId/stats/overview
 */
router.get('/clubs/:clubId/stats/overview', authenticateToken, requireClubLeader, async (req, res) => {
  try {
    const { clubId } = req.params;
    const { period } = req.query;
    
    const data = await clubStatsService.getClubOverview(clubId, period);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取社团概览失败:', error);
    res.status(500).json({
      success: false,
      message: '获取社团概览失败',
      error: error.message
    });
  }
});

/**
 * 获取社团活动数据统计
 * @route GET /api/clubs/:clubId/stats/events
 */
router.get('/clubs/:clubId/stats/events', authenticateToken, requireClubLeader, async (req, res) => {
  try {
    const { clubId } = req.params;
    const { period, months } = req.query;
    
    const data = await clubStatsService.getClubEventStats(
      clubId, 
      period, 
      months ? parseInt(months) : 6
    );
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取活动统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取活动统计失败',
      error: error.message
    });
  }
});

/**
 * 获取社团成员数据统计
 * @route GET /api/clubs/:clubId/stats/members
 */
router.get('/clubs/:clubId/stats/members', authenticateToken, requireClubLeader, async (req, res) => {
  try {
    const { clubId } = req.params;
    const { period, months } = req.query;
    
    const data = await clubStatsService.getClubMemberStats(
      clubId, 
      period, 
      months ? parseInt(months) : 6
    );
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取成员统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取成员统计失败',
      error: error.message
    });
  }
});

/**
 * 获取社团招新数据统计
 * @route GET /api/clubs/:clubId/stats/recruitments
 */
router.get('/clubs/:clubId/stats/recruitments', authenticateToken, requireClubLeader, async (req, res) => {
  try {
    const { clubId } = req.params;
    const { period } = req.query;
    
    const data = await clubStatsService.getClubRecruitmentStats(clubId, period);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取招新统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取招新统计失败',
      error: error.message
    });
  }
});

/**
 * 管理员 - 获取全校数据概览
 * @route GET /api/admin/stats/overview
 */
router.get('/admin/stats/overview', authenticateToken, async (req, res) => {
  try {
    // 检查是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }
    
    const { period } = req.query;
    const data = await clubStatsService.getAdminOverview(period);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取管理员概览失败:', error);
    res.status(500).json({
      success: false,
      message: '获取管理员概览失败',
      error: error.message
    });
  }
});

module.exports = router;
```

**Step 2: 提交**

```bash
git add backend/routes/stats.js
git commit -m "feat: 创建数据统计路由文件"
```

---

### Task 8: 注册路由到应用

**Files:**
- Modify: `backend/app.js`

**Step 1: 导入并注册统计路由**

在 `backend/app.js` 中找到路由注册部分，添加：

```javascript
const statsRoutes = require('./routes/stats');

// 在其他路由注册之后添加
app.use('/api', statsRoutes);
```

**Step 2: 提交**

```bash
git add backend/app.js
git commit -m "feat: 注册数据统计路由到应用"
```

---

### Task 9: 添加数据库索引优化

**Files:**
- Create: `backend/migrations/add_stats_indexes.sql`

**Step 1: 创建索引优化脚本**

```sql
-- 数据分析功能索引优化
-- 执行时间: 2026-04-11

-- 优化活动参与统计查询
CREATE INDEX IF NOT EXISTS idx_event_participants_status 
ON event_participants(event_id, status);

-- 优化招新统计查询
CREATE INDEX IF NOT EXISTS idx_applications_status 
ON applications(recruitment_id, status);

-- 优化活跃度统计查询
CREATE INDEX IF NOT EXISTS idx_activity_stats_date 
ON user_activity_stats(stat_date, user_id);

-- 优化活动社团关联查询
CREATE INDEX IF NOT EXISTS idx_event_clubs_club 
ON event_clubs(club_id);

-- 优化招新时间查询
CREATE INDEX IF NOT EXISTS idx_applications_submitted_at
ON applications(submitted_at);
```

**Step 2: 执行索引创建**

在数据库中执行上述 SQL 语句。

**Step 3: 提交**

```bash
git add backend/migrations/add_stats_indexes.sql
git commit -m "feat: 添加数据分析索引优化脚本"
```

---

## 阶段二：前端页面开发

### Task 10: 集成 ECharts 图表库

**Files:**
- Download: ECharts 小程序版本
- Create: `lib/ec-canvas/` 目录

**Step 1: 下载 ECharts 小程序版本**

从 GitHub 下载 echarts-for-weixin 项目：
https://github.com/ecomfe/echarts-for-weixin

将 `ec-canvas` 目录复制到项目的 `lib/` 目录下。

**Step 2: 创建工具函数**

创建 `utils/charts.js`:

```javascript
/**
 * 图表工具函数
 * @description 封装 ECharts 初始化和配置
 */

import * as echarts from '../lib/ec-canvas/echarts';

/**
 * 初始化图表
 * @param {Object} canvas - Canvas 对象
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {number} dpr - 设备像素比
 * @returns {Object} ECharts 实例
 */
function initChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr
  });
  canvas.setChart(chart);
  return chart;
}

/**
 * 生成折线图配置
 * @param {Array} data - 数据数组
 * @param {Object} options - 配置选项
 * @returns {Object} 图表配置
 */
function getLineChartOption(data, options = {}) {
  return {
    color: ['#5470c6'],
    tooltip: {
      trigger: 'axis'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(item => item.month || item.name)
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      name: options.name || '数值',
      type: 'line',
      smooth: true,
      data: data.map(item => item.count || item.value)
    }]
  };
}

/**
 * 生成饼图配置
 * @param {Array} data - 数据数组
 * @param {Object} options - 配置选项
 * @returns {Object} 图表配置
 */
function getPieChartOption(data, options = {}) {
  return {
    color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'],
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [{
      name: options.name || '分布',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false,
        position: 'center'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      labelLine: {
        show: false
      },
      data: data.map(item => ({
        value: item.count || item.value,
        name: item.category || item.level || item.name
      }))
    }]
  };
}

/**
 * 生成柱状图配置
 * @param {Array} data - 数据数组
 * @param {Object} options - 配置选项
 * @returns {Object} 图表配置
 */
function getBarChartOption(data, options = {}) {
  return {
    color: ['#5470c6'],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.eventName || item.clubName || item.name)
    },
    yAxis: {
      type: 'value',
      max: 1,
      axisLabel: {
        formatter: '{value}%'
      }
    },
    series: [{
      name: options.name || '数值',
      type: 'bar',
      barWidth: '60%',
      data: data.map(item => (item.rate || item.value) * 100)
    }]
  };
}

module.exports = {
  initChart,
  getLineChartOption,
  getPieChartOption,
  getBarChartOption
};
```

**Step 3: 提交**

```bash
git add lib/ec-canvas/
git add utils/charts.js
git commit -m "feat: 集成 ECharts 图表库"
```

---

### Task 11: 创建数据分析组件

**Files:**
- Create: `pages/edit/components/DataAnalysis/index.wxml`
- Create: `pages/edit/components/DataAnalysis/index.js`
- Create: `pages/edit/components/DataAnalysis/index.json`
- Create: `pages/edit/components/DataAnalysis/index.wxss`

**Step 1: 创建组件配置文件**

`pages/edit/components/DataAnalysis/index.json`:

```json
{
  "component": true,
  "usingComponents": {
    "ec-canvas": "../../../lib/ec-canvas/ec-canvas"
  }
}
```

**Step 2: 创建组件模板文件**

`pages/edit/components/DataAnalysis/index.wxml`:

```xml
<view class="data-analysis">
  <!-- 数据概览卡片 -->
  <view class="overview-section">
    <view class="section-title">📊 数据概览</view>
    <view class="cards-container">
      <view class="stat-card">
        <view class="stat-value">{{overview.memberCount}}</view>
        <view class="stat-label">成员数</view>
        <view class="stat-trend {{overview.trends.memberTrend >= 0 ? 'up' : 'down'}}">
          {{overview.trends.memberTrend >= 0 ? '↑' : '↓'}} {{Math.abs(overview.trends.memberTrend)}}%
        </view>
      </view>
      <view class="stat-card">
        <view class="stat-value">{{overview.eventCount}}</view>
        <view class="stat-label">活动数</view>
        <view class="stat-trend {{overview.trends.eventTrend >= 0 ? 'up' : 'down'}}">
          {{overview.trends.eventTrend >= 0 ? '↑' : '↓'}} {{Math.abs(overview.trends.eventTrend)}}%
        </view>
      </view>
      <view class="stat-card">
        <view class="stat-value">{{overview.recruitmentCount}}</view>
        <view class="stat-label">招新数</view>
        <view class="stat-trend {{overview.trends.recruitmentTrend >= 0 ? 'up' : 'down'}}">
          {{overview.trends.recruitmentTrend >= 0 ? '↑' : '↓'}} {{Math.abs(overview.trends.recruitmentTrend)}}%
        </view>
      </view>
      <view class="stat-card">
        <view class="stat-value">{{overview.avgActivityScore}}分</view>
        <view class="stat-label">活跃度</view>
        <view class="stat-trend {{overview.trends.activityTrend >= 0 ? 'up' : 'down'}}">
          {{overview.trends.activityTrend >= 0 ? '↑' : '↓'}} {{Math.abs(overview.trends.activityTrend)}}%
        </view>
      </view>
    </view>
  </view>

  <!-- 时间筛选 -->
  <view class="filter-section">
    <picker mode="selector" range="{{periodOptions}}" range-key="label" bindchange="onPeriodChange">
      <view class="picker">
        📅 {{currentPeriod.label}} ▼
      </view>
    </picker>
  </view>

  <!-- 活动数据 -->
  <view class="data-section">
    <view class="section-title">━━━ 活动数据 ━━━</view>
    <view class="chart-container">
      <view class="chart-title">📈 活动参与趋势</view>
      <ec-canvas id="eventTrendChart" canvas-id="eventTrendChart" ec="{{ eventTrendEc }}"></ec-canvas>
    </view>
  </view>

  <!-- 成员数据 -->
  <view class="data-section">
    <view class="section-title">━━━ 成员数据 ━━━</view>
    <view class="chart-container">
      <view class="chart-title">📊 成员等级分布</view>
      <ec-canvas id="memberLevelChart" canvas-id="memberLevelChart" ec="{{ memberLevelEc }}"></ec-canvas>
    </view>
  </view>

  <!-- 招新数据 -->
  <view class="data-section">
    <view class="section-title">━━━ 招新数据 ━━━</view>
    <view class="chart-container">
      <view class="chart-title">🔻 招新转化漏斗</view>
      <view class="funnel-chart">
        <view class="funnel-item" wx:for="{{recruitmentStats.funnelData}}" wx:key="stage">
          <view class="funnel-bar" style="width: {{item.percentage}}%; background-color: {{item.color}};">
            <text>{{item.stage}} {{item.count}}</text>
          </view>
        </view>
      </view>
      <view class="conversion-rates">
        转化率：报名{{recruitmentStats.funnel.conversionRates.application}}% → 面试{{recruitmentStats.funnel.conversionRates.interview}}% → 录用{{recruitmentStats.funnel.conversionRates.accepted}}%
      </view>
    </view>
  </view>
</view>
```

**Step 3: 创建组件逻辑文件**

`pages/edit/components/DataAnalysis/index.js`:

```javascript
/**
 * 数据分析组件
 * @description 展示社团运营数据的可视化图表
 */

const api = require('../../../../utils/api');
const chartsUtil = require('../../../../utils/charts');
import * as echarts from '../../../../lib/ec-canvas/echarts';

Component({
  properties: {
    clubId: {
      type: Number,
      value: 0
    }
  },

  data: {
    overview: {
      memberCount: 0,
      eventCount: 0,
      recruitmentCount: 0,
      avgActivityScore: 0,
      trends: {
        memberTrend: 0,
        eventTrend: 0,
        recruitmentTrend: 0,
        activityTrend: 0
      }
    },
    eventStats: {},
    memberStats: {},
    recruitmentStats: {
      funnel: {
        conversionRates: {}
      },
      funnelData: []
    },
    periodOptions: [
      { value: 'semester', label: '本学期' },
      { value: 'year', label: '本学年' }
    ],
    currentPeriod: { value: 'semester', label: '本学期' },
    eventTrendEc: {
      onInit: null
    },
    memberLevelEc: {
      onInit: null
    },
    loading: false
  },

  lifetimes: {
    attached() {
      this.loadData();
    }
  },

  observers: {
    'clubId': function(clubId) {
      if (clubId) {
        this.loadData();
      }
    }
  },

  methods: {
    /**
     * 加载所有数据
     */
    async loadData() {
      if (!this.data.clubId) return;
      
      this.setData({ loading: true });
      
      try {
        await Promise.all([
          this.loadOverview(),
          this.loadEventStats(),
          this.loadMemberStats(),
          this.loadRecruitmentStats()
        ]);
      } catch (error) {
        console.error('加载数据失败:', error);
        wx.showToast({
          title: '加载数据失败',
          icon: 'none'
        });
      } finally {
        this.setData({ loading: false });
      }
    },

    /**
     * 加载概览数据
     */
    async loadOverview() {
      try {
        const res = await api.club.getStatsOverview(this.data.clubId, this.data.currentPeriod.value);
        if (res.success) {
          this.setData({ overview: res.data });
        }
      } catch (error) {
        console.error('加载概览数据失败:', error);
      }
    },

    /**
     * 加载活动数据
     */
    async loadEventStats() {
      try {
        const res = await api.club.getStatsEvents(this.data.clubId, this.data.currentPeriod.value);
        if (res.success) {
          this.setData({ eventStats: res.data });
          this.initEventTrendChart(res.data.participationTrend);
        }
      } catch (error) {
        console.error('加载活动数据失败:', error);
      }
    },

    /**
     * 加载成员数据
     */
    async loadMemberStats() {
      try {
        const res = await api.club.getStatsMembers(this.data.clubId, this.data.currentPeriod.value);
        if (res.success) {
          this.setData({ memberStats: res.data });
          this.initMemberLevelChart(res.data.levelDistribution);
        }
      } catch (error) {
        console.error('加载成员数据失败:', error);
      }
    },

    /**
     * 加载招新数据
     */
    async loadRecruitmentStats() {
      try {
        const res = await api.club.getStatsRecruitments(this.data.clubId, this.data.currentPeriod.value);
        if (res.success) {
          const funnelData = this.processFunnelData(res.data.funnel);
          this.setData({ 
            recruitmentStats: {
              ...res.data,
              funnelData
            }
          });
        }
      } catch (error) {
        console.error('加载招新数据失败:', error);
      }
    },

    /**
     * 处理漏斗数据
     */
    processFunnelData(funnel) {
      const stages = [
        { stage: '浏览', count: funnel.views, color: '#5470c6' },
        { stage: '报名', count: funnel.applications, color: '#91cc75' },
        { stage: '面试', count: funnel.interviews, color: '#fac858' },
        { stage: '录用', count: funnel.accepted, color: '#ee6666' }
      ];
      
      const maxCount = Math.max(...stages.map(s => s.count));
      return stages.map(s => ({
        ...s,
        percentage: maxCount > 0 ? (s.count / maxCount) * 100 : 0
      }));
    },

    /**
     * 初始化活动趋势图表
     */
    initEventTrendChart(data) {
      this.setData({
        eventTrendEc: {
          onInit: (canvas, width, height, dpr) => {
            const chart = chartsUtil.initChart(canvas, width, height, dpr);
            const option = chartsUtil.getLineChartOption(data, { name: '参与人数' });
            chart.setOption(option);
            return chart;
          }
        }
      });
    },

    /**
     * 初始化成员等级图表
     */
    initMemberLevelChart(data) {
      this.setData({
        memberLevelEc: {
          onInit: (canvas, width, height, dpr) => {
            const chart = chartsUtil.initChart(canvas, width, height, dpr);
            const option = chartsUtil.getPieChartOption(data, { name: '等级分布' });
            chart.setOption(option);
            return chart;
          }
        }
      });
    },

    /**
     * 时间周期变更
     */
    onPeriodChange(e) {
      const index = e.detail.value;
      const period = this.data.periodOptions[index];
      this.setData({ currentPeriod: period });
      this.loadData();
    }
  }
});
```

**Step 4: 创建组件样式文件**

`pages/edit/components/DataAnalysis/index.wxss`:

```css
/* 数据分析组件样式 */

.data-analysis {
  padding: 20rpx;
  background-color: #f5f5f5;
}

/* 概览卡片 */
.overview-section {
  margin-bottom: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
  color: #333;
}

.cards-container {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
}

.stat-card {
  width: 48%;
  background-color: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.stat-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 10rpx;
}

.stat-trend {
  font-size: 24rpx;
  font-weight: bold;
}

.stat-trend.up {
  color: #52c41a;
}

.stat-trend.down {
  color: #ff4d4f;
}

/* 时间筛选 */
.filter-section {
  margin-bottom: 30rpx;
}

.picker {
  background-color: #fff;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #333;
}

/* 数据区块 */
.data-section {
  background-color: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 30rpx;
}

.chart-container {
  margin-top: 20rpx;
}

.chart-title {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 20rpx;
}

/* 漏斗图 */
.funnel-chart {
  padding: 20rpx 0;
}

.funnel-item {
  margin-bottom: 15rpx;
}

.funnel-bar {
  height: 60rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  padding-left: 20rpx;
  color: #fff;
  font-size: 24rpx;
  transition: width 0.3s ease;
}

.conversion-rates {
  font-size: 24rpx;
  color: #999;
  margin-top: 20rpx;
  text-align: center;
}

/* 图表容器 */
ec-canvas {
  width: 100%;
  height: 400rpx;
}
```

**Step 5: 提交**

```bash
git add pages/edit/components/DataAnalysis/
git commit -m "feat: 创建数据分析组件"
```

---

### Task 12: 在社团管理页集成数据分析组件

**Files:**
- Modify: `pages/edit/edit.wxml`
- Modify: `pages/edit/edit.js`
- Modify: `pages/edit/edit.json`

**Step 1: 修改页面配置**

在 `pages/edit/edit.json` 中添加组件引用：

```json
{
  "usingComponents": {
    "data-analysis": "./components/DataAnalysis/index"
  }
}
```

**Step 2: 修改页面模板**

在 `pages/edit/edit.wxml` 中添加数据分析标签页：

```xml
<!-- 在现有标签页之后添加 -->
<view class="tab-content" wx:if="{{activeTab === 'analysis'}}">
  <data-analysis clubId="{{clubId}}" />
</view>
```

**Step 3: 修改页面逻辑**

在 `pages/edit/edit.js` 的 data 中添加：

```javascript
data: {
  // 现有数据...
  tabs: ['社团信息', '成员管理', '活动管理', '招新管理', '数据分析'],
  activeTab: 0
}
```

**Step 4: 提交**

```bash
git add pages/edit/
git commit -m "feat: 在社团管理页集成数据分析组件"
```

---

### Task 13: 添加 API 接口函数

**Files:**
- Modify: `utils/api/club.js`

**Step 1: 添加统计 API 函数**

在 `utils/api/club.js` 中添加：

```javascript
/**
 * 获取社团综合概览数据
 */
function getStatsOverview(clubId, period = 'semester') {
  return request({
    url: `/clubs/${clubId}/stats/overview`,
    method: 'GET',
    data: { period }
  });
}

/**
 * 获取社团活动数据统计
 */
function getStatsEvents(clubId, period = 'semester', months = 6) {
  return request({
    url: `/clubs/${clubId}/stats/events`,
    method: 'GET',
    data: { period, months }
  });
}

/**
 * 获取社团成员数据统计
 */
function getStatsMembers(clubId, period = 'semester', months = 6) {
  return request({
    url: `/clubs/${clubId}/stats/members`,
    method: 'GET',
    data: { period, months }
  });
}

/**
 * 获取社团招新数据统计
 */
function getStatsRecruitments(clubId, period = 'semester') {
  return request({
    url: `/clubs/${clubId}/stats/recruitments`,
    method: 'GET',
    data: { period }
  });
}

module.exports = {
  // 现有导出...
  getStatsOverview,
  getStatsEvents,
  getStatsMembers,
  getStatsRecruitments
};
```

**Step 2: 提交**

```bash
git add utils/api/club.js
git commit -m "feat: 添加数据分析 API 接口函数"
```

---

## 阶段三：测试和优化

### Task 14: 测试 API 接口

**Files:**
- Test: 使用 Postman 或 curl 测试所有 API 接口

**Step 1: 测试综合概览 API**

```bash
curl -X GET "http://localhost:3000/api/clubs/1/stats/overview?period=semester" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Step 2: 测试活动数据 API**

```bash
curl -X GET "http://localhost:3000/api/clubs/1/stats/events?period=semester&months=6" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Step 3: 测试成员数据 API**

```bash
curl -X GET "http://localhost:3000/api/clubs/1/stats/members?period=semester" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Step 4: 测试招新数据 API**

```bash
curl -X GET "http://localhost:3000/api/clubs/1/stats/recruitments?period=semester" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Step 5: 测试管理员 API**

```bash
curl -X GET "http://localhost:3000/api/admin/stats/overview?period=semester" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

### Task 15: 前端功能测试

**Files:**
- Test: 小程序开发者工具测试

**Step 1: 测试数据加载**

- 打开社团管理页
- 切换到数据分析标签
- 检查数据是否正确加载

**Step 2: 测试图表渲染**

- 检查折线图是否正确显示
- 检查饼图是否正确显示
- 检查漏斗图是否正确显示

**Step 3: 测试时间筛选**

- 切换时间周期
- 检查数据是否重新加载

**Step 4: 测试异常情况**

- 测试无数据情况
- 测试网络错误情况
- 测试权限不足情况

---

### Task 16: 性能优化

**Files:**
- Optimize: 后端查询优化
- Optimize: 前端渲染优化

**Step 1: 添加查询缓存**

考虑使用 Redis 缓存统计结果，减少数据库查询。

**Step 2: 优化图表渲染**

使用防抖和节流优化图表交互。

**Step 3: 提交优化代码**

```bash
git add .
git commit -m "perf: 优化数据分析性能"
```

---

## 完成检查清单

- [ ] 后端 API 开发完成
  - [ ] 综合概览 API
  - [ ] 活动数据 API
  - [ ] 成员数据 API
  - [ ] 招新数据 API
  - [ ] 管理员统计 API
  - [ ] 数据库索引优化

- [ ] 前端页面开发完成
  - [ ] ECharts 集成
  - [ ] 数据分析组件
  - [ ] 图表可视化
  - [ ] 时间筛选功能
  - [ ] API 接口函数

- [ ] 测试完成
  - [ ] API 接口测试
  - [ ] 前端功能测试
  - [ ] 性能测试
  - [ ] 异常情况测试

- [ ] 文档更新
  - [ ] API 文档
  - [ ] 用户手册
  - [ ] 开发文档

---

## 部署说明

1. **后端部署**:
   - 执行数据库索引优化脚本
   - 重启 Node.js 服务
   - 验证 API 接口可用性

2. **前端部署**:
   - 上传小程序代码
   - 提交审核
   - 发布新版本

3. **监控**:
   - 监控 API 响应时间
   - 监控数据库查询性能
   - 收集用户反馈

---

## 备注

- 本计划采用 TDD（测试驱动开发）方法，每个功能都有对应的测试步骤
- 所有代码都包含详细的中文注释，符合项目规范
- 使用 Git 进行版本控制，每个任务完成后立即提交
- 遵循 DRY（不重复）和 YAGNI（不过度设计）原则
