const api = require('../../utils/api');

Page({
  data: {
    loading: false,
    verifying: false,
    name: '',
    wechatID: '',
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
      // Local state says bound — verify with backend before auto-redirecting.
      // This prevents a loop if the local state is stale (e.g. after DB rebuild).
      this.setData({ verifying: true });
      try {
        const me = await api.getAuthMe();
        const freshWechatID = String((me && me.wechat_id) || '').trim();
        if (freshWechatID) {
          // Backend confirms it's bound — update local state and proceed
          wx.setStorageSync('userInfo', me || {});
          app.setUserInfo(me || {});
          this.goNext();
        }
        // If freshWechatID is empty, fall through and show the bind form
      } catch (_err) {
        // If /auth/me fails (e.g. 401), the token is invalid — let the error handler deal with it
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
      wx.showToast({ title: '请填写真实姓名', icon: 'none' });
      return;
    }
    if (!/^[a-zA-Z0-9_]{6,20}$/.test(wechatID)) {
      wx.showToast({ title: '微信号格式不正确（6-20位字母数字下划线）', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      await api.bindProfile({ name, wechat_id: wechatID });
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
