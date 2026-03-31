/**
 * Tests for pages/login/index.js
 */

jest.mock('../../../utils/api', () => ({
  authLogin: jest.fn(),
  getAuthMe: jest.fn(),
}));

jest.mock('../../../utils/i18n', () => ({ t: (key) => key }));

describe('pages/login', () => {
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
    global.getApp = jest.fn(() => ({
      setUserInfo: jest.fn(),
      resetViewAsRole: jest.fn(),
    }));
    wx.getStorageSync.mockReturnValue('');
    wx.getAccountInfoSync = jest.fn(() => ({
      miniProgram: { appId: 'wx12345' },
    }));

    require('../../../pages/login/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../utils/api');
    ctx = makeCtx();
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.loading).toBe(false);
    });
  });

  describe('onLoad', () => {
    it('sets i18n and nav title', () => {
      ctx.onLoad();
      expect(ctx.data.i18n.login_title).toBe('login_title');
      expect(wx.setNavigationBarTitle).toHaveBeenCalled();
    });
  });

  describe('onPullDownRefresh', () => {
    it('stops pull down refresh', () => {
      ctx.onPullDownRefresh();
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });

  describe('getRuntimeAppId', () => {
    it('returns appId', () => {
      expect(ctx.getRuntimeAppId()).toBe('wx12345');
    });

    it('returns empty on error', () => {
      wx.getAccountInfoSync = jest.fn(() => { throw new Error('fail'); });
      expect(ctx.getRuntimeAppId()).toBe('');
    });

    it('returns empty when no miniProgram', () => {
      wx.getAccountInfoSync = jest.fn(() => ({}));
      expect(ctx.getRuntimeAppId()).toBe('');
    });
  });

  describe('wxLogin', () => {
    it('resolves with code', async () => {
      wx.login.mockImplementation(({ success }) => {
        success({ code: 'test_code' });
      });
      const res = await ctx.wxLogin();
      expect(res.code).toBe('test_code');
    });

    it('rejects when no code', async () => {
      wx.login.mockImplementation(({ success }) => {
        success({});
      });
      await expect(ctx.wxLogin()).rejects.toThrow();
    });

    it('rejects on fail', async () => {
      wx.login.mockImplementation(({ fail }) => {
        fail({ errMsg: 'wx.login failed' });
      });
      await expect(ctx.wxLogin()).rejects.toThrow('wx.login failed');
    });
  });

  describe('loginOnce', () => {
    beforeEach(() => {
      wx.login.mockImplementation(({ success }) => {
        success({ code: 'test_code' });
      });
    });

    it('calls authLogin with code', async () => {
      api.authLogin.mockResolvedValue({ token: 'tok', user: { role: 'admin' } });
      const result = await ctx.loginOnce();
      expect(api.authLogin).toHaveBeenCalledWith('test_code');
      expect(result.token).toBe('tok');
    });

    it('wraps backend error', async () => {
      api.authLogin.mockRejectedValue(new Error('bad request'));
      await expect(ctx.loginOnce()).rejects.toThrow('后端 auth/login 失败');
    });
  });

  describe('doWechatLogin', () => {
    const mockApp = {
      setUserInfo: jest.fn(),
      resetViewAsRole: jest.fn(),
    };

    beforeEach(() => {
      global.getApp = jest.fn(() => mockApp);
      wx.login.mockImplementation(({ success }) => {
        success({ code: 'test_code' });
      });
    });

    it('successful login as admin redirects to dashboard', async () => {
      api.authLogin.mockResolvedValue({ token: 'tok', refresh_token: 'rtok', user: { role: 'admin', wechat_id: 'wx123' } });
      api.getAuthMe.mockResolvedValue({ role: 'admin', wechat_id: 'wx123' });
      await ctx.doWechatLogin();
      expect(wx.setStorageSync).toHaveBeenCalledWith('token', 'tok');
      expect(wx.setStorageSync).toHaveBeenCalledWith('refresh_token', 'rtok');
      expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/admin/dashboard/index' });
      expect(ctx.data.loading).toBe(false);
    });

    it('successful login as student redirects to home', async () => {
      api.authLogin.mockResolvedValue({ token: 'tok', user: { role: 'student', wechat_id: 'wx123', token_verified: true } });
      api.getAuthMe.mockResolvedValue({ role: 'student', wechat_id: 'wx123', token_verified: true });
      await ctx.doWechatLogin();
      expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });
    });

    it('redirects to bind page when no wechat_id', async () => {
      api.authLogin.mockResolvedValue({ token: 'tok', user: { role: 'student' } });
      api.getAuthMe.mockResolvedValue({ role: 'student' });
      await ctx.doWechatLogin();
      expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/bind/index' });
    });

    it('redirects to token page when token not verified', async () => {
      api.authLogin.mockResolvedValue({ token: 'tok', user: { role: 'student', wechat_id: 'wx123', token_verified: false } });
      api.getAuthMe.mockResolvedValue({ role: 'student', wechat_id: 'wx123', token_verified: false });
      await ctx.doWechatLogin();
      expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/token/index' });
    });

    it('prevents double login', async () => {
      ctx.data.loading = true;
      await ctx.doWechatLogin();
      expect(api.authLogin).not.toHaveBeenCalled();
    });

    it('handles no token in response', async () => {
      api.authLogin.mockResolvedValue({});
      await ctx.doWechatLogin();
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.loading).toBe(false);
    });

    it('shows special modal for 40013 appid error from backend', async () => {
      const err = new Error('invalid appid 40013');
      err.origin = 'backend-auth';
      err.baseURL = 'http://localhost:9090';
      wx.login.mockImplementation(({ success }) => success({ code: 'c' }));
      api.authLogin.mockRejectedValue(err);
      // loginOnce wraps, but doWechatLogin calls loginOnce
      // Need to mock the full path
      jest.resetModules();
      global.Page = jest.fn();
      require('../../../pages/login/index');
      const pc2 = global.Page.mock.calls[0][0];
      const ctx2 = {
        ...pc2,
        data: JSON.parse(JSON.stringify(pc2.data)),
        setData(u) { Object.assign(this.data, u); },
      };
      // Mock loginOnce to throw with origin
      ctx2.loginOnce = jest.fn().mockRejectedValue(err);
      await ctx2.doWechatLogin();
      expect(wx.showModal).toHaveBeenCalled();
    });

    it('shows generic error on login failure', async () => {
      api.authLogin.mockRejectedValue(new Error('network error'));
      await ctx.doWechatLogin();
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.loading).toBe(false);
    });

    it('staff redirects to dashboard', async () => {
      api.authLogin.mockResolvedValue({ token: 'tok', user: { role: 'staff', wechat_id: 'wx123' } });
      api.getAuthMe.mockResolvedValue({ role: 'staff', wechat_id: 'wx123' });
      await ctx.doWechatLogin();
      expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/admin/dashboard/index' });
    });
  });

  describe('onLogin', () => {
    it('calls doWechatLogin', async () => {
      api.authLogin.mockResolvedValue({ token: 'tok', user: { role: 'admin', wechat_id: 'wx' } });
      api.getAuthMe.mockResolvedValue({ role: 'admin', wechat_id: 'wx' });
      wx.login.mockImplementation(({ success }) => success({ code: 'c' }));
      await ctx.onLogin();
      expect(api.authLogin).toHaveBeenCalled();
    });
  });
});
