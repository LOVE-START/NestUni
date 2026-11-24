# -*- coding: utf-8 -*-
"""
SQL注入安全测试
测试系统对SQL注入攻击的防护能力
"""
import requests
import json
import sys
import argparse
from urllib.parse import urljoin


class SQLInjectionTester:
    """SQL注入测试类"""
    
    def __init__(self, base_url):
        """
        初始化测试器
        
        Args:
            base_url: 基础URL
        """
        self.base_url = base_url
        self.api_prefix = '/nfunest/api'
        self.results = []
        
        # SQL注入测试载荷
        self.sql_payloads = [
            "' OR '1'='1",
            "' OR '1'='1' --",
            "' OR '1'='1' /*",
            "' OR 1=1 --",
            "' OR 1=1 #",
            "' OR 1=1/*",
            "') OR ('1'='1",
            "') OR ('1'='1') --",
            "'; DROP TABLE users; --",
            "'; DELETE FROM users; --",
            "' UNION SELECT * FROM users --",
            "' UNION SELECT null, username, password FROM users --",
            "admin'--",
            "admin' #",
            "admin'/*",
            "1' AND 1=1 --",
            "1' AND 1=2 --",
            "1' OR '1'='1' LIMIT 1 --",
            "1' AND SLEEP(5) --",
            "1' AND (SELECT * FROM (SELECT(SLEEP(5)))a) --",
        ]
    
    def _get_full_url(self, endpoint):
        """获取完整URL"""
        return urljoin(self.base_url, f"{self.api_prefix}{endpoint}")
    
    def _log_result(self, test_name, payload, endpoint, status_code, response_text, is_vulnerable):
        """记录测试结果"""
        result = {
            'test_name': test_name,
            'payload': payload,
            'endpoint': endpoint,
            'status_code': status_code,
            'response_preview': response_text[:200] if response_text else '',
            'is_vulnerable': is_vulnerable
        }
        self.results.append(result)
        
        status = "漏洞!" if is_vulnerable else "安全"
        print(f"[{status}] {test_name}")
        print(f"  Payload: {payload}")
        print(f"  状态码: {status_code}")
        print()
    
    def test_login_sql_injection(self):
        """测试登录接口SQL注入"""
        print("=" * 50)
        print("测试登录接口SQL注入")
        print("=" * 50)
        
        endpoint = '/auth/login'
        url = self._get_full_url(endpoint)
        
        for payload in self.sql_payloads:
            # 测试用户名注入
            data = {
                'username': payload,
                'password': 'anypassword'
            }
            
            try:
                response = requests.post(url, json=data, timeout=10)
                
                # 检查是否成功登录（不应该成功）
                is_vulnerable = False
                if response.status_code == 200:
                    try:
                        result = response.json()
                        if result.get('success') or result.get('token'):
                            is_vulnerable = True
                    except:
                        pass
                
                # 检查SQL错误信息泄露
                sql_errors = ['sql', 'mysql', 'syntax', 'error in your SQL', 
                             'ORA-', 'PostgreSQL', 'SQLite']
                response_text = response.text.lower()
                for error in sql_errors:
                    if error in response_text:
                        is_vulnerable = True
                        break
                
                self._log_result(
                    f"登录SQL注入-用户名", 
                    payload, 
                    endpoint, 
                    response.status_code,
                    response.text,
                    is_vulnerable
                )
                
            except Exception as e:
                print(f"请求失败: {e}")
    
    def test_search_sql_injection(self):
        """测试搜索接口SQL注入"""
        print("=" * 50)
        print("测试搜索接口SQL注入")
        print("=" * 50)
        
        endpoint = '/clubs'
        url = self._get_full_url(endpoint)
        
        for payload in self.sql_payloads:
            data = {
                'search': payload,
                'page': 1,
                'pageSize': 10
            }
            
            try:
                response = requests.post(url, json=data, timeout=10)
                
                # 检查SQL错误信息泄露
                is_vulnerable = False
                sql_errors = ['sql', 'mysql', 'syntax', 'error in your SQL', 
                             'ORA-', 'PostgreSQL', 'SQLite']
                response_text = response.text.lower()
                for error in sql_errors:
                    if error in response_text:
                        is_vulnerable = True
                        break
                
                self._log_result(
                    f"搜索SQL注入", 
                    payload, 
                    endpoint, 
                    response.status_code,
                    response.text,
                    is_vulnerable
                )
                
            except Exception as e:
                print(f"请求失败: {e}")
    
    def test_id_parameter_injection(self):
        """测试ID参数SQL注入"""
        print("=" * 50)
        print("测试ID参数SQL注入")
        print("=" * 50)
        
        endpoints = [
            '/clubs/',
            '/events/',
            '/announcements/'
        ]
        
        for endpoint in endpoints:
            for payload in self.sql_payloads[:5]:  # 使用部分payload
                url = self._get_full_url(f"{endpoint}{payload}")
                
                try:
                    response = requests.get(url, timeout=10)
                    
                    # 检查SQL错误信息泄露
                    is_vulnerable = False
                    sql_errors = ['sql', 'mysql', 'syntax', 'error in your SQL']
                    response_text = response.text.lower()
                    for error in sql_errors:
                        if error in response_text:
                            is_vulnerable = True
                            break
                    
                    self._log_result(
                        f"ID参数注入-{endpoint}", 
                        payload, 
                        endpoint, 
                        response.status_code,
                        response.text,
                        is_vulnerable
                    )
                    
                except Exception as e:
                    print(f"请求失败: {e}")
    
    def generate_report(self):
        """生成测试报告"""
        print("\n" + "=" * 50)
        print("SQL注入测试报告")
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
                    print(f"  - {result['test_name']}: {result['payload']}")
        else:
            print("未发现SQL注入漏洞，系统防护良好！")
        
        return vulnerable_tests == 0


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='NFUNest SQL注入安全测试')
    parser.add_argument('--url', '-u', default='http://localhost:3001', 
                        help='目标URL')
    
    args = parser.parse_args()
    
    print("NFUNest SQL注入安全测试")
    print(f"目标: {args.url}")
    print()
    
    tester = SQLInjectionTester(args.url)
    
    # 执行测试
    tester.test_login_sql_injection()
    tester.test_search_sql_injection()
    tester.test_id_parameter_injection()
    
    # 生成报告
    is_safe = tester.generate_report()
    
    sys.exit(0 if is_safe else 1)


if __name__ == '__main__':
    main()
