/**
 * Tests for pages/admin/staff/index.js
 */

jest.mock('../../../../utils/api', () => ({
  getUsers: jest.fn(),
  getDrivers: jest.fn(),
  setUserAsStaff: jest.fn(),
  cancelUserAsStaff: jest.fn(),
  setUserAsDriver: jest.fn(),
  cancelUserAsDriver: jest.fn(),
}));

jest.mock('../../../../utils/i18n', () => ({ t: (key) => key }));
jest.mock('../../../../utils/ui', () => ({
  setTabBarHidden: jest.fn(),
}));

describe('pages/admin/staff', () => {
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
      ensureWechatBound: jest.fn(() => true),
      getEffectiveRole: jest.fn(() => 'admin'),
      globalData: { userInfo: { role: 'admin' } },
    }));

    require('../../../../pages/admin/staff/index');
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
      expect(pageConfig.data.userList).toEqual([]);
      expect(pageConfig.data.filteredUserList).toEqual([]);
      expect(pageConfig.data.searchKeyword).toBe('');
      expect(pageConfig.data.showDriverPicker).toBe(false);
      expect(pageConfig.data.showRoleActions).toBe(false);
      expect(pageConfig.data.actingUserId).toBe(0);
    });
  });

  describe('onShow', () => {
    it('loads users and drivers for admin', async () => {
      api.getUsers.mockResolvedValue([]);
      api.getDrivers.mockResolvedValue([]);
      await ctx.onShow();
      expect(api.getUsers).toHaveBeenCalled();
      expect(api.getDrivers).toHaveBeenCalled();
    });

    it('redirects non-admin', () => {
      global.getApp = jest.fn(() => ({
        ensureWechatBound: jest.fn(() => true),
        getEffectiveRole: jest.fn(() => 'student'),
        globalData: { userInfo: { role: 'student' } },
      }));
      ctx.onShow();
      expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });
    });

    it('returns if not bound', () => {
      global.getApp = jest.fn(() => ({
        ensureWechatBound: jest.fn(() => false),
      }));
      ctx.onShow();
      expect(api.getUsers).not.toHaveBeenCalled();
    });
  });

  describe('loadAll', () => {
    it('loads users and drivers', async () => {
      api.getUsers.mockResolvedValue([{ id: 1, name: 'User1' }]);
      api.getDrivers.mockResolvedValue([{ id: 1, name: 'Driver1', car_model: 'Toyota' }]);
      await ctx.loadAll();
      expect(ctx.data.userList).toHaveLength(1);
      expect(ctx.data.driverList).toHaveLength(1);
      expect(ctx.data.loading).toBe(false);
    });

    it('handles non-array response', async () => {
      api.getUsers.mockResolvedValue(null);
      api.getDrivers.mockResolvedValue('bad');
      await ctx.loadAll();
      expect(ctx.data.userList).toEqual([]);
      expect(ctx.data.driverList).toEqual([]);
    });

    it('handles error', async () => {
      api.getUsers.mockRejectedValue(new Error('fail'));
      await ctx.loadAll();
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.loading).toBe(false);
    });
  });

  describe('search / filter', () => {
    beforeEach(async () => {
      api.getUsers.mockResolvedValue([
        { id: 1, name: 'Alice', wechat_id: 'alice_wx' },
        { id: 2, name: 'Bob', wechat_id: 'bob_wx' },
      ]);
      api.getDrivers.mockResolvedValue([]);
      await ctx.loadAll();
    });

    it('filters by name', () => {
      ctx.onSearchChange({ detail: 'alice' });
      jest.advanceTimersByTime(300);
      expect(ctx.data.filteredUserList).toHaveLength(1);
    });

    it('filters by wechat_id', () => {
      ctx.onSearchChange({ detail: 'bob_wx' });
      jest.advanceTimersByTime(300);
      expect(ctx.data.filteredUserList).toHaveLength(1);
    });

    it('shows all on clear', () => {
      ctx.onSearchChange({ detail: 'alice' });
      jest.advanceTimersByTime(300);
      ctx.onSearchClear();
      expect(ctx.data.filteredUserList).toHaveLength(2);
    });

    it('returns empty for no matches', () => {
      ctx.onSearchChange({ detail: 'zzz' });
      jest.advanceTimersByTime(300);
      expect(ctx.data.filteredUserList).toEqual([]);
    });
  });

  describe('toggleStaff', () => {
    it('sets staff for non-staff user', async () => {
      api.setUserAsStaff.mockResolvedValue({});
      api.getUsers.mockResolvedValue([]);
      api.getDrivers.mockResolvedValue([]);
      await ctx.toggleStaff(1, 'student');
      expect(api.setUserAsStaff).toHaveBeenCalledWith(1);
      expect(ctx.data.actingUserId).toBe(0);
    });

    it('cancels staff for staff user', async () => {
      api.cancelUserAsStaff.mockResolvedValue({});
      api.getUsers.mockResolvedValue([]);
      api.getDrivers.mockResolvedValue([]);
      await ctx.toggleStaff(1, 'staff');
      expect(api.cancelUserAsStaff).toHaveBeenCalledWith(1);
    });

    it('prevents action when already acting', async () => {
      ctx.data.actingUserId = 99;
      await ctx.toggleStaff(1, 'student');
      expect(api.setUserAsStaff).not.toHaveBeenCalled();
    });

    it('ignores userId 0', async () => {
      await ctx.toggleStaff(0, 'student');
      expect(api.setUserAsStaff).not.toHaveBeenCalled();
    });

    it('handles error', async () => {
      api.setUserAsStaff.mockRejectedValue({ message: 'fail' });
      await ctx.toggleStaff(1, 'student');
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.actingUserId).toBe(0);
    });
  });

  describe('onToggleStaff', () => {
    it('extracts userId and role from event', async () => {
      api.setUserAsStaff.mockResolvedValue({});
      api.getUsers.mockResolvedValue([]);
      api.getDrivers.mockResolvedValue([]);
      await ctx.onToggleStaff({ currentTarget: { dataset: { id: 5, role: 'student' } } });
      expect(api.setUserAsStaff).toHaveBeenCalledWith(5);
    });
  });

  describe('onSetDriver', () => {
    it('shows driver picker when drivers available', () => {
      ctx.data.driverList = [{ id: 1, name: 'D1', car_model: 'Toyota' }];
      ctx.onSetDriver({ currentTarget: { dataset: { id: 5 } } });
      expect(ctx.data.showDriverPicker).toBe(true);
      expect(ctx.data.driverActions).toHaveLength(1);
      expect(ctx.data.targetUserIdForDriver).toBe(5);
    });

    it('shows toast when no drivers', () => {
      ctx.data.driverList = [];
      ctx.onSetDriver({ currentTarget: { dataset: { id: 5 } } });
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.showDriverPicker).toBe(false);
    });

    it('ignores when no userId', () => {
      ctx.onSetDriver({ currentTarget: { dataset: {} } });
      expect(ctx.data.showDriverPicker).toBe(false);
    });
  });

  describe('onSelectDriver', () => {
    it('assigns driver to user', async () => {
      ctx.data.targetUserIdForDriver = 5;
      api.setUserAsDriver.mockResolvedValue({});
      api.getUsers.mockResolvedValue([]);
      api.getDrivers.mockResolvedValue([]);
      await ctx.onSelectDriver({ detail: { driverId: 10 } });
      expect(api.setUserAsDriver).toHaveBeenCalledWith(5, 10);
      expect(ctx.data.actingUserId).toBe(0);
    });

    it('handles error', async () => {
      ctx.data.targetUserIdForDriver = 5;
      api.setUserAsDriver.mockRejectedValue(new Error('fail'));
      await ctx.onSelectDriver({ detail: { driverId: 10 } });
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onUnsetDriver', () => {
    it('cancels driver role', async () => {
      api.cancelUserAsDriver.mockResolvedValue({});
      api.getUsers.mockResolvedValue([]);
      api.getDrivers.mockResolvedValue([]);
      await ctx.onUnsetDriver({ currentTarget: { dataset: { id: 5 } } });
      expect(api.cancelUserAsDriver).toHaveBeenCalledWith(5);
    });

    it('prevents double action', async () => {
      ctx.data.actingUserId = 99;
      await ctx.onUnsetDriver({ currentTarget: { dataset: { id: 5 } } });
      expect(api.cancelUserAsDriver).not.toHaveBeenCalled();
    });
  });

  describe('onOpenRoleActions', () => {
    it('builds correct actions for student', () => {
      ctx.onOpenRoleActions({ currentTarget: { dataset: { id: 5, role: 'student' } } });
      expect(ctx.data.showRoleActions).toBe(true);
      expect(ctx.data.roleActions).toHaveLength(2);
      expect(ctx.data.roleActions[0].action).toBe('toggleStaff');
      expect(ctx.data.roleActions[1].action).toBe('setDriver');
    });

    it('builds correct actions for driver', () => {
      ctx.onOpenRoleActions({ currentTarget: { dataset: { id: 5, role: 'driver' } } });
      expect(ctx.data.roleActions[1].action).toBe('unsetDriver');
    });

    it('ignores no userId', () => {
      ctx.onOpenRoleActions({ currentTarget: { dataset: {} } });
      expect(ctx.data.showRoleActions).toBe(false);
    });
  });

  describe('onSelectRoleAction', () => {
    beforeEach(() => {
      ctx.data.targetUserIdForAction = 5;
      ctx.data.targetUserRoleForAction = 'student';
    });

    it('dispatches toggleStaff', async () => {
      api.setUserAsStaff.mockResolvedValue({});
      api.getUsers.mockResolvedValue([]);
      api.getDrivers.mockResolvedValue([]);
      await ctx.onSelectRoleAction({ detail: { action: 'toggleStaff' } });
      expect(api.setUserAsStaff).toHaveBeenCalledWith(5);
    });

    it('dispatches setDriver', () => {
      ctx.data.driverList = [{ id: 1, name: 'D', car_model: 'T' }];
      ctx.onSelectRoleAction({ detail: { action: 'setDriver' } });
      expect(ctx.data.showDriverPicker).toBe(true);
    });

    it('dispatches unsetDriver', async () => {
      api.cancelUserAsDriver.mockResolvedValue({});
      api.getUsers.mockResolvedValue([]);
      api.getDrivers.mockResolvedValue([]);
      await ctx.onSelectRoleAction({ detail: { action: 'unsetDriver' } });
      expect(api.cancelUserAsDriver).toHaveBeenCalledWith(5);
    });
  });

  describe('close actions', () => {
    it('closes role actions', () => {
      ctx.data.showRoleActions = true;
      ctx.onCloseRoleActions();
      expect(ctx.data.showRoleActions).toBe(false);
      expect(ctx.data.roleActions).toEqual([]);
    });

    it('closes driver picker', () => {
      ctx.data.showDriverPicker = true;
      ctx.onCloseDriverPicker();
      expect(ctx.data.showDriverPicker).toBe(false);
    });
  });

  describe('onPullDownRefresh', () => {
    it('reloads and stops', async () => {
      api.getUsers.mockResolvedValue([]);
      api.getDrivers.mockResolvedValue([]);
      await ctx.onPullDownRefresh();
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });
});
