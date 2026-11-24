const { adminLogin } = require("../../../utils/api/index");

Page({
  data: {
    username: "",
    password: "",
    loading: false
  },
  
  onLoad() {
    // 不再检查管理员token，每次都需要重新登录
  },
  
  onUsername(e) {
    this.setData({ username: e.detail.value || "" });
  },
  
  onPassword(e) {
    this.setData({ password: e.detail.value || "" });
  },
  
  validateForm() {
    const { username, password } = this.data;
    
    if (!username) {
      wx.showToast({ 
        title: "请输入账号", 
        icon: "none" 
      });
      return false;
    }
    
    if (!password) {
      wx.showToast({ 
        title: "请输入密码", 
        icon: "none" 
      });
      return false;
    }
    
    if (password.length < 6) {
      wx.showToast({ 
        title: "密码长度不能少于6位", 
        icon: "none" 
      });
      return false;
    }
    
    return true;
  },
  
  async login() {
    if (this.data.loading) return;
    
    // 表单验证
    if (!this.validateForm()) {
      return;
    }
    
    const { username, password } = this.data;
    
    this.setData({ loading: true });
    
    try {
      const result = await adminLogin(username, password);
      
      if (result && result.success) {
        wx.showToast({ 
          title: "登录成功", 
          icon: "success" 
        });
        
        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
          wx.redirectTo({ 
            url: "/pages/admin/dashboard/dashboard" 
          });
        }, 1500);
      } else {
        wx.showToast({ 
          title: result.message || "登录失败", 
          icon: "none" 
        });
      }
    } catch (e) {
      console.error('登录错误:', e);
      wx.showToast({ 
        title: e.message || "登录失败，请检查网络", 
        icon: "none" 
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});