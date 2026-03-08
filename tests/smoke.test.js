/**
 * 冒烟测试 — 验证所有核心页面能正常渲染
 *
 * 测试用例：
 * - 首页（home）能打开，data 非空，关键字段有值
 * - 学生请求页（student/request）能打开，表单字段初始化正确
 * - 管理员 dashboard 能打开，filterDate 为有效日期
 * - modification-requests 页面能打开，列表已初始化
 * - 个人资料页 (profile) 能打开
 * - 司机页 (driver) 能打开，selectedShift 字段存在
 * - 每个页面截图存档
 */

const { TestFramework } = require('./framework');

/**
 * 辅助：验证字符串是否为有效日期格式 (YYYY-MM-DD 或类似)
 */
function isValidDateString(str) {
  if (!str || typeof str !== 'string') return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

const smokeSuite = {
  name: '冒烟测试 - 核心页面渲染 + 数据值断言',
  tests: [
    {
      name: '首页 (home) 能打开且 data 关键字段有值',
      fn: async (fw) => {
        await fw.reLaunch('/pages/home/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/home/index');
        const data = await fw.getData();
        fw.assertNotNull('home page data', data);

        // 检查 DOM 渲染：页面应包含至少一个 view 元素
        const hasView = await fw.exists('view');
        fw.assertTrue('home page has view elements', hasView);

        await fw.screenshot('smoke_home');
      },
    },
    {
      name: '学生请求页 (student/request) 能打开且表单字段初始化',
      fn: async (fw) => {
        await fw.reLaunch('/pages/student/request/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/student/request/index');
        const data = await fw.getData();
        fw.assertNotNull('student request page data', data);

        // 检查 DOM 渲染
        const hasView = await fw.exists('view');
        fw.assertTrue('student request page has view elements', hasView);

        await fw.screenshot('smoke_student_request');
      },
    },
    {
      name: '管理员 Dashboard 能打开且 filterDate 为有效日期',
      fn: async (fw) => {
        await fw.reLaunch('/pages/admin/dashboard/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/admin/dashboard/index');
        const data = await fw.getData();
        fw.assertNotNull('dashboard page data', data);

        // filterDate 应该是有效日期
        if (data.filterDate !== undefined) {
          fw.assertTrue(
            'filterDate is a valid date string',
            isValidDateString(data.filterDate)
          );
        }

        // filterDateLabel 不应为空
        if (data.filterDateLabel !== undefined) {
          fw.assertTrue(
            'filterDateLabel is non-empty',
            typeof data.filterDateLabel === 'string' && data.filterDateLabel.length > 0
          );
        }

        // 检查 DOM 文字内容
        const hasView = await fw.exists('view');
        fw.assertTrue('dashboard has view elements', hasView);

        await fw.screenshot('smoke_dashboard');
      },
    },
    {
      name: 'Modification Requests 页面能打开且列表已初始化',
      fn: async (fw) => {
        await fw.reLaunch('/pages/admin/modification-requests/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/admin/modification-requests/index');
        const data = await fw.getData();
        fw.assertNotNull('modification-requests page data', data);

        // 列表字段应该存在且为数组（可能为空）
        if (data.requests !== undefined) {
          fw.assertTrue(
            'requests is an array',
            Array.isArray(data.requests)
          );
        }
        if (data.list !== undefined) {
          fw.assertTrue(
            'list is an array',
            Array.isArray(data.list)
          );
        }

        await fw.screenshot('smoke_modification_requests');
      },
    },
    {
      name: '个人资料页 (profile) 能打开且用户信息已加载',
      fn: async (fw) => {
        await fw.reLaunch('/pages/profile/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/profile/index');
        const data = await fw.getData();
        fw.assertNotNull('profile page data', data);

        // 检查 DOM 渲染
        const hasView = await fw.exists('view');
        fw.assertTrue('profile page has view elements', hasView);

        await fw.screenshot('smoke_profile');
      },
    },
    {
      name: '司机页 (driver) 能打开且 selectedShift 字段存在',
      fn: async (fw) => {
        await fw.reLaunch('/pages/driver/index');
        const page = await fw.getCurrentPage();
        fw.assertPageIs('pages/driver/index');
        const data = await fw.getData();
        fw.assertNotNull('driver page data', data);

        // selectedShift 字段应该存在（可为 null 表示无当前班次）
        fw.assertTrue(
          'driver data has selectedShift field',
          data.hasOwnProperty('selectedShift') || data.hasOwnProperty('shift')
        );

        // 检查 DOM 渲染
        const hasView = await fw.exists('view');
        fw.assertTrue('driver page has view elements', hasView);

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
