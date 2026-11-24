# 社团数据分析可视化功能设计文档

## 📋 文档信息

- **创建日期**: 2026-04-11
- **版本**: 1.0
- **作者**: AI Assistant
- **状态**: 已批准

***

## 🎯 项目概述

### 背景

南苑Nest社团管理系统目前已具备社团管理、活动发布、招新管理等核心功能，但缺少数据分析和可视化展示能力。社团会长和管理员无法直观了解社团运营状况，难以基于数据做出优化决策。

### 目标

为社团会长和管理员提供轻量级数据分析面板，通过可视化图表展示活动参与度、成员活跃度、招新转化率等关键指标，帮助用户精准把握社团运营状况，优化活动策划。

### 目标用户

- **主要用户**: 社团会长/管理员
- **次要用户**: 学校管理员

***

## 📊 功能需求

### 1. 综合概览（数据卡片）

展示社团核心运营指标，快速了解整体状况。

| 指标名称  | 计算逻辑                      | 数据来源                            |
| ----- | ------------------------- | ------------------------------- |
| 成员总数  | `club_members` 表中该社团的成员数量 | `club_members`                  |
| 活动总数  | 该社团关联的活动数量（已发布状态）         | `events` + `event_clubs`        |
| 招新人数  | 该社团所有招新的报名总数              | `applications` + `recruitments` |
| 平均活跃度 | 社团成员的平均活跃度分数              | `user_activity_stats`           |

**趋势对比**: 显示与上一时间段的对比百分比

### 2. 活动数据分析

#### 2.1 活动参与趋势（折线图）

- **X轴**: 时间（按月）
- **Y轴**: 参与人数
- **数据**: 最近6个月的活动参与人数趋势
- **用途**: 了解活动热度的变化趋势

#### 2.2 活动类型分布（饼图）

- **分类**: 学术、娱乐、体育、公益、文化
- **数据**: 各类型活动数量占比
- **用途**: 了解社团活动类型的多样性

#### 2.3 活动参与率排行（柱状图）

- **指标**: 参与率 = `current_participants / max_participants`
- **展示**: Top 10 活动的参与率
- **用途**: 识别最受欢迎的活动

### 3. 成员数据分析

#### 3.1 成员活跃度趋势（折线图）

- **X轴**: 时间（按月）
- **Y轴**: 平均活跃度分数
- **数据**: 最近6个月的成员活跃度变化
- **用途**: 监控社团成员的整体活跃度

#### 3.2 成员等级分布（饼图）

- **等级划分**:
  - 青铜: 0-30分
  - 白银: 31-60分
  - 黄金: 61-80分
  - 钻石: 81-100分
- **数据**: 各等级成员数量占比
- **用途**: 了解成员活跃度的整体分布

#### 3.3 活跃成员排行（列表）

- **展示**: Top 10 活跃成员
- **数据**: 用户昵称、活跃度分数、等级
- **用途**: 识别核心活跃成员，便于激励和管理

### 4. 招新数据分析

#### 4.1 招新转化漏斗（漏斗图）

- **阶段**: 浏览 → 报名 → 面试 → 录用
- **数据**: 各阶段人数及转化率
- **用途**: 分析招新流程中的流失点

#### 4.2 历年招新对比（柱状图）

- **X轴**: 年份
- **Y轴**: 报名人数/录用人数
- **数据**: 最近3年的招新数据对比
- **用途**: 了解招新趋势和效果

#### 4.3 报名来源分析（饼图）

- **数据**: 各招新活动的报名人数占比
- **用途**: 识别最有效的招新渠道

### 5. 时间筛选功能

- **预设选项**:
  - 本学期
  - 上学期
  - 本学年
  - 上学年
- **自定义**: 日期范围选择器

***

## 🎨 界面设计

### 页面布局

#### 社团会长视图

位置: 社团管理页 → 数据分析标签页

```
┌─────────────────────────────────────────────┐
│  [社团信息] [成员管理] [活动管理] [数据分析]  │
├─────────────────────────────────────────────┤
│  📊 数据概览                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │ 成员数  │ │ 活动数  │ │ 招新数  │ │活跃度  ││
│  │  128   │ │   12   │ │   45   │ │  78分  ││
│  │ ↑ 12%  │ │ ↑ 8%   │ │ ↓ 5%   │ │ ↑ 15% ││
│  └────────┘ └────────┘ └────────┘ └────────┘│
│                                              │
│  📅 时间筛选：[本学期 ▼]                     │
│                                              │
│  ━━━ 活动数据 ━━━                            │
│  [参与趋势] [类型分布] [参与率排行]          │
│                                              │
│  ━━━ 成员数据 ━━━                            │
│  [活跃度趋势] [等级分布] [活跃排行]          │
│                                              │
│  ━━━ 招新数据 ━━━                            │
│  [转化漏斗] [历年对比] [来源分析]            │
└─────────────────────────────────────────────┘
```

#### 管理员视图

位置: 管理员面板 → 数据分析

```
┌─────────────────────────────────────────────┐
│  📊 全校社团数据分析                         │
├─────────────────────────────────────────────┤
│  筛选：[全部社团 ▼] [本学期 ▼]              │
│                                              │
│  📊 全校概览                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │社团总数 │ │活动总数 │ │报名总数 │ │用户总数 ││
│  └────────┘ └────────┘ └────────┘ └────────┘│
│                                              │
│  📈 社团活跃度排行                           │
│  📊 活动类型分布（全校）                     │
└─────────────────────────────────────────────┘
```

***

## 🔧 技术方案

### 前端技术栈

#### 图表库选择

**ECharts** (推荐)

- **优点**:
  - 功能强大，支持多种图表类型
  - 社区活跃，文档完善
  - 微信小程序支持良好
  - 性能优秀，支持大数据量
- **集成方式**: 使用 `echarts-for-weixin` 项目

**备选方案**: wx-charts

- 微信小程序原生图表库
- 轻量级，但功能相对简单

#### 文件结构

```
pages/
  ├── edit/
  │   ├── edit.wxml              # 社团管理主页（增加数据分析标签）
  │   ├── edit.js
  │   └── components/
  │       └── DataAnalysis/       # 数据分析组件
  │           ├── index.wxml
  │           ├── index.js
  │           ├── index.json
  │           └── index.wxss
  └── admin/
      └── dashboard/
          └── components/
              └── DataAnalysis/   # 管理员数据分析组件
```

### 后端 API 设计

#### 新增路由文件

创建 `backend/routes/stats.js`

#### API 接口列表

##### 1. 获取社团综合概览数据

```
GET /api/clubs/:clubId/stats/overview
```

**请求参数**:

- `clubId`: 社团ID (路径参数)
- `period`: 时间周期 (query, 可选: semester, year, 默认: semester)

**响应示例**:

```json
{
  "success": true,
  "data": {
    "memberCount": 128,
    "eventCount": 12,
    "recruitmentCount": 45,
    "avgActivityScore": 78,
    "trends": {
      "memberTrend": 12,
      "eventTrend": 8,
      "recruitmentTrend": -5,
      "activityTrend": 15
    }
  }
}
```

##### 2. 获取活动数据统计

```
GET /api/clubs/:clubId/stats/events
```

**请求参数**:

- `clubId`: 社团ID (路径参数)
- `period`: 时间周期 (query, 可选)
- `months`: 月份数 (query, 默认: 6)

**响应示例**:

```json
{
  "success": true,
  "data": {
    "participationTrend": [
      { "month": "2025-09", "count": 45 },
      { "month": "2025-10", "count": 62 }
    ],
    "categoryDistribution": [
      { "category": "学术", "count": 5 },
      { "category": "娱乐", "count": 4 }
    ],
    "participationRate": [
      { "eventId": 1, "eventName": "音乐节", "rate": 0.85 },
      { "eventId": 2, "eventName": "技术分享", "rate": 0.72 }
    ]
  }
}
```

##### 3. 获取成员数据统计

```
GET /api/clubs/:clubId/stats/members
```

**请求参数**:

- `clubId`: 社团ID (路径参数)
- `period`: 时间周期 (query, 可选)
- `months`: 月份数 (query, 默认: 6)

**响应示例**:

```json
{
  "success": true,
  "data": {
    "activityTrend": [
      { "month": "2025-09", "avgScore": 65 },
      { "month": "2025-10", "avgScore": 72 }
    ],
    "levelDistribution": [
      { "level": "青铜", "count": 32, "percentage": 25 },
      { "level": "白银", "count": 45, "percentage": 35 }
    ],
    "topMembers": [
      { "userId": 1, "nickname": "张三", "score": 95, "level": "钻石" }
    ]
  }
}
```

##### 4. 获取招新数据统计

```
GET /api/clubs/:clubId/stats/recruitments
```

**请求参数**:

- `clubId`: 社团ID (路径参数)
- `period`: 时间周期 (query, 可选)

**响应示例**:

```json
{
  "success": true,
  "data": {
    "funnel": {
      "views": 200,
      "applications": 120,
      "interviews": 80,
      "accepted": 45,
      "conversionRates": {
        "application": 0.6,
        "interview": 0.67,
        "accepted": 0.56
      }
    },
    "yearlyComparison": [
      { "year": 2024, "applications": 98, "accepted": 40 },
      { "year": 2025, "applications": 120, "accepted": 45 }
    ],
    "sourceDistribution": [
      { "recruitmentId": 1, "title": "春季招新", "count": 75 }
    ]
  }
}
```

##### 5. 管理员 - 获取全校数据概览

```
GET /api/admin/stats/overview
```

**请求参数**:

- `period`: 时间周期 (query, 可选)

**响应示例**:

```json
{
  "success": true,
  "data": {
    "clubCount": 46,
    "eventCount": 156,
    "applicationCount": 892,
    "userCount": 1245,
    "clubRankings": [
      { "clubId": 1, "clubName": "GTA摇滚研究部", "avgActivity": 92 }
    ],
    "categoryDistribution": [
      { "category": "艺术", "count": 16, "percentage": 35 }
    ]
  }
}
```

### 数据库查询优化

#### 新增索引

```sql
-- 优化活动参与统计查询
CREATE INDEX idx_event_participants_status 
ON event_participants(event_id, status);

-- 优化招新统计查询
CREATE INDEX idx_applications_status 
ON applications(recruitment_id, status);

-- 优化活跃度统计查询
CREATE INDEX idx_activity_stats_date 
ON user_activity_stats(stat_date, user_id);

-- 优化活动社团关联查询
CREATE INDEX idx_event_clubs_club 
ON event_clubs(club_id);
```

#### 查询示例

```javascript
/**
 * 获取社团成员活跃度分布
 * @param {number} clubId - 社团ID
 * @returns {Promise<Object>} 活跃度分布数据
 */
async function getMemberActivityDistribution(clubId) {
  const members = await knex('club_members')
    .where('club_id', clubId)
    .pluck('user_id');
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const stats = await knex('user_activity_stats')
    .whereIn('user_id', members)
    .where('stat_date', '>=', thirtyDaysAgo)
    .select(
      'user_id',
      knex.raw('AVG(activity_score) as avg_score')
    )
    .groupBy('user_id');
  
  const distribution = {
    bronze: 0,
    silver: 0,
    gold: 0,
    diamond: 0
  };
  
  stats.forEach(stat => {
    const score = Math.floor(stat.avg_score);
    if (score <= 30) distribution.bronze++;
    else if (score <= 60) distribution.silver++;
    else if (score <= 80) distribution.gold++;
    else distribution.diamond++;
  });
  
  return distribution;
}
```

***

## 📅 实施计划

### 阶段一: 后端 API 开发 (3-4天)

**任务列表**:

1. 创建 `backend/services/clubStatsService.js` 数据分析服务
2. 实现综合概览 API (`getClubOverview`)
3. 实现活动数据 API (`getClubEventStats`)
4. 实现成员数据 API (`getClubMemberStats`)
5. 实现招新数据 API (`getClubRecruitmentStats`)
6. 添加管理员统计 API (`getAdminOverview`)
7. 创建 `backend/routes/stats.js` 路由文件
8. 在 `backend/app.js` 中注册路由
9. 添加数据库索引优化查询性能
10. 编写 API 测试用例

**关键文件**:

- `backend/services/clubStatsService.js` (新建)
- `backend/routes/stats.js` (新建)
- `backend/app.js` (修改)

### 阶段二: 前端页面开发 (4-5天)

**任务列表**:

1. 集成 ECharts 图表库到小程序项目
2. 创建数据分析组件基础结构
3. 实现数据卡片展示功能
4. 实现活动数据图表（折线图、饼图、柱状图）
5. 实现成员数据图表（折线图、饼图、列表）
6. 实现招新数据图表（漏斗图、柱状图、饼图）
7. 添加时间筛选功能
8. 在社团管理页添加数据分析标签
9. 在管理员面板添加数据分析入口
10. UI 细节调整和样式优化

**关键文件**:

- `pages/edit/components/DataAnalysis/` (新建目录)
- `pages/edit/edit.wxml` (修改)
- `pages/edit/edit.js` (修改)

### 阶段三: 测试优化 (2-3天)

**任务列表**:

1. 功能测试（所有图表和数据展示）
2. 性能测试（大数据量情况）
3. 异常情况处理（无数据、网络错误等）
4. UI/UX 细节调整
5. 代码审查和优化
6. 文档更新

***

## ✅ 验收标准

### 功能验收

- [ ] 社团会长可以查看自己社团的数据分析面板
- [ ] 管理员可以查看全校社团的数据分析
- [ ] 所有图表正确展示数据
- [ ] 时间筛选功能正常工作
- [ ] 数据卡片显示趋势对比

### 性能验收

- [ ] API 响应时间 < 500ms
- [ ] 图表渲染流畅，无明显卡顿
- [ ] 支持至少100个成员的社团数据统计

### 用户体验验收

- [ ] 界面简洁美观，符合小程序设计规范
- [ ] 图表交互流畅，支持缩放和点击
- [ ] 无数据时显示友好的提示信息
- [ ] 加载状态展示清晰

***

## 🔮 未来扩展

### 第二阶段功能

1. **数据导出**: 支持 Excel、PDF 格式导出
2. **数据对比**: 不同学期、不同社团的数据对比
3. **自定义报表**: 用户自定义数据维度和图表类型
4. **数据预警**: 异常数据自动提醒

### 第三阶段功能

1. **AI 分析建议**: 基于数据提供运营建议
2. **预测分析**: 活动参与度预测、招新效果预测
3. **实时数据**: 实时更新的数据看板
4. **移动端优化**: 针对不同设备优化展示效果

***

## 📝 备注

### 技术债务

- 招新浏览量统计需要新增数据表字段
- 活动签到率需要完善签到功能
- 历史数据迁移需要考虑时间范围

### 风险评估

- **低风险**: 基于现有数据表结构，无需大规模数据库改造
- **中风险**: ECharts 集成可能需要调试兼容性问题
- **低风险**: 查询性能可通过索引优化解决

### 维护建议

- 定期清理过期的统计数据
- 监控 API 响应时间，及时优化慢查询
- 收集用户反馈，持续优化图表展示效果

