const api = require('../../../utils/api');

function defaultForm() {
  return {
    name: '',
    car_model: '',
    max_seats: 6,
    max_checked: 4,
    max_carry_on: 2,
  };
}

Page({
  data: {
    loading: false,
    submitting: false,
    driverList: [],
    showAddPopup: false,
    form: defaultForm(),
  },

  onShow() {
    const app = getApp();
    if (app.isWechatBound && !app.isWechatBound()) {
      wx.reLaunch({ url: '/pages/bind/index' });
      return;
    }
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
      const [driversRes, usersRes] = await Promise.all([
        api.getDrivers(),
        api.getUsers(),
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
          name: u.name || u.real_name || driver.name || `用户#${u.id}`,
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
      wx.showToast({ title: '司机列表加载失败', icon: 'none' });
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
      wx.showToast({ title: '请填写姓名和车型', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      await api.createDriver(payload);
      wx.showToast({ title: '录入成功', icon: 'success' });
      this.setData({ showAddPopup: false });
      this.resetForm();
      await this.loadDrivers();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '录入失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
