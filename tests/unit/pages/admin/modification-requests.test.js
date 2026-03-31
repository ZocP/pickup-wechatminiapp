/**
 * Tests for pages/admin/modification-requests/index.js
 */

jest.mock('../../../../utils/api', () => ({
  getModificationRequests: jest.fn(),
  approveModification: jest.fn(),
  rejectModification: jest.fn(),
}));

jest.mock('../../../../utils/i18n', () => ({ t: (key) => key }));

describe('pages/admin/modification-requests', () => {
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

    require('../../../../pages/admin/modification-requests/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../../utils/api');
    ctx = makeCtx();
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.activeTab).toBe('pending');
      expect(pageConfig.data.list).toEqual([]);
      expect(pageConfig.data.loading).toBe(false);
    });
  });

  describe('onLoad', () => {
    it('sets i18n and tabs', () => {
      ctx.onLoad();
      expect(ctx.data.i18n).toBeDefined();
      expect(ctx.data.i18n.mod_review_title).toBe('mod_review_title');
      expect(ctx.data.tabs).toHaveLength(4);
      expect(ctx.data.tabs[0].name).toBe('pending');
    });
  });

  describe('onShow', () => {
    it('loads list', async () => {
      api.getModificationRequests.mockResolvedValue([]);
      await ctx.onShow();
      expect(api.getModificationRequests).toHaveBeenCalled();
    });
  });

  describe('onPullDownRefresh', () => {
    it('reloads and stops', async () => {
      api.getModificationRequests.mockResolvedValue([]);
      await ctx.onPullDownRefresh();
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });

  describe('onTabChange', () => {
    it('updates tab and reloads', async () => {
      api.getModificationRequests.mockResolvedValue([]);
      await ctx.onTabChange({ detail: { name: 'approved' } });
      expect(ctx.data.activeTab).toBe('approved');
    });
  });

  describe('loadList', () => {
    it('loads and formats items', async () => {
      api.getModificationRequests.mockResolvedValue([
        {
          id: 1,
          created_at: '2026-03-10T14:30:00Z',
          new_arrival_time: '2026-03-10T16:00:00Z',
          request_status: 'pending',
        },
      ]);
      ctx.data.activeTab = 'pending';
      await ctx.loadList();
      expect(ctx.data.list).toHaveLength(1);
      expect(ctx.data.list[0].formattedTime).toBe('2026-03-10 14:30');
      expect(ctx.data.list[0].formattedNewArrival).toBe('2026-03-10 16:00');
      expect(ctx.data.list[0].statusLabel).toBe('mod_review_request_status_pending');
      expect(ctx.data.loading).toBe(false);
    });

    it('handles missing timestamps', async () => {
      api.getModificationRequests.mockResolvedValue([{ id: 1 }]);
      await ctx.loadList();
      expect(ctx.data.list[0].formattedTime).toBe('--');
      expect(ctx.data.list[0].formattedNewArrival).toBe('--');
    });

    it('handles non-array response', async () => {
      api.getModificationRequests.mockResolvedValue(null);
      await ctx.loadList();
      expect(ctx.data.list).toEqual([]);
    });

    it('handles error', async () => {
      ctx.onLoad(); // populate i18n
      api.getModificationRequests.mockRejectedValue(new Error('fail'));
      await ctx.loadList();
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.loading).toBe(false);
    });

    it('passes empty status for all tab', async () => {
      ctx.data.activeTab = '';
      api.getModificationRequests.mockResolvedValue([]);
      await ctx.loadList();
      expect(api.getModificationRequests).toHaveBeenCalledWith('');
    });

    it('handles unknown request_status', async () => {
      api.getModificationRequests.mockResolvedValue([
        { id: 1, request_status: 'unknown_status' },
      ]);
      await ctx.loadList();
      expect(ctx.data.list[0].statusLabel).toBe('unknown_status');
    });
  });

  describe('onApprove', () => {
    it('approves after modal confirm', async () => {
      ctx.onLoad(); // populate i18n
      api.approveModification.mockResolvedValue({});
      api.getModificationRequests.mockResolvedValue([]);
      wx.showModal.mockImplementation(({ success }) => {
        success({ confirm: true });
      });
      ctx.onApprove({ currentTarget: { dataset: { id: 1 } } });
      // Wait for async callback
      await new Promise((r) => setTimeout(r, 0));
      expect(api.approveModification).toHaveBeenCalledWith(1);
    });

    it('does not approve on cancel', async () => {
      ctx.onLoad();
      wx.showModal.mockImplementation(({ success }) => {
        success({ confirm: false });
      });
      ctx.onApprove({ currentTarget: { dataset: { id: 1 } } });
      await new Promise((r) => setTimeout(r, 0));
      expect(api.approveModification).not.toHaveBeenCalled();
    });

    it('handles approve error', async () => {
      ctx.onLoad();
      api.approveModification.mockRejectedValue({ message: 'already processed' });
      wx.showModal.mockImplementation(({ success }) => {
        success({ confirm: true });
      });
      ctx.onApprove({ currentTarget: { dataset: { id: 1 } } });
      await new Promise((r) => setTimeout(r, 10));
      expect(wx.showToast).toHaveBeenCalled();
    });
  });

  describe('onReject', () => {
    it('rejects after modal confirm', async () => {
      ctx.onLoad();
      api.rejectModification.mockResolvedValue({});
      api.getModificationRequests.mockResolvedValue([]);
      wx.showModal.mockImplementation(({ success }) => {
        success({ confirm: true });
      });
      ctx.onReject({ currentTarget: { dataset: { id: 2 } } });
      await new Promise((r) => setTimeout(r, 0));
      expect(api.rejectModification).toHaveBeenCalledWith(2);
    });

    it('does not reject on cancel', async () => {
      ctx.onLoad();
      wx.showModal.mockImplementation(({ success }) => {
        success({ confirm: false });
      });
      ctx.onReject({ currentTarget: { dataset: { id: 2 } } });
      await new Promise((r) => setTimeout(r, 0));
      expect(api.rejectModification).not.toHaveBeenCalled();
    });

    it('handles reject error', async () => {
      ctx.onLoad();
      api.rejectModification.mockRejectedValue({ message: 'fail' });
      wx.showModal.mockImplementation(({ success }) => {
        success({ confirm: true });
      });
      ctx.onReject({ currentTarget: { dataset: { id: 2 } } });
      await new Promise((r) => setTimeout(r, 10));
      expect(wx.showToast).toHaveBeenCalled();
    });
  });
});
