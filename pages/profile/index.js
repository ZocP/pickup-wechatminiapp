const { t, getLocale, setLocale } = require('../../utils/i18n');
const { setTabBarHidden } = require('../../utils/ui');

Page({
  data: {
    langLabel: '',
    i18n: {},
    userInfo: {},
    isAdminReal: false,
    currentEffectiveRole: 'student',
    viewAsRole: '',
    showRolePicker: false,
    roleOptions: [],
  },

  buildI18n() {
    return {
      profile_user_prefix: t('profile_user_prefix'),
      profile_role_label: t('profile_role_label'),
      profile_current_view: t('profile_current_view'),
      profile_role_admin: t('profile_role_admin'),
      profile_role_staff: t('profile_role_staff'),
      profile_role_driver: t('profile_role_driver'),
      profile_role_student: t('profile_role_student'),
      profile_wechat_label: t('profile_wechat_label'),
      profile_my_request: t('profile_my_request'),
      profile_switch_view: t('profile_switch_view'),
      profile_logout: t('profile_logout'),
      profile_role_picker_title: t('profile_role_picker_title'),
    };
  },

  onLoad() {
    this.setData({
      langLabel: getLocale() === 'zh-CN' ? 'EN' : '中',
      i18n: this.buildI18n(),
      roleOptions: [
        { name: t('profile_role_admin'), value: 'admin' },
        { name: t('profile_role_staff'), value: 'staff' },
        { name: t('profile_role_driver'), value: 'driver' },
        { name: t('profile_role_student'), value: 'student' },
      ],
    });
    wx.setNavigationBarTitle({ title: t('profile_nav_title') });
  },

  switchLang() {
    const next = getLocale() === 'zh-CN' ? 'en' : 'zh-CN';
    setLocale(next);
    wx.setStorageSync('locale', next);
    this.setData({
      langLabel: next === 'zh-CN' ? 'EN' : '中',
      i18n: this.buildI18n(),
      roleOptions: [
        { name: t('profile_role_admin'), value: 'admin' },
        { name: t('profile_role_staff'), value: 'staff' },
        { name: t('profile_role_driver'), value: 'driver' },
        { name: t('profile_role_student'), value: 'student' },
      ],
    });
    wx.setNavigationBarTitle({ title: t('profile_nav_title') });
    const app = getApp();
    app.updateTabBar();
  },

  onShow() {
    const app = getApp();
    if (!app.ensureWechatBound()) return;

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
      langLabel: getLocale() === 'zh-CN' ? 'EN' : '中',
      i18n: this.buildI18n(),
    });
    wx.setNavigationBarTitle({ title: t('profile_nav_title') });
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
    this.setTabBarHidden(true);
    this.setData({ showRolePicker: true });
  },

  closeRolePicker() {
    this.setTabBarHidden(false);
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

    this.setTabBarHidden(false);
    this.setData({
      showRolePicker: false,
      currentEffectiveRole,
      viewAsRole,
    });

    wx.showToast({
      title: action.value === 'admin' ? t('profile_switched_admin') : t('profile_switched_to') + action.name + t('profile_switched_suffix'),
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
      title: t('profile_logout_title'),
      content: t('profile_logout_content'),
      success: (res) => {
        if (!res.confirm) return;
        getApp().onTokenExpired();
      },
    });
  },

  setTabBarHidden(hidden) {
    setTabBarHidden(this, hidden);
  },
});
