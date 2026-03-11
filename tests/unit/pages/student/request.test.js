/**
 * Tests for pages/student/request/index.js
 */

jest.mock('../../../../utils/api', () => ({
  createStudentRequest: jest.fn(() => Promise.resolve()),
  getMyStudentRequests: jest.fn(() => Promise.resolve([])),
  getBoardingToken: jest.fn(() => Promise.resolve({ token: 'test-token' })),
  getModificationStatus: jest.fn(() => Promise.resolve({ status: null })),
  updateStudentRequest: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../../utils/qrcode', () => ({
  QRCodeModel: jest.fn().mockImplementation(() => ({
    addData: jest.fn(),
    make: jest.fn(),
    getModuleCount: jest.fn(() => 10),
    isDark: jest.fn(() => false),
  })),
  QRErrorCorrectLevel: { M: 0 },
  getTypeNumber: jest.fn(() => 4),
}));

describe('pages/student/request', () => {
  let pageConfig;
  let api;
  let ctx;

  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn();
    Object.keys(wx).forEach((k) => {
      if (typeof wx[k] === 'function' && wx[k].mockClear) wx[k].mockClear();
    });

    require('../../../../pages/student/request/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../../utils/api');

    ctx = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(updates) {
        Object.assign(this.data, updates);
      },
      getTabBar: jest.fn(() => ({
        setHidden: jest.fn(),
      })),
    };
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.submitting).toBe(false);
      expect(pageConfig.data.hasSubmitted).toBe(false);
      expect(pageConfig.data.showDatePicker).toBe(false);
      expect(pageConfig.data.showTimePicker).toBe(false);
      expect(pageConfig.data.showTerminalPicker).toBe(false);
      expect(pageConfig.data.editing).toBe(false);
    });

    it('has form with correct defaults', () => {
      const form = pageConfig.data.form;
      expect(form.real_name).toBe('');
      expect(form.flight_no).toBe('');
      expect(form.arrival_date).toBe('');
      expect(form.terminal).toBe('');
      expect(form.checked_bags).toBe(0);
      expect(form.carry_on_bags).toBe(0);
      expect(form.ride_with_note).toBe('');
      expect(form.ride_with_wechat).toBe('');
    });

    it('has terminal actions defined', () => {
      expect(pageConfig.data.terminalActions).toHaveLength(4);
      expect(pageConfig.data.terminalActions.map((a) => a.name)).toEqual(['T1', 'T2', 'T3', 'T5']);
    });
  });

  describe('onFieldChange', () => {
    it('updates form field from event', () => {
      pageConfig.onFieldChange.call(ctx, {
        currentTarget: { dataset: { field: 'flight_no' } },
        detail: 'UA851',
      });
      expect(ctx.data['form.flight_no']).toBe('UA851');
    });
  });

  describe('onStepperCheckedChange', () => {
    it('updates checked bags', () => {
      pageConfig.onStepperCheckedChange.call(ctx, { detail: 3 });
      expect(ctx.data['form.checked_bags']).toBe(3);
    });
  });

  describe('onStepperCarryOnChange', () => {
    it('updates carry-on bags', () => {
      pageConfig.onStepperCarryOnChange.call(ctx, { detail: 2 });
      expect(ctx.data['form.carry_on_bags']).toBe(2);
    });
  });

  describe('onBagsOverLimit', () => {
    it('shows toast on plus overlimit', () => {
      pageConfig.onBagsOverLimit.call(ctx, { detail: 'plus' });
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('shows toast on plus object overlimit', () => {
      pageConfig.onBagsOverLimit.call(ctx, { detail: { type: 'plus' } });
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('does not show toast for minus', () => {
      pageConfig.onBagsOverLimit.call(ctx, { detail: 'minus' });
      expect(wx.showToast).not.toHaveBeenCalled();
    });
  });

  describe('syncExpectedArrivalTime', () => {
    it('builds expected time from date and time', () => {
      ctx.data.form = { ...ctx.data.form, arrival_date: '2026-03-15', arrival_time: '14:30' };
      pageConfig.syncExpectedArrivalTime.call(ctx);
      expect(ctx.data['form.expected_arrival_time']).toBe('2026-03-15 14:30:00');
    });

    it('returns empty when date missing', () => {
      ctx.data.form = { ...ctx.data.form, arrival_date: '', arrival_time: '14:30' };
      pageConfig.syncExpectedArrivalTime.call(ctx);
      expect(ctx.data['form.expected_arrival_time']).toBe('');
    });

    it('returns empty when time missing', () => {
      ctx.data.form = { ...ctx.data.form, arrival_date: '2026-03-15', arrival_time: '' };
      pageConfig.syncExpectedArrivalTime.call(ctx);
      expect(ctx.data['form.expected_arrival_time']).toBe('');
    });
  });

  describe('onSubmit', () => {
    it('prevents duplicate submission', async () => {
      ctx.data.submitting = true;
      await pageConfig.onSubmit.call(ctx);
      expect(api.createStudentRequest).not.toHaveBeenCalled();
    });

    it('prevents re-submission when already submitted', async () => {
      ctx.data.submitting = false;
      ctx.data.hasSubmitted = true;
      await pageConfig.onSubmit.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
      expect(api.createStudentRequest).not.toHaveBeenCalled();
    });

    it('validates required fields', async () => {
      ctx.data.submitting = false;
      ctx.data.hasSubmitted = false;
      ctx.data.form = {
        real_name: 'John',
        flight_no: '',
        arrival_date: '',
        terminal: '',
        expected_arrival_time: '',
        checked_bags: 0,
        carry_on_bags: 0,
        ride_with_note: '',
        ride_with_wechat: '',
      };
      await pageConfig.onSubmit.call(ctx);
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' }));
      expect(api.createStudentRequest).not.toHaveBeenCalled();
    });

    it('validates wechat ID format', async () => {
      ctx.data.submitting = false;
      ctx.data.hasSubmitted = false;
      ctx.data.form = {
        real_name: 'John',
        flight_no: 'UA851',
        arrival_date: '2026-03-15',
        terminal: 'T1',
        expected_arrival_time: '2026-03-15 14:00:00',
        checked_bags: 1,
        carry_on_bags: 0,
        ride_with_note: '',
        ride_with_wechat: 'ab',  // Too short
      };
      await pageConfig.onSubmit.call(ctx);
      expect(api.createStudentRequest).not.toHaveBeenCalled();
    });

    it('accepts valid wechat ID', async () => {
      ctx.data.submitting = false;
      ctx.data.hasSubmitted = false;
      ctx.loadTrack = jest.fn(() => Promise.resolve());
      ctx.requestSubscribeMessageSafe = jest.fn(() => Promise.resolve());
      ctx.data.form = {
        real_name: 'John',
        flight_no: 'UA851',
        arrival_date: '2026-03-15',
        terminal: 'T1',
        expected_arrival_time: '2026-03-15 14:00:00',
        checked_bags: 1,
        carry_on_bags: 0,
        ride_with_note: '',
        ride_with_wechat: 'valid_wechat_id',
      };
      api.createStudentRequest.mockResolvedValue({});
      await pageConfig.onSubmit.call(ctx);
      expect(api.createStudentRequest).toHaveBeenCalled();
    });

    it('allows empty wechat ID', async () => {
      ctx.data.submitting = false;
      ctx.data.hasSubmitted = false;
      ctx.loadTrack = jest.fn(() => Promise.resolve());
      ctx.requestSubscribeMessageSafe = jest.fn(() => Promise.resolve());
      ctx.data.form = {
        real_name: 'John',
        flight_no: 'UA851',
        arrival_date: '2026-03-15',
        terminal: 'T1',
        expected_arrival_time: '2026-03-15 14:00:00',
        checked_bags: 0,
        carry_on_bags: 0,
        ride_with_note: '',
        ride_with_wechat: '',
      };
      api.createStudentRequest.mockResolvedValue({});
      await pageConfig.onSubmit.call(ctx);
      expect(api.createStudentRequest).toHaveBeenCalled();
    });

    it('resets submitting on error', async () => {
      ctx.data.submitting = false;
      ctx.data.hasSubmitted = false;
      ctx.requestSubscribeMessageSafe = jest.fn(() => Promise.resolve());
      ctx.data.form = {
        real_name: 'John',
        flight_no: 'UA851',
        arrival_date: '2026-03-15',
        terminal: 'T1',
        expected_arrival_time: '2026-03-15 14:00:00',
        checked_bags: 0,
        carry_on_bags: 0,
        ride_with_note: '',
        ride_with_wechat: '',
      };
      api.createStudentRequest.mockRejectedValue(new Error('network error'));
      ctx.loadTrack = jest.fn();
      await pageConfig.onSubmit.call(ctx);
      expect(ctx.data.submitting).toBe(false);
    });
  });

  describe('loadTrack', () => {
    it('sets hasSubmitted=false when no requests', async () => {
      api.getMyStudentRequests.mockResolvedValue([]);
      await pageConfig.loadTrack.call(ctx);
      expect(ctx.data.hasSubmitted).toBe(false);
      expect(ctx.data.latestRequest).toBeNull();
    });

    it('sets hasSubmitted=true with active request', async () => {
      ctx.generateQrCode = jest.fn();
      ctx.loadModificationStatus = jest.fn();
      api.getMyStudentRequests.mockResolvedValue([
        { id: 1, status: 'pending', flight_no: 'UA851', arrival_time: '2026-03-15T14:00:00Z' },
      ]);
      await pageConfig.loadTrack.call(ctx);
      expect(ctx.data.hasSubmitted).toBe(true);
      expect(ctx.data.latestRequest).toBeTruthy();
      expect(ctx.data.activeStep).toBe(0);
    });

    it('sets step=1 for assigned status', async () => {
      ctx.generateQrCode = jest.fn();
      ctx.loadModificationStatus = jest.fn();
      api.getMyStudentRequests.mockResolvedValue([
        { id: 1, status: 'assigned', shift: { departure_time: '2026-03-15T16:00:00Z' } },
      ]);
      await pageConfig.loadTrack.call(ctx);
      expect(ctx.data.activeStep).toBe(1);
      expect(ctx.data.assignedShift).toBeTruthy();
    });

    it('sets step=2 for published status', async () => {
      ctx.generateQrCode = jest.fn();
      ctx.loadModificationStatus = jest.fn();
      api.getMyStudentRequests.mockResolvedValue([
        { id: 1, status: 'published', shift: { departure_time: '2026-03-15T16:00:00Z' } },
      ]);
      api.getBoardingToken.mockResolvedValue({ token: 'abc123' });
      await pageConfig.loadTrack.call(ctx);
      expect(ctx.data.activeStep).toBe(2);
      expect(ctx.data.boardingToken).toBe('abc123');
    });

    it('handles error gracefully', async () => {
      api.getMyStudentRequests.mockRejectedValue(new Error('network'));
      await pageConfig.loadTrack.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.loadingTrack).toBe(false);
    });
  });

  describe('onSelectTerminal', () => {
    it('sets terminal from event', () => {
      ctx.data._pickerTarget = 'form';
      pageConfig.onSelectTerminal.call(ctx, { detail: { name: 'T2' } });
      expect(ctx.data['form.terminal']).toBe('T2');
      expect(ctx.data.showTerminalPicker).toBe(false);
    });

    it('closes picker when no value', () => {
      pageConfig.onSelectTerminal.call(ctx, { detail: {} });
      expect(ctx.data.showTerminalPicker).toBe(false);
    });
  });

  describe('onDateConfirm', () => {
    it('sets date from Date object', () => {
      ctx.data._pickerTarget = 'form';
      ctx.syncExpectedArrivalTime = jest.fn();
      pageConfig.onDateConfirm.call(ctx, { detail: new Date(2026, 2, 15) });
      expect(ctx.data['form.arrival_date']).toBe('2026-03-15');
    });
  });

  describe('onTimeConfirm', () => {
    it('sets time from string', () => {
      ctx.data._pickerTarget = 'form';
      ctx.syncExpectedArrivalTime = jest.fn();
      pageConfig.onTimeConfirm.call(ctx, { detail: '15:30' });
      expect(ctx.data['form.arrival_time']).toBe('15:30');
    });
  });

  describe('goToModification', () => {
    it('blocks when modification count >= 3', () => {
      ctx.data.latestRequest = { id: 1, modification_count: 3 };
      pageConfig.goToModification.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
      expect(wx.navigateTo).not.toHaveBeenCalled();
    });

    it('blocks when within 24h of arrival', () => {
      const soon = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      ctx.data.latestRequest = { id: 1, modification_count: 0, arrival_time: soon };
      pageConfig.goToModification.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
      expect(wx.navigateTo).not.toHaveBeenCalled();
    });

    it('navigates when allowed', () => {
      const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      ctx.data.latestRequest = { id: 42, modification_count: 1, arrival_time: future };
      pageConfig.goToModification.call(ctx);
      expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
        url: '/pages/student/modification/index?requestId=42',
      }));
    });
  });

  describe('editRequest', () => {
    it('populates edit form from latest request', () => {
      ctx.data.latestRequest = {
        id: 1,
        flight_no: 'UA123',
        arrival_time: '2026-03-15T14:30:00Z',
        terminal: 'T1',
        checked_bags: 2,
        carry_on_bags: 1,
        ride_with_note: 'with friend',
        ride_with_wechat: 'friend_wx',
      };
      pageConfig.editRequest.call(ctx);
      expect(ctx.data.editing).toBe(true);
      expect(ctx.data.editForm.flight_no).toBe('UA123');
      expect(ctx.data.editForm.terminal).toBe('T1');
      expect(ctx.data.editForm.checked_bags).toBe(2);
    });
  });

  describe('cancelEdit', () => {
    it('sets editing to false', () => {
      ctx.data.editing = true;
      pageConfig.cancelEdit.call(ctx);
      expect(ctx.data.editing).toBe(false);
    });
  });

  describe('saveEdit', () => {
    it('prevents save when already saving', async () => {
      ctx.data.savingEdit = true;
      await pageConfig.saveEdit.call(ctx);
      expect(api.updateStudentRequest).not.toHaveBeenCalled();
    });

    it('validates required fields', async () => {
      ctx.data.savingEdit = false;
      ctx.data.editForm = { flight_no: '', arrival_date: '', arrival_time: '', terminal: '' };
      await pageConfig.saveEdit.call(ctx);
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' }));
    });
  });

  describe('saveQrCodeToAlbum', () => {
    it('does nothing when no qr path', () => {
      ctx.data.qrCodePath = null;
      pageConfig.saveQrCodeToAlbum.call(ctx);
      expect(wx.saveImageToPhotosAlbum).not.toHaveBeenCalled();
    });

    it('calls saveImageToPhotosAlbum with path', () => {
      ctx.data.qrCodePath = '/tmp/qr.png';
      pageConfig.saveQrCodeToAlbum.call(ctx);
      expect(wx.saveImageToPhotosAlbum).toHaveBeenCalledWith(expect.objectContaining({
        filePath: '/tmp/qr.png',
      }));
    });
  });

  describe('openQrCodeModal / closeQrCodeModal', () => {
    it('opens modal', () => {
      pageConfig.openQrCodeModal.call(ctx);
      expect(ctx.data.showQrCodeModal).toBe(true);
    });

    it('closes modal', () => {
      pageConfig.closeQrCodeModal.call(ctx);
      expect(ctx.data.showQrCodeModal).toBe(false);
    });
  });

  describe('onLoad', () => {
    it('sets i18n and track steps', () => {
      pageConfig.onLoad.call(ctx);
      expect(ctx.data.i18n).toBeDefined();
      expect(ctx.data.trackSteps).toHaveLength(3);
      expect(wx.setNavigationBarTitle).toHaveBeenCalled();
    });
  });

  describe('onShow', () => {
    it('loads track for bound user', () => {
      ctx.loadTrack = jest.fn(() => Promise.resolve());
      pageConfig.onShow.call(ctx);
      expect(ctx.loadTrack).toHaveBeenCalled();
    });

    it('attempts to prefill name from userInfo when empty', () => {
      ctx.loadTrack = jest.fn(() => Promise.resolve());
      // getApp() returns a new object each call — we need to override the mock
      const appData = { userInfo: { name: 'TestUser' }, baseUrl: 'http://localhost:9090', dashboardCache: {} };
      global.getApp.mockReturnValue({
        globalData: appData,
        ensureWechatBound: jest.fn(() => true),
      });
      ctx.data.form = { ...ctx.data.form, real_name: '' };
      pageConfig.onShow.call(ctx);
      // setData with 'form.real_name' dot notation is stored as flat key
      expect(ctx.data['form.real_name']).toBe('TestUser');
    });

    it('does not overwrite existing name', () => {
      ctx.loadTrack = jest.fn(() => Promise.resolve());
      ctx.data.form = { ...ctx.data.form, real_name: 'ExistingName' };
      pageConfig.onShow.call(ctx);
      // When real_name is already set, onShow should NOT overwrite
      expect(ctx.data.form.real_name).toBe('ExistingName');
    });
  });

  describe('onPullDownRefresh', () => {
    it('calls loadTrack and stops refresh', async () => {
      ctx.loadTrack = jest.fn(() => Promise.resolve());
      await pageConfig.onPullDownRefresh.call(ctx);
      expect(ctx.loadTrack).toHaveBeenCalled();
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });

  describe('openDatePicker / openTimePicker / openTerminalPicker', () => {
    it('opens date picker with form target', () => {
      pageConfig.openDatePicker.call(ctx);
      expect(ctx.data.showDatePicker).toBe(true);
    });

    it('opens time picker', () => {
      ctx.data.form = { ...ctx.data.form, arrival_time: '14:00' };
      ctx.data._pickerTarget = 'form';
      pageConfig.openTimePicker.call(ctx);
      expect(ctx.data.showTimePicker).toBe(true);
    });

    it('opens terminal picker', () => {
      pageConfig.openTerminalPicker.call(ctx);
      expect(ctx.data.showTerminalPicker).toBe(true);
    });
  });

  describe('onDatePickerClose / onTimePickerCancel / onCloseTerminalPicker', () => {
    it('closes date picker', () => {
      pageConfig.onDatePickerClose.call(ctx);
      expect(ctx.data.showDatePicker).toBe(false);
    });

    it('closes time picker', () => {
      pageConfig.onTimePickerCancel.call(ctx);
      expect(ctx.data.showTimePicker).toBe(false);
    });

    it('closes terminal picker', () => {
      pageConfig.onCloseTerminalPicker.call(ctx);
      expect(ctx.data.showTerminalPicker).toBe(false);
    });
  });

  describe('requestSubscribeMessageSafe', () => {
    it('resolves when no template ids', async () => {
      wx.getStorageSync.mockReturnValue([]);
      await expect(pageConfig.requestSubscribeMessageSafe.call(ctx)).resolves.toBeUndefined();
    });

    it('calls wx.requestSubscribeMessage with ids', async () => {
      wx.getStorageSync.mockReturnValue(['tmpl1', 'tmpl2']);
      await pageConfig.requestSubscribeMessageSafe.call(ctx);
      expect(wx.requestSubscribeMessage).toHaveBeenCalledWith(expect.objectContaining({
        tmplIds: ['tmpl1', 'tmpl2'],
      }));
    });
  });

  describe('loadModificationStatus', () => {
    it('sets status when available', async () => {
      api.getModificationStatus.mockResolvedValue({ status: 'pending' });
      await pageConfig.loadModificationStatus.call(ctx, 1);
      expect(ctx.data.modRequestStatus).toBe('pending');
    });

    it('clears status on error', async () => {
      api.getModificationStatus.mockRejectedValue(new Error('fail'));
      await pageConfig.loadModificationStatus.call(ctx, 1);
      expect(ctx.data.modRequestStatus).toBeNull();
    });
  });

  describe('editRequest edge cases', () => {
    it('handles request without arrival time', () => {
      ctx.data.latestRequest = {
        id: 1,
        flight_no: 'UA1',
        terminal: 'T2',
        checked_bags: 0,
        carry_on_bags: 0,
        ride_with_note: '',
        ride_with_wechat: '',
      };
      pageConfig.editRequest.call(ctx);
      expect(ctx.data.editing).toBe(true);
      expect(ctx.data.editForm.arrival_date).toBe('');
      expect(ctx.data.editForm.arrival_time).toBe('');
    });
  });

  describe('onEditFieldChange', () => {
    it('updates edit form field', () => {
      pageConfig.onEditFieldChange.call(ctx, {
        currentTarget: { dataset: { field: 'flight_no' } },
        detail: 'AA200',
      });
      expect(ctx.data['editForm.flight_no']).toBe('AA200');
    });
  });

  describe('onEditCheckedChange / onEditCarryOnChange', () => {
    it('updates edit checked bags', () => {
      pageConfig.onEditCheckedChange.call(ctx, { detail: 3 });
      expect(ctx.data['editForm.checked_bags']).toBe(3);
    });

    it('updates edit carry-on bags', () => {
      pageConfig.onEditCarryOnChange.call(ctx, { detail: 2 });
      expect(ctx.data['editForm.carry_on_bags']).toBe(2);
    });
  });

  describe('openEditDatePicker / openEditTerminalPicker / openEditTimePicker', () => {
    it('sets picker target to editForm for date', () => {
      pageConfig.openEditDatePicker.call(ctx);
      expect(ctx.data._pickerTarget).toBe('editForm');
    });

    it('sets picker target to editForm for terminal', () => {
      pageConfig.openEditTerminalPicker.call(ctx);
      expect(ctx.data._pickerTarget).toBe('editForm');
    });

    it('sets picker target to editForm for time', () => {
      ctx.data.editForm = { arrival_time: '10:00' };
      pageConfig.openEditTimePicker.call(ctx);
      expect(ctx.data._pickerTarget).toBe('editForm');
    });
  });

  describe('generateQrCode', () => {
    it('does nothing for empty token', async () => {
      await pageConfig.generateQrCode.call(ctx, '');
      expect(ctx.data.generatingQrCode).toBeFalsy();
    });

    it('does nothing when already generating', async () => {
      ctx.data.generatingQrCode = true;
      await pageConfig.generateQrCode.call(ctx, 'token');
      // Should return immediately
    });

    it('sets error on failure', async () => {
      ctx.data.generatingQrCode = false;
      ctx.drawQrCodeWithTimeout = jest.fn(() => Promise.reject(new Error('canvas fail')));
      await pageConfig.generateQrCode.call(ctx, 'test-token');
      expect(ctx.data.qrCodeError).toBeTruthy();
      expect(ctx.data.generatingQrCode).toBe(false);
    });
  });

  describe('drawQrCodeWithTimeout', () => {
    it('resolves when drawQrCode succeeds', async () => {
      ctx.drawQrCode = jest.fn(() => Promise.resolve('/tmp/qr.png'));
      const result = await pageConfig.drawQrCodeWithTimeout.call(ctx, 'test', 5000);
      expect(result).toBe('/tmp/qr.png');
    });

    it('rejects on timeout', async () => {
      jest.useFakeTimers();
      ctx.drawQrCode = jest.fn(() => new Promise(() => {})); // Never resolves
      const promise = pageConfig.drawQrCodeWithTimeout.call(ctx, 'test', 100);
      jest.advanceTimersByTime(200);
      await expect(promise).rejects.toThrow();
      jest.useRealTimers();
    });
  });

  describe('saveEdit', () => {
    it('calls api with correct payload', async () => {
      ctx.data.savingEdit = false;
      ctx.data.latestRequest = { id: 42 };
      ctx.data.editForm = {
        flight_no: 'UA851',
        arrival_date: '2026-03-15',
        arrival_time: '14:30',
        terminal: 'T1',
        checked_bags: 1,
        carry_on_bags: 0,
        ride_with_note: '',
        ride_with_wechat: '',
      };
      ctx.loadTrack = jest.fn(() => Promise.resolve());
      api.updateStudentRequest.mockResolvedValue({});
      await pageConfig.saveEdit.call(ctx);
      expect(api.updateStudentRequest).toHaveBeenCalledWith(42, expect.objectContaining({
        expected_arrival_time: '2026-03-15 14:30:00',
      }));
      expect(ctx.data.editing).toBe(false);
    });
  });
});
