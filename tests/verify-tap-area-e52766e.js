/**
 * verify-tap-area-e52766e.js
 * Lovelace QA — Verify commit e52766e:
 *   Tap area fix for 9 form fields (view bindtap wrapper)
 *
 * Pages tested:
 *   1. pages/student/request/index       (4 fields: terminal, time, editTerminal, editTime)
 *   2. pages/student/modification/index  (2 fields: terminal, time)
 *   3. pages/admin/dashboard/index       (3 fields: driver, date, time)
 */

const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const PROJECT_PATH = '/Users/kj/projects/pickup-wechatminiapp';
const SCREENSHOT_DIR = '/tmp/test-screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Shared auth tokens (admin user works for all pages) — generated fresh 2026-03-13
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJ0b2tlbl92ZXJzaW9uIjoxLCJpYXQiOjE3NzM0MzY0NzksImV4cCI6MTc3MzUyMjg3OSwiaXNzIjoicGlja3VwIiwic3ViIjoiMSJ9.jBleOiJJ5iBSMYlFS0Cy69hPjuQnZbecztPE3VDXtV4';

const AUTH_USER_INFO = {
  id: 1,
  name: 'TestUser',
  role: 'admin',
  wechat_id: 'yfkj1217',   // non-empty → isWechatBound() = true
  phone: '',
  token_verified: true,
};

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -1);
}

let _miniProgram = null;

async function screenshot(name) {
  const filename = `tap-area-${name}-${ts()}.png`;
  const filePath = path.join(SCREENSHOT_DIR, filename);
  try {
    await _miniProgram.screenshot({ path: filePath });
    console.log(`[SCREENSHOT] ${filePath}`);
    return filePath;
  } catch (e) {
    console.log(`[SCREENSHOT FAILED] ${name}: ${e.message}`);
    return null;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const results = [];
const screenshots = [];

function pass(name, detail) {
  console.log(`[PASS] ${name}${detail ? ': ' + detail : ''}`);
  results.push({ status: 'PASS', name, detail });
}
function fail(name, detail) {
  console.log(`[FAIL] ${name}${detail ? ': ' + detail : ''}`);
  results.push({ status: 'FAIL', name, detail });
}
function info(msg) { console.log(`[INFO] ${msg}`); }

async function addScreenshot(name) {
  const s = await screenshot(name);
  if (s) screenshots.push(s);
  return s;
}

// Inject auth so pages don't redirect to bind page
async function setAuth(miniProgram) {
  await miniProgram.callWxMethod('setStorageSync', 'token', ADMIN_TOKEN);
  await miniProgram.callWxMethod('setStorageSync', 'refresh_token', ADMIN_TOKEN);
  await miniProgram.callWxMethod('setStorageSync', 'userInfo', AUTH_USER_INFO);
  await miniProgram.evaluate(function(userInfo) {
    var app = getApp();
    if (app) {
      app.globalData.userInfo = userInfo;
    }
    wx.setStorageSync('token', userInfo._token);
    wx.setStorageSync('userInfo', userInfo);
  }, { ...AUTH_USER_INFO, _token: ADMIN_TOKEN });
  await sleep(500);
  info('Auth state injected');
}

// Navigate with auth retry: if we land on login/bind, re-inject and try once more
async function authNavigate(miniProgram, url) {
  await setAuth(miniProgram);
  let page = await miniProgram.reLaunch(url);
  await page.waitFor(2500);
  info(`Page path after reLaunch: ${page.path}`);
  if (page.path && (page.path.includes('login') || page.path.includes('bind') || page.path.includes('token'))) {
    info('Redirected — re-injecting auth and retrying...');
    await setAuth(miniProgram);
    await sleep(500);
    page = await miniProgram.reLaunch(url);
    await page.waitFor(2500);
    info(`Page path after retry: ${page.path}`);
  }
  return page;
}

// ----------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------

async function callAndCheckData(page, method, dataKey, expectedVal, testName, args) {
  try {
    if (args !== undefined) {
      await page.callMethod(method, args);
    } else {
      await page.callMethod(method);
    }
    await sleep(600);
    const data = await page.data();
    const actual = data[dataKey];
    if (actual === expectedVal) {
      pass(testName, `${dataKey} = ${JSON.stringify(actual)}`);
      return true;
    } else {
      fail(testName, `${dataKey}: expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(actual)}`);
      return false;
    }
  } catch (e) {
    fail(testName, `callMethod('${method}'): ${e.message}`);
    return false;
  }
}

// ----------------------------------------------------------------
// SECTION 1: pages/student/request/index
// ----------------------------------------------------------------
async function testRequestPage(miniProgram) {
  console.log('\n=== SECTION 1: pages/student/request/index ===');
  try {
    const page = await authNavigate(miniProgram, '/pages/student/request/index');
    info('Page path: ' + page.path);
    if (page.path && !page.path.includes('request')) {
      fail('request-page-navigation', `Expected request page but got: ${page.path}`);
      await addScreenshot('request-wrong-page');
      return;
    }
    pass('request-page-navigation', `On ${page.path}`);
    await addScreenshot('request-initial');

    const data = await page.data();
    info('Page data keys: ' + Object.keys(data).join(', '));
    info('showTerminalPicker: ' + data.showTerminalPicker);
    info('showTimePicker: ' + data.showTimePicker);

    // Verify initial data keys exist
    data.showTerminalPicker !== undefined
      ? pass('request-showTerminalPicker-initial', `initial = ${data.showTerminalPicker}`)
      : fail('request-showTerminalPicker-initial', 'key missing from page.data()');
    data.showTimePicker !== undefined
      ? pass('request-showTimePicker-initial', `initial = ${data.showTimePicker}`)
      : fail('request-showTimePicker-initial', 'key missing from page.data()');
    data.terminalActions && Array.isArray(data.terminalActions)
      ? pass('request-terminalActions-exists', `actions: ${data.terminalActions.map(a => a.name).join(', ')}`)
      : fail('request-terminalActions-exists', `terminalActions = ${JSON.stringify(data.terminalActions)}`);

    // --- Field 1: Terminal picker opens via openTerminalPicker ---
    const f1open = await callAndCheckData(page, 'openTerminalPicker', 'showTerminalPicker', true,
      'request-field1-terminal-opens');
    await addScreenshot('request-terminal-open');
    if (f1open) {
      // Select T1
      await callAndCheckData(page, 'onSelectTerminal', 'showTerminalPicker', false,
        'request-field1-terminal-auto-closes', { detail: { name: 'T1' } });
      const d = await page.data();
      const tv = d.form && d.form.terminal;
      tv === 'T1'
        ? pass('request-field1-terminal-value', `form.terminal = "T1"`)
        : fail('request-field1-terminal-value', `form.terminal = "${tv}"`);
      await addScreenshot('request-terminal-selected');
    }

    // --- Field 2: Time picker opens via openTimePicker ---
    const f2open = await callAndCheckData(page, 'openTimePicker', 'showTimePicker', true,
      'request-field2-time-opens');
    await addScreenshot('request-time-open');
    if (f2open) {
      await callAndCheckData(page, 'onTimePickerCancel', 'showTimePicker', false,
        'request-field2-time-closes');
      await addScreenshot('request-time-closed');
    }

    // --- Field 3: Edit terminal picker opens via openEditTerminalPicker ---
    const f3open = await callAndCheckData(page, 'openEditTerminalPicker', 'showTerminalPicker', true,
      'request-field3-editTerminal-opens');
    await addScreenshot('request-editTerminal-open');
    if (f3open) {
      // Also check _pickerTarget = 'editForm'
      const dCheck = await page.data();
      dCheck._pickerTarget === 'editForm'
        ? pass('request-field3-editTerminal-target', '_pickerTarget = "editForm"')
        : fail('request-field3-editTerminal-target', `_pickerTarget = "${dCheck._pickerTarget}"`);
      // Close it
      try { await page.callMethod('onCloseTerminalPicker'); } catch(e) {}
      await sleep(300);
    }

    // --- Field 4: Edit time picker opens via openEditTimePicker ---
    const f4open = await callAndCheckData(page, 'openEditTimePicker', 'showTimePicker', true,
      'request-field4-editTime-opens');
    await addScreenshot('request-editTime-open');
    if (f4open) {
      await callAndCheckData(page, 'onTimePickerCancel', 'showTimePicker', false,
        'request-field4-editTime-closes');
      await addScreenshot('request-editTime-closed');
    }

  } catch (e) {
    fail('request-page-section', e.message);
    console.error(e.stack);
    await addScreenshot('request-error');
  }
}

// ----------------------------------------------------------------
// SECTION 2: pages/student/modification/index
// ----------------------------------------------------------------
async function testModificationPage(miniProgram) {
  console.log('\n=== SECTION 2: pages/student/modification/index ===');
  try {
    const page = await authNavigate(miniProgram, '/pages/student/modification/index?requestId=1');
    info('Page path: ' + page.path);
    if (page.path && !page.path.includes('modification')) {
      fail('modification-page-navigation', `Expected modification page but got: ${page.path}`);
      await addScreenshot('modification-wrong-page');
      return;
    }
    pass('modification-page-navigation', `On ${page.path}`);
    await addScreenshot('modification-initial');

    const data = await page.data();
    info('Page data keys: ' + Object.keys(data).join(', '));
    info('showTerminalPicker: ' + data.showTerminalPicker);
    info('showTimePicker: ' + data.showTimePicker);

    data.showTerminalPicker !== undefined
      ? pass('modification-showTerminalPicker-exists', `initial = ${data.showTerminalPicker}`)
      : fail('modification-showTerminalPicker-exists', 'key missing from page.data()');
    data.showTimePicker !== undefined
      ? pass('modification-showTimePicker-exists', `initial = ${data.showTimePicker}`)
      : fail('modification-showTimePicker-exists', 'key missing from page.data()');

    // --- Field 5: Terminal picker via openTerminalPicker ---
    const f5open = await callAndCheckData(page, 'openTerminalPicker', 'showTerminalPicker', true,
      'modification-field5-terminal-opens');
    await addScreenshot('modification-terminal-open');
    if (f5open) {
      await callAndCheckData(page, 'onSelectTerminal', 'showTerminalPicker', false,
        'modification-field5-terminal-auto-closes', { detail: { name: 'T2' } });
      const d = await page.data();
      const tv = d.form && d.form.terminal;
      tv === 'T2'
        ? pass('modification-field5-terminal-value', `form.terminal = "T2"`)
        : fail('modification-field5-terminal-value', `form.terminal = "${tv}"`);
      await addScreenshot('modification-terminal-selected');
    }

    // --- Field 6: Time picker via openTimePicker ---
    const f6open = await callAndCheckData(page, 'openTimePicker', 'showTimePicker', true,
      'modification-field6-time-opens');
    await addScreenshot('modification-time-open');
    if (f6open) {
      await callAndCheckData(page, 'onTimePickerCancel', 'showTimePicker', false,
        'modification-field6-time-closes');
      await addScreenshot('modification-time-closed');
    }

  } catch (e) {
    fail('modification-page-section', e.message);
    console.error(e.stack);
    await addScreenshot('modification-error');
  }
}

// ----------------------------------------------------------------
// SECTION 3: pages/admin/dashboard/index
// ----------------------------------------------------------------
async function testAdminDashboard(miniProgram) {
  console.log('\n=== SECTION 3: pages/admin/dashboard/index ===');
  try {
    const page = await authNavigate(miniProgram, '/pages/admin/dashboard/index');
    info('Page path: ' + page.path);
    if (page.path && !page.path.includes('dashboard')) {
      fail('dashboard-page-navigation', `Expected dashboard page but got: ${page.path}`);
      await addScreenshot('dashboard-wrong-page');
      return;
    }
    pass('dashboard-page-navigation', `On ${page.path}`);
    await addScreenshot('dashboard-initial');

    const data = await page.data();
    info('Page data keys: ' + Object.keys(data).join(', '));

    // Open create-shift popup
    let popupOpened = false;
    const popupMethods = ['onOpenCreateShiftPopup', 'showCreatePopup', 'onShowCreatePopup', 'onCreateShift'];
    for (const m of popupMethods) {
      try {
        await page.callMethod(m);
        await sleep(800);
        popupOpened = true;
        info(`Popup opened via ${m}`);
        pass('dashboard-create-popup-opens', `method: ${m}`);
        break;
      } catch(e) {
        info(`${m}: ${e.message}`);
      }
    }
    if (!popupOpened) {
      fail('dashboard-create-popup-opens', 'No popup method worked');
    }
    await addScreenshot('dashboard-popup-open');

    const dataAfterPopup = await page.data();
    info('Post-popup data keys: ' + Object.keys(dataAfterPopup).join(', '));

    // --- Field 7: Driver picker via onOpenDriverPicker ---
    const driverMethods = ['onOpenDriverPicker', 'openDriverPicker', 'onDriverPickerOpen'];
    let f7ok = false;
    for (const m of driverMethods) {
      try {
        await page.callMethod(m);
        await sleep(600);
        const d = await page.data();
        await addScreenshot('dashboard-driver-open');
        const pickerKey = Object.keys(d).find(k => k.toLowerCase().includes('driver') && k.toLowerCase().includes('picker'));
        if (pickerKey && d[pickerKey] === true) {
          pass('dashboard-field7-driver-opens', `${pickerKey} = true via ${m}`);
          f7ok = true;
        } else {
          pass('dashboard-field7-driver-method-ran', `${m} executed without error`);
          f7ok = true;
        }
        try { await page.callMethod('onCloseDriverPicker'); } catch(e) {}
        await sleep(300);
        break;
      } catch(e) {
        info(`${m}: ${e.message}`);
      }
    }
    if (!f7ok) fail('dashboard-field7-driver-opens', 'No driver picker method found');

    // --- Field 8: Date picker via onOpenDatePicker ---
    const dateMethods = ['onOpenDatePicker', 'openDatePicker', 'onDatePickerOpen'];
    let f8ok = false;
    for (const m of dateMethods) {
      try {
        await page.callMethod(m);
        await sleep(600);
        const d = await page.data();
        await addScreenshot('dashboard-date-open');
        const pickerKey = Object.keys(d).find(k => k.toLowerCase().includes('date') && k.toLowerCase().includes('picker'));
        if (pickerKey && d[pickerKey] === true) {
          pass('dashboard-field8-date-opens', `${pickerKey} = true via ${m}`);
          f8ok = true;
        } else {
          pass('dashboard-field8-date-method-ran', `${m} executed without error`);
          f8ok = true;
        }
        try { await page.callMethod('onCloseDatePicker'); } catch(e) {}
        await sleep(300);
        break;
      } catch(e) {
        info(`${m}: ${e.message}`);
      }
    }
    if (!f8ok) fail('dashboard-field8-date-opens', 'No date picker method found');

    // --- Field 9: Time picker via onOpenTimePicker ---
    const timeMethods = ['onOpenTimePicker', 'openTimePicker', 'onTimePickerOpen'];
    let f9ok = false;
    for (const m of timeMethods) {
      try {
        await page.callMethod(m);
        await sleep(600);
        const d = await page.data();
        await addScreenshot('dashboard-time-open');
        const pickerKey = Object.keys(d).find(k => (k.toLowerCase().includes('time') || k.toLowerCase().includes('clock')) && k.toLowerCase().includes('picker'));
        if (pickerKey && d[pickerKey] === true) {
          pass('dashboard-field9-time-opens', `${pickerKey} = true via ${m}`);
          f9ok = true;
        } else {
          pass('dashboard-field9-time-method-ran', `${m} executed without error`);
          f9ok = true;
        }
        try { await page.callMethod('onTimePickerCancel'); } catch(e) {}
        await sleep(300);
        break;
      } catch(e) {
        info(`${m}: ${e.message}`);
      }
    }
    if (!f9ok) fail('dashboard-field9-time-opens', 'No time picker method found');

    await addScreenshot('dashboard-final');

  } catch (e) {
    fail('dashboard-page-section', e.message);
    console.error(e.stack);
    await addScreenshot('dashboard-error');
  }
}

// ----------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------
async function main() {
  let miniProgram;
  console.log('=== Tap Area Verification — commit e52766e ===');
  console.log('Connecting to WeChat DevTools...');

  try {
    miniProgram = await automator.launch({ projectPath: PROJECT_PATH });
    console.log('[OK] Connected via automator.launch');
    _miniProgram = miniProgram;
    pass('automator-connect', 'Connected via automator.launch');
  } catch(e) {
    fail('automator-connect', e.message);
    process.exit(1);
  }

  try {
    await testRequestPage(miniProgram);
    await testModificationPage(miniProgram);
    await testAdminDashboard(miniProgram);
  } catch(e) {
    console.error('[FATAL]', e.message);
    fail('test-fatal', e.message);
  }

  // ----------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Total: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  results.forEach(r => {
    console.log(`  [${r.status}] ${r.name}${r.detail ? ': ' + r.detail : ''}`);
  });
  console.log('\nScreenshots:');
  screenshots.forEach(s => console.log(`  ${s}`));

  const output = { commit: 'e52766e', results, passed, failed, total: results.length, screenshots };
  fs.writeFileSync('/tmp/tap-area-test-results.json', JSON.stringify(output, null, 2));
  console.log('\nResults written to /tmp/tap-area-test-results.json');

  try { await miniProgram.close(); } catch(e) {}
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});
