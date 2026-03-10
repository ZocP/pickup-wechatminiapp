/**
 * Lovelace: Shift Detail UX Verification
 * Tests: collapsible info card, smart date filter, sort selector, i18n
 */
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/tmp/test-screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = {};

async function shot(mini, name) {
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  try {
    await mini.screenshot({ path: p });
    console.log(`📸 ${p}`);
  } catch (e) {
    console.log(`⚠️  screenshot failed (${name}): ${e.message}`);
  }
  return p;
}

async function main() {
  console.log('Connecting to DevTools (launch)...');
  const mini = await automator.launch({
    projectPath: '/Users/kj/projects/pickup-wechatminiapp',
  });
  console.log('✅ Connected');

  try {
    // ---- Step 1: Dashboard — find a shift with students ----
    console.log('\n=== Step 1: Dashboard ===');
    let dashPage = await mini.switchTab('/pages/admin/dashboard/index');
    await dashPage.waitFor(4000);
    dashPage = await mini.currentPage();
    console.log('Dashboard path:', dashPage.path);
    const dashData = await dashPage.data();
    console.log('Dashboard shifts count:', Array.isArray(dashData.shifts) ? dashData.shifts.length : 'N/A');
    await shot(mini, 'detail-dashboard');

    // Pick first shift with requests, or first shift available
    let targetShiftId = null;
    let targetShift = null;
    const shifts = dashData.shifts || dashData.filteredShifts || [];
    for (const s of shifts) {
      const reqCount = (s.requests || s.passengers || []).length || s.onboard_count || s.passenger_count || 0;
      if (reqCount > 0) {
        targetShiftId = s.id || s.ID;
        targetShift = s;
        console.log(`Found shift with students: id=${targetShiftId}, count=${reqCount}`);
        break;
      }
    }
    if (!targetShiftId && shifts.length > 0) {
      targetShift = shifts[0];
      targetShiftId = targetShift.id || targetShift.ID;
      console.log(`No shifts with students found, using first shift: id=${targetShiftId}`);
    }
    if (!targetShiftId) {
      console.log('⚠️  No shifts on dashboard, trying all-shifts page');
      const allPage = await mini.navigateTo('/pages/admin/all-shifts/index');
      await allPage.waitFor(3000);
      const allData = await (await mini.currentPage()).data();
      const allShifts = allData.shifts || [];
      if (allShifts.length > 0) {
        targetShift = allShifts[0];
        targetShiftId = targetShift.id || targetShift.ID;
      }
    }

    results.navigation = {
      dashPath: dashPage.path,
      shiftsOnDashboard: shifts.length,
      targetShiftId,
      status: targetShiftId ? 'FOUND' : 'NO_SHIFTS',
    };

    if (!targetShiftId) {
      console.log('❌ Cannot proceed: no shift ID found');
      results.navigation.status = 'FAIL';
      return;
    }

    // ---- Step 2: Navigate to shift-detail ----
    console.log(`\n=== Step 2: Navigate to shift-detail id=${targetShiftId} ===`);
    const detailNav = await mini.navigateTo(`/pages/admin/shift-detail/index?id=${targetShiftId}`);
    await detailNav.waitFor(4000);
    let detailPage = await mini.currentPage();
    console.log('Detail path:', detailPage.path);

    let detailData = await detailPage.data();
    console.log('Detail data keys:', Object.keys(detailData).join(', '));
    console.log('infoCardCollapsed (initial):', detailData.infoCardCollapsed);
    console.log('dayFilter (initial):', detailData.dayFilter);
    console.log('sortOrder (initial):', detailData.sortOrder);
    console.log('onboardCount:', detailData.onboardCount);
    console.log('pendingView count:', Array.isArray(detailData.pendingView) ? detailData.pendingView.length : 'N/A');
    console.log('i18n.shift_detail_luggage_label:', detailData.i18n && detailData.i18n.shift_detail_luggage_label);
    console.log('shift.departure_time:', detailData.shift && detailData.shift.departure_time);

    await shot(mini, 'detail-expanded');

    // ---- Step 3: Test Collapsible Info Card ----
    console.log('\n=== Step 3: Collapsible Info Card ===');
    const initialCollapsed = detailData.infoCardCollapsed;
    const initialExpectedFalse = initialCollapsed === false;
    console.log(`Initial infoCardCollapsed: ${initialCollapsed} — expected false: ${initialExpectedFalse ? '✅' : '❌'}`);

    // Tap the collapse toggle header
    let toggleEl = null;
    try {
      toggleEl = await detailPage.$('.header-row-base');
    } catch (e) {
      console.log('⚠️ .header-row-base not found:', e.message);
    }

    if (toggleEl) {
      await toggleEl.tap();
      await detailPage.waitFor(600);
      detailData = await detailPage.data();
      const afterFirstTap = detailData.infoCardCollapsed;
      console.log(`After first tap infoCardCollapsed: ${afterFirstTap} — expected true: ${afterFirstTap === true ? '✅' : '❌'}`);
      await shot(mini, 'detail-collapsed');

      // Tap again to re-expand
      try {
        toggleEl = await detailPage.$('.header-row-base');
        await toggleEl.tap();
      } catch (e) {
        console.log('⚠️ Re-tap failed:', e.message);
      }
      await detailPage.waitFor(600);
      detailData = await detailPage.data();
      const afterSecondTap = detailData.infoCardCollapsed;
      console.log(`After second tap infoCardCollapsed: ${afterSecondTap} — expected false: ${afterSecondTap === false ? '✅' : '❌'}`);

      results.collapsibleCard = {
        status: (initialCollapsed === false && afterFirstTap === true && afterSecondTap === false) ? 'PASS' : 'FAIL',
        initialCollapsed,
        afterFirstTap,
        afterSecondTap,
        note: 'Tapped .header-row-base twice'
      };
    } else {
      results.collapsibleCard = {
        status: 'FAIL',
        note: '.header-row-base element not found for tap',
        initialCollapsed,
      };
    }
    console.log('Collapsible Card:', results.collapsibleCard.status);

    // ---- Step 4: Test Smart Date Filter ----
    console.log('\n=== Step 4: Smart Date Filter ===');
    detailData = await detailPage.data();
    const dayFilter = detailData.dayFilter;
    const shift = detailData.shift;
    const departureTime = shift && shift.departure_time;
    const pendingView = detailData.pendingView || [];
    const pendingGroups = detailData.pendingGroups || [];

    console.log('dayFilter:', dayFilter);
    console.log('shift.departure_time:', departureTime);
    console.log('pendingView count:', pendingView.length);

    // Expected: dayFilter should NOT be 'all' — should equal shift's departure date
    const dayFilterNotAll = dayFilter !== 'all' && dayFilter !== '';
    console.log(`dayFilter is NOT 'all': ${dayFilterNotAll ? '✅' : '❌'} (value: ${dayFilter})`);

    // If dayFilter is set and pendingView has items, check all have matching _day
    let allPendingMatchDay = true;
    let mismatchCount = 0;
    if (dayFilter && dayFilter !== 'all' && pendingView.length > 0) {
      for (const item of pendingView) {
        if (item._day && item._day !== dayFilter) {
          allPendingMatchDay = false;
          mismatchCount++;
          console.log(`  Mismatch: item._day=${item._day}, dayFilter=${dayFilter}`);
        }
      }
      console.log(`All pendingView items match dayFilter: ${allPendingMatchDay ? '✅' : '❌'} (mismatches: ${mismatchCount})`);
    } else if (pendingView.length === 0) {
      console.log('pendingView is empty — filter may be working (or no pending students)');
      allPendingMatchDay = true; // vacuously true
    }

    // Check dayOptions contains the shift day
    const dayOptions = detailData.dayOptions || [];
    console.log('dayOptions:', JSON.stringify(dayOptions));

    await shot(mini, 'detail-date-filtered');

    // The task says filteredPendingRequests — in code it's pendingView
    // Check both names just in case
    const filteredPendingRequests = detailData.filteredPendingRequests || detailData.pendingView || [];

    results.smartDateFilter = {
      status: dayFilterNotAll && allPendingMatchDay ? 'PASS' : 'FAIL',
      dayFilter,
      departureTime,
      dayFilterNotAll,
      pendingViewCount: pendingView.length,
      allPendingMatchDay,
      mismatchCount,
      dayOptions,
      note: dayFilterNotAll
        ? `dayFilter set to ${dayFilter} (shift departure date)`
        : `dayFilter is '${dayFilter}' — smart default NOT applied`,
    };
    console.log('Smart Date Filter:', results.smartDateFilter.status);

    // ---- Step 5: Test Sort Selector ----
    console.log('\n=== Step 5: Sort Selector ===');
    detailData = await detailPage.data();
    const initialSortOrder = detailData.sortOrder;
    const sortOptions = detailData.sortOptions || [];
    console.log('Initial sortOrder:', initialSortOrder);
    console.log('sortOptions:', JSON.stringify(sortOptions));

    // Switch to pending tab to see sort dropdown
    try {
      const tabs = await detailPage.$$('.van-tabs__nav .van-tab');
      console.log('Tab count found:', tabs.length);
      if (tabs.length >= 2) {
        await tabs[1].tap(); // Pending tab
        await detailPage.waitFor(1000);
        console.log('Switched to Pending tab');
      }
    } catch (e) {
      console.log('Tab switch attempt:', e.message);
    }

    await shot(mini, 'detail-sort');

    // Verify sortOptions has expected values
    const expectedSortValues = ['arrival', 'name', 'flight'];
    const hasSortOptions = sortOptions.length >= 3;
    const hasExpectedValues = expectedSortValues.every(v => sortOptions.some(o => o.value === v));

    results.sortSelector = {
      status: initialSortOrder === 'arrival' && hasSortOptions && hasExpectedValues ? 'PASS' : 'FAIL',
      initialSortOrder,
      sortOptions,
      hasSortOptions,
      hasExpectedValues,
      note: `Sort options: ${sortOptions.map(o => o.value).join(', ')}`,
    };
    console.log('Sort Selector:', results.sortSelector.status);

    // ---- Step 6: Test i18n ----
    console.log('\n=== Step 6: i18n ===');
    detailData = await detailPage.data();
    const i18n = detailData.i18n || {};
    const luggageLabel = i18n.shift_detail_luggage_label;
    const expectedLabel = '行李: ';
    console.log(`shift_detail_luggage_label: "${luggageLabel}" — expected "${expectedLabel}": ${luggageLabel === expectedLabel ? '✅' : '❌'}`);

    // Check other i18n keys present
    const i18nKeys = Object.keys(i18n);
    console.log('i18n keys count:', i18nKeys.length);
    console.log('Sample i18n values:');
    ['shift_detail_sort_arrival', 'shift_detail_sort_name', 'shift_detail_remove'].forEach(k => {
      console.log(`  ${k}: "${i18n[k]}"`);
    });

    results.i18n = {
      status: luggageLabel === expectedLabel ? 'PASS' : 'FAIL',
      luggageLabel,
      expectedLabel,
      i18nKeyCount: i18nKeys.length,
      note: `luggage label = "${luggageLabel}"`,
    };
    console.log('i18n:', results.i18n.status);

  } finally {
    console.log('\n=== FINAL RESULTS ===');
    console.log(JSON.stringify(results, null, 2));
    try { await mini.close(); } catch (e) {}
    console.log('✅ Done');
  }
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
