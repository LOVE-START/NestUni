# 社团数据分析功能 - 部署指南

## 📦 部署步骤

### 1. 后端部署

#### 1.1 数据库迁移

执行数据库索引优化脚本：

```bash
# 方式一：使用 MySQL 命令行
mysql -u username -p nfunest < backend/migrations/add_stats_indexes.sql

# 方式二：在数据库管理工具中执行
# 打开 backend/migrations/add_stats_indexes.sql
# 复制内容并在数据库管理工具中执行
```

#### 1.2 验证后端代码

```bash
cd backend

# 检查语法错误
node -c services/clubStatsService.js
node -c routes/stats.js

# 启动服务（开发环境）
npm start

# 或使用 PM2（生产环境）
pm2 restart nfunest-backend
```

#### 1.3 验证 API 可用性

使用 curl 或 Postman 测试 API：

```bash
# 健康检查
curl http://your-domain:3001/nfunest/api/health

# 测试统计 API（需要 Token）
curl -X GET "http://your-domain:3001/nfunest/api/clubs/1/stats/overview" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. 前端部署

#### 2.1 下载 ECharts 库

1. 访问 GitHub 仓库：https://github.com/ecomfe/echarts-for-weixin
2. 下载最新版本的 `ec-canvas` 目录
3. 将 `ec-canvas` 目录复制到项目的 `lib/` 目录下

**验证文件结构：**
```
lib/
├── ec-canvas/
│   ├── echarts.js
│   ├── echarts.min.js
│   └── ec-canvas/
│       ├── ec-canvas.js
│       ├── ec-canvas.json
│       ├── ec-canvas.wxml
│       └── ec-canvas.wxss
```

#### 2.2 编译小程序

1. 打开微信开发者工具
2. 导入项目
3. 点击"编译"按钮
4. 检查控制台是否有错误

#### 2.3 上传代码

1. 在微信开发者工具中点击"上传"
2. 填写版本号和项目备注
3. 提交审核

#### 2.4 提交审核

1. 登录微信公众平台
2. 进入"版本管理"
3. 选择刚上传的版本
4. 填写审核信息
5. 提交审核

#### 2.5 发布

审核通过后：
1. 登录微信公众平台
2. 进入"版本管理"
3. 点击"发布"
4. 选择发布比例（建议先小范围发布）

### 3. 监控配置

#### 3.1 后端监控

**监控指标：**
- API 响应时间
- 数据库查询性能
- 错误日志

**日志位置：**
- `backend/logs/combined.log` - 所有日志
- `backend/logs/error.log` - 错误日志

**监控命令：**
```bash
# 查看实时日志
tail -f backend/logs/combined.log

# 查看错误日志
tail -f backend/logs/error.log

# 搜索特定错误
grep "社团统计" backend/logs/combined.log
```

#### 3.2 前端监控

使用微信小程序后台的"运维中心"监控：
- 页面访问量
- 错误日志
- 性能指标

### 4. 回滚计划

如果出现问题，可以快速回滚：

#### 4.1 后端回滚

```bash
# 使用 Git 回滚
cd backend
git log --oneline  # 查看提交历史
git revert <commit-hash>  # 回滚到指定版本

# 重启服务
pm2 restart nfunest-backend
```

#### 4.2 前端回滚

1. 登录微信公众平台
2. 进入"版本管理"
3. 选择上一个稳定版本
4. 点击"发布"覆盖当前版本

### 5. 数据备份

在部署前，建议备份数据库：

```bash
# 备份数据库
mysqldump -u username -p nfunest > backup_$(date +%Y%m%d).sql

# 恢复数据库（如果需要）
mysql -u username -p nfunest < backup_20260411.sql
```

## 🔧 配置项

### 环境变量

确保后端 `.env` 文件包含以下配置：

```env
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=nfunest

# JWT 配置
JWT_SECRET=your_secret
JWT_EXPIRES_IN=7d

# 服务配置
PORT=3001
API_PREFIX=/nfunest/api
```

### 小程序配置

确保 `project.config.json` 包含正确的配置：

```json
{
  "miniprogramRoot": "./",
  "compileType": "miniprogram",
  "setting": {
    "es6": true,
    "postcss": true,
    "minified": true
  }
}
```

## 📊 性能优化建议

### 1. 数据库优化

- 定期执行 `ANALYZE TABLE` 更新统计信息
- 监控慢查询日志
- 考虑使用 Redis 缓存统计结果

### 2. API 优化

- 实现请求缓存
- 使用分页查询
- 优化数据库查询语句

### 3. 前端优化

- 使用小程序分包加载
- 优化图片资源
- 减少不必要的 setData 调用

## 📞 联系方式

如有问题，请联系：
- 后端开发：[后端负责人]
- 前端开发：[前端负责人]
- 运维支持：[运维负责人]
