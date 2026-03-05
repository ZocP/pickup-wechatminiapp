App({
  globalData: {
    userInfo: {
      id: 0,
      name: '',
      role: 'student', // 'student' | 'staff' | 'admin' | 'driver'
      phone: '',
      wechat_id: '',
    },
    viewAsRole: '', // '' means no simulation
    dashboardCache: {
      lastLoadAt: 0,
      ttlMs: 45 * 1000,
    },
    dashboardNeedsRefresh: false,
  },

  onLaunch() {
    const { setLocale } = require('./utils/i18n');
    const savedLocale = wx.getStorageSync('locale') || 'zh-CN';
    setLocale(savedLocale);

    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    if (userInfo && userInfo.role) {
      this.globalData.userInfo = userInfo;
    }

    // 会话级模拟态：不持久化
    this.globalData.viewAsRole = '';

    if (!token) {
      this.toLogin();
    }
  },

  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo || this.globalData.userInfo;
    if (this.getRealRole() !== 'admin') {
      this.globalData.viewAsRole = '';
    }
    wx.setStorageSync('userInfo', this.globalData.userInfo);
  },

  getRealRole() {
    const userInfo = this.globalData.userInfo || {};
    return userInfo.role || 'student';
  },

  isWechatBound() {
    const userInfo = this.globalData.userInfo || {};
    return !!String(userInfo.wechat_id || '').trim();
  },

  getEffectiveRole() {
    const realRole = this.getRealRole();
    if (realRole === 'admin' && this.globalData.viewAsRole) {
      return this.globalData.viewAsRole;
    }
    return realRole;
  },

  getViewAsRole() {
    return this.globalData.viewAsRole || '';
  },

  setViewAsRole(nextRole) {
    const realRole = this.getRealRole();
    if (realRole !== 'admin') {
      this.globalData.viewAsRole = '';
      return '';
    }

    const allow = new Set(['admin', 'staff', 'driver', 'student']);
    const target = String(nextRole || '').trim().toLowerCase();

    if (!target || target === 'admin') {
      this.globalData.viewAsRole = '';
      return '';
    }

    if (!allow.has(target)) {
      return this.globalData.viewAsRole || '';
    }

    this.globalData.viewAsRole = target;
    return target;
  },

  resetViewAsRole() {
    this.globalData.viewAsRole = '';
    return '';
  },

  onTokenExpired() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    this.globalData.userInfo = { id: 0, name: '', role: 'student', phone: '', wechat_id: '' };
    this.globalData.viewAsRole = '';
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
