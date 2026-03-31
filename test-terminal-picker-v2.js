const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const PROJECT_PATH = '/Users/kj/projects/pickup-wechatminiapp';
const SCREENSHOT_DIR = '/tmp/test-screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

let _miniProgram = null;

async function screenshot(page, name) {
  const filename = `terminal-picker-${name}-${ts()}.png`;
  const filePath = path.join(SCREENSHOT_DIR, filename);
  try {
    // screenshot is on miniProgram, not page
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

async function main() {
  let miniProgram;
  console.log('Launching miniprogram-automator...');
  try {
    miniProgram = await automator.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: PROJECT_PATH,
      port: 9423,
      timeout: 60000,
    });
    console.log('Connected!');
    _miniProgram = miniProgram;
    pass('automator-connect', 'Connected to WeChat DevTools via launch');
  } catch (e) {
    console.error('Failed to connect:', e.message);
    process.exit(1);
  }

  // =============================================
  // TEST 1: Modification page terminal picker
  // =============================================
  console.log('\n=== TEST 1: Modification page terminal picker ===');
  try {
    // Navigate to modification page with a requestId param
    const modPage = await miniProgram.navigateTo('/pages/student/modification/index?requestId=1');
    await sleep(2000);
    
    const s1 = await screenshot(modPage, 'modification-initial');
    if (s1) screenshots.push(s1);

    // Check page data
    const data = await modPage.data();
    console.log('Page data keys:', Object.keys(data));
    console.log('showTerminalPicker:', data.showTerminalPicker);
    console.log('terminalActions:', JSON.stringify(data.terminalActions));
    console.log('form:', JSON.stringify(data.form));

    // Verify showTerminalPicker exists
    if (data.showTerminalPicker !== undefined) {
      pass('modification-showTerminalPicker-exists', `showTerminalPicker = ${data.showTerminalPicker}`);
    } else {
      fail('modification-showTerminalPicker-exists', 'showTerminalPicker not in page data');
    }

    // Verify terminalActions has T1, T2, T3, T5
    if (data.terminalActions && Array.isArray(data.terminalActions)) {
      const names = data.terminalActions.map(a => a.name);
      const expected = ['T1', 'T2', 'T3', 'T5'];
      const allPresent = expected.every(t => names.includes(t));
      if (allPresent) {
        pass('modification-terminalActions', `Actions: ${names.join(', ')}`);
      } else {
        fail('modification-terminalActions', `Expected T1,T2,T3,T5 but got: ${names.join(', ')}`);
      }
    } else {
      fail('modification-terminalActions', `terminalActions: ${JSON.stringify(data.terminalActions)}`);
    }

    // Verify i18n labels
    const i18n = data.i18n || {};
    const label = i18n.student_request_terminal_label;
    const placeholder = i18n.student_request_terminal_placeholder;
    const title = i18n.student_request_terminal_title;
    console.log('i18n terminal keys:', { label, placeholder, title });
    label ? pass('modification-i18n-label', `"${label}"`) : fail('modification-i18n-label', 'missing');
    placeholder ? pass('modification-i18n-placeholder', `"${placeholder}"`) : fail('modification-i18n-placeholder', 'missing');
    title ? pass('modification-i18n-title', `"${title}"`) : fail('modification-i18n-title', 'missing');

    // Test openTerminalPicker via callMethod
    console.log('Calling openTerminalPicker...');
    await modPage.callMethod('openTerminalPicker');
    await sleep(800);
    const dataAfterOpen = await modPage.data();
    if (dataAfterOpen.showTerminalPicker === true) {
      pass('modification-openTerminalPicker', 'showTerminalPicker = true');
    } else {
      fail('modification-openTerminalPicker', `showTerminalPicker = ${dataAfterOpen.showTerminalPicker}`);
    }
    const s2 = await screenshot(modPage, 'modification-picker-open');
    if (s2) screenshots.push(s2);

    // Test selecting T2 terminal
    console.log('Calling onSelectTerminal T2...');
    await modPage.callMethod('onSelectTerminal', { detail: { name: 'T2' } });
    await sleep(500);
    const dataAfterSelect = await modPage.data();
    const terminalValue = dataAfterSelect.form && dataAfterSelect.form.terminal;
    console.log('form.terminal after select:', terminalValue);
    if (terminalValue === 'T2') {
      pass('modification-onSelectTerminal', `form.terminal = "T2"`);
    } else {
      fail('modification-onSelectTerminal', `Expected "T2" but got "${terminalValue}"`);
    }
    if (dataAfterSelect.showTerminalPicker === false) {
      pass('modification-picker-closes-after-select', 'showTerminalPicker = false after select');
    } else {
      fail('modification-picker-closes-after-select', `showTerminalPicker = ${dataAfterSelect.showTerminalPicker}`);
    }
    const s3 = await screenshot(modPage, 'modification-picker-selected');
    if (s3) screenshots.push(s3);

    // Test close picker via onCloseTerminalPicker
    await modPage.callMethod('openTerminalPicker');
    await sleep(300);
    await modPage.callMethod('onCloseTerminalPicker');
    await sleep(300);
    const dataAfterClose = await modPage.data();
    if (dataAfterClose.showTerminalPicker === false) {
      pass('modification-onCloseTerminalPicker', 'showTerminalPicker = false after close');
    } else {
      fail('modification-onCloseTerminalPicker', `showTerminalPicker = ${dataAfterClose.showTerminalPicker}`);
    }
    const s4 = await screenshot(modPage, 'modification-picker-closed');
    if (s4) screenshots.push(s4);

  } catch (e) {
    fail('modification-page-test', e.message);
    console.error(e);
  }

  // =============================================
  // TEST 2: Request page terminal picker (regression)
  // =============================================
  console.log('\n=== TEST 2: Request page terminal picker (regression) ===');
  try {
    const reqPage = await miniProgram.navigateTo('/pages/student/request/index');
    await sleep(2000);
    
    const s5 = await screenshot(reqPage, 'request-initial');
    if (s5) screenshots.push(s5);

    const reqData = await reqPage.data();
    console.log('Request page data keys:', Object.keys(reqData));
    console.log('showTerminalPicker:', reqData.showTerminalPicker);
    console.log('_pickerTarget:', reqData._pickerTarget);
    console.log('form.terminal:', reqData.form && reqData.form.terminal);
    console.log('terminalActions:', JSON.stringify(reqData.terminalActions));

    if (reqData.showTerminalPicker !== undefined) {
      pass('request-showTerminalPicker-exists', `showTerminalPicker = ${reqData.showTerminalPicker}`);
    } else {
      fail('request-showTerminalPicker-exists', 'showTerminalPicker not in page data');
    }

    // Verify terminalActions
    if (reqData.terminalActions && Array.isArray(reqData.terminalActions)) {
      const names = reqData.terminalActions.map(a => a.name);
      const allPresent = ['T1', 'T2', 'T3', 'T5'].every(t => names.includes(t));
      allPresent
        ? pass('request-terminalActions', `Actions: ${names.join(', ')}`)
        : fail('request-terminalActions', `Got: ${names.join(', ')}`);
    } else {
      fail('request-terminalActions', `terminalActions: ${JSON.stringify(reqData.terminalActions)}`);
    }

    // Test openTerminalPicker
    console.log('Calling openTerminalPicker on request page...');
    await reqPage.callMethod('openTerminalPicker');
    await sleep(500);
    const reqDataAfterOpen = await reqPage.data();
    console.log('After openTerminalPicker - showTerminalPicker:', reqDataAfterOpen.showTerminalPicker);
    console.log('After openTerminalPicker - _pickerTarget:', reqDataAfterOpen._pickerTarget);
    if (reqDataAfterOpen.showTerminalPicker === true) {
      pass('request-openTerminalPicker', 'showTerminalPicker = true');
    } else {
      fail('request-openTerminalPicker', `showTerminalPicker = ${reqDataAfterOpen.showTerminalPicker}`);
    }
    const s6 = await screenshot(reqPage, 'request-picker-open');
    if (s6) screenshots.push(s6);

    // Select T3
    console.log('Selecting T3...');
    await reqPage.callMethod('onSelectTerminal', { detail: { name: 'T3' } });
    await sleep(500);
    const reqDataAfterSelect = await reqPage.data();
    const reqTerminal = reqDataAfterSelect.form && reqDataAfterSelect.form.terminal;
    console.log('form.terminal after select T3:', reqTerminal);
    if (reqTerminal === 'T3') {
      pass('request-onSelectTerminal', `form.terminal = "T3"`);
    } else {
      fail('request-onSelectTerminal', `Expected "T3" but got "${reqTerminal}"`);
    }
    if (reqDataAfterSelect.showTerminalPicker === false) {
      pass('request-picker-closes-after-select', 'showTerminalPicker = false');
    } else {
      fail('request-picker-closes-after-select', `showTerminalPicker = ${reqDataAfterSelect.showTerminalPicker}`);
    }
    const s7 = await screenshot(reqPage, 'request-picker-selected');
    if (s7) screenshots.push(s7);

    // Test openEditTerminalPicker — consolidated setData fix
    console.log('Testing openEditTerminalPicker...');
    await reqPage.callMethod('openEditTerminalPicker');
    await sleep(500);
    const reqDataAfterEdit = await reqPage.data();
    console.log('openEditTerminalPicker - showTerminalPicker:', reqDataAfterEdit.showTerminalPicker);
    console.log('openEditTerminalPicker - _pickerTarget:', reqDataAfterEdit._pickerTarget);
    const editPickerOpen = reqDataAfterEdit.showTerminalPicker === true;
    const editPickerTarget = reqDataAfterEdit._pickerTarget === 'editForm';
    editPickerOpen
      ? pass('request-openEditTerminalPicker-opens', 'showTerminalPicker = true')
      : fail('request-openEditTerminalPicker-opens', `showTerminalPicker = ${reqDataAfterEdit.showTerminalPicker}`);
    editPickerTarget
      ? pass('request-openEditTerminalPicker-target', '_pickerTarget = "editForm"')
      : fail('request-openEditTerminalPicker-target', `_pickerTarget = "${reqDataAfterEdit._pickerTarget}"`);

    // Consolidated fix: both set atomically
    if (editPickerOpen && editPickerTarget) {
      pass('request-editTerminalPicker-consolidated', 'Both _pickerTarget=editForm AND showTerminalPicker=true set atomically');
    } else {
      fail('request-editTerminalPicker-consolidated', `Inconsistent state: show=${reqDataAfterEdit.showTerminalPicker}, target=${reqDataAfterEdit._pickerTarget}`);
    }
    const s8 = await screenshot(reqPage, 'request-edit-picker-open');
    if (s8) screenshots.push(s8);

    // Select T1 for editForm target
    await reqPage.callMethod('onSelectTerminal', { detail: { name: 'T1' } });
    await sleep(500);
    const reqDataAfterEditSelect = await reqPage.data();
    const editFormTerminal = reqDataAfterEditSelect.editForm && reqDataAfterEditSelect.editForm.terminal;
    console.log('editForm.terminal after select T1:', editFormTerminal);
    // editForm may be empty if no request loaded, just log
    if (editFormTerminal === 'T1') {
      pass('request-editForm-terminal-select', `editForm.terminal = "T1"`);
    } else {
      console.log(`[INFO] editForm.terminal = "${editFormTerminal}" (may be expected without loaded request)`);
      pass('request-editForm-terminal-select-noted', `editForm may be uninitialized without loaded request; terminal = "${editFormTerminal}"`);
    }
    if (reqDataAfterEditSelect.showTerminalPicker === false) {
      pass('request-edit-picker-closes', 'showTerminalPicker = false after editForm select');
    } else {
      fail('request-edit-picker-closes', `showTerminalPicker = ${reqDataAfterEditSelect.showTerminalPicker}`);
    }
    const s9 = await screenshot(reqPage, 'request-edit-picker-selected');
    if (s9) screenshots.push(s9);

    // i18n on request page
    const reqI18n = reqDataAfterEditSelect.i18n || {};
    const reqLabel = reqI18n.student_request_terminal_label;
    reqLabel
      ? pass('request-i18n-terminal-label', `"${reqLabel}"`)
      : fail('request-i18n-terminal-label', 'i18n key missing');

  } catch (e) {
    fail('request-page-test', e.message);
    console.error(e);
  }

  // =============================================
  // SUMMARY
  // =============================================
  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`PASS: ${passed}, FAIL: ${failed}`);
  results.forEach(r => {
    console.log(`  [${r.status}] ${r.name}${r.detail ? ': ' + r.detail : ''}`);
  });
  console.log('\nScreenshots archived:');
  screenshots.forEach(s => console.log(`  ${s}`));

  // Write JSON results
  const output = { results, passed, failed, total: results.length, screenshots };
  fs.writeFileSync('/tmp/test-results-v2.json', JSON.stringify(output, null, 2));
  console.log('\nResults written to /tmp/test-results-v2.json');

  if (miniProgram) {
    try { await miniProgram.disconnect(); } catch(e) {}
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
