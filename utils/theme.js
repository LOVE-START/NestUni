/**
 * 主题色管理工具
 * 提供动态渐变主题色生成和应用功能
 */

// 预定义的主题配置：name 为颜色标识，用于关联各页面对应配色的图片资源
const themes = [
  { name: "pink", gradient: "linear-gradient(to right, rgb(255, 175, 189), rgb(255, 195, 160))" },//粉色
  { name: "blue", gradient: "linear-gradient(to right, rgba(190, 218, 255, 1), rgba(206, 194, 255, 1))" },//蓝色
  { name: "green", gradient: "linear-gradient(to right, rgb(108, 214, 184), rgb(86, 192, 160))" }//绿色
];

// 从渐变色中提取主要颜色（用于非渐变场景）
const extractMainColors = (gradient) => {
  // 从渐变字符串中提取颜色值
  const colorRegex = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/g;
  const matches = [...gradient.matchAll(colorRegex)];
  
  // 提取开始和结束颜色
  const startColor = matches[0] ? matches[0][0] : '';
  const endColor = matches[1] ? matches[1][0] : '';
  
  return {
    start: startColor,
    end: endColor,
    primary: startColor, // 主色调（用于文本等）
    secondary: endColor, // 次色调
  };
};

// 随机获取一个主题配置
const getRandomTheme = () => {
  const randomIndex = Math.floor(Math.random() * themes.length);
  return themes[randomIndex];
};

// 根据渐变色字符串匹配颜色标识（兼容旧版本缓存中未存储 colorName 的情况）
const matchColorName = (gradient) => {
  const theme = themes.find(t => t.gradient === gradient);
  return theme ? theme.name : '';
};

// 主题管理类
class ThemeManager {
  constructor() {
    this.currentGradient = '';
    this.currentColors = {};
    this.currentColorName = '';
    // 默认主题从预设数组中随机选取
    this.defaultGradient = getRandomTheme().gradient;
    this.defaultColors = extractMainColors(this.defaultGradient);
    this.defaultColorName = matchColorName(this.defaultGradient);
    
    // 初始化时不立即设置随机主题，而是尝试读取存储的主题
    this.initialize();
  }
  
  // 初始化主题
  initialize() {
    try {
      // 检查存储中是否有已保存的主题
      const savedTheme = wx.getStorageSync('app_theme');
      if (savedTheme && savedTheme.gradient) {
        // 如果有，恢复保存的主题（旧缓存无 colorName 时根据渐变色反推）
        this.currentGradient = savedTheme.gradient;
        this.currentColors = savedTheme.colors;
        this.currentColorName = savedTheme.colorName || matchColorName(savedTheme.gradient);
      } else {
        // 没有保存的主题时使用默认主题（随机选择）
        this.currentGradient = this.defaultGradient;
        this.currentColors = this.defaultColors;
        this.currentColorName = this.defaultColorName;
      }
    } catch (error) {
      console.error('初始化主题失败，使用默认主题:', error);
      this.currentGradient = this.defaultGradient;
      this.currentColors = this.defaultColors;
      this.currentColorName = this.defaultColorName;
    }
    
    return this.getCurrentTheme();
  }
  
  // 随机选择主题色
  setRandomTheme() {
    // 强制确保选择一个不同于当前主题的渐变
    let selected = getRandomTheme();
    while (selected.gradient === this.currentGradient && themes.length > 1) {
      selected = getRandomTheme();
    }
    
    this.currentGradient = selected.gradient;
    this.currentColors = extractMainColors(selected.gradient);
    this.currentColorName = selected.name;
    
    // 将主题存入本地存储以便持久化
    this.persistTheme();
    
    return this.getCurrentTheme();
  }
  
  // 设置指定的主题色
  setTheme(gradient) {
    if (!gradient) {
      console.warn('尝试设置空主题，使用随机主题代替');
      return this.setRandomTheme();
    }
    
    this.currentGradient = gradient;
    this.currentColors = extractMainColors(gradient);
    this.currentColorName = matchColorName(gradient);
    
    // 将主题存入本地存储以便持久化
    this.persistTheme();
    
    return this.getCurrentTheme();
  }
  
  // 持久化当前主题（含颜色标识，供页面绑定对应配色的资源）
  persistTheme() {
    wx.setStorageSync('app_theme', {
      gradient: this.currentGradient,
      colors: this.currentColors,
      colorName: this.currentColorName
    });
  }
  
  // 获取当前主题
  getCurrentTheme() {
    // 如果未设置，则使用默认主题
    if (!this.currentGradient) {
      this.currentGradient = this.defaultGradient;
      this.currentColors = this.defaultColors;
      this.currentColorName = this.defaultColorName;
    }
    
    return this.buildTheme();
  }
  
  // 获取当前主题但不修改任何状态（专门给不想修改主题的页面使用）
  getTheme() {
    const currentGradient = this.currentGradient || this.defaultGradient;
    const currentColors = this.currentColors || this.defaultColors;
    const currentColorName = this.currentColorName || this.defaultColorName;
    
    return {
      gradient: currentGradient,
      gradientButton: currentGradient.replace('to right', 'to bottom'),
      colorName: currentColorName,
      colors: currentColors
    };
  }
  
  // 组装主题对象
  buildTheme() {
    return {
      gradient: this.currentGradient,
      gradientButton: this.currentGradient.replace('to right', 'to bottom'), // 按钮通常使用从上到下的渐变
      colorName: this.currentColorName,
      colors: this.currentColors
    };
  }
  
  // 应用主题到页面的方法（可供页面直接调用）
  applyThemeToPage() {
    const theme = this.getCurrentTheme();
    // 这里可以添加在页面中直接修改DOM样式的代码，如果需要的话
    return theme;
  }
}

// 创建单例实例
const themeManager = new ThemeManager();

module.exports = {
  themeManager
};