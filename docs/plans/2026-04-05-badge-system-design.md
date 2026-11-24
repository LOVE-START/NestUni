# 羽章系统设计文档

## 一、概述

### 1.1 系统名称
羽章系统（Badge System）

### 1.2 系统目标
羽章系统旨在通过勋章激励机制，提升用户活跃度、记录用户成长历程、增强社交展示属性，打造一个综合性的用户成就体系。

### 1.3 核心价值
- **激励用户活跃**：通过羽章奖励机制，鼓励用户参与社团活动、报名招新、发布评论等
- **记录成长历程**：记录用户在社团中的关键里程碑事件，如加入社团、参与活动、成为会长等
- **社交展示属性**：作为社交展示元素，让用户展示自己的成就和身份，增强社区归属感

---

## 二、羽章类型设计

### 2.1 成就型羽章（Achievement Badges）

记录用户的关键里程碑事件，一次性获取，永久拥有。

#### 基础成就类
| 羽章名称 | 稀有度 | 触发条件 | 描述 |
|---------|--------|---------|------|
| 🌱 初入南苑 | 普通 | 用户首次登录 | 完成首次登录 |
| 📝 身份认证 | 普通 | 完善个人资料（学号、微信号） | 完善个人资料 |
| 🎨 形象塑造 | 普通 | 上传头像 | 上传头像 |

#### 社团成就类
| 羽章名称 | 稀有度 | 触发条件 | 描述 |
|---------|--------|---------|------|
| 🏠 社团新人 | 稀有 | 加入第一个社团 | 加入第一个社团 |
| 👥 社团达人 | 史诗 | 加入2个以上社团 | 加入2个以上社团 |
| 👑 社团领袖 | 传说 | 成为社团会长 | 成为社团会长 |
| 🌟 社团之星 | 史诗 | 在社团待满1年 | 在社团待满1年 |

#### 活动成就类
| 羽章名称 | 稀有度 | 触发条件 | 描述 |
|---------|--------|---------|------|
| 🎪 活动先锋 | 稀有 | 参加第一个活动 | 参加第一个活动 |
| 🎉 活动达人 | 史诗 | 参加5个以上活动 | 参加5个以上活动 |
| 🏆 活动之星 | 传说 | 参加8个以上活动 | 参加8个以上活动 |
| 📍 地图探索者 | 稀有 | 使用地图功能查看活动位置 | 使用地图功能查看活动位置 |

#### 招新成就类
| 羽章名称 | 稀有度 | 触发条件 | 描述 |
|---------|--------|---------|------|
| 📋 首次报名 | 普通 | 完成第一次社团报名 | 完成第一次社团报名 |

#### 社交成就类
| 羽章名称 | 稀有度 | 触发条件 | 描述 |
|---------|--------|---------|------|
| 💬 评论新手 | 普通 | 发表第一条评论 | 发表第一条评论 |
| 🗣️ 评论达人 | 稀有 | 发表10条以上评论 | 发表10条以上评论 |

---

### 2.2 等级型羽章（Level Badges）

根据用户活跃度动态变化，需要持续保持。

#### 活跃度等级
| 等级 | 稀有度 | 活跃度范围 | 描述 |
|------|--------|-----------|------|
| 📊 青铜活跃 | 普通 | 1-30 | 活跃度 1-30 |
| 📊 白银活跃 | 稀有 | 31-60 | 活跃度 31-60 |
| 📊 黄金活跃 | 史诗 | 61-80 | 活跃度 61-80 |
| 📊 钻石活跃 | 传说 | 81-100 | 活跃度 81-100 |

**活跃度计算规则：**
- 基于近30天的用户行为数据
- 登录次数、活动参与、评论互动、报名次数等综合计算
- 每日凌晨自动更新

---

### 2.3 身份型羽章（Identity Badges）

与用户身份绑定，具有特殊权限或标识。

#### 系统身份
| 羽章名称 | 稀有度 | 触发条件 | 描述 |
|---------|--------|---------|------|
| 🛡️ 系统管理员 | 传说 | 用户角色为管理员 | 系统管理员专属 |
| 👨‍💼 社团会长 | 传说 | 用户角色为社长 | 社团会长专属 |
| 👤 认证用户 | 稀有 | 完成学号认证 | 完成学号认证的用户 |

#### 特殊身份
| 羽章名称 | 稀有度 | 触发条件 | 描述 |
|---------|--------|---------|------|
| 🎖️ 创始成员 | 传说 | 早期注册用户（前1000名） | 早期注册用户（前1000名） |
| 🏅 优秀会长 | 传说 | 由管理员授予 | 由管理员授予的优秀会长称号 |

---

## 三、稀有度系统设计

### 3.1 稀有度等级

采用四级稀有度系统，用颜色和边框区分：

| 稀有度 | 颜色 | 色值 | 边框 | 光效 | 占比 |
|--------|------|------|------|------|------|
| 普通 | 银灰色 | #9E9E9E | 简单银色边框 | 无特殊光效 | 60% |
| 稀有 | 宝蓝色 | #2196F3 | 蓝色发光边框 | 轻微蓝色光晕 | 30% |
| 史诗 | 紫罗兰色 | #9C27B0 | 紫色渐变边框 | 紫色流光效果 | 8% |
| 传说 | 金色 | #FFD700 | 金色立体边框 | 金色粒子特效 | 2% |

### 3.2 稀有度分配原则
- **普通（60%）**：基础成就，容易获得
- **稀有（30%）**：中等难度，需要一定努力
- **史诗（8%）**：较高难度，需要持续投入
- **传说（2%）**：极难获得，代表最高荣誉

---

## 四、数据库设计

### 4.1 羽章定义表（badges）

```sql
CREATE TABLE `badges` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '羽章ID',
  `code` varchar(50) NOT NULL COMMENT '羽章代码（唯一标识）',
  `name` varchar(100) NOT NULL COMMENT '羽章名称',
  `description` text COMMENT '羽章描述',
  `icon` varchar(255) DEFAULT NULL COMMENT '羽章图标URL',
  `type` enum('achievement','level','identity') NOT NULL COMMENT '羽章类型',
  `rarity` enum('common','rare','epic','legendary') DEFAULT 'common' COMMENT '稀有度',
  `category` varchar(50) DEFAULT NULL COMMENT '羽章分类（基础、社团、活动、招新、社交）',
  `trigger_type` varchar(50) DEFAULT NULL COMMENT '触发类型（login、join_club、attend_event等）',
  `trigger_condition` json DEFAULT NULL COMMENT '触发条件（JSON格式）',
  `points` int(11) DEFAULT '0' COMMENT '羽章积分值',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `sort_order` int(11) DEFAULT '0' COMMENT '排序权重',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_type` (`type`),
  KEY `idx_rarity` (`rarity`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='羽章定义表';
```

### 4.2 用户羽章关联表（user_badges）

```sql
CREATE TABLE `user_badges` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `badge_id` int(11) NOT NULL COMMENT '羽章ID',
  `earned_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '获得时间',
  `is_displayed` tinyint(1) DEFAULT '1' COMMENT '是否在个人中心展示',
  `display_order` int(11) DEFAULT '0' COMMENT '展示顺序',
  `metadata` json DEFAULT NULL COMMENT '额外元数据（如等级羽章的当前等级）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_badge` (`user_id`, `badge_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_badge_id` (`badge_id`),
  KEY `idx_earned_at` (`earned_at`),
  CONSTRAINT `fk_user_badges_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_badges_badge` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户羽章关联表';
```

### 4.3 羽章获取日志表（badge_logs）

```sql
CREATE TABLE `badge_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `badge_id` int(11) NOT NULL COMMENT '羽章ID',
  `action` enum('earned','upgraded','downgraded','lost') NOT NULL COMMENT '动作类型',
  `old_value` json DEFAULT NULL COMMENT '旧值（等级羽章的旧等级）',
  `new_value` json DEFAULT NULL COMMENT '新值',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_badge_id` (`badge_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_badge_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_badge_logs_badge` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='羽章获取日志表';
```

### 4.4 用户活跃度统计表（user_activity_stats）

```sql
CREATE TABLE `user_activity_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '统计ID',
  `user_id` int(11) NOT NULL COMMENT '用户ID',
  `stat_date` date NOT NULL COMMENT '统计日期',
  `login_count` int(11) DEFAULT '0' COMMENT '登录次数',
  `event_count` int(11) DEFAULT '0' COMMENT '参与活动数',
  `comment_count` int(11) DEFAULT '0' COMMENT '评论数',
  `application_count` int(11) DEFAULT '0' COMMENT '报名数',
  `activity_score` int(11) DEFAULT '0' COMMENT '活跃度得分',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`, `stat_date`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_stat_date` (`stat_date`),
  CONSTRAINT `fk_activity_stats_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户活跃度统计表';
```

---

## 五、羽章触发机制设计

### 5.1 自动触发机制

羽章系统通过监听用户行为事件，自动判断是否满足羽章获取条件。

**触发流程：**
```
用户行为 → 事件监听器 → 条件判断 → 羽章发放 → 通知用户
```

### 5.2 触发事件定义

#### 基础事件
- `user.login` - 用户登录
- `user.profile_update` - 用户资料更新
- `user.avatar_upload` - 用户上传头像

#### 社团事件
- `club.joined` - 用户加入社团
- `club.became_leader` - 用户成为社长
- `club.anniversary` - 社团周年纪念

#### 活动事件
- `event.registered` - 用户报名活动
- `event.attended` - 用户参与活动
- `event.map_viewed` - 用户查看活动地图

#### 招新事件
- `recruitment.applied` - 用户提交报名
- `recruitment.accepted` - 报名被录取

#### 社交事件
- `comment.created` - 用户发表评论

### 5.3 触发条件配置

在 `badges` 表的 `trigger_condition` 字段中存储 JSON 格式的触发条件：

**示例：社团达人羽章**
```json
{
  "trigger_event": "club.joined",
  "conditions": {
    "total_clubs": { "gte": 2 }
  },
  "check_type": "aggregate"
}
```

**示例：活动之星羽章**
```json
{
  "trigger_event": "event.attended",
  "conditions": {
    "total_events": { "gte": 8 }
  },
  "check_type": "aggregate"
}
```

**示例：创始成员羽章**
```json
{
  "trigger_event": "user.login",
  "conditions": {
    "user_id": { "lte": 1000 }
  },
  "check_type": "immediate"
}
```

**示例：活跃等级羽章**
```json
{
  "trigger_event": "user.activity_update",
  "conditions": {
    "activity_score": {
      "bronze": { "range": [1, 30] },
      "silver": { "range": [31, 60] },
      "gold": { "range": [61, 80] },
      "diamond": { "range": [81, 100] }
    }
  },
  "check_type": "level"
}
```

### 5.4 羽章发放服务

**后端服务架构：**

```
backend/
├── services/
│   └── badgeService.js        # 羽章服务
├── triggers/
│   ├── badgeTrigger.js        # 羽章触发器基类
│   ├── userTriggers.js        # 用户相关触发器
│   ├── clubTriggers.js        # 社团相关触发器
│   ├── eventTriggers.js       # 活动相关触发器
│   └── recruitmentTriggers.js # 招新相关触发器
└── routes/
    └── badges.js              # 羽章路由
```

**核心服务方法：**

```javascript
// badgeService.js 核心方法
class BadgeService {
  /**
   * 检查并发放羽章
   * @param {number} userId - 用户ID
   * @param {string} triggerEvent - 触发事件
   * @param {object} eventData - 事件数据
   */
  async checkAndAwardBadge(userId, triggerEvent, eventData) {
    // 1. 查找所有监听该事件的羽章
    // 2. 检查用户是否满足条件
    // 3. 发放羽章并记录日志
    // 4. 发送通知给用户
  }
  
  /**
   * 计算用户活跃度
   * @param {number} userId - 用户ID
   */
  async calculateActivityScore(userId) {
    // 计算近30天的活跃度得分
  }
  
  /**
   * 更新等级羽章
   * @param {number} userId - 用户ID
   */
  async updateLevelBadges(userId) {
    // 更新活跃度和贡献度等级羽章
  }
}
```

### 5.5 触发时机

**实时触发：**
- 用户登录时检查基础羽章
- 加入社团时检查社团羽章
- 报名活动时检查活动羽章
- 发表评论时检查社交羽章

**定时触发：**
- 每日凌晨计算活跃度得分
- 每周更新等级羽章状态
- 每月检查社团周年羽章

---

## 六、前端页面设计

### 6.1 独立羽章页面

**页面路径：** `pages/badges/badges`

**页面结构：**

```
┌─────────────────────────────────┐
│         羽章系统                 │
│    我的羽章 (12/45)              │
├─────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │ 筛选 │ │ 排序 │ │ 统计 │       │
│  └─────┘ └─────┘ └─────┘       │
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │  成就型羽章 (8)            │  │
│  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐  │  │
│  │  │   │ │   │ │   │ │   │  │  │
│  │  └───┘ └───┘ └───┘ └───┘  │  │
│  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐  │  │
│  │  │   │ │   │ │   │ │   │  │  │
│  │  └───┘ └───┘ └───┘ └───┘  │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  等级型羽章 (2)            │  │
│  │  ┌───┐ ┌───┐             │  │
│  │  │   │ │   │             │  │
│  │  └───┘ └───┘             │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  身份型羽章 (2)            │  │
│  │  ┌───┐ ┌───┐             │  │
│  │  │   │ │   │             │  │
│  │  └───┘ └───┘             │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**页面功能：**
- 顶部显示羽章统计（已获得/总数）
- 筛选器：按类型、稀有度、分类筛选
- 排序器：按获得时间、稀有度排序
- 分类展示：成就型、等级型、身份型
- 羽章卡片：点击查看详情
- 未获得羽章：灰色显示，显示获取条件

### 6.2 羽章详情弹窗

**弹窗结构：**

```
┌─────────────────────────────┐
│         ┌─────────┐         │
│         │  羽章图标 │         │
│         │  (大图)  │         │
│         └─────────┘         │
│                             │
│      社团领袖 👑            │
│      【传说】               │
│                             │
│  成为社团会长，带领社团      │
│  走向辉煌                   │
│                             │
│  ─────────────────────      │
│                             │
│  获得时间：2025-11-04       │
│  稀有度：传说               │
│  类型：身份型               │
│                             │
│      [关闭]                 │
└─────────────────────────────┘
```

**弹窗功能：**
- 大图标展示
- 羽章名称和稀有度
- 详细描述
- 获得时间
- 关闭按钮

### 6.3 个人中心页羽章展示

**展示位置：** 用户名称右边

**展示样式：**

```
┌─────────────────────────────────┐
│      ┌───────┐                  │
│      │ 头像   │                  │
│      └───────┘                  │
│      用户昵称  ┌───┐ ┌───┐      │
│               │   │ │   │      │
│               └───┘ └───┘      │
│  查看全部羽章 >                 │
└─────────────────────────────────┘
```

**展示规则：**
- 最多展示2个羽章
- 优先展示：身份型 > 传说 > 史诗 > 稀有 > 普通
- 用户可自定义展示顺序
- 点击"查看全部"跳转到羽章页面

### 6.4 社交互动区域羽章展示

**展示位置：** 评论列表、报名记录等

**展示样式：**

```
┌─────────────────────────────────┐
│  ┌────┐ 用户昵称  ┌───┐ ┌───┐  │
│  │头像│          │   │ │   │  │
│  └────┘          └───┘ └───┘  │
│  评论内容...                    │
└─────────────────────────────────┘
```

**展示规则：**
- 在用户昵称旁展示最多2个羽章
- 优先展示身份型羽章
- 羽章图标较小（24rpx × 24rpx）
- 点击羽章可查看详情

### 6.5 羽章获得通知

**通知方式：**

1. **Toast 提示**
```
┌─────────────────────┐
│   🎉 获得新羽章！    │
│   社团领袖           │
└─────────────────────┘
```

2. **弹窗通知**
```
┌─────────────────────────┐
│   🎉 恭喜获得新羽章！    │
│                         │
│      ┌─────────┐        │
│      │ 羽章图标 │        │
│      └─────────┘        │
│                         │
│      社团领袖 👑        │
│      【传说】           │
│                         │
│   [查看详情]  [关闭]     │
└─────────────────────────┘
```

**触发时机：**
- 实时触发时立即显示
- 用户下次打开小程序时显示未读通知

---

## 七、API 接口设计

### 7.1 羽章相关接口

#### 获取所有羽章列表
```
GET /nfunest/api/badges
```

**请求参数：**
- `type` - 羽章类型筛选
- `rarity` - 稀有度筛选
- `category` - 分类筛选
- `sort` - 排序方式

**响应数据：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "first_login",
      "name": "初入南苑",
      "description": "完成首次登录",
      "icon": "https://...",
      "type": "achievement",
      "rarity": "common",
      "category": "基础",
      "is_earned": true,
      "earned_at": "2025-11-04T12:00:00Z"
    }
  ]
}
```

#### 获取用户羽章列表
```
GET /nfunest/api/badges/my
```

**响应数据：**
```json
{
  "success": true,
  "data": {
    "total": 12,
    "badges": [
      {
        "id": 1,
        "code": "first_login",
        "name": "初入南苑",
        "description": "完成首次登录",
        "icon": "https://...",
        "type": "achievement",
        "rarity": "common",
        "category": "基础",
        "earned_at": "2025-11-04T12:00:00Z",
        "is_displayed": true,
        "display_order": 1
      }
    ],
    "stats": {
      "achievement": 8,
      "level": 2,
      "identity": 2
    }
  }
}
```

#### 获取羽章详情
```
GET /nfunest/api/badges/:id
```

**响应数据：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "club_leader",
    "name": "社团领袖",
    "description": "成为社团会长，带领社团走向辉煌",
    "icon": "https://...",
    "type": "identity",
    "rarity": "legendary",
    "category": "社团",
    "earned_at": "2025-11-04T12:00:00Z",
    "trigger_condition": {
      "trigger_event": "club.became_leader"
    }
  }
}
```

#### 更新羽章展示设置
```
PUT /nfunest/api/badges/my/display
```

**请求参数：**
```json
{
  "badge_ids": [1, 2, 3, 4],
  "display_orders": {
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4
  }
}
```

#### 获取用户羽章统计
```
GET /nfunest/api/badges/my/stats
```

**响应数据：**
```json
{
  "success": true,
  "data": {
    "total_badges": 12,
    "total_points": 150,
    "by_rarity": {
      "common": 8,
      "rare": 3,
      "epic": 1,
      "legendary": 0
    },
    "by_type": {
      "achievement": 8,
      "level": 2,
      "identity": 2
    },
    "recent_badges": [
      {
        "id": 1,
        "name": "社团领袖",
        "earned_at": "2025-11-04T12:00:00Z"
      }
    ]
  }
}
```

### 7.2 活跃度相关接口

#### 获取用户活跃度
```
GET /nfunest/api/badges/my/activity
```

**响应数据：**
```json
{
  "success": true,
  "data": {
    "activity_score": 75,
    "level": "gold",
    "stats": {
      "login_count": 20,
      "event_count": 5,
      "comment_count": 10,
      "application_count": 3
    },
    "history": [
      {
        "date": "2025-11-04",
        "score": 8
      }
    ]
  }
}
```

### 7.3 管理员接口

#### 创建羽章（管理员）
```
POST /nfunest/api/admin/badges
```

#### 更新羽章（管理员）
```
PUT /nfunest/api/admin/badges/:id
```

#### 删除羽章（管理员）
```
DELETE /nfunest/api/admin/badges/:id
```

#### 手动发放羽章（管理员）
```
POST /nfunest/api/admin/badges/:id/award
```

**请求参数：**
```json
{
  "user_id": 123
}
```

---

## 八、视觉设计规范

### 8.1 羽章图标设计规范

**图标尺寸：**
- 大图标（详情页）：200rpx × 200rpx
- 中图标（列表页）：100rpx × 100rpx
- 小图标（社交区域）：48rpx × 48rpx
- 迷你图标（昵称旁）：32rpx × 32rpx

**图标样式：**
- 采用经典徽章风格
- 圆形或盾形外框
- 金属质感边框
- 中心图案简洁明了
- 配合稀有度颜色

### 8.2 稀有度视觉规范

#### 普通（Common）
```
颜色：#9E9E9E（银灰色）
边框：2rpx 实线银色
背景：浅灰色渐变
光效：无
阴影：轻微阴影
```

#### 稀有（Rare）
```
颜色：#2196F3（宝蓝色）
边框：2rpx 发光蓝色边框
背景：蓝色渐变
光效：轻微蓝色光晕
阴影：蓝色阴影
```

#### 史诗（Epic）
```
颜色：#9C27B0（紫罗兰色）
边框：3rpx 渐变紫色边框
背景：紫色渐变
光效：紫色流光效果
阴影：紫色发光阴影
```

#### 传说（Legendary）
```
颜色：#FFD700（金色）
边框：4rpx 立体金色边框
背景：金色渐变
光效：金色粒子特效
阴影：金色发光阴影
```

### 8.3 羽章图标示例设计

#### 基础成就类

**🌱 初入南苑**（普通）
- 图案：简化的羽毛图案
- 颜色：银灰色
- 边框：简单银色圆形边框

**📝 身份认证**（普通）
- 图案：打勾的文档图标
- 颜色：银灰色
- 边框：简单银色盾形边框

**🎨 形象塑造**（普通）
- 图案：相机或画笔图标
- 颜色：银灰色
- 边框：简单银色圆形边框

#### 社团成就类

**🏠 社团新人**（稀有）
- 图案：房屋图标 + 小羽毛
- 颜色：宝蓝色
- 边框：发光蓝色圆形边框

**👥 社团达人**（史诗）
- 图案：多个人物图标 + 羽毛
- 颜色：紫罗兰色
- 边框：渐变紫色盾形边框

**👑 社团领袖**（传说）
- 图案：皇冠 + 羽毛
- 颜色：金色
- 边框：立体金色圆形边框
- 特效：金色粒子环绕

**🌟 社团之星**（史诗）
- 图案：星星 + 羽毛
- 颜色：紫罗兰色
- 边框：渐变紫色圆形边框

#### 活动成就类

**🎪 活动先锋**（稀有）
- 图案：旗帜 + 羽毛
- 颜色：宝蓝色
- 边框：发光蓝色盾形边框

**🎉 活动达人**（史诗）
- 图案：礼花 + 羽毛
- 颜色：紫罗兰色
- 边框：渐变紫色圆形边框

**🏆 活动之星**（传说）
- 图案：奖杯 + 羽毛
- 颜色：金色
- 边框：立体金色盾形边框
- 特效：金色光芒

**📍 地图探索者**（稀有）
- 图案：地图标记 + 羽毛
- 颜色：宝蓝色
- 边框：发光蓝色圆形边框

#### 招新成就类

**📋 首次报名**（普通）
- 图案：表单 + 打勾
- 颜色：银灰色
- 边框：简单银色盾形边框

#### 社交成就类

**💬 评论新手**（普通）
- 图案：对话气泡
- 颜色：银灰色
- 边框：简单银色圆形边框

**🗣️ 评论达人**（稀有）
- 图案：多个对话气泡
- 颜色：宝蓝色
- 边框：发光蓝色圆形边框

#### 等级型羽章

**📊 活跃等级**（根据等级变化）
- 青铜：铜色圆形徽章 + 羽毛
- 白银：银色圆形徽章 + 羽毛
- 黄金：金色圆形徽章 + 羽毛
- 钻石：钻石色圆形徽章 + 羽毛 + 光效

#### 身份型羽章

**🛡️ 系统管理员**（传说）
- 图案：盾牌 + 星星
- 颜色：金色
- 边框：立体金色盾形边框
- 特效：金色光芒环绕

**👨‍💼 社团会长**（传说）
- 图案：皇冠 + 羽毛
- 颜色：金色
- 边框：立体金色圆形边框

**👤 认证用户**（稀有）
- 图案：打勾的盾牌
- 颜色：宝蓝色
- 边框：发光蓝色盾形边框

**🎖️ 创始成员**（传说）
- 图案：特殊的羽毛徽章
- 颜色：金色
- 边框：立体金色圆形边框
- 特效：金色粒子环绕
- 文字："FOUNDING MEMBER"

**🏅 优秀会长**（传说）
- 图案：奖牌 + 羽毛
- 颜色：金色
- 边框：立体金色盾形边框
- 特效：金色光芒

---

## 九、实施计划

### 9.1 开发阶段划分

#### 第一阶段：基础架构（预计 3-4 天）
1. 数据库表创建
2. 后端基础服务搭建
3. API 接口开发
4. 羽章触发器框架

#### 第二阶段：核心功能（预计 5-6 天）
1. 成就型羽章实现
2. 等级型羽章实现
3. 身份型羽章实现
4. 活跃度计算系统

#### 第三阶段：前端页面（预计 4-5 天）
1. 独立羽章页面开发
2. 羽章详情弹窗
3. 个人中心页集成
4. 社交区域展示

#### 第四阶段：视觉资源（预计 2-3 天）
1. 羽章图标设计
2. 稀有度视觉效果
3. 动画效果实现

#### 第五阶段：测试优化（预计 2-3 天）
1. 功能测试
2. 性能优化
3. 用户体验优化
4. Bug 修复

### 9.2 技术栈

**后端：**
- Node.js + Express
- MySQL + Knex.js
- 定时任务（node-cron）

**前端：**
- 微信小程序原生框架
- 组件化开发

**设计：**
- 图标设计工具（Figma/Sketch）
- 动画效果（CSS3 + 微信小程序动画 API）

---

## 十、总结

羽章系统是一个综合性的用户成就体系，通过成就型、等级型、身份型三种羽章类型，结合四级稀有度系统，实现激励用户活跃、记录成长历程、增强社交展示的目标。

系统采用自动触发机制，确保公平性和及时性，前端页面设计简洁直观，视觉风格采用经典徽章风格，配合金属质感和稀有度颜色区分，打造具有荣誉感和收集乐趣的用户体验。

通过完善的数据库设计、触发机制、API 接口和视觉规范，羽章系统将成为南苑 Nest 社团管理系统的重要组成部分，提升用户粘性和社区活跃度。
