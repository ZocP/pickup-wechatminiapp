/**
 * Tests for pages/admin/assign/index.js
 */

jest.mock('../../../../utils/api', () => ({
  getUnassignedRequests: jest.fn(),
  getAvailableShifts: jest.fn(),
  assignRequestToShift: jest.fn(),
}));

jest.mock('../../../../utils/i18n', () => ({ t: (key) => key }));
jest.mock('../../../../utils/formatters', () => ({
  formatDateTime: jest.fn((v) => v || '--'),
  formatDateOnly: jest.fn((v) => v || '--'),
}));
jest.mock('../../../../utils/helpers', () => ({
  resolveRequestName: jest.fn((item) => item.name || 'Unknown'),
  buildRideWithText: jest.fn(() => ''),
}));

describe('pages/admin/assign', () => {
  let pageConfig;
  let api;
  let ctx;

  function makeCtx(overrides) {
    return {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(updates) { Object.assign(this.data, updates); },
      _searchTimer: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    global.Page = jest.fn();
    Object.keys(wx).forEach((k) => {
      if (typeof wx[k] === 'function' && wx[k].mockClear) wx[k].mockClear();
    });
    global.getApp = jest.fn(() => ({
      markDashboardDirty: jest.fn(),
    }));

    require('../../../../pages/admin/assign/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../../utils/api');
    ctx = makeCtx();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.loading).toBe(false);
      expect(pageConfig.data.requests).toEqual([]);
      expect(pageConfig.data.filteredRequests).toEqual([]);
      expect(pageConfig.data.searchKeyword).toBe('');
      expect(pageConfig.data.showShiftPopup).toBe(false);
      expect(pageConfig.data.loadingShifts).toBe(false);
      expect(pageConfig.data.selectedRequest).toBeNull();
      expect(pageConfig.data.availableShifts).toEqual([]);
      expect(pageConfig.data.actionBusy).toBe(false);
    });

    it('has i18n populated', () => {
      expect(pageConfig.data.i18n).toBeDefined();
      expect(typeof pageConfig.data.i18n.assign_no_requests).toBe('string');
    });
  });

  describe('onLoad', () => {
    it('sets nav bar title and i18n', () => {
      ctx.onLoad();
      expect(wx.setNavigationBarTitle).toHaveBeenCalledWith({ title: 'assign_nav_title' });
    });
  });

  describe('onShow', () => {
    it('calls loadRequests', async () => {
      api.getUnassignedRequests.mockResolvedValue([]);
      await ctx.onShow();
      expect(api.getUnassignedRequests).toHaveBeenCalled();
    });
  });

  describe('onPullDownRefresh', () => {
    it('reloads and stops refresh', async () => {
      api.getUnassignedRequests.mockResolvedValue([]);
      await ctx.onPullDownRefresh();
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });

  describe('loadRequests', () => {
    it('loads array response', async () => {
      api.getUnassignedRequests.mockResolvedValue([
        { id: 1, name: 'Alice', flight_no: 'AA100', arrival_date: '2026-03-10', arrival_time: '14:00' },
      ]);
      await ctx.loadRequests();
      expect(ctx.data.loading).toBe(false);
      expect(ctx.data.requests).toHaveLength(1);
      expect(ctx.data.requests[0].userName).toBe('Alice');
      expect(ctx.data.filteredRequests).toHaveLength(1);
    });

    it('handles {data: [...]} response format', async () => {
      api.getUnassignedRequests.mockResolvedValue({ data: [{ id: 1, name: 'Bob' }] });
      await ctx.loadRequests();
      expect(ctx.data.requests).toHaveLength(1);
    });

    it('handles non-array response', async () => {
      api.getUnassignedRequests.mockResolvedValue(null);
      await ctx.loadRequests();
      expect(ctx.data.requests).toEqual([]);
    });

    it('shows toast on error', async () => {
      api.getUnassignedRequests.mockRejectedValue(new Error('fail'));
      await ctx.loadRequests();
      expect(ctx.data.loading).toBe(false);
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('formatTimeOnly (via loadRequests)', () => {
    it('extracts time from ISO string', async () => {
      api.getUnassignedRequests.mockResolvedValue([
        { id: 1, arrival_time: '2026-03-10T14:30:00Z' },
      ]);
      await ctx.loadRequests();
      expect(ctx.data.requests[0].arrivalTimeText).toBe('14:30');
    });

    it('extracts time from space-separated string', async () => {
      api.getUnassignedRequests.mockResolvedValue([
        { id: 1, arrival_time: '2026-03-10 09:15:00' },
      ]);
      await ctx.loadRequests();
      expect(ctx.data.requests[0].arrivalTimeText).toBe('09:15');
    });

    it('extracts first 5 chars for plain time', async () => {
      api.getUnassignedRequests.mockResolvedValue([
        { id: 1, arrival_time: '08:45' },
      ]);
      await ctx.loadRequests();
      expect(ctx.data.requests[0].arrivalTimeText).toBe('08:45');
    });

    it('returns -- for null/empty', async () => {
      api.getUnassignedRequests.mockResolvedValue([
        { id: 1, arrival_time: null },
      ]);
      await ctx.loadRequests();
      expect(ctx.data.requests[0].arrivalTimeText).toBe('--');
    });
  });

  describe('search / filter', () => {
    beforeEach(async () => {
      api.getUnassignedRequests.mockResolvedValue([
        { id: 1, name: 'Alice', flight_no: 'AA100', wechat_id: 'alice_wx' },
        { id: 2, name: 'Bob', flight_no: 'UA200', wechat_id: 'bob_wx' },
        { id: 3, name: 'Charlie', flight_no: 'DL300', wechat_id: 'charlie_wx' },
      ]);
      await ctx.loadRequests();
    });

    it('filters by name', () => {
      ctx.onSearchChange({ detail: 'alice' });
      jest.advanceTimersByTime(300);
      expect(ctx.data.filteredRequests).toHaveLength(1);
      expect(ctx.data.filteredRequests[0].userName).toBe('Alice');
    });

    it('filters by flight number', () => {
      ctx.onSearchChange({ detail: 'ua200' });
      jest.advanceTimersByTime(300);
      expect(ctx.data.filteredRequests).toHaveLength(1);
    });

    it('filters by wechat_id', () => {
      ctx.onSearchChange({ detail: 'bob_wx' });
      jest.advanceTimersByTime(300);
      expect(ctx.data.filteredRequests).toHaveLength(1);
    });

    it('shows all when keyword empty', () => {
      ctx.onSearchChange({ detail: 'alice' });
      jest.advanceTimersByTime(300);
      ctx.onSearchClear();
      expect(ctx.data.filteredRequests).toHaveLength(3);
    });

    it('returns empty for no matches', () => {
      ctx.onSearchChange({ detail: 'zzz_nonexistent' });
      jest.advanceTimersByTime(300);
      expect(ctx.data.filteredRequests).toEqual([]);
    });

    it('debounces search input', () => {
      ctx.onSearchChange({ detail: 'alice' });
      ctx.onSearchChange({ detail: 'bob' });
      jest.advanceTimersByTime(300);
      // Should filter by 'bob' not 'alice'
      expect(ctx.data.filteredRequests).toHaveLength(1);
      expect(ctx.data.filteredRequests[0].userName).toBe('Bob');
    });
  });

  describe('onAssign', () => {
    it('opens popup and loads shifts', async () => {
      api.getAvailableShifts.mockResolvedValue([]);
      const request = { id: 1, arrival_time: '2026-03-10T14:00:00Z' };
      await ctx.onAssign({ currentTarget: { dataset: { request } } });
      expect(ctx.data.showShiftPopup).toBe(true);
      expect(ctx.data.selectedRequest).toBe(request);
    });

    it('ignores if no request', () => {
      ctx.onAssign({ currentTarget: { dataset: {} } });
      expect(ctx.data.showShiftPopup).toBe(false);
    });
  });

  describe('loadAvailableShifts', () => {
    it('loads and processes shifts', async () => {
      api.getAvailableShifts.mockResolvedValue([
        {
          id: 10,
          departure_time: '2026-03-10T15:00:00Z',
          driver: { name: 'DriverA', car_model: 'Toyota', max_seats: 6, max_checked: 4, max_carry_on: 2 },
          current_seats: 2,
          current_checked: 1,
          current_carry_on: 0,
        },
      ]);
      await ctx.loadAvailableShifts({ arrival_time: '2026-03-10T14:00:00Z' });
      expect(ctx.data.availableShifts).toHaveLength(1);
      expect(ctx.data.availableShifts[0].driverName).toBe('DriverA');
      expect(ctx.data.availableShifts[0].remainSeats).toBe(4);
      expect(ctx.data.availableShifts[0].remainChecked).toBe(3);
      expect(ctx.data.availableShifts[0].remainCarryOn).toBe(2);
      expect(ctx.data.availableShifts[0].seatsFull).toBe(false);
    });

    it('marks full when no remaining', async () => {
      api.getAvailableShifts.mockResolvedValue([
        {
          id: 10,
          departure_time: '2026-03-10T15:00:00Z',
          driver: { max_seats: 2, max_checked: 1, max_carry_on: 1 },
          current_seats: 2,
          current_checked: 1,
          current_carry_on: 1,
        },
      ]);
      await ctx.loadAvailableShifts({ arrival_time: '2026-03-10T14:00:00Z' });
      expect(ctx.data.availableShifts[0].seatsFull).toBe(true);
      expect(ctx.data.availableShifts[0].checkedFull).toBe(true);
      expect(ctx.data.availableShifts[0].carryOnFull).toBe(true);
    });

    it('handles no arrival time', async () => {
      await ctx.loadAvailableShifts({});
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.loadingShifts).toBe(false);
    });

    it('uses calc_pickup_time as fallback', async () => {
      api.getAvailableShifts.mockResolvedValue([]);
      await ctx.loadAvailableShifts({ calc_pickup_time: '2026-03-10T14:00:00Z' });
      expect(api.getAvailableShifts).toHaveBeenCalledWith('2026-03-10T14:00:00Z');
    });

    it('handles API error', async () => {
      api.getAvailableShifts.mockRejectedValue(new Error('fail'));
      await ctx.loadAvailableShifts({ arrival_time: '2026-03-10T14:00:00Z' });
      expect(ctx.data.loadingShifts).toBe(false);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('handles {data: [...]} response', async () => {
      api.getAvailableShifts.mockResolvedValue({ data: [{ id: 1, departure_time: 'x', driver: {} }] });
      await ctx.loadAvailableShifts({ arrival_time: 'x' });
      expect(ctx.data.availableShifts).toHaveLength(1);
    });

    it('handles driver with no name', async () => {
      api.getAvailableShifts.mockResolvedValue([
        { id: 1, departure_time: 'x', driver: {} },
      ]);
      await ctx.loadAvailableShifts({ arrival_time: 'x' });
      expect(ctx.data.availableShifts[0].driverName).toBe('common_unassigned_driver');
    });
  });

  describe('onSelectShift', () => {
    beforeEach(() => {
      ctx.data.selectedRequest = { id: 1 };
    });

    it('assigns and reloads on success', async () => {
      api.assignRequestToShift.mockResolvedValue({});
      api.getUnassignedRequests.mockResolvedValue([]);
      await ctx.onSelectShift({ currentTarget: { dataset: { shift: { id: 10 } } } });
      expect(api.assignRequestToShift).toHaveBeenCalledWith(1, 10);
      expect(ctx.data.showShiftPopup).toBe(false);
      expect(ctx.data.actionBusy).toBe(false);
    });

    it('shows warning message if returned', async () => {
      api.assignRequestToShift.mockResolvedValue({ warning: 'overload' });
      api.getUnassignedRequests.mockResolvedValue([]);
      await ctx.onSelectShift({ currentTarget: { dataset: { shift: { id: 10 } } } });
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.stringContaining('overload'),
      }));
    });

    it('handles API error', async () => {
      api.assignRequestToShift.mockRejectedValue(new Error('fail'));
      await ctx.onSelectShift({ currentTarget: { dataset: { shift: { id: 10 } } } });
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.actionBusy).toBe(false);
    });

    it('prevents double-click', async () => {
      ctx.data.actionBusy = true;
      await ctx.onSelectShift({ currentTarget: { dataset: { shift: { id: 10 } } } });
      expect(api.assignRequestToShift).not.toHaveBeenCalled();
    });

    it('ignores if no shift or request', async () => {
      ctx.data.selectedRequest = null;
      await ctx.onSelectShift({ currentTarget: { dataset: { shift: { id: 10 } } } });
      expect(api.assignRequestToShift).not.toHaveBeenCalled();
    });

    it('calls markDashboardDirty on success', async () => {
      const mockApp = { markDashboardDirty: jest.fn() };
      global.getApp = jest.fn(() => mockApp);
      api.assignRequestToShift.mockResolvedValue({});
      api.getUnassignedRequests.mockResolvedValue([]);
      await ctx.onSelectShift({ currentTarget: { dataset: { shift: { id: 10 } } } });
      expect(mockApp.markDashboardDirty).toHaveBeenCalled();
    });
  });

  describe('onCloseShiftPopup', () => {
    it('closes the popup', () => {
      ctx.data.showShiftPopup = true;
      ctx.onCloseShiftPopup();
      expect(ctx.data.showShiftPopup).toBe(false);
    });
  });
});
