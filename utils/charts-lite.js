/**
 * ECharts 精简版配置
 * @description 仅包含项目需要的图表组件，大幅减少体积
 * 
 * 包含的图表类型：
 * - 折线图 (Line Chart)
 * - 饼图 (Pie Chart)  
 * - 柱状图 (Bar Chart)
 * 
 * 包含的组件：
 * - Tooltip (提示框)
 * - Legend (图例)
 * - Grid (网格)
 */

import * as echarts from '../lib/ec-canvas/echarts';

/**
 * 创建精简版 ECharts 实例
 * @description 只加载必要的组件
 */
function createECharts(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr
  });
  canvas.setChart(chart);
  return chart;
}

/**
 * 设计系统配色方案
 */
const COLORS = {
  primary: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'],
  success: ['#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7'],
  warning: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'],
  error: ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'],
  secondary: ['#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff', '#f3e8ff'],
  gray: ['#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6']
};

/**
 * 现代化图表主题配色
 */
const CHART_COLORS = {
  palette: [
    '#3b82f6',
    '#22c55e',
    '#f97316',
    '#a855f7',
    '#ef4444',
    '#06b6d4',
    '#8b5cf6',
    '#ec4899'
  ],
  gradient: {
    primary: ['#3b82f6', '#60a5fa'],
    success: ['#22c55e', '#4ade80'],
    warning: ['#f97316', '#fb923c']
  }
};

/**
 * 初始化图表
 * @param {Object} canvas - Canvas 对象
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {number} dpr - 设备像素比
 * @returns {Object} ECharts 实例
 */
function initChart(canvas, width, height, dpr) {
  return createECharts(canvas, width, height, dpr);
}

/**
 * 生成折线图配置
 * @param {Array} data - 数据数组
 * @param {Object} options - 配置选项
 * @returns {Object} 图表配置
 */
function getLineChartOption(data, options = {}) {
  const safeData = Array.isArray(data) ? data : [];
  
  return {
    tooltip: {
      trigger: 'axis',
      confine: true
    },
    grid: {
      left: 40,
      right: 20,
      top: 20,
      bottom: 30,
      containLabel: false
    },
    xAxis: {
      type: 'category',
      data: safeData.map(item => item.month || item.name || ''),
      axisLabel: {
        fontSize: 10,
        color: '#6b7280'
      },
      axisLine: {
        lineStyle: {
          color: '#e5e7eb'
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 10,
        color: '#6b7280'
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
          type: 'dashed'
        }
      }
    },
    series: [{
      name: options.name || '数值',
      type: 'line',
      data: safeData.map(item => item.count || item.value || 0),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        width: 2,
        color: '#3b82f6'
      },
      itemStyle: {
        color: '#3b82f6'
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
          ]
        }
      }
    }]
  };
}

/**
 * 生成饼图配置
 * @param {Array} data - 数据数组
 * @param {Object} options - 配置选项
 * @returns {Object} 图表配置
 */
function getPieChartOption(data, options = {}) {
  const safeData = Array.isArray(data) ? data : [];
  
  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'horizontal',
      bottom: 10,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        fontSize: 10,
        color: '#6b7280'
      }
    },
    series: [{
      name: options.name || '分布',
      type: 'pie',
      radius: ['35%', '55%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      label: {
        show: false
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 12,
          fontWeight: 'bold'
        }
      },
      labelLine: {
        show: false
      },
      data: safeData.map(item => ({
        value: item.count || item.value || 0,
        name: item.category || item.level || item.name || '未知'
      })),
      itemStyle: {
        borderRadius: 4,
        borderColor: '#fff',
        borderWidth: 2
      }
    }],
    color: ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#06b6d4']
  };
}

/**
 * 生成柱状图配置
 * @param {Array} data - 数据数组
 * @param {Object} options - 配置选项
 * @returns {Object} 图表配置
 */
function getBarChartOption(data, options = {}) {
  // [MODIFY] 添加数据校验，防止 undefined 导致报错
  const safeData = Array.isArray(data) ? data : [];
  
  return {
    color: CHART_COLORS.palette,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(59, 130, 246, 0.1)'
        }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: {
        color: '#1f2937',
        fontSize: 12
      },
      padding: [8, 12],
      extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 8px;'
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '10%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: safeData.map(item => item.eventName || item.clubName || item.name || ''),
      axisLine: {
        lineStyle: {
          color: '#e5e7eb',
          width: 1
        }
      },
      axisLabel: {
        color: '#6b7280',
        fontSize: 11,
        margin: 12,
        interval: 0,
        rotate: safeData.length > 5 ? 30 : 0
      },
      axisTick: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      max: 1,
      axisLine: {
        show: false
      },
      axisLabel: {
        color: '#6b7280',
        fontSize: 11,
        margin: 12,
        formatter: '{value}%'
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
          width: 1,
          type: 'dashed'
        }
      }
    },
    series: [{
      name: options.name || '数值',
      type: 'bar',
      barWidth: '50%',
      barMaxWidth: 40,
      data: safeData.map(item => (item.rate || item.value || 0) * 100),
      itemStyle: {
        color: '#3b82f6',
        borderRadius: [8, 8, 0, 0]
      },
      emphasis: {
        itemStyle: {
          color: '#2563eb'
        }
      }
    }],
    animationDuration: 800,
    animationEasing: 'cubicOut'
  };
}

module.exports = {
  initChart,
  getLineChartOption,
  getPieChartOption,
  getBarChartOption,
  COLORS,
  CHART_COLORS
};
