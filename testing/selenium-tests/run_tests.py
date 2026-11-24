# -*- coding: utf-8 -*-
"""
测试执行脚本
用于批量执行Selenium测试
"""
import subprocess
import sys
import os
import argparse
from datetime import datetime


def run_tests(test_path='tests/', browser='chrome', headless=False, parallel=1, html_report=True):
    """
    执行测试
    
    Args:
        test_path: 测试文件路径
        browser: 浏览器类型
        headless: 是否无头模式
        parallel: 并行执行数量
        html_report: 是否生成HTML报告
    """
    # 设置环境变量
    env = os.environ.copy()
    env['NFU_BROWSER'] = browser
    env['NFU_HEADLESS'] = 'true' if headless else 'false'
    
    # 构建pytest命令
    cmd = ['pytest', test_path, '-v']
    
    # 添加并行执行
    if parallel > 1:
        cmd.extend(['-n', str(parallel)])
    
    # 添加HTML报告
    if html_report:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_path = f'reports/report_{timestamp}.html'
        cmd.extend(['--html=' + report_path, '--self-contained-html'])
        print(f"HTML报告将保存至: {report_path}")
    
    # 执行测试
    print(f"开始执行测试...")
    print(f"浏览器: {browser}")
    print(f"无头模式: {headless}")
    print(f"并行数: {parallel}")
    print(f"测试路径: {test_path}")
    print("-" * 50)
    
    result = subprocess.run(cmd, env=env)
    
    return result.returncode


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='NFUNest Selenium测试执行工具')
    parser.add_argument('--path', '-p', default='tests/', help='测试文件路径')
    parser.add_argument('--browser', '-b', default='chrome', 
                        choices=['chrome', 'firefox', 'edge'], help='浏览器类型')
    parser.add_argument('--headless', '-H', action='store_true', help='无头模式')
    parser.add_argument('--parallel', '-n', type=int, default=1, help='并行执行数量')
    parser.add_argument('--no-html', action='store_true', help='不生成HTML报告')
    
    args = parser.parse_args()
    
    # 执行测试
    exit_code = run_tests(
        test_path=args.path,
        browser=args.browser,
        headless=args.headless,
        parallel=args.parallel,
        html_report=not args.no_html
    )
    
    sys.exit(exit_code)


if __name__ == '__main__':
    main()
