const api = require('../../utils/api');

Page({
  data: {
    code: '',
    loading: false,
    errorMsg: '',
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '注册验证' });
  },

  onCodeInput(e) {
    const value = (e.detail || '').trim();
    this.setData({ code: value, errorMsg: '' });
  },

  async onSubmit() {
    const code = this.data.code.trim();
    if (code.length < 8) return;
    if (this.data.loading) return;

    this.setData({ loading: true, errorMsg: '' });

    try {
      await api.verifyToken(code);

      // 更新本地用户信息
      const userInfo = wx.getStorageSync('userInfo') || {};
      userInfo.token_verified = true;
      wx.setStorageSync('userInfo', userInfo);
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.userInfo = userInfo;
      }

      wx.showToast({ title: '验证成功', icon: 'success' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/home/index' });
      }, 800);
    } catch (err) {
      const data = err && err.data;
      const serverError = data && (data.error || data.message);
      let msg = '验证失败，请重试';

      if (serverError) {
        const errorMap = {
          'token_not_found': '注册码无效',
          'token_already_used': '注册码已被使用',
          'token_expired': '注册码已过期',
          'token_revoked': '注册码已作废',
          'invalid_code': '注册码无效',
        };
        msg = errorMap[serverError] || serverError;
      }

      this.setData({ errorMsg: msg });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 禁止返回
  onUnload() {},
});
