const api = require('../../utils/api');

Page({
  data: {
    loading: false,
    name: '',
    wechatID: '',
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
