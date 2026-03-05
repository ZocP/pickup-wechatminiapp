const api = require('../../../utils/api');
const { pad2 } = require('../../../utils/formatters');

function resolveUserName(request) {
  const user = (request && request.user) || {};
  const name = user.name
    || user.real_name
    || user.user_name
    || user.nickname
    || request.real_name
    || request.passenger_name
    || request.name
    || '';
  const normalized = String(name || '').trim();
  if (normalized) return normalized;
  return `学生#${request.user_id || request.id || '--'}`;
}

function buildRideWithText(request) {
  const note = String((request && request.ride_with_note) || '').trim();
  const wxid = String((request && request.ride_with_wechat) || '').trim();
  if (!note && !wxid) return '';
  if (note && wxid) return `同乘: ${note} | 微信: ${wxid}`;
  if (note) return `同乘: ${note}`;
  return `微信: ${wxid}`;
}

function formatDateTime(raw) {
  if (!raw) return '--';
  const str = String(raw);
  if (str.includes('T')) {
    return str.replace('T', ' ').replace('Z', '').slice(0, 16);
  }
  return str.slice(0, 16);
}

function formatDateOnly(raw) {
  if (!raw) return '--';
  return String(raw).slice(0, 10);
}

function formatTimeOnly(raw) {
  if (!raw) return '--';
  const str = String(raw);
  const timeStart = str.indexOf('T');
  if (timeStart >= 0) return str.slice(timeStart + 1, timeStart + 6);
  if (str.includes(' ')) return str.split(' ')[1].slice(0, 5);
  return str.slice(0, 5);
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
  },

  onShow() {
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
        userName: resolveUserName(item),
        arrivalDateText: formatDateOnly(item.arrival_date),
        arrivalTimeText: formatTimeOnly(item.arrival_time_api),
        rideWithText: buildRideWithText(item),
      }));
      this.setData({ requests, loading: false });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
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
      wx.showToast({ title: '该学生无落地时间', icon: 'none' });
      this.setData({ loadingShifts: false });
      return;
    }
    try {
      const res = await api.getAvailableShifts(arrivalTime);
      const list = Array.isArray(res) ? res : (res && res.data ? res.data : []);
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
          driverName: driver.name || '未分配司机',
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
      wx.showToast({ title: '加载班次失败', icon: 'none' });
      this.setData({ loadingShifts: false });
    }
  },

  async onSelectShift(e) {
    if (this.data.actionBusy) {
      wx.showToast({ title: '操作进行中', icon: 'none' });
      return;
    }
    const shift = e.currentTarget.dataset.shift;
    const request = this.data.selectedRequest;
    if (!shift || !request) return;

    this.setData({ actionBusy: true });
    try {
      const result = await api.assignRequestToShift(request.id, shift.id);
      if (result && result.warning) {
        wx.showToast({ title: `已分配 (${result.warning})`, icon: 'none' });
      } else {
        wx.showToast({ title: '分配成功', icon: 'success' });
      }
      this.setData({ showShiftPopup: false, selectedRequest: null });
      // 通知调度页刷新
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.dashboardNeedsRefresh = true;
      }
      await this.loadRequests();
    } catch (err) {
      wx.showToast({ title: '分配失败', icon: 'none' });
    } finally {
      this.setData({ actionBusy: false });
    }
  },

  onCloseShiftPopup() {
    this.setData({ showShiftPopup: false });
  },
});
