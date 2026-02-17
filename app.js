App({
  globalData: {
    userInfo: {
      id: 0,
      name: '',
      role: 'student', // 'student' | 'staff' | 'admin'
      phone: '',
    },
    viewAsUser: false,
  },

  onLaunch() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const viewAsUser = wx.getStorageSync('viewAsUser');

    if (userInfo && userInfo.role) {
      this.globalData.userInfo = userInfo;
    }

    this.globalData.viewAsUser = !!viewAsUser;

    if (!token) {
      this.toLogin();
    }
  },

  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo || this.globalData.userInfo;
    if (this.getRealRole() !== 'admin') {
      this.globalData.viewAsUser = false;
      wx.setStorageSync('viewAsUser', false);
    }
    wx.setStorageSync('userInfo', this.globalData.userInfo);
  },

  getRealRole() {
    const userInfo = this.globalData.userInfo || {};
    return userInfo.role || 'student';
  },

  getEffectiveRole() {
    const realRole = this.getRealRole();
    if (realRole === 'admin' && this.globalData.viewAsUser) {
      return 'student';
    }
    return realRole;
  },

  isViewingAsUser() {
    return !!this.globalData.viewAsUser;
  },

  setViewAsUser(nextValue) {
    const realRole = this.getRealRole();
    if (realRole !== 'admin') {
      this.globalData.viewAsUser = false;
      wx.setStorageSync('viewAsUser', false);
      return false;
    }

    const value = !!nextValue;
    this.globalData.viewAsUser = value;
    wx.setStorageSync('viewAsUser', value);
    return value;
  },

  onTokenExpired() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('viewAsUser');
    this.globalData.userInfo = { id: 0, name: '', role: 'student', phone: '' };
    this.globalData.viewAsUser = false;
    this.toLogin();
  },

  toLogin() {
    const pages = getCurrentPages();
    const current = pages.length ? pages[pages.length - 1] : null;
    const currentRoute = current ? `/${current.route}` : '';
    if (currentRoute !== '/pages/login/index') {
      wx.reLaunch({ url: '/pages/login/index' });
    }
  },
});
