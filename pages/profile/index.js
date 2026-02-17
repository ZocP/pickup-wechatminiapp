Page({
  data: {
    userInfo: {},
    isAdminReal: false,
    viewAsUser: false,
  },

  onShow() {
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const realRole = userInfo.role || 'student';

    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: '/pages/profile/index' });
      if (typeof tabBar.refreshTabs === 'function') {
        tabBar.refreshTabs();
      }
    }

    this.setData({
      userInfo,
      isAdminReal: realRole === 'admin',
      viewAsUser: app.isViewingAsUser ? app.isViewingAsUser() : false,
    });
  },

  onPullDownRefresh() {
    this.onShow();
    wx.stopPullDownRefresh();
  },

  goStudentRequest() {
    wx.navigateTo({ url: '/pages/student/request/index' });
  },

  toggleUserView() {
    const app = getApp();
    const next = !(this.data.viewAsUser || false);
    const result = app.setViewAsUser ? app.setViewAsUser(next) : next;

    this.setData({ viewAsUser: result });
    wx.showToast({
      title: result ? '已切换为用户视角' : '已恢复管理员视角',
      icon: 'none',
    });

    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && typeof tabBar.refreshTabs === 'function') {
      tabBar.refreshTabs();
    }

    wx.switchTab({ url: '/pages/home/index' });
  },

  logout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录',
      success: (res) => {
        if (!res.confirm) return;
        getApp().onTokenExpired();
      },
    });
  },
});
