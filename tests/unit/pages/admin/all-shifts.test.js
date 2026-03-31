/**
 * Tests for pages/admin/all-shifts/index.js
 */

jest.mock('../../../../utils/api', () => ({
  getDashboard: jest.fn(),
}));

jest.mock('../../../../utils/i18n', () => ({ t: (key) => key }));
jest.mock('../../../../utils/status', () => ({
  normalizeShiftStatus: jest.fn((s) => (s === 'Published' ? 'published' : (s || 'draft'))),
}));

describe('pages/admin/all-shifts', () => {
  let pageConfig;
  let api;
  let ctx;

  function makeCtx(overrides) {
    return {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(updates) { Object.assign(this.data, updates); },
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn();
    Object.keys(wx).forEach((k) => {
      if (typeof wx[k] === 'function' && wx[k].mockClear) wx[k].mockClear();
    });

    require('../../../../pages/admin/all-shifts/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../../utils/api');
    ctx = makeCtx();
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.loading).toBe(false);
      expect(pageConfig.data.loadingMore).toBe(false);
      expect(pageConfig.data.allShifts).toEqual([]);
      expect(pageConfig.data.filteredShifts).toEqual([]);
      expect(pageConfig.data.activeTab).toBe(0);
      expect(pageConfig.data.sortBy).toBe('time');
      expect(pageConfig.data.page).toBe(1);
      expect(pageConfig.data.pageSize).toBe(20);
      expect(pageConfig.data.hasMore).toBe(true);
    });
  });

  describe('onLoad', () => {
    it('sets i18n, sort options, nav title, loads shifts', async () => {
      api.getDashboard.mockResolvedValue({ shifts: [], total: 0 });
      await ctx.onLoad();
      expect(wx.setNavigationBarTitle).toHaveBeenCalled();
      expect(ctx.data.sortOptions).toHaveLength(3);
      expect(api.getDashboard).toHaveBeenCalled();
    });
  });

  describe('loadShifts', () => {
    it('loads page 1 and resets list', async () => {
      api.getDashboard.mockResolvedValue({
        shifts: [
          { id: 1, status: 'Published', departure_time: '2026-03-10T14:00:00Z', requests: [] },
          { id: 2, status: 'draft', departure_time: '2026-03-10T15:00:00Z', requests: [] },
        ],
        total: 2,
      });
      await ctx.loadShifts(1);
      expect(ctx.data.allShifts).toHaveLength(2);
      expect(ctx.data.allShifts[0].status).toBe('published');
      expect(ctx.data.page).toBe(1);
      expect(ctx.data.hasMore).toBe(false);
      expect(ctx.data.loading).toBe(false);
    });

    it('appends on page > 1', async () => {
      ctx.data.allShifts = [{ id: 1, status: 'draft', departure_time: 'a', requests: [] }];
      api.getDashboard.mockResolvedValue({
        shifts: [{ id: 2, status: 'draft', departure_time: 'b', requests: [] }],
        total: 5,
      });
      await ctx.loadShifts(2);
      expect(ctx.data.allShifts).toHaveLength(2);
      expect(ctx.data.loadingMore).toBe(false);
    });

    it('handles array response without total', async () => {
      api.getDashboard.mockResolvedValue([{ id: 1, departure_time: 'a' }]);
      await ctx.loadShifts(1);
      expect(ctx.data.allShifts).toHaveLength(1);
    });

    it('handles empty response', async () => {
      api.getDashboard.mockResolvedValue({ shifts: [], total: 0 });
      await ctx.loadShifts(1);
      expect(ctx.data.allShifts).toEqual([]);
      expect(ctx.data.hasMore).toBe(false);
    });

    it('handles null response', async () => {
      api.getDashboard.mockResolvedValue(null);
      await ctx.loadShifts(1);
      expect(ctx.data.allShifts).toEqual([]);
    });

    it('handles error', async () => {
      api.getDashboard.mockRejectedValue(new Error('fail'));
      await ctx.loadShifts(1);
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.loading).toBe(false);
    });

    it('normalizes various field names', async () => {
      api.getDashboard.mockResolvedValue({
        shifts: [{ ID: 99, Status: 'Published', DepartureTime: '2026-03-10T14:00:00Z', Requests: [{ id: 1 }] }],
        total: 1,
      });
      await ctx.loadShifts(1);
      expect(ctx.data.allShifts[0].id).toBe(99);
      expect(ctx.data.allShifts[0].departure_time).toBe('2026-03-10T14:00:00Z');
      expect(ctx.data.allShifts[0].requests).toHaveLength(1);
    });

    it('uses passengers field as fallback', async () => {
      api.getDashboard.mockResolvedValue({
        shifts: [{ id: 1, departure_time: 'a', passengers: [{ id: 1 }, { id: 2 }] }],
        total: 1,
      });
      await ctx.loadShifts(1);
      expect(ctx.data.allShifts[0].requests).toHaveLength(2);
    });

    it('passes status filter based on active tab', async () => {
      ctx.data.activeTab = 1;
      api.getDashboard.mockResolvedValue({ shifts: [], total: 0 });
      await ctx.loadShifts(1);
      expect(api.getDashboard).toHaveBeenCalledWith('all', 1, 20, 'published');
    });

    it('passes draft filter for tab 2', async () => {
      ctx.data.activeTab = 2;
      api.getDashboard.mockResolvedValue({ shifts: [], total: 0 });
      await ctx.loadShifts(1);
      expect(api.getDashboard).toHaveBeenCalledWith('all', 1, 20, 'draft');
    });
  });

  describe('applySort', () => {
    beforeEach(() => {
      ctx.data.allShifts = [
        { id: 1, status: 'draft', departure_time: '2026-03-10T16:00:00Z', requests: [], driver: { max_seats: 6 } },
        { id: 2, status: 'published', departure_time: '2026-03-10T14:00:00Z', requests: [{ id: 1 }], driver: { max_seats: 4 } },
        { id: 3, status: 'draft', departure_time: '2026-03-10T15:00:00Z', requests: [], driver: { max_seats: 3 } },
      ];
    });

    it('sorts by time', () => {
      ctx.data.sortBy = 'time';
      ctx.applySort();
      expect(ctx.data.filteredShifts[0].id).toBe(2);
      expect(ctx.data.filteredShifts[1].id).toBe(3);
      expect(ctx.data.filteredShifts[2].id).toBe(1);
    });

    it('sorts by seats (unfilled)', () => {
      ctx.data.sortBy = 'seats';
      ctx.applySort();
      // unfilled = maxSeats - requests.length - 1
      // id2: 4 - 1 - 1 = 2, id3: 3 - 0 - 1 = 2, id1: 6 - 0 - 1 = 5
      expect(ctx.data.filteredShifts[0].id).not.toBe(1); // id1 has most unfilled
    });

    it('sorts by status (published first)', () => {
      ctx.data.sortBy = 'status';
      ctx.applySort();
      expect(ctx.data.filteredShifts[0].status).toBe('published');
    });
  });

  describe('_unfilledSeats', () => {
    it('calculates correctly', () => {
      const shift = { driver: { max_seats: 6 }, requests: [{ id: 1 }, { id: 2 }] };
      expect(ctx._unfilledSeats(shift)).toBe(3); // 6 - 2 - 1
    });

    it('handles no driver', () => {
      const shift = { requests: [{ id: 1 }] };
      expect(ctx._unfilledSeats(shift)).toBe(-2); // 0 - 1 - 1
    });
  });

  describe('onTabChange', () => {
    it('sets activeTab and reloads', async () => {
      api.getDashboard.mockResolvedValue({ shifts: [], total: 0 });
      await ctx.onTabChange({ detail: { index: 2 } });
      expect(ctx.data.activeTab).toBe(2);
    });
  });

  describe('onSortChange', () => {
    it('updates sortBy and applies sort', () => {
      ctx.data.allShifts = [{ id: 1, departure_time: 'a', status: 'draft', requests: [] }];
      ctx.onSortChange({ detail: 'seats' });
      expect(ctx.data.sortBy).toBe('seats');
      expect(ctx.data.filteredShifts).toHaveLength(1);
    });
  });

  describe('onPullDownRefresh', () => {
    it('reloads and stops refresh', async () => {
      api.getDashboard.mockResolvedValue({ shifts: [], total: 0 });
      await ctx.onPullDownRefresh();
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });

  describe('onReachBottom', () => {
    it('loads next page when hasMore', async () => {
      ctx.data.hasMore = true;
      ctx.data.page = 1;
      ctx.data.loading = false;
      ctx.data.loadingMore = false;
      api.getDashboard.mockResolvedValue({ shifts: [], total: 0 });
      ctx.onReachBottom();
      expect(api.getDashboard).toHaveBeenCalled();
    });

    it('does not load when no more', () => {
      ctx.data.hasMore = false;
      api.getDashboard.mockClear();
      ctx.onReachBottom();
      expect(api.getDashboard).not.toHaveBeenCalled();
    });

    it('does not load when already loading', () => {
      ctx.data.hasMore = true;
      ctx.data.loading = true;
      api.getDashboard.mockClear();
      ctx.onReachBottom();
      expect(api.getDashboard).not.toHaveBeenCalled();
    });
  });

  describe('onManageShift', () => {
    it('navigates to shift detail', () => {
      ctx.onManageShift({ detail: { shiftId: 42 } });
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/admin/shift-detail/index?id=42' });
    });

    it('ignores zero id', () => {
      ctx.onManageShift({ detail: {} });
      expect(wx.navigateTo).not.toHaveBeenCalled();
    });

    it('handles missing event', () => {
      ctx.onManageShift(null);
      expect(wx.navigateTo).not.toHaveBeenCalled();
    });
  });

  describe('_loadTabCounts', () => {
    it('loads counts for all tabs', async () => {
      api.getDashboard
        .mockResolvedValueOnce({ total: 10 })
        .mockResolvedValueOnce({ total: 6 })
        .mockResolvedValueOnce({ total: 4 });
      await ctx._loadTabCounts();
      expect(ctx.data.allCount).toBe(10);
      expect(ctx.data.publishedCount).toBe(6);
      expect(ctx.data.draftCount).toBe(4);
    });

    it('handles errors gracefully', async () => {
      api.getDashboard.mockRejectedValue(new Error('fail'));
      await ctx._loadTabCounts();
      // Should not throw, counts stay 0
      expect(ctx.data.allCount).toBe(0);
    });
  });
});
