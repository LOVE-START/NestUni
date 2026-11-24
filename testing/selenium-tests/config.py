# -*- coding: utf-8 -*-
"""
Selenium测试配置文件
包含测试环境配置、URL配置、账号配置等
"""
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

class TestConfig:
    """测试配置类"""
    
    # 基础URL配置
    BASE_URL = os.getenv('NFU_BASE_URL', 'http://localhost:3001')
    API_PREFIX = os.getenv('NFU_API_PREFIX', '/nfunest/api')
    ADMIN_URL = os.getenv('NFU_ADMIN_URL', 'http://localhost:3001/admin')
    
    # 浏览器配置
    BROWSER = os.getenv('NFU_BROWSER', 'chrome')
    HEADLESS = os.getenv('NFU_HEADLESS', 'false').lower() == 'true'
    WINDOW_SIZE = (1920, 1080)
    IMPLICIT_WAIT = 10
    EXPLICIT_WAIT = 20
    
    # 测试账号配置
    ADMIN_USERNAME = os.getenv('NFU_ADMIN_USER', 'admin')
    ADMIN_PASSWORD = os.getenv('NFU_ADMIN_PASS', '')
    TEACHER_USERNAME = os.getenv('NFU_TEACHER_USER', '')
    TEACHER_PASSWORD = os.getenv('NFU_TEACHER_PASS', '')
    
    # 测试数据
    TEST_CLUB_NAME = '测试社团'
    TEST_EVENT_TITLE = '测试活动'
    TEST_ANNOUNCEMENT_TITLE = '测试公告'
    
    # 截图配置
    SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), 'screenshots')
    
    # 日志配置
    LOG_LEVEL = os.getenv('NFU_LOG_LEVEL', 'INFO')
    LOG_DIR = os.path.join(os.path.dirname(__file__), 'logs')


class APIEndpoints:
    """API端点配置"""
    
    @staticmethod
    def get_full_url(endpoint):
        """获取完整URL"""
        config = TestConfig()
        return f"{config.BASE_URL}{config.API_PREFIX}{endpoint}"
    
    # 认证相关
    AUTH_LOGIN = '/auth/login'
    AUTH_PROFILE = '/auth/profile'
    
    # 社团相关
    CLUBS_LIST = '/clubs'
    CLUB_DETAIL = '/clubs/{id}'
    CLUB_CREATE = '/clubs'
    CLUB_UPDATE = '/clubs/{id}'
    CLUB_DELETE = '/clubs/{id}'
    
    # 活动相关
    EVENTS_LIST = '/events'
    EVENT_DETAIL = '/events/{id}'
    EVENT_CREATE = '/events'
    EVENT_UPDATE = '/events/{id}'
    EVENT_DELETE = '/events/{id}'
    
    # 公告相关
    ANNOUNCEMENTS_LIST = '/announcements'
    ANNOUNCEMENT_DETAIL = '/announcements/{id}'
    ANNOUNCEMENT_CREATE = '/announcements'
    
    # 审核相关
    APPROVALS_LIST = '/approvals'
    APPROVAL_DETAIL = '/approvals/{id}'
    APPROVAL_APPROVE = '/approvals/{id}/approve'
    APPROVAL_REJECT = '/approvals/{id}/reject'
    
    # 统计相关
    STATS_DASHBOARD = '/stats/dashboard'
    STATS_CLUBS = '/stats/clubs'
    STATS_EVENTS = '/stats/events'
