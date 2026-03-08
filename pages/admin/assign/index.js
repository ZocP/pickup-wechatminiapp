const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');
const { formatDateTime, formatDateOnly } = require('../../../utils/formatters');
const { resolveRequestName, buildRideWithText } = require('../../../utils/helpers');

// 简单时间提取函数
function formatTimeOnly(raw) {
  if (!raw) return '--';
  const str = String(raw);
  const timeStart = str.indexOf('T');
  if (timeStart >= 0) return str.slice(timeStart + 1, timeStart + 6);
  if (str.includes(' ')) return str.split(' ')[1].slice(0, 5);
  return str.slice(0, 5);
}

function buildI18n() {
  return {
    assign_no_requests:        t('assign_no_requests'),
    assign_arrival_date:       t('assign_arrival_date'),
    assign_arrival_time:       t('assign_arrival_time'),
    assign_checked_bags_label: t('assign_checked_bags_label'),
    assign_carry_on_bags_label:t('assign_carry_on_bags_label'),
    assign_shift_btn:          t('assign_shift_btn'),
    assign_popup_for_prefix:   '为 ',
    assign_popup_for_suffix:   ' 选择班次',
    assign_loading_shifts:     t('assign_loading_shifts'),
    assign_no_shifts:          t('assign_no_shifts'),
    assign_depart_time:        t('assign_depart_time'),
    assign_capacity_warning:   t('assign_capacity_warning'),
  };
}

Page({
  data: {
    loading: false,
    requests: [],
    showShiftPopup: false,
    loadingShifts: false,
    selectedRequest: null,
    availableShifts: [],
    actionBusy: false,
    i18n: buildI18n(),
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('assign_nav_title') });
    this.setData({ i18n: buildI18n() });
  },

  onShow() {
    wx.setNavigationBarTitle({ title: t('assign_nav_title') });
    this.loadRequests();
  },

  async onPullDownRefresh() {
    await this.loadRequests();
    wx.stopPullDownRefresh();
  },

  async loadRequests() {
    this.setData({ loading: true });
    try {
      const res = await api.getUnassignedRequests();
      const list = Array.isArray(res) ? res : (res && res.data ? res.data : []);
      const requests = list.map((item) => ({
        ...item,
        userName: resolveRequestName(item),
        arrivalDateText: formatDateOnly(item.arrival_date),
        arrivalTimeText: formatTimeOnly(item.arrival_time_api),
        rideWithText: buildRideWithText(item),
      }));
      this.setData({ requests, loading: false });
    } catch (err) {
      wx.showToast({ title: t('assign_load_failed'), icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onAssign(e) {
    const request = e.currentTarget.dataset.request;
    if (!request) return;
    this.setData({
      selectedRequest: request,
      showShiftPopup: true,
      availableShifts: [],
      loadingShifts: true,
    });
    this.loadAvailableShifts(request);
  },

  async loadAvailableShifts(request) {
    const arrivalTime = request.arrival_time_api || request.calc_pickup_time || '';
    if (!arrivalTime) {
      wx.showToast({ title: t('assign_no_arrival_time'), icon: 'none' });
      this.setData({ loadingShifts: false });
      return;
    }
    try {
      const res = await api.getAvailableShifts(arrivalTime);
      const list = Array.isArray(res) ? res : (res && res.data ? res.data : []);
      const unassigned = t('common_unassigned_driver');
      const availableShifts = list.map((item) => {
        const driver = item.driver || {};
        const maxSeats = driver.max_seats || 0;
        const maxChecked = driver.max_checked || 0;
        const maxCarryOn = driver.max_carry_on || 0;
        const remainSeats = Math.max(0, maxSeats - (item.current_seats || 0));
        const remainChecked = Math.max(0, maxChecked - (item.current_checked || 0));
        const remainCarryOn = Math.max(0, maxCarryOn - (item.current_carry_on || 0));
        return {
          ...item,
          driverName: driver.name || unassigned,
          carModel: driver.car_model || '',
          departureTimeText: formatDateTime(item.departure_time),
          maxSeats,
          maxChecked,
          maxCarryOn,
          remainSeats,
          remainChecked,
          remainCarryOn,
          seatsFull: remainSeats <= 0,
          checkedFull: remainChecked <= 0,
          carryOnFull: remainCarryOn <= 0,
        };
      });
      this.setData({ availableShifts, loadingShifts: false });
    } catch (err) {
      wx.showToast({ title: t('assign_load_shifts_failed'), icon: 'none' });
      this.setData({ loadingShifts: false });
    }
  },

  async onSelectShift(e) {
    if (this.data.actionBusy) {
      wx.showToast({ title: t('assign_op_in_progress'), icon: 'none' });
      return;
    }
    const shift = e.currentTarget.dataset.shift;
    const request = this.data.selectedRequest;
    if (!shift || !request) return;

    this.setData({ actionBusy: true });
    try {
      const result = await api.assignRequestToShift(request.id, shift.id);
      if (result && result.warning) {
        wx.showToast({ title: `${t('assign_success')} (${result.warning})`, icon: 'none' });
      } else {
        wx.showToast({ title: t('assign_success'), icon: 'success' });
      }
      this.setData({ showShiftPopup: false, selectedRequest: null });
      const app = getApp();
      if (app && typeof app.markDashboardDirty === 'function') {
        app.markDashboardDirty();
      }
      await this.loadRequests();
    } catch (err) {
      wx.showToast({ title: t('assign_failed'), icon: 'none' });
    } finally {
      this.setData({ actionBusy: false });
    }
  },

  onCloseShiftPopup() {
    this.setData({ showShiftPopup: false });
  },
});
