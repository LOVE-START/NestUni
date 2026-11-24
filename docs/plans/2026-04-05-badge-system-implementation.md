# 羽章系统 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为南苑 Nest 社团管理系统添加完整的羽章系统，包括成就型、等级型、身份型三种羽章类型，支持自动触发机制和多位置展示。

**Architecture:** 采用分层架构设计，后端使用 Service + Trigger 模式处理羽章发放逻辑，前端使用组件化开发实现羽章展示。数据库设计包含羽章定义表、用户羽章关联表、日志表和活跃度统计表。

**Tech Stack:** Node.js + Express + MySQL + Knex.js（后端），微信小程序原生框架（前端），node-cron（定时任务）

---

## Phase 1: 数据库设计与初始化

### Task 1: 创建羽章定义表

**Files:**
- Create: `backend/migrations/20260405000001_create_badges_table.js`

**Step 1: 创建迁移文件**

```javascript
/**
 * 创建羽章定义表迁移文件
 */
exports.up = function(knex) {
  return knex.schema.createTable('badges', (table) => {
    table.increments('id').primary().comment('羽章ID');
    table.string('code', 50).notNullable().unique().comment('羽章代码（唯一标识）');
    table.string('name', 100).notNullable().comment('羽章名称');
    table.text('description').comment('羽章描述');
    table.string('icon', 255).comment('羽章图标URL');
    table.enum('type', ['achievement', 'level', 'identity']).notNullable().comment('羽章类型');
    table.enum('rarity', ['common', 'rare', 'epic', 'legendary']).defaultTo('common').comment('稀有度');
    table.string('category', 50).comment('羽章分类');
    table.string('trigger_type', 50).comment('触发类型');
    table.json('trigger_condition').comment('触发条件');
    table.integer('points').defaultTo(0).comment('羽章积分值');
    table.boolean('is_active').defaultTo(true).comment('是否启用');
    table.integer('sort_order').defaultTo(0).comment('排序权重');
    table.timestamps(true, true);
    
    table.index('type');
    table.index('rarity');
    table.index('category');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('badges');
};
```

**Step 2: 运行迁移**

Run: `cd backend && npx knex migrate:latest`

Expected: Migration completed successfully

**Step 3: 提交**

```bash
git add backend/migrations/20260405000001_create_badges_table.js
git commit -m "feat: create badges table migration"
```

---

### Task 2: 创建用户羽章关联表

**Files:**
- Create: `backend/migrations/20260405000002_create_user_badges_table.js`

**Step 1: 创建迁移文件**

```javascript
/**
 * 创建用户羽章关联表迁移文件
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_badges', (table) => {
    table.increments('id').primary().comment('记录ID');
    table.integer('user_id').unsigned().notNullable().comment('用户ID');
    table.integer('badge_id').unsigned().notNullable().comment('羽章ID');
    table.dateTime('earned_at').defaultTo(knex.fn.now()).comment('获得时间');
    table.boolean('is_displayed').defaultTo(true).comment('是否在个人中心展示');
    table.integer('display_order').defaultTo(0).comment('展示顺序');
    table.json('metadata').comment('额外元数据');
    table.timestamps(true, true);
    
    table.unique(['user_id', 'badge_id']);
    table.index('user_id');
    table.index('badge_id');
    table.index('earned_at');
    
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('badge_id').references('badges.id').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_badges');
};
```

**Step 2: 运行迁移**

Run: `cd backend && npx knex migrate:latest`

Expected: Migration completed successfully

**Step 3: 提交**

```bash
git add backend/migrations/20260405000002_create_user_badges_table.js
git commit -m "feat: create user_badges table migration"
```

---

### Task 3: 创建羽章日志表

**Files:**
- Create: `backend/migrations/20260405000003_create_badge_logs_table.js`

**Step 1: 创建迁移文件**

```javascript
/**
 * 创建羽章日志表迁移文件
 */
exports.up = function(knex) {
  return knex.schema.createTable('badge_logs', (table) => {
    table.increments('id').primary().comment('日志ID');
    table.integer('user_id').unsigned().notNullable().comment('用户ID');
    table.integer('badge_id').unsigned().notNullable().comment('羽章ID');
    table.enum('action', ['earned', 'upgraded', 'downgraded', 'lost']).notNullable().comment('动作类型');
    table.json('old_value').comment('旧值');
    table.json('new_value').comment('新值');
    table.dateTime('created_at').defaultTo(knex.fn.now()).comment('记录时间');
    
    table.index('user_id');
    table.index('badge_id');
    table.index('created_at');
    
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('badge_id').references('badges.id').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('badge_logs');
};
```

**Step 2: 运行迁移**

Run: `cd backend && npx knex migrate:latest`

Expected: Migration completed successfully

**Step 3: 提交**

```bash
git add backend/migrations/20260405000003_create_badge_logs_table.js
git commit -m "feat: create badge_logs table migration"
```

---

### Task 4: 创建用户活跃度统计表

**Files:**
- Create: `backend/migrations/20260405000004_create_user_activity_stats_table.js`

**Step 1: 创建迁移文件**

```javascript
/**
 * 创建用户活跃度统计表迁移文件
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_activity_stats', (table) => {
    table.increments('id').primary().comment('统计ID');
    table.integer('user_id').unsigned().notNullable().comment('用户ID');
    table.date('stat_date').notNullable().comment('统计日期');
    table.integer('login_count').defaultTo(0).comment('登录次数');
    table.integer('event_count').defaultTo(0).comment('参与活动数');
    table.integer('comment_count').defaultTo(0).comment('评论数');
    table.integer('application_count').defaultTo(0).comment('报名数');
    table.integer('activity_score').defaultTo(0).comment('活跃度得分');
    table.timestamps(true, true);
    
    table.unique(['user_id', 'stat_date']);
    table.index('user_id');
    table.index('stat_date');
    
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_activity_stats');
};
```

**Step 2: 运行迁移**

Run: `cd backend && npx knex migrate:latest`

Expected: Migration completed successfully

**Step 3: 提交**

```bash
git add backend/migrations/20260405000004_create_user_activity_stats_table.js
git commit -m "feat: create user_activity_stats table migration"
```

---

### Task 5: 创建羽章种子数据

**Files:**
- Create: `backend/seeds/20260405000001_badges_seed.js`

**Step 1: 创建种子数据文件**

```javascript
/**
 * 羽章系统初始数据
 */
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('badges').del();
  
  // 插入羽章数据
  const badges = [
    // 基础成就类
    {
      code: 'first_login',
      name: '初入南苑',
      description: '完成首次登录',
      type: 'achievement',
      rarity: 'common',
      category: '基础',
      trigger_type: 'user.login',
      trigger_condition: JSON.stringify({ check_type: 'immediate' }),
      points: 10,
      sort_order: 1
    },
    {
      code: 'profile_complete',
      name: '身份认证',
      description: '完善个人资料（学号、微信号）',
      type: 'achievement',
      rarity: 'common',
      category: '基础',
      trigger_type: 'user.profile_update',
      trigger_condition: JSON.stringify({
        check_type: 'immediate',
        conditions: { has_student_id: true, has_wechat: true }
      }),
      points: 10,
      sort_order: 2
    },
    {
      code: 'avatar_uploaded',
      name: '形象塑造',
      description: '上传头像',
      type: 'achievement',
      rarity: 'common',
      category: '基础',
      trigger_type: 'user.avatar_upload',
      trigger_condition: JSON.stringify({ check_type: 'immediate' }),
      points: 10,
      sort_order: 3
    },
    
    // 社团成就类
    {
      code: 'first_club_joined',
      name: '社团新人',
      description: '加入第一个社团',
      type: 'achievement',
      rarity: 'rare',
      category: '社团',
      trigger_type: 'club.joined',
      trigger_condition: JSON.stringify({
        check_type: 'aggregate',
        conditions: { total_clubs: { gte: 1 } }
      }),
      points: 20,
      sort_order: 10
    },
    {
      code: 'club_master',
      name: '社团达人',
      description: '加入2个以上社团',
      type: 'achievement',
      rarity: 'epic',
      category: '社团',
      trigger_type: 'club.joined',
      trigger_condition: JSON.stringify({
        check_type: 'aggregate',
        conditions: { total_clubs: { gte: 2 } }
      }),
      points: 50,
      sort_order: 11
    },
    {
      code: 'club_leader',
      name: '社团领袖',
      description: '成为社团会长',
      type: 'identity',
      rarity: 'legendary',
      category: '社团',
      trigger_type: 'club.became_leader',
      trigger_condition: JSON.stringify({ check_type: 'immediate' }),
      points: 100,
      sort_order: 12
    },
    {
      code: 'club_anniversary',
      name: '社团之星',
      description: '在社团待满1年',
      type: 'achievement',
      rarity: 'epic',
      category: '社团',
      trigger_type: 'club.anniversary',
      trigger_condition: JSON.stringify({
        check_type: 'aggregate',
        conditions: { membership_days: { gte: 365 } }
      }),
      points: 50,
      sort_order: 13
    },
    
    // 活动成就类
    {
      code: 'first_event_attended',
      name: '活动先锋',
      description: '参加第一个活动',
      type: 'achievement',
      rarity: 'rare',
      category: '活动',
      trigger_type: 'event.attended',
      trigger_condition: JSON.stringify({
        check_type: 'aggregate',
        conditions: { total_events: { gte: 1 } }
      }),
      points: 20,
      sort_order: 20
    },
    {
      code: 'event_enthusiast',
      name: '活动达人',
      description: '参加5个以上活动',
      type: 'achievement',
      rarity: 'epic',
      category: '活动',
      trigger_type: 'event.attended',
      trigger_condition: JSON.stringify({
        check_type: 'aggregate',
        conditions: { total_events: { gte: 5 } }
      }),
      points: 50,
      sort_order: 21
    },
    {
      code: 'event_star',
      name: '活动之星',
      description: '参加8个以上活动',
      type: 'achievement',
      rarity: 'legendary',
      category: '活动',
      trigger_type: 'event.attended',
      trigger_condition: JSON.stringify({
        check_type: 'aggregate',
        conditions: { total_events: { gte: 8 } }
      }),
      points: 100,
      sort_order: 22
    },
    {
      code: 'map_explorer',
      name: '地图探索者',
      description: '使用地图功能查看活动位置',
      type: 'achievement',
      rarity: 'rare',
      category: '活动',
      trigger_type: 'event.map_viewed',
      trigger_condition: JSON.stringify({ check_type: 'immediate' }),
      points: 20,
      sort_order: 23
    },
    
    // 招新成就类
    {
      code: 'first_application',
      name: '首次报名',
      description: '完成第一次社团报名',
      type: 'achievement',
      rarity: 'common',
      category: '招新',
      trigger_type: 'recruitment.applied',
      trigger_condition: JSON.stringify({
        check_type: 'aggregate',
        conditions: { total_applications: { gte: 1 } }
      }),
      points: 10,
      sort_order: 30
    },
    
    // 社交成就类
    {
      code: 'first_comment',
      name: '评论新手',
      description: '发表第一条评论',
      type: 'achievement',
      rarity: 'common',
      category: '社交',
      trigger_type: 'comment.created',
      trigger_condition: JSON.stringify({
        check_type: 'aggregate',
        conditions: { total_comments: { gte: 1 } }
      }),
      points: 10,
      sort_order: 40
    },
    {
      code: 'comment_master',
      name: '评论达人',
      description: '发表10条以上评论',
      type: 'achievement',
      rarity: 'rare',
      category: '社交',
      trigger_type: 'comment.created',
      trigger_condition: JSON.stringify({
        check_type: 'aggregate',
        conditions: { total_comments: { gte: 10 } }
      }),
      points: 20,
      sort_order: 41
    },
    
    // 等级型羽章
    {
      code: 'activity_bronze',
      name: '青铜活跃',
      description: '活跃度 1-30',
      type: 'level',
      rarity: 'common',
      category: '活跃度',
      trigger_type: 'user.activity_update',
      trigger_condition: JSON.stringify({
        check_type: 'level',
        conditions: { activity_score: { min: 1, max: 30 } }
      }),
      points: 10,
      sort_order: 50
    },
    {
      code: 'activity_silver',
      name: '白银活跃',
      description: '活跃度 31-60',
      type: 'level',
      rarity: 'rare',
      category: '活跃度',
      trigger_type: 'user.activity_update',
      trigger_condition: JSON.stringify({
        check_type: 'level',
        conditions: { activity_score: { min: 31, max: 60 } }
      }),
      points: 20,
      sort_order: 51
    },
    {
      code: 'activity_gold',
      name: '黄金活跃',
      description: '活跃度 61-80',
      type: 'level',
      rarity: 'epic',
      category: '活跃度',
      trigger_type: 'user.activity_update',
      trigger_condition: JSON.stringify({
        check_type: 'level',
        conditions: { activity_score: { min: 61, max: 80 } }
      }),
      points: 50,
      sort_order: 52
    },
    {
      code: 'activity_diamond',
      name: '钻石活跃',
      description: '活跃度 81-100',
      type: 'level',
      rarity: 'legendary',
      category: '活跃度',
      trigger_type: 'user.activity_update',
      trigger_condition: JSON.stringify({
        check_type: 'level',
        conditions: { activity_score: { min: 81, max: 100 } }
      }),
      points: 100,
      sort_order: 53
    },
    
    // 身份型羽章
    {
      code: 'system_admin',
      name: '系统管理员',
      description: '系统管理员专属',
      type: 'identity',
      rarity: 'legendary',
      category: '身份',
      trigger_type: 'user.role_change',
      trigger_condition: JSON.stringify({
        check_type: 'immediate',
        conditions: { role: 'admin' }
      }),
      points: 100,
      sort_order: 60
    },
    {
      code: 'verified_user',
      name: '认证用户',
      description: '完成学号认证的用户',
      type: 'identity',
      rarity: 'rare',
      category: '身份',
      trigger_type: 'user.profile_update',
      trigger_condition: JSON.stringify({
        check_type: 'immediate',
        conditions: { has_student_id: true }
      }),
      points: 20,
      sort_order: 61
    },
    {
      code: 'founding_member',
      name: '创始成员',
      description: '早期注册用户（前1000名）',
      type: 'identity',
      rarity: 'legendary',
      category: '身份',
      trigger_type: 'user.login',
      trigger_condition: JSON.stringify({
        check_type: 'immediate',
        conditions: { user_id: { lte: 1000 } }
      }),
      points: 100,
      sort_order: 62
    },
    {
      code: 'excellent_leader',
      name: '优秀会长',
      description: '由管理员授予的优秀会长称号',
      type: 'identity',
      rarity: 'legendary',
      category: '身份',
      trigger_type: 'admin.grant',
      trigger_condition: JSON.stringify({ check_type: 'manual' }),
      points: 100,
      sort_order: 63
    }
  ];
  
  await knex('badges').insert(badges);
};
```

**Step 2: 运行种子数据**

Run: `cd backend && npx knex seed:run`

Expected: Seed data inserted successfully

**Step 3: 提交**

```bash
git add backend/seeds/20260405000001_badges_seed.js
git commit -m "feat: add badges seed data"
```

---

## Phase 2: 后端服务开发

### Task 6: 创建羽章服务类

**Files:**
- Create: `backend/services/badgeService.js`

**Step 1: 创建羽章服务类**

```javascript
const knex = require('../config/database');
const logger = require('../config/logger');

/**
 * 羽章服务类
 * 负责羽章的发放、查询、更新等核心业务逻辑
 */
class BadgeService {
  /**
   * 检查并发放羽章
   * @param {number} userId - 用户ID
   * @param {string} triggerEvent - 触发事件
   * @param {object} eventData - 事件数据
   * @returns {Promise<Array>} 发放的羽章列表
   */
  async checkAndAwardBadge(userId, triggerEvent, eventData = {}) {
    try {
      // 查找所有监听该事件的羽章
      const badges = await knex('badges')
        .where('trigger_type', triggerEvent)
        .where('is_active', true);
      
      const awardedBadges = [];
      
      for (const badge of badges) {
        // 检查用户是否已获得该羽章
        const existingBadge = await knex('user_badges')
          .where('user_id', userId)
          .where('badge_id', badge.id)
          .first();
        
        if (existingBadge && badge.type !== 'level') {
          continue; // 非等级羽章已获得则跳过
        }
        
        // 检查触发条件
        const condition = JSON.parse(badge.trigger_condition || '{}');
        const shouldAward = await this.checkCondition(userId, condition, eventData);
        
        if (shouldAward) {
          // 发放羽章
          await this.awardBadge(userId, badge.id, badge.type, existingBadge);
          awardedBadges.push(badge);
        }
      }
      
      return awardedBadges;
    } catch (error) {
      logger.error('检查并发放羽章失败:', error);
      throw error;
    }
  }
  
  /**
   * 检查触发条件
   * @param {number} userId - 用户ID
   * @param {object} condition - 触发条件
   * @param {object} eventData - 事件数据
   * @returns {Promise<boolean>} 是否满足条件
   */
  async checkCondition(userId, condition, eventData) {
    const { check_type, conditions } = condition;
    
    switch (check_type) {
      case 'immediate':
        return this.checkImmediateCondition(userId, conditions, eventData);
      case 'aggregate':
        return this.checkAggregateCondition(userId, conditions);
      case 'level':
        return this.checkLevelCondition(userId, conditions);
      case 'manual':
        return false; // 手动发放的羽章不自动触发
      default:
        return false;
    }
  }
  
  /**
   * 检查即时条件
   */
  async checkImmediateCondition(userId, conditions, eventData) {
    if (!conditions) return true;
    
    // 检查用户ID条件
    if (conditions.user_id && conditions.user_id.lte) {
      if (userId > conditions.user_id.lte) return false;
    }
    
    // 检查角色条件
    if (conditions.role) {
      const user = await knex('users').where('id', userId).first();
      if (!user || user.role !== conditions.role) return false;
    }
    
    // 检查学号条件
    if (conditions.has_student_id) {
      const user = await knex('users').where('id', userId).first();
      if (!user || !user.student_id) return false;
    }
    
    // 检查微信号条件
    if (conditions.has_wechat) {
      const user = await knex('users').where('id', userId).first();
      if (!user || !user.wechat) return false;
    }
    
    return true;
  }
  
  /**
   * 检查聚合条件
   */
  async checkAggregateCondition(userId, conditions) {
    if (!conditions) return false;
    
    // 检查社团数量
    if (conditions.total_clubs) {
      const count = await knex('club_members')
        .where('user_id', userId)
        .count('club_id as count')
        .first();
      if (conditions.total_clubs.gte && count.count < conditions.total_clubs.gte) {
        return false;
      }
    }
    
    // 检查活动数量
    if (conditions.total_events) {
      const count = await knex('event_participants')
        .where('user_id', userId)
        .where('status', 'approved')
        .count('event_id as count')
        .first();
      if (conditions.total_events.gte && count.count < conditions.total_events.gte) {
        return false;
      }
    }
    
    // 检查评论数量
    if (conditions.total_comments) {
      const count = await knex('comments')
        .where('user_id', userId)
        .count('id as count')
        .first();
      if (conditions.total_comments.gte && count.count < conditions.total_comments.gte) {
        return false;
      }
    }
    
    // 检查报名数量
    if (conditions.total_applications) {
      const count = await knex('applications')
        .where('user_id', userId)
        .count('id as count')
        .first();
      if (conditions.total_applications.gte && count.count < conditions.total_applications.gte) {
        return false;
      }
    }
    
    // 检查社团成员天数
    if (conditions.membership_days) {
      const membership = await knex('club_members')
        .where('user_id', userId)
        .min('joined_at as earliest')
        .first();
      if (membership.earliest) {
        const days = Math.floor((new Date() - new Date(membership.earliest)) / (1000 * 60 * 60 * 24));
        if (conditions.membership_days.gte && days < conditions.membership_days.gte) {
          return false;
        }
      } else {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 检查等级条件
   */
  async checkLevelCondition(userId, conditions) {
    if (!conditions || !conditions.activity_score) return false;
    
    const activityScore = await this.calculateActivityScore(userId);
    const { min, max } = conditions.activity_score;
    
    return activityScore >= min && activityScore <= max;
  }
  
  /**
   * 发放羽章
   * @param {number} userId - 用户ID
   * @param {number} badgeId - 羽章ID
   * @param {string} badgeType - 羽章类型
   * @param {object} existingBadge - 已存在的羽章记录
   */
  async awardBadge(userId, badgeId, badgeType, existingBadge) {
    const trx = await knex.transaction();
    
    try {
      if (badgeType === 'level' && existingBadge) {
        // 更新等级羽章
        await trx('user_badges')
          .where('id', existingBadge.id)
          .update({
            earned_at: new Date(),
            updated_at: new Date()
          });
        
        // 记录日志
        await trx('badge_logs').insert({
          user_id: userId,
          badge_id: badgeId,
          action: 'upgraded',
          created_at: new Date()
        });
      } else {
        // 新增羽章
        await trx('user_badges').insert({
          user_id: userId,
          badge_id: badgeId,
          earned_at: new Date()
        });
        
        // 记录日志
        await trx('badge_logs').insert({
          user_id: userId,
          badge_id: badgeId,
          action: 'earned',
          created_at: new Date()
        });
      }
      
      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
  
  /**
   * 计算用户活跃度
   * @param {number} userId - 用户ID
   * @returns {Promise<number>} 活跃度得分
   */
  async calculateActivityScore(userId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // 统计近30天的各项数据
    const stats = await knex('user_activity_stats')
      .where('user_id', userId)
      .where('stat_date', '>=', thirtyDaysAgo)
      .select(
        knex.raw('SUM(login_count) as total_logins'),
        knex.raw('SUM(event_count) as total_events'),
        knex.raw('SUM(comment_count) as total_comments'),
        knex.raw('SUM(application_count) as total_applications')
      )
      .first();
    
    // 计算活跃度得分（加权平均）
    const score = Math.min(100, Math.floor(
      (stats.total_logins || 0) * 1 +
      (stats.total_events || 0) * 5 +
      (stats.total_comments || 0) * 2 +
      (stats.total_applications || 0) * 3
    ));
    
    return score;
  }
  
  /**
   * 获取用户羽章列表
   * @param {number} userId - 用户ID
   * @returns {Promise<object>} 羽章列表和统计
   */
  async getUserBadges(userId) {
    const badges = await knex('user_badges')
      .join('badges', 'user_badges.badge_id', 'badges.id')
      .where('user_badges.user_id', userId)
      .select(
        'badges.*',
        'user_badges.earned_at',
        'user_badges.is_displayed',
        'user_badges.display_order',
        'user_badges.metadata'
      )
      .orderBy('user_badges.earned_at', 'desc');
    
    // 统计各类型羽章数量
    const stats = {
      achievement: 0,
      level: 0,
      identity: 0
    };
    
    badges.forEach(badge => {
      stats[badge.type]++;
    });
    
    return {
      total: badges.length,
      badges,
      stats
    };
  }
  
  /**
   * 获取所有羽章列表
   * @param {number} userId - 用户ID（可选）
   * @returns {Promise<Array>} 羽章列表
   */
  async getAllBadges(userId = null) {
    let query = knex('badges')
      .where('is_active', true)
      .orderBy('sort_order', 'asc');
    
    const badges = await query;
    
    // 如果提供了用户ID，标记已获得的羽章
    if (userId) {
      const userBadges = await knex('user_badges')
        .where('user_id', userId)
        .select('badge_id', 'earned_at');
      
      const userBadgeMap = {};
      userBadges.forEach(ub => {
        userBadgeMap[ub.badge_id] = ub.earned_at;
      });
      
      badges.forEach(badge => {
        badge.is_earned = !!userBadgeMap[badge.id];
        badge.earned_at = userBadgeMap[badge.id] || null;
      });
    }
    
    return badges;
  }
  
  /**
   * 更新羽章展示设置
   * @param {number} userId - 用户ID
   * @param {Array} badgeIds - 羽章ID列表
   * @param {object} displayOrders - 展示顺序
   */
  async updateDisplaySettings(userId, badgeIds, displayOrders) {
    const trx = await knex.transaction();
    
    try {
      // 先将所有羽章设置为不展示
      await trx('user_badges')
        .where('user_id', userId)
        .update({ is_displayed: false, display_order: 0 });
      
      // 更新选中的羽章
      for (let i = 0; i < badgeIds.length; i++) {
        const badgeId = badgeIds[i];
        await trx('user_badges')
          .where('user_id', userId)
          .where('badge_id', badgeId)
          .update({
            is_displayed: true,
            display_order: displayOrders[badgeId] || i
          });
      }
      
      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
  
  /**
   * 手动发放羽章（管理员）
   * @param {number} userId - 用户ID
   * @param {number} badgeId - 羽章ID
   */
  async manualAwardBadge(userId, badgeId) {
    const badge = await knex('badges').where('id', badgeId).first();
    if (!badge) {
      throw new Error('羽章不存在');
    }
    
    const existingBadge = await knex('user_badges')
      .where('user_id', userId)
      .where('badge_id', badgeId)
      .first();
    
    if (existingBadge) {
      throw new Error('用户已获得该羽章');
    }
    
    await this.awardBadge(userId, badgeId, badge.type, null);
  }
}

module.exports = new BadgeService();
```

**Step 2: 提交**

```bash
git add backend/services/badgeService.js
git commit -m "feat: create badge service class"
```

---

### Task 7: 创建羽章路由

**Files:**
- Create: `backend/routes/badges.js`

**Step 1: 创建羽章路由**

```javascript
const express = require('express');
const router = express.Router();
const badgeService = require('../services/badgeService');
const authMiddleware = require('../middleware/auth');

/**
 * 获取所有羽章列表
 * GET /nfunest/api/badges
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, rarity, category, sort } = req.query;
    
    let badges = await badgeService.getAllBadges(userId);
    
    // 筛选
    if (type) {
      badges = badges.filter(b => b.type === type);
    }
    if (rarity) {
      badges = badges.filter(b => b.rarity === rarity);
    }
    if (category) {
      badges = badges.filter(b => b.category === category);
    }
    
    // 排序
    if (sort === 'rarity') {
      const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
      badges.sort((a, b) => rarityOrder[b.rarity] - rarityOrder[a.rarity]);
    } else if (sort === 'earned_at') {
      badges.sort((a, b) => {
        if (!a.earned_at && !b.earned_at) return 0;
        if (!a.earned_at) return 1;
        if (!b.earned_at) return -1;
        return new Date(b.earned_at) - new Date(a.earned_at);
      });
    }
    
    res.json({ success: true, data: badges });
  } catch (error) {
    console.error('获取羽章列表失败:', error);
    res.status(500).json({ success: false, message: '获取羽章列表失败' });
  }
});

/**
 * 获取用户羽章列表
 * GET /nfunest/api/badges/my
 */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await badgeService.getUserBadges(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取用户羽章失败:', error);
    res.status(500).json({ success: false, message: '获取用户羽章失败' });
  }
});

/**
 * 获取羽章详情
 * GET /nfunest/api/badges/:id
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const badgeId = req.params.id;
    
    const badges = await badgeService.getAllBadges(userId);
    const badge = badges.find(b => b.id === parseInt(badgeId));
    
    if (!badge) {
      return res.status(404).json({ success: false, message: '羽章不存在' });
    }
    
    res.json({ success: true, data: badge });
  } catch (error) {
    console.error('获取羽章详情失败:', error);
    res.status(500).json({ success: false, message: '获取羽章详情失败' });
  }
});

/**
 * 更新羽章展示设置
 * PUT /nfunest/api/badges/my/display
 */
router.put('/my/display', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { badge_ids, display_orders } = req.body;
    
    await badgeService.updateDisplaySettings(userId, badge_ids, display_orders);
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新羽章展示设置失败:', error);
    res.status(500).json({ success: false, message: '更新羽章展示设置失败' });
  }
});

/**
 * 获取用户羽章统计
 * GET /nfunest/api/badges/my/stats
 */
router.get('/my/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await badgeService.getUserBadges(userId);
    
    // 计算总积分
    let totalPoints = 0;
    const byRarity = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const byType = { achievement: 0, level: 0, identity: 0 };
    
    result.badges.forEach(badge => {
      totalPoints += badge.points;
      byRarity[badge.rarity]++;
      byType[badge.type]++;
    });
    
    // 获取最近获得的羽章
    const recentBadges = result.badges.slice(0, 5).map(b => ({
      id: b.id,
      name: b.name,
      earned_at: b.earned_at
    }));
    
    res.json({
      success: true,
      data: {
        total_badges: result.total,
        total_points: totalPoints,
        by_rarity: byRarity,
        by_type: byType,
        recent_badges: recentBadges
      }
    });
  } catch (error) {
    console.error('获取羽章统计失败:', error);
    res.status(500).json({ success: false, message: '获取羽章统计失败' });
  }
});

/**
 * 获取用户活跃度
 * GET /nfunest/api/badges/my/activity
 */
router.get('/my/activity', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const activityScore = await badgeService.calculateActivityScore(userId);
    
    // 确定等级
    let level = 'bronze';
    if (activityScore >= 81) level = 'diamond';
    else if (activityScore >= 61) level = 'gold';
    else if (activityScore >= 31) level = 'silver';
    
    res.json({
      success: true,
      data: {
        activity_score: activityScore,
        level: level
      }
    });
  } catch (error) {
    console.error('获取用户活跃度失败:', error);
    res.status(500).json({ success: false, message: '获取用户活跃度失败' });
  }
});

module.exports = router;
```

**Step 2: 提交**

```bash
git add backend/routes/badges.js
git commit -m "feat: create badges route"
```

---

### Task 8: 注册羽章路由到应用

**Files:**
- Modify: `backend/app.js`

**Step 1: 在 app.js 中注册羽章路由**

在现有的路由注册部分添加：

```javascript
const badgesRouter = require('./routes/badges');
app.use('/nfunest/api/badges', badgesRouter);
```

**Step 2: 提交**

```bash
git add backend/app.js
git commit -m "feat: register badges route to app"
```

---

## Phase 3: 触发器集成

### Task 9: 在用户登录时触发羽章检查

**Files:**
- Modify: `backend/routes/auth.js`

**Step 1: 在用户登录成功后添加羽章触发**

在用户登录成功的处理函数中添加：

```javascript
const badgeService = require('../services/badgeService');

// 在登录成功后触发羽章检查
await badgeService.checkAndAwardBadge(userId, 'user.login');
```

**Step 2: 提交**

```bash
git add backend/routes/auth.js
git commit -m "feat: trigger badge check on user login"
```

---

### Task 10: 在用户资料更新时触发羽章检查

**Files:**
- Modify: `backend/routes/auth.js`

**Step 1: 在用户资料更新后添加羽章触发**

在用户资料更新的处理函数中添加：

```javascript
const badgeService = require('../services/badgeService');

// 在资料更新后触发羽章检查
await badgeService.checkAndAwardBadge(userId, 'user.profile_update', {
  has_student_id: !!req.body.student_id,
  has_wechat: !!req.body.wechat
});
```

**Step 2: 提交**

```bash
git add backend/routes/auth.js
git commit -m "feat: trigger badge check on profile update"
```

---

### Task 11: 在社团相关操作时触发羽章检查

**Files:**
- Modify: `backend/routes/clubs.js`

**Step 1: 在用户加入社团后添加羽章触发**

在用户加入社团的处理函数中添加：

```javascript
const badgeService = require('../services/badgeService');

// 在加入社团后触发羽章检查
await badgeService.checkAndAwardBadge(userId, 'club.joined');
```

**Step 2: 在用户成为社长后添加羽章触发**

在用户成为社长的处理函数中添加：

```javascript
const badgeService = require('../services/badgeService');

// 在成为社长后触发羽章检查
await badgeService.checkAndAwardBadge(userId, 'club.became_leader');
```

**Step 3: 提交**

```bash
git add backend/routes/clubs.js
git commit -m "feat: trigger badge check on club operations"
```

---

### Task 12: 在活动相关操作时触发羽章检查

**Files:**
- Modify: `backend/routes/events.js`

**Step 1: 在用户报名活动后添加羽章触发**

在用户报名活动的处理函数中添加：

```javascript
const badgeService = require('../services/badgeService');

// 在报名活动后触发羽章检查
await badgeService.checkAndAwardBadge(userId, 'event.registered');
```

**Step 2: 提交**

```bash
git add backend/routes/events.js
git commit -m "feat: trigger badge check on event operations"
```

---

### Task 13: 在评论相关操作时触发羽章检查

**Files:**
- Modify: `backend/routes/comments.js`

**Step 1: 在用户发表评论后添加羽章触发**

在用户发表评论的处理函数中添加：

```javascript
const badgeService = require('../services/badgeService');

// 在发表评论后触发羽章检查
await badgeService.checkAndAwardBadge(userId, 'comment.created');
```

**Step 2: 提交**

```bash
git add backend/routes/comments.js
git commit -m "feat: trigger badge check on comment operations"
```

---

### Task 14: 在招新相关操作时触发羽章检查

**Files:**
- Modify: `backend/routes/recruitments.js`

**Step 1: 在用户提交报名后添加羽章触发**

在用户提交报名的处理函数中添加：

```javascript
const badgeService = require('../services/badgeService');

// 在提交报名后触发羽章检查
await badgeService.checkAndAwardBadge(userId, 'recruitment.applied');
```

**Step 2: 提交**

```bash
git add backend/routes/recruitments.js
git commit -m "feat: trigger badge check on recruitment operations"
```

---

## Phase 4: 前端开发

### Task 15: 创建羽章 API 模块

**Files:**
- Create: `utils/api/badge.js`

**Step 1: 创建羽章 API 模块**

```javascript
const { request } = require('./core');

/**
 * 获取所有羽章列表
 */
const fetchAllBadges = (params = {}) => {
  return request({
    url: '/nfunest/api/badges',
    method: 'GET',
    data: params
  });
};

/**
 * 获取用户羽章列表
 */
const fetchMyBadges = () => {
  return request({
    url: '/nfunest/api/badges/my',
    method: 'GET'
  });
};

/**
 * 获取羽章详情
 */
const fetchBadgeDetail = (badgeId) => {
  return request({
    url: `/nfunest/api/badges/${badgeId}`,
    method: 'GET'
  });
};

/**
 * 更新羽章展示设置
 */
const updateBadgeDisplay = (badgeIds, displayOrders) => {
  return request({
    url: '/nfunest/api/badges/my/display',
    method: 'PUT',
    data: {
      badge_ids: badgeIds,
      display_orders: displayOrders
    }
  });
};

/**
 * 获取用户羽章统计
 */
const fetchBadgeStats = () => {
  return request({
    url: '/nfunest/api/badges/my/stats',
    method: 'GET'
  });
};

/**
 * 获取用户活跃度
 */
const fetchUserActivity = () => {
  return request({
    url: '/nfunest/api/badges/my/activity',
    method: 'GET'
  });
};

module.exports = {
  fetchAllBadges,
  fetchMyBadges,
  fetchBadgeDetail,
  updateBadgeDisplay,
  fetchBadgeStats,
  fetchUserActivity
};
```

**Step 2: 提交**

```bash
git add utils/api/badge.js
git commit -m "feat: create badge API module"
```

---

### Task 16: 创建羽章卡片组件

**Files:**
- Create: `components/badge-card/badge-card.js`
- Create: `components/badge-card/badge-card.json`
- Create: `components/badge-card/badge-card.wxml`
- Create: `components/badge-card/badge-card.wxss`

**Step 1: 创建组件 JS 文件**

```javascript
Component({
  properties: {
    badge: {
      type: Object,
      value: {}
    },
    size: {
      type: String,
      value: 'medium' // small, medium, large
    },
    showName: {
      type: Boolean,
      value: true
    },
    isLocked: {
      type: Boolean,
      value: false
    }
  },

  data: {
    rarityColors: {
      common: '#9E9E9E',
      rare: '#2196F3',
      epic: '#9C27B0',
      legendary: '#FFD700'
    },
    rarityNames: {
      common: '普通',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说'
    }
  },

  methods: {
    onTap() {
      if (!this.data.isLocked) {
        this.triggerEvent('tap', { badge: this.data.badge });
      }
    }
  }
});
```

**Step 2: 创建组件 JSON 文件**

```json
{
  "component": true,
  "usingComponents": {}
}
```

**Step 3: 创建组件 WXML 文件**

```xml
<view class="badge-card badge-{{badge.rarity}} badge-{{size}} {{isLocked ? 'locked' : ''}}" bindtap="onTap">
  <view class="badge-icon">
    <image src="{{badge.icon || '/images/default-badge.png'}}" mode="aspectFit"></image>
    <view wx:if="{{isLocked}}" class="lock-overlay">
      <text class="lock-icon">🔒</text>
    </view>
  </view>
  <view wx:if="{{showName}}" class="badge-name">{{badge.name}}</view>
  <view wx:if="{{showName && !isLocked}}" class="badge-rarity">{{rarityNames[badge.rarity]}}</view>
</view>
```

**Step 4: 创建组件 WXSS 文件**

```css
.badge-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7));
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.badge-card:active {
  transform: scale(0.95);
}

.badge-card.locked {
  opacity: 0.5;
  filter: grayscale(100%);
}

.badge-icon {
  position: relative;
  width: 100rpx;
  height: 100rpx;
  margin-bottom: 10rpx;
}

.badge-icon image {
  width: 100%;
  height: 100%;
}

.lock-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
}

.lock-icon {
  font-size: 40rpx;
}

.badge-name {
  font-size: 24rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 4rpx;
  text-align: center;
}

.badge-rarity {
  font-size: 20rpx;
  color: #666;
}

/* 稀有度样式 */
.badge-common {
  border: 2rpx solid #9E9E9E;
}

.badge-rare {
  border: 2rpx solid #2196F3;
  box-shadow: 0 4rpx 12rpx rgba(33, 150, 243, 0.3);
}

.badge-epic {
  border: 3rpx solid #9C27B0;
  box-shadow: 0 4rpx 16rpx rgba(156, 39, 176, 0.4);
}

.badge-legendary {
  border: 4rpx solid #FFD700;
  box-shadow: 0 4rpx 20rpx rgba(255, 215, 0, 0.5);
  animation: legendary-glow 2s ease-in-out infinite;
}

@keyframes legendary-glow {
  0%, 100% {
    box-shadow: 0 4rpx 20rpx rgba(255, 215, 0, 0.5);
  }
  50% {
    box-shadow: 0 4rpx 30rpx rgba(255, 215, 0, 0.8);
  }
}

/* 尺寸样式 */
.badge-small .badge-icon {
  width: 48rpx;
  height: 48rpx;
}

.badge-small .badge-name,
.badge-small .badge-rarity {
  display: none;
}

.badge-large .badge-icon {
  width: 200rpx;
  height: 200rpx;
}

.badge-large .badge-name {
  font-size: 32rpx;
}

.badge-large .badge-rarity {
  font-size: 28rpx;
}
```

**Step 5: 提交**

```bash
git add components/badge-card/
git commit -m "feat: create badge card component"
```

---

### Task 17: 创建羽章详情弹窗组件

**Files:**
- Create: `components/badge-modal/badge-modal.js`
- Create: `components/badge-modal/badge-modal.json`
- Create: `components/badge-modal/badge-modal.wxml`
- Create: `components/badge-modal/badge-modal.wxss`

**Step 1: 创建组件 JS 文件**

```javascript
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    badge: {
      type: Object,
      value: {}
    }
  },

  data: {
    rarityNames: {
      common: '普通',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说'
    },
    typeNames: {
      achievement: '成就型',
      level: '等级型',
      identity: '身份型'
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('close');
    },

    onShare() {
      this.triggerEvent('share', { badge: this.data.badge });
    }
  }
});
```

**Step 2: 创建组件 JSON 文件**

```json
{
  "component": true,
  "usingComponents": {}
}
```

**Step 3: 创建组件 WXML 文件**

```xml
<view class="modal-overlay" wx:if="{{show}}" bindtap="onClose">
  <view class="modal-content" catchtap>
    <view class="modal-header">
      <view class="badge-icon-large">
        <image src="{{badge.icon || '/images/default-badge.png'}}" mode="aspectFit"></image>
      </view>
    </view>
    
    <view class="modal-body">
      <view class="badge-title">{{badge.name}}</view>
      <view class="badge-rarity-tag badge-{{badge.rarity}}">【{{rarityNames[badge.rarity]}}】</view>
      
      <view class="badge-description">{{badge.description}}</view>
      
      <view class="badge-info">
        <view class="info-row">
          <text class="info-label">获得时间：</text>
          <text class="info-value">{{badge.earned_at || '未获得'}}</text>
        </view>
        <view class="info-row">
          <text class="info-label">稀有度：</text>
          <text class="info-value">{{rarityNames[badge.rarity]}}</text>
        </view>
        <view class="info-row">
          <text class="info-label">类型：</text>
          <text class="info-value">{{typeNames[badge.type]}}</text>
        </view>
      </view>
    </view>
    
    <view class="modal-footer">
      <button class="btn-close" bindtap="onClose">关闭</button>
    </view>
  </view>
</view>
```

**Step 4: 创建组件 WXSS 文件**

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.2);
}

.modal-header {
  padding: 40rpx;
  display: flex;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
}

.badge-icon-large {
  width: 200rpx;
  height: 200rpx;
}

.badge-icon-large image {
  width: 100%;
  height: 100%;
}

.modal-body {
  padding: 40rpx;
}

.badge-title {
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 16rpx;
  color: #333;
}

.badge-rarity-tag {
  text-align: center;
  font-size: 28rpx;
  margin-bottom: 24rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  display: inline-block;
  width: 100%;
}

.badge-rarity-tag.badge-common {
  background: #f5f5f5;
  color: #9E9E9E;
}

.badge-rarity-tag.badge-rare {
  background: #e3f2fd;
  color: #2196F3;
}

.badge-rarity-tag.badge-epic {
  background: #f3e5f5;
  color: #9C27B0;
}

.badge-rarity-tag.badge-legendary {
  background: #fff8e1;
  color: #FFD700;
  font-weight: bold;
}

.badge-description {
  font-size: 28rpx;
  color: #666;
  text-align: center;
  margin-bottom: 32rpx;
  line-height: 1.6;
}

.badge-info {
  background: #f9f9f9;
  border-radius: 12rpx;
  padding: 24rpx;
}

.info-row {
  display: flex;
  margin-bottom: 16rpx;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  font-size: 26rpx;
  color: #999;
  width: 140rpx;
}

.info-value {
  font-size: 26rpx;
  color: #333;
  flex: 1;
}

.modal-footer {
  padding: 24rpx 40rpx 40rpx;
  display: flex;
  justify-content: center;
}

.btn-close {
  width: 200rpx;
  height: 72rpx;
  line-height: 72rpx;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 36rpx;
  font-size: 28rpx;
}
```

**Step 5: 提交**

```bash
git add components/badge-modal/
git commit -m "feat: create badge modal component"
```

---

### Task 18: 创建羽章页面

**Files:**
- Create: `pages/badges/badges.js`
- Create: `pages/badges/badges.json`
- Create: `pages/badges/badges.wxml`
- Create: `pages/badges/badges.wxss`

**Step 1: 创建页面 JS 文件**

```javascript
const badgeApi = require('../../utils/api/badge');

Page({
  data: {
    badges: [],
    myBadges: [],
    stats: {},
    loading: true,
    activeTab: 'all', // all, achievement, level, identity
    activeRarity: 'all', // all, common, rare, epic, legendary
    showBadgeModal: false,
    selectedBadge: null
  },

  onLoad() {
    this.loadBadges();
  },

  async loadBadges() {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const [allBadgesRes, myBadgesRes, statsRes] = await Promise.all([
        badgeApi.fetchAllBadges(),
        badgeApi.fetchMyBadges(),
        badgeApi.fetchBadgeStats()
      ]);
      
      this.setData({
        badges: allBadgesRes.data || [],
        myBadges: myBadgesRes.data.badges || [],
        stats: statsRes.data || {},
        loading: false
      });
      
      wx.hideLoading();
    } catch (error) {
      console.error('加载羽章失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  onRarityChange(e) {
    const rarity = e.currentTarget.dataset.rarity;
    this.setData({ activeRarity: rarity });
  },

  onBadgeTap(e) {
    const badge = e.detail.badge;
    this.setData({
      selectedBadge: badge,
      showBadgeModal: true
    });
  },

  onModalClose() {
    this.setData({
      showBadgeModal: false,
      selectedBadge: null
    });
  },

  getFilteredBadges() {
    let filtered = this.data.badges;
    
    if (this.data.activeTab !== 'all') {
      filtered = filtered.filter(b => b.type === this.data.activeTab);
    }
    
    if (this.data.activeRarity !== 'all') {
      filtered = filtered.filter(b => b.rarity === this.data.activeRarity);
    }
    
    return filtered;
  }
});
```

**Step 2: 创建页面 JSON 文件**

```json
{
  "navigationBarTitleText": "羽章系统",
  "usingComponents": {
    "badge-card": "/components/badge-card/badge-card",
    "badge-modal": "/components/badge-modal/badge-modal"
  }
}
```

**Step 3: 创建页面 WXML 文件**

```xml
<view class="badges-page">
  <!-- 统计区域 -->
  <view class="stats-section">
    <view class="stats-title">我的羽章</view>
    <view class="stats-count">{{stats.total_badges || 0}}/{{badges.length}}</view>
  </view>
  
  <!-- 筛选器 -->
  <view class="filters-section">
    <view class="filter-tabs">
      <view class="tab {{activeTab === 'all' ? 'active' : ''}}" data-tab="all" bindtap="onTabChange">全部</view>
      <view class="tab {{activeTab === 'achievement' ? 'active' : ''}}" data-tab="achievement" bindtap="onTabChange">成就</view>
      <view class="tab {{activeTab === 'level' ? 'active' : ''}}" data-tab="level" bindtap="onTabChange">等级</view>
      <view class="tab {{activeTab === 'identity' ? 'active' : ''}}" data-tab="identity" bindtap="onTabChange">身份</view>
    </view>
    
    <view class="filter-rarities">
      <view class="rarity {{activeRarity === 'all' ? 'active' : ''}}" data-rarity="all" bindtap="onRarityChange">全部</view>
      <view class="rarity rarity-common {{activeRarity === 'common' ? 'active' : ''}}" data-rarity="common" bindtap="onRarityChange">普通</view>
      <view class="rarity rarity-rare {{activeRarity === 'rare' ? 'active' : ''}}" data-rarity="rare" bindtap="onRarityChange">稀有</view>
      <view class="rarity rarity-epic {{activeRarity === 'epic' ? 'active' : ''}}" data-rarity="epic" bindtap="onRarityChange">史诗</view>
      <view class="rarity rarity-legendary {{activeRarity === 'legendary' ? 'active' : ''}}" data-rarity="legendary" bindtap="onRarityChange">传说</view>
    </view>
  </view>
  
  <!-- 羽章列表 -->
  <view class="badges-grid">
    <block wx:for="{{badges}}" wx:key="id">
      <badge-card 
        badge="{{item}}" 
        isLocked="{{!item.is_earned}}"
        bindtap="onBadgeTap"
      />
    </block>
  </view>
  
  <!-- 羽章详情弹窗 -->
  <badge-modal 
    show="{{showBadgeModal}}" 
    badge="{{selectedBadge}}"
    bindclose="onModalClose"
  />
</view>
```

**Step 4: 创建页面 WXSS 文件**

```css
.badges-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
  padding: 20rpx;
}

.stats-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx;
  text-align: center;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.stats-title {
  font-size: 32rpx;
  color: #666;
  margin-bottom: 16rpx;
}

.stats-count {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
}

.filters-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.filter-tabs {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20rpx;
  border-bottom: 2rpx solid #f0f0f0;
  padding-bottom: 20rpx;
}

.tab {
  font-size: 28rpx;
  color: #666;
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
  transition: all 0.3s ease;
}

.tab.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.filter-rarities {
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: 12rpx;
}

.rarity {
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 16rpx;
  background: #f5f5f5;
  color: #666;
  transition: all 0.3s ease;
}

.rarity.active {
  color: #fff;
}

.rarity-common.active {
  background: #9E9E9E;
}

.rarity-rare.active {
  background: #2196F3;
}

.rarity-epic.active {
  background: #9C27B0;
}

.rarity-legendary.active {
  background: linear-gradient(135deg, #FFD700, #FFA500);
}

.badges-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
  padding: 20rpx 0;
}
```

**Step 5: 提交**

```bash
git add pages/badges/
git commit -m "feat: create badges page"
```

---

### Task 19: 在 app.json 中注册羽章页面

**Files:**
- Modify: `app.json`

**Step 1: 添加羽章页面到 pages 数组**

在 `app.json` 的 `pages` 数组中添加：

```json
"pages/badges/badges"
```

**Step 2: 提交**

```bash
git add app.json
git commit -m "feat: register badges page in app.json"
```

---

### Task 20: 在个人中心页集成羽章展示

**Files:**
- Modify: `pages/my/my.js`
- Modify: `pages/my/my.wxml`
- Modify: `pages/my/my.wxss`

**Step 1: 在 my.js 中添加羽章数据加载**

在 `onLoad` 或 `onShow` 方法中添加：

```javascript
const badgeApi = require('../../utils/api/badge');

// 加载用户羽章
this.loadUserBadges();

// 添加方法
async loadUserBadges() {
  try {
    const res = await badgeApi.fetchMyBadges();
    const displayBadges = res.data.badges
      .filter(b => b.is_displayed)
      .slice(0, 2);
    
    this.setData({
      userBadges: displayBadges
    });
  } catch (error) {
    console.error('加载用户羽章失败:', error);
  }
},

goToBadges() {
  wx.navigateTo({
    url: '/pages/badges/badges'
  });
}
```

**Step 2: 在 my.wxml 中添加羽章展示**

在用户昵称旁边添加：

```xml
<view class="user-badges">
  <block wx:for="{{userBadges}}" wx:key="id">
    <image class="badge-icon-mini" src="{{item.icon}}" mode="aspectFit"></image>
  </block>
  <text class="view-all-badges" bindtap="goToBadges">查看全部 ></text>
</view>
```

**Step 3: 在 my.wxss 中添加样式**

```css
.user-badges {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 10rpx;
}

.badge-icon-mini {
  width: 32rpx;
  height: 32rpx;
}

.view-all-badges {
  font-size: 24rpx;
  color: #999;
  margin-left: 16rpx;
}
```

**Step 4: 提交**

```bash
git add pages/my/
git commit -m "feat: integrate badges display in my page"
```

---

## Phase 5: 测试与优化

### Task 21: 测试羽章发放功能

**Step 1: 测试用户登录触发**

1. 使用新用户登录
2. 检查是否获得"初入南苑"羽章
3. 检查是否获得"创始成员"羽章（如果用户ID <= 1000）

**Step 2: 测试资料完善触发**

1. 完善用户资料（学号、微信号）
2. 上传头像
3. 检查是否获得"身份认证"和"形象塑造"羽章

**Step 3: 测试社团操作触发**

1. 加入社团
2. 检查是否获得"社团新人"羽章
3. 成为社长
4. 检查是否获得"社团领袖"羽章

**Step 4: 提交测试记录**

```bash
git commit --allow-empty -m "test: verify badge award functionality"
```

---

### Task 22: 性能优化

**Files:**
- Modify: `backend/services/badgeService.js`

**Step 1: 添加缓存机制**

在羽章服务中添加缓存：

```javascript
const cache = {};

async getAllBadges(userId = null) {
  const cacheKey = `badges_all_${userId || 'guest'}`;
  
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < 60000) {
    return cache[cacheKey].data;
  }
  
  // ... 原有逻辑
  
  cache[cacheKey] = {
    data: badges,
    timestamp: Date.now()
  };
  
  return badges;
}
```

**Step 2: 提交**

```bash
git add backend/services/badgeService.js
git commit -m "perf: add cache for badge service"
```

---

## Summary

本实施计划涵盖了羽章系统的完整开发流程，包括：

1. **数据库设计**：4张核心表（badges, user_badges, badge_logs, user_activity_stats）
2. **后端服务**：羽章服务类、路由、触发器集成
3. **前端开发**：API模块、组件、页面
4. **测试优化**：功能测试、性能优化

预计开发时间：16-21天

关键技术点：
- 自动触发机制确保公平性
- 分层架构设计便于维护
- 组件化开发提高复用性
- 缓存机制提升性能
