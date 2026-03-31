/**
 * Tests for components/shift-card/index.js
 */

jest.mock('../../../utils/i18n', () => ({ t: (key) => key }));
jest.mock('../../../utils/formatters', () => ({
  formatDateTime: jest.fn((v) => v || '--'),
}));
jest.mock('../../../utils/status', () => ({
  normalizeShiftStatus: jest.fn((s) => (s === 'Published' ? 'published' : (s || 'draft'))),
}));
jest.mock('../../../utils/helpers', () => ({
  resolveRequestName: jest.fn((item) => item.name || 'Unknown'),
}));

describe('components/shift-card', () => {
  let compConfig;
  let comp;

  function makeComp(shift) {
    const data = JSON.parse(JSON.stringify(compConfig.data));
    const instance = {
      ...compConfig.methods,
      data: { ...data, shift: shift || {} },
      properties: { shift: shift || {} },
      setData(updates) { Object.assign(this.data, updates); },
      triggerEvent: jest.fn(),
    };
    return instance;
  }

  beforeEach(() => {
    jest.resetModules();
    global.Component = jest.fn();
    require('../../../components/shift-card/index');
    compConfig = global.Component.mock.calls[0][0];
  });

  describe('component registration', () => {
    it('registers a Component', () => {
      expect(global.Component).toHaveBeenCalledTimes(1);
    });

    it('has properties defined', () => {
      expect(compConfig.properties.shift).toBeDefined();
      expect(compConfig.properties.shift.type).toBe(Object);
    });
  });

  describe('buildViewModel', () => {
    it('builds from full shift data', () => {
      const shift = {
        id: 1,
        status: 'Published',
        departure_time: '2026-03-10T14:00:00Z',
        driver: { name: 'DriverA', car_model: 'Toyota', max_seats: 6, max_checked: 4, max_carry_on: 2 },
        requests: [
          { id: 1, name: 'Alice', flight_no: 'AA100', checked_bags: 1, carry_on_bags: 1, boarded_at: '2026-03-10T13:00:00Z' },
          { id: 2, name: 'Bob', flight_no: 'UA200', checked_bags: 2, carry_on_bags: 0, boarded_at: null },
        ],
        staffs: [{ id: 10, name: 'Staff1' }],
      };
      comp = makeComp(shift);
      comp.buildViewModel(shift);

      expect(comp.data.statusText).toBe('shiftcard_published');
      expect(comp.data.statusType).toBe('success');
      expect(comp.data.driverText).toBe('DriverA (Toyota)');
      expect(comp.data.passengers).toHaveLength(2);
      expect(comp.data.passengers[0].name).toBe('Alice');
      expect(comp.data.seatUsage.used).toBe(2);
      expect(comp.data.seatUsage.max).toBe(6);
      expect(comp.data.checkedUsage.used).toBe(3);
      expect(comp.data.carryOnUsage.used).toBe(1);
      expect(comp.data.boardedCount).toBe(1);
      expect(comp.data.unboardedCount).toBe(1);
      expect(comp.data.staffs).toHaveLength(1);
    });

    it('handles empty shift', () => {
      comp = makeComp({});
      comp.buildViewModel({});
      expect(comp.data.statusText).toBe('shiftcard_unpublished');
      expect(comp.data.passengers).toEqual([]);
      expect(comp.data.seatUsage.used).toBe(0);
    });

    it('handles null shift', () => {
      comp = makeComp(null);
      comp.buildViewModel(null);
      expect(comp.data.passengers).toEqual([]);
    });

    it('handles shift with delayed requests', () => {
      comp = makeComp();
      comp.buildViewModel({
        requests: [{ id: 1, is_delayed: true, checked_bags: 0, carry_on_bags: 0 }],
      });
      expect(comp.data.hasDelayWarning).toBe(true);
    });

    it('handles no delays', () => {
      comp = makeComp();
      comp.buildViewModel({
        requests: [{ id: 1, is_delayed: false, checked_bags: 0, carry_on_bags: 0 }],
      });
      expect(comp.data.hasDelayWarning).toBe(false);
    });

    it('handles manual vehicle count', () => {
      comp = makeComp();
      comp.buildViewModel({ manual_vehicle_count: 3, requests: [] });
      // t() returns key, replace('{0}', 3) won't find {0} in key string
      expect(comp.data.vehicleText).toBeTruthy();
    });

    it('handles suggested vehicles', () => {
      comp = makeComp();
      comp.buildViewModel({ suggested_vehicles: 2, requests: [] });
      expect(comp.data.vehicleText).toBeTruthy();
    });

    it('no vehicle text when both null', () => {
      comp = makeComp();
      comp.buildViewModel({ requests: [] });
      expect(comp.data.vehicleText).toBe('');
    });
  });

  describe('getShiftId', () => {
    it('returns id', () => {
      comp = makeComp({ id: 42 });
      expect(comp.getShiftId()).toBe(42);
    });

    it('returns ID fallback', () => {
      comp = makeComp({ ID: 99 });
      expect(comp.getShiftId()).toBe(99);
    });

    it('returns shift_id fallback', () => {
      comp = makeComp({ shift_id: 77 });
      expect(comp.getShiftId()).toBe(77);
    });

    it('returns 0 when no id', () => {
      comp = makeComp({});
      expect(comp.getShiftId()).toBe(0);
    });
  });

  describe('toPassenger', () => {
    it('maps request to passenger', () => {
      comp = makeComp();
      const result = comp.toPassenger({
        id: 1, name: 'Alice', flight_no: 'AA100',
        arrival_time: '2026-03-10T14:00:00Z',
        calc_pickup_time: '2026-03-10T13:00:00Z',
        checked_bags: 2, carry_on_bags: 1,
      });
      expect(result.name).toBe('Alice');
      expect(result.flightNo).toBe('AA100');
      expect(result.checkedBags).toBe(2);
      expect(result.carryOnBags).toBe(1);
    });

    it('handles missing fields', () => {
      comp = makeComp();
      const result = comp.toPassenger({});
      expect(result.flightNo).toBe('--');
      expect(result.checkedBags).toBe(0);
    });
  });

  describe('getDriverText', () => {
    it('returns formatted driver text', () => {
      comp = makeComp();
      expect(comp.getDriverText({ name: 'A', car_model: 'B' })).toBe('A (B)');
    });

    it('returns unassigned for null', () => {
      comp = makeComp();
      expect(comp.getDriverText(null)).toBe('shiftcard_unassigned');
    });

    it('uses defaults for missing fields', () => {
      comp = makeComp();
      const text = comp.getDriverText({ name: '' });
      expect(text).toContain('shiftcard_unknown_driver');
    });
  });

  describe('getDriverInfo', () => {
    it('returns nested driver', () => {
      comp = makeComp();
      const result = comp.getDriverInfo({ driver: { name: 'A', car_model: 'B' } });
      expect(result.name).toBe('A');
    });

    it('constructs from flat fields', () => {
      comp = makeComp();
      const result = comp.getDriverInfo({ driver_name: 'A', car_model: 'B' });
      expect(result.name).toBe('A');
      expect(result.car_model).toBe('B');
    });

    it('returns null when no driver info', () => {
      comp = makeComp();
      expect(comp.getDriverInfo({})).toBeNull();
    });
  });

  describe('getMaxCapacity', () => {
    it('gets seats from driver', () => {
      comp = makeComp();
      expect(comp.getMaxCapacity({ driver: { max_seats: 6 } }, 'seats')).toBe(6);
    });

    it('gets checked from shift fallback', () => {
      comp = makeComp();
      expect(comp.getMaxCapacity({ max_checked_luggage: 4 }, 'checked')).toBe(4);
    });

    it('gets carry_on from shift fallback', () => {
      comp = makeComp();
      expect(comp.getMaxCapacity({ max_carry_on_luggage: 2 }, 'carryOn')).toBe(2);
    });
  });

  describe('collectFlightNos', () => {
    it('collects unique flight numbers', () => {
      comp = makeComp();
      expect(comp.collectFlightNos([
        { flight_no: 'AA100' }, { flight_no: 'UA200' }, { flight_no: 'AA100' },
      ])).toBe('AA100, UA200');
    });

    it('returns -- for empty', () => {
      comp = makeComp();
      expect(comp.collectFlightNos([])).toBe('--');
    });
  });

  describe('getTerminals', () => {
    it('uses shift terminals array', () => {
      comp = makeComp();
      expect(comp.getTerminals({ terminals: ['T1', 'T2'] }, [])).toEqual(['T1', 'T2']);
    });

    it('extracts from requests', () => {
      comp = makeComp();
      expect(comp.getTerminals({}, [{ terminal: 'T1' }, { terminal: 'T2' }, { terminal: 'T1' }])).toEqual(['T1', 'T2']);
    });

    it('filters empty terminals', () => {
      comp = makeComp();
      expect(comp.getTerminals({ terminals: ['T1', '', null] }, [])).toEqual(['T1']);
    });
  });

  describe('makeUsage', () => {
    it('normal usage', () => {
      comp = makeComp();
      const result = comp.makeUsage('Seats', 3, 6);
      expect(result.used).toBe(3);
      expect(result.max).toBe(6);
      expect(result.percent).toBe(50);
      expect(result.isOverload).toBe(false);
    });

    it('overload', () => {
      comp = makeComp();
      const result = comp.makeUsage('Seats', 8, 6);
      expect(result.isOverload).toBe(true);
      expect(result.color).toBe('#ee0a24');
      expect(result.overloadText).toContain('2');
    });

    it('zero max', () => {
      comp = makeComp();
      const result = comp.makeUsage('Seats', 0, 0);
      expect(result.percent).toBe(0);
      expect(result.isOverload).toBe(false);
    });

    it('used > 0 with zero max', () => {
      comp = makeComp();
      const result = comp.makeUsage('Seats', 2, 0);
      expect(result.percent).toBe(100);
      expect(result.isOverload).toBe(true);
    });
  });

  describe('toNumber', () => {
    it('converts valid number', () => {
      comp = makeComp();
      expect(comp.toNumber(5)).toBe(5);
      expect(comp.toNumber('3')).toBe(3);
    });

    it('returns 0 for invalid', () => {
      comp = makeComp();
      expect(comp.toNumber(null)).toBe(0);
      expect(comp.toNumber(undefined)).toBe(0);
      expect(comp.toNumber('abc')).toBe(0);
      expect(comp.toNumber(NaN)).toBe(0);
      expect(comp.toNumber(Infinity)).toBe(0);
    });
  });

  describe('onTapManageShift', () => {
    it('triggers event with shiftId', () => {
      comp = makeComp({ id: 42 });
      comp.onTapManageShift();
      expect(comp.triggerEvent).toHaveBeenCalledWith('manageshift', { shiftId: 42 });
    });
  });
});
