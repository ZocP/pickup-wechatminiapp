const automator = require('miniprogram-automator');
(async () => {
  const mp = await automator.launch({ projectPath: '/Users/kj/projects/pickup-wechatminiapp', devToolsInstallPath: '/Applications/wechatwebdevtools.app' });
  const page = await mp.switchTab('/pages/admin/dashboard/index');
  await new Promise(r => setTimeout(r, 1500));
  const items = await page.$$('.action-item');
  console.log('items count:', items.length);
  if (items.length > 0) {
    const item = items[0];
    console.log('element methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(item)).join(', '));
    // Try to get bounding rect
    try {
      const rect = await item.boundingRect();
      console.log('boundingRect:', JSON.stringify(rect));
    } catch(e) { console.log('boundingRect failed:', e.message); }
    try {
      const rect = await item.bounding();
      console.log('bounding:', JSON.stringify(rect));
    } catch(e) { console.log('bounding failed:', e.message); }
    try {
      const text = await item.text();
      console.log('text:', text);
    } catch(e) { console.log('text failed:', e.message); }
    try {
      const attr = await item.attribute('style');
      console.log('style attr:', attr);
    } catch(e) { console.log('attribute failed:', e.message); }
  }
  await mp.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
