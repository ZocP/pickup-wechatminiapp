/**
 * 微信小程序自动化测试框架
 * 供 Lovelace (QA agent) 在每次修 bug 后自动验证
 *
 * 核心功能：
 * - connect/close: 管理 DevTools automator 连接
 * - navigateTo/switchTab: 页面导航
 * - tap/exists/getData: UI 交互与断言
 * - screenshot: 截图存档
 * - runTests: 运行测试套件并输出结构化报告
 */

const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const PROJECT_PATH = '/Users/kj/projects/pickup-wechatminiapp';
const SCREENSHOT_DIR = '/tmp/test-screenshots';
const DEFAULT_TIMEOUT = 10000;
const RENDER_WAIT = 1500; // 页面渲染等待时间

class TestFramework {
  constructor() {
    this.miniProgram = null;
    this.currentPage = null;
  }

  // ===== 连接管理 =====

  async connect() {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    this.miniProgram = await automator.launch({
      projectPath: PROJECT_PATH,
    });
    return this.miniProgram;
  }

  async close() {
    if (this.miniProgram) {
      await this.miniProgram.close();
      this.miniProgram = null;
      this.currentPage = null;
    }
  }

  // ===== 页面导航 =====

  async navigateTo(pagePath) {
    this._ensureConnected();
    const fullPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
    this.currentPage = await this.miniProgram.navigateTo(fullPath);
    await this.currentPage.waitFor(RENDER_WAIT);
    return this.currentPage;
  }

  async reLaunch(pagePath) {
    this._ensureConnected();
    const fullPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
    this.currentPage = await this.miniProgram.reLaunch(fullPath);
    await this.currentPage.waitFor(RENDER_WAIT);
    return this.currentPage;
  }

  async switchTab(pagePath) {
    this._ensureConnected();
    const fullPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
    this.currentPage = await this.miniProgram.switchTab(fullPath);
    await this.currentPage.waitFor(RENDER_WAIT);
    return this.currentPage;
  }

  async getCurrentPage() {
    this._ensureConnected();
    this.currentPage = await this.miniProgram.currentPage();
    return this.currentPage;
  }

  // ===== UI 交互 =====

  async tap(selector) {
    this._ensurePage();
    const el = await this.currentPage.$(selector);
    if (!el) {
      throw new Error(`tap 失败: 元素不存在 selector="${selector}"`);
    }
    await el.tap();
    await this.currentPage.waitFor(500);
    // 刷新 currentPage（可能发生了跳转）
    this.currentPage = await this.miniProgram.currentPage();
    return el;
  }

  async exists(selector) {
    this._ensurePage();
    const el = await this.currentPage.$(selector);
    return el !== null && el !== undefined;
  }

  async getData(key) {
    this._ensurePage();
    if (key) {
      return await this.currentPage.data(key);
    }
    return await this.currentPage.data();
  }

  async waitFor(conditionOrMs) {
    this._ensurePage();
    await this.currentPage.waitFor(conditionOrMs);
    this.currentPage = await this.miniProgram.currentPage();
  }

  // ===== 截图 =====

  async screenshot(name) {
    this._ensureConnected();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);
    await this.miniProgram.screenshot({ path: filepath });
    return filepath;
  }

  // ===== 断言 =====

  assertPageIs(expectedPath) {
    if (!this.currentPage) {
      throw new AssertionError('assertPageIs', expectedPath, 'null (no current page)');
    }
    const actual = this.currentPage.path;
    const normalizedExpected = expectedPath.replace(/^\//, '');
    const normalizedActual = actual.replace(/^\//, '');
    if (normalizedActual !== normalizedExpected) {
      throw new AssertionError('assertPageIs', normalizedExpected, normalizedActual);
    }
  }

  assertEqual(label, expected, actual) {
    if (expected !== actual) {
      throw new AssertionError(label, expected, actual);
    }
  }

  assertTrue(label, value) {
    if (!value) {
      throw new AssertionError(label, 'truthy', value);
    }
  }

  assertNotNull(label, value) {
    if (value === null || value === undefined) {
      throw new AssertionError(label, 'non-null', value);
    }
  }

  // ===== 测试运行器 =====

  async runTests(testSuite) {
    const { name, tests } = testSuite;
    const results = {
      suite: name,
      timestamp: new Date().toISOString(),
      total: tests.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: [],
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试套件: ${name}`);
    console.log(`${'='.repeat(60)}\n`);

    for (const test of tests) {
      const testResult = {
        name: test.name,
        status: 'UNKNOWN',
        duration: 0,
        error: null,
        screenshot: null,
      };

      const startTime = Date.now();
      try {
        await withTimeout(test.fn(this), DEFAULT_TIMEOUT, test.name);
        testResult.status = 'PASS';
        testResult.duration = Date.now() - startTime;
        results.passed++;
        console.log(`  ✅ PASS | ${test.name} (${testResult.duration}ms)`);
      } catch (err) {
        testResult.status = 'FAIL';
        testResult.duration = Date.now() - startTime;
        testResult.error = {
          message: err.message,
          expected: err.expected || null,
          actual: err.actual || null,
        };
        results.failed++;

        // 失败时自动截图
        try {
          testResult.screenshot = await this.screenshot(`FAIL_${test.name.replace(/\s+/g, '_')}`);
        } catch (_) {
          // 截图失败不影响测试结果
        }

        console.log(`  ❌ FAIL | ${test.name} (${testResult.duration}ms)`);
        console.log(`         | 错误: ${err.message}`);
        if (err.expected !== undefined) {
          console.log(`         | 期望: ${JSON.stringify(err.expected)}`);
          console.log(`         | 实际: ${JSON.stringify(err.actual)}`);
        }
        if (testResult.screenshot) {
          console.log(`         | 截图: ${testResult.screenshot}`);
        }
      }

      results.tests.push(testResult);
    }

    // 输出汇总
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`汇总: ${results.passed} passed, ${results.failed} failed, ${results.total} total`);
    console.log(`${'─'.repeat(60)}\n`);

    // 输出 JSON 格式结果（供 Lovelace 解析）
    console.log('TEST_RESULTS_JSON:');
    console.log(JSON.stringify(results, null, 2));

    return results;
  }

  // ===== 内部辅助 =====

  _ensureConnected() {
    if (!this.miniProgram) {
      throw new Error('未连接 DevTools，请先调用 connect()');
    }
  }

  _ensurePage() {
    if (!this.currentPage) {
      throw new Error('无当前页面，请先导航到某个页面');
    }
  }
}

// ===== 自定义错误 =====

class AssertionError extends Error {
  constructor(label, expected, actual) {
    super(`断言失败 [${label}]: 期望 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`);
    this.name = 'AssertionError';
    this.expected = expected;
    this.actual = actual;
  }
}

// ===== 超时控制 =====

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`超时 (${ms}ms): ${label}`));
    }, ms);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

module.exports = { TestFramework, AssertionError, SCREENSHOT_DIR, PROJECT_PATH };
