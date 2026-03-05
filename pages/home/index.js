const api = require('../../utils/api');
const { requestStatusText } = require('../../utils/status');
const { t } = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    userInfo: {},
    isManageRole: false,
    isStudent: true,
    canManageStaff: false,
    loadingMyInfo: false,
    latestRequest: null,
    myShiftTime: '--',
  },

  onLoad() {
    this.setData({
      i18n: {
        home_welcome: t('home_welcome'),
        home_current_user: t('home_current_user'),
        home_user_prefix: t('home_user_prefix'),
        home_apply_pickup: t('home_apply_pickup'),
        home_student_apply: t('home_student_apply'),
        home_manage_section: t('home_manage_section'),
        home_admin_dispatch: t('home_admin_dispatch'),
        home_driver_manage: t('home_driver_manage'),
        home_staff_manage: t('home_staff_manage'),
        home_my_pickup_info: t('home_my_pickup_info'),
        home_request_status: t('home_request_status'),
        home_my_shift_time: t('home_my_shift_time'),
        home_no_request: t('home_no_request'),
      },
    });
    wx.setNavigationBarTitle({ title: t('home_nav_title') });
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
