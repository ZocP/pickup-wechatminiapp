/**
 * Tests for utils/i18n.js
 */

describe('utils/i18n', () => {
  let i18n;

  beforeEach(() => {
    // Clear module cache to get fresh state each test
    jest.resetModules();
    i18n = require('../../../utils/i18n');
  });

  describe('getLocale', () => {
    it('returns zh-CN as default locale', () => {
      expect(i18n.getLocale()).toBe('zh-CN');
    });
  });

  describe('setLocale', () => {
    it('switches locale to en', () => {
      i18n.setLocale('en');
      expect(i18n.getLocale()).toBe('en');
    });

    it('switches locale back to zh-CN', () => {
      i18n.setLocale('en');
      i18n.setLocale('zh-CN');
      expect(i18n.getLocale()).toBe('zh-CN');
    });

    it('ignores invalid locale and keeps current', () => {
      i18n.setLocale('fr');
      expect(i18n.getLocale()).toBe('zh-CN');
    });

    it('ignores undefined locale', () => {
      i18n.setLocale(undefined);
      expect(i18n.getLocale()).toBe('zh-CN');
    });

    it('ignores null locale', () => {
      i18n.setLocale(null);
      expect(i18n.getLocale()).toBe('zh-CN');
    });

    it('ignores empty string locale', () => {
      i18n.setLocale('');
      expect(i18n.getLocale()).toBe('zh-CN');
    });

    it('ignores numeric locale', () => {
      i18n.setLocale(123);
      expect(i18n.getLocale()).toBe('zh-CN');
    });
  });

  describe('t (translate)', () => {
    it('returns Chinese translation for known key in default locale', () => {
      expect(i18n.t('app_title')).toBe('UIUC 接机调度');
    });

    it('returns English translation after switching to en', () => {
      i18n.setLocale('en');
      expect(i18n.t('app_title')).toBe('UIUC Pickup');
    });

    it('returns key itself for missing key (fallback)', () => {
      expect(i18n.t('nonexistent_key_xyz')).toBe('nonexistent_key_xyz');
    });

    it('returns empty string key as-is (falsy key fallback)', () => {
      // dict[''] is undefined, so returns '' (key itself)
      expect(i18n.t('')).toBe('');
    });

    it('returns undefined key as undefined (direct dict lookup)', () => {
      const result = i18n.t(undefined);
      // dict[undefined] is undefined, so falls back to key itself
      expect(result).toBe(undefined);
    });

    it('returns null key as null', () => {
      const result = i18n.t(null);
      expect(result).toBe(null);
    });

    it('translates status keys in zh-CN', () => {
      expect(i18n.t('status_pending')).toBe('待分配');
      expect(i18n.t('status_assigned')).toBe('已分配待发布');
      expect(i18n.t('status_published')).toBe('已发布');
    });

    it('translates status keys in en', () => {
      i18n.setLocale('en');
      expect(i18n.t('status_pending')).toBe('Pending');
      expect(i18n.t('status_assigned')).toBe('Assigned (Unpublished)');
      expect(i18n.t('status_published')).toBe('Published');
    });

    it('returns different values for same key in different locales', () => {
      const zhValue = i18n.t('tab_home');
      i18n.setLocale('en');
      const enValue = i18n.t('tab_home');
      expect(zhValue).toBe('首页');
      expect(enValue).toBe('Home');
      expect(zhValue).not.toBe(enValue);
    });

    it('handles many different keys without error', () => {
      const keys = [
        'login_btn', 'bind_submit', 'profile_logout',
        'dashboard_add_shift', 'driver_scan_btn',
      ];
      keys.forEach((key) => {
        expect(typeof i18n.t(key)).toBe('string');
        expect(i18n.t(key).length).toBeGreaterThan(0);
      });
    });
  });
});
