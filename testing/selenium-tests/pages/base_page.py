# -*- coding: utf-8 -*-
"""
基础页面类
所有页面对象的基类，封装通用操作
"""
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time


class BasePage:
    """基础页面类"""
    
    def __init__(self, driver, base_url):
        """
        初始化基础页面
        
        Args:
            driver: WebDriver实例
            base_url: 基础URL
        """
        self.driver = driver
        self.base_url = base_url
        self.wait = WebDriverWait(driver, 20)
    
    def open(self, url):
        """
        打开指定URL
        
        Args:
            url: 要打开的URL
        """
        full_url = f"{self.base_url}{url}" if not url.startswith('http') else url
        self.driver.get(full_url)
    
    def find_element(self, locator, timeout=10):
        """
        查找单个元素
        
        Args:
            locator: 元素定位器 (By.ID, "id") 或 (By.XPATH, "//div")
            timeout: 超时时间
            
        Returns:
            WebElement: 找到的元素
        """
        wait = WebDriverWait(self.driver, timeout)
        return wait.until(EC.presence_of_element_located(locator))
    
    def find_elements(self, locator, timeout=10):
        """
        查找多个元素
        
        Args:
            locator: 元素定位器
            timeout: 超时时间
            
        Returns:
            list: 元素列表
        """
        wait = WebDriverWait(self.driver, timeout)
        return wait.until(EC.presence_of_all_elements_located(locator))
    
    def click(self, locator, timeout=10):
        """
        点击元素
        
        Args:
            locator: 元素定位器
            timeout: 超时时间
        """
        element = self.find_element(locator, timeout)
        element.click()
    
    def input_text(self, locator, text, clear_first=True, timeout=10):
        """
        输入文本
        
        Args:
            locator: 元素定位器
            text: 要输入的文本
            clear_first: 是否先清空
            timeout: 超时时间
        """
        element = self.find_element(locator, timeout)
        if clear_first:
            element.clear()
        element.send_keys(text)
    
    def get_text(self, locator, timeout=10):
        """
        获取元素文本
        
        Args:
            locator: 元素定位器
            timeout: 超时时间
            
        Returns:
            str: 元素文本
        """
        element = self.find_element(locator, timeout)
        return element.text
    
    def is_element_present(self, locator, timeout=5):
        """
        判断元素是否存在
        
        Args:
            locator: 元素定位器
            timeout: 超时时间
            
        Returns:
            bool: 是否存在
        """
        try:
            self.find_element(locator, timeout)
            return True
        except TimeoutException:
            return False
    
    def wait_for_element_visible(self, locator, timeout=10):
        """
        等待元素可见
        
        Args:
            locator: 元素定位器
            timeout: 超时时间
            
        Returns:
            WebElement: 可见的元素
        """
        wait = WebDriverWait(self.driver, timeout)
        return wait.until(EC.visibility_of_element_located(locator))
    
    def wait_for_element_clickable(self, locator, timeout=10):
        """
        等待元素可点击
        
        Args:
            locator: 元素定位器
            timeout: 超时时间
            
        Returns:
            WebElement: 可点击的元素
        """
        wait = WebDriverWait(self.driver, timeout)
        return wait.until(EC.element_to_be_clickable(locator))
    
    def scroll_to_element(self, locator, timeout=10):
        """
        滚动到元素
        
        Args:
            locator: 元素定位器
            timeout: 超时时间
        """
        element = self.find_element(locator, timeout)
        self.driver.execute_script("arguments[0].scrollIntoView();", element)
    
    def take_screenshot(self, filename):
        """
        截图
        
        Args:
            filename: 文件名
        """
        self.driver.save_screenshot(filename)
    
    def get_current_url(self):
        """
        获取当前URL
        
        Returns:
            str: 当前URL
        """
        return self.driver.current_url
    
    def get_title(self):
        """
        获取页面标题
        
        Returns:
            str: 页面标题
        """
        return self.driver.title
    
    def refresh(self):
        """刷新页面"""
        self.driver.refresh()
    
    def back(self):
        """返回上一页"""
        self.driver.back()
    
    def forward(self):
        """前进"""
        self.driver.forward()
    
    def switch_to_frame(self, frame_reference):
        """
        切换到iframe
        
        Args:
            frame_reference: iframe索引、名称或元素
        """
        self.driver.switch_to.frame(frame_reference)
    
    def switch_to_default_content(self):
        """切换到默认内容"""
        self.driver.switch_to.default_content()
    
    def accept_alert(self):
        """接受警告框"""
        self.driver.switch_to.alert.accept()
    
    def dismiss_alert(self):
        """取消警告框"""
        self.driver.switch_to.alert.dismiss()
    
    def get_alert_text(self):
        """
        获取警告框文本
        
        Returns:
            str: 警告框文本
        """
        return self.driver.switch_to.alert.text
