/**
 * 活动地图页面
 * @description 展示活动位置，支持附近活动推荐、步行路线规划
 */
const { request } = require('../../utils/api/index');
const { recordMapViewed } = require('../../utils/api/event');
const { themeManager } = require("../../utils/theme");
const { formatEventDate, formatEventDateTime } = require("../../utils/date");
const { walkingDirection } = require("../../utils/map");
const markerCanvas = require("../../utils/markerCanvas");

/* 默认坐标 */
const DEFAULT_LOCATION = {
  longitude: 113.022932,
  latitude: 23.044167
};

Page({
  data: {
    statusBarHeight: 0,
    markers: [],
    center: { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude },
    selectedEvent: null,
    showEventCard: false,
    nearbyEvents: [],
    showNearbyList: false,
    showLocation: true,
    loading: true,
    userLocation: null,
    events: [],
    targetEventId: null,
    theme: {},
    polyline: [],
    routeInfo: null,
    isNavigating: false,
    rotate: 0,
    scale: 17,
    locationChangeFn: null,
    deviceMotionChangeFn: null,
    navigationState: {
      routePoints: [],
      remainingPoints: [],
      totalDistance: 0,
      remainingDistance: 0,
      destination: null
    }
  },

  /**
   * 页面卸载
   */
  onUnload() {
    this.cleanupResources();
  },

  /**
   * 页面加载
   */
  onLoad(query) {
    const systemInfo = wx.getSystemInfoSync();
    const theme = themeManager.getCurrentTheme();
    
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      targetEventId: query.eventId || null,
      theme
    });
    
    this.loadEvents();
    this.getUserLocation();
    recordMapViewed();
  },

  /**
   * 主题变更处理
   */
  onThemeChange(e) {
    this.setData({ theme: e.detail.theme });
  },

  /**
   * 返回上一页
   */
  goBack() {
    this.cleanupResources();
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/home/home' })
    });
  },

  /**
   * 清理资源
   */
  cleanupResources() {
    this.stopNavigation();
    this.setData({
      polyline: [],
      routeInfo: null,
      markers: [],
      events: [],
      nearbyEvents: [],
      selectedEvent: null,
      showEventCard: false,
      showNearbyList: false
    });
  },

  /**
   * 获取用户位置
   */
  getUserLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          userLocation: { latitude: res.latitude, longitude: res.longitude }
        });
        this.loadNearbyEvents(res.latitude, res.longitude);
      },
      fail: (err) => {
        console.log('获取位置失败，使用默认坐标', err);
        this.setData({
          userLocation: { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude }
        });
        this.loadNearbyEvents(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude);
        
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要位置权限',
            content: '请允许获取位置信息，以便显示更精准的附近活动',
            confirmText: '去设置',
            showCancel: false,
            success: (res) => {
              if (res.confirm) wx.openSetting();
            }
          });
        }
      }
    });
  },

  /**
   * 加载活动数据
   */
  async loadEvents() {
    this.setData({ loading: true });

    try {
      const response = await request({
        url: '/nfunest/api/events/map',
        method: 'POST',
        data: {},
        showLoading: false
      });

      if (response.success) {
        const events = response.data || [];
        
        const formattedEvents = events.map(event => ({
          ...event,
          formattedDate: formatEventDate(event.date),
          formattedTime: formatEventDateTime(event.date).split(' ')[1] || '',
          displayLocation: event.location_name || event.location || ''
        }));
        
        const markers = await this.generateMarkers(events);
        const center = this.calculateCenter(events);

        this.setData({
          events: formattedEvents,
          markers,
          center: center || this.data.center
        });
        
        if (this.data.targetEventId) {
          this.locateTargetEvent();
        }
      }
    } catch (error) {
      console.error('加载活动失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  
  /**
   * 定位目标活动
   */
  locateTargetEvent() {
    const { targetEventId, events } = this.data;
    if (!targetEventId || !events.length) return;
    
    const targetEvent = events.find(event => String(event.id) === String(targetEventId));
    
    if (targetEvent) {
      this.setData({
        center: { latitude: targetEvent.latitude, longitude: targetEvent.longitude },
        targetEventId: null
      });
    }
  },

  /**
   * 获取状态颜色
   */
  getStatusColor(statusClass) {
    const theme = this.data.theme;
    const primaryColor = theme?.colors?.primary || 'rgb(255, 175, 189)';
    const colorMap = {
      'ongoing': primaryColor,
      'upcoming': '#ffd66f'
    };
    return colorMap[statusClass] || primaryColor;
  },

  /**
   * 生成地图标记
   */
  async generateMarkers(events) {
    return await markerCanvas.generateMarkers(events, this.getStatusColor.bind(this));
  },

  /**
   * 计算地图中心点
   */
  calculateCenter(events) {
    if (!events.length) return null;
    const lat = events.reduce((sum, e) => sum + parseFloat(e.latitude), 0) / events.length;
    const lng = events.reduce((sum, e) => sum + parseFloat(e.longitude), 0) / events.length;
    return { latitude: lat, longitude: lng };
  },

  /**
   * 加载附近活动
   */
  async loadNearbyEvents(latitude, longitude) {
    try {
      const response = await request({
        url: '/nfunest/api/events/nearby',
        method: 'POST',
        data: { latitude, longitude, radius: 5, limit: 5 },
        showLoading: false
      });

      if (response.success) {
        const nearbyEvents = (response.data || []).map(event => ({
          ...event,
          distance: this.calculateDistance(latitude, longitude, event.latitude, event.longitude),
          displayLocation: event.location_name || event.location || ''
        }));
        this.setData({ nearbyEvents });
      }
    } catch (error) {
      console.error('加载附近活动失败:', error);
    }
  },

  /**
   * 计算两点间距离
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const rad = Math.PI / 180;
    const R = 6371;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  },

  /**
   * 地图标记点击
   */
  onMarkerTap(e) {
    const event = this.data.events.find(ev => ev.id === e.markerId);
    if (event) {
      this.setData({ selectedEvent: event, showEventCard: true });
    }
  },

  /**
   * 关闭活动卡片
   */
  closeEventCard() {
    this.setData({ showEventCard: false, selectedEvent: null });
  },

  /**
   * 跳转到活动详情
   */
  navigateToEvent() {
    const { selectedEvent } = this.data;
    if (selectedEvent) {
      wx.navigateTo({ url: `/pages/activitiesDetail/activitiesDetail?id=${selectedEvent.id}` });
      this.closeEventCard();
    }
  },

  /**
   * 移动到用户位置
   */
  moveToLocation() {
    wx.createMapContext('eventMap', this).moveToLocation();
  },

  /**
   * 地图区域变化
   */
  onRegionChange(e) {
    /* 可扩展：拖动后重新加载附近活动 */
  },

  /**
   * 切换附近活动列表
   */
  toggleNearbyList() {
    this.setData({ showNearbyList: !this.data.showNearbyList });
  },

  /**
   * 附近活动点击
   */
  onNearbyEventTap(e) {
    const event = e.currentTarget.dataset.event;
    this.setData({
      selectedEvent: event,
      showEventCard: true,
      center: { latitude: event.latitude, longitude: event.longitude }
    });
  },

  /**
   * 显示路线规划
   */
  async showRoutePlanning() {
    const { selectedEvent, userLocation } = this.data;
    if (!selectedEvent || !userLocation) {
      wx.showToast({ title: '请先获取位置', icon: 'none' });
      return;
    }

    const targetLocation = {
      latitude: selectedEvent.latitude,
      longitude: selectedEvent.longitude,
      name: selectedEvent.location_name || selectedEvent.location || selectedEvent.title
    };

    this.setData({ showEventCard: false });
    await this.planRouteToTarget(userLocation, targetLocation);
  },

  /**
   * 规划步行路线
   */
  async planRouteToTarget(userLocation, targetLocation) {
    if (!userLocation || !targetLocation) return;

    wx.showLoading({ title: '规划路线中...' });

    try {
      const result = await walkingDirection(
        userLocation.latitude, userLocation.longitude,
        targetLocation.latitude, targetLocation.longitude
      );

      if (result?.polyline) {
        const distanceInMeters = result.distance;
        const durationInMinutes = Math.ceil(result.duration / 60);
        const distanceDisplay = distanceInMeters < 1000 
          ? distanceInMeters 
          : (distanceInMeters / 1000).toFixed(1);
        const distanceUnit = distanceInMeters < 1000 ? '米' : '公里';

        this.setData({
          polyline: [{
            points: result.polyline,
            color: '#FFB6C1',
            width: 8,
            arrowLine: true,
            borderColor: '#ffffff',
            borderWidth: 2
          }],
          routeInfo: {
            distance: distanceDisplay,
            distanceUnit,
            duration: durationInMinutes
          }
        });

        this.fitRouteInView(result.polyline);
        
        wx.showToast({ 
          title: `${distanceDisplay}${distanceUnit}，约${durationInMinutes}分钟`, 
          icon: 'none',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('路线规划失败:', error);
      wx.showToast({ title: error.message || '路线规划失败', icon: 'none', duration: 2500 });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 调整地图视野包含整条路线
   */
  fitRouteInView(polyline) {
    if (!polyline?.length) return;

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    polyline.forEach(point => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });

    this.setData({
      center: {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2
      }
    });
  },

  /* ==================== 导航功能 ==================== */

  /**
   * 显示导航卡片
   */
  showNavigationCard() {
    const { navigationState } = this.data;
    if (navigationState.destination) {
      this.setData({
        selectedEvent: navigationState.destination,
        showEventCard: true
      });
    }
  },

  /**
   * 启动实时导航
   */
  startNavigation() {
    const { routeInfo, polyline } = this.data;
    
    if (!polyline?.length || !polyline[0].points?.length) {
      wx.showToast({ title: '请先规划路线', icon: 'none' });
      return;
    }

    const routePoints = polyline[0].points;
    const totalDistance = routeInfo.distanceUnit === '公里' 
      ? parseFloat(routeInfo.distance) * 1000 
      : parseFloat(routeInfo.distance);

    this.setData({
      isNavigating: true,
      scale: 18,
      navigationState: {
        routePoints,
        remainingPoints: routePoints,
        totalDistance,
        remainingDistance: totalDistance,
        destination: this.data.selectedEvent
      }
    });

    this.startDeviceMotionListening();
    this.startLocationUpdate();

    wx.showToast({ title: '导航已开始', icon: 'success' });
  },

  /**
   * 停止实时导航
   */
  stopNavigation() {
    this.stopDeviceMotionListening();
    this.stopLocationUpdate();

    this.setData({
      isNavigating: false,
      rotate: 0,
      scale: 17,
      navigationState: {
        routePoints: [],
        remainingPoints: [],
        totalDistance: 0,
        remainingDistance: 0,
        destination: null
      }
    });

    wx.showToast({ title: '导航已结束', icon: 'none' });
  },

  /**
   * 启动设备方向监听
   */
  startDeviceMotionListening() {
    wx.startDeviceMotionListening({
      interval: "normal",
      success: () => console.log("设备方向监听启动成功"),
      fail: (err) => console.error("设备方向监听启动失败:", err)
    });

    const deviceMotionChangeFn = (res) => {
      if (this.data.isNavigating) {
        this.setData({ rotate: 360 - res.alpha });
      }
    };

    this.setData({ deviceMotionChangeFn });
    wx.onDeviceMotionChange(deviceMotionChangeFn);
  },

  /**
   * 停止设备方向监听
   */
  stopDeviceMotionListening() {
    if (this.data.deviceMotionChangeFn) {
      wx.offDeviceMotionChange(this.data.deviceMotionChangeFn);
      this.setData({ deviceMotionChangeFn: null });
    }

    wx.stopDeviceMotionListening({
      success: () => console.log("设备方向监听停止成功"),
      fail: (err) => console.error("设备方向监听停止失败:", err)
    });
  },

  /**
   * 启动实时位置更新
   */
  startLocationUpdate() {
    wx.startLocationUpdate({
      success: () => {
        console.log("位置更新启动成功");

        const locationChangeFn = (res) => {
          this.setData({
            center: { latitude: res.latitude, longitude: res.longitude },
            userLocation: { latitude: res.latitude, longitude: res.longitude }
          });
          this.updateRouteByLocation(res.latitude, res.longitude);
        };

        this.setData({ locationChangeFn });
        wx.onLocationChange(locationChangeFn);
      },
      fail: (err) => {
        console.error("位置更新启动失败:", err);
        wx.showToast({ title: '位置更新启动失败', icon: 'none' });
      }
    });
  },

  /**
   * 停止实时位置更新
   */
  stopLocationUpdate() {
    wx.stopLocationUpdate({
      success: () => console.log("位置更新停止成功"),
      fail: (err) => console.error("位置更新停止失败:", err)
    });

    if (this.data.locationChangeFn) {
      wx.offLocationChange(this.data.locationChangeFn);
      this.setData({ locationChangeFn: null });
    }
  },

  /**
   * 根据位置更新路线
   */
  updateRouteByLocation(currentLat, currentLng) {
    const { navigationState, isNavigating } = this.data;
    
    if (!isNavigating || !navigationState.remainingPoints?.length) return;

    const nearestIndex = this.findNearestPointIndex(currentLat, currentLng, navigationState.remainingPoints);

    if (nearestIndex !== -1) {
      const remainingPoints = navigationState.remainingPoints.slice(nearestIndex);
      const remainingDistance = this.calculateRemainingDistance(remainingPoints);

      this.setData({
        navigationState: {
          ...navigationState,
          remainingPoints,
          remainingDistance
        },
        polyline: [{
          ...this.data.polyline[0],
          points: remainingPoints
        }],
        routeInfo: {
          ...this.data.routeInfo,
          distance: remainingDistance < 1000 ? remainingDistance.toFixed(0) : (remainingDistance / 1000).toFixed(1),
          distanceUnit: remainingDistance < 1000 ? '米' : '公里'
        }
      });

      if (remainingDistance < 10) {
        wx.showToast({ title: '已到达目的地！', icon: 'success', duration: 3000 });
        this.stopNavigation();
      }
    }
  },

  /**
   * 找最近路线点索引
   */
  findNearestPointIndex(lat, lng, points) {
    let minDistance = Infinity;
    let nearestIndex = -1;

    for (let i = 0; i < points.length; i++) {
      const distance = this.calculateDistanceInMeters(lat, lng, points[i].latitude, points[i].longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    return minDistance < 50 ? nearestIndex : -1;
  },

  /**
   * 计算剩余路线距离
   */
  calculateRemainingDistance(points) {
    if (!points || points.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += this.calculateDistanceInMeters(
        points[i].latitude, points[i].longitude,
        points[i + 1].latitude, points[i + 1].longitude
      );
    }
    return totalDistance;
  },

  /**
   * 计算两点间距离（米）
   */
  calculateDistanceInMeters(lat1, lng1, lat2, lng2) {
    const rad = Math.PI / 180;
    const R = 6371000;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
});
