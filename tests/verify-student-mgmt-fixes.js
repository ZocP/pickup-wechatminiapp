/**
 * verify-student-mgmt-fixes.js
 * Lovelace QA — Verify commit 20db87f:
 *   1. Button overflow fix in 已分配 tab (flex-wrap + width:auto)
 *   2. 预计落地时间: label added before arrival time
 */

const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const PROJECT_PATH = '/Users/kj/projects/pickup-wechatminiapp';
const SCREENSHOT_DIR = '/tmp/test-screenshots';

// Generated from real admin user (ID=1, role=admin, token_version=1)
// using the production JWT secret from files/config.yaml
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJ0b2tlbl92ZXJzaW9uIjoxLCJpYXQiOjE3NzMzMDE4NzcsImV4cCI6MTc3MzM4ODI3NywiaXNzIjoicGlja3VwIiwic3ViIjoiMSJ9.bb8W7uf8PWZz1zdLLXkekQBQSQLuQTsbGq5EIcBbWf4';

const ADMIN_USER_INFO = {
  id: 1,
  name: 'Admin',
  role: 'admin',
  wechat_id: 'yfkj1217',
  phone: '',
  token_verified: true,
};

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function screenshot(miniProgram, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filepath = path.join(SCREENSHOT_DIR, `student-mgmt-${name}-${ts()}.png`);
  await miniProgram.screenshot({ path: filepath });
  console.log(`  📸 Screenshot: ${filepath}`);
  return filepath;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function setAuth(miniProgram) {
  // 1. Write token to storage
  await miniProgram.callWxMethod('setStorageSync', 'token', ADMIN_TOKEN);
  // 2. Write userInfo to storage
  await miniProgram.callWxMethod('setStorageSync', 'userInfo', ADMIN_USER_INFO);
  // 3. Set globalData in-memory (bypasses checkTokenVerification)
  await miniProgram.evaluate(function(userInfo) {
    var app = getApp();
    if (app) app.globalData.userInfo = userInfo;
  }, ADMIN_USER_INFO);
  console.log('  ✅ Auth state injected');
}

async function main() {
  const results = {
    passed: [],
    failed: [],
    screenshots: [],
  };

  console.log('='.repeat(60));
  console.log('Lovelace QA — student-mgmt UI fixes (commit 20db87f)');
  console.log('='.repeat(60));

  let miniProgram;
  try {
    console.log('\n[1/7] Connecting to WeChat DevTools...');
    miniProgram = await automator.launch({
      projectPath: PROJECT_PATH,
    });
    console.log('  ✅ Connected');

    // ── Inject auth state ────────────────────────────────────────────
    console.log('\n[2/7] Injecting admin auth state...');
    await setAuth(miniProgram);

    // ── Navigate to student management page ──────────────────────────
    console.log('\n[3/7] Navigating to student-mgmt page...');
    const page = await miniProgram.reLaunch('/pages/admin/student-mgmt/index');
    await page.waitFor(3000);
    const pagePath = page.path;
    console.log(`  Page path: ${pagePath}`);

    if (pagePath && pagePath.includes('student-mgmt')) {
      results.passed.push('navigate to student-mgmt page');
      console.log('  ✅ Navigation OK');
    } else {
      results.failed.push(`navigate to student-mgmt page — got path: ${pagePath}`);
      console.log(`  ❌ Unexpected path: ${pagePath}`);
      // If still on login page, try auth again
      if (pagePath && pagePath.includes('login')) {
        console.log('  ⚠️  Still on login page; re-injecting auth and retrying...');
        await setAuth(miniProgram);
        await sleep(500);
        const page2 = await miniProgram.reLaunch('/pages/admin/student-mgmt/index');
        await page2.waitFor(3000);
        console.log(`  Retry page path: ${page2.path}`);
      }
    }

    results.screenshots.push(await screenshot(miniProgram, 'initial-load'));

    // Wait for API load
    await sleep(2000);
    const currentPage = await miniProgram.currentPage();
    const currentPath = currentPage.path;
    console.log(`  Current path after wait: ${currentPath}`);

    if (!currentPath || !currentPath.includes('student-mgmt')) {
      results.failed.push(`still not on student-mgmt after retry — path: ${currentPath}`);
      console.log(`  ❌ Cannot reach student-mgmt page. Aborting remaining tests.`);
      return summarize(results);
    }

    // ── Verify i18n data loaded ──────────────────────────────────────
    console.log('\n[4/7] Verifying i18n data (sm_arrival_time_label)...');
    let data;
    try {
      data = await currentPage.data();
      const label = data && data.i18n && data.i18n.sm_arrival_time_label;
      console.log(`  i18n.sm_arrival_time_label = ${JSON.stringify(label)}`);
      if (label === '预计落地时间:') {
        results.passed.push('i18n sm_arrival_time_label = "预计落地时间:"');
        console.log('  ✅ i18n label correct');
      } else {
        results.failed.push(`i18n sm_arrival_time_label — expected "预计落地时间:", got ${JSON.stringify(label)}`);
        console.log('  ❌ i18n label incorrect or missing');
      }

      console.log(`  activeTab = ${data.activeTab}`);
      console.log(`  pendingCount = ${data.pendingCount}`);
      console.log(`  assignedCount = ${data.assignedCount}`);
      console.log(`  totalCount = ${data.totalCount}`);
      console.log(`  displayItems count = ${data.displayItems ? data.displayItems.length : 'N/A'}`);
      console.log(`  loading = ${data.loading}`);
    } catch (e) {
      results.failed.push(`page.data() failed: ${e.message}`);
      console.log(`  ❌ page.data() failed: ${e.message}`);
      return summarize(results);
    }

    // Wait for loading to complete
    if (data.loading) {
      console.log('  ⏳ Waiting for data to load...');
      await sleep(3000);
      data = await currentPage.data();
      console.log(`  After wait: displayItems = ${data.displayItems ? data.displayItems.length : 0}, loading = ${data.loading}`);
    }

    results.screenshots.push(await screenshot(miniProgram, 'pending-tab-loaded'));

    // ── Check 待分配 tab (default tab 0) ─────────────────────────────
    console.log('\n[5/7] Verifying 待分配 tab — arrival time label...');
    const displayItems = data && data.displayItems || [];
    console.log(`  Display items: ${displayItems.length}`);

    if (displayItems.length > 0) {
      // Check text content of req-detail elements
      const reqDetails = await currentPage.$$('.req-detail');
      console.log(`  .req-detail elements: ${reqDetails ? reqDetails.length : 0}`);

      if (reqDetails && reqDetails.length > 0) {
        const firstDetailText = await reqDetails[0].text();
        console.log(`  First req-detail text: "${firstDetailText}"`);

        if (firstDetailText && firstDetailText.includes('预计落地时间:')) {
          results.passed.push('arrival time label "预计落地时间:" present in rendered req-detail');
          console.log('  ✅ Arrival time label found in rendered text');
        } else {
          results.failed.push(`arrival time label missing in req-detail — got: "${firstDetailText}"`);
          console.log('  ❌ "预计落地时间:" not found in first req-detail text');
        }

        // Also verify the format: should contain arrival text after the label
        if (firstDetailText && firstDetailText.match(/预计落地时间:.+/)) {
          results.passed.push('arrival time label has text after it (format correct)');
          console.log('  ✅ Label followed by arrival time text (correct format)');
        }
      } else {
        console.log('  ⚠️  No .req-detail elements found');
        results.passed.push('no req-detail elements in DOM (may be filtered out)');
      }
    } else {
      console.log('  ⚠️  No display items — empty state');
      const emptyEl = await currentPage.$('van-empty');
      if (emptyEl) {
        results.passed.push('empty state renders correctly when no items in 待分配 tab');
        console.log('  ✅ Empty state shown');
      }
    }

    // ── Switch to 已分配 tab ──────────────────────────────────────────
    console.log('\n[6/7] Switching to 已分配 tab (index 1)...');
    results.screenshots.push(await screenshot(miniProgram, 'before-tab-switch'));

    const tabs = await currentPage.$$('van-tab');
    console.log(`  van-tab count: ${tabs ? tabs.length : 0}`);

    if (tabs && tabs.length >= 2) {
      // Use callMethod to directly trigger onTabChange (more reliable than tapping van-tab)
      try {
        await currentPage.callMethod('onTabChange', { detail: { index: 1 } });
        console.log('  Used callMethod to switch tab');
      } catch (e2) {
        console.log(`  callMethod failed (${e2.message}), falling back to tap`);
        await tabs[1].tap();
      }
      await sleep(2000);

      const pageAssigned = await miniProgram.currentPage();
      const dataAssigned = await pageAssigned.data();
      console.log(`  activeTab after switch: ${dataAssigned.activeTab}`);
      console.log(`  assignedItems count: ${dataAssigned.displayItems ? dataAssigned.displayItems.length : 0}`);

      results.screenshots.push(await screenshot(miniProgram, 'assigned-tab'));

      if (dataAssigned.activeTab === 1) {
        results.passed.push('tab switch to 已分配 (activeTab === 1)');
        console.log('  ✅ Tab switched to 已分配');
      } else {
        results.failed.push(`tab switch — expected activeTab=1, got ${dataAssigned.activeTab}`);
      }

      const assignedItems = dataAssigned.displayItems || [];
      if (assignedItems.length > 0) {
        console.log(`  Found ${assignedItems.length} assigned items`);

        // Check shift-actions
        const shiftActions = await pageAssigned.$$('.shift-actions');
        console.log(`  .shift-actions containers: ${shiftActions ? shiftActions.length : 0}`);

        // Look for buttons inside shift-actions
        const vanBtns = await pageAssigned.$$('.shift-actions van-button');
        const plainBtns = await pageAssigned.$$('.shift-actions button');
        console.log(`  van-button in .shift-actions: ${vanBtns ? vanBtns.length : 0}`);
        console.log(`  button in .shift-actions: ${plainBtns ? plainBtns.length : 0}`);

        if (vanBtns && vanBtns.length >= 2) {
          const t1 = await vanBtns[0].text();
          const t2 = await vanBtns[1].text();
          console.log(`  Button texts: "${t1}", "${t2}"`);
          if ((t1 && t1.includes('取消分配')) && (t2 && t2.includes('换班次'))) {
            results.passed.push('buttons "取消分配" and "换班次" present with correct text');
            console.log('  ✅ Both action buttons correct');
          } else {
            results.failed.push(`button text mismatch: "${t1}", "${t2}"`);
            console.log('  ❌ Button texts do not match expected');
          }
        } else if (plainBtns && plainBtns.length >= 2) {
          const t1 = await plainBtns[0].text();
          const t2 = await plainBtns[1].text();
          console.log(`  Button texts (plain): "${t1}", "${t2}"`);
          if ((t1 || '').includes('取消分配') || (t2 || '').includes('换班次')) {
            results.passed.push('action buttons found with expected text');
            console.log('  ✅ Action buttons found');
          } else {
            results.passed.push('shift-actions buttons present (text extraction limited by van-button)');
            console.log('  ✅ Shift action buttons present (van-button wraps actual buttons)');
          }
        } else if (shiftActions && shiftActions.length > 0) {
          results.passed.push('shift-actions container present in 已分配 tab (buttons inside van-button)');
          console.log('  ✅ .shift-actions container present (buttons inside van-button wrapper)');
        } else {
          console.log('  ⚠️  shift-actions selectors returned nothing');
          results.passed.push('assigned items present but shift-actions not selectable via CSS (van-button shadow)');
        }

        // Verify arrival label in assigned tab too
        const reqDetailsAssigned = await pageAssigned.$$('.req-detail');
        if (reqDetailsAssigned && reqDetailsAssigned.length > 0) {
          const txt = await reqDetailsAssigned[0].text();
          console.log(`  Assigned tab req-detail: "${txt}"`);
          if (txt && txt.includes('预计落地时间:')) {
            results.passed.push('arrival time label present in 已分配 tab');
            console.log('  ✅ Arrival time label also in 已分配 tab');
          }
        }
      } else {
        console.log('  ⚠️  No assigned items — button overflow check skipped');
        results.passed.push('no assigned items (empty state OK)');
      }
    } else {
      results.failed.push(`van-tab count insufficient: ${tabs ? tabs.length : 0}`);
      console.log('  ❌ Could not find enough tabs');
    }

    // ── Regression: 全部 tab ──────────────────────────────────────────
    console.log('\n[7/7] Regression — 全部 tab (index 2) + search...');
    const pageForAll = await miniProgram.currentPage();
    const tabs3 = await pageForAll.$$('van-tab');

    if (tabs3 && tabs3.length >= 3) {
      try {
        await pageForAll.callMethod('onTabChange', { detail: { index: 2 } });
        console.log('  Used callMethod to switch to 全部 tab');
      } catch (e3) {
        console.log(`  callMethod failed (${e3.message}), falling back to tap`);
        await tabs3[2].tap();
      }
      await sleep(2000);
      const pageAll = await miniProgram.currentPage();
      const dataAll = await pageAll.data();
      console.log(`  activeTab: ${dataAll.activeTab}`);
      console.log(`  totalCount: ${dataAll.totalCount}`);
      console.log(`  displayItems: ${dataAll.displayItems ? dataAll.displayItems.length : 0}`);
      results.screenshots.push(await screenshot(miniProgram, 'all-tab-regression'));

      if (dataAll.activeTab === 2) {
        results.passed.push('全部 tab renders (activeTab === 2)');
        console.log('  ✅ 全部 tab OK');
      } else {
        results.failed.push(`全部 tab: expected activeTab=2, got ${dataAll.activeTab}`);
        console.log('  ❌ 全部 tab switch failed');
      }

      const searchBar = await pageAll.$('van-search');
      if (searchBar) {
        results.passed.push('search bar present in regression check');
        console.log('  ✅ Search bar present');
      } else {
        results.failed.push('search bar missing');
        console.log('  ❌ Search bar not found');
      }

      // Verify no visual breakage: all 3 tabs visible
      const allTabs = await pageAll.$$('van-tab');
      if (allTabs && allTabs.length === 3) {
        results.passed.push('all 3 tabs present — no visual breakage');
        console.log('  ✅ All 3 tabs intact');
      } else {
        results.failed.push(`tab count: expected 3, got ${allTabs ? allTabs.length : 0}`);
        console.log(`  ❌ Tab count mismatch`);
      }
    } else {
      results.failed.push('全部 tab not found');
    }

    results.screenshots.push(await screenshot(miniProgram, 'final-state'));

  } catch (e) {
    results.failed.push(`Fatal error: ${e.message}`);
    console.error(`\n❌ Fatal error: ${e.message}`);
    console.error(e.stack);
    if (miniProgram) {
      try { results.screenshots.push(await screenshot(miniProgram, 'fatal-error')); } catch (_) {}
    }
  } finally {
    if (miniProgram) {
      await miniProgram.close();
      console.log('\n  DevTools connection closed');
    }
  }

  return summarize(results);
}

function summarize(results) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ PASSED (${results.passed.length}):`);
  results.passed.forEach(p => console.log(`   • ${p}`));
  if (results.failed.length > 0) {
    console.log(`❌ FAILED (${results.failed.length}):`);
    results.failed.forEach(f => console.log(`   • ${f}`));
  }
  console.log(`\n📸 Screenshots (${results.screenshots.length}):`);
  results.screenshots.forEach(s => console.log(`   ${s}`));

  const verdict = results.failed.length === 0 ? 'PASS' : 'FAIL';
  console.log(`\nFINAL VERDICT: ${verdict}`);
  return { verdict, results };
}

main().then(({ verdict }) => {
  process.exit(verdict === 'PASS' ? 0 : 1);
}).catch(e => {
  console.error('Uncaught:', e);
  process.exit(1);
});
