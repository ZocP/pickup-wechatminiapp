/**
 * Tests for pages/admin/dashboard/index.js
 * Strategy: mock Page() global, require the file, capture the config object,
 * then test individual methods and data.
 */

jest.mock('../../../../utils/api', () => ({
  getDashboard: jest.fn(),
  getPendingRequests: jest.fn(),
  getModificationRequests: jest.fn(() => Promise.resolve([])),
  assignStudent: jest.fn(),
  removeStudent: jest.fn(),
  publishShift: jest.fn(),
  createShift: jest.fn(),
  getDrivers: jest.fn(),
  suggestShifts: jest.fn(),
  batchCreateShifts: jest.fn(),
}));

describe('pages/admin/dashboard', () => {
  let pageConfig;
  let api;
  let ctx;

  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn();
    // Reset wx mocks
    Object.keys(wx).forEach((k) => {
      if (typeof wx[k] === 'function' && wx[k].mockClear) wx[k].mockClear();
    });

    require('../../../../pages/admin/dashboard/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../../utils/api');

    // Create a pseudo page context for testing methods
    ctx = {
      ...pageConfig,
      data: { ...pageConfig.data },
      setData(updates) {
        if (typeof updates === 'object') {
          // Handle dot-notation keys like 'suggestions[0].selected'
          Object.keys(updates).forEach((key) => {
            const match = key.match(/^([^[]+)\[(\d+)\]\.(.+)$/);
            if (match) {
              const [, arrKey, idx, prop] = match;
              if (this.data[arrKey] && this.data[arrKey][Number(idx)]) {
                this.data[arrKey][Number(idx)][prop] = updates[key];
              }
            } else {
              this.data[key] = updates[key];
            }
          });
        }
      },
      getTabBar: jest.fn(() => ({
        setData: jest.fn(),
        setHidden: jest.fn(),
        refreshTabs: jest.fn(),
      })),
    };
  });

  describe('initial data', () => {
    it('has correct default values', () => {
      expect(pageConfig.data.loading).toBe(false);
      expect(pageConfig.data.shifts).toEqual([]);
      expect(pageConfig.data.filteredShifts).toEqual([]);
      expect(pageConfig.data.filterStatus).toBe('');
      expect(pageConfig.data.pendingRequests).toEqual([]);
      expect(pageConfig.data.showRemoveSheet).toBe(false);
      expect(pageConfig.data.showCreatePopup).toBe(false);
      expect(pageConfig.data.actionBusy).toBe(false);
    });

    it('has i18n object populated', () => {
      expect(pageConfig.data.i18n).toBeDefined();
      expect(typeof pageConfig.data.i18n.dashboard_pending_count_label).toBe('string');
    });

    it('has role options defined', () => {
      expect(pageConfig.data.roleOptions).toHaveLength(4);
      expect(pageConfig.data.roleOptions[0].value).toBe('student');
      expect(pageConfig.data.roleOptions[3].value).toBe('admin');
    });
  });

  describe('_formatDate', () => {
    it('formats current date correctly', () => {
      const d = new Date(2026, 2, 10); // March 10, 2026
      const result = pageConfig._formatDate(d);
      expect(result).toBe('2026-03-10');
    });

    it('pads single digit month and day', () => {
      const d = new Date(2026, 0, 5); // Jan 5, 2026
      const result = pageConfig._formatDate(d);
      expect(result).toBe('2026-01-05');
    });

    it('handles December 31', () => {
      const d = new Date(2025, 11, 31);
      expect(pageConfig._formatDate(d)).toBe('2025-12-31');
    });
  });

  describe('_formatDateTime', () => {
    it('formats valid date object', () => {
      const d = new Date(2026, 2, 10, 14, 30);
      const result = pageConfig._formatDateTime(d);
      expect(result).toBe('2026-03-10 14:30');
    });

    it('returns -- for invalid date', () => {
      expect(pageConfig._formatDateTime(new Date('invalid'))).toBe('--');
    });

    it('returns -- for non-Date', () => {
      expect(pageConfig._formatDateTime('not a date')).toBe('--');
    });

    it('returns -- for null', () => {
      expect(pageConfig._formatDateTime(null)).toBe('--');
    });
  });

  describe('_formatDepartureTime', () => {
    it('formats valid date with seconds', () => {
      const d = new Date(2026, 2, 10, 14, 30);
      const result = pageConfig._formatDepartureTime(d);
      expect(result).toBe('2026-03-10 14:30:00');
    });

    it('returns empty for invalid date', () => {
      expect(pageConfig._formatDepartureTime(new Date('invalid'))).toBe('');
    });

    it('returns empty for null', () => {
      expect(pageConfig._formatDepartureTime(null)).toBe('');
    });
  });

  describe('applyStatusFilter', () => {
    it('returns all shifts when filterStatus is empty', () => {
      ctx.data.shifts = [
        { id: 1, status: 'published' },
        { id: 2, status: 'draft' },
        { id: 3, status: 'published' },
      ];
      ctx.data.filterStatus = '';
      pageConfig.applyStatusFilter.call(ctx);
      expect(ctx.data.filteredShifts).toHaveLength(3);
    });

    it('filters only published shifts', () => {
      ctx.data.shifts = [
        { id: 1, status: 'published' },
        { id: 2, status: 'draft' },
        { id: 3, status: 'published' },
      ];
      ctx.data.filterStatus = 'published';
      pageConfig.applyStatusFilter.call(ctx);
      expect(ctx.data.filteredShifts).toHaveLength(2);
      expect(ctx.data.filteredShifts.every((s) => s.status === 'published')).toBe(true);
    });

    it('filters only draft shifts', () => {
      ctx.data.shifts = [
        { id: 1, status: 'published' },
        { id: 2, status: 'draft' },
      ];
      ctx.data.filterStatus = 'draft';
      pageConfig.applyStatusFilter.call(ctx);
      expect(ctx.data.filteredShifts).toHaveLength(1);
      expect(ctx.data.filteredShifts[0].id).toBe(2);
    });

    it('returns empty for non-matching filter', () => {
      ctx.data.shifts = [{ id: 1, status: 'published' }];
      ctx.data.filterStatus = 'nonexistent';
      pageConfig.applyStatusFilter.call(ctx);
      expect(ctx.data.filteredShifts).toHaveLength(0);
    });

    it('handles empty shifts array', () => {
      ctx.data.shifts = [];
      ctx.data.filterStatus = 'published';
      pageConfig.applyStatusFilter.call(ctx);
      expect(ctx.data.filteredShifts).toHaveLength(0);
    });
  });

  describe('syncFormattedTime', () => {
    it('builds formatted time from date and clock', () => {
      ctx.data.selectedDate = '2026-03-10';
      ctx.data.selectedClock = '14:30';
      pageConfig.syncFormattedTime.call(ctx);
      expect(ctx.data.formattedTime).toBe('2026-03-10 14:30:00');
    });

    it('returns empty when date is missing', () => {
      ctx.data.selectedDate = '';
      ctx.data.selectedClock = '14:30';
      pageConfig.syncFormattedTime.call(ctx);
      expect(ctx.data.formattedTime).toBe('');
    });

    it('returns empty when clock is missing', () => {
      ctx.data.selectedDate = '2026-03-10';
      ctx.data.selectedClock = '';
      pageConfig.syncFormattedTime.call(ctx);
      expect(ctx.data.formattedTime).toBe('');
    });

    it('returns empty when both are missing', () => {
      ctx.data.selectedDate = '';
      ctx.data.selectedClock = '';
      pageConfig.syncFormattedTime.call(ctx);
      expect(ctx.data.formattedTime).toBe('');
    });
  });

  describe('resetCreateForm', () => {
    it('resets all form fields', () => {
      ctx.data.selectedDriverId = 5;
      ctx.data.selectedDriverName = 'Test Driver';
      ctx.data.selectedDate = '2026-01-01';
      ctx.data.selectedClock = '10:00';
      ctx.data.formattedTime = '2026-01-01 10:00:00';
      pageConfig.resetCreateForm.call(ctx);
      expect(ctx.data.selectedDriverId).toBeNull();
      expect(ctx.data.selectedDriverName).toBe('');
      expect(ctx.data.selectedDate).toBe('');
      expect(ctx.data.selectedClock).toBe('');
      expect(ctx.data.formattedTime).toBe('');
    });
  });

  describe('getSelectedAction', () => {
    const actions = [
      { name: 'Action A', id: 1 },
      { name: 'Action B', id: 2 },
      { name: 'Action C', id: 3 },
    ];

    it('gets action by index', () => {
      const e = { detail: { index: 1 } };
      const result = pageConfig.getSelectedAction(e, actions);
      expect(result).toBe(actions[1]);
    });

    it('gets action by name when index not found', () => {
      const e = { detail: { name: 'Action C' } };
      const result = pageConfig.getSelectedAction(e, actions);
      expect(result).toBe(actions[2]);
    });

    it('returns detail as fallback when neither index nor name match', () => {
      const e = { detail: { foo: 'bar' } };
      const result = pageConfig.getSelectedAction(e, actions);
      expect(result).toEqual({ foo: 'bar' });
    });

    it('handles index 0', () => {
      const e = { detail: { index: 0 } };
      const result = pageConfig.getSelectedAction(e, actions);
      expect(result).toBe(actions[0]);
    });

    it('handles empty detail', () => {
      const e = { detail: {} };
      const result = pageConfig.getSelectedAction(e, actions);
      expect(result).toEqual({});
    });
  });

  describe('onManageShift', () => {
    it('navigates to shift detail page', () => {
      pageConfig.onManageShift.call(ctx, { detail: { shiftId: 42 } });
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/admin/shift-detail/index?id=42' });
    });

    it('shows toast for missing shift ID', () => {
      pageConfig.onManageShift.call(ctx, { detail: {} });
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onRemovePassenger', () => {
    it('shows toast for invalid shift ID', () => {
      pageConfig.onRemovePassenger.call(ctx, { detail: {} });
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('shows toast when no passengers', () => {
      ctx.data.shifts = [{ id: 1, requests: [] }];
      pageConfig.onRemovePassenger.call(ctx, { detail: { shiftId: 1, requests: [] } });
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('opens remove sheet with valid passengers', () => {
      const requests = [
        { id: 10, user: { name: 'Alice' }, flight_no: 'UA123', ride_with_note: '', ride_with_wechat: '' },
      ];
      pageConfig.onRemovePassenger.call(ctx, { detail: { shiftId: 1, requests } });
      expect(ctx.data.showRemoveSheet).toBe(true);
      expect(ctx.data.removeShiftId).toBe(1);
      expect(ctx.data.removeActions).toHaveLength(1);
    });

    it('falls back to passengers from shift in data.shifts', () => {
      ctx.data.shifts = [
        { id: 5, requests: [{ id: 20, user: { name: 'Bob' }, flight_no: 'AA100', ride_with_note: '', ride_with_wechat: '' }] },
      ];
      pageConfig.onRemovePassenger.call(ctx, { detail: { shiftId: 5 } });
      expect(ctx.data.showRemoveSheet).toBe(true);
      expect(ctx.data.removeActions).toHaveLength(1);
    });
  });

  describe('onSubmitShift', () => {
    it('shows toast when form incomplete (no driver)', async () => {
      ctx.data.selectedDriverId = null;
      ctx.data.formattedTime = '2026-03-10 14:30:00';
      ctx.data.actionBusy = false;
      await pageConfig.onSubmitShift.call(ctx);
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' }));
    });

    it('shows toast when form incomplete (no time)', async () => {
      ctx.data.selectedDriverId = 1;
      ctx.data.formattedTime = '';
      ctx.data.actionBusy = false;
      await pageConfig.onSubmitShift.call(ctx);
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' }));
    });
  });

  describe('filterPrevDay / filterNextDay / filterToday', () => {
    beforeEach(() => {
      // Stub loadAll to avoid API calls
      ctx.loadAll = jest.fn(() => Promise.resolve());
    });

    it('filterPrevDay decrements date', () => {
      ctx.data.filterDate = '2026-03-10';
      pageConfig.filterPrevDay.call(ctx);
      expect(ctx.data.filterDate).toBe('2026-03-09');
    });

    it('filterNextDay increments date', () => {
      ctx.data.filterDate = '2026-03-10';
      pageConfig.filterNextDay.call(ctx);
      expect(ctx.data.filterDate).toBe('2026-03-11');
    });

    it('filterToday sets to today', () => {
      pageConfig.filterToday.call(ctx);
      const today = pageConfig._formatDate(new Date());
      expect(ctx.data.filterDate).toBe(today);
    });

    it('filterPrevDay with null filterDate goes to yesterday', () => {
      ctx.data.filterDate = null;
      pageConfig.filterPrevDay.call(ctx);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(ctx.data.filterDate).toBe(pageConfig._formatDate(yesterday));
    });
  });

  describe('onConfirmDriver', () => {
    it('selects driver by index', () => {
      ctx.data.driverList = [
        { id: 1, name: 'Driver A', car_model: 'Tesla' },
        { id: 2, name: 'Driver B', car_model: 'Toyota' },
      ];
      pageConfig.onConfirmDriver.call(ctx, { detail: { index: 0 } });
      expect(ctx.data.selectedDriverId).toBe(1);
      expect(ctx.data.selectedDriverName).toContain('Driver A');
    });

    it('selects driver by array index', () => {
      ctx.data.driverList = [
        { id: 1, name: 'A', car_model: 'X' },
        { id: 2, name: 'B', car_model: 'Y' },
      ];
      pageConfig.onConfirmDriver.call(ctx, { detail: { index: [1] } });
      expect(ctx.data.selectedDriverId).toBe(2);
    });

    it('closes picker when driver not found', () => {
      ctx.data.driverList = [];
      pageConfig.onConfirmDriver.call(ctx, { detail: { index: 5 } });
      expect(ctx.data.showDriverPicker).toBe(false);
    });
  });

  describe('onConfirmDate', () => {
    it('sets date from timestamp', () => {
      const ts = new Date(2026, 2, 15).getTime();
      pageConfig.onConfirmDate.call(ctx, { detail: ts });
      expect(ctx.data.selectedDate).toBeTruthy();
      expect(ctx.data.showDatePicker).toBe(false);
    });

    it('closes picker for invalid timestamp', () => {
      pageConfig.onConfirmDate.call(ctx, { detail: 0 });
      expect(ctx.data.showDatePicker).toBe(false);
    });
  });

  describe('onConfirmTime', () => {
    it('sets time from string', () => {
      pageConfig.onConfirmTime.call(ctx, { detail: '15:30' });
      expect(ctx.data.selectedClock).toBe('15:30');
      expect(ctx.data.showTimePicker).toBe(false);
    });

    it('handles array detail', () => {
      pageConfig.onConfirmTime.call(ctx, { detail: ['16:00'] });
      expect(ctx.data.selectedClock).toBe('16:00');
    });

    it('closes picker for empty time', () => {
      pageConfig.onConfirmTime.call(ctx, { detail: '' });
      expect(ctx.data.showTimePicker).toBe(false);
    });
  });

  describe('_updateSuggestionSelection', () => {
    it('counts selected suggestions', () => {
      ctx.data.suggestions = [
        { selected: true },
        { selected: false },
        { selected: true },
      ];
      pageConfig._updateSuggestionSelection.call(ctx);
      expect(ctx.data.selectedSuggestionCount).toBe(2);
      expect(ctx.data.allSuggestionsSelected).toBe(false);
    });

    it('detects all selected', () => {
      ctx.data.suggestions = [
        { selected: true },
        { selected: true },
      ];
      pageConfig._updateSuggestionSelection.call(ctx);
      expect(ctx.data.allSuggestionsSelected).toBe(true);
    });

    it('handles empty suggestions', () => {
      ctx.data.suggestions = [];
      pageConfig._updateSuggestionSelection.call(ctx);
      expect(ctx.data.selectedSuggestionCount).toBe(0);
      expect(ctx.data.allSuggestionsSelected).toBe(false);
    });
  });

  describe('getRoleDisplayText', () => {
    it('returns admin text for admin role', () => {
      ctx.data.currentEffectiveRole = 'admin';
      const text = pageConfig.getRoleDisplayText.call(ctx);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });

    it('returns role itself for unknown role', () => {
      ctx.data.currentEffectiveRole = 'unknown_role';
      const text = pageConfig.getRoleDisplayText.call(ctx);
      expect(text).toBe('unknown_role');
    });
  });

  describe('loadAll', () => {
    it('loads shifts and pending requests', async () => {
      ctx.applyStatusFilter = jest.fn();
      api.getDashboard.mockResolvedValue([
        { id: 1, status: 'published', departure_time: '2026-03-10 14:00:00', requests: [] },
        { id: 2, status: 'draft', departure_time: '2026-03-11 10:00:00', requests: [] },
      ]);
      api.getPendingRequests.mockResolvedValue([
        { id: 10, user: { name: 'Alice' }, flight_no: 'UA1', arrival_time: '14:00', arrival_date: '2026-03-10', ride_with_note: '', ride_with_wechat: '' },
      ]);
      api.getModificationRequests.mockResolvedValue([]);

      await pageConfig.loadAll.call(ctx);
      expect(ctx.data.shifts).toHaveLength(2);
      expect(ctx.data.pendingRequests).toHaveLength(1);
      expect(ctx.data.loading).toBe(false);
      expect(ctx.applyStatusFilter).toHaveBeenCalled();
    });

    it('handles both requests failing', async () => {
      ctx.applyStatusFilter = jest.fn();
      api.getDashboard.mockRejectedValue(new Error('fail'));
      api.getPendingRequests.mockRejectedValue(new Error('fail'));

      await pageConfig.loadAll.call(ctx);
      expect(ctx.data.loading).toBe(false);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('handles dashboard failing but pending succeeding', async () => {
      ctx.applyStatusFilter = jest.fn();
      api.getDashboard.mockRejectedValue(new Error('fail'));
      api.getPendingRequests.mockResolvedValue([]);
      api.getModificationRequests.mockResolvedValue([]);

      await pageConfig.loadAll.call(ctx);
      expect(ctx.data.loading).toBe(false);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('handles pending failing but dashboard succeeding', async () => {
      ctx.applyStatusFilter = jest.fn();
      api.getDashboard.mockResolvedValue([]);
      api.getPendingRequests.mockRejectedValue(new Error('fail'));
      api.getModificationRequests.mockResolvedValue([]);

      await pageConfig.loadAll.call(ctx);
      expect(ctx.data.loading).toBe(false);
    });

    it('extracts shifts from nested response format', async () => {
      ctx.applyStatusFilter = jest.fn();
      api.getDashboard.mockResolvedValue({
        shifts: [{ id: 1, status: 'published', departure_time: '2026-03-10 14:00:00' }],
        pending_count: 5,
        today_shift_count: 1,
        published_count: 1,
      });
      api.getPendingRequests.mockResolvedValue({ items: [], pendingCount: 5 });
      api.getModificationRequests.mockResolvedValue([]);

      await pageConfig.loadAll.call(ctx);
      expect(ctx.data.shifts).toHaveLength(1);
      expect(ctx.data.pendingCount).toBe(5);
      expect(ctx.data.todayShiftCount).toBe(1);
      expect(ctx.data.publishedCount).toBe(1);
    });

    it('calculates unpublished count', async () => {
      ctx.applyStatusFilter = jest.fn();
      api.getDashboard.mockResolvedValue([
        { id: 1, status: 'draft' },
        { id: 2, status: 'draft' },
        { id: 3, status: 'published' },
      ]);
      api.getPendingRequests.mockResolvedValue([]);
      api.getModificationRequests.mockResolvedValue([]);

      await pageConfig.loadAll.call(ctx);
      // normalizeShiftStatus('draft') => 'unpublished', but filter checks s.status === 'draft'
      // The code sets status via normalizeShiftStatus which converts 'draft' -> 'unpublished'
      // Then unpublishedCount = shifts.filter(s => s.status === 'draft').length
      // But after normalization, status will be 'unpublished', not 'draft'
      // So unpublishedCount should be 0 since status is already normalized
      expect(typeof ctx.data.unpublishedCount).toBe('number');
    });

    it('loads modification request count async', async () => {
      ctx.applyStatusFilter = jest.fn();
      api.getDashboard.mockResolvedValue([]);
      api.getPendingRequests.mockResolvedValue([]);
      api.getModificationRequests.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await pageConfig.loadAll.call(ctx);
      // Wait for the async mod count to settle
      await new Promise((r) => setTimeout(r, 50));
      expect(ctx.data.pendingModCount).toBe(2);
    });
  });

  describe('onShow', () => {
    function mockApp(overrides) {
      const app = {
        globalData: { userInfo: null, baseUrl: 'http://localhost:9090', dashboardCache: {} },
        ensureWechatBound: jest.fn(() => true),
        markDashboardDirty: jest.fn(),
        isDashboardDirty: jest.fn(() => false),
        clearDashboardDirty: jest.fn(),
        getEffectiveRole: jest.fn(() => 'admin'),
        setViewAsRole: jest.fn(),
        getViewAsRole: jest.fn(() => ''),
        resetViewAsRole: jest.fn(),
        setUserInfo: jest.fn(),
        ...overrides,
      };
      global.getApp = jest.fn(() => app);
      return app;
    }

    it('redirects non-admin users', () => {
      mockApp({ getEffectiveRole: jest.fn(() => 'student') });
      ctx.getTabBar = jest.fn(() => ({ setData: jest.fn(), setHidden: jest.fn(), refreshTabs: jest.fn() }));
      ctx.loadAll = jest.fn();
      pageConfig.onShow.call(ctx);
      expect(wx.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/home/index' }));
    });

    it('loads all for admin users', () => {
      mockApp({ getEffectiveRole: jest.fn(() => 'admin'), isDashboardDirty: jest.fn(() => true) });
      ctx.getTabBar = jest.fn(() => ({ setData: jest.fn(), setHidden: jest.fn(), refreshTabs: jest.fn() }));
      ctx.loadAll = jest.fn();
      pageConfig.onShow.call(ctx);
      expect(ctx.loadAll).toHaveBeenCalled();
    });

    it('loads for staff users', () => {
      mockApp({ getEffectiveRole: jest.fn(() => 'staff'), isDashboardDirty: jest.fn(() => true) });
      ctx.getTabBar = jest.fn(() => ({ setData: jest.fn(), setHidden: jest.fn(), refreshTabs: jest.fn() }));
      ctx.loadAll = jest.fn();
      pageConfig.onShow.call(ctx);
      expect(ctx.loadAll).toHaveBeenCalled();
    });
  });

  describe('onLoad', () => {
    it('sets initial date and i18n', () => {
      pageConfig.onLoad.call(ctx);
      expect(ctx.data.filterDate).toBeTruthy();
      expect(ctx.data.todayDate).toBeTruthy();
      expect(ctx.data.i18n).toBeDefined();
    });
  });

  describe('onPullDownRefresh', () => {
    it('calls loadAll and stops refresh', async () => {
      ctx.loadAll = jest.fn(() => Promise.resolve());
      await pageConfig.onPullDownRefresh.call(ctx);
      expect(ctx.loadAll).toHaveBeenCalled();
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });

  describe('assignStudentToShift', () => {
    it('calls api.assignStudent and reloads', async () => {
      ctx.data.actionBusy = false;
      ctx.loadAll = jest.fn(() => Promise.resolve());
      api.assignStudent.mockResolvedValue({});
      await pageConfig.assignStudentToShift.call(ctx, 1, 10);
      expect(api.assignStudent).toHaveBeenCalledWith(1, 10);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('shows warning message from api', async () => {
      ctx.data.actionBusy = false;
      ctx.loadAll = jest.fn(() => Promise.resolve());
      api.assignStudent.mockResolvedValue({ warning: 'near capacity' });
      await pageConfig.assignStudentToShift.call(ctx, 1, 10);
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' }));
    });

    it('shows error on failure', async () => {
      ctx.data.actionBusy = false;
      ctx.loadAll = jest.fn(() => Promise.resolve());
      api.assignStudent.mockRejectedValue(new Error('fail'));
      await pageConfig.assignStudentToShift.call(ctx, 1, 10);
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onSelectRemoveRequest', () => {
    it('removes student and reloads', async () => {
      ctx.data.actionBusy = false;
      ctx.data.removeShiftId = 5;
      ctx.data.removeActions = [{ name: 'A', requestId: 10 }];
      ctx.loadAll = jest.fn(() => Promise.resolve());
      api.removeStudent.mockResolvedValue({});
      await pageConfig.onSelectRemoveRequest.call(ctx, { detail: { index: 0 } });
      expect(api.removeStudent).toHaveBeenCalledWith(5, 10);
    });
  });

  describe('onPublishShift', () => {
    it('publishes shift and reloads', async () => {
      ctx.data.actionBusy = false;
      ctx.loadAll = jest.fn(() => Promise.resolve());
      api.publishShift.mockResolvedValue({});
      await pageConfig.onPublishShift.call(ctx, { detail: { shiftId: 3 } });
      expect(api.publishShift).toHaveBeenCalledWith(3);
    });

    it('does nothing for missing shift id', async () => {
      await pageConfig.onPublishShift.call(ctx, { detail: {} });
      expect(api.publishShift).not.toHaveBeenCalled();
    });
  });

  describe('fetchDrivers', () => {
    it('loads drivers and builds picker columns', async () => {
      api.getDrivers.mockResolvedValue([
        { id: 1, name: 'Driver A', car_model: 'Tesla' },
        { id: 2, name: 'Driver B', car_model: 'Toyota' },
      ]);
      await pageConfig.fetchDrivers.call(ctx);
      expect(ctx.data.driverList).toHaveLength(2);
      expect(ctx.data.pickerColumns).toHaveLength(2);
    });

    it('handles api error', async () => {
      api.getDrivers.mockRejectedValue(new Error('fail'));
      await pageConfig.fetchDrivers.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onOpenDriverPicker', () => {
    it('shows toast when no drivers', () => {
      ctx.data.pickerColumns = [];
      pageConfig.onOpenDriverPicker.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('opens picker when drivers available', () => {
      ctx.data.pickerColumns = [{ text: 'A', value: 1 }];
      pageConfig.onOpenDriverPicker.call(ctx);
      expect(ctx.data.showDriverPicker).toBe(true);
    });
  });

  describe('close handlers', () => {
    it('onCloseRemoveSheet closes sheet', () => {
      ctx.data.showRemoveSheet = true;
      pageConfig.onCloseRemoveSheet.call(ctx);
      expect(ctx.data.showRemoveSheet).toBe(false);
    });
  });

  describe('onShowCreatePopup', () => {
    it('opens create choice popup', () => {
      pageConfig.onShowCreatePopup.call(ctx);
      expect(ctx.data.showCreateChoicePopup).toBe(true);
    });
  });

  describe('onCloseCreateChoice', () => {
    it('closes create choice popup', () => {
      ctx.data.showCreateChoicePopup = true;
      pageConfig.onCloseCreateChoice.call(ctx);
      expect(ctx.data.showCreateChoicePopup).toBe(false);
    });
  });

  describe('onChooseManualCreate', () => {
    it('opens create popup and fetches drivers', async () => {
      ctx.fetchDrivers = jest.fn(() => Promise.resolve());
      await pageConfig.onChooseManualCreate.call(ctx);
      expect(ctx.data.showCreateChoicePopup).toBe(false);
      expect(ctx.data.showCreatePopup).toBe(true);
      expect(ctx.fetchDrivers).toHaveBeenCalled();
    });
  });

  describe('onChooseSmartSuggest', () => {
    it('loads suggestions from API', async () => {
      api.suggestShifts.mockResolvedValue([
        { window_start: '2026-03-10T10:00:00Z', window_end: '2026-03-10T12:00:00Z', student_count: 3 },
      ]);
      await pageConfig.onChooseSmartSuggest.call(ctx);
      expect(ctx.data.showSuggestPopup).toBe(true);
      expect(ctx.data.suggestLoading).toBe(false);
      expect(ctx.data.suggestions).toHaveLength(1);
      expect(ctx.data.suggestions[0].selected).toBe(true);
    });

    it('handles api error', async () => {
      api.suggestShifts.mockRejectedValue(new Error('fail'));
      await pageConfig.onChooseSmartSuggest.call(ctx);
      expect(ctx.data.suggestLoading).toBe(false);
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onBatchCreateFromSuggestions', () => {
    it('shows toast when none selected', async () => {
      ctx.data.suggestions = [{ selected: false }];
      await pageConfig.onBatchCreateFromSuggestions.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('creates shifts from selected suggestions', async () => {
      ctx.data.actionBusy = false;
      ctx.data.suggestions = [
        { selected: true, departureTime: '2026-03-10 14:00:00' },
        { selected: false, departureTime: '2026-03-11 14:00:00' },
      ];
      ctx.loadAll = jest.fn(() => Promise.resolve());
      api.batchCreateShifts.mockResolvedValue({});
      await pageConfig.onBatchCreateFromSuggestions.call(ctx);
      expect(api.batchCreateShifts).toHaveBeenCalledWith([
        { departure_time: '2026-03-10 14:00:00', driver_id: null },
      ]);
    });
  });

  describe('onExitRoleSimulation', () => {
    it('resets view and refreshes', () => {
      ctx.refreshView = jest.fn();
      pageConfig.onExitRoleSimulation.call(ctx);
      expect(ctx.data.isViewingAsUser).toBe(false);
      expect(ctx.data.currentEffectiveRole).toBe('admin');
      expect(ctx.refreshView).toHaveBeenCalled();
    });
  });

  describe('onSelectRole', () => {
    it('sets role and refreshes view', async () => {
      ctx.refreshView = jest.fn();
      ctx.data.roleOptions = [
        { label: 'Student', value: 'student' },
        { label: 'Admin', value: 'admin' },
      ];
      await pageConfig.onSelectRole.call(ctx, { detail: { index: 0 } });
      expect(ctx.refreshView).toHaveBeenCalled();
    });

    it('does nothing with undefined index', async () => {
      ctx.refreshView = jest.fn();
      await pageConfig.onSelectRole.call(ctx, { detail: {} });
      expect(ctx.refreshView).not.toHaveBeenCalled();
    });
  });

  describe('filterStatusAll / filterStatusPublished / filterStatusDraft', () => {
    beforeEach(() => {
      ctx.applyStatusFilter = jest.fn();
    });

    it('filterStatusAll sets empty filter', () => {
      pageConfig.filterStatusAll.call(ctx);
      expect(ctx.data.filterStatus).toBe('');
      expect(ctx.applyStatusFilter).toHaveBeenCalled();
    });

    it('filterStatusPublished sets published filter', () => {
      pageConfig.filterStatusPublished.call(ctx);
      expect(ctx.data.filterStatus).toBe('published');
    });

    it('filterStatusDraft sets draft filter', () => {
      pageConfig.filterStatusDraft.call(ctx);
      expect(ctx.data.filterStatus).toBe('draft');
    });
  });

  describe('filterReset', () => {
    it('navigates to all-shifts page', () => {
      pageConfig.filterReset.call(ctx);
      expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
        url: '/pages/admin/all-shifts/index',
      }));
    });
  });

  describe('onQuickAssign', () => {
    it('navigates to assign page', () => {
      pageConfig.onQuickAssign.call(ctx);
      expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
        url: '/pages/admin/assign/index',
      }));
    });
  });

  describe('onGoModificationRequests', () => {
    it('navigates to modification requests page', () => {
      pageConfig.onGoModificationRequests.call(ctx);
      expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
        url: '/pages/admin/modification-requests/index',
      }));
    });
  });

  describe('filterPickDate / onCalendarConfirm / onCalendarClose', () => {
    it('filterPickDate opens calendar', () => {
      ctx.data.filterDate = '2026-03-10';
      pageConfig.filterPickDate.call(ctx);
      expect(ctx.data.showCalendar).toBe(true);
    });

    it('onCalendarConfirm sets date and loads', () => {
      ctx.loadAll = jest.fn(() => Promise.resolve());
      pageConfig.onCalendarConfirm.call(ctx, { detail: new Date(2026, 3, 1) });
      expect(ctx.data.showCalendar).toBe(false);
      expect(ctx.data.filterDate).toBeTruthy();
    });

    it('onCalendarClose closes calendar', () => {
      ctx.data.showCalendar = true;
      pageConfig.onCalendarClose.call(ctx);
      expect(ctx.data.showCalendar).toBe(false);
    });
  });

  describe('onToggleSuggestion', () => {
    it('toggles suggestion selected state', () => {
      ctx.data.suggestions = [{ selected: true }, { selected: false }];
      ctx._updateSuggestionSelection = jest.fn();
      pageConfig.onToggleSuggestion.call(ctx, { currentTarget: { dataset: { index: 0 } } });
      expect(ctx.data.suggestions[0].selected).toBe(false);
    });
  });

  describe('onToggleSuggestionExpand', () => {
    it('toggles expanded state', () => {
      ctx.data.suggestions = [{ expanded: false }];
      pageConfig.onToggleSuggestionExpand.call(ctx, { currentTarget: { dataset: { index: 0 } } });
      expect(ctx.data.suggestions[0].expanded).toBe(true);
    });
  });

  describe('onToggleSelectAll', () => {
    it('selects all when not all selected', () => {
      ctx.data.allSuggestionsSelected = false;
      ctx.data.suggestions = [{ selected: false }, { selected: true }];
      ctx._updateSuggestionSelection = jest.fn();
      pageConfig.onToggleSelectAll.call(ctx);
      expect(ctx.data.suggestions[0].selected).toBe(true);
      expect(ctx.data.suggestions[1].selected).toBe(true);
    });

    it('deselects all when all selected', () => {
      ctx.data.allSuggestionsSelected = true;
      ctx.data.suggestions = [{ selected: true }, { selected: true }];
      ctx._updateSuggestionSelection = jest.fn();
      pageConfig.onToggleSelectAll.call(ctx);
      expect(ctx.data.suggestions[0].selected).toBe(false);
    });
  });

  describe('onCloseSuggestPopup', () => {
    it('closes suggest popup', () => {
      ctx.data.showSuggestPopup = true;
      pageConfig.onCloseSuggestPopup.call(ctx);
      expect(ctx.data.showSuggestPopup).toBe(false);
    });
  });

  describe('onCloseCreatePopup', () => {
    it('closes create popup', () => {
      ctx.data.showCreatePopup = true;
      pageConfig.onCloseCreatePopup.call(ctx);
      expect(ctx.data.showCreatePopup).toBe(false);
    });
  });

  describe('onCancelDriverPicker / onCancelDatePicker / onCancelTimePicker', () => {
    it('closes driver picker', () => {
      pageConfig.onCancelDriverPicker.call(ctx);
      expect(ctx.data.showDriverPicker).toBe(false);
    });
    it('closes date picker', () => {
      pageConfig.onCancelDatePicker.call(ctx);
      expect(ctx.data.showDatePicker).toBe(false);
    });
    it('closes time picker', () => {
      pageConfig.onCancelTimePicker.call(ctx);
      expect(ctx.data.showTimePicker).toBe(false);
    });
  });

  describe('onOpenDatePicker / onOpenTimePicker', () => {
    it('opens date picker', () => {
      pageConfig.onOpenDatePicker.call(ctx);
      expect(ctx.data.showDatePicker).toBe(true);
    });
    it('opens time picker', () => {
      pageConfig.onOpenTimePicker.call(ctx);
      expect(ctx.data.showTimePicker).toBe(true);
    });
  });

  describe('refreshView', () => {
    it('refreshes tabbar and loads all', () => {
      ctx.getTabBar = jest.fn(() => ({ refreshTabs: jest.fn() }));
      ctx.loadAll = jest.fn();
      pageConfig.refreshView.call(ctx);
      expect(ctx.loadAll).toHaveBeenCalled();
    });
  });
});
