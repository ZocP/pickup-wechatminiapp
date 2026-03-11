/**
 * Tests for pages/staff/tokens/index.js
 */

jest.mock('../../../../utils/api', () => ({
  getTokenList: jest.fn(),
  generateToken: jest.fn(),
  revokeToken: jest.fn(),
}));

jest.mock('../../../../utils/i18n', () => ({ t: (key) => key }));
jest.mock('../../../../utils/formatters', () => ({
  formatDateTime: jest.fn((v) => v || '--'),
}));
jest.mock('../../../../miniprogram_npm/@vant/weapp/dialog/dialog', () => ({
  default: { confirm: jest.fn() },
}));

describe('pages/staff/tokens', () => {
  let pageConfig;
  let api;
  let Dialog;
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
    global.getApp = jest.fn(() => ({
      getEffectiveRole: jest.fn(() => 'admin'),
    }));

    require('../../../../pages/staff/tokens/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../../utils/api');
    Dialog = require('../../../../miniprogram_npm/@vant/weapp/dialog/dialog').default;
    ctx = makeCtx();
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.loading).toBe(false);
      expect(pageConfig.data.list).toEqual([]);
      expect(pageConfig.data.showForm).toBe(false);
      expect(pageConfig.data.submitting).toBe(false);
      expect(pageConfig.data.page).toBe(1);
      expect(pageConfig.data.hasMore).toBe(true);
    });
  });

  describe('onLoad', () => {
    it('sets nav title and loads list', async () => {
      api.getTokenList.mockResolvedValue([]);
      await ctx.onLoad();
      expect(wx.setNavigationBarTitle).toHaveBeenCalled();
      expect(api.getTokenList).toHaveBeenCalled();
    });
  });

  describe('onShow', () => {
    it('redirects non-admin/staff', () => {
      global.getApp = jest.fn(() => ({
        getEffectiveRole: jest.fn(() => 'student'),
      }));
      ctx.onShow();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'tokens_no_permission' }));
    });

    it('allows admin', () => {
      ctx.onShow();
      expect(wx.navigateBack).not.toHaveBeenCalled();
    });

    it('allows staff', () => {
      global.getApp = jest.fn(() => ({
        getEffectiveRole: jest.fn(() => 'staff'),
      }));
      ctx.onShow();
      expect(wx.navigateBack).not.toHaveBeenCalled();
    });
  });

  describe('loadList', () => {
    it('loads and formats tokens (reset)', async () => {
      api.getTokenList.mockResolvedValue({
        tokens: [
          { id: 1, code: 'ABC', created_at: '2026-03-10', status: 'unused', expires_at: '2026-04-10', used_by_user: null },
          { id: 2, code: 'DEF', created_at: '2026-03-10', status: 'used', used_by_user: { id: 5, name: 'Alice' } },
        ],
        total: 2,
      });
      await ctx.loadList(true);
      expect(ctx.data.list).toHaveLength(2);
      expect(ctx.data.list[0].expires_at_text).not.toBe('');
      expect(ctx.data.list[1].used_by_name).toBe('Alice');
      expect(ctx.data.loading).toBe(false);
    });

    it('appends on non-reset', async () => {
      ctx.data.list = [{ id: 0 }];
      ctx.data.page = 2;
      api.getTokenList.mockResolvedValue([{ id: 1, created_at: 'x' }]);
      await ctx.loadList(false);
      expect(ctx.data.list).toHaveLength(2);
    });

    it('handles array response', async () => {
      api.getTokenList.mockResolvedValue([{ id: 1, created_at: 'x' }]);
      await ctx.loadList(true);
      expect(ctx.data.list).toHaveLength(1);
    });

    it('handles empty response', async () => {
      api.getTokenList.mockResolvedValue({ tokens: [], total: 0 });
      await ctx.loadList(true);
      expect(ctx.data.list).toEqual([]);
    });

    it('handles error', async () => {
      api.getTokenList.mockRejectedValue(new Error('fail'));
      await ctx.loadList(true);
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.loading).toBe(false);
    });

    it('sets hasMore correctly', async () => {
      api.getTokenList.mockResolvedValue({ tokens: new Array(20).fill({ id: 1, created_at: 'x' }), total: 40 });
      await ctx.loadList(true);
      expect(ctx.data.hasMore).toBe(true);
    });

    it('sets hasMore false when all loaded', async () => {
      api.getTokenList.mockResolvedValue({ tokens: [{ id: 1, created_at: 'x' }], total: 1 });
      await ctx.loadList(true);
      expect(ctx.data.hasMore).toBe(false);
    });

    it('formats used_by_user with id fallback', async () => {
      api.getTokenList.mockResolvedValue([{ id: 1, created_at: 'x', status: 'used', used_by_user: { id: 99 } }]);
      await ctx.loadList(true);
      expect(ctx.data.list[0].used_by_name).toContain('99');
    });

    it('hides expires_at for non-unused tokens', async () => {
      api.getTokenList.mockResolvedValue([{ id: 1, created_at: 'x', status: 'used', expires_at: '2026-04-10' }]);
      await ctx.loadList(true);
      expect(ctx.data.list[0].expires_at_text).toBe('');
    });
  });

  describe('form controls', () => {
    it('shows form', () => {
      ctx.onShowForm();
      expect(ctx.data.showForm).toBe(true);
      expect(ctx.data.formName).toBe('');
      expect(ctx.data.formPayment).toBe('');
      expect(ctx.data.formAmount).toBe('');
    });

    it('hides form', () => {
      ctx.data.showForm = true;
      ctx.onHideForm();
      expect(ctx.data.showForm).toBe(false);
    });

    it('updates form name', () => {
      ctx.onFormName({ detail: 'Test' });
      expect(ctx.data.formName).toBe('Test');
    });

    it('updates form amount', () => {
      ctx.onFormAmount({ detail: '50' });
      expect(ctx.data.formAmount).toBe('50');
    });
  });

  describe('payment picker', () => {
    it('shows picker', () => {
      ctx.onShowPaymentPicker();
      expect(ctx.data.showPaymentPicker).toBe(true);
    });

    it('hides picker', () => {
      ctx.onHidePaymentPicker();
      expect(ctx.data.showPaymentPicker).toBe(false);
    });

    it('confirms selection', () => {
      ctx.onPaymentConfirm({ detail: { value: '微信转账' } });
      expect(ctx.data.formPayment).toBe('微信转账');
      expect(ctx.data.showPaymentPicker).toBe(false);
    });
  });

  describe('onGenerate', () => {
    it('generates token with valid form', async () => {
      ctx.data.formName = 'TestUser';
      ctx.data.formPayment = '微信转账';
      ctx.data.formAmount = '50';
      api.generateToken.mockResolvedValue({});
      api.getTokenList.mockResolvedValue([]);
      await ctx.onGenerate();
      expect(api.generateToken).toHaveBeenCalledWith({
        name: 'TestUser',
        payment_method: '微信转账',
        amount: 50,
      });
      expect(ctx.data.showForm).toBe(false);
      expect(ctx.data.submitting).toBe(false);
    });

    it('requires name', async () => {
      ctx.data.formName = '';
      ctx.data.formPayment = '微信';
      ctx.data.formAmount = '50';
      await ctx.onGenerate();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'tokens_name_required' }));
      expect(api.generateToken).not.toHaveBeenCalled();
    });

    it('requires payment method', async () => {
      ctx.data.formName = 'Test';
      ctx.data.formPayment = '';
      ctx.data.formAmount = '50';
      await ctx.onGenerate();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'tokens_payment_required' }));
    });

    it('requires valid amount', async () => {
      ctx.data.formName = 'Test';
      ctx.data.formPayment = '微信';
      ctx.data.formAmount = '0';
      await ctx.onGenerate();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'tokens_amount_invalid' }));
    });

    it('requires amount > 0', async () => {
      ctx.data.formName = 'Test';
      ctx.data.formPayment = '微信';
      ctx.data.formAmount = '-5';
      await ctx.onGenerate();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'tokens_amount_invalid' }));
    });

    it('handles empty amount', async () => {
      ctx.data.formName = 'Test';
      ctx.data.formPayment = '微信';
      ctx.data.formAmount = '';
      await ctx.onGenerate();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'tokens_amount_invalid' }));
    });

    it('handles API error', async () => {
      ctx.data.formName = 'Test';
      ctx.data.formPayment = '微信';
      ctx.data.formAmount = '50';
      api.generateToken.mockRejectedValue(new Error('fail'));
      await ctx.onGenerate();
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.submitting).toBe(false);
    });
  });

  describe('onRevoke', () => {
    it('revokes after confirm', async () => {
      Dialog.confirm.mockResolvedValue();
      api.revokeToken.mockResolvedValue({});
      api.getTokenList.mockResolvedValue([]);
      ctx.onRevoke({ currentTarget: { dataset: { id: 5 } } });
      await new Promise((r) => setTimeout(r, 0));
      expect(api.revokeToken).toHaveBeenCalledWith(5);
    });

    it('does not revoke on cancel', async () => {
      Dialog.confirm.mockRejectedValue(new Error('cancel'));
      ctx.onRevoke({ currentTarget: { dataset: { id: 5 } } });
      await new Promise((r) => setTimeout(r, 0));
      expect(api.revokeToken).not.toHaveBeenCalled();
    });
  });

  describe('doRevoke', () => {
    it('revokes and reloads', async () => {
      api.revokeToken.mockResolvedValue({});
      api.getTokenList.mockResolvedValue([]);
      await ctx.doRevoke(5);
      expect(api.revokeToken).toHaveBeenCalledWith(5);
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
    });

    it('handles error', async () => {
      api.revokeToken.mockRejectedValue(new Error('fail'));
      await ctx.doRevoke(5);
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'tokens_op_failed' }));
    });
  });

  describe('onCopy', () => {
    it('copies code to clipboard', () => {
      wx.setClipboardData = jest.fn(({ success }) => success && success());
      ctx.onCopy({ currentTarget: { dataset: { code: 'ABC123' } } });
      expect(wx.setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: 'ABC123' }));
    });

    it('ignores if no code', () => {
      wx.setClipboardData = jest.fn();
      ctx.onCopy({ currentTarget: { dataset: {} } });
      expect(wx.setClipboardData).not.toHaveBeenCalled();
    });
  });

  describe('onPullDownRefresh', () => {
    it('reloads and stops', async () => {
      api.getTokenList.mockResolvedValue([]);
      const p = ctx.onPullDownRefresh();
      // Flush all microtasks (loadList is async, then .then chain)
      await new Promise((r) => setTimeout(r, 0));
      await p;
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });

  describe('onReachBottom', () => {
    it('loads more when hasMore', () => {
      ctx.data.hasMore = true;
      ctx.data.loading = false;
      api.getTokenList.mockResolvedValue([]);
      ctx.onReachBottom();
      expect(api.getTokenList).toHaveBeenCalled();
    });

    it('does not load when no more', () => {
      ctx.data.hasMore = false;
      api.getTokenList.mockClear();
      ctx.onReachBottom();
      expect(api.getTokenList).not.toHaveBeenCalled();
    });
  });
});
