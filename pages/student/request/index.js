const api = require('../../../utils/api');
const { requestStatusText } = require('../../../utils/status');
const { formatDateOnly } = require('../../../utils/formatters');
const { QRCodeModel, QRErrorCorrectLevel, getTypeNumber } = require('../../../utils/qrcode');
const { t } = require('../../../utils/i18n');

const WECHAT_ID_REGEXP = /^[a-zA-Z0-9_]{6,20}$/;

Page({
  data: {
    i18n: {},
    submitting: false,
    loadingTrack: false,
    hasSubmitted: false,
    showDatePicker: false,
    showTimePicker: false,
    showTerminalPicker: false,
    showQrCodeModal: false,
    showQrCanvas: false,
    calendarMinDate: new Date().setHours(0, 0, 0, 0),
    calendarMaxDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).getTime(),
    qrCodeError: '',
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

    trackSteps: [],
    activeStep: 0,
    latestRequest: null,
    assignedShift: null,
    boardingToken: null,
    qrCodePath: null,
    generatingQrCode: false,
    // 修改申请相关
    modRequestStatus: null,
    // 申请信息 & 编辑
    editing: false,
    savingEdit: false,
    formattedArrivalTime: '',
    editForm: {},
    _editDateMode: false,
    _editTimeMode: false,
    _editTerminalMode: false,
  },

  onLoad() {
    this.setData({
      i18n: {
        student_request_title: t('student_request_title'),
        student_request_name_label: t('student_request_name_label'),
        student_request_name_placeholder: t('student_request_name_placeholder'),
        student_request_flight_label: t('student_request_flight_label'),
        student_request_flight_placeholder: t('student_request_flight_placeholder'),
        student_request_date_label: t('student_request_date_label'),
        student_request_date_placeholder: t('student_request_date_placeholder'),
        student_request_terminal_label: t('student_request_terminal_label'),
        student_request_terminal_placeholder: t('student_request_terminal_placeholder'),
        student_request_time_label: t('student_request_time_label'),
        student_request_time_placeholder: t('student_request_time_placeholder'),
        student_request_checked_label: t('student_request_checked_label'),
        student_request_carryon_label: t('student_request_carryon_label'),
        student_request_ridewith_label: t('student_request_ridewith_label'),
        student_request_ridewith_placeholder: t('student_request_ridewith_placeholder'),
        student_request_wechat_label: t('student_request_wechat_label'),
        student_request_wechat_placeholder: t('student_request_wechat_placeholder'),
        student_request_submit: t('student_request_submit'),
        student_request_submitted_lock: t('student_request_submitted_lock'),
        student_request_track_title: t('student_request_track_title'),
        student_request_no_record: t('student_request_no_record'),
        student_request_current_flight: t('student_request_current_flight'),
        student_request_ridewith_note: t('student_request_ridewith_note'),
        student_request_ridewith_wechat: t('student_request_ridewith_wechat'),
        student_request_assigned_title: t('student_request_assigned_title'),
        student_request_driver_label: t('student_request_driver_label'),
        student_request_car_label: t('student_request_car_label'),
        student_request_meetpoint_label: t('student_request_meetpoint_label'),
        student_request_depart_label: t('student_request_depart_label'),
        student_request_qr_title: t('student_request_qr_title'),
        student_request_qr_tips: t('student_request_qr_tips'),
        student_request_qr_generating: t('student_request_qr_generating'),
        student_request_qr_view: t('student_request_qr_view'),
        student_request_qr_save: t('student_request_qr_save'),
        student_request_qr_failed: t('student_request_qr_failed'),
        student_request_qr_modal_title: t('student_request_qr_modal_title'),
        student_request_qr_instruction: t('student_request_qr_instruction'),
        student_request_terminal_title: t('student_request_terminal_title'),
        student_request_time_title: t('student_request_time_title'),
        mod_request_btn: t('mod_request_btn'),
        mod_request_pending: t('mod_request_pending'),
        mod_request_submit_success: t('mod_request_submit_success'),
        mod_request_submit_fail: t('mod_request_submit_fail'),
        request_info_title: t('request_info_title'),
        request_info_flight: t('request_info_flight'),
        request_info_arrival: t('request_info_arrival'),
        request_info_bags: t('request_info_bags'),
        request_info_bags_sep: t('request_info_bags_sep'),
        request_info_bags_unit: t('request_info_bags_unit'),
        request_info_wechat: t('request_info_wechat'),
        request_info_note: t('request_info_note'),
        request_info_terminal: t('request_info_terminal'),
        request_edit_btn: t('request_edit_btn'),
        request_edit_save: t('request_edit_save'),
        request_edit_cancel: t('request_edit_cancel'),
        request_updated: t('request_updated'),
        request_update_failed: t('request_update_failed'),
        mod_limit_exceeded: t('mod_limit_exceeded'),
        mod_too_close_to_arrival: t('mod_too_close_to_arrival'),
        mod_count_label: t('mod_count_label'),
      },
      trackSteps: [t('student_request_step_submitted'), t('student_request_step_scheduling'), t('student_request_step_assigned')],
    });
    wx.setNavigationBarTitle({ title: t('student_request_nav_title') });
  },

  onShow() {
    const app = getApp();
    if (app.globalData.userInfo && app.isWechatBound && !app.isWechatBound()) {
      wx.reLaunch({ url: '/pages/bind/index' });
      return;
    }

    const userInfo = (app && app.globalData && app.globalData.userInfo) || wx.getStorageSync('userInfo') || {};
    if (!this.data.form.real_name) {
      this.setData({ 'form.real_name': userInfo.name || '' });
    }
    wx.setNavigationBarTitle({ title: t('student_request_nav_title') });
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

  onBagsOverLimit(e) {
    if (e.detail === 'plus' || (e.detail && e.detail.type === 'plus')) {
      wx.showToast({
        title: t('student_request_bags_overlimit'),
        icon: 'none',
        duration: 2500,
      });
    }
  },

  openTerminalPicker() {
    this.setTabBarHidden(true);
    this.setData({ showTerminalPicker: true });
  },

  onCloseTerminalPicker() {
    this.setTabBarHidden(false);
    this.setData({ showTerminalPicker: false });
  },

  onSelectTerminal(e) {
    const detail = (e && e.detail) || {};
    const value = detail.name || detail.value || '';
    if (!value) {
      this.setData({ showTerminalPicker: false });
      return;
    }
    this.setTabBarHidden(false);
    if (this.data._editTerminalMode) {
      this.setData({ showTerminalPicker: false, _editTerminalMode: false, 'editForm.terminal': value });
    } else {
      this.setData({ showTerminalPicker: false, 'form.terminal': value });
    }
  },

  openDatePicker() {
    this.setTabBarHidden(true);
    this.setData({ showDatePicker: true });
  },

  onDatePickerClose() {
    this.setTabBarHidden(false);
    this.setData({ showDatePicker: false });
  },

  onDateConfirm(e) {
    const value = e && e.detail;
    const selectedDate = value instanceof Date ? value : new Date(value);
    const arrivalDate = formatDateOnly(selectedDate);

    this.setTabBarHidden(false);
    if (this.data._editDateMode) {
      this.setData({ showDatePicker: false, _editDateMode: false, 'editForm.arrival_date': arrivalDate });
    } else {
      this.setData({ showDatePicker: false, 'form.arrival_date': arrivalDate });
      this.syncExpectedArrivalTime();
    }
  },

  openTimePicker() {
    this.setTabBarHidden(true);
    this.setData({
      showTimePicker: true,
      timePickerValue: this.data.form.arrival_time || this.data.timePickerValue,
    });
  },

  onTimePickerCancel() {
    this.setTabBarHidden(false);
    this.setData({ showTimePicker: false });
  },

  onTimeConfirm(e) {
    const arrivalTime = (e && e.detail) || '';
    this.setTabBarHidden(false);
    if (this.data._editTimeMode) {
      this.setData({ showTimePicker: false, _editTimeMode: false, timePickerValue: arrivalTime || this.data.timePickerValue, 'editForm.arrival_time': arrivalTime });
    } else {
      this.setData({ showTimePicker: false, timePickerValue: arrivalTime || this.data.timePickerValue, 'form.arrival_time': arrivalTime });
      this.syncExpectedArrivalTime();
    }
  },

  syncExpectedArrivalTime() {
    const { arrival_date, arrival_time } = this.data.form;
    const expected = arrival_date && arrival_time ? `${arrival_date} ${arrival_time}:00` : '';
    this.setData({ 'form.expected_arrival_time': expected });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    if (this.data.hasSubmitted) {
      wx.showToast({ title: t('student_request_duplicate'), icon: 'none' });
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
      wx.showToast({ title: t('student_request_form_incomplete'), icon: 'none' });
      return;
    }

    const normalizedWechat = String(ride_with_wechat || '').trim();
    if (normalizedWechat && !WECHAT_ID_REGEXP.test(normalizedWechat)) {
      wx.showToast({ title: t('student_request_wechat_invalid'), icon: 'none' });
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
      wx.showToast({ title: t('student_request_success'), icon: 'success' });
      await this.loadTrack();
    } catch (error) {
      wx.showToast({ title: t('student_request_failed'), icon: 'none' });
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
          boardingToken: null,
          qrCodePath: null,
          modRequestStatus: null,
    // 申请信息 & 编辑
    editing: false,
    savingEdit: false,
    formattedArrivalTime: '',
    editForm: {},
        });
        return;
      }

      const latest = requests[0];
      const status = (latest.status || '').toLowerCase();
      const step = status === 'pending' ? 0 : status === 'assigned' ? 1 : 2;

      let boardingToken = null;
      if (status === 'published' && latest.shift) {
        try {
          const result = await api.getBoardingToken(latest.id);
          boardingToken = result && result.token ? result.token : null;
        } catch (tokenErr) {
          console.warn('获取登车 token 失败:', tokenErr);
        }
      }

      const shiftData = (status === 'assigned' || status === 'published') ? latest.shift || null : null;
      if (shiftData && shiftData.departure_time) {
        const dt = shiftData.departure_time;
        // Format ISO string to YYYY-MM-DD HH:mm
        if (dt.includes('T')) {
          const d = new Date(dt);
          const pad = (n) => String(n).padStart(2, '0');
          shiftData.formattedDepartureTime = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
        } else {
          shiftData.formattedDepartureTime = dt.substring(0, 16).replace('T', ' ');
        }
      }

      // Format arrival time for display
      let formattedArrivalTime = '--';
      const rawTime = latest.arrival_time_api || latest.expected_arrival_time;
      if (rawTime) {
        const d = new Date(rawTime);
        if (!isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          formattedArrivalTime = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
        }
      }

      this.setData({
        latestRequest: { ...latest, status_text: requestStatusText(latest.status) },
        activeStep: step,
        assignedShift: shiftData,
        boardingToken: boardingToken,
        hasSubmitted: true,
        formattedArrivalTime: formattedArrivalTime,
        editing: false,
      });

      // 非 pending 状态时加载修改申请状态
      if (status !== 'pending') {
        this.loadModificationStatus(latest.id);
      } else {
        this.setData({ modRequestStatus: null });
      }

      if (boardingToken) {
        this.generateQrCode(boardingToken);
      }
    } catch (error) {
      wx.showToast({ title: (error && error.message) || t('student_request_status_failed'), icon: 'none' });
    } finally {
      this.setData({ loadingTrack: false });
    }
  },

  async generateQrCode(token) {
    if (!token || this.data.generatingQrCode) return;

    this.setData({ generatingQrCode: true, qrCodePath: null, qrCodeError: '', showQrCanvas: true });
    try {
      await new Promise((resolve) => wx.nextTick(resolve));
      await new Promise((resolve) => setTimeout(resolve, 50));
      const qrCodePath = await this.drawQrCodeWithTimeout(token);
      this.setData({ qrCodePath: qrCodePath, qrCodeError: '' });
    } catch (error) {
      const msg = (error && (error.errMsg || error.message)) || t('student_request_qr_failed');
      console.error('生成二维码失败:', error);
      this.setData({ qrCodePath: null, qrCodeError: msg });
      wx.showToast({ title: msg, icon: 'none' });
    } finally {
      this.setData({ generatingQrCode: false, showQrCanvas: false });
    }
  },

  drawQrCodeWithTimeout(text, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(t('student_request_qr_timeout'))), timeoutMs);
      this.drawQrCode(text)
        .then((path) => {
          clearTimeout(timer);
          resolve(path);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  },

  drawQrCode(text) {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#qrCodeCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const node = res && res[0] && res[0].node ? res[0].node : null;
          if (!node) {
            this.drawQrCodeLegacy(text).then(resolve).catch(reject);
            return;
          }

          try {
            const canvas = node;
            const ctx = canvas.getContext('2d');
            const dpr = wx.getSystemInfoSync().pixelRatio;
            const size = 200;

            canvas.width = size * dpr;
            canvas.height = size * dpr;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);

            ctx.clearRect(0, 0, size, size);

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, size, size);

            const typeNumber = getTypeNumber ? getTypeNumber(text, QRErrorCorrectLevel.M) : 4;
            const qr = new QRCodeModel(typeNumber, QRErrorCorrectLevel.M);
            qr.addData(text);
            qr.make();

            const moduleCount = qr.getModuleCount();
            const cellSize = Math.floor(size / moduleCount);
            const offset = Math.floor((size - cellSize * moduleCount) / 2);

            ctx.fillStyle = '#000000';
            for (let row = 0; row < moduleCount; row += 1) {
              for (let col = 0; col < moduleCount; col += 1) {
                if (qr.isDark(row, col)) {
                  const x = offset + col * cellSize;
                  const y = offset + row * cellSize;
                  ctx.fillRect(x, y, cellSize, cellSize);
                }
              }
            }

            wx.canvasToTempFilePath({
              canvas: canvas,
              success: (result) => {
                resolve(result.tempFilePath);
              },
              fail: () => {
                this.drawQrCodeLegacy(text).then(resolve).catch(reject);
              },
            });
          } catch (err) {
            this.drawQrCodeLegacy(text).then(resolve).catch(reject);
          }
        });
    });
  },

  drawQrCodeLegacy(text) {
    return new Promise((resolve, reject) => {
      const ctx = wx.createCanvasContext('qrCodeCanvasLegacy', this);
      const size = 200;

      ctx.setFillStyle('#FFFFFF');
      ctx.fillRect(0, 0, size, size);

      const typeNumber = getTypeNumber ? getTypeNumber(text, QRErrorCorrectLevel.M) : 4;
      const qr = new QRCodeModel(typeNumber, QRErrorCorrectLevel.M);
      qr.addData(text);
      qr.make();

      const moduleCount = qr.getModuleCount();
      const cellSize = Math.floor(size / moduleCount);
      const offset = Math.floor((size - cellSize * moduleCount) / 2);

      ctx.setFillStyle('#000000');
      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount; col += 1) {
          if (qr.isDark(row, col)) {
            const x = offset + col * cellSize;
            const y = offset + row * cellSize;
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        }
      }

      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: 'qrCodeCanvasLegacy',
          success: (result) => resolve(result.tempFilePath),
          fail: reject,
        }, this);
      });
    });
  },

  openQrCodeModal() {
    this.setData({ showQrCodeModal: true });
  },

  closeQrCodeModal() {
    this.setData({ showQrCodeModal: false });
  },

  saveQrCodeToAlbum() {
    if (!this.data.qrCodePath) return;
    
    wx.saveImageToPhotosAlbum({
      filePath: this.data.qrCodePath,
      success: () => {
        wx.showToast({
          title: t('student_request_qr_save_success'),
          icon: 'success',
        });
      },
      fail: (err) => {
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: t('student_request_qr_tips'),
            content: t('student_request_qr_save_auth'),
            showCancel: false,
          });
        } else {
          wx.showToast({
            title: t('student_request_qr_save_failed'),
            icon: 'none',
          });
        }
      },
    });
  },


  async loadModificationStatus(requestId) {
    try {
      const result = await api.getModificationStatus(requestId);
      if (result && result.status) {
        this.setData({ modRequestStatus: result.status });
      }
    } catch (e) {
      this.setData({ modRequestStatus: null });
    }
  },

  goToModification() {
    const req = this.data.latestRequest;
    // 前端校验：仅 pending 状态可进入修改流程
    const status = (req && req.status || '').toLowerCase();
    if (status !== 'pending') return;
    // 前端校验：修改次数限制
    if (req.modification_count >= 3) {
      wx.showToast({ title: t('mod_limit_exceeded'), icon: 'none' });
      return;
    }
    // 前端校验：落地时间前 24 小时
    const rawTime = req.arrival_time_api || req.expected_arrival_time;
    if (rawTime) {
      const arrivalMs = new Date(rawTime).getTime();
      if (arrivalMs - Date.now() < 24 * 60 * 60 * 1000) {
        wx.showToast({ title: t('mod_too_close_to_arrival'), icon: 'none' });
        return;
      }
    }
    wx.navigateTo({
      url: `/pages/student/modification/index?requestId=${req.id}`,
    });
  },

  // === Pending 状态直接编辑 ===
  editRequest() {
    const req = this.data.latestRequest;
    // 解析 arrival_time_api 为 date + time
    let arrivalDate = '';
    let arrivalTime = '';
    const rawTime = req.arrival_time_api || req.expected_arrival_time;
    if (rawTime) {
      const d = new Date(rawTime);
      if (!isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        arrivalDate = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        arrivalTime = pad(d.getHours()) + ':' + pad(d.getMinutes());
      }
    }
    this.setData({
      editing: true,
      editForm: {
        flight_no: req.flight_no || '',
        arrival_date: arrivalDate,
        arrival_time: arrivalTime,
        terminal: req.terminal || '',
        checked_bags: req.checked_bags || 0,
        carry_on_bags: req.carry_on_bags || 0,
        ride_with_note: req.ride_with_note || '',
        ride_with_wechat: req.ride_with_wechat || '',
      },
    });
  },

  cancelEdit() {
    this.setData({ editing: false });
  },

  onEditFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`editForm.${field}`]: e.detail });
  },

  onEditCheckedChange(e) {
    this.setData({ 'editForm.checked_bags': e.detail });
  },

  onEditCarryOnChange(e) {
    this.setData({ 'editForm.carry_on_bags': e.detail });
  },

  openEditDatePicker() {
    this.setTabBarHidden(true);
    this.setData({ showDatePicker: true, _editDateMode: true });
  },

  openEditTerminalPicker() {
    this.setTabBarHidden(true);
    this.setData({ showTerminalPicker: true, _editTerminalMode: true });
  },

  openEditTimePicker() {
    this.setTabBarHidden(true);
    this.setData({
      showTimePicker: true,
      _editTimeMode: true,
      timePickerValue: this.data.editForm.arrival_time || '12:00',
    });
  },

  async saveEdit() {
    if (this.data.savingEdit) return;
    const ef = this.data.editForm;
    if (!ef.flight_no || !ef.arrival_date || !ef.terminal || !ef.arrival_time) {
      wx.showToast({ title: t('student_request_form_incomplete'), icon: 'none' });
      return;
    }
    const expectedArrivalTime = ef.arrival_date + ' ' + ef.arrival_time + ':00';
    this.setData({ savingEdit: true });
    try {
      await api.updateStudentRequest(this.data.latestRequest.id, {
        flight_no: ef.flight_no,
        arrival_date: ef.arrival_date,
        terminal: ef.terminal,
        checked_bags: ef.checked_bags,
        carry_on_bags: ef.carry_on_bags,
        expected_arrival_time: expectedArrivalTime,
        ride_with_note: ef.ride_with_note,
        ride_with_wechat: ef.ride_with_wechat,
      });
      wx.showToast({ title: t('request_updated'), icon: 'success' });
      this.setData({ editing: false });
      await this.loadTrack();
    } catch (err) {
      wx.showToast({ title: (err && err.message) || t('request_update_failed'), icon: 'none' });
    } finally {
      this.setData({ savingEdit: false });
    }
  },

  setTabBarHidden(hidden) {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && typeof tabBar.setHidden === 'function') {
      tabBar.setHidden(!!hidden);
    }
  },
});
