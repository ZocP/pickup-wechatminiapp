const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');
const { normalizeShiftStatus } = require('../../../utils/status');

function buildI18n() {
  return {
    allshifts_tab_all:       t('allshifts_tab_all'),
    allshifts_tab_published: t('allshifts_tab_published'),
    allshifts_tab_draft:     t('allshifts_tab_draft'),
    allshifts_empty:         t('allshifts_empty'),
    allshifts_sort_time:     t('allshifts_sort_time'),
    allshifts_sort_seats:    t('allshifts_sort_seats'),
    allshifts_sort_status:   t('allshifts_sort_status'),
  };
}

Page({
  data: {
    loading: false,
    allShifts: [],       // raw from API
    filteredShifts: [],  // after tab filter + sort
    activeTab: 0,
    sortBy: 'time',

    allCount: 0,
    publishedCount: 0,
    draftCount: 0,

    sortOptions: [],
    i18n: {},
  },

  onLoad() {
    const i18n = buildI18n();
    this.setData({
      i18n,
      sortOptions: [
        { text: i18n.allshifts_sort_time,   value: 'time' },
        { text: i18n.allshifts_sort_seats,   value: 'seats' },
        { text: i18n.allshifts_sort_status,  value: 'status' },
      ],
    });
    wx.setNavigationBarTitle({ title: t('allshifts_nav_title') });
    this.loadAll();
  },

  async onPullDownRefresh() {
    await this.loadAll();
    wx.stopPullDownRefresh();
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const res = await api.getDashboard('all');
      const raw = Array.isArray(res) ? res : (res && Array.isArray(res.shifts) ? res.shifts : (res && Array.isArray(res.items) ? res.items : (res && Array.isArray(res.list) ? res.list : (res && Array.isArray(res.rows) ? res.rows : (res && Array.isArray(res.data) ? res.data : [])))));

      const shifts = raw.map((item) => ({
        ...item,
        id: item.id || item.ID || item.shift_id || 0,
        status: normalizeShiftStatus(item.status || item.Status),
        departure_time: item.departure_time || item.DepartureTime || '',
        requests: Array.isArray(item.requests)
          ? item.requests
          : (Array.isArray(item.Requests)
            ? item.Requests
            : (Array.isArray(item.passengers) ? item.passengers : [])),
      }));

      const publishedCount = shifts.filter((s) => s.status === 'published').length;
      const draftCount = shifts.filter((s) => s.status !== 'published').length;

      this.setData({
        allShifts: shifts,
        allCount: shifts.length,
        publishedCount,
        draftCount,
        loading: false,
      });
      this.applyFilterAndSort();
    } catch (err) {
      wx.showToast({ title: t('common_load_failed'), icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.index });
    this.applyFilterAndSort();
  },

  onSortChange(e) {
    this.setData({ sortBy: e.detail });
    this.applyFilterAndSort();
  },

  applyFilterAndSort() {
    const { allShifts, activeTab, sortBy } = this.data;
    let list = allShifts.slice();

    // Tab filter
    if (activeTab === 1) {
      list = list.filter((s) => s.status === 'published');
    } else if (activeTab === 2) {
      list = list.filter((s) => s.status !== 'published');
    }

    // Sort
    if (sortBy === 'time') {
      list.sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || ''));
    } else if (sortBy === 'seats') {
      list.sort((a, b) => {
        const seatsA = this._unfilledSeats(a);
        const seatsB = this._unfilledSeats(b);
        return seatsA - seatsB;
      });
    } else if (sortBy === 'status') {
      list.sort((a, b) => {
        if (a.status === 'published' && b.status !== 'published') return -1;
        if (a.status !== 'published' && b.status === 'published') return 1;
        return (a.departure_time || '').localeCompare(b.departure_time || '');
      });
    }

    this.setData({ filteredShifts: list });
  },

  _unfilledSeats(shift) {
    const maxSeats = (shift.driver && shift.driver.max_seats) || 0;
    const taken = (shift.requests || []).length + 1; // +1 for driver
    return maxSeats - taken;
  },

  onManageShift(e) {
    const detail = (e && e.detail) || {};
    const shiftId = Number(detail.shiftId || detail.shiftid || detail.id || 0);
    if (!shiftId) return;
    wx.navigateTo({ url: '/pages/admin/shift-detail/index?id=' + shiftId });
  },
});
