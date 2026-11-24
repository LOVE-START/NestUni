# -*- coding: utf-8 -*-
"""
Pytest配置文件
包含fixture定义和测试钩子函数
"""
import pytest
import os
import time
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.edge.service import Service as EdgeService
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.firefox import GeckoDriverManager
from webdriver_manager.microsoft import EdgeChromiumDriverManager
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.edge.options import Options as EdgeOptions

from config import TestConfig


def pytest_configure(config):
    """配置pytest"""
    os.makedirs(TestConfig.SCREENSHOT_DIR, exist_ok=True)
    os.makedirs(TestConfig.LOG_DIR, exist_ok=True)


@pytest.fixture(scope="session")
def config():
    """提供测试配置"""
    return TestConfig()


@pytest.fixture(scope="function")
def driver(config):
    """创建WebDriver实例"""
    browser = config.BROWSER.lower()
    headless = config.HEADLESS
    
    if browser == 'chrome':
        options = ChromeOptions()
        if headless:
            options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument(f'--window-size={config.WINDOW_SIZE[0]},{config.WINDOW_SIZE[1]}')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-extensions')
        
        service = ChromeService(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        
    elif browser == 'firefox':
        options = FirefoxOptions()
        if headless:
            options.add_argument('--headless')
        options.add_argument(f'--width={config.WINDOW_SIZE[0]}')
        options.add_argument(f'--height={config.WINDOW_SIZE[1]}')
        
        service = FirefoxService(GeckoDriverManager().install())
        driver = webdriver.Firefox(service=service, options=options)
        
    elif browser == 'edge':
        options = EdgeOptions()
        if headless:
            options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument(f'--window-size={config.WINDOW_SIZE[0]},{config.WINDOW_SIZE[1]}')
        
        service = EdgeService(EdgeChromiumDriverManager().install())
        driver = webdriver.Edge(service=service, options=options)
    else:
        raise ValueError(f"不支持的浏览器: {browser}")
    
    driver.implicitly_wait(config.IMPLICIT_WAIT)
    yield driver
    driver.quit()


@pytest.fixture(scope="function")
def logged_in_driver(driver, config):
    """提供已登录的WebDriver"""
    from pages.login_page import LoginPage
    
    login_page = LoginPage(driver, config.BASE_URL)
    login_page.load()
    login_page.login(config.ADMIN_USERNAME, config.ADMIN_PASSWORD)
    assert login_page.is_logged_in(), "登录失败"
    
    yield driver
    
    try:
        login_page.logout()
    except:
        pass


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """测试失败时自动截图"""
    outcome = yield
    report = outcome.get_result()
    
    if report.when == "call" and report.failed:
        driver = item.funcargs.get('driver') or item.funcargs.get('logged_in_driver')
        if driver:
            screenshot_dir = TestConfig.SCREENSHOT_DIR
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            test_name = item.name
            screenshot_path = os.path.join(screenshot_dir, f'{test_name}_{timestamp}.png')
            
            try:
                driver.save_screenshot(screenshot_path)
                print(f"\n截图已保存: {screenshot_path}")
            except Exception as e:
                print(f"截图保存失败: {e}")


def pytest_html_report_title(report):
    """设置HTML报告标题"""
    report.title = "NFUNest 自动化测试报告"
