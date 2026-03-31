/**
 * Tests for pages/token/index.js
 */

jest.mock('../../../utils/api', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../../../utils/i18n', () => ({ t: (key) => key }));

describe('pages/token', () => {
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
    jest.useFakeTimers();
    global.Page = jest.fn();
    Object.keys(wx).forEach((k) => {
      if (typeof wx[k] === 'function' && wx[k].mockClear) wx[k].mockClear();
    });
    global.getApp = jest.fn(() => ({
      globalData: { userInfo: {} },
    }));
    wx.getStorageSync.mockReturnValue({});

    require('../../../pages/token/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../utils/api');
    ctx = makeCtx();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.code).toBe('');
      expect(pageConfig.data.loading).toBe(false);
      expect(pageConfig.data.errorMsg).toBe('');
    });
  });

  describe('onLoad', () => {
    it('sets nav title', () => {
      ctx.onLoad();
      expect(wx.setNavigationBarTitle).toHaveBeenCalledWith({ title: 'token_nav_title' });
    });
  });

  describe('onCodeInput', () => {
    it('updates code and clears error', () => {
      ctx.data.errorMsg = 'some error';
      ctx.onCodeInput({ detail: 'ABCD1234' });
      expect(ctx.data.code).toBe('ABCD1234');
      expect(ctx.data.errorMsg).toBe('');
    });

    it('trims whitespace', () => {
      ctx.onCodeInput({ detail: '  CODE123  ' });
      expect(ctx.data.code).toBe('CODE123');
    });

    it('handles empty input', () => {
      ctx.onCodeInput({ detail: '' });
      expect(ctx.data.code).toBe('');
    });
  });

  describe('onSubmit', () => {
    it('does not submit code shorter than 8 chars', async () => {
      ctx.data.code = '1234567';
      await ctx.onSubmit();
      expect(api.verifyToken).not.toHaveBeenCalled();
    });

    it('verifies code and redirects on success', async () => {
      ctx.data.code = 'ABCD12345678';
      api.verifyToken.mockResolvedValue({});
      await ctx.onSubmit();
      expect(api.verifyToken).toHaveBeenCalledWith('ABCD12345678');
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
      expect(ctx.data.loading).toBe(false);
      // After timeout, reLaunch
      jest.advanceTimersByTime(800);
      expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/home/index' });
    });

    it('updates userInfo token_verified on success', async () => {
      ctx.data.code = 'ABCD12345678';
      api.verifyToken.mockResolvedValue({});
      wx.getStorageSync.mockReturnValue({ name: 'Test' });
      await ctx.onSubmit();
      expect(wx.setStorageSync).toHaveBeenCalledWith('userInfo', expect.objectContaining({ token_verified: true }));
    });

    it('prevents double submit', async () => {
      ctx.data.code = 'ABCD12345678';
      ctx.data.loading = true;
      await ctx.onSubmit();
      expect(api.verifyToken).not.toHaveBeenCalled();
    });

    it('handles token_not_found error', async () => {
      ctx.data.code = 'ABCD12345678';
      api.verifyToken.mockRejectedValue({ data: { error: 'token_not_found' } });
      await ctx.onSubmit();
      expect(ctx.data.errorMsg).toBe('token_err_not_found');
      expect(ctx.data.loading).toBe(false);
    });

    it('handles token_already_used error', async () => {
      ctx.data.code = 'ABCD12345678';
      api.verifyToken.mockRejectedValue({ data: { error: 'token_already_used' } });
      await ctx.onSubmit();
      expect(ctx.data.errorMsg).toBe('token_err_used');
    });

    it('handles token_expired error', async () => {
      ctx.data.code = 'ABCD12345678';
      api.verifyToken.mockRejectedValue({ data: { error: 'token_expired' } });
      await ctx.onSubmit();
      expect(ctx.data.errorMsg).toBe('token_err_expired');
    });

    it('handles token_revoked error', async () => {
      ctx.data.code = 'ABCD12345678';
      api.verifyToken.mockRejectedValue({ data: { error: 'token_revoked' } });
      await ctx.onSubmit();
      expect(ctx.data.errorMsg).toBe('token_err_revoked');
    });

    it('handles invalid_code error', async () => {
      ctx.data.code = 'ABCD12345678';
      api.verifyToken.mockRejectedValue({ data: { error: 'invalid_code' } });
      await ctx.onSubmit();
      expect(ctx.data.errorMsg).toBe('token_err_not_found');
    });

    it('handles unknown server error', async () => {
      ctx.data.code = 'ABCD12345678';
      api.verifyToken.mockRejectedValue({ data: { error: 'some_new_error' } });
      await ctx.onSubmit();
      expect(ctx.data.errorMsg).toBe('some_new_error');
    });

    it('handles error with message field', async () => {
      ctx.data.code = 'ABCD12345678';
      api.verifyToken.mockRejectedValue({ data: { message: 'custom msg' } });
      await ctx.onSubmit();
      expect(ctx.data.errorMsg).toBe('custom msg');
    });

    it('handles error with no data', async () => {
      ctx.data.code = 'ABCD12345678';
      api.verifyToken.mockRejectedValue(new Error('network'));
      await ctx.onSubmit();
      expect(ctx.data.errorMsg).toBe('token_verify_failed');
    });
  });

  describe('onUnload', () => {
    it('exists without error', () => {
      expect(() => ctx.onUnload()).not.toThrow();
    });
  });
});
