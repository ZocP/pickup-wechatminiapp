const api = require('../../../utils/api');

Page({
  data: {
    loading: false,
    userList: [],
    driverList: [],
    actingUserId: 0,
    showDriverPicker: false,
    driverActions: [],
    targetUserIdForDriver: 0,
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

    this.loadAll();
  },

  async onPullDownRefresh() {
    await this.loadAll();
    wx.stopPullDownRefresh();
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const [usersRes, driversRes] = await Promise.all([api.getUsers(), api.getDrivers()]);
      const userList = Array.isArray(usersRes) ? usersRes : [];
      const driverList = Array.isArray(driversRes) ? driversRes : [];
      this.setData({ userList, driverList });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '数据加载失败', icon: 'none' });
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
      await this.loadAll();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '操作失败', icon: 'none' });
    } finally {
      this.setData({ actingUserId: 0 });
    }
  },

  onSetDriver(e) {
    const detail = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const userId = Number(detail.id || 0);
    if (!userId) return;

    const driverActions = (this.data.driverList || []).map((d) => ({
      name: `${d.name} | ${d.car_model}`,
      driverId: d.id,
    }));

    if (!driverActions.length) {
      wx.showToast({ title: '请先创建司机档案', icon: 'none' });
      return;
    }

    this.setTabBarHidden(true);
    this.setData({ showDriverPicker: true, driverActions, targetUserIdForDriver: userId });
  },

  async onSelectDriver(e) {
    const detail = e && e.detail ? e.detail : {};
    const action = detail.index !== undefined ? this.data.driverActions[detail.index] : null;
    const userId = this.data.targetUserIdForDriver;
    if (!action || !userId) return;

    this.setData({ actingUserId: userId });
    try {
      await api.setUserAsDriver(userId, action.driverId);
      wx.showToast({ title: '已设为司机', icon: 'success' });
      this.onCloseDriverPicker();
      await this.loadAll();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '设为司机失败', icon: 'none' });
    } finally {
      this.setData({ actingUserId: 0 });
    }
  },

  async onUnsetDriver(e) {
    const detail = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const userId = Number(detail.id || 0);
    if (!userId || this.data.actingUserId) return;

    this.setData({ actingUserId: userId });
    try {
      await api.cancelUserAsDriver(userId);
      wx.showToast({ title: '已取消司机', icon: 'success' });
      await this.loadAll();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '取消司机失败', icon: 'none' });
    } finally {
      this.setData({ actingUserId: 0 });
    }
  },

  onCloseDriverPicker() {
    this.setTabBarHidden(false);
    this.setData({ showDriverPicker: false, driverActions: [], targetUserIdForDriver: 0 });
  },

  setTabBarHidden(hidden) {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && typeof tabBar.setHidden === 'function') {
      tabBar.setHidden(!!hidden);
    }
  },
});