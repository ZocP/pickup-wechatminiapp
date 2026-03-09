const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = '/tmp/test-screenshots';
const PROJECT = '/Users/kj/projects/pickup-wechatminiapp';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  let miniProgram;
  try {
    console.log('Launching automator...');
    miniProgram = await automator.launch({
      projectPath: PROJECT,
    });
    console.log('Connected');

    // Navigate to all-shifts page
    console.log('Navigating to all-shifts page...');
    const page = await miniProgram.navigateTo('/pages/admin/all-shifts/index');
    await sleep(3000);

    // Take initial screenshot
    const screenshotPath = path.join(SCREENSHOT_DIR, `all-shifts-initial-${Date.now()}.png`);
    await miniProgram.screenshot({ path: screenshotPath });
    console.log(`Screenshot: ${screenshotPath}`);

    // Get page data
    const data = await page.data();
    console.log('=== page.data() ===');
    console.log(JSON.stringify({
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
      hasMore: data.hasMore,
      allShiftsLength: data.allShifts ? data.allShifts.length : 'MISSING',
    }, null, 2));

    // Verify
    const checks = [];
    checks.push({ name: 'page field exists', pass: data.page !== undefined, actual: data.page });
    checks.push({ name: 'pageSize field exists', pass: data.pageSize !== undefined, actual: data.pageSize });
    checks.push({ name: 'total field exists', pass: data.total !== undefined, actual: data.total });
    checks.push({ name: 'hasMore field exists', pass: data.hasMore !== undefined, actual: data.hasMore });
    checks.push({ name: 'allShifts exists', pass: Array.isArray(data.allShifts), actual: typeof data.allShifts });
    if (Array.isArray(data.allShifts)) {
      checks.push({ name: 'allShifts.length <= 20', pass: data.allShifts.length <= 20, actual: data.allShifts.length });
    }
    checks.push({ name: 'page == 1', pass: data.page === 1, actual: data.page });

    console.log('\n=== Verification ===');
    let allPass = true;
    for (const c of checks) {
      const status = c.pass ? 'PASS' : 'FAIL';
      if (!c.pass) allPass = false;
      console.log(`[${status}] ${c.name}: ${c.actual}`);
    }

    console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
    process.exit(allPass ? 0 : 1);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    if (miniProgram) {
      try { await miniProgram.close(); } catch(e) {}
    }
  }
})();
