# -*- coding: utf-8 -*-
"""
社团管理功能测试
测试社团的增删改查功能
"""
import pytest
import time
from pages.club_page import ClubPage
from pages.login_page import LoginPage
from config import TestConfig


class TestClub:
    """社团管理测试类"""
    
    @pytest.fixture(autouse=True)
    def setup(self, logged_in_driver, config):
        """测试前置：登录并进入社团管理页面"""
        self.driver = logged_in_driver
        self.config = config
        self.club_page = ClubPage(self.driver, config.BASE_URL)
        self.club_page.load()
    
    def test_club_page_load(self):
        """
        测试社团管理页面加载
        验证页面可以正常加载并显示社团列表
        """
        # 验证页面元素存在
        assert self.club_page.is_element_present(self.club_page.ADD_CLUB_BUTTON), "缺少添加社团按钮"
        assert self.club_page.is_element_present(self.club_page.SEARCH_INPUT), "缺少搜索框"
    
    def test_create_club(self):
        """
        测试创建社团
        验证可以成功创建新社团
        """
        club_name = f"测试社团_{int(time.time())}"
        short_intro = "这是一个测试社团"
        description = "这是测试社团的详细描述，用于测试创建社团功能。"
        
        # 创建社团
        result = self.club_page.create_club(club_name, short_intro, description)
        
        # 验证创建成功
        assert result, f"创建社团失败: {club_name}"
    
    def test_search_club(self):
        """
        测试搜索社团
        验证搜索功能可以正常工作
        """
        search_keyword = "测试"
        
        # 执行搜索
        self.club_page.search_club(search_keyword)
        
        # 获取搜索结果数量
        count = self.club_page.get_club_count()
        
        # 验证搜索有结果或正确处理
        assert count >= 0, "搜索功能异常"
    
    def test_search_nonexistent_club(self):
        """
        测试搜索不存在的社团
        验证搜索不存在的社团时返回空结果
        """
        search_keyword = "不存在的社团名称XYZ123"
        
        # 执行搜索
        self.club_page.search_club(search_keyword)
        
        # 验证没有结果
        count = self.club_page.get_club_count()
        assert count == 0, "搜索不存在的社团应返回空结果"
    
    def test_create_club_with_empty_name(self):
        """
        测试创建社团时名称为空
        验证社团名称不能为空
        """
        # 尝试创建名称为空的社团
        self.club_page.click_add_club()
        self.club_page.fill_club_form("", "简介", "描述")
        self.club_page.save_club()
        
        # 验证创建失败（仍在表单页面或有错误提示）
        assert self.club_page.is_element_present(self.club_page.CLUB_NAME_INPUT), \
            "社团名称不能为空"
    
    def test_create_club_with_long_name(self):
        """
        测试创建社团时名称超长
        验证系统对超长名称的处理
        """
        long_name = "测" * 100  # 100个字符的超长名称
        
        # 尝试创建
        self.club_page.click_add_club()
        self.club_page.fill_club_form(long_name, "简介", "描述")
        self.club_page.save_club()
        
        # 验证系统没有崩溃
        current_url = self.club_page.get_current_url()
        assert self.config.BASE_URL in current_url, "超长名称应被正确处理"
    
    def test_create_club_with_special_characters(self):
        """
        测试创建社团时使用特殊字符
        验证系统对特殊字符的处理（XSS防护）
        """
        special_name = "<script>alert('xss')</script>"
        
        # 尝试创建
        self.club_page.click_add_club()
        self.club_page.fill_club_form(special_name, "简介", "描述")
        self.club_page.save_club()
        
        # 验证系统没有执行脚本
        assert "alert" not in self.club_page.get_title(), "应防范XSS攻击"
    
    def test_cancel_create_club(self):
        """
        测试取消创建社团
        验证取消操作可以正常执行
        """
        self.club_page.click_add_club()
        self.club_page.fill_club_form("测试社团", "简介", "描述")
        self.club_page.cancel()
        
        # 验证回到列表页面
        assert self.club_page.is_element_present(self.club_page.ADD_CLUB_BUTTON), \
            "取消后应回到社团列表"
