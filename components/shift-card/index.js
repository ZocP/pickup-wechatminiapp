Component({
  properties: {
    shift: {
      type: Object,
      value: {},
      observer(value) {
        this.buildViewModel(value || {});
      },
    },
  },

  data: {
    headerTime: '--',
    flightsText: '--',
    statusText: 'draft',
    statusType: 'default',
    hasDelayWarning: false,
    driverText: '未分配司机',
    routeText: '',
    showRouteNotice: false,
    staffs: [],
    passengers: [],
    seatUsage: null,
    checkedUsage: null,
    carryOnUsage: null,
  },

  lifetimes: {
    attached() {
      this.buildViewModel(this.data.shift || {});
    },
  },

  methods: {
    normalizeShiftStatus(status) {
      const value = String(status || '').toLowerCase();
      if (value === 'draft') return 'unpublished';
      return value || 'unpublished';
    },

    buildViewModel(rawShift) {
      const shift = rawShift || {};
      const requests = Array.isArray(shift.requests) ? shift.requests : [];
      const staffs = Array.isArray(shift.staffs) ? shift.staffs : [];
      const terminals = this.getTerminals(shift, requests);
      const status = this.normalizeShiftStatus(shift.status);
      const driver = this.getDriverInfo(shift);

      const usedSeats = requests.length;
      const usedChecked = requests.reduce((sum, item) => sum + this.toNumber(item.checked_bags || item.checked_luggage_count), 0);
      const usedCarryOn = requests.reduce((sum, item) => sum + this.toNumber(item.carry_on_bags || item.carryon_luggage_count), 0);

      const maxSeats = this.getMaxCapacity(shift, 'seats');
      const maxChecked = this.getMaxCapacity(shift, 'checked');
      const maxCarryOn = this.getMaxCapacity(shift, 'carryOn');

      const hasDelayWarning = requests.some((item) => !!item.is_delayed);

      this.setData({
        headerTime: this.formatDateTime(shift.departure_time || shift.DepartureTime),
        flightsText: this.collectFlightNos(requests),
        statusText: status === 'published' ? '已发布' : '未发布',
        statusType: status === 'published' ? 'success' : 'default',
        hasDelayWarning,
        driverText: this.getDriverText(driver),
        routeText: terminals.join(' -> '),
        showRouteNotice: terminals.length > 1,
        staffs: staffs,
        passengers: requests.map((item) => this.toPassenger(item)),
        seatUsage: this.makeUsage('座位', usedSeats, maxSeats),
        checkedUsage: this.makeUsage('托运箱', usedChecked, maxChecked),
        carryOnUsage: this.makeUsage('登机箱', usedCarryOn, maxCarryOn),
      });
    },

    getShiftId() {
      const shift = this.data.shift || {};
      return shift.id || shift.ID || shift.shift_id || 0;
    },

    toPassenger(item) {
      const user = item.user || {};
      const name = user.name
        || user.real_name
        || user.user_name
        || user.nickname
        || item.real_name
        || item.passenger_name
        || item.user_name
        || item.student_name
        || item.nickname
        || item.name
        || '';
      return {
        id: item.id,
        name: String(name).trim() || `学生#${item.user_id || item.id || '--'}`,
        flightNo: item.flight_no || '--',
        arrivalTime: this.formatDateTime(item.arrival_time_api || item.expected_arrival_time),
        pickupTime: this.formatDateTime(item.calc_pickup_time),
        checkedBags: this.toNumber(item.checked_bags),
        carryOnBags: this.toNumber(item.carry_on_bags),
      };
    },

    getDriverText(driver) {
      if (!driver) return '未分配司机';
      const name = driver.name || '未知司机';
      const car = driver.car_model || '未知车型';
      return `${name} (${car})`;
    },

    getDriverInfo(shift) {
      const nested = shift.driver || null;
      if (nested && (nested.name || nested.car_model)) {
        return nested;
      }
      const name = shift.driver_name || shift.driverName || '';
      const car = shift.car_model || shift.vehicle_model || shift.vehicle_plate || '';
      if (!name && !car) return null;
      return {
        name: name || '未知司机',
        car_model: car || '未知车型',
        max_seats: shift.max_passengers,
        max_checked: shift.max_checked_luggage,
        max_carry_on: shift.max_carry_on_luggage,
      };
    },

    getMaxCapacity(shift, type) {
      const driver = shift.driver || {};
      if (type === 'seats') {
        return this.toNumber(driver.max_seats || shift.max_passengers || shift.max_seats);
      }
      if (type === 'checked') {
        return this.toNumber(driver.max_checked || shift.max_checked_luggage || shift.max_checked);
      }
      return this.toNumber(driver.max_carry_on || shift.max_carry_on_luggage || shift.max_carry_on);
    },

    collectFlightNos(requests) {
      const unique = [];
      requests.forEach((r) => {
        const no = (r.flight_no || '').trim();
        if (no && unique.indexOf(no) === -1) unique.push(no);
      });
      return unique.length ? unique.join(', ') : '--';
    },

    getTerminals(shift, requests) {
      if (Array.isArray(shift.terminals) && shift.terminals.length) {
        return shift.terminals.filter(Boolean);
      }
      const unique = [];
      requests.forEach((r) => {
        const t = (r.terminal || '').trim();
        if (t && unique.indexOf(t) === -1) unique.push(t);
      });
      return unique;
    },

    makeUsage(label, used, max) {
      const safeMax = max > 0 ? max : 0;
      const isOverload = safeMax > 0 ? used > safeMax : used > 0;
      const ratio = safeMax > 0 ? Math.round((used / safeMax) * 100) : (used > 0 ? 100 : 0);
      const percent = ratio > 100 ? 100 : ratio;

      return {
        label,
        used,
        max: safeMax,
        percent,
        color: isOverload ? '#ee0a24' : '#07c160',
        isOverload,
        overloadText: isOverload && safeMax > 0 ? `超载 +${used - safeMax}` : '',
      };
    },

    toNumber(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    },

    formatDateTime(value) {
      if (!value) return '--';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      const y = date.getFullYear();
      const m = `${date.getMonth() + 1}`.padStart(2, '0');
      const d = `${date.getDate()}`.padStart(2, '0');
      const hh = `${date.getHours()}`.padStart(2, '0');
      const mm = `${date.getMinutes()}`.padStart(2, '0');
      return `${y}-${m}-${d} ${hh}:${mm}`;
    },

    onTapManageShift() {
      this.triggerEvent('manageshift', { shiftId: this.getShiftId() });
    },
  },
});
