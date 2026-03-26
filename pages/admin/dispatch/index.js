const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');
const { pad2, formatDateOnly } = require('../../../utils/formatters');
const { setTabBarHidden } = require('../../../utils/ui');

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function buildI18n() {
  return {
    dispatch_title: t('dispatch_title'),
    dispatch_add_vehicle: t('dispatch_add_vehicle'),
    dispatch_no_shifts: t('dispatch_no_shifts'),
    dispatch_no_vehicles: t('dispatch_no_vehicles'),
    dispatch_lock_btn: t('dispatch_lock_btn'),
    dispatch_lock_confirm: t('dispatch_lock_confirm'),
    dispatch_lock_success: t('dispatch_lock_success'),
    dispatch_remove_vehicle_title: t('dispatch_remove_vehicle_title'),
    dispatch_remove_passenger_title: t('dispatch_remove_passenger_title'),
    dispatch_assign_success: t('dispatch_assign_success'),
    dispatch_remove_success: t('dispatch_remove_success'),
    dispatch_loading: t('dispatch_loading'),
    dispatch_shift_label: t('dispatch_shift_label'),
    common_confirm: t('common_confirm'),
    common_cancel: t('common_cancel'),
  };
}

Page({
  data: {
    i18n: {},
    loading: true,
    selectedDate: '',
    stats: {
      pendingAllocation: 0,
      allocatedCount: 0,
      publishedVehicles: 0,
    },
    shifts: [],
    currentShiftIndex: 0,
    currentShift: null,
    shiftVehicles: [],
    showPassengerModal: false,
    recommendedPassengers: [],
    otherPassengers: [],
    selectedVehicleId: null,
    isLocked: false,
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('dispatch_title') });
    this.setData({
      i18n: buildI18n(),
      selectedDate: todayStr(),
    });
    this.loadShifts();
  },

  onShow() {
    setTabBarHidden(this, false);
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && typeof tabBar.refreshTabs === 'function') {
      tabBar.refreshTabs();
    }
    if (tabBar) {
      tabBar.setData({ selected: '/pages/admin/dispatch/index' });
    }
    this.refreshData();
  },

  refreshData() {
    if (this.data.currentShift) {
      this.loadStats();
      this.loadShiftVehicles();
    }
  },

  // ── Shift loading ─────────────────────────────────────────────────
  loadShifts() {
    const date = this.data.selectedDate;
    this.setData({ loading: true });

    api.getDashboard(date, 1, 50)
      .then((res) => {
        const shifts = this.extractShifts(res);
        const idx = 0;
        const currentShift = shifts.length > 0 ? shifts[idx] : null;
        const isLocked = currentShift ? (currentShift.status === 'locked' || currentShift.status === 'published') : false;

        this.setData({
          shifts,
          currentShiftIndex: idx,
          currentShift,
          isLocked,
          loading: false,
        });

        if (currentShift) {
          this.loadStats();
          this.loadShiftVehicles();
        } else {
          this.setData({ shiftVehicles: [], stats: { pendingAllocation: 0, allocatedCount: 0, publishedVehicles: 0 } });
        }
      })
      .catch(() => {
        this.setData({ loading: false, shifts: [], currentShift: null, shiftVehicles: [] });
      });
  },

  extractShifts(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.shifts)) return payload.shifts;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  },

  loadStats() {
    const shift = this.data.currentShift;
    if (!shift) return;
    const shiftId = shift.id || shift.ID;

    api.getDispatchStats(shiftId)
      .then((res) => {
        this.setData({
          stats: {
            pendingAllocation: res.pending_allocation || 0,
            allocatedCount: res.allocated_count || 0,
            publishedVehicles: res.published_vehicles || 0,
          },
        });
      })
      .catch(() => {});
  },

  loadShiftVehicles() {
    const shift = this.data.currentShift;
    if (!shift) return;
    const shiftId = shift.id || shift.ID;

    api.getShiftVehicles(shiftId)
      .then((res) => {
        const vehicles = Array.isArray(res) ? res : (res.vehicles || res.data || []);
        this.setData({ shiftVehicles: vehicles });
      })
      .catch(() => {
        this.setData({ shiftVehicles: [] });
      });
  },

  // ── Date navigation ───────────────────────────────────────────────
  onDateChange(e) {
    const date = e.detail.value;
    this.setData({ selectedDate: date, currentShiftIndex: 0 });
    this.loadShifts();
  },

  onPrevDay() {
    const d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() - 1);
    const newDate = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    this.setData({ selectedDate: newDate, currentShiftIndex: 0 });
    this.loadShifts();
  },

  onNextDay() {
    const d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() + 1);
    const newDate = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    this.setData({ selectedDate: newDate, currentShiftIndex: 0 });
    this.loadShifts();
  },

  onToday() {
    this.setData({ selectedDate: todayStr(), currentShiftIndex: 0 });
    this.loadShifts();
  },

  // ── Shift navigation ──────────────────────────────────────────────
  onPrevShift() {
    const idx = this.data.currentShiftIndex;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    const shift = this.data.shifts[newIdx];
    const isLocked = shift ? (shift.status === 'locked' || shift.status === 'published') : false;
    this.setData({ currentShiftIndex: newIdx, currentShift: shift, isLocked });
    this.refreshData();
  },

  onNextShift() {
    const idx = this.data.currentShiftIndex;
    if (idx >= this.data.shifts.length - 1) return;
    const newIdx = idx + 1;
    const shift = this.data.shifts[newIdx];
    const isLocked = shift ? (shift.status === 'locked' || shift.status === 'published') : false;
    this.setData({ currentShiftIndex: newIdx, currentShift: shift, isLocked });
    this.refreshData();
  },

  // ── Vehicle actions ────────────────────────────────────────────────
  onAddVehicle() {
    const shift = this.data.currentShift;
    if (!shift) return;
    const shiftId = shift.id || shift.ID;
    // Navigate to a vehicle picker / form page (future phase)
    // For now, use a simple prompt approach
    wx.navigateTo({ url: '/pages/admin/shift-detail/index?id=' + shiftId });
  },

  onRemoveVehicle(e) {
    const vehicleId = e.detail && e.detail.vehicleId;
    const shift = this.data.currentShift;
    if (!shift || !vehicleId) return;
    const shiftId = shift.id || shift.ID;
    const self = this;

    wx.showModal({
      title: this.data.i18n.dispatch_remove_vehicle_title,
      confirmText: this.data.i18n.common_confirm,
      cancelText: this.data.i18n.common_cancel,
      success(res) {
        if (!res.confirm) return;
        api.removeVehicleFromShift(shiftId, vehicleId)
          .then(() => {
            wx.showToast({ title: self.data.i18n.dispatch_remove_success, icon: 'success' });
            self.loadShiftVehicles();
            self.loadStats();
          })
          .catch(() => {});
      },
    });
  },

  // ── Passenger actions ──────────────────────────────────────────────
  onAddPassenger(e) {
    const vehicleId = e.detail && e.detail.vehicleId;
    const shift = this.data.currentShift;
    if (!shift || !vehicleId) return;
    const shiftId = shift.id || shift.ID;

    this.setData({ selectedVehicleId: vehicleId });

    api.recommendPassengers(shiftId, vehicleId)
      .then((res) => {
        const recommended = res.recommended || res.data || [];
        const others = res.others || [];
        this.setData({
          recommendedPassengers: recommended,
          otherPassengers: others,
          showPassengerModal: true,
        });
      })
      .catch(() => {
        this.setData({
          recommendedPassengers: [],
          otherPassengers: [],
          showPassengerModal: true,
        });
      });
  },

  onSelectPassenger(e) {
    const requestId = e.detail && e.detail.requestId;
    const vehicleId = this.data.selectedVehicleId;
    const shift = this.data.currentShift;
    if (!shift || !vehicleId || !requestId) return;
    const shiftId = shift.id || shift.ID;
    const self = this;

    api.assignPassengerToVehicle(shiftId, vehicleId, { request_id: requestId })
      .then(() => {
        wx.showToast({ title: self.data.i18n.dispatch_assign_success, icon: 'success' });
        self.setData({ showPassengerModal: false });
        self.loadShiftVehicles();
        self.loadStats();
      })
      .catch(() => {});
  },

  onClosePassengerModal() {
    this.setData({ showPassengerModal: false });
  },

  onRemovePassenger(e) {
    const requestId = e.detail && e.detail.requestId;
    const vehicleId = e.currentTarget.dataset.vehicleid;
    const shift = this.data.currentShift;
    if (!shift || !vehicleId || !requestId) return;
    const shiftId = shift.id || shift.ID;
    const self = this;

    wx.showModal({
      title: this.data.i18n.dispatch_remove_passenger_title,
      confirmText: this.data.i18n.common_confirm,
      cancelText: this.data.i18n.common_cancel,
      success(res) {
        if (!res.confirm) return;
        api.removePassengerFromVehicle(shiftId, vehicleId, requestId)
          .then(() => {
            wx.showToast({ title: self.data.i18n.dispatch_remove_success, icon: 'success' });
            self.loadShiftVehicles();
            self.loadStats();
          })
          .catch(() => {});
      },
    });
  },

  // ── Lock shift ─────────────────────────────────────────────────────
  onLockShift() {
    const shift = this.data.currentShift;
    if (!shift) return;
    const shiftId = shift.id || shift.ID;
    const self = this;

    wx.showModal({
      title: this.data.i18n.dispatch_lock_confirm,
      confirmText: this.data.i18n.common_confirm,
      cancelText: this.data.i18n.common_cancel,
      success(res) {
        if (!res.confirm) return;
        api.lockShift(shiftId)
          .then(() => {
            wx.showToast({ title: self.data.i18n.dispatch_lock_success, icon: 'success' });
            self.setData({ isLocked: true });
            self.loadShifts();
          })
          .catch(() => {});
      },
    });
  },
});
