const automator = require('miniprogram-automator');

async function verify() {
  console.log('正在连接 DevTools...');
  const miniProgram = await automator.launch({
    projectPath: '/Users/kj/projects/pickup-wechatminiapp',
  });
  console.log('✅ automator 连接成功');
  
  const page = await miniProgram.currentPage();
  console.log('当前页面:', page.path);
  
  await miniProgram.screenshot({ path: '/tmp/automator-verify.png' });
  console.log('✅ 截图成功: /tmp/automator-verify.png');
  
  await miniProgram.close();
  console.log('✅ 环境验证完成，automator 一切正常');
}

verify().catch(e => {
  console.error('❌ 验证失败:', e.message);
  process.exit(1);
});
