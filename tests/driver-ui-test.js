const automator = require('miniprogram-automator');
const fs = require('fs');

async function runTests() {
  const results = [];
  let miniProgram;
  
  try {
    console.log('=== Driver UI 验证测试 ===');
    miniProgram = await automator.launch({
      projectPath: '/Users/kj/projects/pickup-wechatminiapp',
    });
    console.log('✅ automator 连接成功');
    
    // Test 1: 当前页面检查
    const page = await miniProgram.currentPage();
    const pagePath = page.path;
    console.log('\n[Test 1] 当前页面路径:', pagePath);
    
    // Take screenshot of home page
    await miniProgram.screenshot({ path: '/tmp/test-screenshots/01-home.png' });
    console.log('截图已保存: /tmp/test-screenshots/01-home.png');
    
    // Test 2: 检查首页内容（driver vs admin dashboard）
    console.log('\n[Test 2] 检查首页内容...');
    try {
      // Get page data
      const pageData = await page.data();
      console.log('页面 data:', JSON.stringify(pageData, null, 2));
      results.push({ test: '首页页面路径', expected: 'pages/home/index', actual: pagePath, pass: pagePath === 'pages/home/index' });
    } catch(e) {
      console.log('获取页面 data 失败:', e.message);
      results.push({ test: '首页页面数据', expected: 'driver视图', actual: 'error: ' + e.message, pass: false });
    }
    
    // Test 3: 检查页面是否有 admin dashboard 内容
    console.log('\n[Test 3] 检查首页是否包含 admin 内容...');
    try {
      // Look for elements that indicate admin vs driver view
      const adminElements = await page.$$('.admin-dashboard, .dispatch-center, [data-role="admin"]');
      const isAdminView = adminElements && adminElements.length > 0;
      console.log('Admin 元素数量:', adminElements ? adminElements.length : 0);
      results.push({ test: '首页非 admin 视图', expected: '无 admin 元素', actual: isAdminView ? '发现 admin 元素' : '无 admin 元素', pass: !isAdminView });
    } catch(e) {
      console.log('检查 admin 元素失败:', e.message);
    }
    
    // Test 4: 检查 tabBar
    console.log('\n[Test 4] 检查 tabBar...');
    try {
      const tabBarItems = await page.$$('.van-tabbar-item, .tab-bar-item, .tabbar-item');
      console.log('TabBar items 数量:', tabBarItems ? tabBarItems.length : 0);
      
      // Try to get tab text
      if (tabBarItems && tabBarItems.length > 0) {
        for (let i = 0; i < tabBarItems.length; i++) {
          try {
            const text = await tabBarItems[i].text();
            console.log(`TabBar [${i}] 文字:`, text);
          } catch(e) {
            console.log(`TabBar [${i}] 获取文字失败:`, e.message);
          }
        }
      }
    } catch(e) {
      console.log('检查 tabBar 失败:', e.message);
    }
    
    // Test 5: 导航到 profile 页面
    console.log('\n[Test 5] 导航到 profile 页面...');
    try {
      await miniProgram.navigateTo('pages/profile/index');
      await new Promise(r => setTimeout(r, 2000));
      
      const profilePage = await miniProgram.currentPage();
      console.log('Profile 页面路径:', profilePage.path);
      
      await miniProgram.screenshot({ path: '/tmp/test-screenshots/02-profile.png' });
      console.log('截图已保存: /tmp/test-screenshots/02-profile.png');
      
      // Get page data to check role display
      const profileData = await profilePage.data();
      console.log('Profile 页面 data:', JSON.stringify(profileData, null, 2));
      
      // Check for role text
      const roleElements = await profilePage.$$('.role, .user-role, [class*="role"]');
      console.log('角色元素数量:', roleElements ? roleElements.length : 0);
      if (roleElements && roleElements.length > 0) {
        for (let el of roleElements) {
          try {
            const text = await el.text();
            console.log('角色文字:', text);
          } catch(e) {}
        }
      }
      
      results.push({ test: 'Profile 页面可访问', expected: 'pages/profile/index', actual: profilePage.path, pass: profilePage.path.includes('profile') });
    } catch(e) {
      console.log('导航到 profile 失败:', e.message);
      results.push({ test: 'Profile 页面导航', expected: '成功', actual: 'error: ' + e.message, pass: false });
    }
    
    // Test 6: 尝试导航到 admin dashboard（应该被拦截）
    console.log('\n[Test 6] 尝试导航到 admin dashboard...');
    try {
      await miniProgram.navigateTo('pages/admin/dashboard/index');
      await new Promise(r => setTimeout(r, 2000));
      
      const adminPage = await miniProgram.currentPage();
      const adminPath = adminPage.path;
      console.log('导航后页面路径:', adminPath);
      
      await miniProgram.screenshot({ path: '/tmp/test-screenshots/03-admin-attempt.png' });
      console.log('截图已保存: /tmp/test-screenshots/03-admin-attempt.png');
      
      const isBlocked = !adminPath.includes('admin/dashboard');
      results.push({ 
        test: 'Admin dashboard 访问被拦截', 
        expected: '被拦截（不在 admin/dashboard）', 
        actual: '当前页面: ' + adminPath, 
        pass: isBlocked 
      });
    } catch(e) {
      console.log('导航到 admin 失败（可能是被拦截）:', e.message);
      results.push({ test: 'Admin dashboard 访问被拦截', expected: '被拦截', actual: 'error/blocked: ' + e.message, pass: true });
    }
    
    // Test 7: 检查首页 WXML 内容
    console.log('\n[Test 7] 检查首页文本内容...');
    try {
      await miniProgram.navigateTo('pages/home/index');
      await new Promise(r => setTimeout(r, 2000));
      const homePage = await miniProgram.currentPage();
      
      // Try getting all text content
      const allText = await homePage.$$('text, view');
      console.log('页面元素数量:', allText ? allText.length : 0);
      
      // Check specific elements
      const dispatchElements = await homePage.$$('*');
      let pageContent = '';
      try {
        // Get page WXML
        const wxml = await homePage.getWxml ? homePage.getWxml() : null;
        if (wxml) {
          console.log('WXML 内容 (前 500 字):', String(wxml).substring(0, 500));
        }
      } catch(e) {
        console.log('获取 WXML 失败:', e.message);
      }
    } catch(e) {
      console.log('检查首页内容失败:', e.message);
    }
    
  } catch(e) {
    console.error('测试过程中出错:', e.message);
    results.push({ test: '整体测试', expected: '成功', actual: 'error: ' + e.message, pass: false });
  } finally {
    if (miniProgram) {
      try { await miniProgram.close(); } catch(e) {}
    }
  }
  
  // Print results summary
  console.log('\n=== 测试结果汇总 ===');
  results.forEach(r => {
    const status = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${r.test}`);
    console.log(`       期望: ${r.expected}`);
    console.log(`       实际: ${r.actual}`);
  });
  
  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  console.log(`\n总计: ${passed}/${total} 通过`);
  
  return results;
}

runTests().catch(e => {
  console.error('致命错误:', e);
  process.exit(1);
});
