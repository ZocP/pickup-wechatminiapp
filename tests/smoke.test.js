/**
 * 冒烟测试 — 验证所有核心页面能正常渲染
 *
 * 测试用例：
 * - 首页（home）能打开，data 非空
 * - 学生请求页（student/request）能打开
 * - 管理员 dashboard 能打开
 * - modification-requests 页面能打开
 * - 每个页面截图存档
 */

const { TestFramework } = require('./framework');

const smokeSuite = {
  name: '冒烟测试 - 核心页面渲染',
  tests: [
    {
      name: '首页 (home) 能打开且 data 非空',
      fn: async (fw) => {
        await fw.reLaunch('/pages/home/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/home/index');
        const data = await fw.getData();
        fw.assertNotNull('home page data', data);
        await fw.screenshot('smoke_home');
      },
    },
    {
      name: '学生请求页 (student/request) 能打开',
      fn: async (fw) => {
        await fw.reLaunch('/pages/student/request/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/student/request/index');
        const data = await fw.getData();
        fw.assertNotNull('student request page data', data);
        await fw.screenshot('smoke_student_request');
      },
    },
    {
      name: '管理员 Dashboard 能打开',
      fn: async (fw) => {
        await fw.reLaunch('/pages/admin/dashboard/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/admin/dashboard/index');
        const data = await fw.getData();
        fw.assertNotNull('dashboard page data', data);
        await fw.screenshot('smoke_dashboard');
      },
    },
    {
      name: 'Modification Requests 页面能打开',
      fn: async (fw) => {
        await fw.reLaunch('/pages/admin/modification-requests/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/admin/modification-requests/index');
        const data = await fw.getData();
        fw.assertNotNull('modification-requests page data', data);
        await fw.screenshot('smoke_modification_requests');
      },
    },
    {
      name: '个人资料页 (profile) 能打开',
      fn: async (fw) => {
        await fw.reLaunch('/pages/profile/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/profile/index');
        await fw.screenshot('smoke_profile');
      },
    },
    {
      name: '司机页 (driver) 能打开',
      fn: async (fw) => {
        await fw.reLaunch('/pages/driver/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/driver/index');
        await fw.screenshot('smoke_driver');
      },
    },
  ],
};

// 主入口
async function main() {
  const fw = new TestFramework();
  try {
    console.log('正在连接 DevTools...');
    await fw.connect();
    console.log('✅ 连接成功\n');

    const results = await fw.runTests(smokeSuite);
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('❌ 测试运行错误:', err.message);
    process.exit(1);
  } finally {
    await fw.close();
  }
}

main();
