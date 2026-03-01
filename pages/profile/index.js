Page({
  data: {
    userInfo: {},
    isAdminReal: false,
    currentEffectiveRole: 'student',
    viewAsRole: '',
    showRolePicker: false,
    roleOptions: [
      { name: '管理员', value: 'admin' },
      { name: '工作人员', value: 'staff' },
      { name: '司机', value: 'driver' },
      { name: '乘客', value: 'student' },
    ],
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

    const viewAsRole = app.getViewAsRole ? app.getViewAsRole() : '';
    const currentEffectiveRole = app.getEffectiveRole ? app.getEffectiveRole() : realRole;

    this.setData({
      userInfo,
      isAdminReal: realRole === 'admin',
      viewAsRole,
      currentEffectiveRole,
    });
  },

  onPullDownRefresh() {
    this.onShow();
    wx.stopPullDownRefresh();
  },

  goStudentRequest() {
    wx.navigateTo({ url: '/pages/student/request/index' });
  },

  openRolePicker() {
    if (!this.data.isAdminReal) return;
    this.setData({ showRolePicker: true });
  },

  closeRolePicker() {
    this.setData({ showRolePicker: false });
  },

  onSelectRole(e) {
    if (!this.data.isAdminReal) return;

    const detail = e && e.detail ? e.detail : {};
    let action = null;

    if (detail.index !== undefined && this.data.roleOptions[detail.index]) {
      action = this.data.roleOptions[detail.index];
    } else if (detail.name) {
      action = this.data.roleOptions.find((item) => item.name === detail.name) || null;
    }

    if (!action) return;

    const app = getApp();
    if (app && typeof app.setViewAsRole === 'function') {
      app.setViewAsRole(action.value);
    }

    const currentEffectiveRole = app.getEffectiveRole ? app.getEffectiveRole() : action.value;
    const viewAsRole = app.getViewAsRole ? app.getViewAsRole() : '';

    this.setData({
      showRolePicker: false,
      currentEffectiveRole,
      viewAsRole,
    });

    wx.showToast({
      title: action.value === 'admin' ? '已恢复管理员视角' : `已切换为${action.name}视角`,
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
