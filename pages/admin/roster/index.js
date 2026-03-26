const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');
const { pad2 } = require('../../../utils/formatters');

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function buildI18n() {
  return {
    roster_title:           t('roster_title'),
    roster_today:           t('roster_today'),
    roster_allocated:       t('roster_allocated'),
    roster_unallocated:     t('roster_unallocated'),
    roster_published:       t('roster_published'),
    roster_unpublished:     t('roster_unpublished'),
    roster_publish_all:     t('roster_publish_all'),
    roster_publish_confirm: t('roster_publish_confirm'),
    roster_publish_success: t('roster_publish_success'),
    roster_empty:           t('roster_empty'),
    roster_shift_label:     t('roster_shift_label'),
    roster_no_shifts:       t('roster_no_shifts'),
    common_confirm:         t('common_confirm'),
    common_cancel:          t('common_cancel'),
  };
}

Page({
  data: {
    i18n: {},
    loading: false,
    selectedDate: '',
    shifts: [],
    currentShiftIndex: 0,
    currentShift: null,
    activeTab: 0,
    allocatedList: [],
    unallocatedList: [],
    isLocked: false,
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('roster_title') });
    this.setData({
      i18n: buildI18n(),
      selectedDate: todayStr(),
    });
    this.loadShifts();
  },

  onShow() {
    this.setData({ i18n: buildI18n() });
    if (this.data.currentShift) {
      this.loadRoster();
    }
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
      const idx = Math.min(this.data.currentShiftIndex, Math.max(shifts.length - 1, 0));
      const currentShift = shifts.length > 0 ? shifts[idx] : null;
      const isLocked = currentShift ? (currentShift.status === 'locked' || currentShift.status === 'published') : false;
      this.setData({ shifts, currentShiftIndex: idx, currentShift, isLocked, loading: false });
      if (currentShift) {
        this.loadRoster();
      } else {
        this.setData({ allocatedList: [], unallocatedList: [] });
      }
    } catch (e) {
      console.error('loadShifts error', e);
      this.setData({ loading: false, shifts: [], currentShift: null });
    }
  },

  async loadRoster() {
    const shift = this.data.currentShift;
    if (!shift) return;
    const shiftId = shift.id || shift.ID;
    try {
      const res = await api.getShiftRoster(shiftId);
      const allocated = Array.isArray(res.allocated) ? res.allocated : [];
      const unallocated = Array.isArray(res.unallocated) ? res.unallocated : [];
      this.setData({ allocatedList: allocated, unallocatedList: unallocated });
    } catch (e) {
      console.error('loadRoster error', e);
      this.setData({ allocatedList: [], unallocatedList: [] });
    }
  },

  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value, currentShiftIndex: 0 });
    this.loadShifts();
  },

  onPrevDay() {
    const d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() - 1);
    const ds = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    this.setData({ selectedDate: ds, currentShiftIndex: 0 });
    this.loadShifts();
  },

  onNextDay() {
    const d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() + 1);
    const ds = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    this.setData({ selectedDate: ds, currentShiftIndex: 0 });
    this.loadShifts();
  },

  onToday() {
    this.setData({ selectedDate: todayStr(), currentShiftIndex: 0 });
    this.loadShifts();
  },

  onPrevShift() {
    const idx = this.data.currentShiftIndex;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    const shift = this.data.shifts[newIdx];
    const isLocked = shift ? (shift.status === 'locked' || shift.status === 'published') : false;
    this.setData({ currentShiftIndex: newIdx, currentShift: shift, isLocked });
    this.loadRoster();
  },

  onNextShift() {
    const idx = this.data.currentShiftIndex;
    if (idx >= this.data.shifts.length - 1) return;
    const newIdx = idx + 1;
    const shift = this.data.shifts[newIdx];
    const isLocked = shift ? (shift.status === 'locked' || shift.status === 'published') : false;
    this.setData({ currentShiftIndex: newIdx, currentShift: shift, isLocked });
    this.loadRoster();
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.index });
  },

  onPublishAll() {
    const shift = this.data.currentShift;
    if (!shift) return;
    const shiftId = shift.id || shift.ID;
    const that = this;
    wx.showModal({
      title: this.data.i18n.roster_publish_confirm,
      confirmText: this.data.i18n.common_confirm,
      cancelText: this.data.i18n.common_cancel,
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.lockShift(shiftId);
            wx.showToast({ title: that.data.i18n.roster_publish_success, icon: 'success' });
            that.loadShifts();
          } catch (err) {
            console.error('lockShift error', err);
          }
        }
      },
    });
  },
});
