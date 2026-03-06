const api = require('../../utils/api');
const { formatDateTime } = require('../../utils/formatters');
const { t } = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    loading: false,
    shifts: [],
    currentShift: null,
    passengers: [],
    showScanModal: false,
    scanResult: null,
    scanning: false,
    currentShiftDepartureTimeFmt: '',
    shiftCapacity: '',
    shiftAssignedCount: 0,
    shiftDriverName: '',
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
      const shifts = Array.isArray(shiftsRes) ? shiftsRes : (shiftsRes.data || shiftsRes.shifts || []);
      
      const currentShift = shifts.find(shift => 
        shift.status === 'published'
      ) || (shifts.length > 0 ? shifts[0] : null);
      
      let passengers = [];
      if (currentShift && currentShift.id) {
        try {
          const passengersRes = await api.getShiftPassengers(currentShift.id);
          passengers = Array.isArray(passengersRes) ? passengersRes : (passengersRes.data || passengersRes.passengers || []);
          
          passengers = passengers.map(passenger => ({
            ...passenger,
            status: passenger.status || passenger.boarding_status || 'assigned',
            name: passenger.name || passenger.user_name || passenger.student_name || passenger.passenger_name || `${t('common_student_prefix')}${passenger.id}`,
            student_id: passenger.student_id || passenger.student_id_number || passenger.user_id || '',
          }));
        } catch (passengerError) {
          console.warn('Failed to load passengers:', passengerError);
          wx.showToast({
            title: t('driver_passengers_load_failed'),
            icon: 'none',
          });
        }
      }

      // Fix #3 & #4: preprocess fields in JS instead of calling functions in WXML
      const departureTimeFmt = this.formatTime(currentShift ? currentShift.departure_time : '');
      const driverName = (currentShift && currentShift.driver && currentShift.driver.name) || '';
      const capacity = (currentShift && currentShift.driver && currentShift.driver.max_seats) || '';
      const assignedCount = passengers.length;

      this.setData({
        shifts: shifts,
        currentShift: currentShift,
        passengers: passengers,
        currentShiftDepartureTimeFmt: departureTimeFmt,
        shiftDriverName: driverName,
        shiftCapacity: capacity,
        shiftAssignedCount: assignedCount,
      });
      
      if (!currentShift) {
        wx.showToast({
          title: t('driver_no_shift'),
          icon: 'none',
        });
      }
    } catch (error) {
      console.error('Failed to load shifts:', error);
      wx.showToast({
        title: error.message || t('driver_load_failed'),
        icon: 'none',
      });
      
      this.setData({
        shifts: [],
        currentShift: null,
        passengers: [],
        currentShiftDepartureTimeFmt: '',
        shiftDriverName: '',
        shiftCapacity: '',
        shiftAssignedCount: 0,
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  openScanModal() {
    this.setData({
      showScanModal: true,
      scanResult: null,
    });
  },

  closeScanModal() {
    this.setData({ showScanModal: false });
  },

  async startScan() {
    if (this.data.scanning) return;
    
    this.setData({ scanning: true });
    try {
      const res = await wx.scanCode({
        onlyFromCamera: true,
        scanType: ['qrCode']
      });
      
      if (res && res.result) {
        await this.verifyBoarding(res.result);
      }
    } catch (error) {
      if (error.errMsg !== 'scanCode:fail cancel') {
        wx.showToast({
          title: t('driver_scan_failed'),
          icon: 'none',
        });
      }
    } finally {
      this.setData({ scanning: false });
    }
  },

  async verifyBoarding(qrCode) {
    try {
      // Fix #2: HTTP 200 means success — request.js rejects on non-2xx
      const result = await api.verifyBoarding(qrCode);

      // Fix #6: detect already-boarded via response message (idempotent 200)
      const message = result.message || '';
      const studentName = (result.request && result.request.user && result.request.user.name) || '';
      const alreadyBoarded = result.request && result.request.boarded_at;

      wx.vibrateShort({ type: 'heavy' });

      if (alreadyBoarded) {
        this.setData({
          scanResult: {
            success: true,
            message: t('driver_already_boarded_msg'),
            studentName: studentName,
          }
        });
      } else {
        this.setData({
          scanResult: {
            success: true,
            message: `✅ ${t('driver_board_success')} — ${studentName || t('common_student_prefix')}`,
            studentName: studentName,
          }
        });
      }

      await this.loadDriverShifts();
    } catch (error) {
      const errMsg = error.message || t('driver_board_failed');
      const isDuplicate = errMsg.includes('已登车') || errMsg.includes('already boarded') ||
          errMsg.includes('重复') || errMsg.includes('duplicate');

      this.setData({
        scanResult: {
          success: false,
          message: isDuplicate ? t('driver_already_boarded_msg') : errMsg,
        }
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
