/**
 * Tests for pages/bind/index.js
 */

jest.mock('../../../utils/api', () => ({
  bindProfile: jest.fn(),
  getAuthMe: jest.fn(),
}));

jest.mock('../../../utils/i18n', () => ({ t: (key) => key }));

describe('pages/bind', () => {
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
      isWechatBound: jest.fn(() => false),
      toLogin: jest.fn(),
      getEffectiveRole: jest.fn(() => 'student'),
      setUserInfo: jest.fn(),
      onTokenExpired: jest.fn(),
    }));
    wx.getStorageSync.mockReturnValue('mock_token');

    require('../../../pages/bind/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../utils/api');
    ctx = makeCtx();
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.loading).toBe(false);
      expect(pageConfig.data.verifying).toBe(false);
      expect(pageConfig.data.name).toBe('');
      expect(pageConfig.data.wechatID).toBe('');
    });
  });

  describe('onLoad', () => {
    it('sets i18n and nav title', () => {
      ctx.onLoad();
      expect(ctx.data.i18n.bind_title).toBe('bind_title');
      expect(wx.setNavigationBarTitle).toHaveBeenCalled();
    });
  });

  describe('onShow', () => {
    it('redirects to login when no token', async () => {
      wx.getStorageSync.mockReturnValue('');
      const mockApp = { ...getApp(), toLogin: jest.fn(), isWechatBound: jest.fn(() => false) };
      global.getApp = jest.fn(() => mockApp);
      await ctx.onShow();
      expect(mockApp.toLogin).toHaveBeenCalled();
    });

    it('verifies and redirects when already bound', async () => {
      const mockApp = {
        isWechatBound: jest.fn(() => true),
        toLogin: jest.fn(),
        getEffectiveRole: jest.fn(() => 'admin'),
        setUserInfo: jest.fn(),
      };
      global.getApp = jest.fn(() => mockApp);
      api.getAuthMe.mockResolvedValue({ wechat_id: 'wx123', role: 'admin' });
      await ctx.onShow();
      expect(ctx.data.verifying).toBe(false);
      expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/admin/dashboard/index' });
    });

    it('does nothing when not bound', async () => {
      await ctx.onShow();
      expect(api.getAuthMe).not.toHaveBeenCalled();
    });

    it('handles getAuthMe error gracefully', async () => {
      const mockApp = {
        isWechatBound: jest.fn(() => true),
        toLogin: jest.fn(),
        setUserInfo: jest.fn(),
      };
      global.getApp = jest.fn(() => mockApp);
      api.getAuthMe.mockRejectedValue(new Error('fail'));
      await ctx.onShow();
      expect(ctx.data.verifying).toBe(false);
    });

    it('stays on page if fresh wechat_id is empty', async () => {
      const mockApp = {
        isWechatBound: jest.fn(() => true),
        toLogin: jest.fn(),
        setUserInfo: jest.fn(),
      };
      global.getApp = jest.fn(() => mockApp);
      api.getAuthMe.mockResolvedValue({ wechat_id: '' });
      await ctx.onShow();
      expect(wx.switchTab).not.toHaveBeenCalled();
    });
  });

  describe('input handlers', () => {
    it('updates name', () => {
      ctx.onNameChange({ detail: 'Alice' });
      expect(ctx.data.name).toBe('Alice');
    });

    it('updates wechatID', () => {
      ctx.onWechatIDChange({ detail: 'alice_wx123' });
      expect(ctx.data.wechatID).toBe('alice_wx123');
    });

    it('handles null detail', () => {
      ctx.onNameChange({});
      expect(ctx.data.name).toBe('');
    });
  });

  describe('onBindWechatID', () => {
    it('binds successfully and navigates', async () => {
      ctx.data.name = 'Alice';
      ctx.data.wechatID = 'alice_wx_123456';
      api.bindProfile.mockResolvedValue({});
      api.getAuthMe.mockResolvedValue({ role: 'student', wechat_id: 'alice_wx_123456' });
      global.getApp = jest.fn(() => ({
        setUserInfo: jest.fn(),
        getEffectiveRole: jest.fn(() => 'student'),
      }));
      await ctx.onBindWechatID();
      expect(api.bindProfile).toHaveBeenCalledWith({ name: 'Alice', wechat_id: 'alice_wx_123456' });
      expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });
      expect(ctx.data.loading).toBe(false);
    });

    it('shows error when name empty', async () => {
      ctx.data.name = '';
      ctx.data.wechatID = 'alice_wx_123456';
      await ctx.onBindWechatID();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'bind_name_required' }));
      expect(api.bindProfile).not.toHaveBeenCalled();
    });

    it('shows error when wechatID invalid format', async () => {
      ctx.data.name = 'Alice';
      ctx.data.wechatID = 'bad'; // too short
      await ctx.onBindWechatID();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'bind_wechat_invalid' }));
    });

    it('rejects wechatID with special chars', async () => {
      ctx.data.name = 'Alice';
      ctx.data.wechatID = 'alice@wx!123';
      await ctx.onBindWechatID();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'bind_wechat_invalid' }));
    });

    it('rejects wechatID too long (>20 chars)', async () => {
      ctx.data.name = 'Alice';
      ctx.data.wechatID = 'a'.repeat(21);
      await ctx.onBindWechatID();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'bind_wechat_invalid' }));
    });

    it('prevents double submit', async () => {
      ctx.data.loading = true;
      await ctx.onBindWechatID();
      expect(api.bindProfile).not.toHaveBeenCalled();
    });

    it('handles API error', async () => {
      ctx.data.name = 'Alice';
      ctx.data.wechatID = 'alice_wx_123456';
      api.bindProfile.mockRejectedValue({ message: 'already bound' });
      await ctx.onBindWechatID();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'already bound' }));
      expect(ctx.data.loading).toBe(false);
    });

    it('navigates admin to dashboard', async () => {
      ctx.data.name = 'Admin';
      ctx.data.wechatID = 'admin_wx_12345';
      api.bindProfile.mockResolvedValue({});
      api.getAuthMe.mockResolvedValue({ role: 'admin', wechat_id: 'admin_wx_12345' });
      global.getApp = jest.fn(() => ({
        setUserInfo: jest.fn(),
        getEffectiveRole: jest.fn(() => 'admin'),
      }));
      await ctx.onBindWechatID();
      expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/admin/dashboard/index' });
    });
  });

  describe('goNext', () => {
    it('navigates student to home', () => {
      global.getApp = jest.fn(() => ({ getEffectiveRole: jest.fn(() => 'student') }));
      ctx.goNext();
      expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });
    });

    it('navigates staff to dashboard', () => {
      global.getApp = jest.fn(() => ({ getEffectiveRole: jest.fn(() => 'staff') }));
      ctx.goNext();
      expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/admin/dashboard/index' });
    });
  });

  describe('logout', () => {
    it('calls onTokenExpired', () => {
      const mockApp = { onTokenExpired: jest.fn() };
      global.getApp = jest.fn(() => mockApp);
      ctx.logout();
      expect(mockApp.onTokenExpired).toHaveBeenCalled();
    });
  });
});
