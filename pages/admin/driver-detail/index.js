const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');
const { default: Dialog } = require('../../../miniprogram_npm/@vant/weapp/dialog/dialog');

function buildI18n() {
  return {
    driver_detail_info:        t('driver_detail_info'),
    driver_detail_name:        t('driver_detail_name'),
    driver_detail_phone:       t('driver_detail_phone'),
    driver_detail_car_model:   t('driver_detail_car_model'),
    driver_detail_car_plate:   t('driver_detail_car_plate'),
    driver_detail_car_color:   t('driver_detail_car_color'),
    driver_detail_max_seats:   t('driver_detail_max_seats'),
    driver_detail_max_checked: t('driver_detail_max_checked'),
    driver_detail_max_carry_on:t('driver_detail_max_carry_on'),
    driver_detail_edit:        t('driver_detail_edit'),
    driver_detail_cancel:      t('driver_detail_cancel'),
    driver_detail_edit_title:  t('driver_detail_edit_title'),
    driver_detail_save:        t('driver_detail_save'),
    driver_detail_shifts:      t('driver_detail_shifts'),
    driver_detail_no_shifts:   t('driver_detail_no_shifts'),
    driver_detail_delete:      t('driver_detail_delete'),
    driver_detail_loading:     t('driver_detail_loading'),
  };
}

function formatTime(isoStr) {
  if (!isoStr) return '--';
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

Page({
  data: {
    loading: true,
    editing: false,
    saving: false,
    deleting: false,
    driverId: null,
    driver: {},
    form: {},
    i18n: buildI18n(),
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: t('driver_detail_title') });
    this.setData({
      driverId: options.id,
      i18n: buildI18n(),
    });
    this.loadDriver();
  },

  async loadDriver() {
    this.setData({ loading: true });
    try {
      const driver = await api.getDriver(this.data.driverId);
      // 格式化班次时间
      if (driver.shifts) {
        driver.shifts = driver.shifts.map((s) => ({
          ...s,
          departure_time_fmt: formatTime(s.departure_time),
        }));
      }
      this.setData({ driver, loading: false });
    } catch (err) {
      wx.showToast({ title: t('driver_detail_load_failed'), icon: 'none' });
      this.setData({ loading: false });
    }
  },

  toggleEdit() {
    if (this.data.editing) {
      this.setData({ editing: false });
    } else {
      const d = this.data.driver;
      this.setData({
        editing: true,
        form: {
          car_model: d.car_model || '',
          car_plate: d.car_plate || '',
          car_color: d.car_color || '',
          max_seats: d.max_seats || 1,
          max_checked: d.max_checked || 0,
          max_carry_on: d.max_carry_on || 0,
        },
      });
    }
  },

  onFormChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail });
  },

  onMaxSeatsChange(e) {
    this.setData({ 'form.max_seats': e.detail });
  },

  onMaxCheckedChange(e) {
    this.setData({ 'form.max_checked': e.detail });
  },

  onMaxCarryOnChange(e) {
    this.setData({ 'form.max_carry_on': e.detail });
  },

  async onSave() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      await api.updateDriver(this.data.driverId, this.data.form);
      wx.showToast({ title: t('driver_detail_save_success'), icon: 'success' });
      this.setData({ editing: false });
      await this.loadDriver();
    } catch (err) {
      wx.showToast({ title: t('driver_detail_save_failed'), icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  async onDelete() {
    try {
      await Dialog.confirm({
        title: t('driver_detail_delete_title'),
        message: t('driver_detail_delete_confirm'),
      });
    } catch (e) {
      return; // cancelled
    }

    this.setData({ deleting: true });
    try {
      await api.deleteDriver(this.data.driverId);
      wx.showToast({ title: t('driver_detail_delete_success'), icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (err) {
      wx.showToast({ title: t('driver_detail_delete_failed'), icon: 'none' });
    } finally {
      this.setData({ deleting: false });
    }
  },
});
