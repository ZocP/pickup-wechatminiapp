App({
  globalData: {
    userInfo: {
      id: 0,
      name: '',
      role: 'student', // 'student' | 'passenger' | 'staff' | 'admin' | 'driver'
      phone: '',
      wechat_id: '',
    },
    UserRolePassenger: 'passenger',
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
    } else {
      // 已登录用户，检查 token 验证状态
      this.checkTokenVerification();
    }
  },

  onShow() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.checkTokenVerification();
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

  /**
   * 检查微信绑定状态，未绑定则跳转绑定页
   * @returns {boolean} true=已绑定，false=未绑定（已跳转）
   */
  ensureWechatBound() {
    if (!this.isWechatBound()) {
      wx.reLaunch({ url: '/pages/bind/index' });
      return false;
    }
    return true;
  },

  /**
   * 标记 dashboard 需要刷新
   */
  markDashboardDirty() {
    this.globalData.dashboardNeedsRefresh = true;
  },

  isDashboardDirty() {
    return this.globalData.dashboardNeedsRefresh;
  },

  clearDashboardDirty() {
    this.globalData.dashboardNeedsRefresh = false;
  },

  getEffectiveRole() {
    const realRole = this.getRealRole();
    // Backward compat: treat 'student' as 'passenger' when appropriate
    if (realRole === 'passenger' || realRole === 'student') {
      if (realRole === 'admin' && this.globalData.viewAsRole) {
        return this.globalData.viewAsRole;
      }
      return realRole;
    }
    if (realRole === 'admin' && this.globalData.viewAsRole) {
      return this.globalData.viewAsRole;
    }
    return realRole;
  },

  isPassenger() {
    const role = this.getRealRole();
    const userInfo = this.globalData.userInfo || {};
    if (role === 'passenger' || role === 'student') return true;
    if ((role === 'admin' || role === 'staff') && userInfo.is_passenger) return true;
    return false;
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

    const allow = new Set(['admin', 'staff', 'driver', 'student', 'passenger']);
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
    wx.removeStorageSync('refresh_token');
    wx.removeStorageSync('userInfo');
    this.globalData.userInfo = { id: 0, name: '', role: 'student', phone: '', wechat_id: '' };
    this.globalData.viewAsRole = '';
    this.toLogin();
  },

  updateTabBar() {
    const pages = getCurrentPages();
    const currentPage = pages.length ? pages[pages.length - 1] : null;
    if (!currentPage) return;
    const tabBar = currentPage.getTabBar && currentPage.getTabBar();
    if (tabBar && typeof tabBar.refreshTabs === 'function') {
      tabBar.refreshTabs();
    }
  },

  checkTokenVerification() {
    const userInfo = this.globalData.userInfo || {};
    const role = userInfo.role || 'student';

    // 仅拦截未验证的 student
    if (role !== 'student') return;
    if (userInfo.token_verified === true) return;

    // 防止循环重定向
    const pages = getCurrentPages();
    const current = pages.length ? pages[pages.length - 1] : null;
    const currentRoute = current ? `/${current.route}` : '';
    if (currentRoute === '/pages/token/index') return;
    if (currentRoute === '/pages/login/index') return;

    wx.reLaunch({ url: '/pages/token/index' });
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
