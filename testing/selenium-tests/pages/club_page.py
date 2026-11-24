# -*- coding: utf-8 -*-
"""
社团管理页面
社团增删改查功能测试
"""
from selenium.webdriver.common.by import By
from .base_page import BasePage
import time


class ClubPage(BasePage):
    """社团管理页面类"""
    
    URL = '/admin/clubs'
    
    # 元素定位器
    ADD_CLUB_BUTTON = (By.CSS_SELECTOR, '.btn-add-club')
    CLUB_NAME_INPUT = (By.ID, 'clubName')
    CLUB_SHORT_INTRO_INPUT = (By.ID, 'shortIntro')
    CLUB_DESCRIPTION_INPUT = (By.ID, 'description')
    CLUB_CATEGORY_SELECT = (By.ID, 'category')
    CLUB_LEVEL_SELECT = (By.ID, 'level')
    SAVE_BUTTON = (By.CSS_SELECTOR, '.btn-save')
    CANCEL_BUTTON = (By.CSS_SELECTOR, '.btn-cancel')
    
    # 列表元素
    CLUB_LIST = (By.CSS_SELECTOR, '.club-list')
    CLUB_ITEMS = (By.CSS_SELECTOR, '.club-item')
    CLUB_NAME_IN_LIST = (By.CSS_SELECTOR, '.club-name')
    EDIT_BUTTON = (By.CSS_SELECTOR, '.btn-edit')
    DELETE_BUTTON = (By.CSS_SELECTOR, '.btn-delete')
    SEARCH_INPUT = (By.ID, 'searchKeyword')
    SEARCH_BUTTON = (By.CSS_SELECTOR, '.btn-search')
    
    # 确认对话框
    CONFIRM_DIALOG = (By.CSS_SELECTOR, '.confirm-dialog')
    CONFIRM_YES = (By.CSS_SELECTOR, '.btn-confirm-yes')
    CONFIRM_NO = (By.CSS_SELECTOR, '.btn-confirm-no')
    
    def load(self):
        """加载社团管理页面"""
        self.open(self.URL)
        time.sleep(2)
    
    def click_add_club(self):
        """点击添加社团按钮"""
        self.click(self.ADD_CLUB_BUTTON)
        time.sleep(1)
    
    def fill_club_form(self, name, short_intro, description, category='学术', level='校级'):
        """
        填写社团表单
        
        Args:
            name: 社团名称
            short_intro: 简短介绍
            description: 详细描述
            category: 分类
            level: 级别
        """
        self.input_text(self.CLUB_NAME_INPUT, name)
        self.input_text(self.CLUB_SHORT_INTRO_INPUT, short_intro)
        self.input_text(self.CLUB_DESCRIPTION_INPUT, description)
        
        # 选择分类
        category_select = self.find_element(self.CLUB_CATEGORY_SELECT)
        category_select.click()
        category_option = self.find_element((By.XPATH, f"//option[text()='{category}']"))
        category_option.click()
        
        # 选择级别
        level_select = self.find_element(self.CLUB_LEVEL_SELECT)
        level_select.click()
        level_option = self.find_element((By.XPATH, f"//option[text()='{level}']"))
        level_option.click()
    
    def save_club(self):
        """保存社团"""
        self.click(self.SAVE_BUTTON)
        time.sleep(2)
    
    def cancel(self):
        """取消操作"""
        self.click(self.CANCEL_BUTTON)
        time.sleep(1)
    
    def search_club(self, keyword):
        """
        搜索社团
        
        Args:
            keyword: 搜索关键词
        """
        self.input_text(self.SEARCH_INPUT, keyword)
        self.click(self.SEARCH_BUTTON)
        time.sleep(2)
    
    def get_club_count(self):
        """
        获取社团数量
        
        Returns:
            int: 社团数量
        """
        items = self.find_elements(self.CLUB_ITEMS)
        return len(items)
    
    def is_club_exists(self, club_name):
        """
        判断社团是否存在
        
        Args:
            club_name: 社团名称
            
        Returns:
            bool: 是否存在
        """
        clubs = self.find_elements(self.CLUB_ITEMS)
        for club in clubs:
            name_element = club.find_element(*self.CLUB_NAME_IN_LIST)
            if club_name in name_element.text:
                return True
        return False
    
    def click_edit_first_club(self):
        """点击编辑第一个社团"""
        edit_buttons = self.find_elements(self.EDIT_BUTTON)
        if edit_buttons:
            edit_buttons[0].click()
            time.sleep(1)
    
    def click_delete_first_club(self):
        """点击删除第一个社团"""
        delete_buttons = self.find_elements(self.DELETE_BUTTON)
        if delete_buttons:
            delete_buttons[0].click()
            time.sleep(1)
    
    def confirm_delete(self):
        """确认删除"""
        if self.is_element_present(self.CONFIRM_DIALOG):
            self.click(self.CONFIRM_YES)
            time.sleep(2)
    
    def cancel_delete(self):
        """取消删除"""
        if self.is_element_present(self.CONFIRM_DIALOG):
            self.click(self.CONFIRM_NO)
            time.sleep(1)
    
    def create_club(self, name, short_intro, description, category='学术', level='校级'):
        """
        创建社团的完整流程
        
        Args:
            name: 社团名称
            short_intro: 简短介绍
            description: 详细描述
            category: 分类
            level: 级别
            
        Returns:
            bool: 是否创建成功
        """
        self.click_add_club()
        self.fill_club_form(name, short_intro, description, category, level)
        self.save_club()
        return self.is_club_exists(name)
