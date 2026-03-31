/**
 * Tests for pages/driver/index.js
 */

jest.mock('../../../../utils/api', () => ({
  getDriverShifts: jest.fn(),
  getShiftPassengers: jest.fn(),
  verifyBoarding: jest.fn(),
}));

jest.mock('../../../../utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

describe('pages/driver', () => {
  let pageConfig;
  let api;
  let ctx;

  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn();
    Object.keys(wx).forEach((k) => {
      if (typeof wx[k] === 'function' && wx[k].mockClear) wx[k].mockClear();
    });

    require('../../../../pages/driver/index');
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
      expect(pageConfig.data.loading).toBe(false);
      expect(pageConfig.data.shifts).toEqual([]);
      expect(pageConfig.data.selectedShiftId).toBeNull();
      expect(pageConfig.data.selectedShift).toBeNull();
      expect(pageConfig.data.passengers).toEqual([]);
      expect(pageConfig.data.showScanModal).toBe(false);
      expect(pageConfig.data.scanResult).toBeNull();
      expect(pageConfig.data.scanning).toBe(false);
    });

    it('has i18n populated after onLoad', () => {
      // i18n is set during onLoad, not in initial data
      pageConfig.onLoad.call(ctx);
      expect(ctx.data.i18n).toBeDefined();
      expect(typeof ctx.data.i18n.driver_scan_btn).toBe('string');
      expect(typeof ctx.data.i18n.driver_no_shift).toBe('string');
    });
  });

  describe('loadDriverShifts', () => {
    it('loads and enriches shifts', async () => {
      const futureTime = new Date(Date.now() + 3600 * 1000).toISOString();
      api.getDriverShifts.mockResolvedValue([
        {
          id: 1,
          departure_time: futureTime,
          status: 'published',
          driver: { name: 'TestDriver', max_seats: 4 },
          requests: [{ boarded_at: '2026-03-10T10:00:00Z' }, { boarded_at: null }],
        },
      ]);
      api.getShiftPassengers.mockResolvedValue([]);

      await pageConfig.loadDriverShifts.call(ctx);
      expect(ctx.data.shifts).toHaveLength(1);
      expect(ctx.data.shifts[0].boardedCount).toBe(1);
      expect(ctx.data.shifts[0].capacity).toBe(4);
      expect(ctx.data.selectedShiftId).toBe(1);
      expect(ctx.data.loading).toBe(false);
    });

    it('auto-selects nearest future shift', async () => {
      const past = new Date(Date.now() - 3600 * 1000).toISOString();
      const future = new Date(Date.now() + 3600 * 1000).toISOString();
      api.getDriverShifts.mockResolvedValue([
        { id: 1, departure_time: past, status: 'published', requests: [] },
        { id: 2, departure_time: future, status: 'published', requests: [] },
      ]);
      api.getShiftPassengers.mockResolvedValue([]);

      await pageConfig.loadDriverShifts.call(ctx);
      expect(ctx.data.selectedShiftId).toBe(2);
    });

    it('shows toast when no shifts', async () => {
      api.getDriverShifts.mockResolvedValue([]);
      await pageConfig.loadDriverShifts.call(ctx);
      expect(ctx.data.shifts).toHaveLength(0);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('handles error gracefully', async () => {
      api.getDriverShifts.mockRejectedValue(new Error('network'));
      await pageConfig.loadDriverShifts.call(ctx);
      expect(ctx.data.shifts).toEqual([]);
      expect(ctx.data.loading).toBe(false);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('handles non-array response', async () => {
      api.getDriverShifts.mockResolvedValue({ data: [{ id: 1, departure_time: null, status: 'draft', requests: [] }] });
      api.getShiftPassengers.mockResolvedValue([]);
      await pageConfig.loadDriverShifts.call(ctx);
      expect(ctx.data.shifts).toHaveLength(1);
    });

    it('keeps previous selection if still valid', async () => {
      ctx.data.selectedShiftId = 2;
      api.getDriverShifts.mockResolvedValue([
        { id: 1, departure_time: null, status: 'draft', requests: [] },
        { id: 2, departure_time: null, status: 'draft', requests: [] },
      ]);
      api.getShiftPassengers.mockResolvedValue([]);
      await pageConfig.loadDriverShifts.call(ctx);
      expect(ctx.data.selectedShiftId).toBe(2);
    });
  });

  describe('_loadPassengers', () => {
    it('returns enriched passengers', async () => {
      api.getShiftPassengers.mockResolvedValue([
        { id: 1, name: 'Alice', status: 'boarded', student_id: 'S001' },
        { id: 2, user_name: 'Bob', boarding_status: 'assigned' },
      ]);
      const result = await pageConfig._loadPassengers.call(ctx, 1);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
    });

    it('handles non-array response', async () => {
      api.getShiftPassengers.mockResolvedValue({ data: [{ id: 1, name: 'Test' }] });
      const result = await pageConfig._loadPassengers.call(ctx, 1);
      expect(result).toHaveLength(1);
    });

    it('returns empty on error', async () => {
      api.getShiftPassengers.mockRejectedValue(new Error('fail'));
      const result = await pageConfig._loadPassengers.call(ctx, 1);
      expect(result).toEqual([]);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('generates fallback name from id', async () => {
      api.getShiftPassengers.mockResolvedValue([{ id: 5 }]);
      const result = await pageConfig._loadPassengers.call(ctx, 1);
      expect(result[0].name).toContain('5');
    });
  });

  describe('selectShift', () => {
    it('selects a different shift', async () => {
      ctx.data.shifts = [
        { id: 1, name: 'Shift A' },
        { id: 2, name: 'Shift B' },
      ];
      ctx.data.selectedShiftId = 1;
      ctx._loadPassengers = jest.fn(() => Promise.resolve([{ id: 10, name: 'P1' }]));
      await pageConfig.selectShift.call(ctx, { currentTarget: { dataset: { id: 2 } } });
      expect(ctx.data.selectedShiftId).toBe(2);
    });

    it('does nothing when same shift selected', async () => {
      ctx.data.selectedShiftId = 1;
      ctx._loadPassengers = jest.fn();
      await pageConfig.selectShift.call(ctx, { currentTarget: { dataset: { id: 1 } } });
      expect(ctx._loadPassengers).not.toHaveBeenCalled();
    });
  });

  describe('openScanModal / closeScanModal', () => {
    it('opens scan modal', () => {
      pageConfig.openScanModal.call(ctx);
      expect(ctx.data.showScanModal).toBe(true);
      expect(ctx.data.scanResult).toBeNull();
    });

    it('closes scan modal', () => {
      ctx.data.showScanModal = true;
      pageConfig.closeScanModal.call(ctx);
      expect(ctx.data.showScanModal).toBe(false);
    });
  });

  describe('startScan', () => {
    it('prevents double scan', async () => {
      ctx.data.scanning = true;
      await pageConfig.startScan.call(ctx);
      expect(wx.scanCode).not.toHaveBeenCalled();
    });

    it('calls scanCode and verifyBoarding on success', async () => {
      ctx.data.scanning = false;
      ctx.verifyBoarding = jest.fn(() => Promise.resolve());
      wx.scanCode.mockResolvedValue({ result: 'qr-data-123' });
      await pageConfig.startScan.call(ctx);
      expect(wx.scanCode).toHaveBeenCalledWith(expect.objectContaining({ onlyFromCamera: true }));
      expect(ctx.verifyBoarding).toHaveBeenCalledWith('qr-data-123');
      expect(ctx.data.scanning).toBe(false);
    });

    it('handles scan cancel silently', async () => {
      ctx.data.scanning = false;
      wx.scanCode.mockRejectedValue({ errMsg: 'scanCode:fail cancel' });
      await pageConfig.startScan.call(ctx);
      expect(wx.showToast).not.toHaveBeenCalled();
      expect(ctx.data.scanning).toBe(false);
    });

    it('shows toast on scan error', async () => {
      ctx.data.scanning = false;
      wx.scanCode.mockRejectedValue({ errMsg: 'scanCode:fail unknown' });
      await pageConfig.startScan.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('verifyBoarding', () => {
    it('sets success result for new boarding', async () => {
      ctx.loadDriverShifts = jest.fn(() => Promise.resolve());
      api.verifyBoarding.mockResolvedValue({
        request: { user: { name: 'Alice' }, boarded_at: null },
      });
      await pageConfig.verifyBoarding.call(ctx, 'token-123');
      expect(ctx.data.scanResult.success).toBe(true);
      expect(ctx.data.scanResult.message).toContain('Alice');
      expect(wx.vibrateShort).toHaveBeenCalled();
    });

    it('sets already boarded message', async () => {
      ctx.loadDriverShifts = jest.fn(() => Promise.resolve());
      api.verifyBoarding.mockResolvedValue({
        request: { user: { name: 'Bob' }, boarded_at: '2026-03-10T10:00:00Z' },
      });
      await pageConfig.verifyBoarding.call(ctx, 'token-123');
      expect(ctx.data.scanResult.success).toBe(true);
    });

    it('handles verification error', async () => {
      api.verifyBoarding.mockRejectedValue(new Error('invalid token'));
      await pageConfig.verifyBoarding.call(ctx, 'bad-token');
      expect(ctx.data.scanResult.success).toBe(false);
      expect(ctx.data.scanResult.message).toContain('invalid token');
    });

    it('detects duplicate boarding from error message', async () => {
      api.verifyBoarding.mockRejectedValue(new Error('该学生已登车'));
      await pageConfig.verifyBoarding.call(ctx, 'token');
      expect(ctx.data.scanResult.success).toBe(false);
    });
  });

  describe('continueScan', () => {
    it('clears result and starts new scan', () => {
      ctx.data.scanResult = { success: true, message: 'test' };
      ctx.startScan = jest.fn();
      pageConfig.continueScan.call(ctx);
      expect(ctx.data.scanResult).toBeNull();
      expect(ctx.startScan).toHaveBeenCalled();
    });
  });

  describe('finishScan', () => {
    it('closes modal and clears result', () => {
      ctx.data.showScanModal = true;
      ctx.data.scanResult = { success: true };
      pageConfig.finishScan.call(ctx);
      expect(ctx.data.showScanModal).toBe(false);
      expect(ctx.data.scanResult).toBeNull();
    });
  });

  describe('formatTime', () => {
    it('formats valid time string', () => {
      const result = pageConfig.formatTime('2026-03-10 14:30:00');
      expect(result).toContain('2026');
    });

    it('returns empty for empty string', () => {
      expect(pageConfig.formatTime('')).toBe('');
    });

    it('returns empty for null', () => {
      expect(pageConfig.formatTime(null)).toBe('');
    });
  });
});
