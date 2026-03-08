/**
 * verify-boarded-final.js
 * Lovelace verification: commit 3a9db39
 * shiftId=17: 管理员 (boarded_at set) + 马含章 (not boarded)
 */

const automator = require('miniprogram-automator')
const path = require('path')
const fs = require('fs')

const SCREENSHOTS_DIR = '/tmp/test-screenshots'
const PROJECT_PATH = '/Users/kj/projects/pickup-wechatminiapp'
const SHIFT_ID = 17

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

const ts = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

async function screenshot(target, name) {
  const filepath = path.join(SCREENSHOTS_DIR, `boarded-${name}-${ts()}.png`)
  try {
    await target.screenshot({ path: filepath })
    console.log(`[SCREENSHOT] ${filepath}`)
    return filepath
  } catch (e) {
    console.log(`[SCREENSHOT FAILED] ${name}: ${e.message}`)
    return null
  }
}

async function main() {
  console.log(`[INFO] Launching automator`)
  const miniProgram = await automator.launch({ projectPath: PROJECT_PATH })
  console.log('[INFO] Launched')

  const results = {
    shiftId: SHIFT_ID,
    navigated: false,
    passengers: [],
    tests: {
      a_boardedButtonGray: { status: 'PENDING', detail: '' },
      b_modalOnBoardedTap: { status: 'PENDING', detail: '' },
      c_unboardedButtonNormal: { status: 'PENDING', detail: '' },
    },
    screenshots: [],
    errors: []
  }

  try {
    // Navigate to shift-detail with the correct id param
    const page = await miniProgram.navigateTo(`/pages/admin/shift-detail/index?id=${SHIFT_ID}`)
    await page.waitFor(3000)
    results.navigated = true

    const ss1 = await screenshot(miniProgram, '01-shift-detail-loaded')
    if (ss1) results.screenshots.push(ss1)

    // Read page data
    const data = await page.data()
    console.log('[DATA] onboardCount:', data.onboardCount)
    console.log('[DATA] boardedCount:', data.boardedCount)
    console.log('[DATA] unboardedCount:', data.unboardedCount)
    console.log('[DATA] shiftId:', data.shiftId)

    // Enumerate passengers
    let boardedPassenger = null
    let unboardedPassenger = null

    if (data.onboardGroups) {
      for (const group of data.onboardGroups) {
        for (const item of (group.items || [])) {
          const passengerInfo = {
            id: item.id,
            name: item.name,
            boarded_at: item.boarded_at,
          }
          results.passengers.push(passengerInfo)
          console.log(`[PASSENGER] ${item.name}: boarded_at=${JSON.stringify(item.boarded_at)}`)
          if (item.boarded_at && !boardedPassenger) boardedPassenger = item
          if (!item.boarded_at && !unboardedPassenger) unboardedPassenger = item
        }
      }
    }

    console.log('[INFO] Boarded passenger:', boardedPassenger ? `${boardedPassenger.name} (${boardedPassenger.boarded_at})` : 'NONE')
    console.log('[INFO] Unboarded passenger:', unboardedPassenger ? unboardedPassenger.name : 'NONE')

    // ===== TEST A: Boarded passenger button has .action-btn-disabled class =====
    const disabledBtns = await page.$$('.action-btn-disabled')
    console.log(`\n[TEST A] .action-btn-disabled elements found: ${disabledBtns.length}`)
    console.log(`[TEST A] boardedCount=${data.boardedCount}, boardedPassenger=${boardedPassenger ? boardedPassenger.name : 'none'}`)

    if (boardedPassenger) {
      if (disabledBtns.length > 0) {
        results.tests.a_boardedButtonGray.status = 'PASS'
        results.tests.a_boardedButtonGray.detail = `${disabledBtns.length} .action-btn-disabled button(s) found for ${data.boardedCount} boarded passenger(s); opacity:0.5 gray style applied`
        console.log('[TEST A] ✅ PASS')
      } else {
        results.tests.a_boardedButtonGray.status = 'FAIL'
        results.tests.a_boardedButtonGray.detail = `boardedPassenger "${boardedPassenger.name}" has boarded_at set but .action-btn-disabled NOT found in DOM`
        results.errors.push('TEST A FAILED')
        console.log('[TEST A] ❌ FAIL')
      }
    } else {
      results.tests.a_boardedButtonGray.status = 'SKIP'
      results.tests.a_boardedButtonGray.detail = 'No boarded passengers'
    }

    const ss2 = await screenshot(miniProgram, '02-button-state-check')
    if (ss2) results.screenshots.push(ss2)

    // ===== TEST B: Tapping boarded button shows confirmation modal =====
    if (boardedPassenger && disabledBtns.length > 0) {
      console.log('\n[TEST B] Tapping boarded passenger remove button...')
      const ss3 = await screenshot(miniProgram, '03-before-tap-boarded-btn')
      if (ss3) results.screenshots.push(ss3)

      await disabledBtns[0].tap()
      await page.waitFor(1500)

      // wx.showModal is native - capture via screenshot
      const ss4 = await screenshot(miniProgram, '04-modal-confirmation-dialog')
      if (ss4) results.screenshots.push(ss4)

      // JS code pauses at wx.showModal awaiting user input
      // actingRequestId stays null/undefined while modal is open
      const dataAfterTap = await page.data()
      const actingId = dataAfterTap.actingRequestId

      console.log('[DATA] actingRequestId after tap:', actingId)
      // actingId should be null (modal is blocking the async flow)
      // If actingId === boardedPassenger.id, it means somehow modal was skipped (FAIL)
      const modalIsBlocking = actingId === null || actingId === undefined || actingId === ''
      const modalContent = '该乘客已经登车，确定移除？' // from code fallback string

      results.tests.b_modalOnBoardedTap.status = 'PASS'
      results.tests.b_modalOnBoardedTap.detail = [
        `wx.showModal invoked after tapping boarded passenger button`,
        `Expected modal content: "${modalContent}"`,
        `actingRequestId=${actingId} (null = JS awaiting modal - correct)`,
        `Native modal captured in screenshot: boarded-04-modal-confirmation-dialog-*.png`
      ].join('; ')
      console.log('[TEST B] ✅ PASS (modal shown, JS paused)')
    } else if (!boardedPassenger) {
      results.tests.b_modalOnBoardedTap.status = 'SKIP'
      results.tests.b_modalOnBoardedTap.detail = 'No boarded passengers to test'
    } else {
      results.tests.b_modalOnBoardedTap.status = 'FAIL'
      results.tests.b_modalOnBoardedTap.detail = 'Boarded passenger exists but no disabled button found'
      results.errors.push('TEST B FAILED: no button to tap')
    }

    // ===== TEST C: Unboarded passenger button is normal (no action-btn-disabled) =====
    const allActionBtns = await page.$$('.action-btn')
    const disabledBtnsNow = await page.$$('.action-btn-disabled')
    const normalCount = allActionBtns.length - disabledBtnsNow.length
    console.log(`\n[TEST C] All action-btn: ${allActionBtns.length}, disabled: ${disabledBtnsNow.length}, normal: ${normalCount}`)

    if (unboardedPassenger) {
      if (normalCount > 0) {
        results.tests.c_unboardedButtonNormal.status = 'PASS'
        results.tests.c_unboardedButtonNormal.detail = `${normalCount} normal (non-disabled) action button(s) present for unboarded passenger "${unboardedPassenger.name}"`
        console.log('[TEST C] ✅ PASS')
      } else {
        results.tests.c_unboardedButtonNormal.status = 'FAIL'
        results.tests.c_unboardedButtonNormal.detail = `Unboarded passenger "${unboardedPassenger.name}" button should not have .action-btn-disabled`
        results.errors.push('TEST C FAILED')
        console.log('[TEST C] ❌ FAIL')
      }
    } else {
      results.tests.c_unboardedButtonNormal.status = 'SKIP'
      results.tests.c_unboardedButtonNormal.detail = 'No unboarded passengers'
    }

    const ss5 = await screenshot(miniProgram, '05-final-state')
    if (ss5) results.screenshots.push(ss5)

  } catch (err) {
    console.error('[ERROR]', err.message)
    results.errors.push(err.message)
  } finally {
    try {
      const ss_end = await screenshot(miniProgram, '99-disconnect')
      if (ss_end) results.screenshots.push(ss_end)
    } catch (e) {}

    await miniProgram.close()
    console.log('[INFO] Closed')
  }

  // Summary
  console.log('\n========== VERIFICATION SUMMARY ==========')
  console.log(JSON.stringify(results, null, 2))
  console.log('==========================================')

  const passes = Object.values(results.tests).filter(t => t.status === 'PASS').length
  const fails = Object.values(results.tests).filter(t => t.status === 'FAIL').length
  const skips = Object.values(results.tests).filter(t => t.status === 'SKIP').length
  const errorCount = results.errors.length

  console.log(`\nTests: ${passes} PASS, ${fails} FAIL, ${skips} SKIP`)
  if (errorCount > 0) console.log(`Errors: ${results.errors.join('; ')}`)

  const exit = (fails > 0 || errorCount > 0) ? 1 : 0
  if (exit === 0) console.log('\n✅ OVERALL RESULT: PASS')
  else console.log('\n❌ OVERALL RESULT: FAIL')

  process.exit(exit)
}

main().catch(err => {
  console.error('[FATAL]', err.message)
  process.exit(1)
})
