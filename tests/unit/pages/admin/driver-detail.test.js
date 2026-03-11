/**
 * Tests for pages/admin/driver-detail/index.js
 */

jest.mock('../../../../utils/api', () => ({
  getDriver: jest.fn(),
  updateDriver: jest.fn(),
  deleteDriver: jest.fn(),
}));

jest.mock('../../../../utils/i18n', () => ({ t: (key) => key }));
jest.mock('../../../../miniprogram_npm/@vant/weapp/dialog/dialog', () => ({
  default: { confirm: jest.fn() },
}));

describe('pages/admin/driver-detail', () => {
  let pageConfig;
  let api;
  let Dialog;
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

    require('../../../../pages/admin/driver-detail/index');
    pageConfig = global.Page.mock.calls[0][0];
    api = require('../../../../utils/api');
    Dialog = require('../../../../miniprogram_npm/@vant/weapp/dialog/dialog').default;
    ctx = makeCtx();
  });

  describe('initial data', () => {
    it('has correct defaults', () => {
      expect(pageConfig.data.loading).toBe(true);
      expect(pageConfig.data.editing).toBe(false);
      expect(pageConfig.data.saving).toBe(false);
      expect(pageConfig.data.deleting).toBe(false);
      expect(pageConfig.data.driverId).toBeNull();
      expect(pageConfig.data.driver).toEqual({});
      expect(pageConfig.data.form).toEqual({});
    });
  });

  describe('onLoad', () => {
    it('sets driverId and loads driver', async () => {
      api.getDriver.mockResolvedValue({ id: 5, name: 'Test', shifts: [] });
      await ctx.onLoad({ id: '5' });
      expect(ctx.data.driverId).toBe('5');
      expect(api.getDriver).toHaveBeenCalledWith('5');
    });
  });

  describe('loadDriver', () => {
    it('loads driver data', async () => {
      ctx.data.driverId = '5';
      api.getDriver.mockResolvedValue({
        id: 5, name: 'DriverA', car_model: 'Toyota', shifts: [],
      });
      await ctx.loadDriver();
      expect(ctx.data.driver.name).toBe('DriverA');
      expect(ctx.data.loading).toBe(false);
    });

    it('formats shift times', async () => {
      ctx.data.driverId = '5';
      api.getDriver.mockResolvedValue({
        id: 5, name: 'DriverA', shifts: [
          { id: 1, departure_time: '2026-03-10T14:30:00Z' },
        ],
      });
      await ctx.loadDriver();
      expect(ctx.data.driver.shifts[0].departure_time_fmt).toBeDefined();
      expect(ctx.data.driver.shifts[0].departure_time_fmt).not.toBe('--');
    });

    it('handles driver with no shifts', async () => {
      ctx.data.driverId = '5';
      api.getDriver.mockResolvedValue({ id: 5, name: 'DriverA' });
      await ctx.loadDriver();
      expect(ctx.data.driver.name).toBe('DriverA');
    });

    it('handles error', async () => {
      ctx.data.driverId = '5';
      api.getDriver.mockRejectedValue(new Error('not found'));
      await ctx.loadDriver();
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.loading).toBe(false);
    });
  });

  describe('formatTime', () => {
    it('returns formatted time for valid ISO', async () => {
      ctx.data.driverId = '1';
      api.getDriver.mockResolvedValue({
        shifts: [{ departure_time: '2026-01-15T09:05:00Z' }],
      });
      await ctx.loadDriver();
      const fmt = ctx.data.driver.shifts[0].departure_time_fmt;
      // Should be formatted, not '--'
      expect(fmt).not.toBe('--');
    });

    it('returns -- for null', async () => {
      ctx.data.driverId = '1';
      api.getDriver.mockResolvedValue({
        shifts: [{ departure_time: null }],
      });
      await ctx.loadDriver();
      expect(ctx.data.driver.shifts[0].departure_time_fmt).toBe('--');
    });
  });

  describe('toggleEdit', () => {
    it('enters edit mode with form populated', () => {
      ctx.data.driver = { name: 'A', car_model: 'B', car_plate: 'C', car_color: 'D', max_seats: 6, max_checked: 4, max_carry_on: 2 };
      ctx.toggleEdit();
      expect(ctx.data.editing).toBe(true);
      expect(ctx.data.form.name).toBe('A');
      expect(ctx.data.form.car_model).toBe('B');
    });

    it('exits edit mode', () => {
      ctx.data.editing = true;
      ctx.toggleEdit();
      expect(ctx.data.editing).toBe(false);
    });

    it('defaults missing fields', () => {
      ctx.data.driver = {};
      ctx.toggleEdit();
      expect(ctx.data.form.name).toBe('');
      expect(ctx.data.form.max_seats).toBe(1);
    });
  });

  describe('form changes', () => {
    beforeEach(() => {
      ctx.data.form = { name: '', car_model: '', car_plate: '', car_color: '', max_seats: 1, max_checked: 0, max_carry_on: 0 };
    });

    it('updates form field', () => {
      ctx.onFormChange({ currentTarget: { dataset: { field: 'name' } }, detail: 'NewName' });
      expect(ctx.data.form.name).toBe('NewName');
    });

    it('updates max_seats', () => {
      ctx.onMaxSeatsChange({ detail: 8 });
      expect(ctx.data.form.max_seats).toBe(8);
    });

    it('updates max_checked', () => {
      ctx.onMaxCheckedChange({ detail: 5 });
      expect(ctx.data.form.max_checked).toBe(5);
    });

    it('updates max_carry_on', () => {
      ctx.onMaxCarryOnChange({ detail: 3 });
      expect(ctx.data.form.max_carry_on).toBe(3);
    });
  });

  describe('onSave', () => {
    beforeEach(() => {
      ctx.data.driverId = '5';
      ctx.data.form = { name: 'Updated', car_model: 'Tesla' };
    });

    it('saves and reloads', async () => {
      api.updateDriver.mockResolvedValue({});
      api.getDriver.mockResolvedValue({ id: 5, name: 'Updated', car_model: 'Tesla' });
      await ctx.onSave();
      expect(api.updateDriver).toHaveBeenCalledWith('5', { name: 'Updated', car_model: 'Tesla' });
      expect(ctx.data.editing).toBe(false);
      expect(ctx.data.saving).toBe(false);
    });

    it('prevents double save', async () => {
      ctx.data.saving = true;
      await ctx.onSave();
      expect(api.updateDriver).not.toHaveBeenCalled();
    });

    it('handles error', async () => {
      api.updateDriver.mockRejectedValue(new Error('fail'));
      await ctx.onSave();
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.saving).toBe(false);
    });
  });

  describe('onDelete', () => {
    beforeEach(() => {
      ctx.data.driverId = '5';
    });

    it('deletes after dialog confirm', async () => {
      Dialog.confirm.mockResolvedValue();
      api.deleteDriver.mockResolvedValue({});
      await ctx.onDelete();
      expect(api.deleteDriver).toHaveBeenCalledWith('5');
      expect(ctx.data.deleting).toBe(false);
    });

    it('does not delete on cancel', async () => {
      Dialog.confirm.mockRejectedValue(new Error('cancel'));
      await ctx.onDelete();
      expect(api.deleteDriver).not.toHaveBeenCalled();
    });

    it('handles delete error', async () => {
      Dialog.confirm.mockResolvedValue();
      api.deleteDriver.mockRejectedValue(new Error('fail'));
      await ctx.onDelete();
      expect(wx.showToast).toHaveBeenCalled();
      expect(ctx.data.deleting).toBe(false);
    });
  });
});
