const { t } = require('../../utils/i18n');
const { resolveRequestName } = require('../../utils/helpers');
const { formatDateTime } = require('../../utils/formatters');

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    recommended: {
      type: Array,
      value: [],
    },
    others: {
      type: Array,
      value: [],
    },
  },

  observers: {
    'recommended, others, show': function () {
      if (this.data.show) {
        this.setData({ searchText: '' });
        this.filterLists('');
      }
    },
  },

  data: {
    i18n: {},
    searchText: '',
    filteredRecommended: [],
    filteredOthers: [],
  },

  lifetimes: {
    attached() {
      this.setData({
        i18n: {
          modal_title: t('passenger_modal_title'),
          modal_search: t('passenger_modal_search'),
          modal_recommended: t('passenger_modal_recommended'),
          modal_others: t('passenger_modal_others'),
          modal_empty: t('passenger_modal_empty'),
          modal_score: t('passenger_modal_score'),
          modal_bags_label: t('passenger_modal_bags_label'),
        },
      });
    },
  },

  methods: {
    onClose() {
      this.triggerEvent('close');
    },

    onSearchChange(e) {
      const val = (e.detail || '').trim();
      this.setData({ searchText: val });
      this.filterLists(val);
    },

    filterLists(keyword) {
      const lowerKw = keyword.toLowerCase();
      const recommended = this.data.recommended || [];
      const others = this.data.others || [];

      const matchFn = function (item) {
        if (!lowerKw) return true;
        const req = item.request || item;
        const name = resolveRequestName(req).toLowerCase();
        const flight = (req.flight_no || '').toLowerCase();
        return name.indexOf(lowerKw) !== -1 || flight.indexOf(lowerKw) !== -1;
      };

      const mapRecommended = function (item) {
        const req = item.request || {};
        return {
          requestId: req.id || req.request_id,
          name: resolveRequestName(req),
          flightNo: req.flight_no || '--',
          arrivalTime: formatDateTime(req.arrival_time || req.expected_arrival_time),
          checkedBags: req.checked_bags || req.checked_luggage_count || 0,
          carryOnBags: req.carry_on_bags || req.carryon_luggage_count || 0,
          score: item.score || 0,
        };
      };

      const mapOther = function (req) {
        return {
          requestId: req.id || req.request_id,
          name: resolveRequestName(req),
          flightNo: req.flight_no || '--',
          arrivalTime: formatDateTime(req.arrival_time || req.expected_arrival_time),
          checkedBags: req.checked_bags || req.checked_luggage_count || 0,
          carryOnBags: req.carry_on_bags || req.carryon_luggage_count || 0,
          score: null,
        };
      };

      this.setData({
        filteredRecommended: recommended.filter(matchFn).map(mapRecommended),
        filteredOthers: others.filter(matchFn).map(mapOther),
      });
    },

    onSelectPassenger(e) {
      const requestId = e.currentTarget.dataset.requestid;
      this.triggerEvent('select', { requestId });
    },
  },
});
