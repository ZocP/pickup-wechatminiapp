const api = require('../../../utils/api');
const { formatDateOnly } = require('../../../utils/formatters');
const { t } = require('../../../utils/i18n');

const WECHAT_ID_REGEXP = /^[a-zA-Z0-9_]{6,20}$/;

Page({
  data: {
    i18n: {},
    requestId: null,
    loading: true,
    submitting: false,
    hasPendingMod: false,
    pendingMod: null,
    showDatePicker: false,
    showTimePicker: false,
    calendarMinDate: new Date().setHours(0, 0, 0, 0),
    calendarMaxDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).getTime(),
    timePickerValue: '12:00',

    form: {
      flight_no: '',
      arrival_date: '',
      arrival_time: '',
      checked_bags: 0,
      carry_on_bags: 0,
      ride_with_note: '',
      ride_with_wechat: '',
    },
    reason: '',
  },

  onLoad(options) {
    const requestId = options.requestId ? Number(options.requestId) : null;
    if (!requestId) {
      wx.showToast({ title: t('modification_param_error'), icon: 'none' });
      wx.navigateBack();
      return;
    }

    this.setData({
      requestId,
      i18n: {
        student_request_flight_label: t('student_request_flight_label'),
        student_request_flight_placeholder: t('student_request_flight_placeholder'),
        student_request_date_label: t('student_request_date_label'),
        student_request_date_placeholder: t('student_request_date_placeholder'),
        student_request_time_label: t('student_request_time_label'),
        student_request_time_placeholder: t('student_request_time_placeholder'),
        student_request_checked_label: t('student_request_checked_label'),
        student_request_carryon_label: t('student_request_carryon_label'),
        student_request_ridewith_label: t('student_request_ridewith_label'),
        student_request_ridewith_placeholder: t('student_request_ridewith_placeholder'),
        student_request_wechat_label: t('student_request_wechat_label'),
        student_request_wechat_placeholder: t('student_request_wechat_placeholder'),
        modification_title: t('modification_title'),
        modification_submit: t('modification_submit'),
        modification_withdraw: t('modification_withdraw'),
        modification_pending_notice: t('modification_pending_notice'),
        modification_reason_label: t('modification_reason_label'),
        modification_reason_placeholder: t('modification_reason_placeholder'),
        modification_loading: t('modification_loading'),
        student_request_date_title: t('student_request_date_label'),
        student_request_time_title: t('student_request_time_label'),
      },
    });

    wx.setNavigationBarTitle({ title: t('modification_nav_title') });
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      // 加载当前 request 数据预填表单
      const req = await api.getStudentRequest(this.data.requestId);

      if (!req || !req.id) {
        wx.showToast({ title: t('modification_not_found'), icon: 'none' });
        wx.navigateBack();
        return;
      }

      // 解析现有到达时间
      let arrivalDate = '';
      let arrivalTime = '';
      if (req.arrival_time) {
        const dt = new Date(req.arrival_time);
        const pad = (n) => String(n).padStart(2, '0');
        arrivalDate = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
        arrivalTime = pad(dt.getHours()) + ':' + pad(dt.getMinutes());
      } else if (req.arrival_date) {
        arrivalDate = typeof req.arrival_date === 'string'
          ? req.arrival_date.substring(0, 10)
          : formatDateOnly(new Date(req.arrival_date));
      }

      this.setData({
        form: {
          flight_no: req.flight_no || '',
          arrival_date: arrivalDate,
          arrival_time: arrivalTime,
          checked_bags: req.checked_bags || 0,
          carry_on_bags: req.carry_on_bags || 0,
          ride_with_note: req.ride_with_note || '',
          ride_with_wechat: req.ride_with_wechat || '',
        },
        timePickerValue: arrivalTime || '12:00',
      });

      // 检查是否已有 pending modification
      try {
        const modStatus = await api.getModificationStatus(this.data.requestId);
        if (modStatus && modStatus.status === 'pending') {
          this.setData({ hasPendingMod: true, pendingMod: modStatus });
        }
      } catch (e) {
        // 没有修改申请，正常
      }
    } catch (error) {
      wx.showToast({ title: (error && error.message) || t('modification_load_failed'), icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail });
  },

  onReasonChange(e) {
    this.setData({ reason: e.detail });
  },

  onStepperCheckedChange(e) {
    this.setData({ 'form.checked_bags': e.detail });
  },

  onStepperCarryOnChange(e) {
    this.setData({ 'form.carry_on_bags': e.detail });
  },

  onBagsOverLimit(e) {
    if (e.detail === 'plus' || (e.detail && e.detail.type === 'plus')) {
      wx.showToast({ title: t('student_request_bags_overlimit'), icon: 'none', duration: 2500 });
    }
  },

  openDatePicker() {
    this.setData({ showDatePicker: true });
  },

  onDatePickerClose() {
    this.setData({ showDatePicker: false });
  },

  onDateConfirm(e) {
    const value = e && e.detail;
    const selectedDate = value instanceof Date ? value : new Date(value);
    const arrivalDate = formatDateOnly(selectedDate);
    this.setData({ showDatePicker: false, 'form.arrival_date': arrivalDate });
  },

  openTimePicker() {
    this.setData({
      showTimePicker: true,
      timePickerValue: this.data.form.arrival_time || this.data.timePickerValue,
    });
  },

  onTimePickerCancel() {
    this.setData({ showTimePicker: false });
  },

  onTimeConfirm(e) {
    const arrivalTime = (e && e.detail) || '';
    this.setData({
      showTimePicker: false,
      timePickerValue: arrivalTime || this.data.timePickerValue,
      'form.arrival_time': arrivalTime,
    });
  },

  async onSubmit() {
    if (this.data.submitting) return;

    const { flight_no, arrival_date, arrival_time, checked_bags, carry_on_bags, ride_with_note, ride_with_wechat } = this.data.form;

    if (!flight_no || !arrival_date || !arrival_time) {
      wx.showToast({ title: t('student_request_form_incomplete'), icon: 'none' });
      return;
    }

    const normalizedWechat = String(ride_with_wechat || '').trim();
    if (normalizedWechat && !WECHAT_ID_REGEXP.test(normalizedWechat)) {
      wx.showToast({ title: t('student_request_wechat_invalid'), icon: 'none' });
      return;
    }

    const newArrivalTime = `${arrival_date} ${arrival_time}:00`;

    const payload = {
      new_flight_number: flight_no,
      new_arrival_time: newArrivalTime,
      new_checked_bags: checked_bags,
      new_carry_on_bags: carry_on_bags,
      new_ride_with_note: String(ride_with_note || '').trim(),
      new_ride_with_wechat: normalizedWechat,
      reason: String(this.data.reason || '').trim(),
    };

    this.setData({ submitting: true });
    try {
      await api.submitModification(this.data.requestId, payload);
      wx.showToast({ title: t('mod_request_submit_success'), icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (error) {
      wx.showToast({ title: (error && error.message) || t('mod_request_submit_fail'), icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async onWithdraw() {
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: t('modification_confirm_title'),
        content: t('modification_withdraw_confirm'),
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      });
    });

    if (!confirmed) return;

    try {
      await api.withdrawModification(this.data.requestId);
      wx.showToast({ title: t('modification_withdraw_success'), icon: 'success' });
      this.setData({ hasPendingMod: false, pendingMod: null });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || t('modification_withdraw_failed'), icon: 'none' });
    }
  },
});
