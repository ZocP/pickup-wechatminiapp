const api = require('../../utils/api');
const { t } = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    loading: false,
    verifying: false,
    name: '',
    wechatID: '',
  },

  onLoad() {
    this.setData({
      i18n: {
        bind_verifying: t('bind_verifying'),
        bind_title: t('bind_title'),
        bind_subtitle: t('bind_subtitle'),
        bind_notice: t('bind_notice'),
        bind_name_label: t('bind_name_label'),
        bind_name_placeholder: t('bind_name_placeholder'),
        bind_wechat_label: t('bind_wechat_label'),
        bind_wechat_placeholder: t('bind_wechat_placeholder'),
        bind_submit: t('bind_submit'),
        bind_logout: t('bind_logout'),
      },
    });
    wx.setNavigationBarTitle({ title: t('bind_nav_title') });
  },

  async onShow() {
    const app = getApp();
    const token = wx.getStorageSync('token');
    if (!token) {
      app.toLogin();
      return;
    }

    const bound = app.isWechatBound ? app.isWechatBound() : false;
    if (bound) {
      this.setData({ verifying: true });
      try {
        const me = await api.getAuthMe();
        const freshWechatID = String((me && me.wechat_id) || '').trim();
        if (freshWechatID) {
          wx.setStorageSync('userInfo', me || {});
          app.setUserInfo(me || {});
          this.goNext();
        }
      } catch (_err) {
        // If /auth/me fails, let the error handler deal with it
      } finally {
        this.setData({ verifying: false });
      }
      return;
    }
  },

  onNameChange(e) {
    this.setData({ name: (e && e.detail) || '' });
  },

  onWechatIDChange(e) {
    this.setData({ wechatID: (e && e.detail) || '' });
  },

  async onBindWechatID() {
    if (this.data.loading) return;

    const name = String(this.data.name || '').trim();
    const wechatID = String(this.data.wechatID || '').trim();
    if (!name) {
      wx.showToast({ title: t('bind_name_required'), icon: 'none' });
      return;
    }
    if (!/^[a-zA-Z0-9_]{6,20}$/.test(wechatID)) {
      wx.showToast({ title: t('bind_wechat_invalid'), icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      await api.bindProfile({ name, wechat_id: wechatID });
      const me = await api.getAuthMe();
      wx.setStorageSync('userInfo', me || {});
      getApp().setUserInfo(me || {});
      wx.showToast({ title: t('bind_success'), icon: 'success' });
      this.goNext();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || t('bind_failed'), icon: 'none' });
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
