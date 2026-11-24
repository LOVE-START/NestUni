/**
 * 数据分析组件
 * @description 展示社团运营数据的可视化图表
 */

const api = require('../../../../utils/api/index');
const chartsUtil = require('../../../../utils/charts-lite');
import * as echarts from '../../../../lib/ec-canvas/echarts';

Component({
  properties: {
    clubId: {
      type: Number,
      value: 0
    }
  },

  data: {
    overview: {
      memberCount: 0,
      eventCount: 0,
      recruitmentCount: 0,
      avgActivityScore: 0,
      trends: {
        memberTrend: 0,
        eventTrend: 0,
        recruitmentTrend: 0,
        activityTrend: 0
      }
    },
    eventStats: {},
    memberStats: {},
    recruitmentStats: {
      funnel: {
        conversionRates: {}
      },
      funnelData: []
    },
    periodOptions: [
      { value: 'semester', label: '本学期' },
      { value: 'year', label: '本学年' }
    ],
    currentPeriod: { value: 'semester', label: '本学期' },
    eventTrendEc: {
      lazyLoad: true
    },
    memberLevelEc: {
      lazyLoad: true
    },
    loading: false
  },

  lifetimes: {
    attached() {
      this.loadData();
    }
  },

  observers: {
    'clubId': function(clubId) {
      if (clubId) {
        this.loadData();
      }
    }
  },

  methods: {
    /**
     * 加载所有数据
     */
    async loadData() {
      if (!this.data.clubId) return;
      
      this.setData({ loading: true });
      
      try {
        await Promise.all([
          this.loadOverview(),
          this.loadEventStats(),
          this.loadMemberStats(),
          this.loadRecruitmentStats()
        ]);
      } catch (error) {
        console.error('加载数据失败:', error);
        wx.showToast({
          title: '加载数据失败',
          icon: 'none'
        });
      } finally {
        this.setData({ loading: false });
      }
    },

    /**
     * 加载概览数据
     */
    async loadOverview() {
      try {
        const res = await api.getStatsOverview(this.data.clubId, this.data.currentPeriod.value);
        if (res.success) {
          this.setData({ overview: res.data });
        }
      } catch (error) {
        console.error('加载概览数据失败:', error);
      }
    },

    /**
     * 加载活动数据
     */
    async loadEventStats() {
      try {
        const res = await api.getStatsEvents(this.data.clubId, this.data.currentPeriod.value);
        if (res.success) {
          this.setData({ eventStats: res.data });
          this.initEventTrendChart(res.data.participationTrend);
        }
      } catch (error) {
        console.error('加载活动数据失败:', error);
      }
    },

    /**
     * 加载成员数据
     */
    async loadMemberStats() {
      try {
        const res = await api.getStatsMembers(this.data.clubId, this.data.currentPeriod.value);
        if (res.success) {
          this.setData({ memberStats: res.data });
          this.initMemberLevelChart(res.data.levelDistribution);
        }
      } catch (error) {
        console.error('加载成员数据失败:', error);
      }
    },

    /**
     * 加载招新数据
     */
    async loadRecruitmentStats() {
      try {
        const res = await api.getStatsRecruitments(this.data.clubId, this.data.currentPeriod.value);
        if (res.success) {
          const funnelData = this.processFunnelData(res.data.funnel);
          this.setData({ 
            recruitmentStats: {
              ...res.data,
              funnelData
            }
          });
        }
      } catch (error) {
        console.error('加载招新数据失败:', error);
      }
    },

    /**
     * 处理漏斗数据
     */
    processFunnelData(funnel) {
      const stages = [
        { stage: '浏览', count: funnel.views, color: '#5470c6' },
        { stage: '报名', count: funnel.applications, color: '#91cc75' },
        { stage: '面试', count: funnel.interviews, color: '#fac858' },
        { stage: '录用', count: funnel.accepted, color: '#ee6666' }
      ];
      
      const maxCount = Math.max(...stages.map(s => s.count));
      return stages.map(s => ({
        ...s,
        percentage: maxCount > 0 ? (s.count / maxCount) * 100 : 0
      }));
    },

    /**
     * 初始化活动趋势图表
     * @description 使用 lazyLoad 模式，手动调用 init 方法
     */
    initEventTrendChart(data) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn('活动趋势数据为空，跳过图表初始化');
        return;
      }
      
      setTimeout(() => {
        const component = this.selectComponent('#eventTrendChart');
        if (!component) {
          console.error('找不到 eventTrendChart 组件');
          return;
        }
        
        component.init((canvas, width, height, dpr) => {
          const chart = echarts.init(canvas, null, {
            width: width,
            height: height,
            devicePixelRatio: dpr
          });
          canvas.setChart(chart);
          
          const option = chartsUtil.getLineChartOption(data, { name: '参与人数' });
          chart.setOption(option);
          return chart;
        });
      }, 100);
    },

    /**
     * 初始化成员等级图表
     * @description 使用 lazyLoad 模式，手动调用 init 方法
     */
    initMemberLevelChart(data) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn('成员等级数据为空，跳过图表初始化');
        return;
      }
      
      setTimeout(() => {
        const component = this.selectComponent('#memberLevelChart');
        if (!component) {
          console.error('找不到 memberLevelChart 组件');
          return;
        }
        
        component.init((canvas, width, height, dpr) => {
          const chart = echarts.init(canvas, null, {
            width: width,
            height: height,
            devicePixelRatio: dpr
          });
          canvas.setChart(chart);
          
          const option = chartsUtil.getPieChartOption(data, { name: '等级分布' });
          chart.setOption(option);
          return chart;
        });
      }, 100);
    },

    /**
     * 时间周期变更
     */
    onPeriodChange(e) {
      const index = e.detail.value;
      const period = this.data.periodOptions[index];
      this.setData({ currentPeriod: period });
      this.loadData();
    }
  }
});
