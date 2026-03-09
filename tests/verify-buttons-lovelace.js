const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const PROJECT_PATH = '/Users/kj/projects/pickup-wechatminiapp';
const SCREENSHOT_DIR = '/tmp/test-screenshots';

(async () => {
  let miniProgram;
  try {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    
    console.log('Launching miniprogram automator...');
    miniProgram = await automator.launch({
      projectPath: PROJECT_PATH,
      devToolsInstallPath: '/Applications/wechatwebdevtools.app',
    });

    console.log('Launched. Switching to dashboard tab...');
    const page = await miniProgram.switchTab('/pages/admin/dashboard/index');
    
    // Wait for page to load
    await new Promise(r => setTimeout(r, 2500));

    // Take screenshot
    const screenshotPath = path.join(SCREENSHOT_DIR, 'dashboard-action-bar.png');
    await miniProgram.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Find action-item elements
    const actionItems = await page.$$('.action-item');
    console.log(`Found ${actionItems.length} .action-item elements`);

    if (actionItems.length === 0) {
      console.log('STATUS: FAIL — no action-item elements found');
      process.exit(1);
    }

    const buttonData = [];
    for (let i = 0; i < actionItems.length; i++) {
      const item = actionItems[i];
      
      // Get offset and size
      const offset = await item.offset();
      const size = await item.size();
      const text = await item.text();
      
      const rect = {
        left: offset.left,
        top: offset.top,
        width: size.width,
        height: size.height,
        right: offset.left + size.width,
        bottom: offset.top + size.height,
      };
      
      buttonData.push({ index: i, text: text.trim(), rect });
      console.log(`Button ${i}: text="${text.trim()}", offset=${JSON.stringify(offset)}, size=${JSON.stringify(size)}`);
    }

    // Check all 3 buttons present with correct text
    const expectedTexts = ['添加班次', '快速分配', '修改审批'];
    const textChecks = expectedTexts.map(expected => {
      const found = buttonData.some(b => b.text && b.text.includes(expected));
      console.log(`Expected "${expected}": ${found ? '✓ FOUND' : '✗ MISSING'}`);
      return found;
    });
    const allTextsFound = textChecks.every(Boolean);

    // Check for overlaps (buttons should be side by side, not overlapping)
    let hasOverlap = false;
    for (let i = 0; i < buttonData.length; i++) {
      for (let j = i + 1; j < buttonData.length; j++) {
        const a = buttonData[i].rect;
        const b = buttonData[j].rect;
        const overlapX = a.left < b.right && a.right > b.left;
        const overlapY = a.top < b.bottom && a.bottom > b.top;
        if (overlapX && overlapY) {
          console.log(`✗ OVERLAP between button ${i} ("${buttonData[i].text}") and button ${j} ("${buttonData[j].text}")`);
          console.log(`  A: left=${a.left.toFixed(1)}, right=${a.right.toFixed(1)}, top=${a.top.toFixed(1)}, bottom=${a.bottom.toFixed(1)}`);
          console.log(`  B: left=${b.left.toFixed(1)}, right=${b.right.toFixed(1)}, top=${b.top.toFixed(1)}, bottom=${b.bottom.toFixed(1)}`);
          hasOverlap = true;
        } else {
          console.log(`✓ No overlap between button ${i} and button ${j}`);
        }
      }
    }

    // Check button widths are reasonable (each should be ~1/3 of screen)
    let hasNarrowButton = false;
    for (const btn of buttonData) {
      if (btn.rect.width < 50) {
        console.log(`✗ Button "${btn.text}" has suspiciously narrow width: ${btn.rect.width.toFixed(1)}px`);
        hasNarrowButton = true;
      } else {
        console.log(`✓ Button "${btn.text}" width: ${btn.rect.width.toFixed(1)}px`);
      }
    }

    console.log(`\n=== VERIFICATION RESULT ===`);
    console.log(`Buttons found: ${buttonData.length}/3`);
    console.log(`All texts found: ${allTextsFound}`);
    console.log(`No overlaps: ${!hasOverlap}`);
    console.log(`Widths OK: ${!hasNarrowButton}`);
    console.log(`Screenshot: ${screenshotPath}`);

    const pass = buttonData.length === 3 && allTextsFound && !hasOverlap && !hasNarrowButton;
    if (pass) {
      console.log('\nSTATUS: PASS ✓');
    } else {
      console.log('\nSTATUS: FAIL ✗');
      process.exit(1);
    }

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (miniProgram) {
      await miniProgram.disconnect();
    }
  }
})();
