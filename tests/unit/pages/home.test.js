/**
 * Tests for pages/home/index.js
 */

jest.mock('../../../utils/api', () => ({
  getMyStudentRequests: jest.fn(),
  getModificationRequests: jest.fn(),
}));

jest.mock('../../../utils/i18n', () => ({ t: (key) => key }));
jest.mock('../../../utils/status', () => ({
  requestStatusText: jest.fn((s) => `status_${s}`),
}));

describe('pages/home', () => {
  let pageConfig;
  let api;
  let ctx;

  function makeCtx(overrides) {
    return {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(updates) { Object.assign(this.data, updates); },
      getTabBar: jest.fn(() => ({
        setData: jest.fn(),
        refreshTabs: jest.fn(),
      })),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn();
    Object.keys(wx).forEach((k) => {
      if (typeof wx[k] === 'function' && wx[k].mockClear) wx[k].mockClear();
    });
    global.getApp = jest.fn(() => ({
      ensureWechatBound: jest.fn(() => true),
      getEffectiveRole: jest.fn(() => 'student'),
      globalData: { userInfo: { name: 'TestUser', role: 'student' } },
    }));

    require('../../../pages/home/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../utils/api');
    ctx = makeCtx();
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.isManageRole).toBe(false);
      expect(pageConfig.data.isStudent).toBe(true);
      expect(pageConfig.data.isDriver).toBe(false);
      expect(pageConfig.data.loadingMyInfo).toBe(false);
      expect(pageConfig.data.latestRequest).toBeNull();
      expect(pageConfig.data.myShiftTime).toBe('--');
      expect(pageConfig.data.pendingModCount).toBe(0);
    });
  });

  describe('onLoad', () => {
    it('sets i18n', () => {
      ctx.onLoad();
      expect(ctx.data.i18n.home_welcome).toBe('home_welcome');
    });
  });

  describe('onShow', () => {
    it('sets student role and loads summary', async () => {
      api.getMyStudentRequests.mockResolvedValue([]);
      await ctx.onShow();
      expect(ctx.data.isStudent).toBe(true);
      expect(ctx.data.isManageRole).toBe(false);
    });

    it('returns if not bound', () => {
      global.getApp = jest.fn(() => ({
        ensureWechatBound: jest.fn(() => false),
      }));
      ctx.onShow();
      expect(api.getMyStudentRequests).not.toHaveBeenCalled();
    });

    it('sets admin role', async () => {
      global.getApp = jest.fn(() => ({
        ensureWechatBound: jest.fn(() => true),
        getEffectiveRole: jest.fn(() => 'admin'),
        globalData: { userInfo: { role: 'admin' } },
      }));
      api.getModificationRequests.mockResolvedValue([]);
      await ctx.onShow();
      expect(ctx.data.isManageRole).toBe(true);
      expect(ctx.data.canManageStaff).toBe(true);
    });

    it('sets driver role', async () => {
      global.getApp = jest.fn(() => ({
        ensureWechatBound: jest.fn(() => true),
        getEffectiveRole: jest.fn(() => 'driver'),
        globalData: { userInfo: { role: 'driver' } },
      }));
      await ctx.onShow();
      expect(ctx.data.isDriver).toBe(true);
    });

    it('updates tabbar', async () => {
      api.getMyStudentRequests.mockResolvedValue([]);
      await ctx.onShow();
      expect(ctx.getTabBar).toHaveBeenCalled();
    });
  });

  describe('loadMySummary', () => {
    it('loads latest request', async () => {
      api.getMyStudentRequests.mockResolvedValue([
        { id: 1, status: 'assigned', shift: { departure_time: '2026-03-10T14:00:00Z' } },
      ]);
      await ctx.loadMySummary();
      expect(ctx.data.latestRequest).toBeDefined();
      expect(ctx.data.latestRequest.status_text).toBe('status_assigned');
      expect(ctx.data.myShiftTime).toBe('2026-03-10T14:00:00Z');
      expect(ctx.data.loadingMyInfo).toBe(false);
    });

    it('handles empty list', async () => {
      api.getMyStudentRequests.mockResolvedValue([]);
      await ctx.loadMySummary();
      expect(ctx.data.latestRequest).toBeNull();
      expect(ctx.data.myShiftTime).toBe('--');
    });

    it('handles no shift on request', async () => {
      api.getMyStudentRequests.mockResolvedValue([{ id: 1, status: 'pending' }]);
      await ctx.loadMySummary();
      expect(ctx.data.myShiftTime).toBe('--');
    });

    it('handles error', async () => {
      api.getMyStudentRequests.mockRejectedValue(new Error('fail'));
      await ctx.loadMySummary();
      expect(ctx.data.latestRequest).toBeNull();
      expect(ctx.data.loadingMyInfo).toBe(false);
    });

    it('handles non-array response', async () => {
      api.getMyStudentRequests.mockResolvedValue(null);
      await ctx.loadMySummary();
      expect(ctx.data.latestRequest).toBeNull();
    });
  });

  describe('loadPendingModCount', () => {
    it('loads count', async () => {
      api.getModificationRequests.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await ctx.loadPendingModCount();
      expect(ctx.data.pendingModCount).toBe(2);
    });

    it('handles error', async () => {
      api.getModificationRequests.mockRejectedValue(new Error('fail'));
      await ctx.loadPendingModCount();
      expect(ctx.data.pendingModCount).toBe(0);
    });

    it('handles non-array', async () => {
      api.getModificationRequests.mockResolvedValue(null);
      await ctx.loadPendingModCount();
      expect(ctx.data.pendingModCount).toBe(0);
    });
  });

  describe('navigation methods', () => {
    it('goDriverPage navigates', () => {
      ctx.goDriverPage();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/driver/index' });
    });

    it('goToMyRequest navigates', () => {
      ctx.goToMyRequest();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/student/request/index' });
    });

    it('goStudentRequest navigates', () => {
      ctx.goStudentRequest();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/student/request/index' });
    });

    it('goDashboard switches tab', () => {
      ctx.goDashboard();
      expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/admin/dashboard/index' });
    });

    it('goDriverManage navigates', () => {
      ctx.goDriverManage();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/admin/drivers/index' });
    });

    it('goStaffManage navigates', () => {
      ctx.goStaffManage();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/admin/staff/index' });
    });

    it('goTokenManage navigates', () => {
      ctx.goTokenManage();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/staff/tokens/index' });
    });

    it('goModificationReview navigates', () => {
      ctx.goModificationReview();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/admin/modification-requests/index' });
    });
  });

  describe('onPullDownRefresh', () => {
    it('reloads student summary', async () => {
      ctx.data.isStudent = true;
      api.getMyStudentRequests.mockResolvedValue([]);
      await ctx.onPullDownRefresh();
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });

    it('reloads mod count for manage role', async () => {
      ctx.data.isStudent = false;
      api.getModificationRequests.mockResolvedValue([]);
      await ctx.onPullDownRefresh();
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });
});
