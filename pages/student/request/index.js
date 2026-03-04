const api = require('../../../utils/api');
const { requestStatusText } = require('../../../utils/status');
const { formatDateOnly } = require('../../../utils/formatters');
const { QRCodeModel, QRErrorCorrectLevel, getTypeNumber } = require('../../../utils/qrcode');

const WECHAT_ID_REGEXP = /^[a-zA-Z0-9_]{6,20}$/;

Page({
  data: {
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

    trackSteps: ['已提交', '正在排班', '已安排'],
    activeStep: 0,
    latestRequest: null,
    assignedShift: null,
    boardingToken: null,
    qrCodePath: null,
    generatingQrCode: false,
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
    this.setData({
      showTerminalPicker: false,
      'form.terminal': value,
    });
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
    this.setData({
      showDatePicker: false,
      'form.arrival_date': arrivalDate,
    });
    this.syncExpectedArrivalTime();
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
          boardingToken: null,
          qrCodePath: null,
        });
        return;
      }

      const latest = requests[0];
      const status = (latest.status || '').toLowerCase();
      const step = status === 'pending' ? 0 : status === 'assigned' ? 1 : 2;

      // 从后端获取签名登车 token（30 分钟有效，HMAC-SHA256 签名防伪造）
      let boardingToken = null;
      if (status === 'published' && latest.shift) {
        try {
          const result = await api.getBoardingToken(latest.id);
          boardingToken = result && result.token ? result.token : null;
        } catch (tokenErr) {
          console.warn('获取登车 token 失败:', tokenErr);
        }
      }

      this.setData({
        latestRequest: { ...latest, status_text: requestStatusText(latest.status) },
        activeStep: step,
        assignedShift: status === 'published' ? latest.shift || null : null,
        boardingToken: boardingToken,
        hasSubmitted: true,
      });

      // 如果有token，生成二维码
      if (boardingToken) {
        this.generateQrCode(boardingToken);
      }
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '状态加载失败', icon: 'none' });
    } finally {
      this.setData({ loadingTrack: false });
    }
  },

  // generateBoardingToken removed: tokens are now issued by the backend
  // via GET /student/requests/:id/boarding-token (HMAC-SHA256 signed, 30-min TTL)

  // 生成二维码
  async generateQrCode(token) {
    if (!token || this.data.generatingQrCode) return;

    this.setData({ generatingQrCode: true, qrCodePath: null, qrCodeError: '', showQrCanvas: true });
    try {
      await new Promise((resolve) => wx.nextTick(resolve));
      await new Promise((resolve) => setTimeout(resolve, 50));
      // 使用微信canvas生成二维码
      const qrCodePath = await this.drawQrCodeWithTimeout(token);
      this.setData({ qrCodePath: qrCodePath, qrCodeError: '' });
    } catch (error) {
      const msg = (error && (error.errMsg || error.message)) || '二维码生成失败';
      console.error('生成二维码失败:', error);
      this.setData({ qrCodePath: null, qrCodeError: msg });
      wx.showToast({ title: msg, icon: 'none' });
    } finally {
      this.setData({ generatingQrCode: false, showQrCanvas: false });
    }
  },

  drawQrCodeWithTimeout(text, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('二维码生成超时')), timeoutMs);
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

  // 使用canvas绘制二维码（2D canvas 优先，失败时回退到 legacy canvas）
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

            // 清空画布
            ctx.clearRect(0, 0, size, size);

            // 绘制白色背景
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, size, size);

            // 使用二维码库生成矩阵并绘制
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

            // 转换为图片路径
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

  // legacy canvas 绘制（兼容不支持2D canvas的环境）
  drawQrCodeLegacy(text) {
    return new Promise((resolve, reject) => {
      const ctx = wx.createCanvasContext('qrCodeCanvasLegacy', this);
      const size = 200;

      // 清空画布
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

  // 打开二维码模态框
  openQrCodeModal() {
    this.setData({ showQrCodeModal: true });
  },

  // 关闭二维码模态框
  closeQrCodeModal() {
    this.setData({ showQrCodeModal: false });
  },

  // 保存二维码到相册
  saveQrCodeToAlbum() {
    if (!this.data.qrCodePath) return;
    
    wx.saveImageToPhotosAlbum({
      filePath: this.data.qrCodePath,
      success: () => {
        wx.showToast({
          title: '保存成功',
          icon: 'success',
        });
      },
      fail: (err) => {
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '提示',
            content: '需要相册权限才能保存二维码',
            showCancel: false,
          });
        } else {
          wx.showToast({
            title: '保存失败',
            icon: 'none',
          });
        }
      },
    });
  },

  setTabBarHidden(hidden) {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && typeof tabBar.setHidden === 'function') {
      tabBar.setHidden(!!hidden);
    }
  },
});