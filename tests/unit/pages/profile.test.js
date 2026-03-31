/**
 * Tests for pages/profile/index.js
 */

jest.mock('../../../utils/i18n', () => ({
  t: (key) => key,
  getLocale: jest.fn(() => 'zh-CN'),
  setLocale: jest.fn(),
}));
jest.mock('../../../utils/ui', () => ({
  setTabBarHidden: jest.fn(),
}));

describe('pages/profile', () => {
  let pageConfig;
  let i18n;
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
      getEffectiveRole: jest.fn(() => 'admin'),
      getViewAsRole: jest.fn(() => ''),
      setViewAsRole: jest.fn(),
      updateTabBar: jest.fn(),
      globalData: { userInfo: { name: 'TestUser', role: 'admin' } },
    }));
    wx.getStorageSync.mockReturnValue('');

    require('../../../pages/profile/index');
    pageConfig = global.Page.mock.calls[0][0];
    i18n = require('../../../utils/i18n');
    ctx = makeCtx();
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.showRolePicker).toBe(false);
      expect(pageConfig.data.isAdminReal).toBe(false);
      expect(pageConfig.data.currentEffectiveRole).toBe('student');
    });
  });

  describe('onLoad', () => {
    it('sets i18n, langLabel, and roleOptions', () => {
      ctx.onLoad();
      expect(ctx.data.langLabel).toBe('EN');
      expect(ctx.data.roleOptions).toHaveLength(4);
      expect(ctx.data.i18n.profile_role_label).toBe('profile_role_label');
    });
  });

  describe('switchLang', () => {
    it('switches to en when currently zh-CN', () => {
      i18n.getLocale.mockReturnValue('zh-CN');
      ctx.switchLang();
      expect(i18n.setLocale).toHaveBeenCalledWith('en');
      expect(wx.setStorageSync).toHaveBeenCalledWith('locale', 'en');
      expect(ctx.data.langLabel).toBe('中');
    });

    it('switches to zh-CN when currently en', () => {
      i18n.getLocale.mockReturnValue('en');
      ctx.switchLang();
      expect(i18n.setLocale).toHaveBeenCalledWith('zh-CN');
      expect(ctx.data.langLabel).toBe('EN');
    });
  });

  describe('onShow', () => {
    it('sets user info and role flags for admin', () => {
      ctx.onShow();
      expect(ctx.data.isAdminReal).toBe(true);
      expect(ctx.data.currentEffectiveRole).toBe('admin');
    });

    it('returns if not bound', () => {
      global.getApp = jest.fn(() => ({
        ensureWechatBound: jest.fn(() => false),
      }));
      ctx.onShow();
      expect(ctx.data.isAdminReal).toBe(false);
    });

    it('handles student role', () => {
      global.getApp = jest.fn(() => ({
        ensureWechatBound: jest.fn(() => true),
        getEffectiveRole: jest.fn(() => 'student'),
        getViewAsRole: jest.fn(() => ''),
        globalData: { userInfo: { role: 'student' } },
      }));
      ctx.onShow();
      expect(ctx.data.isAdminReal).toBe(false);
    });

    it('uses wx storage as fallback for userInfo', () => {
      global.getApp = jest.fn(() => ({
        ensureWechatBound: jest.fn(() => true),
        getEffectiveRole: jest.fn(() => 'student'),
        getViewAsRole: jest.fn(() => ''),
        globalData: { userInfo: null },
      }));
      wx.getStorageSync.mockReturnValue({ role: 'student', name: 'Stored' });
      ctx.onShow();
      expect(ctx.data.userInfo.name).toBe('Stored');
    });
  });

  describe('goStudentRequest', () => {
    it('navigates', () => {
      ctx.goStudentRequest();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/student/request/index' });
    });
  });

  describe('openRolePicker / closeRolePicker', () => {
    it('opens for admin', () => {
      ctx.data.isAdminReal = true;
      ctx.openRolePicker();
      expect(ctx.data.showRolePicker).toBe(true);
    });

    it('does not open for non-admin', () => {
      ctx.data.isAdminReal = false;
      ctx.openRolePicker();
      expect(ctx.data.showRolePicker).toBe(false);
    });

    it('closes', () => {
      ctx.data.showRolePicker = true;
      ctx.closeRolePicker();
      expect(ctx.data.showRolePicker).toBe(false);
    });
  });

  describe('onSelectRole', () => {
    let mockApp;

    beforeEach(() => {
      ctx.data.isAdminReal = true;
      ctx.data.roleOptions = [
        { name: 'Admin', value: 'admin' },
        { name: 'Staff', value: 'staff' },
        { name: 'Driver', value: 'driver' },
        { name: 'Student', value: 'student' },
      ];
      mockApp = {
        setViewAsRole: jest.fn(),
        getEffectiveRole: jest.fn(() => 'staff'),
        getViewAsRole: jest.fn(() => 'staff'),
      };
      global.getApp = jest.fn(() => mockApp);
    });

    it('selects role by index', () => {
      ctx.onSelectRole({ detail: { index: 1 } });
      expect(mockApp.setViewAsRole).toHaveBeenCalledWith('staff');
      expect(ctx.data.showRolePicker).toBe(false);
      expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });
    });

    it('selects role by name', () => {
      ctx.onSelectRole({ detail: { name: 'Driver' } });
      expect(mockApp.setViewAsRole).toHaveBeenCalledWith('driver');
    });

    it('ignores if not admin', () => {
      ctx.data.isAdminReal = false;
      ctx.onSelectRole({ detail: { index: 0 } });
      expect(mockApp.setViewAsRole).not.toHaveBeenCalled();
    });

    it('ignores invalid selection', () => {
      ctx.onSelectRole({ detail: { index: 99 } });
      expect(mockApp.setViewAsRole).not.toHaveBeenCalled();
    });

    it('ignores empty detail', () => {
      ctx.onSelectRole({});
      expect(mockApp.setViewAsRole).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('shows confirm dialog and logs out on confirm', () => {
      wx.showModal.mockImplementation(({ success }) => {
        success({ confirm: true });
      });
      const mockApp = { onTokenExpired: jest.fn() };
      global.getApp = jest.fn(() => mockApp);
      ctx.logout();
      expect(mockApp.onTokenExpired).toHaveBeenCalled();
    });

    it('does not log out on cancel', () => {
      wx.showModal.mockImplementation(({ success }) => {
        success({ confirm: false });
      });
      const mockApp = { onTokenExpired: jest.fn() };
      global.getApp = jest.fn(() => mockApp);
      ctx.logout();
      expect(mockApp.onTokenExpired).not.toHaveBeenCalled();
    });
  });

  describe('onPullDownRefresh', () => {
    it('refreshes and stops', () => {
      ctx.onPullDownRefresh();
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });
});
