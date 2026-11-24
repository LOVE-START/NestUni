# AI推荐卡片展示功能设计文档

**日期：** 2026-04-08\
**作者：** Zero\
**状态：** 已批准

***

## 一、背景与目标

### 1.1 当前问题

AI聊天功能在推荐活动、社团等信息时，仅以纯文字形式展示，用户体验不够直观：

- 用户需要手动搜索提到的活动/社团
- 文字描述不够生动，缺乏视觉吸引力
- 无法快速查看详情或进行操作

### 1.2 目标

将AI推荐的信息从纯文字改为使用前端已有的卡片样式展示，提供：

- 直观的视觉展示
- 一键点击查看详情
- 类似"Qwen点外卖"的智能便捷体验

***

## 二、技术方案

### 2.1 整体架构

```
用户提问 → AI意图识别 → 检索数据 → AI生成回复 + 提取推荐ID
                                    ↓
前端接收 ← API返回 ← 后端返回结构化数据 {reply, recommendations}
    ↓
渲染文字 + 卡片列表
```

### 2.2 数据流设计

#### 后端返回结构

**改造前：**

```javascript
{
  reply: "我推荐你参加...",
  intent: "event_recommend",
  sessionId: 123
}
```

**改造后：**

```javascript
{
  reply: "我推荐你参加...",
  intent: "event_recommend",
  sessionId: 123,
  recommendations: {
    type: 'events', // 或 'clubs' 或 'recruitments'
    ids: [1, 2, 3], // 推荐的活动/社团ID列表
    reason: '根据你的兴趣推荐' // 推荐理由（可选）
  }
}
```

#### 前端消息结构

**改造前：**

```javascript
{
  id: 'msg_123',
  role: 'assistant',
  content: '我推荐你参加...',
  time: '10:30'
}
```

**改造后：**

```javascript
{
  id: 'msg_123',
  role: 'assistant',
  content: '我推荐你参加...',
  time: '10:30',
  recommendations: {
    type: 'events',
    ids: [1, 2, 3],
    items: [] // 存储完整的活动/社团数据
  }
}
```

***

## 三、实现细节

### 3.1 后端改造

#### 3.1.1 AI服务改造（backend/services/aiService.js）

**修改** **`handleChatMessage`** **函数：**

```javascript
async function handleChatMessage(userId, sessionId, message, options = {}) {
  const intent = detectIntent(message);
  const contextData = await retrieveContext(intent, userId, message, options);
  const userProfile = await getUserProfile(userId);
  const contextMessage = buildContextMessage(intent, contextData, userProfile, message);
  
  const historyMessages = await getSessionHistory(sessionId);
  
  const messages = [
    { role: 'system', content: aiConfig.systemPrompt },
    { role: 'system', content: contextMessage },
    ...historyMessages,
    { role: 'user', content: message }
  ];
  
  const aiReply = await callQwenAPI(messages);
  
  // [MODIFY] 提取推荐ID列表
  const recommendations = extractRecommendations(intent, contextData);
  
  // 使用事务确保数据一致性
  await db.transaction(async (trx) => {
    await trx('chat_messages').insert([
      {
        session_id: sessionId,
        role: 'user',
        content: message,
        metadata: JSON.stringify({ intent })
      },
      {
        session_id: sessionId,
        role: 'assistant',
        content: aiReply,
        metadata: JSON.stringify({ intent, contextUsed: true, recommendations })
      }
    ]);
    
    const updateData = { updated_at: db.fn.now() };
    if (historyMessages.length === 0) {
      updateData.title = message.length > 20 ? message.substring(0, 20) + '...' : message;
    }
    
    await trx('chat_sessions')
      .where({ id: sessionId })
      .update(updateData);
  });
  
  return {
    reply: aiReply,
    intent,
    sessionId,
    recommendations // [MODIFY] 返回推荐数据
  };
}

/**
 * 从上下文数据中提取推荐ID列表
 * @param {string} intent - 意图类型
 * @param {Object} contextData - 上下文数据
 * @returns {Object|null} 推荐数据
 */
function extractRecommendations(intent, contextData) {
  switch (intent) {
    case 'club_recommend':
      if (contextData.clubs && contextData.clubs.length > 0) {
        return {
          type: 'clubs',
          ids: contextData.clubs.slice(0, 5).map(c => c.id),
          reason: '根据你的兴趣推荐'
        };
      }
      break;
      
    case 'event_recommend':
      if (contextData.events && contextData.events.length > 0) {
        return {
          type: 'events',
          ids: contextData.events.slice(0, 5).map(e => e.id),
          reason: '近期热门活动'
        };
      }
      break;
      
    case 'nearby_event':
      if (contextData.nearbyEvents && contextData.nearbyEvents.length > 0) {
        return {
          type: 'events',
          ids: contextData.nearbyEvents.slice(0, 5).map(e => e.id),
          reason: '离你最近的活动'
        };
      }
      break;
      
    case 'recruitment_info':
      if (contextData.recruitments && contextData.recruitments.length > 0) {
        return {
          type: 'recruitments',
          ids: contextData.recruitments.slice(0, 5).map(r => r.id),
          reason: '正在招新'
        };
      }
      break;
      
    case 'club_info':
      if (contextData.clubs && contextData.clubs.length > 0) {
        return {
          type: 'clubs',
          ids: contextData.clubs.slice(0, 3).map(c => c.id),
          reason: '相关社团信息'
        };
      }
      break;
  }
  
  return null;
}
```

#### 3.1.2 新增批量查询API（backend/routes/events.js）

```javascript
/**
 * 批量获取活动详情
 * @route GET /api/events/by-ids
 */
router.get('/by-ids', async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({ success: false, error: '缺少活动ID列表' });
    }
    
    const idList = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (idList.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const events = await db('events')
      .select(
        'id', 'title', 'date', 'time', 'location', 'category', 'status',
        'cover_image', 'description', 'organizer', 'max_participants',
        'current_participants', 'registration_deadline'
      )
      .whereIn('id', idList)
      .where({ status: 'published' });
    
    // 批量查询关联社团
    const eventIds = events.map(e => e.id);
    const eventClubs = await db('clubs')
      .select('clubs.id', 'clubs.name', 'clubs.logo', 'event_clubs.event_id')
      .join('event_clubs', 'clubs.id', 'event_clubs.club_id')
      .whereIn('event_clubs.event_id', eventIds);
    
    // 构建活动-社团映射
    const eventClubsMap = {};
    eventClubs.forEach(ec => {
      if (!eventClubsMap[ec.event_id]) eventClubsMap[ec.event_id] = [];
      eventClubsMap[ec.event_id].push({
        id: ec.id,
        name: ec.name,
        logo: ec.logo
      });
    });
    
    // 组装数据
    const processedEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
      category: event.category,
      status: event.status,
      coverImage: event.cover_image,
      description: event.description,
      organizer: event.organizer,
      maxParticipants: event.max_participants,
      currentParticipants: event.current_participants,
      registrationDeadline: event.registration_deadline,
      relatedClubs: eventClubsMap[event.id] || []
    }));
    
    res.json({ success: true, data: processedEvents });
  } catch (error) {
    logger.error('批量获取活动失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});
```

#### 3.1.3 新增批量查询API（backend/routes/clubs.js）

```javascript
/**
 * 批量获取社团详情
 * @route GET /api/clubs/by-ids
 */
router.get('/by-ids', async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({ success: false, error: '缺少社团ID列表' });
    }
    
    const idList = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (idList.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const clubs = await db('clubs')
      .select('id', 'name', 'short_intro', 'category', 'level', 'logo', 'cover_image')
      .whereIn('id', idList);
    
    // 批量查询成员数
    const memberCounts = await db('club_members')
      .select('club_id')
      .count('* as count')
      .whereIn('club_id', idList)
      .where({ status: 'active' })
      .groupBy('club_id');
    
    const memberCountMap = {};
    memberCounts.forEach(m => {
      memberCountMap[m.club_id] = m.count;
    });
    
    // 组装数据
    const processedClubs = clubs.map(club => ({
      id: club.id,
      name: club.name,
      shortIntro: club.short_intro,
      category: club.category,
      level: club.level,
      logo: club.logo,
      coverImage: club.cover_image,
      memberCount: memberCountMap[club.id] || 0
    }));
    
    res.json({ success: true, data: processedClubs });
  } catch (error) {
    logger.error('批量获取社团失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});
```

### 3.2 前端改造

#### 3.2.1 新增API方法（utils/api/chat.js）

```javascript
/**
 * 批量获取活动详情
 * @param {number[]} ids - 活动ID列表
 * @returns {Promise<Object>} 活动列表
 */
async function fetchEventsByIds(ids) {
  if (!ids || ids.length === 0) {
    return { success: true, data: [] };
  }
  return await request(`/events/by-ids?ids=${ids.join(',')}`);
}

/**
 * 批量获取社团详情
 * @param {number[]} ids - 社团ID列表
 * @returns {Promise<Object>} 社团列表
 */
async function fetchClubsByIds(ids) {
  if (!ids || ids.length === 0) {
    return { success: true, data: [] };
  }
  return await request(`/clubs/by-ids?ids=${ids.join(',')}`);
}

module.exports = {
  // ... 现有导出
  fetchEventsByIds,
  fetchClubsByIds
};
```

#### 3.2.2 修改聊天页面逻辑（pages/chat/chat.js）

```javascript
/**
 * 发送消息
 */
async sendMessage() {
  // ... 现有代码 ...
  
  try {
    const locationOptions = await this.getUserLocation();
    const result = await api.sendChatMessage(sessionId, content, locationOptions);
    
    if (result.success) {
      const aiMessageId = `msg_${Date.now() + 2}`;
      const aiMessage = {
        id: aiMessageId,
        role: 'assistant',
        content: result.data.reply,
        isLoading: false,
        time: this.formatTime(new Date().toISOString()),
        recommendations: result.data.recommendations // [MODIFY] 存储推荐数据
      };
      
      // 替换loading消息为实际回复
      const newMessages = [...this.data.messages];
      newMessages[newMessages.length - 1] = aiMessage;
      
      this.setData({
        messages: newMessages,
        isLoading: false,
        scrollToId: aiMessageId
      });
      
      // [MODIFY] 如果有推荐数据，加载推荐项详情
      if (result.data.recommendations && result.data.recommendations.ids.length > 0) {
        this.loadRecommendationItems(aiMessageId, result.data.recommendations);
      }
      
      // 保存当前会话ID
      this.saveLastSessionId(sessionId);
    } else {
      throw new Error(result.error || '发送失败');
    }
  } catch (error) {
    // ... 错误处理 ...
  }
}

/**
 * 加载推荐项详情
 * @param {string} messageId - 消息ID
 * @param {Object} recommendations - 推荐数据
 */
async loadRecommendationItems(messageId, recommendations) {
  try {
    let items = [];
    
    if (recommendations.type === 'events') {
      const result = await api.fetchEventsByIds(recommendations.ids);
      if (result.success) {
        items = result.data;
      }
    } else if (recommendations.type === 'clubs') {
      const result = await api.fetchClubsByIds(recommendations.ids);
      if (result.success) {
        items = result.data;
      }
    } else if (recommendations.type === 'recruitments') {
      // 招新信息暂时不处理，后续扩展
    }
    
    // 更新消息中的推荐项数据
    const messages = this.data.messages.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          recommendations: {
            ...msg.recommendations,
            items
          }
        };
      }
      return msg;
    });
    
    this.setData({ messages });
  } catch (error) {
    console.error('加载推荐项失败:', error);
  }
}

/**
 * 查看活动详情
 * @param {Object} e - 事件对象
 */
goToEvent(e) {
  const { id } = e.currentTarget.dataset;
  wx.navigateTo({
    url: `/pages/activitiesDetail/activitiesDetail?id=${id}`
  });
}

/**
 * 查看社团详情
 * @param {Object} e - 事件对象
 */
goToClub(e) {
  const { id } = e.currentTarget.dataset;
  wx.navigateTo({
    url: `/pages/clubDetail/clubDetail?id=${id}`
  });
}
```

#### 3.2.3 修改聊天页面UI（pages/chat/chat.wxml）

```xml
<!-- AI消息 -->
<view class="message-row message-row--assistant" wx:elif="{{item.role === 'assistant'}}" id="{{item.id}}">
  <view class="message-avatar message-avatar--assistant">
    <image class="avatar-image" src="https://api.example.com/uploads/nest/general/aiavatar.png" mode="aspectFill"></image>
  </view>
  <view class="message-content">
    <view class="message-bubble message-bubble--assistant {{item.isError ? 'message-bubble--error' : ''}}">
      <!-- 加载状态 -->
      <view class="loading-dots" wx:if="{{item.isLoading}}">
        <view class="dot"></view>
        <view class="dot"></view>
        <view class="dot"></view>
      </view>
      <text class="message-text" wx:else>{{item.content}}</text>
    </view>
    
    <!-- [MODIFY] 推荐卡片列表 -->
    <view class="recommendation-cards" wx:if="{{item.recommendations && item.recommendations.items.length > 0}}">
      <!-- 活动卡片 -->
      <block wx:if="{{item.recommendations.type === 'events'}}">
        <view 
          class="recommendation-card event-card"
          wx:for="{{item.recommendations.items}}"
          wx:key="id"
          wx:for-item="event"
          data-id="{{event.id}}"
          bindtap="goToEvent"
        >
          <image class="card-cover" src="{{event.coverImage}}" mode="aspectFill"></image>
          <view class="card-info">
            <view class="card-title">{{event.title}}</view>
            <view class="card-meta">
              <text class="meta-item">📅 {{event.date}} {{event.time}}</text>
              <text class="meta-item">📍 {{event.location}}</text>
            </view>
            <view class="card-category" style="--decoration-bg: {{theme.gradient}}; background-image: var(--decoration-bg)">
              {{event.category}}
            </view>
          </view>
        </view>
      </block>
      
      <!-- 社团卡片 -->
      <block wx:if="{{item.recommendations.type === 'clubs'}}">
        <view 
          class="recommendation-card club-card"
          wx:for="{{item.recommendations.items}}"
          wx:key="id"
          wx:for-item="club"
          data-id="{{club.id}}"
          bindtap="goToClub"
        >
          <image class="club-logo" src="{{club.logo}}" mode="aspectFill"></image>
          <view class="club-info">
            <view class="club-name">{{club.name}}</view>
            <view class="club-desc">{{club.shortIntro}}</view>
            <view class="club-meta">
              <text class="meta-tag">{{club.level}}</text>
              <text class="meta-tag">{{club.category}}</text>
              <text class="meta-tag">{{club.memberCount}}人</text>
            </view>
          </view>
        </view>
      </block>
    </view>
  </view>
</view>
```

#### 3.2.4 添加样式（pages/chat/chat.wxss）

```css
/* 推荐卡片容器 */
.recommendation-cards {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

/* 推荐卡片基础样式 */
.recommendation-card {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
  transition: transform 0.2s;
}

.recommendation-card:active {
  transform: scale(0.98);
}

/* 活动卡片样式 */
.event-card {
  display: flex;
  flex-direction: column;
}

.event-card .card-cover {
  width: 100%;
  height: 240rpx;
  background: #f5f5f5;
}

.event-card .card-info {
  padding: 20rpx;
}

.event-card .card-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-card .card-meta {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 12rpx;
}

.event-card .meta-item {
  font-size: 24rpx;
  color: #666;
}

.event-card .card-category {
  display: inline-block;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #fff;
}

/* 社团卡片样式 */
.club-card {
  display: flex;
  padding: 20rpx;
  gap: 20rpx;
}

.club-card .club-logo {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  background: #f5f5f5;
}

.club-card .club-info {
  flex: 1;
  min-width: 0;
}

.club-card .club-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-card .club-desc {
  font-size: 24rpx;
  color: #666;
  margin-bottom: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.club-card .club-meta {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.club-card .meta-tag {
  padding: 4rpx 12rpx;
  background: #f0f0f0;
  border-radius: 12rpx;
  font-size: 22rpx;
  color: #666;
}
```

***

## 四、测试计划

### 4.1 后端测试

1. **意图识别测试**
   - 测试各种意图的识别准确率
   - 验证推荐ID提取逻辑
2. **API测试**
   - 测试批量查询接口
   - 验证数据格式正确性
   - 测试边界情况（空ID列表、无效ID等）

### 4.2 前端测试

1. **消息渲染测试**
   - 测试带推荐的消息显示
   - 测试不带推荐的消息显示
   - 测试加载状态
2. **卡片交互测试**
   - 测试卡片点击跳转
   - 测试数据加载失败情况
   - 测试网络异常情况

### 4.3 集成测试

1. **端到端测试**
   - 测试完整的用户交互流程
   - 验证数据流完整性
2. **性能测试**
   - 测试批量查询性能
   - 测试大量推荐项的渲染性能

***

## 五、实施计划

### 5.1 开发顺序

1. **后端改造**（优先级：P0）
   - 修改AI服务返回推荐ID
   - 新增批量查询API接口
2. **前端改造**（优先级：P0）
   - 新增批量查询API方法
   - 修改消息数据结构
   - 实现卡片渲染逻辑
3. **UI优化**（优先级：P1）
   - 完善卡片样式
   - 添加加载动画
   - 优化交互体验

### 5.2 时间估算

- 后端改造：2小时
- 前端改造：3小时
- 测试验证：1小时
- **总计：6小时**

***

## 六、风险与应对

### 6.1 技术风险

| 风险        | 影响      | 应对措施            |
| --------- | ------- | --------------- |
| AI意图识别不准确 | 推荐内容不相关 | 优化意图识别算法，增加人工审核 |
| 批量查询性能问题  | 页面加载慢   | 添加缓存机制，限制推荐数量   |
| 前端渲染性能问题  | 卡顿      | 使用虚拟列表，懒加载图片    |

### 6.2 用户体验风险

| 风险      | 影响   | 应对措施           |
| ------- | ---- | -------------- |
| 推荐内容过多  | 信息过载 | 限制推荐数量（最多5个）   |
| 卡片样式不统一 | 视觉混乱 | 复用现有卡片样式，保持一致性 |
| 加载失败    | 用户困惑 | 添加友好的错误提示      |

***

## 七、未来扩展

### 7.1 短期优化（P1）

1. **快速操作按钮**
   - 在卡片上添加"立即报名"/"加入社团"按钮
   - 实现快速操作功能
2. **推荐理由展示**
   - 在卡片上方显示推荐理由
   - 提升推荐透明度
3. **数据缓存**
   - 缓存已加载的推荐数据
   - 减少重复请求

### 7.2 长期规划（P2）

1. **个性化推荐算法**
   - 基于用户行为数据优化推荐
   - 提升推荐准确率
2. **多类型混合推荐**
   - 同时推荐活动、社团、招新信息
   - 提供更全面的推荐
3. **推荐反馈机制**
   - 允许用户对推荐进行评价
   - 持续优化推荐质量

***

## 八、总结

本设计方案通过后端返回结构化推荐数据，前端渲染卡片列表的方式，实现了AI推荐的直观展示。方案具有以下优势：

1. **准确性高**：AI明确知道推荐内容，避免匹配错误
2. **性能优**：批量查询减少API调用次数
3. **扩展性强**：易于添加新的推荐类型和功能
4. **用户体验好**：直观的卡片展示，便捷的交互操作

该方案符合项目架构原则，职责分离清晰，易于维护和扩展。
