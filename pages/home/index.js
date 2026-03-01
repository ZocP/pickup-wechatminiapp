const api = require('../../utils/api');
const { requestStatusText } = require('../../utils/status');

Page({
  data: {
    userInfo: {},
    isManageRole: false,
    isStudent: true,
    canManageStaff: false,
    loadingMyInfo: false,
    latestRequest: null,
    myShiftTime: '--',
  },

  onShow() {
    const app = getApp();
    if (app.isWechatBound && !app.isWechatBound()) {
      wx.reLaunch({ url: '/pages/bind/index' });
      return;
    }

    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const role = app.getEffectiveRole ? app.getEffectiveRole() : (userInfo.role || 'student');

    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: '/pages/home/index' });
      if (typeof tabBar.refreshTabs === 'function') {
        tabBar.refreshTabs();
      }
    }

    this.setData({
      userInfo,
      isManageRole: role === 'admin' || role === 'staff',
      isStudent: role === 'student',
      canManageStaff: role === 'admin',
    });

    if (role === 'student') {
      this.loadMySummary();
    } else {
      this.setData({ latestRequest: null, myShiftTime: '--' });
    }
  },

  async onPullDownRefresh() {
    const role = this.data.isStudent ? 'student' : 'manage';
    try {
      if (role === 'student') {
        await this.loadMySummary();
      }
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async loadMySummary() {
    this.setData({ loadingMyInfo: true });
    try {
      const list = await api.getMyStudentRequests();

      const requests = Array.isArray(list) ? list : [];
      const latest = requests[0] || null;
      const shiftTime = latest && latest.shift && latest.shift.departure_time ? latest.shift.departure_time : '--';

      this.setData({
        latestRequest: latest ? { ...latest, status_text: requestStatusText(latest.status) } : null,
        myShiftTime: shiftTime,
      });
    } catch (error) {
      this.setData({ latestRequest: null, myShiftTime: '--' });
    } finally {
      this.setData({ loadingMyInfo: false });
    }
  },

  goStudentRequest() {
    wx.navigateTo({ url: '/pages/student/request/index' });
  },

  goDashboard() {
    wx.switchTab({ url: '/pages/admin/dashboard/index' });
  },

  goDriverManage() {
    wx.navigateTo({ url: '/pages/admin/drivers/index' });
  },

  goStaffManage() {
    wx.navigateTo({ url: '/pages/admin/staff/index' });
  },
});
