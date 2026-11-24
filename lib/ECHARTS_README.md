# ECharts 小程序版本集成说明

## 下载步骤

1. 访问 GitHub 仓库：https://github.com/ecomfe/echarts-for-weixin
2. 下载最新版本的 `ec-canvas` 目录
3. 将 `ec-canvas` 目录复制到本项目的 `lib/` 目录下

## 目录结构

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
├── qqmap-wx-jssdk.js
└── qqmap-wx-jssdk.min.js
```

## 验证

下载完成后，确保以下文件存在：
- `lib/ec-canvas/echarts.js`
- `lib/ec-canvas/ec-canvas/ec-canvas.js`

## 注意事项

- 请使用稳定版本的 ECharts，避免使用开发版本
- 小程序包大小限制为 2MB，建议使用 `echarts.min.js` 以减小体积
- 如需自定义图表组件，可参考 echarts-for-weixin 的官方文档
