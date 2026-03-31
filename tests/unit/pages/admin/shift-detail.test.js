/**
 * Tests for pages/admin/shift-detail/index.js
 * Tests pure helper functions defined at module scope and page methods.
 */

jest.mock('../../../../utils/api', () => ({
  getDashboard: jest.fn(),
  getPendingRequests: jest.fn(() => Promise.resolve([])),
  assignStudent: jest.fn(),
  removeStudent: jest.fn(),
  publishShift: jest.fn(),
  unpublishShift: jest.fn(),
  updateShift: jest.fn(),
  updateShiftVehicles: jest.fn(),
  getShift: jest.fn(() => Promise.resolve({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] })),
}));

describe('pages/admin/shift-detail', () => {
  let pageConfig;
  let ctx;

  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn();
    Object.keys(wx).forEach((k) => {
      if (typeof wx[k] === 'function' && wx[k].mockClear) wx[k].mockClear();
    });

    require('../../../../pages/admin/shift-detail/index');
    pageConfig = global.Page.mock.calls[0][0];

    ctx = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(updates) {
        Object.assign(this.data, updates);
      },
      _dayFilterInitialized: false,
    };
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.shiftId).toBe('');
      expect(pageConfig.data.shift).toBeNull();
      expect(pageConfig.data.activeTab).toBe(0);
      expect(pageConfig.data.terminalFilter).toBe('all');
      expect(pageConfig.data.dayFilter).toBe('all');
      expect(pageConfig.data.publishing).toBe(false);
      expect(pageConfig.data.actionBusy).toBe(false);
      expect(pageConfig.data.showVehicleEditor).toBe(false);
      expect(pageConfig.data.infoCardCollapsed).toBe(false);
      expect(pageConfig.data.sortOrder).toBe('arrival');
    });

    it('has i18n populated', () => {
      expect(pageConfig.data.i18n).toBeDefined();
      expect(typeof pageConfig.data.i18n.shift_detail_driver_prefix).toBe('string');
    });

    it('has sort options defined', () => {
      expect(pageConfig.data.sortOptions).toHaveLength(3);
      expect(pageConfig.data.sortOptions[0].value).toBe('arrival');
      expect(pageConfig.data.sortOptions[1].value).toBe('name');
      expect(pageConfig.data.sortOptions[2].value).toBe('flight');
    });
  });

  describe('onTabChange', () => {
    it('sets active tab from event', () => {
      pageConfig.onTabChange.call(ctx, { detail: { index: 1 } });
      expect(ctx.data.activeTab).toBe(1);
    });

    it('defaults to 0 when no index', () => {
      pageConfig.onTabChange.call(ctx, { detail: {} });
      expect(ctx.data.activeTab).toBe(0);
    });

    it('defaults to 0 when no detail', () => {
      pageConfig.onTabChange.call(ctx, {});
      expect(ctx.data.activeTab).toBe(0);
    });
  });

  describe('onToggleInfoCard', () => {
    it('toggles collapsed state', () => {
      ctx.data.infoCardCollapsed = false;
      pageConfig.onToggleInfoCard.call(ctx);
      expect(ctx.data.infoCardCollapsed).toBe(true);
      pageConfig.onToggleInfoCard.call(ctx);
      expect(ctx.data.infoCardCollapsed).toBe(false);
    });
  });

  describe('onToggleVehicleEditor', () => {
    it('toggles vehicle editor visibility', () => {
      ctx.data.showVehicleEditor = false;
      pageConfig.onToggleVehicleEditor.call(ctx);
      expect(ctx.data.showVehicleEditor).toBe(true);
    });
  });

  describe('onVehicleInput', () => {
    it('sets vehicle input value', () => {
      pageConfig.onVehicleInput.call(ctx, { detail: '3' });
      expect(ctx.data.vehicleInputValue).toBe('3');
    });

    it('sets empty for falsy detail', () => {
      pageConfig.onVehicleInput.call(ctx, { detail: '' });
      expect(ctx.data.vehicleInputValue).toBe('');
    });
  });

  describe('syncHeaderAndUsage', () => {
    it('computes usage stats correctly', () => {
      ctx.data.shift = {
        departure_time: '2026-03-10 14:00:00',
        status: 'draft',
        driver: { name: 'John', car_model: 'Tesla', max_seats: 4, max_checked: 6, max_carry_on: 4 },
        manual_vehicle_count: null,
        suggested_vehicles: 2,
      };
      ctx.data.onboardList = [
        { id: 1, checked_luggage_count: 2, carryon_luggage_count: 1 },
        { id: 2, checked_luggage_count: 1, carryon_luggage_count: 1 },
      ];
      pageConfig.syncHeaderAndUsage.call(ctx);
      expect(ctx.data.seatUsage.used).toBe(2);
      expect(ctx.data.seatUsage.max).toBe(4);
      expect(ctx.data.checkedUsage.used).toBe(3);
      expect(ctx.data.carryOnUsage.used).toBe(2);
      expect(ctx.data.statusText).toContain('未发布');
      expect(ctx.data.driverText).toContain('John');
      expect(ctx.data.vehicleText).toContain('2');
    });

    it('shows manual vehicle count when set', () => {
      ctx.data.shift = {
        departure_time: '2026-03-10 14:00:00',
        status: 'published',
        driver: { name: 'X' },
        manual_vehicle_count: 3,
        suggested_vehicles: 2,
      };
      ctx.data.onboardList = [];
      pageConfig.syncHeaderAndUsage.call(ctx);
      expect(ctx.data.vehicleText).toContain('3');
    });

    it('handles shift without driver', () => {
      ctx.data.shift = {
        departure_time: '2026-03-10 14:00:00',
        status: 'draft',
        driver: null,
        manual_vehicle_count: null,
        suggested_vehicles: 0,
      };
      ctx.data.onboardList = [];
      pageConfig.syncHeaderAndUsage.call(ctx);
      expect(ctx.data.driverText).toBe('--');
      expect(ctx.data.vehicleText).toBe('');
    });

    it('canPublish is false when unpublished with no passengers', () => {
      ctx.data.shift = { departure_time: '', status: 'draft', driver: null, manual_vehicle_count: null, suggested_vehicles: 0 };
      ctx.data.onboardList = [];
      pageConfig.syncHeaderAndUsage.call(ctx);
      expect(ctx.data.canPublish).toBe(false);
    });

    it('canPublish is true when published (even with no passengers)', () => {
      ctx.data.shift = { departure_time: '', status: 'published', driver: null, manual_vehicle_count: null, suggested_vehicles: 0 };
      ctx.data.onboardList = [];
      pageConfig.syncHeaderAndUsage.call(ctx);
      expect(ctx.data.canPublish).toBe(true);
    });
  });

  describe('recomputeFiltersAndList', () => {
    it('filters out onboard passengers from pending', () => {
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00', status: 'draft' };
      ctx.data.onboardList = [{ id: '1' }];
      ctx.data.pendingRaw = [
        { id: 1, user: { name: 'Alice' }, flight_no: 'UA1' },
        { id: 2, user: { name: 'Bob' }, flight_no: 'UA2' },
      ];
      ctx.data.terminalFilter = 'all';
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'arrival';
      pageConfig.recomputeFiltersAndList.call(ctx);
      expect(ctx.data.pendingView).toHaveLength(1);
      expect(ctx.data.pendingView[0].name).toBe('Bob');
    });

    it('builds terminal options from candidates', () => {
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00', status: 'draft' };
      ctx.data.onboardList = [];
      ctx.data.pendingRaw = [
        { id: 1, user: { name: 'A' }, terminal: 'T1', expected_arrival_time: '2026-03-10 12:00:00' },
        { id: 2, user: { name: 'B' }, terminal: 'T2', expected_arrival_time: '2026-03-10 13:00:00' },
      ];
      ctx.data.terminalFilter = 'all';
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'arrival';
      pageConfig.recomputeFiltersAndList.call(ctx);
      expect(ctx.data.terminalOptions.length).toBeGreaterThanOrEqual(3); // all + T1 + T2
    });

    it('handles empty pending list', () => {
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00' };
      ctx.data.onboardList = [];
      ctx.data.pendingRaw = [];
      ctx.data.terminalFilter = 'all';
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'arrival';
      pageConfig.recomputeFiltersAndList.call(ctx);
      expect(ctx.data.pendingView).toHaveLength(0);
      expect(ctx.data.pendingGroups).toHaveLength(0);
    });

    it('sorts by name when sortOrder is name', () => {
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00' };
      ctx.data.onboardList = [];
      ctx.data.pendingRaw = [
        { id: 1, user: { name: 'Charlie' }, expected_arrival_time: '2026-03-10 12:00:00' },
        { id: 2, user: { name: 'Alice' }, expected_arrival_time: '2026-03-10 12:00:00' },
      ];
      ctx.data.terminalFilter = 'all';
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'name';
      pageConfig.recomputeFiltersAndList.call(ctx);
      expect(ctx.data.pendingView[0].name).toBe('Alice');
      expect(ctx.data.pendingView[1].name).toBe('Charlie');
    });
  });

  describe('onSaveVehicleCount', () => {
    it('shows error for invalid vehicle count', async () => {
      ctx.data.vehicleInputValue = 'abc';
      ctx.data.actionBusy = false;
      await pageConfig.onSaveVehicleCount.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('shows error for vehicle count < 1', async () => {
      ctx.data.vehicleInputValue = '0';
      ctx.data.actionBusy = false;
      await pageConfig.onSaveVehicleCount.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onAddPassenger', () => {
    it('does nothing when no id', async () => {
      const api = require('../../../../utils/api');
      await pageConfig.onAddPassenger.call(ctx, { currentTarget: { dataset: {} } });
      expect(api.assignStudent).not.toHaveBeenCalled();
    });
  });

  describe('onRemovePassenger', () => {
    it('does nothing when no id', async () => {
      const api = require('../../../../utils/api');
      await pageConfig.onRemovePassenger.call(ctx, { currentTarget: { dataset: {} } });
      expect(api.removeStudent).not.toHaveBeenCalled();
    });
  });

  describe('onPublishShift', () => {
    it('does nothing when canPublish is false', async () => {
      ctx.data.canPublish = false;
      ctx.data.publishing = false;
      ctx.data.actionBusy = false;
      const api = require('../../../../utils/api');
      await pageConfig.onPublishShift.call(ctx);
      expect(api.publishShift).not.toHaveBeenCalled();
      expect(api.unpublishShift).not.toHaveBeenCalled();
    });

    it('does nothing when already publishing', async () => {
      ctx.data.canPublish = true;
      ctx.data.publishing = true;
      ctx.data.actionBusy = false;
      const api = require('../../../../utils/api');
      await pageConfig.onPublishShift.call(ctx);
      expect(api.publishShift).not.toHaveBeenCalled();
    });

    it('publishes when draft and canPublish', async () => {
      const api = require('../../../../utils/api');
      api.publishShift.mockResolvedValue({});
      api.getShift.mockResolvedValue({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] });
      api.getPendingRequests.mockResolvedValue([]);
      ctx.data.canPublish = true;
      ctx.data.publishing = false;
      ctx.data.actionBusy = false;
      ctx.data.shift = { status: 'draft' };
      ctx.data.shiftId = '1';
      await pageConfig.onPublishShift.call(ctx);
      expect(api.publishShift).toHaveBeenCalledWith('1');
      expect(ctx.data.publishing).toBe(false);
    });

    it('unpublishes when published', async () => {
      const api = require('../../../../utils/api');
      api.unpublishShift.mockResolvedValue({});
      api.getShift.mockResolvedValue({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] });
      api.getPendingRequests.mockResolvedValue([]);
      ctx.data.canPublish = true;
      ctx.data.publishing = false;
      ctx.data.actionBusy = false;
      ctx.data.shift = { status: 'published' };
      ctx.data.shiftId = '1';
      await pageConfig.onPublishShift.call(ctx);
      expect(api.unpublishShift).toHaveBeenCalledWith('1');
    });

    it('handles publish error', async () => {
      const api = require('../../../../utils/api');
      api.publishShift.mockRejectedValue(new Error('fail'));
      ctx.data.canPublish = true;
      ctx.data.publishing = false;
      ctx.data.actionBusy = false;
      ctx.data.shift = { status: 'draft' };
      ctx.data.shiftId = '1';
      await pageConfig.onPublishShift.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.publishing).toBe(false);
    });
  });

  describe('onAddPassenger (with data)', () => {
    it('adds passenger successfully', async () => {
      const api = require('../../../../utils/api');
      api.assignStudent.mockResolvedValue({});
      api.getShift.mockResolvedValue({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] });
      api.getPendingRequests.mockResolvedValue([]);
      ctx.data.shiftId = '1';
      ctx.data.actionBusy = false;
      await pageConfig.onAddPassenger.call(ctx, { currentTarget: { dataset: { id: 5 } } });
      expect(api.assignStudent).toHaveBeenCalledWith('1', 5);
      expect(ctx.data.actingRequestId).toBeNull();
    });

    it('handles add error', async () => {
      const api = require('../../../../utils/api');
      api.assignStudent.mockRejectedValue(new Error('full'));
      ctx.data.shiftId = '1';
      ctx.data.actionBusy = false;
      await pageConfig.onAddPassenger.call(ctx, { currentTarget: { dataset: { id: 5 } } });
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onRemovePassenger (with data)', () => {
    it('removes non-boarded passenger', async () => {
      const api = require('../../../../utils/api');
      api.removeStudent.mockResolvedValue({});
      api.getShift.mockResolvedValue({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] });
      api.getPendingRequests.mockResolvedValue([]);
      ctx.data.shiftId = '1';
      ctx.data.actionBusy = false;
      await pageConfig.onRemovePassenger.call(ctx, { currentTarget: { dataset: { id: 5 } } });
      expect(api.removeStudent).toHaveBeenCalledWith('1', 5);
    });

    it('confirms before removing boarded passenger', async () => {
      const api = require('../../../../utils/api');
      api.removeStudent.mockResolvedValue({});
      api.getShift.mockResolvedValue({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] });
      api.getPendingRequests.mockResolvedValue([]);
      wx.showModal.mockImplementation(({ success }) => success({ confirm: true }));
      ctx.data.shiftId = '1';
      ctx.data.actionBusy = false;
      await pageConfig.onRemovePassenger.call(ctx, { currentTarget: { dataset: { id: 5, boarded: true } } });
      expect(wx.showModal).toHaveBeenCalled();
      expect(api.removeStudent).toHaveBeenCalledWith('1', 5);
    });

    it('cancels removal of boarded passenger', async () => {
      const api = require('../../../../utils/api');
      wx.showModal.mockImplementation(({ success }) => success({ confirm: false }));
      ctx.data.shiftId = '1';
      ctx.data.actionBusy = false;
      await pageConfig.onRemovePassenger.call(ctx, { currentTarget: { dataset: { id: 5, boarded: true } } });
      expect(api.removeStudent).not.toHaveBeenCalled();
    });

    it('handles remove error', async () => {
      const api = require('../../../../utils/api');
      api.removeStudent.mockRejectedValue(new Error('fail'));
      ctx.data.shiftId = '1';
      ctx.data.actionBusy = false;
      await pageConfig.onRemovePassenger.call(ctx, { currentTarget: { dataset: { id: 5 } } });
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onSaveVehicleCount (valid)', () => {
    it('saves valid vehicle count', async () => {
      const api = require('../../../../utils/api');
      api.updateShiftVehicles.mockResolvedValue({});
      api.getShift.mockResolvedValue({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] });
      api.getPendingRequests.mockResolvedValue([]);
      ctx.data.vehicleInputValue = '3';
      ctx.data.shiftId = '1';
      ctx.data.actionBusy = false;
      await pageConfig.onSaveVehicleCount.call(ctx);
      expect(api.updateShiftVehicles).toHaveBeenCalledWith('1', 3);
      expect(ctx.data.showVehicleEditor).toBe(false);
    });

    it('clears vehicle count on empty', async () => {
      const api = require('../../../../utils/api');
      api.updateShiftVehicles.mockResolvedValue({});
      api.getShift.mockResolvedValue({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] });
      api.getPendingRequests.mockResolvedValue([]);
      ctx.data.vehicleInputValue = '';
      ctx.data.shiftId = '1';
      ctx.data.actionBusy = false;
      await pageConfig.onSaveVehicleCount.call(ctx);
      expect(api.updateShiftVehicles).toHaveBeenCalledWith('1', null);
    });

    it('handles save error', async () => {
      const api = require('../../../../utils/api');
      api.updateShiftVehicles.mockRejectedValue(new Error('fail'));
      ctx.data.vehicleInputValue = '3';
      ctx.data.shiftId = '1';
      ctx.data.actionBusy = false;
      await pageConfig.onSaveVehicleCount.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onClearVehicleCount', () => {
    it('clears vehicle count', async () => {
      const api = require('../../../../utils/api');
      api.updateShiftVehicles.mockResolvedValue({});
      api.getShift.mockResolvedValue({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] });
      api.getPendingRequests.mockResolvedValue([]);
      ctx.data.shiftId = '1';
      ctx.data.actionBusy = false;
      await pageConfig.onClearVehicleCount.call(ctx);
      expect(api.updateShiftVehicles).toHaveBeenCalledWith('1', null);
      expect(ctx.data.showVehicleEditor).toBe(false);
      expect(ctx.data.vehicleInputValue).toBe('');
    });

    it('handles clear error', async () => {
      const api = require('../../../../utils/api');
      api.updateShiftVehicles.mockRejectedValue(new Error('fail'));
      ctx.data.shiftId = '1';
      ctx.data.actionBusy = false;
      await pageConfig.onClearVehicleCount.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('loadData', () => {
    it('loads shift and pending data', async () => {
      const api = require('../../../../utils/api');
      api.getShift.mockResolvedValue({
        id: 1,
        status: 'draft',
        departure_time: '2026-03-10 14:00:00',
        requests: [{ id: 1, name: 'Alice', flight_no: 'UA1', checked_luggage_count: 1, carryon_luggage_count: 1, boarded_at: null }],
      });
      api.getPendingRequests.mockResolvedValue([
        { id: 2, name: 'Bob', flight_no: 'UA2' },
      ]);
      ctx.data.shiftId = '1';
      ctx._dayFilterInitialized = false;
      await pageConfig.loadData.call(ctx);
      expect(ctx.data.shift.id).toBe(1);
      expect(ctx.data.onboardList).toHaveLength(1);
      expect(ctx.data.onboardCount).toBe(1);
      expect(ctx.data.boardedCount).toBe(0);
      expect(ctx.data.unboardedCount).toBe(1);
    });

    it('handles shift not found', async () => {
      const api = require('../../../../utils/api');
      api.getShift.mockResolvedValue({});
      api.getPendingRequests.mockResolvedValue([]);
      ctx.data.shiftId = '999';
      await pageConfig.loadData.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('handles load error', async () => {
      const api = require('../../../../utils/api');
      api.getShift.mockRejectedValue(new Error('network'));
      ctx.data.shiftId = '1';
      await pageConfig.loadData.call(ctx);
      expect(wx.showToast).toHaveBeenCalled();
    });

    it('handles pending as {items: [...]}', async () => {
      const api = require('../../../../utils/api');
      api.getShift.mockResolvedValue({
        id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [],
      });
      api.getPendingRequests.mockResolvedValue({ items: [{ id: 2 }] });
      ctx.data.shiftId = '1';
      ctx._dayFilterInitialized = false;
      await pageConfig.loadData.call(ctx);
      expect(ctx.data.pendingRaw).toHaveLength(1);
    });

    it('counts boarded passengers', async () => {
      const api = require('../../../../utils/api');
      api.getShift.mockResolvedValue({
        id: 1, status: 'published', departure_time: '2026-03-10 14:00:00',
        requests: [
          { id: 1, boarded_at: '2026-03-10T13:00:00Z' },
          { id: 2, boarded_at: null },
          { id: 3, boarded_at: '2026-03-10T13:05:00Z' },
        ],
      });
      api.getPendingRequests.mockResolvedValue([]);
      ctx.data.shiftId = '1';
      ctx._dayFilterInitialized = false;
      await pageConfig.loadData.call(ctx);
      expect(ctx.data.boardedCount).toBe(2);
      expect(ctx.data.unboardedCount).toBe(1);
    });
  });

  describe('onTerminalChange', () => {
    it('sets filter and recomputes', () => {
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00' };
      ctx.data.onboardList = [];
      ctx.data.pendingRaw = [
        { id: 1, user: { name: 'A' }, terminal: 'T1', expected_arrival_time: '2026-03-10 12:00:00' },
      ];
      ctx.data.terminalFilter = 'all';
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'arrival';
      const origSetData = ctx.setData.bind(ctx);
      ctx.setData = function(updates, cb) {
        origSetData(updates);
        if (cb) cb();
      };
      pageConfig.onTerminalChange.call(ctx, { detail: 'T1' });
      expect(ctx.data.terminalFilter).toBe('T1');
    });
  });

  describe('onDayChange', () => {
    it('sets filter and recomputes', () => {
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00' };
      ctx.data.onboardList = [];
      ctx.data.pendingRaw = [
        { id: 1, user: { name: 'A' }, expected_arrival_time: '2026-03-10 12:00:00' },
      ];
      ctx.data.terminalFilter = 'all';
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'arrival';
      ctx._dayFilterInitialized = true;
      const origSetData = ctx.setData.bind(ctx);
      ctx.setData = function(updates, cb) {
        origSetData(updates);
        if (cb) cb();
      };
      pageConfig.onDayChange.call(ctx, { detail: '2026-03-10' });
      expect(ctx.data.dayFilter).toBe('2026-03-10');
    });
  });

  describe('onSortChange', () => {
    it('sets sort order and recomputes', () => {
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00' };
      ctx.data.onboardList = [];
      ctx.data.pendingRaw = [];
      ctx.data.terminalFilter = 'all';
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'arrival';
      const origSetData = ctx.setData.bind(ctx);
      ctx.setData = function(updates, cb) {
        origSetData(updates);
        if (cb) cb();
      };
      pageConfig.onSortChange.call(ctx, { detail: 'flight' });
      expect(ctx.data.sortOrder).toBe('flight');
    });
  });

  describe('recomputeFiltersAndList (terminal filtering)', () => {
    it('filters by terminal', () => {
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00' };
      ctx.data.onboardList = [];
      ctx.data.pendingRaw = [
        { id: 1, user: { name: 'A' }, terminal: 'T1', expected_arrival_time: '2026-03-10 12:00:00' },
        { id: 2, user: { name: 'B' }, terminal: 'T2', expected_arrival_time: '2026-03-10 13:00:00' },
      ];
      ctx.data.terminalFilter = 'T1';
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'arrival';
      pageConfig.recomputeFiltersAndList.call(ctx);
      expect(ctx.data.pendingView).toHaveLength(1);
      expect(ctx.data.pendingView[0].name).toBe('A');
    });

    it('auto-defaults dayFilter to shift departure date on first load', () => {
      ctx._dayFilterInitialized = false;
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00' };
      ctx.data.onboardList = [];
      ctx.data.pendingRaw = [
        { id: 1, user: { name: 'A' }, expected_arrival_time: '2026-03-10 12:00:00' },
        { id: 2, user: { name: 'B' }, expected_arrival_time: '2026-03-11 12:00:00' },
      ];
      ctx.data.terminalFilter = 'all';
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'arrival';
      pageConfig.recomputeFiltersAndList.call(ctx);
      expect(ctx.data.dayFilter).toBe('2026-03-10');
      expect(ctx.data.pendingView).toHaveLength(1);
    });

    it('sorts by flight number', () => {
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00' };
      ctx.data.onboardList = [];
      ctx.data.pendingRaw = [
        { id: 1, user: { name: 'A' }, flight_no: 'ZZ999', expected_arrival_time: '2026-03-10 12:00:00' },
        { id: 2, user: { name: 'B' }, flight_no: 'AA100', expected_arrival_time: '2026-03-10 12:00:00' },
      ];
      ctx.data.terminalFilter = 'all';
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'flight';
      pageConfig.recomputeFiltersAndList.call(ctx);
      expect(ctx.data.pendingView[0].flight_no).toBe('AA100');
    });

    it('groups onboard by 20-minute buckets', () => {
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00' };
      ctx.data.onboardList = [
        { id: 1, _pickupTs: new Date('2026-03-10T12:00:00Z').getTime() },
        { id: 2, _pickupTs: new Date('2026-03-10T12:05:00Z').getTime() },
        { id: 3, _pickupTs: new Date('2026-03-10T13:00:00Z').getTime() },
      ];
      ctx.data.pendingRaw = [];
      ctx.data.terminalFilter = 'all';
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'arrival';
      pageConfig.recomputeFiltersAndList.call(ctx);
      expect(ctx.data.onboardGroups.length).toBeGreaterThanOrEqual(2);
    });

    it('resets terminalFilter if option no longer exists', () => {
      ctx.data.shift = { departure_time: '2026-03-10 14:00:00' };
      ctx.data.onboardList = [];
      ctx.data.pendingRaw = [
        { id: 1, user: { name: 'A' }, terminal: 'T1', expected_arrival_time: '2026-03-10 12:00:00' },
      ];
      ctx.data.terminalFilter = 'T3'; // doesn't exist
      ctx.data.dayFilter = 'all';
      ctx.data.sortOrder = 'arrival';
      pageConfig.recomputeFiltersAndList.call(ctx);
      expect(ctx.data.terminalFilter).toBe('all');
    });
  });

  describe('polling methods', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('_startPolling sets interval', () => {
      ctx._pollTimer = null;
      pageConfig._startPolling.call(ctx);
      expect(ctx._pollTimer).not.toBeNull();
      pageConfig._stopPolling.call(ctx);
    });

    it('_stopPolling clears interval', () => {
      ctx._pollTimer = setInterval(() => {}, 1000);
      pageConfig._stopPolling.call(ctx);
      expect(ctx._pollTimer).toBeNull();
    });
  });

  describe('onLoad', () => {
    it('loads shift with id', async () => {
      const api = require('../../../../utils/api');
      api.getShift.mockResolvedValue({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] });
      api.getPendingRequests.mockResolvedValue([]);
      ctx._dayFilterInitialized = false;
      await pageConfig.onLoad.call(ctx, { id: '1' });
      expect(ctx.data.shiftId).toBe('1');
    });

    it('shows error when no id', async () => {
      await pageConfig.onLoad.call(ctx, {});
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onShow', () => {
    it('reloads data if enough time passed', () => {
      const api = require('../../../../utils/api');
      api.getShift.mockResolvedValue({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] });
      api.getPendingRequests.mockResolvedValue([]);
      ctx.data.shiftId = '1';
      ctx._lastLoadTime = 0;
      pageConfig.onShow.call(ctx);
      expect(api.getShift).toHaveBeenCalled();
    });
  });

  describe('onPullDownRefresh', () => {
    it('reloads and stops', async () => {
      const api = require('../../../../utils/api');
      api.getShift.mockResolvedValue({ id: 1, status: 'draft', departure_time: '2026-03-10 14:00:00', requests: [] });
      api.getPendingRequests.mockResolvedValue([]);
      ctx.data.shiftId = '1';
      ctx._dayFilterInitialized = true;
      await pageConfig.onPullDownRefresh.call(ctx);
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });
});
