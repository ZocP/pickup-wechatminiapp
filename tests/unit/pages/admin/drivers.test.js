/**
 * Tests for pages/admin/drivers/index.js
 */

jest.mock('../../../../utils/api', () => ({
  getDrivers: jest.fn(),
  createDriver: jest.fn(),
}));

jest.mock('../../../../utils/i18n', () => ({ t: (key) => key }));

describe('pages/admin/drivers', () => {
  let pageConfig;
  let api;
  let ctx;

  function makeCtx(overrides) {
    return {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(updates) {
        Object.keys(updates).forEach((key) => {
          const dotMatch = key.match(/^([^.]+)\.(.+)$/);
          if (dotMatch) {
            if (this.data[dotMatch[1]] && typeof this.data[dotMatch[1]] === 'object') {
              this.data[dotMatch[1]][dotMatch[2]] = updates[key];
            }
          } else {
            this.data[key] = updates[key];
          }
        });
      },
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
      isWechatBound: jest.fn(() => true),
    }));

    require('../../../../pages/admin/drivers/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../../utils/api');
    ctx = makeCtx();
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.loading).toBe(false);
      expect(pageConfig.data.submitting).toBe(false);
      expect(pageConfig.data.driverList).toEqual([]);
      expect(pageConfig.data.showAddPopup).toBe(false);
      expect(pageConfig.data.form).toEqual({
        name: '', car_model: '', max_seats: 6, max_checked: 4, max_carry_on: 2,
      });
    });
  });

  describe('onLoad', () => {
    it('sets nav bar title', () => {
      ctx.onLoad();
      expect(wx.setNavigationBarTitle).toHaveBeenCalled();
    });
  });

  describe('onShow', () => {
    it('loads drivers when bound', async () => {
      api.getDrivers.mockResolvedValue([]);
      await ctx.onShow();
      expect(api.getDrivers).toHaveBeenCalled();
    });

    it('redirects to bind page when not bound', () => {
      global.getApp = jest.fn(() => ({
        isWechatBound: jest.fn(() => false),
      }));
      ctx.onShow();
      expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/bind/index' });
    });
  });

  describe('onPullDownRefresh', () => {
    it('reloads and stops', async () => {
      api.getDrivers.mockResolvedValue([]);
      await ctx.onPullDownRefresh();
      expect(wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });

  describe('loadDrivers', () => {
    it('loads driver list', async () => {
      api.getDrivers.mockResolvedValue([
        { id: 1, name: 'DriverA', car_model: 'Toyota' },
        { id: 2, name: 'DriverB', car_model: 'Honda' },
      ]);
      await ctx.loadDrivers();
      expect(ctx.data.driverList).toHaveLength(2);
      expect(ctx.data.loading).toBe(false);
    });

    it('handles non-array response', async () => {
      api.getDrivers.mockResolvedValue(null);
      await ctx.loadDrivers();
      expect(ctx.data.driverList).toEqual([]);
    });

    it('handles error', async () => {
      api.getDrivers.mockRejectedValue(new Error('fail'));
      await ctx.loadDrivers();
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.loading).toBe(false);
    });
  });

  describe('goToDriverDetail', () => {
    it('navigates with driver id', () => {
      ctx.goToDriverDetail({ currentTarget: { dataset: { id: 5 } } });
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/admin/driver-detail/index?id=5' });
    });
  });

  describe('popup controls', () => {
    it('shows add popup', () => {
      ctx.onShowAddDriver();
      expect(ctx.data.showAddPopup).toBe(true);
    });

    it('closes add popup', () => {
      ctx.data.showAddPopup = true;
      ctx.onCloseAddDriver();
      expect(ctx.data.showAddPopup).toBe(false);
    });
  });

  describe('form field changes', () => {
    it('updates field by name', () => {
      ctx.onFieldChange({ currentTarget: { dataset: { field: 'name' } }, detail: 'NewDriver' });
      expect(ctx.data.form.name).toBe('NewDriver');
    });

    it('updates car_model', () => {
      ctx.onFieldChange({ currentTarget: { dataset: { field: 'car_model' } }, detail: 'Tesla' });
      expect(ctx.data.form.car_model).toBe('Tesla');
    });

    it('updates max_seats via stepper', () => {
      ctx.onSeatsChange({ detail: 8 });
      expect(ctx.data.form.max_seats).toBe(8);
    });

    it('updates max_checked via stepper', () => {
      ctx.onCheckedChange({ detail: 5 });
      expect(ctx.data.form.max_checked).toBe(5);
    });

    it('updates max_carry_on via stepper', () => {
      ctx.onCarryOnChange({ detail: 3 });
      expect(ctx.data.form.max_carry_on).toBe(3);
    });
  });

  describe('resetForm', () => {
    it('resets to defaults', () => {
      ctx.data.form = { name: 'Test', car_model: 'BMW', max_seats: 10, max_checked: 10, max_carry_on: 10 };
      ctx.resetForm();
      expect(ctx.data.form).toEqual({
        name: '', car_model: '', max_seats: 6, max_checked: 4, max_carry_on: 2,
      });
    });
  });

  describe('onSubmitDriver', () => {
    it('creates driver on valid form', async () => {
      ctx.data.form = { name: 'DriverA', car_model: 'Toyota', max_seats: 6, max_checked: 4, max_carry_on: 2 };
      api.createDriver.mockResolvedValue({});
      api.getDrivers.mockResolvedValue([]);
      await ctx.onSubmitDriver();
      expect(api.createDriver).toHaveBeenCalledWith(expect.objectContaining({ name: 'DriverA' }));
      expect(ctx.data.showAddPopup).toBe(false);
      expect(ctx.data.submitting).toBe(false);
    });

    it('shows error when name missing', async () => {
      ctx.data.form = { name: '', car_model: 'Toyota', max_seats: 6, max_checked: 4, max_carry_on: 2 };
      await ctx.onSubmitDriver();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'drivers_form_incomplete' }));
      expect(api.createDriver).not.toHaveBeenCalled();
    });

    it('shows error when car_model missing', async () => {
      ctx.data.form = { name: 'DriverA', car_model: '', max_seats: 6, max_checked: 4, max_carry_on: 2 };
      await ctx.onSubmitDriver();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'drivers_form_incomplete' }));
    });

    it('prevents double submit', async () => {
      ctx.data.submitting = true;
      await ctx.onSubmitDriver();
      expect(api.createDriver).not.toHaveBeenCalled();
    });

    it('handles API error', async () => {
      ctx.data.form = { name: 'DriverA', car_model: 'Toyota', max_seats: 6, max_checked: 4, max_carry_on: 2 };
      api.createDriver.mockRejectedValue(new Error('duplicate'));
      await ctx.onSubmitDriver();
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.submitting).toBe(false);
    });

    it('shows error message from error object', async () => {
      ctx.data.form = { name: 'DriverA', car_model: 'Toyota', max_seats: 6, max_checked: 4, max_carry_on: 2 };
      api.createDriver.mockRejectedValue({ message: 'Custom error' });
      await ctx.onSubmitDriver();
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Custom error' }));
    });
  });
});
