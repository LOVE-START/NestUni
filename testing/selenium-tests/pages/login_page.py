# -*- coding: utf-8 -*-
"""
登录页面
管理员登录功能测试
"""
from selenium.webdriver.common.by import By
from .base_page import BasePage
import time


class LoginPage(BasePage):
    """登录页面类"""
    
    # 页面URL
    URL = '/admin/login'
    
    # 页面元素定位器
    USERNAME_INPUT = (By.ID, 'username')
    PASSWORD_INPUT = (By.ID, 'password')
    LOGIN_BUTTON = (By.CSS_SELECTOR, 'button[type="submit"]')
    ERROR_MESSAGE = (By.CLASS_NAME, 'error-message')
    SUCCESS_INDICATOR = (By.CLASS_NAME, 'dashboard')
    LOGOUT_BUTTON = (By.CSS_SELECTOR, '.logout-btn')
    
    def __init__(self, driver, base_url):
        """
        初始化登录页面
        
        Args:
            driver: WebDriver实例
            base_url: 基础URL
        """
        super().__init__(driver, base_url)
    
    def load(self):
        """加载登录页面"""
        self.open(self.URL)
    
    def enter_username(self, username):
        """
        输入用户名
        
        Args:
            username: 用户名
        """
        self.input_text(self.USERNAME_INPUT, username)
    
    def enter_password(self, password):
        """
        输入密码
        
        Args:
            password: 密码
        """
        self.input_text(self.PASSWORD_INPUT, password)
    
    def click_login(self):
        """点击登录按钮"""
        self.click(self.LOGIN_BUTTON)
    
    def login(self, username, password):
        """
        执行完整登录流程
        
        Args:
            username: 用户名
            password: 密码
        """
        self.enter_username(username)
        self.enter_password(password)
        self.click_login()
        time.sleep(2)  # 等待登录响应
    
    def get_error_message(self):
        """
        获取错误提示信息
        
        Returns:
            str: 错误信息
        """
        if self.is_element_present(self.ERROR_MESSAGE):
            return self.get_text(self.ERROR_MESSAGE)
        return None
    
    def is_logged_in(self):
        """
        判断是否已登录
        
        Returns:
            bool: 是否已登录
        """
        return self.is_element_present(self.SUCCESS_INDICATOR, timeout=5)
    
    def logout(self):
        """执行登出操作"""
        if self.is_element_present(self.LOGOUT_BUTTON, timeout=3):
            self.click(self.LOGOUT_BUTTON)
            time.sleep(1)
    
    def is_at_login_page(self):
        """
        判断是否在登录页面
        
        Returns:
            bool: 是否在登录页面
        """
        return self.is_element_present(self.LOGIN_BUTTON, timeout=3)
