const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');
const { pad2 } = require('../../../utils/formatters');

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function buildI18n() {
  return {
    sc_title:              t('sc_title'),
    sc_csv_section:        t('sc_csv_section'),
    sc_upload_btn:         t('sc_upload_btn'),
    sc_upload_none:        t('sc_upload_none'),
    sc_upload_done:        t('sc_upload_done'),
    sc_upload_wip:         t('sc_upload_wip'),
    sc_shift_section:      t('sc_shift_section'),
    sc_no_shifts:          t('sc_no_shifts'),
    sc_published:          t('sc_published'),
    sc_unpublished:        t('sc_unpublished'),
    sc_publish_btn:        t('sc_publish_btn'),
    sc_publish_confirm:    t('sc_publish_confirm'),
    sc_publish_success:    t('sc_publish_success'),
    sc_passengers:         t('sc_passengers'),
    sc_today:              t('sc_today'),
    common_confirm:        t('common_confirm'),
    common_cancel:         t('common_cancel'),
  };
}

Page({
  data: {
    i18n: {},
    loading: false,
    selectedDate: '',
    csvUploaded: false,
    shifts: [],
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('sc_title') });
    this.setData({
      i18n: buildI18n(),
      selectedDate: todayStr(),
    });
    this.loadShifts();
  },

  onShow() {
    this.setData({ i18n: buildI18n() });
  },

  async onPullDownRefresh() {
    try {
      await this.loadShifts();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async loadShifts() {
    this.setData({ loading: true });
    try {
      const res = await api.getDashboard(this.data.selectedDate);
      const shifts = (res && Array.isArray(res.shifts)) ? res.shifts : (Array.isArray(res) ? res : []);
      this.setData({ shifts, loading: false });
    } catch (e) {
      console.error('loadShifts error', e);
      this.setData({ loading: false, shifts: [] });
    }
  },

  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value });
    this.loadShifts();
  },

  onPrevDay() {
    const d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() - 1);
    const ds = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    this.setData({ selectedDate: ds });
    this.loadShifts();
  },

  onNextDay() {
    const d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() + 1);
    const ds = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    this.setData({ selectedDate: ds });
    this.loadShifts();
  },

  onToday() {
    this.setData({ selectedDate: todayStr() });
    this.loadShifts();
  },

  onUploadCSV() {
    const that = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv'],
      success(res) {
        // Phase 4 backend work — show WIP toast
        wx.showToast({ title: that.data.i18n.sc_upload_wip, icon: 'none', duration: 2000 });
      },
      fail() {
        // User cancelled
      },
    });
  },

  onPublishShift(e) {
    const shiftId = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: this.data.i18n.sc_publish_confirm,
      confirmText: this.data.i18n.common_confirm,
      cancelText: this.data.i18n.common_cancel,
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.lockShift(shiftId);
            wx.showToast({ title: that.data.i18n.sc_publish_success, icon: 'success' });
            that.loadShifts();
          } catch (err) {
            console.error('lockShift error', err);
          }
        }
      },
    });
  },
});
