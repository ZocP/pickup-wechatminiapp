const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/tmp/test-screenshots';
const results = {};

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshot(miniProgram, name) {
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  await miniProgram.screenshot({ path: p });
  console.log(`📸 Screenshot: ${p}`);
  return p;
}

async function main() {
  console.log('Connecting to DevTools...');
  const miniProgram = await automator.launch({
    projectPath: '/Users/kj/projects/pickup-wechatminiapp',
  });
  console.log('✅ Connected');

  try {
    // === Test 2: Dashboard loads (switchTab for tabbar pages) ===
    console.log('\n--- Test 2: Dashboard ---');
    let dashPage = await miniProgram.switchTab('/pages/admin/dashboard/index');
    await dashPage.waitFor(3000);
    dashPage = await miniProgram.currentPage();
    console.log('Dashboard path:', dashPage.path);
    const dashData = await dashPage.data();
    console.log('Dashboard data keys:', Object.keys(dashData).join(', '));
    console.log('Dashboard data (full):', JSON.stringify(dashData, null, 2));
    await screenshot(miniProgram, '02-dashboard');
    results.dashboard = { status: 'PASS', path: dashPage.path, dataKeys: Object.keys(dashData) };

    // === Test 5: Dashboard "全部" button check ===
    console.log('\n--- Test 5: Dashboard 全部 button ---');
    const filterKeys = Object.keys(dashData).filter(k => 
      k.toLowerCase().includes('filter') || 
      k.toLowerCase().includes('all') ||
      k.toLowerCase().includes('shift')
    );
    console.log('Filter/shift-related data keys:', filterKeys);
    filterKeys.forEach(k => console.log(`  ${k}: ${JSON.stringify(dashData[k])}`));

    // Try to find 全部 navigation button
    let allBtnFound = false;
    let allBtnText = '';
    const selectors = [
      '.filter-reset', '.btn-all', '.view-all', '.all-btn', '.tab-all',
      '[data-type="all"]', '.shifts-header-link', '.dashboard-all-link',
      '.section-more', '.more-btn', '.nav-all'
    ];
    for (const sel of selectors) {
      try {
        const el = await dashPage.$(sel);
        if (el) {
          allBtnText = await el.text();
          console.log(`Found element "${sel}": "${allBtnText}"`);
          allBtnFound = true;
          break;
        }
      } catch(e) {}
    }
    
    // Also check if there's a navigateToAllShifts binding or similar in data
    const allShiftsKeys = Object.keys(dashData).filter(k => 
      k.toLowerCase().includes('allshift') || 
      k.toLowerCase().includes('navigate') ||
      k.toLowerCase().includes('goto')
    );
    console.log('AllShifts/navigate keys:', allShiftsKeys);
    
    await screenshot(miniProgram, '05-dashboard-allbtn');
    results.dashboardAllBtn = { 
      status: 'CHECKED', 
      filterDataKeys: filterKeys,
      allBtnFound,
      allBtnText,
      note: allBtnFound ? `Button found: "${allBtnText}"` : 'No button found with common selectors'
    };

    // === Test 6: FAB / Pending pool toggle ===
    console.log('\n--- Test 6: Pending pool toggle / FAB ---');
    const fabSelectors = [
      '.fab-area', '.fab-container', '.fab-wrapper', '.fab',
      '.pending-toggle', '.toggle-pill', '.pending-pool-toggle',
      '.fab-btn', '.filter-toggle', '.today-toggle',
    ];
    let fabFound = false;
    let fabText = '';
    for (const sel of fabSelectors) {
      try {
        const el = await dashPage.$(sel);
        if (el) {
          fabText = await el.text();
          console.log(`Found FAB element "${sel}": "${fabText}"`);
          fabFound = true;
          break;
        }
      } catch(e) {}
    }
    if (!fabFound) {
      console.log('FAB not found with common selectors, checking data...');
      const toggleKeys = Object.keys(dashData).filter(k => 
        k.toLowerCase().includes('toggle') || 
        k.toLowerCase().includes('pending') ||
        k.toLowerCase().includes('show') ||
        k.toLowerCase().includes('fab') ||
        k.toLowerCase().includes('today') ||
        k.toLowerCase().includes('overflow')
      );
      console.log('Toggle/pending data keys:', toggleKeys);
      toggleKeys.forEach(k => console.log(`  ${k}: ${JSON.stringify(dashData[k])}`));
    }
    await screenshot(miniProgram, '06-fab-area');
    results.pendingToggle = { 
      status: fabFound ? 'PASS' : 'CHECKED-NO-FAB',
      fabText,
      note: fabFound ? `FAB found: "${fabText}"` : 'FAB selector not matched, check data keys'
    };

    // === Test 3: All-Shifts page ===
    console.log('\n--- Test 3: All-Shifts Page ---');
    const allShiftsPage = await miniProgram.navigateTo('/pages/admin/all-shifts/index');
    await allShiftsPage.waitFor(4000);
    const currentAllShiftsPage = await miniProgram.currentPage();
    console.log('All-shifts path:', currentAllShiftsPage.path);
    const allShiftsData = await currentAllShiftsPage.data();
    console.log('All-shifts data:', JSON.stringify(allShiftsData, null, 2));
    await screenshot(miniProgram, '03-all-shifts');
    results.allShifts = {
      status: currentAllShiftsPage.path.includes('all-shifts') ? 'PASS' : 'FAIL',
      path: currentAllShiftsPage.path,
      dataKeys: Object.keys(allShiftsData),
    };

    // === Test 4: Tab filtering ===
    console.log('\n--- Test 4: Tab State ---');
    const tabData = {
      activeTab: allShiftsData.activeTab,
      allCount: allShiftsData.allCount,
      publishedCount: allShiftsData.publishedCount,
      draftCount: allShiftsData.draftCount,
      shifts: Array.isArray(allShiftsData.shifts) ? allShiftsData.shifts.length : 'N/A',
      sortBy: allShiftsData.sortBy,
    };
    console.log('Tab data:', JSON.stringify(tabData, null, 2));
    
    const hasTabData = tabData.allCount !== undefined || tabData.activeTab !== undefined;
    const hasReasonableCounts = (tabData.allCount > 0) || (allShiftsData.shifts && allShiftsData.shifts.length > 0);
    results.tabFiltering = {
      status: hasTabData ? 'PASS' : 'FAIL',
      data: tabData,
      note: hasReasonableCounts ? 'Has shift data' : 'No shifts loaded (may be login/seed issue)'
    };

    // Click 已发布 tab
    try {
      const tabs = await currentAllShiftsPage.$$('.tab-item');
      console.log('Tab items found:', tabs.length);
      if (tabs.length >= 2) {
        await tabs[1].tap();
        await currentAllShiftsPage.waitFor(1500);
        await screenshot(miniProgram, '04-tab-published');
        const afterData = await currentAllShiftsPage.data();
        console.log('After tab[1] click - activeTab:', afterData.activeTab);
        results.tabFiltering.afterClickPublished = { activeTab: afterData.activeTab };
      }
      if (tabs.length >= 3) {
        await tabs[2].tap();
        await currentAllShiftsPage.waitFor(1500);
        await screenshot(miniProgram, '04-tab-draft');
        const afterData2 = await currentAllShiftsPage.data();
        console.log('After tab[2] click - activeTab:', afterData2.activeTab);
        results.tabFiltering.afterClickDraft = { activeTab: afterData2.activeTab };
      }
    } catch(e) {
      console.log('Tab click error:', e.message);
      results.tabFiltering.tabClickError = e.message;
    }

    // Also check sort dropdown
    try {
      const sortEl = await currentAllShiftsPage.$('.sort-dropdown, .sort-btn, .sort-select, picker');
      if (sortEl) {
        const sortText = await sortEl.text();
        console.log('Sort element found:', sortText);
        results.allShifts.sortFound = true;
        results.allShifts.sortText = sortText;
      }
    } catch(e) {}

    await screenshot(miniProgram, '03b-all-shifts-final');

  } finally {
    console.log('\n=== FINAL RESULTS ===');
    console.log(JSON.stringify(results, null, 2));
    await miniProgram.close();
    console.log('✅ Done');
  }
}

main().catch(e => {
  console.error('FATAL:', e.message, e.stack);
  process.exit(1);
});
