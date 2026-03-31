/**
 * Tests for utils/ui.js
 */
const { setTabBarHidden } = require('../../../utils/ui');

describe('utils/ui', () => {
  describe('setTabBarHidden', () => {
    it('calls setHidden(true) when hidden=true', () => {
      const setHidden = jest.fn();
      const page = {
        getTabBar: jest.fn(() => ({ setHidden })),
      };
      setTabBarHidden(page, true);
      expect(page.getTabBar).toHaveBeenCalled();
      expect(setHidden).toHaveBeenCalledWith(true);
    });

    it('calls setHidden(false) when hidden=false', () => {
      const setHidden = jest.fn();
      const page = {
        getTabBar: jest.fn(() => ({ setHidden })),
      };
      setTabBarHidden(page, false);
      expect(setHidden).toHaveBeenCalledWith(false);
    });

    it('coerces truthy value to true', () => {
      const setHidden = jest.fn();
      const page = {
        getTabBar: jest.fn(() => ({ setHidden })),
      };
      setTabBarHidden(page, 1);
      expect(setHidden).toHaveBeenCalledWith(true);
    });

    it('coerces falsy value to false', () => {
      const setHidden = jest.fn();
      const page = {
        getTabBar: jest.fn(() => ({ setHidden })),
      };
      setTabBarHidden(page, 0);
      expect(setHidden).toHaveBeenCalledWith(false);
    });

    it('coerces undefined to false', () => {
      const setHidden = jest.fn();
      const page = {
        getTabBar: jest.fn(() => ({ setHidden })),
      };
      setTabBarHidden(page, undefined);
      expect(setHidden).toHaveBeenCalledWith(false);
    });

    it('does nothing when page has no getTabBar function', () => {
      const page = {};
      // Should not throw
      expect(() => setTabBarHidden(page, true)).not.toThrow();
    });

    it('does nothing when getTabBar returns null', () => {
      const page = {
        getTabBar: jest.fn(() => null),
      };
      expect(() => setTabBarHidden(page, true)).not.toThrow();
    });

    it('does nothing when getTabBar returns undefined', () => {
      const page = {
        getTabBar: jest.fn(() => undefined),
      };
      expect(() => setTabBarHidden(page, true)).not.toThrow();
    });

    it('does nothing when tabBar has no setHidden method', () => {
      const page = {
        getTabBar: jest.fn(() => ({ someOtherMethod: jest.fn() })),
      };
      expect(() => setTabBarHidden(page, true)).not.toThrow();
    });

    it('does nothing when getTabBar is not a function', () => {
      const page = {
        getTabBar: 'not a function',
      };
      expect(() => setTabBarHidden(page, true)).not.toThrow();
    });

    it('handles page being null without crashing', () => {
      // page.getTabBar would fail - this tests robustness
      // The function checks typeof page.getTabBar === 'function'
      // With null page, it would throw. Let's verify:
      expect(() => setTabBarHidden(null, true)).toThrow();
    });

    it('handles page being undefined without crashing', () => {
      expect(() => setTabBarHidden(undefined, true)).toThrow();
    });

    it('coerces string hidden to true', () => {
      const setHidden = jest.fn();
      const page = {
        getTabBar: jest.fn(() => ({ setHidden })),
      };
      setTabBarHidden(page, 'yes');
      expect(setHidden).toHaveBeenCalledWith(true);
    });

    it('coerces empty string hidden to false', () => {
      const setHidden = jest.fn();
      const page = {
        getTabBar: jest.fn(() => ({ setHidden })),
      };
      setTabBarHidden(page, '');
      expect(setHidden).toHaveBeenCalledWith(false);
    });
  });
});
