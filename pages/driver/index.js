const api = require('../../utils/api');
const { formatDateTime } = require('../../utils/formatters');
const { t } = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    loading: false,
    shifts: [],
    selectedShiftId: null,
    selectedShift: null,
    passengers: [],
    showScanModal: false,
    scanResult: null,
    scanning: false,
  },

  onLoad() {
    this.setData({
      i18n: {
        driver_loading: t('driver_loading'),
        driver_no_shift: t('driver_no_shift'),
        driver_contact_admin: t('driver_contact_admin'),
        driver_current_shift: t('driver_current_shift'),
        driver_driver_label: t('driver_driver_label'),
        driver_capacity_label: t('driver_capacity_label'),
        driver_capacity_unit: t('driver_capacity_unit'),
        driver_assigned_label: t('driver_assigned_label'),
        driver_assigned_unit: t('driver_assigned_unit'),
        driver_status_label: t('driver_status_label'),
        driver_status_published: t('driver_status_published'),
        driver_status_unpublished: t('driver_status_unpublished'),
        driver_unassigned: t('driver_unassigned'),
        driver_scan_btn: t('driver_scan_btn'),
        driver_passengers_title: t('driver_passengers_title'),
        driver_boarded: t('driver_boarded'),
        driver_waiting: t('driver_waiting'),
        driver_student_id: t('driver_student_id'),
        driver_no_passengers: t('driver_no_passengers'),
        driver_scan_title: t('driver_scan_title'),
        driver_scan_instruction: t('driver_scan_instruction'),
        driver_scan_start: t('driver_scan_start'),
        driver_scan_tips: t('driver_scan_tips'),
        driver_scan_continue_hint: t('driver_scan_continue_hint'),
        driver_scan_continue_btn: t('driver_scan_continue_btn'),
        driver_scan_finish_btn: t('driver_scan_finish_btn'),
        driver_ride_with_wechat: t('driver_ride_with_wechat'),
      },
    });
    wx.setNavigationBarTitle({ title: t('driver_nav_title') });
  },

  onShow() {
    const app = getApp();
    if (app.isWechatBound && !app.isWechatBound()) {
      wx.reLaunch({ url: '/pages/bind/index' });
      return;
    }
    wx.setNavigationBarTitle({ title: t('driver_nav_title') });
    this.loadDriverShifts();
  },

  async onPullDownRefresh() {
    try {
      await this.loadDriverShifts();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async loadDriverShifts() {
    this.setData({ loading: true });
    try {
      const shiftsRes = await api.getDriverShifts();
      const rawShifts = Array.isArray(shiftsRes) ? shiftsRes : (shiftsRes.data || shiftsRes.shifts || []);

      const now = new Date();
      // Enrich each shift with display fields
      const shifts = rawShifts.map(shift => {
        const depTime = shift.departure_time ? new Date(shift.departure_time) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const isToday = depTime && depTime >= today && depTime < tomorrow;
        const boardedCount = (shift.requests || []).filter(r => r.boarded_at).length;
        const capacity = (shift.driver && shift.driver.max_seats) || '';
        const statusLabel = shift.status === 'published' ? '已发布' : '未发布';

        return {
          ...shift,
          departureTimeFmt: this.formatTime(shift.departure_time),
          isToday: isToday,
          boardedCount: boardedCount,
          capacity: capacity,
          statusLabel: statusLabel,
          driverName: (shift.driver && shift.driver.name) || '',
        };
      });

      // Auto-select: nearest future shift, or first one
      let autoSelectId = this.data.selectedShiftId;
      const prevSelected = autoSelectId ? shifts.find(s => s.id === autoSelectId) : null;

      if (!prevSelected) {
        const futureShift = shifts.find(s => {
          const dep = s.departure_time ? new Date(s.departure_time) : null;
          return dep && dep > now;
        });
        autoSelectId = futureShift ? futureShift.id : (shifts.length > 0 ? shifts[0].id : null);
      }

      const selectedShift = autoSelectId ? shifts.find(s => s.id === autoSelectId) || null : null;

      // Load passengers for selected shift
      let passengers = [];
      if (selectedShift && selectedShift.id) {
        passengers = await this._loadPassengers(selectedShift.id);
      }

      this.setData({
        shifts: shifts,
        selectedShiftId: autoSelectId,
        selectedShift: selectedShift,
        passengers: passengers,
      });

      if (shifts.length === 0) {
        wx.showToast({ title: t('driver_no_shift'), icon: 'none' });
      }
    } catch (error) {
      console.error('Failed to load shifts:', error);
      wx.showToast({ title: error.message || t('driver_load_failed'), icon: 'none' });
      this.setData({
        shifts: [],
        selectedShiftId: null,
        selectedShift: null,
        passengers: [],
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async _loadPassengers(shiftId) {
    try {
      const passengersRes = await api.getShiftPassengers(shiftId);
      let passengers = Array.isArray(passengersRes) ? passengersRes : (passengersRes.data || passengersRes.passengers || []);
      return passengers.map(passenger => ({
        ...passenger,
        status: passenger.status || passenger.boarding_status || 'assigned',
        name: passenger.name || passenger.user_name || passenger.student_name || passenger.passenger_name || `${t('common_student_prefix')}${passenger.id}`,
        student_id: passenger.student_id || passenger.student_id_number || passenger.user_id || '',
      }));
    } catch (err) {
      console.warn('Failed to load passengers:', err);
      wx.showToast({ title: t('driver_passengers_load_failed'), icon: 'none' });
      return [];
    }
  },

  async selectShift(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.selectedShiftId) return;

    const selectedShift = this.data.shifts.find(s => s.id === id) || null;
    this.setData({ selectedShiftId: id, selectedShift: selectedShift, passengers: [] });

    if (selectedShift) {
      const passengers = await this._loadPassengers(selectedShift.id);
      this.setData({ passengers: passengers });
    }
  },

  openScanModal() {
    this.setData({ showScanModal: true, scanResult: null });
  },

  closeScanModal() {
    this.setData({ showScanModal: false });
  },

  async startScan() {
    if (this.data.scanning) return;
    this.setData({ scanning: true });
    try {
      const res = await wx.scanCode({ onlyFromCamera: true, scanType: ['qrCode'] });
      if (res && res.result) {
        await this.verifyBoarding(res.result);
      }
    } catch (error) {
      if (error.errMsg !== 'scanCode:fail cancel') {
        wx.showToast({ title: t('driver_scan_failed'), icon: 'none' });
      }
    } finally {
      this.setData({ scanning: false });
    }
  },

  async verifyBoarding(qrCode) {
    try {
      const result = await api.verifyBoarding(qrCode);
      const studentName = (result.request && result.request.user && result.request.user.name) || '';
      const alreadyBoarded = result.request && result.request.boarded_at;

      wx.vibrateShort({ type: 'heavy' });

      if (alreadyBoarded) {
        this.setData({
          scanResult: { success: true, message: t('driver_already_boarded_msg'), studentName: studentName },
        });
      } else {
        this.setData({
          scanResult: { success: true, message: `✅ ${t('driver_board_success')} — ${studentName || t('common_student_prefix')}`, studentName: studentName },
        });
      }

      getApp().globalData.dashboardNeedsRefresh = true;
      await this.loadDriverShifts();
    } catch (error) {
      const errMsg = error.message || t('driver_board_failed');
      const isDuplicate = errMsg.includes('已登车') || errMsg.includes('already boarded') ||
          errMsg.includes('重复') || errMsg.includes('duplicate');
      this.setData({
        scanResult: { success: false, message: isDuplicate ? t('driver_already_boarded_msg') : errMsg },
      });
    }
  },

  continueScan() {
    this.setData({ scanResult: null });
    this.startScan();
  },

  finishScan() {
    this.setData({ showScanModal: false, scanResult: null });
  },

  formatTime(timeStr) {
    if (!timeStr) return '';
    return formatDateTime(timeStr) || timeStr;
  },
});
