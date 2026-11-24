# -*- coding: utf-8 -*-
"""
登录功能测试
测试管理员登录的各种场景
"""
import pytest
import time
from pages.login_page import LoginPage
from config import TestConfig


class TestLogin:
    """登录测试类"""
    
    def test_successful_login(self, driver, config):
        """
        测试正常登录
        验证使用正确的用户名和密码可以成功登录
        """
        login_page = LoginPage(driver, config.BASE_URL)
        login_page.load()
        
        # 执行登录
        login_page.login(config.ADMIN_USERNAME, config.ADMIN_PASSWORD)
        
        # 验证登录成功
        assert login_page.is_logged_in(), "登录失败，未跳转到管理后台"
    
    def test_login_with_wrong_password(self, driver, config):
        """
        测试错误密码登录
        验证使用错误的密码登录会失败
        """
        login_page = LoginPage(driver, config.BASE_URL)
        login_page.load()
        
        # 使用错误密码登录
        login_page.login(config.ADMIN_USERNAME, "wrongpassword")
        
        # 验证登录失败，仍在登录页面
        assert login_page.is_at_login_page(), "使用错误密码不应登录成功"
    
    def test_login_with_empty_username(self, driver, config):
        """
        测试空用户名登录
        验证用户名为空时登录会失败
        """
        login_page = LoginPage(driver, config.BASE_URL)
        login_page.load()
        
        # 空用户名登录
        login_page.login("", config.ADMIN_PASSWORD)
        
        # 验证仍在登录页面
        assert login_page.is_at_login_page(), "空用户名不应登录成功"
    
    def test_login_with_empty_password(self, driver, config):
        """
        测试空密码登录
        验证密码为空时登录会失败
        """
        login_page = LoginPage(driver, config.BASE_URL)
        login_page.load()
        
        # 空密码登录
        login_page.login(config.ADMIN_USERNAME, "")
        
        # 验证仍在登录页面
        assert login_page.is_at_login_page(), "空密码不应登录成功"
    
    def test_login_with_special_characters(self, driver, config):
        """
        测试特殊字符登录
        验证使用特殊字符作为用户名/密码时系统处理正确
        """
        login_page = LoginPage(driver, config.BASE_URL)
        login_page.load()
        
        # 使用特殊字符登录
        special_chars = "<script>alert('xss')</script>"
        login_page.login(special_chars, special_chars)
        
        # 验证系统没有崩溃，仍在登录页面或显示错误
        assert login_page.is_at_login_page() or login_page.get_error_message() is not None, \
            "特殊字符应被正确处理"
    
    def test_login_page_elements(self, driver, config):
        """
        测试登录页面元素
        验证登录页面包含必要的元素
        """
        login_page = LoginPage(driver, config.BASE_URL)
        login_page.load()
        
        # 验证必要元素存在
        assert login_page.is_element_present(login_page.USERNAME_INPUT), "缺少用户名输入框"
        assert login_page.is_element_present(login_page.PASSWORD_INPUT), "缺少密码输入框"
        assert login_page.is_element_present(login_page.LOGIN_BUTTON), "缺少登录按钮"
    
    def test_logout(self, logged_in_driver, config):
        """
        测试登出功能
        验证登录后可以正常登出
        """
        driver = logged_in_driver
        login_page = LoginPage(driver, config.BASE_URL)
        
        # 执行登出
        login_page.logout()
        
        # 验证已登出，回到登录页面
        assert login_page.is_at_login_page(), "登出后应回到登录页面"
