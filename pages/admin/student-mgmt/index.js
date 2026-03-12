const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');
const { formatDateTime } = require('../../../utils/formatters');
const { resolveRequestName, runWithActionLock } = require('../../../utils/helpers');

function buildI18n() {
  return {
    sm_search_placeholder:  t('sm_search_placeholder'),
    sm_tab_pending:         t('sm_tab_pending'),
    sm_tab_assigned:        t('sm_tab_assigned'),
    sm_tab_all:             t('sm_tab_all'),
    sm_empty:               t('sm_empty'),
    sm_status_pending:      t('sm_status_pending'),
    sm_status_assigned:     t('sm_status_assigned'),
    sm_status_published:    t('sm_status_published'),
    sm_just_assigned:       t('sm_just_assigned'),
    sm_checked:             t('assign_checked_bags_label'),
    sm_carry_on:            t('assign_carry_on_bags_label'),
    sm_recommend_shifts:    t('sm_recommend_shifts'),
    sm_loading_shifts:      t('assign_loading_shifts'),
    sm_no_recommend:        t('sm_no_recommend'),
    sm_seats_remaining:     t('sm_seats_remaining'),
    sm_add:                 t('shift_detail_add'),
    sm_unassign:            t('sm_unassign'),
    sm_reassign:            t('sm_reassign'),
    sm_reassign_title:      t('sm_reassign_title'),
    sm_arrival_time_label:  t('sm_arrival_time_label'),
  };
}

function enrichItem(item, index) {
  const arrivalText = item.arrival_time ? formatDateTime(item.arrival_time) : (item.arrival_date ? item.arrival_date.slice(0, 10) : '--');
  const enriched = {
    ...item,
    _displayName: resolveRequestName(item),
    _arrivalText: arrivalText,
    _originalIndex: index,
    _showRecommend: false,
    _recommendLoading: false,
    _recommendShifts: [],
  };

  if (item.shift) {
    const driverName = (item.shift.driver && item.shift.driver.name) || t('common_unassigned_driver');
    enriched.shift = {
      ...item.shift,
      _driverName: driverName,
      _departureText: formatDateTime(item.shift.departure_time),
    };
  }

  return enriched;
}

function enrichShift(shift) {
  const driverName = (shift.driver && shift.driver.name) || t('common_unassigned_driver');
  const maxSeats = (shift.driver && shift.driver.max_seats) || 7;
  const remaining = Math.max(0, maxSeats - (shift.current_seats || 0));
  return {
    ...shift,
    _driverName: driverName,
    _departureText: formatDateTime(shift.departure_time),
    _remaining: remaining,
  };
}

Page({
  data: {
    loading: false,
    allItems: [],
    displayItems: [],
    activeTab: 0,
    searchKeyword: '',
    pendingCount: 0,
    assignedCount: 0,
    totalCount: 0,
    actionBusy: false,

    // Reassign popup
    showReassignPopup: false,
    reassignLoading: false,
    reassignShifts: [],
    reassignTarget: null,

    i18n: buildI18n(),
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: t('sm_nav_title') });
    this.setData({ i18n: buildI18n() });

    if (options && options.tab === 'pending') {
      this.setData({ activeTab: 0 });
    } else if (options && options.tab === 'assigned') {
      this.setData({ activeTab: 1 });
    }

    this.loadAll();
  },

  async onPullDownRefresh() {
    await this.loadAll();
    wx.stopPullDownRefresh();
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const res = await api.getManageRequests('all', '', 1, 200);
      const items = (res && res.items) || [];
      const allItems = items.map((item, i) => enrichItem(item, i));
      this.setData({
        allItems,
        pendingCount: res.pending_count || 0,
        assignedCount: res.assigned_count || 0,
        totalCount: allItems.length,
        loading: false,
      });
      this._applyFilter();
    } catch (err) {
      wx.showToast({ title: t('common_load_failed'), icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.index });
    this._applyFilter();
  },

  onSearchChange(e) {
    const keyword = (e.detail || '').trim();
    this.setData({ searchKeyword: keyword });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this._applyFilter(), 300);
  },

  onSearchClear() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.setData({ searchKeyword: '' });
    this._applyFilter();
  },

  _applyFilter() {
    const { allItems, activeTab, searchKeyword } = this.data;
    let filtered = allItems;

    // Tab filter
    if (activeTab === 0) {
      filtered = filtered.filter(item => item.status === 'pending' && !item.justAssigned);
    } else if (activeTab === 1) {
      filtered = filtered.filter(item =>
        item.status === 'assigned' || item.status === 'published' || item.justAssigned
      );
    }

    // Search filter
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      filtered = filtered.filter(item => {
        const name = (item._displayName || '').toLowerCase();
        const flight = (item.flight_no || '').toLowerCase();
        return name.includes(kw) || flight.includes(kw);
      });
    }

    this.setData({ displayItems: filtered });
  },

  async onShowRecommend(e) {
    const requestId = e.currentTarget.dataset.requestId;
    const idx = e.currentTarget.dataset.index;

    // Toggle off if already showing
    if (this.data.allItems[idx] && this.data.allItems[idx]._showRecommend) {
      this.setData({
        [`allItems[${idx}]._showRecommend`]: false,
      });
      this._applyFilter();
      return;
    }

    this.setData({
      [`allItems[${idx}]._showRecommend`]: true,
      [`allItems[${idx}]._recommendLoading`]: true,
    });
    this._applyFilter();

    try {
      const shifts = await api.getRecommendShifts(requestId, 5);
      const enrichedShifts = (Array.isArray(shifts) ? shifts : []).map(enrichShift);
      this.setData({
        [`allItems[${idx}]._recommendLoading`]: false,
        [`allItems[${idx}]._recommendShifts`]: enrichedShifts,
      });
      this._applyFilter();
    } catch (err) {
      this.setData({
        [`allItems[${idx}]._recommendLoading`]: false,
      });
      this._applyFilter();
      wx.showToast({ title: t('assign_load_shifts_failed'), icon: 'none' });
    }
  },

  async onQuickAssign(e) {
    const { shiftId, requestId, itemIndex } = e.currentTarget.dataset;
    await runWithActionLock(this, async () => {
      try {
        const result = await api.assignStudent(shiftId, requestId);
        // Update item in-place
        this.setData({
          [`allItems[${itemIndex}].justAssigned`]: true,
          [`allItems[${itemIndex}].status`]: 'assigned',
          [`allItems[${itemIndex}]._showRecommend`]: false,
        });

        // Update counts
        const pendingCount = Math.max(0, this.data.pendingCount - 1);
        const assignedCount = this.data.assignedCount + 1;
        this.setData({ pendingCount, assignedCount });
        this._applyFilter();

        const msg = result && result.warning
          ? `${t('dashboard_assign_success')} (${result.warning})`
          : t('dashboard_assign_success');
        wx.showToast({ title: msg, icon: 'success' });
      } catch (err) {
        wx.showToast({ title: t('dashboard_assign_failed'), icon: 'none' });
      }
    });
  },

  async onUnassign(e) {
    const item = e.currentTarget.dataset.item;
    if (!item || !item.shift) return;

    await runWithActionLock(this, async () => {
      try {
        await api.removeStudent(item.shift.id, item.id);
        // Reload to get fresh state
        await this.loadAll();
        wx.showToast({ title: t('dashboard_remove_success'), icon: 'success' });
      } catch (err) {
        wx.showToast({ title: t('dashboard_remove_failed'), icon: 'none' });
      }
    });
  },

  async onReassign(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;

    this.setData({
      showReassignPopup: true,
      reassignTarget: item,
      reassignLoading: true,
      reassignShifts: [],
    });

    try {
      const shifts = await api.getRecommendShifts(item.id, 10);
      const enrichedShifts = (Array.isArray(shifts) ? shifts : []).map(enrichShift);
      this.setData({
        reassignLoading: false,
        reassignShifts: enrichedShifts,
      });
    } catch (err) {
      this.setData({ reassignLoading: false });
      wx.showToast({ title: t('assign_load_shifts_failed'), icon: 'none' });
    }
  },

  async onSelectReassignShift(e) {
    const shiftId = e.currentTarget.dataset.shiftId;
    const target = this.data.reassignTarget;
    if (!target || !shiftId) return;

    await runWithActionLock(this, async () => {
      try {
        await api.reassignRequest(target.id, shiftId);
        this.setData({ showReassignPopup: false, reassignTarget: null });
        wx.showToast({ title: t('dashboard_assign_success'), icon: 'success' });
        await this.loadAll();
      } catch (err) {
        wx.showToast({ title: t('dashboard_assign_failed'), icon: 'none' });
      }
    });
  },

  onCloseReassign() {
    this.setData({ showReassignPopup: false, reassignTarget: null });
  },
});
