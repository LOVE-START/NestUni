# NFUNest JMeter性能测试

## 测试环境要求

- Apache JMeter 5.6+
- Java 8+
- NFUNest后端服务运行中

## 测试计划说明

### 1. 社团列表查询性能测试
- 并发用户数：50
-  Ramp-up时间：10秒
- 循环次数：10
- 测试接口：POST /nfunest/api/clubs

### 2. 活动列表查询性能测试
- 并发用户数：30
- Ramp-up时间：5秒
- 循环次数：10
- 测试接口：POST /nfunest/api/events

### 3. 公告列表查询性能测试
- 并发用户数：20
- Ramp-up时间：5秒
- 循环次数：10
- 测试接口：GET /nfunest/api/announcements

## 执行测试

### GUI模式（调试）
```bash
jmeter -t nfunest-api-test-plan.jmx
```

### 命令行模式（正式测试）
```bash
jmeter -n -t nfunest-api-test-plan.jmx -l results.jtl -e -o report
```

### 分布式测试
```bash
jmeter -n -t nfunest-api-test-plan.jmx -r -l results.jtl
```

## 性能指标

| 指标 | 目标值 |
|------|--------|
| 平均响应时间 | < 500ms |
| 95%响应时间 | < 1000ms |
| 错误率 | < 1% |
| 吞吐量 | > 100 TPS |

## 测试结果分析

测试结果保存在 `results.jtl`，HTML报告生成在 `report/` 目录。
