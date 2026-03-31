const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');
const { setTabBarHidden } = require('../../../utils/ui');

function buildI18n() {
  return {
    staff_role_management:    t('staff_role_management'),
    staff_no_users:           t('staff_no_users'),
    staff_wechat_label:       t('staff_wechat_label'),
    staff_operate:            t('staff_operate'),
    staff_role_actions_title: t('staff_role_actions_title'),
    staff_driver_picker_title:t('staff_driver_picker_title'),
    common_student_prefix:    t('common_student_prefix'),
    staff_search_placeholder: t('staff_search_placeholder'),
    staff_search_result_count:t('staff_search_result_count'),
  };
}

Page({
  data: {
    loading: false,
    userList: [],
    filteredUserList: [],
    searchKeyword: '',
    driverList: [],
    actingUserId: 0,
    showDriverPicker: false,
    driverActions: [],
    targetUserIdForDriver: 0,
    showRoleActions: false,
    roleActions: [],
    targetUserIdForAction: 0,
    targetUserRoleForAction: '',
    i18n: buildI18n(),
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('staff_nav_title') });
    this.setData({ i18n: buildI18n() });
  },

  onShow() {
    const app = getApp();
    if (!app.ensureWechatBound()) return;

    const role = app.getEffectiveRole ? app.getEffectiveRole() : ((app.globalData.userInfo && app.globalData.userInfo.role) || 'student');
    if (role !== 'admin') {
      wx.showToast({ title: t('common_admin_only'), icon: 'none' });
      wx.switchTab({ url: '/pages/home/index' });
      return;
    }

    wx.setNavigationBarTitle({ title: t('staff_nav_title') });
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
      this._applyFilter();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || t('staff_load_failed'), icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSearchChange(e) {
    const keyword = (e.detail || '').trim();
    this.setData({ searchKeyword: keyword });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this._applyFilter();
    }, 300);
  },

  onSearchClear() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.setData({ searchKeyword: '' });
    this._applyFilter();
  },

  _applyFilter() {
    const keyword = (this.data.searchKeyword || '').toLowerCase();
    const userList = this.data.userList || [];
    if (!keyword) {
      this.setData({ filteredUserList: userList });
      return;
    }
    const filtered = userList.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const wechatId = (item.wechat_id || '').toLowerCase();
      return name.includes(keyword) || wechatId.includes(keyword);
    });
    this.setData({ filteredUserList: filtered });
  },

  async onToggleStaff(e) {
    const detail = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const userId = Number(detail.id || 0);
    const role = detail.role || 'student';
    await this.toggleStaff(userId, role);
  },

  async toggleStaff(userId, role) {
    if (!userId || this.data.actingUserId) return;

    this.setData({ actingUserId: userId });
    try {
      if (role === 'staff') {
        await api.cancelUserAsStaff(userId);
        wx.showToast({ title: t('staff_unset_staff_success'), icon: 'success' });
      } else {
        await api.setUserAsStaff(userId);
        wx.showToast({ title: t('staff_set_staff_success'), icon: 'success' });
      }
      await this.loadAll();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || t('staff_op_failed'), icon: 'none' });
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
      wx.showToast({ title: t('staff_no_driver_profiles'), icon: 'none' });
      return;
    }

    this.setTabBarHidden(true);
    this.setData({ showDriverPicker: true, driverActions, targetUserIdForDriver: userId });
  },

  async onSelectDriver(e) {
    const detail = e && e.detail ? e.detail : {};
    const action = detail || null;
    const userId = this.data.targetUserIdForDriver;
    if (!action || !userId) return;

    this.setData({ actingUserId: userId });
    try {
      await api.setUserAsDriver(userId, action.driverId);
      wx.showToast({ title: t('staff_set_driver_success'), icon: 'success' });
      this.onCloseDriverPicker();
      await this.loadAll();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || t('staff_set_driver_failed'), icon: 'none' });
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
      wx.showToast({ title: t('staff_unset_driver_success'), icon: 'success' });
      await this.loadAll();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || t('staff_unset_driver_failed'), icon: 'none' });
    } finally {
      this.setData({ actingUserId: 0 });
    }
  },

  onOpenRoleActions(e) {
    const detail = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const userId = Number(detail.id || 0);
    const role = detail.role || 'student';
    if (!userId) return;

    const actions = [];
    actions.push({
      name: role === 'staff' ? t('staff_action_unset_staff') : t('staff_action_set_staff'),
      action: 'toggleStaff',
    });
    if (role === 'driver') {
      actions.push({ name: t('staff_action_unset_driver'), action: 'unsetDriver' });
    } else {
      actions.push({ name: t('staff_action_set_driver'), action: 'setDriver' });
    }

    this.setData({
      showRoleActions: true,
      roleActions: actions,
      targetUserIdForAction: userId,
      targetUserRoleForAction: role,
    });
  },

  onSelectRoleAction(e) {
    const action = e && e.detail ? e.detail : null;
    const userId = this.data.targetUserIdForAction;
    const role = this.data.targetUserRoleForAction;
    if (!action || !userId) return;

    if (action.action === 'toggleStaff') {
      this.toggleStaff(userId, role);
    } else if (action.action === 'setDriver') {
      this.onSetDriver({ currentTarget: { dataset: { id: userId } } });
    } else if (action.action === 'unsetDriver') {
      this.onUnsetDriver({ currentTarget: { dataset: { id: userId } } });
    }

    this.onCloseRoleActions();
  },

  onCloseRoleActions() {
    this.setData({
      showRoleActions: false,
      roleActions: [],
      targetUserIdForAction: 0,
      targetUserRoleForAction: '',
    });
  },

  onCloseDriverPicker() {
    this.setTabBarHidden(false);
    this.setData({ showDriverPicker: false, driverActions: [], targetUserIdForDriver: 0 });
  },

  setTabBarHidden(hidden) {
    setTabBarHidden(this, hidden);
  },
});
