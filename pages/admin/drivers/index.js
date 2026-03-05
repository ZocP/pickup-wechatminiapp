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
      const app = getApp();
      const isAdmin = (app.globalData?.userInfo?.role || app.globalData?.role) === 'admin';
      const [driversRes, usersRes] = await Promise.all([
        api.getDrivers(),
        isAdmin ? api.getUsers() : Promise.resolve([]),
      ]);

      const drivers = Array.isArray(driversRes) ? driversRes : [];
      const users = Array.isArray(usersRes) ? usersRes : [];
      const driverMap = new Map(drivers.map((d) => [String(d.id), d]));

      const driverUsers = users.filter((u) => {
        const role = String(u.role || '').toLowerCase();
        return role === 'driver' || u.driver_id || u.driverId;
      });

      const merged = driverUsers.map((u) => {
        const driverId = u.driver_id || u.driverId || '';
        const driver = driverMap.get(String(driverId)) || {};
        return {
          id: u.id,
          name: u.name || u.real_name || driver.name || `${t('common_student_prefix')}${u.id}`,
          car_model: driver.car_model || driver.vehicle_model || driver.vehicle_plate || '--',
          max_seats: driver.max_seats || driver.max_passengers || 0,
          max_checked: driver.max_checked || driver.max_checked_luggage || 0,
          max_carry_on: driver.max_carry_on || driver.max_carry_on_luggage || 0,
        };
      });

      this.setData({
        driverList: merged.length ? merged : drivers,
      });
    } catch (error) {
      wx.showToast({ title: t('drivers_load_failed'), icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
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
