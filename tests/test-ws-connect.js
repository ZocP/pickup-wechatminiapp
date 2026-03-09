const automator = require('miniprogram-automator');

(async () => {
  try {
    console.log('Trying http endpoint...');
    const miniProgram = await automator.connect({
      wsEndpoint: 'ws://127.0.0.1:48842',
    });
    console.log('Connected!');
    await miniProgram.disconnect();
  } catch(e) {
    console.log('WS failed:', e.message);
  }
  
  // Try the CLI approach
  try {
    console.log('\nTrying launch...');
    const miniProgram = await automator.launch({
      projectPath: '/Users/kj/projects/pickup-wechatminiapp',
      devToolsInstallPath: '/Applications/wechatwebdevtools.app',
    });
    console.log('Launched!');
    await miniProgram.disconnect();
  } catch(e) {
    console.log('Launch failed:', e.message);
  }
})();
