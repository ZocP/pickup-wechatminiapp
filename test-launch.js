const automator = require('miniprogram-automator');

async function main() {
  console.log('Launching with automator...');
  try {
    const miniProgram = await automator.launch({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      projectPath: '/Users/kj/projects/pickup-wechatminiapp',
      port: 9421,
      timeout: 60000,
    });
    console.log('Connected!');
    const page = await miniProgram.currentPage();
    console.log('Current page:', page ? page.path : 'none');
    await miniProgram.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
  }
}

main();
