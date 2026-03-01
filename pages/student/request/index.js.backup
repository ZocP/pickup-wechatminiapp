const api = require('../../../utils/api');
const { requestStatusText } = require('../../../utils/status');
const { formatDateOnly } = require('../../../utils/formatters');

const WECHAT_ID_REGEXP = /^[a-zA-Z0-9_]{6,20}$/;

Page({
  data: {
    submitting: false,
    loadingTrack: false,
    hasSubmitted: false,
    showDatePicker: false,
    showTimePicker: false,
    showTerminalPicker: false,
    timePickerValue: '12:00',
    terminalActions: [
      { name: 'T1' },
      { name: 'T2' },
      { name: 'T3' },
      { name: 'T5' },
    ],

    form: {
      real_name: '',
      flight_no: '',
      arrival_date: '',
      terminal: '',
      arrival_time: '',
      expected_arrival_time: '',
      checked_bags: 0,
      carry_on_bags: 0,
      ride_with_note: '',
      ride_with_wechat: '',
    },

    trackSteps: ['已提交', '正在排班', '已安排'],
    activeStep: 0,
    latestRequest: null,
    assignedShift: null,
  },

  onShow() {
    const app = getApp();
    const userInfo = (app && app.globalData && app.globalData.userInfo) || wx.getStorageSync('userInfo') || {};
    if (!this.data.form.real_name) {
      this.setData({ 'form.real_name': userInfo.name || '' });
    }
    this.loadTrack();
  },

  async onPullDownRefresh() {
    try {
      await this.loadTrack();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  onFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail });
  },

  onStepperCheckedChange(e) {
    this.setData({ 'form.checked_bags': e.detail });
  },

  onStepperCarryOnChange(e) {
    this.setData({ 'form.carry_on_bags': e.detail });
  },

  openTerminalPicker() {
    this.setData({ showTerminalPicker: true });
  },

  onCloseTerminalPicker() {
    this.setData({ showTerminalPicker: false });
  },

  onSelectTerminal(e) {
    const detail = (e && e.detail) || {};
    const value = detail.name || detail.value || '';
    if (!value) {
      this.setData({ showTerminalPicker: false });
      return;
    }
    this.setData({
      showTerminalPicker: false,
      'form.terminal': value,
    });
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

    this.setData({
      showDatePicker: false,
      'form.arrival_date': arrivalDate,
    });
    this.syncExpectedArrivalTime();
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
    this.syncExpectedArrivalTime();
  },

  syncExpectedArrivalTime() {
    const { arrival_date, arrival_time } = this.data.form;
    const expected = arrival_date && arrival_time ? `${arrival_date} ${arrival_time}:00` : '';
    this.setData({ 'form.expected_arrival_time': expected });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    if (this.data.hasSubmitted) {
      wx.showToast({ title: '你已提交申请，无需重复提交', icon: 'none' });
      return;
    }

    const {
      real_name,
      flight_no,
      arrival_date,
      terminal,
      checked_bags,
      carry_on_bags,
      expected_arrival_time,
      ride_with_note,
      ride_with_wechat,
    } = this.data.form;

    if (!real_name || !flight_no || !arrival_date || !terminal || !expected_arrival_time) {
      wx.showToast({ title: '请填写完整表单', icon: 'none' });
      return;
    }

    const normalizedWechat = String(ride_with_wechat || '').trim();
    if (normalizedWechat && !WECHAT_ID_REGEXP.test(normalizedWechat)) {
      wx.showToast({ title: '微信号仅支持字母数字下划线，6-20位', icon: 'none' });
      return;
    }

    const payload = {
      name: real_name,
      flight_no,
      arrival_date,
      terminal,
      checked_bags,
      carry_on_bags,
      expected_arrival_time,
      ride_with_note: String(ride_with_note || '').trim(),
      ride_with_wechat: normalizedWechat,
    };

    this.setData({ submitting: true });
    try {
      const app = getApp();
      const currentUser = (app && app.globalData && app.globalData.userInfo) || wx.getStorageSync('userInfo') || {};
      if (app && typeof app.setUserInfo === 'function') {
        app.setUserInfo({
          ...currentUser,
          name: real_name,
        });
      }

      await this.requestSubscribeMessageSafe();
      await api.createStudentRequest(payload);
      wx.showToast({ title: '提交成功', icon: 'success' });
      await this.loadTrack();
    } catch (error) {
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  requestSubscribeMessageSafe() {
    const tmplIds = wx.getStorageSync('subscribeTemplateIds') || [];
    if (!Array.isArray(tmplIds) || tmplIds.length === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      wx.requestSubscribeMessage({
        tmplIds,
        complete: () => resolve(),
      });
    });
  },

  async loadTrack() {
    this.setData({ loadingTrack: true });
    try {
      const list = await api.getMyStudentRequests();

      const requests = Array.isArray(list) ? list : [];
      if (requests.length === 0) {
        this.setData({
          latestRequest: null,
          activeStep: 0,
          assignedShift: null,
          hasSubmitted: false,
        });
        return;
      }

      const latest = requests[0];
      const status = (latest.status || '').toLowerCase();
      const step = status === 'pending' ? 0 : status === 'assigned' ? 1 : 2;

      this.setData({
        latestRequest: { ...latest, status_text: requestStatusText(latest.status) },
        activeStep: step,
        assignedShift: status === 'published' ? latest.shift || null : null,
        hasSubmitted: true,
      });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '状态加载失败', icon: 'none' });
    } finally {
      this.setData({ loadingTrack: false });
    }
  },
});
