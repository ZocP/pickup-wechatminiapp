const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');

function defaultForm() {
  return {
    name: '',
    car_model: '',
    max_seats: 6,
    max_checked: 4,
    max_carry_on: 2,
  };
}

function buildI18n() {
  return {
    drivers_title:          t('drivers_title'),
    drivers_no_drivers:     t('drivers_no_drivers'),
    drivers_add_btn:        t('drivers_add_btn'),
    drivers_popup_title:    t('drivers_popup_title'),
    drivers_field_name:     t('drivers_field_name'),
    drivers_field_car_model:t('drivers_field_car_model'),
    drivers_name_placeholder:t('drivers_name_placeholder'),
    drivers_car_placeholder:t('drivers_car_placeholder'),
    drivers_max_seats:      t('drivers_max_seats'),
    drivers_max_checked:    t('drivers_max_checked'),
    drivers_max_carry_on:   t('drivers_max_carry_on'),
    drivers_submit:         t('drivers_submit'),
    drivers_active_shifts:  t('drivers_active_shifts'),
    drivers_loaded:         t('drivers_loaded'),
  };
}

Page({
  data: {
    loading: false,
    submitting: false,
    driverList: [],
    showAddPopup: false,
    form: defaultForm(),
    i18n: buildI18n(),
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('drivers_nav_title') });
    this.setData({ i18n: buildI18n() });
  },

  onShow() {
    const app = getApp();
    if (app.isWechatBound && !app.isWechatBound()) {
      wx.reLaunch({ url: '/pages/bind/index' });
      return;
    }
    wx.setNavigationBarTitle({ title: t('drivers_nav_title') });
    this.setData({ i18n: buildI18n() });
    this.loadDrivers();
  },

  async onPullDownRefresh() {
    try {
      await this.loadDrivers();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async loadDrivers() {
    this.setData({ loading: true });
    try {
      const driversRes = await api.getDrivers();
      const drivers = Array.isArray(driversRes) ? driversRes : [];
      this.setData({ driverList: drivers });
    } catch (error) {
      wx.showToast({ title: t('drivers_load_failed'), icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goToDriverDetail(e) {
    const driverId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/admin/driver-detail/index?id=${driverId}` });
  },

  onShowAddDriver() {
    this.setData({ showAddPopup: true });
  },

  onCloseAddDriver() {
    this.setData({ showAddPopup: false });
  },

  onFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: e.detail,
    });
  },

  onSeatsChange(e) {
    this.setData({ 'form.max_seats': e.detail });
  },

  onCheckedChange(e) {
    this.setData({ 'form.max_checked': e.detail });
  },

  onCarryOnChange(e) {
    this.setData({ 'form.max_carry_on': e.detail });
  },

  resetForm() {
    this.setData({
      form: defaultForm(),
    });
  },

  async onSubmitDriver() {
    if (this.data.submitting) return;

    const payload = { ...this.data.form };
    if (!payload.name || !payload.car_model) {
      wx.showToast({ title: t('drivers_form_incomplete'), icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      await api.createDriver(payload);
      wx.showToast({ title: t('drivers_add_success'), icon: 'success' });
      this.setData({ showAddPopup: false });
      this.resetForm();
      await this.loadDrivers();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || t('drivers_add_failed'), icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
