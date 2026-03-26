const { t } = require('../../utils/i18n');

Component({
  properties: {
    label: {
      type: String,
      value: '',
    },
    used: {
      type: Number,
      value: 0,
    },
    total: {
      type: Number,
      value: 0,
    },
  },

  observers: {
    'used, total': function (used, total) {
      this.updateBar(used, total);
    },
  },

  data: {
    percent: 0,
    barColor: '#07c160',
    isFull: false,
    fullText: '',
    usageText: '0/0',
  },

  lifetimes: {
    attached() {
      this.setData({ fullText: t('capacity_bar_full') });
      this.updateBar(this.data.used, this.data.total);
    },
  },

  methods: {
    updateBar(used, total) {
      const safeTotal = total > 0 ? total : 0;
      const safeUsed = used > 0 ? used : 0;
      const ratio = safeTotal > 0 ? safeUsed / safeTotal : 0;
      const percent = Math.min(Math.round(ratio * 100), 100);
      const isFull = safeTotal > 0 && safeUsed >= safeTotal;

      let barColor = '#07c160'; // green
      if (ratio > 0.9) {
        barColor = '#ee0a24'; // red
      } else if (ratio > 0.7) {
        barColor = '#ff976a'; // yellow/orange
      }

      this.setData({
        percent,
        barColor,
        isFull,
        usageText: `${safeUsed}/${safeTotal}`,
      });
    },
  },
});
