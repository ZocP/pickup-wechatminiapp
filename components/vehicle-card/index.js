const { t } = require('../../utils/i18n');
const { resolveRequestName } = require('../../utils/helpers');
const { formatDateTime } = require('../../utils/formatters');

Component({
  properties: {
    vehicle: {
      type: Object,
      value: {},
    },
    passengers: {
      type: Array,
      value: [],
    },
    boardedCount: {
      type: Number,
      value: 0,
    },
    pendingCount: {
      type: Number,
      value: 0,
    },
    editable: {
      type: Boolean,
      value: true,
    },
  },

  observers: {
    'vehicle, passengers, boardedCount, pendingCount': function () {
      this.buildViewModel();
    },
  },

  data: {
    i18n: {},
    headerText: '',
    colorDot: '',
    driverText: '',
    boardedText: '',
    pendingText: '',
    seatLabel: '',
    checkedLabel: '',
    carryOnLabel: '',
    seatUsed: 0,
    seatTotal: 0,
    checkedUsed: 0,
    checkedTotal: 0,
    carryOnUsed: 0,
    carryOnTotal: 0,
    passengerList: [],
  },

  lifetimes: {
    attached() {
      this.setData({
        i18n: {
          vehicle_boarded: t('vehicle_card_boarded'),
          vehicle_pending: t('vehicle_card_pending'),
          vehicle_boarded_unit: t('vehicle_card_boarded_unit'),
          vehicle_pending_unit: t('vehicle_card_pending_unit'),
          vehicle_driver_label: t('vehicle_card_driver_label'),
          vehicle_no_driver: t('vehicle_card_no_driver'),
          vehicle_add_btn: t('vehicle_card_add_btn'),
          vehicle_remove_btn: t('vehicle_card_remove_btn'),
          vehicle_seat_label: t('vehicle_card_seat_label'),
          vehicle_checked_label: t('vehicle_card_checked_label'),
          vehicle_carryon_label: t('vehicle_card_carryon_label'),
        },
      });
      this.buildViewModel();
    },
  },

  methods: {
    buildViewModel() {
      const vehicle = this.data.vehicle || {};
      const passengers = this.data.passengers || [];
      const capacity = vehicle.capacity || {};

      const headerText = [vehicle.car_model, vehicle.car_plate].filter(Boolean).join(' · ');
      const colorDot = vehicle.car_color || '';

      // Driver
      const driver = vehicle.driver;
      const driverText = driver ? (driver.name || '') : '';

      // Capacity
      const seatUsed = capacity.seats_used || 0;
      const seatTotal = capacity.seats_total || 0;
      const checkedUsed = capacity.checked_used || 0;
      const checkedTotal = capacity.checked_total || 0;
      const carryOnUsed = capacity.carry_on_used || 0;
      const carryOnTotal = capacity.carry_on_total || 0;

      // Passenger list
      const passengerList = passengers.map(function (p) {
        return {
          requestId: p.request_id || p.id,
          name: resolveRequestName(p),
          arrivalTime: formatDateTime(p.arrival_time || p.expected_arrival_time),
          flightNo: p.flight_no || '--',
          checkedBags: p.checked_bags || p.checked_luggage_count || 0,
          carryOnBags: p.carry_on_bags || p.carryon_luggage_count || 0,
        };
      });

      this.setData({
        headerText,
        colorDot,
        driverText,
        boardedText: String(this.data.boardedCount),
        pendingText: String(this.data.pendingCount),
        seatLabel: t('vehicle_card_seat_label'),
        checkedLabel: t('vehicle_card_checked_label'),
        carryOnLabel: t('vehicle_card_carryon_label'),
        seatUsed,
        seatTotal,
        checkedUsed,
        checkedTotal,
        carryOnUsed,
        carryOnTotal,
        passengerList,
      });
    },

    onTapAddPassenger() {
      const vehicle = this.data.vehicle || {};
      this.triggerEvent('addpassenger', { vehicleId: vehicle.id });
    },

    onTapRemovePassenger(e) {
      const requestId = e.currentTarget.dataset.requestid;
      this.triggerEvent('removepassenger', { requestId });
    },

    onTapRemoveVehicle() {
      const vehicle = this.data.vehicle || {};
      this.triggerEvent('removevehicle', { vehicleId: vehicle.id });
    },
  },
});
