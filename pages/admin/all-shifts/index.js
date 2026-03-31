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

// Map tab index to backend status filter
const TAB_STATUS_MAP = {
  0: '',           // all
  1: 'published',
  2: 'draft',
};

Page({
  data: {
    loading: false,
    loadingMore: false,
    allShifts: [],       // accumulated across pages
    filteredShifts: [],  // after client-side sort
    activeTab: 0,
    sortBy: 'time',

    // Pagination
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,

    // Counts (fetched from total per tab)
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
    this._loadTabCounts();
    this.loadShifts(1);
  },

  async onPullDownRefresh() {
    this._loadTabCounts();
    await this.loadShifts(1);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore && !this.data.loading) {
      this.loadShifts(this.data.page + 1);
    }
  },

  async loadShifts(page) {
    if (page > 1) {
      this.setData({ loadingMore: true });
    } else {
      this.setData({ loading: true, allShifts: [], filteredShifts: [] });
    }

    const status = TAB_STATUS_MAP[this.data.activeTab] || '';

    try {
      const res = await api.getDashboard('all', page, this.data.pageSize, status);
      const raw = (res && Array.isArray(res.shifts)) ? res.shifts : (Array.isArray(res) ? res : []);
      const total = (res && typeof res.total === 'number') ? res.total : raw.length;

      const newShifts = raw.map((item) => ({
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

      const allShifts = page === 1 ? newShifts : [...this.data.allShifts, ...newShifts];

      this.setData({
        allShifts,
        page,
        total,
        hasMore: allShifts.length < total,
      });

      this.applySort();
    } catch (err) {
      wx.showToast({ title: t('common_load_failed'), icon: 'none' });
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  /** Load counts for each tab (fire-and-forget, lightweight) */
  async _loadTabCounts() {
    try {
      const [allRes, pubRes, draftRes] = await Promise.all([
        api.getDashboard('all', 1, 1, ''),
        api.getDashboard('all', 1, 1, 'published'),
        api.getDashboard('all', 1, 1, 'draft'),
      ]);
      this.setData({
        allCount: (allRes && typeof allRes.total === 'number') ? allRes.total : 0,
        publishedCount: (pubRes && typeof pubRes.total === 'number') ? pubRes.total : 0,
        draftCount: (draftRes && typeof draftRes.total === 'number') ? draftRes.total : 0,
      });
    } catch (_) {
      // non-critical, counts will show 0
    }
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.index });
    // Server-side filter: reload from page 1
    this.loadShifts(1);
    this._loadTabCounts();
  },

  onSortChange(e) {
    this.setData({ sortBy: e.detail });
    this.applySort();
  },

  /** Client-side sort on loaded data */
  applySort() {
    const { allShifts, sortBy } = this.data;
    let list = allShifts.slice();

    if (sortBy === 'time') {
      list.sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || ''));
    } else if (sortBy === 'seats') {
      list.sort((a, b) => this._unfilledSeats(a) - this._unfilledSeats(b));
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
