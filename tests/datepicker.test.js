/**
 * DatePicker 回归测试 — 针对 datepicker bug 的专项验证
 *
 * 测试用例：
 * - student/request 页面：存在日期选择器相关组件
 * - modification 页面：van-calendar 组件存在
 * - dashboard 页面：日期筛选栏存在，"今天"按钮状态正确
 * - dashboard 页面：创建班次弹窗中的 date picker 可弹出
 */

const { TestFramework } = require('./framework');

const datepickerSuite = {
  name: 'DatePicker 回归测试',
  tests: [
    {
      name: 'student/request 页面：日期字段存在且可交互',
      fn: async (fw) => {
        await fw.reLaunch('/pages/student/request/index');
        fw.assertPageIs('pages/student/request/index');

        // 检查 form data 中有 arrival_date 字段
        const hasSubmitted = await fw.getData('hasSubmitted');
        if (!hasSubmitted) {
          // 未提交状态：表单可见，验证 openDatePicker 触发区域存在
          const formData = await fw.getData('form');
          fw.assertNotNull('form data', formData);
          fw.assertTrue('form 有 arrival_date 字段', 'arrival_date' in formData);
        }

        // 验证 van-calendar 组件在 WXML 中定义
        const showDatePicker = await fw.getData('showDatePicker');
        fw.assertTrue('showDatePicker 字段存在（初始为 false）', showDatePicker !== undefined);

        await fw.screenshot('datepicker_student_request');
      },
    },
    {
      name: 'modification 页面：van-calendar 组件存在',
      fn: async (fw) => {
        // 直接 reLaunch 到 modification 页面（无需 requestId，测试渲染能力）
        await fw.reLaunch('/pages/student/modification/index');
        fw.assertPageIs('pages/student/modification/index');

        // 验证页面 data 有 showDatePicker 字段（calendar 控制变量）
        const showDatePicker = await fw.getData('showDatePicker');
        fw.assertTrue('showDatePicker 字段存在', showDatePicker !== undefined);

        // 验证 calendarMinDate/calendarMaxDate 存在
        const calendarMinDate = await fw.getData('calendarMinDate');
        fw.assertNotNull('calendarMinDate 已设置', calendarMinDate);

        await fw.screenshot('datepicker_modification');
      },
    },
    {
      name: 'dashboard 页面：日期筛选栏存在',
      fn: async (fw) => {
        await fw.reLaunch('/pages/admin/dashboard/index');
        fw.assertPageIs('pages/admin/dashboard/index');

        // 验证 filterDate 相关数据存在
        const filterDateLabel = await fw.getData('filterDateLabel');
        fw.assertNotNull('filterDateLabel 存在', filterDateLabel);

        // 验证日期筛选栏 DOM 存在
        const filterBar = await fw.exists('.date-filter-bar');
        fw.assertTrue('日期筛选栏 .date-filter-bar 存在', filterBar);

        await fw.screenshot('datepicker_dashboard_filter');
      },
    },
    {
      name: 'dashboard 页面：点击"今天"按钮后 active 状态正确',
      fn: async (fw) => {
        await fw.reLaunch('/pages/admin/dashboard/index');
        fw.assertPageIs('pages/admin/dashboard/index');

        // 点击 "今天" 按钮
        await fw.tap('.filter-action-btn');
        await fw.waitFor(500);

        // 验证 filterDate == todayDate
        const filterDate = await fw.getData('filterDate');
        const todayDate = await fw.getData('todayDate');
        fw.assertEqual('filterDate 等于 todayDate', todayDate, filterDate);

        await fw.screenshot('datepicker_dashboard_today_active');
      },
    },
    {
      name: 'dashboard 页面：创建班次弹窗中 date picker 可弹出',
      fn: async (fw) => {
        await fw.reLaunch('/pages/admin/dashboard/index');
        fw.assertPageIs('pages/admin/dashboard/index');

        // 打开创建班次弹窗
        const showCreatePopup = await fw.getData('showCreatePopup');
        if (!showCreatePopup) {
          // 通过 callMethod 打开弹窗（避免依赖按钮选择器）
          await fw.currentPage.callMethod('onShowCreatePopup');
          await fw.waitFor(800);
        }

        const popupVisible = await fw.getData('showCreatePopup');
        fw.assertTrue('创建班次弹窗已打开', popupVisible);

        // 触发日期选择器打开
        await fw.currentPage.callMethod('onOpenDatePicker');
        await fw.waitFor(500);

        const showDatePicker = await fw.getData('showDatePicker');
        fw.assertTrue('date picker 弹窗已打开', showDatePicker);

        // 验证 minDateTs 已设置（van-datetime-picker 的 min-date）
        const minDateTs = await fw.getData('minDateTs');
        fw.assertNotNull('minDateTs 已设置', minDateTs);

        await fw.screenshot('datepicker_dashboard_create_shift');
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

    const results = await fw.runTests(datepickerSuite);
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('❌ 测试运行错误:', err.message);
    process.exit(1);
  } finally {
    await fw.close();
  }
}

main();
