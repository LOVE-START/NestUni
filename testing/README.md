# NFUNest社团管理系统 - 完整测试方案

## 项目概述

本项目为NFUNest社团管理系统提供完整的软件测试方案，包括功能测试、性能测试、安全测试和兼容性测试。

## 测试架构

```
testing/
├── selenium-tests/          # Selenium自动化测试
│   ├── pages/              # 页面对象模型
│   │   ├── base_page.py    # 基础页面类
│   │   ├── login_page.py   # 登录页面
│   │   └── club_page.py    # 社团管理页面
│   ├── tests/              # 测试用例
│   │   ├── test_login.py   # 登录测试
│   │   └── test_club.py    # 社团管理测试
│   ├── config.py           # 测试配置
│   ├── conftest.py         # Pytest配置
│   ├── requirements.txt    # 依赖包
│   └── run_tests.py        # 测试执行脚本
│
├── jmeter-tests/           # JMeter性能测试
│   ├── nfunest-api-test-plan.jmx  # JMeter测试计划
│   └── README.md           # 使用说明
│
├── security-tests/         # 安全测试
│   ├── sql_injection_test.py      # SQL注入测试
│   └── xss_test.py               # XSS测试
│
├── test-cases/             # 测试用例
│   └── NFUNest测试用例.xlsx       # 完整测试用例集
│
├── test-plan/              # 测试计划文档
│   └── NFUNest软件测试计划.docx   # 测试计划文档
│
└── reports/                # 测试报告输出目录
```

## 快速开始

### 1. 环境准备

确保已安装以下软件：
- Python 3.9+
- Node.js 18+
- MySQL 5.7+
- Chrome/Firefox/Edge浏览器
- Apache JMeter 5.6+ (可选，用于性能测试)

### 2. 安装依赖

#### Selenium测试依赖
```bash
cd selenium-tests
pip install -r requirements.txt
```

#### 测试计划文档生成依赖
```bash
cd test-plan
npm install
```

### 3. 配置测试环境

编辑 `selenium-tests/config.py` 或设置环境变量：

```bash
# Windows PowerShell
$env:NFU_BASE_URL = "http://localhost:3001"
$env:NFU_ADMIN_USER = "lmy"
$env:NFU_ADMIN_PASS = "lmy111"
$env:NFU_BROWSER = "chrome"

# 或者创建 .env 文件
```

### 4. 执行测试

#### 运行Selenium自动化测试
```bash
cd selenium-tests

# 运行所有测试
pytest tests/ -v

# 生成HTML报告
pytest tests/ -v --html=reports/report.html --self-contained-html

# 运行特定测试
pytest tests/test_login.py -v

# 使用脚本运行
python run_tests.py --browser chrome --parallel 2
```

#### 运行JMeter性能测试
```bash
cd jmeter-tests

# GUI模式（调试）
jmeter -t nfunest-api-test-plan.jmx

# 命令行模式（正式测试）
jmeter -n -t nfunest-api-test-plan.jmx -l results.jtl -e -o report
```

#### 运行安全测试
```bash
cd security-tests

# SQL注入测试
python sql_injection_test.py --url http://localhost:3001

# XSS测试
python xss_test.py --url http://localhost:3001
```

## 测试覆盖范围

### 功能测试
- [x] 用户登录/授权
- [x] 社团管理（增删改查）
- [x] 活动管理
- [x] 招募管理
- [x] 公告管理
- [x] 徽章系统
- [x] 聊天功能
- [x] 管理后台

### 性能测试
- [x] 社团列表查询（50并发）
- [x] 活动列表查询（30并发）
- [x] 公告列表查询（20并发）

### 安全测试
- [x] SQL注入防护测试
- [x] XSS跨站脚本防护测试
- [x] 越权访问测试

### 兼容性测试
- [x] 微信小程序兼容性
- [x] 浏览器兼容性（Chrome/Firefox/Edge）

## 测试用例统计

| 模块 | 用例数量 | 优先级 |
|------|----------|--------|
| 登录模块 | 2 | 高 |
| 社团模块 | 4 | 高 |
| 活动模块 | 4 | 高 |
| 招募模块 | 2 | 高 |
| 公告模块 | 3 | 中 |
| 徽章模块 | 2 | 中 |
| 聊天模块 | 2 | 中 |
| 管理后台 | 3 | 高 |
| 性能测试 | 2 | 高 |
| 安全测试 | 3 | 高 |
| 接口测试 | 3 | 高 |
| 兼容性测试 | 2 | 中 |
| **总计** | **32** | - |

## 性能指标

| 指标 | 目标值 |
|------|--------|
| 平均响应时间 | < 500ms |
| 95%响应时间 | < 1000ms |
| 错误率 | < 1% |
| 吞吐量 | > 100 TPS |

## 项目技术栈

- **前端**: 微信小程序
- **后端**: Node.js + Express
- **数据库**: MySQL
- **测试工具**: 
  - Selenium WebDriver (自动化测试)
  - pytest (测试框架)
  - JMeter (性能测试)
  - Python requests (安全测试)

## 注意事项

1. 执行测试前请确保NFUNest后端服务已启动
2. 测试数据会自动创建，测试完成后建议清理
3. 性能测试请在独立测试环境执行，避免影响生产环境
4. 安全测试仅用于授权测试，请勿用于非法用途

## 贡献

如需添加新的测试用例或改进测试方案，请遵循以下规范：
1. 遵循Page Object模式编写Selenium测试
2. 测试用例需包含清晰的注释和断言
3. 提交前确保所有测试通过

## 许可证

本项目测试代码仅供学习和参考使用。
