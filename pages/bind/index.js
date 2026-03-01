const api = require('../../utils/api');

Page({
  data: {
    loading: false,
  },

  onShow() {
    const app = getApp();
    const token = wx.getStorageSync('token');
    if (!token) {
      app.toLogin();
      return;
    }

    const bound = app.isWechatBound ? app.isWechatBound() : false;
    if (bound) {
      this.goNext();
    }
  },

  async onGetPhoneNumber(e) {
    if (this.data.loading) return;

    const detail = (e && e.detail) || {};
    const code = detail.code;
    if (!code) {
      wx.showToast({ title: '请授权获取微信手机号', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      await api.bindPhone(code);
      const me = await api.getAuthMe();
      wx.setStorageSync('userInfo', me || {});
      getApp().setUserInfo(me || {});
      wx.showToast({ title: '绑定成功', icon: 'success' });
      this.goNext();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '绑定失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goNext() {
    const app = getApp();
    const role = app.getEffectiveRole ? app.getEffectiveRole() : 'student';
    if (role === 'admin' || role === 'staff') {
      wx.switchTab({ url: '/pages/admin/dashboard/index' });
    } else {
      wx.switchTab({ url: '/pages/home/index' });
    }
  },

  logout() {
    getApp().onTokenExpired();
  },
});
