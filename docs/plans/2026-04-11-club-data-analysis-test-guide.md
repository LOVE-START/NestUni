# 社团数据分析功能 - 测试指南

## 📋 测试清单

### 1. 后端 API 测试

#### 1.1 启动后端服务

```bash
cd backend
npm start
```

#### 1.2 测试 API 接口

**测试综合概览 API**
```bash
curl -X GET "http://localhost:3001/nfunest/api/clubs/1/stats/overview?period=semester" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期响应：**
```json
{
  "success": true,
  "data": {
    "memberCount": 10,
    "eventCount": 5,
    "recruitmentCount": 3,
    "avgActivityScore": 45,
    "trends": {
      "memberTrend": 20,
      "eventTrend": -10,
      "recruitmentTrend": 50,
      "activityTrend": 0
    }
  }
}
```

**测试活动数据 API**
```bash
curl -X GET "http://localhost:3001/nfunest/api/clubs/1/stats/events?period=semester&months=6" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**测试成员数据 API**
```bash
curl -X GET "http://localhost:3001/nfunest/api/clubs/1/stats/members?period=semester" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**测试招新数据 API**
```bash
curl -X GET "http://localhost:3001/nfunest/api/clubs/1/stats/recruitments?period=semester" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**测试管理员 API**
```bash
curl -X GET "http://localhost:3001/nfunest/api/admin/stats/overview?period=semester" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 2. 数据库索引优化

执行索引创建脚本：

```bash
mysql -u username -p database_name < backend/migrations/add_stats_indexes.sql
```

或在数据库管理工具中执行 `backend/migrations/add_stats_indexes.sql` 文件内容。

### 3. 前端功能测试

#### 3.1 编译小程序

1. 打开微信开发者工具
2. 导入项目
3. 点击"编译"按钮

#### 3.2 测试数据分析页面

1. **登录测试**
   - 使用社团会长账号登录
   - 确保登录状态正常

2. **进入数据分析页面**
   - 打开社团管理页
   - 点击"数据分析"标签
   - 检查页面是否正常加载

3. **测试数据概览**
   - 检查成员数、活动数、招新数、活跃度是否正确显示
   - 检查趋势箭头和百分比是否正确

4. **测试图表渲染**
   - 检查活动参与趋势折线图是否正常显示
   - 检查成员等级分布饼图是否正常显示
   - 检查招新转化漏斗图是否正常显示

5. **测试时间筛选**
   - 切换时间周期（本学期/本学年）
   - 检查数据是否重新加载
   - 检查图表是否更新

6. **测试异常情况**
   - 测试无数据情况（使用新创建的社团）
   - 测试网络错误情况（关闭后端服务）
   - 测试权限不足情况（使用普通成员账号）

### 4. 性能测试

#### 4.1 API 响应时间测试

使用 Postman 或 curl 测试 API 响应时间：

```bash
# 测试概览 API
curl -w "Time: %{time_total}s\n" -X GET "http://localhost:3001/nfunest/api/clubs/1/stats/overview" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期响应时间：** < 500ms

#### 4.2 数据库查询性能

检查慢查询日志，确保所有统计查询都在合理时间内完成。

### 5. 兼容性测试

- [ ] iOS 设备测试
- [ ] Android 设备测试
- [ ] 不同屏幕尺寸测试
- [ ] 深色模式测试

## 🐛 常见问题排查

### 问题 1: 图表不显示

**可能原因：**
- ECharts 库未正确下载
- 组件路径配置错误

**解决方案：**
1. 检查 `lib/ec-canvas` 目录是否存在
2. 检查 `pages/edit/components/DataAnalysis/index.json` 中的组件路径

### 问题 2: API 返回 401 错误

**可能原因：**
- Token 过期或无效
- 用户不是社团会长

**解决方案：**
1. 重新登录获取新 Token
2. 确认用户具有社团会长权限

### 问题 3: 数据为空

**可能原因：**
- 数据库中没有相关数据
- 时间范围选择不当

**解决方案：**
1. 检查数据库中是否有测试数据
2. 尝试切换时间周期

## ✅ 测试通过标准

- [ ] 所有 API 接口返回正确数据
- [ ] 图表正常渲染
- [ ] 时间筛选功能正常
- [ ] 无 JavaScript 错误
- [ ] API 响应时间 < 500ms
- [ ] 在 iOS 和 Android 设备上均正常显示
