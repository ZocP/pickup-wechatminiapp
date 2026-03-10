const { TestFramework } = require('./framework');

async function verifyOverflowFix() {
  const fw = new TestFramework();
  await fw.connect();
  
  try {
    // 1. 导航到 dashboard
    await fw.reLaunch('/pages/admin/dashboard/index');
    const page = await fw.getCurrentPage();
    
    // 2. 截图 - 整体布局（修复前状态）
    await fw.screenshot('dashboard-filter-bar');
    
    // 3. 检查日期筛选栏元素是否存在
    const filterBar = await page.$('.date-filter-bar') || await page.$('.filter-bar');
    console.log('date-filter-bar 存在:', !!filterBar);
    
    const datePicker = await page.$('.filter-date-label') 
      || await page.$('.date-picker') 
      || await page.$('.current-date');
    console.log('date label 存在:', !!datePicker);
    
    const prevBtn = await page.$('.filter-nav-btn');
    console.log('导航按钮存在:', !!prevBtn);
    
    const actionBtn = await page.$('.filter-action-btn');
    console.log('action 按钮 (today/all) 存在:', !!actionBtn);
    
    // 4. 获取 page data
    try {
      const data = await fw.getData();
      console.log('filterDate:', data.filterDate);
      console.log('filterDateLabel:', data.filterDateLabel);
      console.log('todayDate:', data.todayDate);
    } catch(e) {
      console.log('(data() 获取失败:', e.message, ')');
    }
    
    // 5. 修复后截图存档
    await fw.screenshot('dashboard-after-fix');
    
    // 判断结果
    if (filterBar && datePicker) {
      console.log('\n✅ PASS: datepicker 可见，布局正常');
    } else {
      console.log('\n❌ FAIL: datepicker 仍然不可见');
      if (!filterBar) console.log('  - date-filter-bar 容器未找到');
      if (!datePicker) console.log('  - date label 元素未找到');
      process.exitCode = 1;
    }
  } finally {
    await fw.close();
  }
}

verifyOverflowFix().catch(e => {
  console.error('❌ 测试执行失败:', e.message);
  process.exit(1);
});
