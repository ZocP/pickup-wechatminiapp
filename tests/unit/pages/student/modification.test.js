/**
 * Tests for pages/student/modification/index.js
 */

jest.mock('../../../../utils/api', () => ({
  getStudentRequest: jest.fn(),
  getModificationStatus: jest.fn(),
  submitModification: jest.fn(),
  withdrawModification: jest.fn(),
}));

jest.mock('../../../../utils/formatters', () => ({
  formatDateOnly: jest.fn((d) => {
    const date = d instanceof Date ? d : new Date(d);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }),
}));

describe('pages/student/modification', () => {
  let pageConfig;
  let api;
  let ctx;

  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn();
    Object.keys(wx).forEach((k) => {
      if (typeof wx[k] === 'function' && wx[k].mockClear) wx[k].mockClear();
    });

    require('../../../../pages/student/modification/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../../utils/api');

    ctx = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(updates) {
        Object.assign(this.data, updates);
      },
    };
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.requestId).toBeNull();
      expect(pageConfig.data.loading).toBe(true);
      expect(pageConfig.data.submitting).toBe(false);
      expect(pageConfig.data.hasPendingMod).toBe(false);
      expect(pageConfig.data.reason).toBe('');
    });

    it('has form with defaults', () => {
      const form = pageConfig.data.form;
      expect(form.flight_no).toBe('');
      expect(form.arrival_date).toBe('');
      expect(form.arrival_time).toBe('');
      expect(form.checked_bags).toBe(0);
      expect(form.carry_on_bags).toBe(0);
    });
  });

  describe('onLoad', () => {
    it('shows error and goes back with no requestId', () => {
      pageConfig.onLoad.call(ctx, {});
      expect(wx.showToast).toHaveBeenCalled();
      expect(wx.navigateBack).toHaveBeenCalled();
    });

    it('sets requestId and loads data', () => {
      ctx.loadData = jest.fn(() => Promise.resolve());
      pageConfig.onLoad.call(ctx, { requestId: '42' });
      expect(ctx.data.requestId).toBe(42);
      expect(ctx.loadData).toHaveBeenCalled();
    });

    it('sets i18n object', () => {
      ctx.loadData = jest.fn(() => Promise.resolve());
      pageConfig.onLoad.call(ctx, { requestId: '1' });
      expect(ctx.data.i18n).toBeDefined();
      expect(typeof ctx.data.i18n.modification_title).toBe('string');
    });
  });

  describe('loadData', () => {
    it('populates form from request data', async () => {
      ctx.data.requestId = 42;
      api.getStudentRequest.mockResolvedValue({
        id: 42,
        flight_no: 'UA851',
        arrival_time: '2026-03-15T14:30:00Z',
        checked_bags: 2,
        carry_on_bags: 1,
        ride_with_note: 'note',
        ride_with_wechat: 'wx_id',
      });
      api.getModificationStatus.mockRejectedValue(new Error('not found'));

      await pageConfig.loadData.call(ctx);
      expect(ctx.data.form.flight_no).toBe('UA851');
      expect(ctx.data.form.checked_bags).toBe(2);
      expect(ctx.data.form.carry_on_bags).toBe(1);
      expect(ctx.data.loading).toBe(false);
    });

    it('detects pending modification', async () => {
      ctx.data.requestId = 42;
      api.getStudentRequest.mockResolvedValue({ id: 42, flight_no: 'UA851' });
      api.getModificationStatus.mockResolvedValue({ status: 'pending' });

      await pageConfig.loadData.call(ctx);
      expect(ctx.data.hasPendingMod).toBe(true);
    });

    it('navigates back when request not found', async () => {
      ctx.data.requestId = 99;
      api.getStudentRequest.mockResolvedValue(null);

      await pageConfig.loadData.call(ctx);
      expect(wx.navigateBack).toHaveBeenCalled();
    });

    it('shows toast on error', async () => {
      ctx.data.requestId = 42;
      api.getStudentRequest.mockRejectedValue(new Error('network'));

      await pageConfig.loadData.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.loading).toBe(false);
    });
  });

  describe('onFieldChange', () => {
    it('updates form field', () => {
      pageConfig.onFieldChange.call(ctx, {
        currentTarget: { dataset: { field: 'flight_no' } },
        detail: 'AA100',
      });
      expect(ctx.data['form.flight_no']).toBe('AA100');
    });
  });

  describe('onReasonChange', () => {
    it('updates reason', () => {
      pageConfig.onReasonChange.call(ctx, { detail: 'flight changed' });
      expect(ctx.data.reason).toBe('flight changed');
    });
  });

  describe('onStepperCheckedChange / onStepperCarryOnChange', () => {
    it('updates checked bags', () => {
      pageConfig.onStepperCheckedChange.call(ctx, { detail: 4 });
      expect(ctx.data['form.checked_bags']).toBe(4);
    });

    it('updates carry-on bags', () => {
      pageConfig.onStepperCarryOnChange.call(ctx, { detail: 2 });
      expect(ctx.data['form.carry_on_bags']).toBe(2);
    });
  });

  describe('onBagsOverLimit', () => {
    it('shows toast for plus', () => {
      pageConfig.onBagsOverLimit.call(ctx, { detail: 'plus' });
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('does nothing for minus', () => {
      wx.showToast.mockClear();
      pageConfig.onBagsOverLimit.call(ctx, { detail: 'minus' });
      expect(wx.showToast).not.toHaveBeenCalled();
    });
  });

  describe('onSubmit', () => {
    it('prevents double submit', async () => {
      ctx.data.submitting = true;
      await pageConfig.onSubmit.call(ctx);
      expect(api.submitModification).not.toHaveBeenCalled();
    });

    it('validates required fields', async () => {
      ctx.data.submitting = false;
      ctx.data.form = { flight_no: '', arrival_date: '', arrival_time: '', checked_bags: 0, carry_on_bags: 0, ride_with_note: '', ride_with_wechat: '' };
      await pageConfig.onSubmit.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
      expect(api.submitModification).not.toHaveBeenCalled();
    });

    it('validates wechat format', async () => {
      ctx.data.submitting = false;
      ctx.data.form = {
        flight_no: 'UA1', arrival_date: '2026-03-15', arrival_time: '14:00',
        checked_bags: 0, carry_on_bags: 0, ride_with_note: '',
        ride_with_wechat: 'ab',  // too short
      };
      await pageConfig.onSubmit.call(ctx);
      expect(api.submitModification).not.toHaveBeenCalled();
    });

    it('submits valid modification', async () => {
      ctx.data.submitting = false;
      ctx.data.requestId = 42;
      ctx.data.reason = 'flight changed';
      ctx.data.form = {
        flight_no: 'UA851', arrival_date: '2026-03-15', arrival_time: '14:30',
        checked_bags: 1, carry_on_bags: 0, ride_with_note: '',
        ride_with_wechat: '',
      };
      api.submitModification.mockResolvedValue({});

      await pageConfig.onSubmit.call(ctx);
      expect(api.submitModification).toHaveBeenCalledWith(42, expect.objectContaining({
        new_flight_number: 'UA851',
        new_arrival_time: '2026-03-15 14:30:00',
        reason: 'flight changed',
      }));
    });

    it('resets submitting on error', async () => {
      ctx.data.submitting = false;
      ctx.data.requestId = 42;
      ctx.data.form = {
        flight_no: 'UA1', arrival_date: '2026-03-15', arrival_time: '14:00',
        checked_bags: 0, carry_on_bags: 0, ride_with_note: '',
        ride_with_wechat: '',
      };
      api.submitModification.mockRejectedValue(new Error('fail'));

      await pageConfig.onSubmit.call(ctx);
      expect(ctx.data.submitting).toBe(false);
    });
  });

  describe('onWithdraw', () => {
    it('does nothing when user cancels confirm', async () => {
      wx.showModal.mockImplementation(({ success }) => success({ confirm: false }));
      await pageConfig.onWithdraw.call(ctx);
      expect(api.withdrawModification).not.toHaveBeenCalled();
    });

    it('withdraws on confirm', async () => {
      ctx.data.requestId = 42;
      wx.showModal.mockImplementation(({ success }) => success({ confirm: true }));
      api.withdrawModification.mockResolvedValue({});
      await pageConfig.onWithdraw.call(ctx);
      expect(api.withdrawModification).toHaveBeenCalledWith(42);
      expect(ctx.data.hasPendingMod).toBe(false);
    });

    it('shows error on withdrawal failure', async () => {
      ctx.data.requestId = 42;
      wx.showModal.mockImplementation(({ success }) => success({ confirm: true }));
      api.withdrawModification.mockRejectedValue(new Error('network'));
      await pageConfig.onWithdraw.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onDateConfirm', () => {
    it('sets arrival date', () => {
      pageConfig.onDateConfirm.call(ctx, { detail: new Date(2026, 2, 20) });
      expect(ctx.data['form.arrival_date']).toBe('2026-03-20');
      expect(ctx.data.showDatePicker).toBe(false);
    });
  });

  describe('onTimeConfirm', () => {
    it('sets arrival time', () => {
      pageConfig.onTimeConfirm.call(ctx, { detail: '16:45' });
      expect(ctx.data['form.arrival_time']).toBe('16:45');
      expect(ctx.data.showTimePicker).toBe(false);
    });

    it('keeps default for empty', () => {
      ctx.data.timePickerValue = '12:00';
      pageConfig.onTimeConfirm.call(ctx, { detail: '' });
      expect(ctx.data.timePickerValue).toBe('12:00');
    });
  });

  describe('openDatePicker / openTimePicker', () => {
    it('opens date picker', () => {
      pageConfig.openDatePicker.call(ctx);
      expect(ctx.data.showDatePicker).toBe(true);
    });

    it('opens time picker', () => {
      ctx.data.form = { ...ctx.data.form, arrival_time: '10:00' };
      pageConfig.openTimePicker.call(ctx);
      expect(ctx.data.showTimePicker).toBe(true);
    });
  });
});
