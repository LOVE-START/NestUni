const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
        Header, Footer, PageNumber } = require('docx');
const fs = require('fs');

// 创建文档
const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" },
          size: 24
        }
      }
    },
    paragraphStyles: [
      { 
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" } },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0, keepNext: false, keepLines: false } 
      },
      { 
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" } },
        paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1, keepNext: false, keepLines: false } 
      },
      { 
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Microsoft YaHei" } },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: false, keepLines: false } 
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "NFUNest社团管理系统 - 软件测试计划", size: 20, color: "666666" })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "第 ", size: 20 }),
            new TextRun({ children: [PageNumber.CURRENT], size: 20 }),
            new TextRun({ text: " 页", size: 20 })
          ]
        })]
      })
    },
    children: [
      // 标题
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [new TextRun("NFUNest社团管理系统")]
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun("软件测试计划")]
      }),
      
      // 文档信息
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: "文档版本：V1.0", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "编制日期：2026年6月16日", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 400 },
        children: [new TextRun({ text: "编制人：测试团队", bold: true })]
      }),
      
      // 1. 引言
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("1. 引言")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("1.1 编写目的")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("本文档为NFUNest社团管理系统的软件测试计划，用于指导系统测试活动的开展，明确测试范围、测试策略、测试资源和测试进度安排，确保测试工作的系统性和完整性。")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("1.2 项目背景")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("NFUNest是一款面向高校的社团管理系统，采用微信小程序作为前端，Node.js + Express作为后端，MySQL作为数据库。系统包含社团管理、活动管理、招募管理、徽章系统、AI推荐等核心功能模块。")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("1.3 术语说明")]
      }),
      
      // 术语表
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2500, 6500],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "术语", bold: true })] })]
              }),
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "解释", bold: true })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("黑盒测试")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("不考虑程序内部结构，从用户角度验证功能是否符合需求")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("Selenium")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("Web自动化测试工具，用于模拟用户操作")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("JMeter")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("Apache开源性能测试工具")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("SQL注入")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("通过在输入中插入SQL语句，非法操作数据库的攻击方式")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("XSS")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("跨站脚本攻击，向网页注入恶意脚本")] })] })
            ]
          })
        ]
      }),
      
      new Paragraph({ spacing: { after: 300 }, children: [] }),
      
      // 2. 测试策略
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("2. 测试策略")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("2.1 整体测试策略")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("本次测试采用以下策略：")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("1. 采用黑盒测试方法，依据需求规格说明书设计测试用例")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("2. 使用Selenium进行Web端管理后台的自动化功能测试")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("3. 使用JMeter进行API接口性能测试")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("4. 使用Python脚本进行SQL注入和XSS安全测试")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("5. 采用手工测试完成微信小程序端的兼容性测试")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("2.2 测试类型")]
      }),
      
      // 测试类型表
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2000, 3500, 3500],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "测试类型", bold: true })] })]
              }),
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "测试内容", bold: true })] })]
              }),
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "测试工具", bold: true })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("功能测试")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("验证各功能模块是否符合需求")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("Selenium + 手工")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("性能测试")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("API接口并发性能")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("JMeter")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("安全测试")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("SQL注入、XSS、越权访问")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("Python脚本")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("接口测试")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("REST API接口正确性")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("Postman/JMeter")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("兼容性测试")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("微信小程序、浏览器兼容")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("手工")] })] })
            ]
          })
        ]
      }),
      
      new Paragraph({ spacing: { after: 300 }, children: [] }),
      
      // 3. 测试范围
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("3. 测试范围")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("3.1 测试范围说明")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("本次测试覆盖NFUNest系统的以下功能模块：")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("3.1.1 用户模块")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 微信登录/授权")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 用户信息管理")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 个人中心")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("3.1.2 社团模块")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 社团列表查看")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 社团搜索")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 社团详情查看")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 社团创建/编辑/删除（管理后台）")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("3.1.3 活动模块")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 活动列表查看")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 活动详情查看")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 活动报名/取消")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 活动创建/审核")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("3.1.4 招募模块")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 招募信息查看")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 入社申请提交")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 申请审核")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("3.1.5 公告模块")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 公告列表查看")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 公告详情查看")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 公告发布/审核")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("3.1.6 徽章模块")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 徽章展示")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 徽章获取")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("3.1.7 聊天模块")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 消息发送")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 消息接收")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 聊天记录")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("3.1.8 管理后台")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 管理员登录")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 数据统计")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 内容审核")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("3.2 不在测试范围内")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("以下功能不在本次测试范围内：")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- AI推荐算法准确性")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 微信支付功能")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 第三方地图服务")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("- 消息推送服务")]
      }),
      
      // 4. 测试环境
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("4. 测试环境")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("4.1 硬件环境")]
      }),
      
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2500, 6500],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "项目", bold: true })] })]
              }),
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "配置", bold: true })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("测试服务器")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("CPU: 4核, 内存: 8GB, 硬盘: 100GB")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("测试客户端")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("CPU: Intel i5, 内存: 16GB")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("移动设备")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("Android/iOS手机，用于小程序测试")] })] })
            ]
          })
        ]
      }),
      
      new Paragraph({ spacing: { after: 300 }, children: [] }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("4.2 软件环境")]
      }),
      
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2500, 6500],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "项目", bold: true })] })]
              }),
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "版本", bold: true })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("操作系统")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("Windows 11 / CentOS 7")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("Node.js")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("v18.x")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("MySQL")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("5.7+")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("微信开发者工具")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("最新稳定版")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("Chrome浏览器")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("120+")] })] })
            ]
          })
        ]
      }),
      
      new Paragraph({ spacing: { after: 300 }, children: [] }),
      
      // 5. 测试进度安排
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("5. 测试进度安排")]
      }),
      
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3500, 2000, 2000, 1500],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "工作内容", bold: true })] })]
              }),
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "开始时间", bold: true })] })]
              }),
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "结束时间", bold: true })] })]
              }),
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "工期", bold: true })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("测试计划编制")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-06-16")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-06-17")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2天")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("测试用例设计")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-06-18")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-06-20")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("3天")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("自动化测试脚本开发")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-06-21")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-06-25")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("5天")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("功能测试执行")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-06-26")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-07-05")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("10天")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("性能测试执行")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-07-06")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-07-08")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("3天")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("安全测试执行")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-07-09")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-07-11")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("3天")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("回归测试")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-07-12")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-07-14")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("3天")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("测试报告编制")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-07-15")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2026-07-16")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("2天")] })] })
            ]
          })
        ]
      }),
      
      new Paragraph({ spacing: { after: 300 }, children: [] }),
      
      // 6. 测试通过准则
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("6. 测试通过准则")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("6.1 功能测试通过准则")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 所有高优先级测试用例100%通过")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 中优先级测试用例通过率≥95%")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 无一级、二级缺陷遗留")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("- 三级缺陷遗留不超过5个")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("6.2 性能测试通过准则")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 平均响应时间<500ms")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 95%响应时间<1000ms")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 错误率<1%")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("- 吞吐量≥100 TPS")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("6.3 安全测试通过准则")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 无高危安全漏洞")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- 无SQL注入漏洞")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("- 无XSS跨站脚本漏洞")]
      }),
      
      // 7. 风险与应对措施
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("7. 风险与应对措施")]
      }),
      
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2500, 6500],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "风险", bold: true })] })]
              }),
              new TableCell({
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "应对措施", bold: true })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("测试环境不稳定")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("建立独立的测试环境，定期备份数据和配置")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("需求变更频繁")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("建立需求变更控制流程，评估变更对测试的影响")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("测试时间不足")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("优先级排序，先完成核心功能测试；必要时申请延期")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun("缺陷修复不及时")] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun("建立缺陷跟踪机制，每日同步修复进度")] })] })
            ]
          })
        ]
      }),
      
      new Paragraph({ spacing: { after: 300 }, children: [] }),
      
      // 8. 附录
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("8. 附录")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("8.1 测试工具清单")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("1. Selenium WebDriver 4.15+ - Web自动化测试")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("2. Apache JMeter 5.6+ - 性能测试")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("3. Python 3.9+ - 安全测试脚本")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("4. pytest 7.4+ - 测试框架")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("5. Postman - 接口测试")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("8.2 参考文档")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- NFUNest需求规格说明书")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- NFUNest概要设计说明书")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- NFUNest数据库设计文档")]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun("- NFUNest接口文档")]
      })
    ]
  }]
});

// 保存文档
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('NFUNest软件测试计划.docx', buffer);
  console.log('测试计划文档已生成: NFUNest软件测试计划.docx');
});
