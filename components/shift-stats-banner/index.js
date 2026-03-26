const { t } = require('../../utils/i18n');

Component({
  properties: {
    pendingAllocation: {
      type: Number,
      value: 0,
    },
    allocatedCount: {
      type: Number,
      value: 0,
    },
    publishedVehicles: {
      type: Number,
      value: 0,
    },
  },

  data: {
    i18n: {},
  },

  lifetimes: {
    attached() {
      this.setData({
        i18n: {
          stats_pending: t('dispatch_stats_pending'),
          stats_allocated: t('dispatch_stats_allocated'),
          stats_vehicles: t('dispatch_stats_vehicles'),
        },
      });
    },
  },
});
