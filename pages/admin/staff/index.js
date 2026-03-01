const api = require('../../../utils/api');

Page({
  data: {
    loading: false,
    userList: [],
    actingUserId: 0,
  },

  onShow() {
    const app = getApp();
    if (app.isWechatBound && !app.isWechatBound()) {
      wx.reLaunch({ url: '/pages/bind/index' });
      return;
    }

    const role = app.getEffectiveRole ? app.getEffectiveRole() : ((app.globalData.userInfo && app.globalData.userInfo.role) || 'student');
    if (role !== 'admin') {
      wx.showToast({ title: '仅管理员可访问', icon: 'none' });
      wx.switchTab({ url: '/pages/home/index' });
      return;
    }

    this.loadUsers();
  },

  async onPullDownRefresh() {
    await this.loadUsers();
    wx.stopPullDownRefresh();
  },

  async loadUsers() {
    this.setData({ loading: true });
    try {
      const res = await api.getUsers();
      const userList = Array.isArray(res) ? res : [];
      this.setData({ userList });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '用户列表加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onToggleStaff(e) {
    const detail = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const userId = Number(detail.id || 0);
    const role = detail.role || 'student';
    if (!userId || this.data.actingUserId) return;

    this.setData({ actingUserId: userId });
    try {
      if (role === 'staff') {
        await api.cancelUserAsStaff(userId);
        wx.showToast({ title: '已取消 staff', icon: 'success' });
      } else {
        await api.setUserAsStaff(userId);
        wx.showToast({ title: '已设为 staff', icon: 'success' });
      }
      await this.loadUsers();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '操作失败', icon: 'none' });
    } finally {
      this.setData({ actingUserId: 0 });
    }
  },
});