const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');

function defaultForm() {
  return {
    car_model: '',
    car_plate: '',
    car_color: '',
    seats_capacity: 4,
    checked_luggage_capacity: 4,
    carry_on_capacity: 2,
  };
}

function buildI18n() {
  return {
    vform_add_title:       t('vform_add_title'),
    vform_edit_title:      t('vform_edit_title'),
    vform_car_model:       t('vform_car_model'),
    vform_car_plate:       t('vform_car_plate'),
    vform_car_color:       t('vform_car_color'),
    vform_seats:           t('vform_seats'),
    vform_checked:         t('vform_checked'),
    vform_carryon:         t('vform_carryon'),
    vform_submit:          t('vform_submit'),
    vform_save_success:    t('vform_save_success'),
    vform_required_hint:   t('vform_required_hint'),
    vform_capacity_hint:   t('vform_capacity_hint'),
    vform_model_placeholder: t('vform_model_placeholder'),
    vform_plate_placeholder: t('vform_plate_placeholder'),
    vform_color_placeholder: t('vform_color_placeholder'),
  };
}

Page({
  data: {
    i18n: {},
    isEdit: false,
    vehicleId: null,
    form: defaultForm(),
    submitting: false,
  },

  onLoad(options) {
    this.setData({ i18n: buildI18n() });
    if (options.id) {
      this.setData({ isEdit: true, vehicleId: options.id });
      wx.setNavigationBarTitle({ title: t('vform_edit_title') });
      this.loadVehicle(options.id);
    } else {
      wx.setNavigationBarTitle({ title: t('vform_add_title') });
    }
  },

  async loadVehicle(id) {
    try {
      const vehicle = await api.getVehicle(id);
      if (vehicle) {
        this.setData({
          form: {
            car_model: vehicle.car_model || '',
            car_plate: vehicle.car_plate || '',
            car_color: vehicle.car_color || '',
            seats_capacity: vehicle.seats_capacity || 4,
            checked_luggage_capacity: vehicle.checked_luggage_capacity || 4,
            carry_on_capacity: vehicle.carry_on_capacity || 2,
          },
        });
      }
    } catch (e) {
      console.error('loadVehicle error', e);
    }
  },

  onFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail });
  },

  onStepperChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail });
  },

  async onSubmit() {
    const { form, isEdit, vehicleId, i18n } = this.data;

    // Validation
    if (!form.car_model.trim()) {
      wx.showToast({ title: i18n.vform_required_hint, icon: 'none' });
      return;
    }
    if (form.seats_capacity < 1 || form.checked_luggage_capacity < 0 || form.carry_on_capacity < 0) {
      wx.showToast({ title: i18n.vform_capacity_hint, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const payload = {
        car_model: form.car_model.trim(),
        car_plate: form.car_plate.trim(),
        car_color: form.car_color.trim(),
        seats_capacity: Number(form.seats_capacity),
        checked_luggage_capacity: Number(form.checked_luggage_capacity),
        carry_on_capacity: Number(form.carry_on_capacity),
      };

      if (isEdit) {
        await api.updateVehicle(vehicleId, payload);
      } else {
        await api.createVehicle(payload);
      }

      wx.showToast({ title: i18n.vform_save_success, icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {
      console.error('submit vehicle error', e);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
