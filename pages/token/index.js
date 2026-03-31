const api = require('../../utils/api');
const { t } = require('../../utils/i18n');

Page({
  data: {
    code: '',
    loading: false,
    errorMsg: '',
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('token_nav_title') });
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

      wx.showToast({ title: t('token_verify_success'), icon: 'success' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/home/index' });
      }, 800);
    } catch (err) {
      const data = err && err.data;
      const serverError = data && (data.error || data.message);
      let msg = t('token_verify_failed');

      if (serverError) {
        const errorMap = {
          'token_not_found': t('token_err_not_found'),
          'token_already_used': t('token_err_used'),
          'token_expired': t('token_err_expired'),
          'token_revoked': t('token_err_revoked'),
          'invalid_code': t('token_err_not_found'),
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
