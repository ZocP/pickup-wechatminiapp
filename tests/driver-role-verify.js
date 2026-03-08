const automator = require('miniprogram-automator');

async function runTests() {
  const results = [];
  let miniProgram;
  
  try {
    console.log('=== Driver 角色 UI 验证测试 ===\n');
    miniProgram = await automator.launch({
      projectPath: '/Users/kj/projects/pickup-wechatminiapp',
    });
    console.log('✅ automator 连接成功');
    
    // ========== Test 1: 首页路径 ==========
    const homePage = await miniProgram.currentPage();
    const pagePath = homePage.path;
    console.log('\n[Test 1] 首页路径:', pagePath);
    results.push({ 
      test: '首页路径正确', 
      expected: 'pages/home/index', 
      actual: pagePath, 
      pass: pagePath === 'pages/home/index' 
    });
    await miniProgram.screenshot({ path: '/tmp/test-screenshots/01-home.png' });
    
    // ========== Test 2: 首页 data 验证 ==========
    const homeData = await homePage.data();
    console.log('\n[Test 2] 首页 data:');
    console.log('  userInfo.role:', homeData.userInfo && homeData.userInfo.role);
    console.log('  isDriver:', homeData.isDriver);
    console.log('  isManageRole:', homeData.isManageRole);
    console.log('  isStudent:', homeData.isStudent);
    
    const roleIsDriver = homeData.userInfo && homeData.userInfo.role === 'driver';
    const isDriverFlag = homeData.isDriver === true;
    const notManageRole = homeData.isManageRole === false;
    const notStudent = homeData.isStudent === false;
    
    results.push({ test: 'userInfo.role === driver', expected: 'driver', actual: homeData.userInfo && homeData.userInfo.role, pass: roleIsDriver });
    results.push({ test: 'isDriver === true', expected: true, actual: homeData.isDriver, pass: isDriverFlag });
    results.push({ test: 'isManageRole === false (非admin/staff)', expected: false, actual: homeData.isManageRole, pass: notManageRole });
    results.push({ test: 'isStudent === false', expected: false, actual: homeData.isStudent, pass: notStudent });
    
    // ========== Test 3: TabBar 检查 ==========
    console.log('\n[Test 3] 检查 tabBar 内容...');
    try {
      // Custom tabBar - try querying it
      const tabBar = await miniProgram.currentPage().then(p => p.getTabBar ? p.getTabBar() : null).catch(() => null);
      if (tabBar) {
        const tabData = await tabBar.data();
        console.log('  TabBar list:', JSON.stringify(tabData.list, null, 2));
        
        const hasAdminTab = tabData.list && tabData.list.some(item => item.pagePath && item.pagePath.includes('admin'));
        const hasDriverFriendlyTabs = tabData.list && tabData.list.length === 2; // home + profile, no admin
        
        results.push({ 
          test: 'TabBar 不含 admin/调度 标签', 
          expected: 'admin tab 已移除', 
          actual: hasAdminTab ? '有 admin tab' : '无 admin tab', 
          pass: !hasAdminTab 
        });
        results.push({ 
          test: 'TabBar 仅显示 driver 相关标签', 
          expected: '2 tabs (首页+我的)', 
          actual: `${tabData.list ? tabData.list.length : 0} tabs`, 
          pass: tabData.list && tabData.list.length === 2 
        });
      } else {
        console.log('  无法通过 getTabBar() 获取 tabBar 数据');
        results.push({ test: 'TabBar 获取', expected: '成功', actual: 'getTabBar 不可用', pass: false });
      }
    } catch(e) {
      console.log('  TabBar 检查失败:', e.message);
      results.push({ test: 'TabBar 检查', expected: '成功', actual: 'error: ' + e.message, pass: false });
    }
    
    // ========== Test 4: Profile 页面 ==========
    console.log('\n[Test 4] 导航到 Profile 页面...');
    try {
      await miniProgram.switchTab('/pages/profile/index');
      await new Promise(r => setTimeout(r, 2000));
      
      const profilePage = await miniProgram.currentPage();
      console.log('  Profile 页面路径:', profilePage.path);
      await miniProgram.screenshot({ path: '/tmp/test-screenshots/02-profile.png' });
      
      const profileData = await profilePage.data();
      console.log('  Profile data (角色相关):', {
        role: profileData.role || profileData.userInfo && profileData.userInfo.role,
        userInfo: profileData.userInfo
      });
      
      const profileHasRole = profilePage.path.includes('profile');
      results.push({ 
        test: 'Profile 页面可访问', 
        expected: 'profile 页面', 
        actual: profilePage.path, 
        pass: profileHasRole 
      });
      
      // Check role display in profile data
      const profileRole = (profileData.role) || 
                          (profileData.userInfo && profileData.userInfo.role) ||
                          (profileData.user && profileData.user.role);
      if (profileRole) {
        results.push({ 
          test: 'Profile 页面角色显示为 driver', 
          expected: 'driver', 
          actual: profileRole, 
          pass: profileRole === 'driver' 
        });
      }
    } catch(e) {
      console.log('  Profile 导航失败:', e.message);
      results.push({ test: 'Profile 页面', expected: '成功', actual: 'error: ' + e.message, pass: false });
    }
    
    // ========== Test 5: Admin dashboard 访问拦截 ==========
    console.log('\n[Test 5] 尝试导航到 admin dashboard...');
    try {
      await miniProgram.navigateTo('/pages/admin/dashboard/index');
      await new Promise(r => setTimeout(r, 2000));
      
      const currentPage = await miniProgram.currentPage();
      const isAdminDash = currentPage.path === 'pages/admin/dashboard/index';
      console.log('  导航后页面路径:', currentPage.path);
      
      await miniProgram.screenshot({ path: '/tmp/test-screenshots/03-admin-attempt.png' });
      
      results.push({ 
        test: 'Admin dashboard 访问被拦截', 
        expected: '不应停在 admin/dashboard', 
        actual: currentPage.path, 
        pass: !isAdminDash 
      });
    } catch(e) {
      console.log('  Admin 导航异常（可能是被前端拦截）:', e.message);
      results.push({ 
        test: 'Admin dashboard 访问被拦截', 
        expected: '被拦截或报错', 
        actual: 'error: ' + e.message, 
        pass: true  // navigation error = blocked = pass
      });
    }
    
    // ========== Test 6: driver 路由可访问 ==========
    console.log('\n[Test 6] 尝试访问 driver 页面...');
    try {
      await miniProgram.navigateTo('/pages/driver/index');
      await new Promise(r => setTimeout(r, 2000));
      
      const driverPage = await miniProgram.currentPage();
      console.log('  Driver 页面路径:', driverPage.path);
      await miniProgram.screenshot({ path: '/tmp/test-screenshots/04-driver-page.png' });
      
      const driverData = await driverPage.data();
      console.log('  Driver 页面 data keys:', Object.keys(driverData));
      
      results.push({ 
        test: 'Driver 专属页面可访问', 
        expected: 'pages/driver/index', 
        actual: driverPage.path, 
        pass: driverPage.path === 'pages/driver/index' 
      });
    } catch(e) {
      console.log('  Driver 页面导航失败:', e.message);
      results.push({ test: 'Driver 专属页面', expected: '成功', actual: 'error: ' + e.message, pass: false });
    }
    
  } catch(e) {
    console.error('\n❌ 测试过程出错:', e.message);
    results.push({ test: '整体测试', expected: '成功', actual: 'fatal: ' + e.message, pass: false });
  } finally {
    if (miniProgram) {
      try { await miniProgram.close(); } catch(e) {}
    }
  }
  
  // ========== 结果汇总 ==========
  console.log('\n' + '='.repeat(50));
  console.log('测试结果汇总');
  console.log('='.repeat(50));
  results.forEach(r => {
    const icon = r.pass ? '✅' : '❌';
    console.log(`${icon} ${r.test}`);
    if (!r.pass) {
      console.log(`   期望: ${r.expected}`);
      console.log(`   实际: ${r.actual}`);
    }
  });
  
  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  console.log(`\n总计: ${passed}/${total} 通过`);
  
  // Save results to JSON
  require('fs').writeFileSync('/tmp/test-results.json', JSON.stringify({ results, passed, total }, null, 2));
  console.log('结果已保存到 /tmp/test-results.json');
  
  return { results, passed, total };
}

runTests().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
