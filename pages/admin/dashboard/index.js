const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');
const { pad2, formatDateOnly } = require('../../../utils/formatters');
const { resolveRequestName, buildRideWithText, runWithActionLock } = require('../../../utils/helpers');
const { normalizeShiftStatus } = require('../../../utils/status');
const { setTabBarHidden } = require('../../../utils/ui');

function unwrapPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload;
  return payload.data || payload.result || payload.payload || payload;
}

function extractArray(payload, candidates) {
  const root = unwrapPayload(payload);
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== 'object') return [];

  for (let i = 0; i < candidates.length; i += 1) {
    const key = candidates[i];
    if (Array.isArray(root[key])) return root[key];
  }

  const nested = unwrapPayload(root.data);
  if (nested && nested !== root) {
    if (Array.isArray(nested)) return nested;
    for (let i = 0; i < candidates.length; i += 1) {
      const key = candidates[i];
      if (Array.isArray(nested[key])) return nested[key];
    }
  }

  return [];
}

function pickNumber(payload, keys) {
  const level1 = unwrapPayload(payload);
  const level2 = level1 && level1.data ? unwrapPayload(level1.data) : null;
  const roots = [payload, level1, level2].filter(Boolean);
  for (let i = 0; i < roots.length; i += 1) {
    const root = roots[i];
    if (!root || typeof root !== 'object' || Array.isArray(root)) continue;
    for (let j = 0; j < keys.length; j += 1) {
      const value = root[keys[j]];
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
  }
  return null;
}

function normalizeDateKey(source) {
  if (!source) return '';
  const raw = String(source).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function shiftStatusText(status) {
  return normalizeShiftStatus(status) === 'published' ? t('common_published') : t('common_unpublished');
}

function buildI18n() {
  return {
    dashboard_pending_count_label:    t('dashboard_pending_count_label'),
    dashboard_today_shifts_label:     t('dashboard_today_shifts_label'),
    dashboard_published_count_label:  t('dashboard_published_count_label'),
    dashboard_add_shift:              t('dashboard_add_shift'),
    dashboard_quick_assign:           t('dashboard_quick_assign'),
    dashboard_no_shifts:              t('dashboard_no_shifts'),
    dashboard_pending_pool_label:     t('dashboard_pending_pool_label'),
    dashboard_pending_students:       t('dashboard_pending_students'),
    dashboard_select_shift:           t('dashboard_select_shift'),
    dashboard_remove_passenger_title: t('dashboard_remove_passenger_title'),
    dashboard_create_shift_title:     t('dashboard_create_shift_title'),
    dashboard_field_driver:           t('dashboard_field_driver'),
    dashboard_field_date:             t('dashboard_field_date'),
    dashboard_field_time:             t('dashboard_field_time'),
    dashboard_placeholder_driver:     t('dashboard_placeholder_driver'),
    dashboard_placeholder_date:       t('dashboard_placeholder_date'),
    dashboard_placeholder_time:       t('dashboard_placeholder_time'),
    dashboard_confirm_create:         t('dashboard_confirm_create'),
    today:                            t('today'),
    all:                              t('all'),
  };
}

const MAX_PENDING_ACTIONS = 40;

Page({
  data: {
    loading: false,
    shifts: [],
    pendingRequests: [],

    filterDate: null,
    todayDate: '',
    filterDateLabel: '',
    showCalendar: false,
    calendarDefaultDate: null,

    pendingCount: 0,
    todayShiftCount: 0,
    publishedCount: 0,
    pendingActionOverflow: 0,
    overflowTipText: '',
    actionBusy: false,

    showPendingSheet: false,
    pendingActions: [],
    selectedPendingRequest: null,

    showShiftPicker: false,
    shiftActions: [],

    showRemoveSheet: false,
    removeActions: [],
    removeShiftId: 0,

    currentShiftIdForAdd: 0,

    showCreatePopup: false,
    showDriverPicker: false,
    showDatePicker: false,
    showTimePicker: false,
    driverList: [],
    pickerColumns: [],
    selectedDriverId: null,
    selectedDriverName: '',
    selectedDate: '',
    selectedClock: '',
    selectedDateTs: new Date().getTime(),
    minDateTs: new Date().getTime(),
    formattedTime: '',

    // 角色模拟相关
    showRoleSimulator: false,
    isViewingAsUser: false,
    currentEffectiveRole: 'admin',
    realRole: 'admin',
    roleOptions: [
      { label: t('dashboard_role_student'), value: 'student', icon: 'user-o' },
      { label: t('dashboard_role_staff'), value: 'staff', icon: 'manager-o' },
      { label: t('dashboard_role_driver'), value: 'driver', icon: 'car-o' },
      { label: t('dashboard_role_admin'), value: 'admin', icon: 'setting-o' },
    ],

    i18n: buildI18n(),
  },

  onShow() {
    const app = getApp();
    if (!app.ensureWechatBound()) return;
    const role = app.getEffectiveRole ? app.getEffectiveRole() : ((app.globalData.userInfo && app.globalData.userInfo.role) || 'student');

    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: '/pages/admin/dashboard/index' });
      if (typeof tabBar.setHidden === 'function') {
        tabBar.setHidden(false);
      }
      if (typeof tabBar.refreshTabs === 'function') {
        tabBar.refreshTabs();
      }
    }

    if (!(role === 'admin' || role === 'staff')) {
      wx.showToast({ title: t('common_admin_only'), icon: 'none' });
      wx.switchTab({ url: '/pages/home/index' });
      return;
    }

    const cache = app.globalData.dashboardCache || {};
    const ttlMs = Number(cache.ttlMs) || 0;
    const lastLoadAt = Number(cache.lastLoadAt) || 0;
    const fresh = lastLoadAt && ttlMs > 0 && (Date.now() - lastLoadAt) < ttlMs;

    wx.setNavigationBarTitle({ title: t('dashboard_nav_title') });
    this.setData({ i18n: buildI18n(), todayDate: this._formatDate(new Date()) });

    if (!app.isDashboardDirty() && fresh) {
      return;
    }

    this.loadAll();
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('dashboard_nav_title') });
    const today = this._formatDate(new Date());
    this.setData({
      i18n: buildI18n(),
      filterDate: today,
      filterDateLabel: today,
      todayDate: today,
    });
  },

  async onPullDownRefresh() {
    await this.loadAll();
    wx.stopPullDownRefresh();
  },

  async loadAll() {
    const app = getApp();
    this.setData({ loading: true });

    const [dashboardResult, pendingResult] = await Promise.allSettled([
      api.getDashboard(this.data.filterDate),
      api.getPendingRequests(),
    ]);

    const shiftsRes = dashboardResult.status === 'fulfilled' ? dashboardResult.value : [];
    const pendingRes = pendingResult.status === 'fulfilled' ? pendingResult.value : [];

    if (dashboardResult.status === 'rejected' && pendingResult.status === 'rejected') {
      wx.showToast({ title: t('common_load_failed'), icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    if (dashboardResult.status === 'rejected' || pendingResult.status === 'rejected') {
      const failed = [];
      if (dashboardResult.status === 'rejected') failed.push(t('dashboard_shift_data'));
      if (pendingResult.status === 'rejected') failed.push(t('dashboard_pending_data'));
      wx.showToast({ title: `${failed.join('、')}${t('assign_load_failed')}`, icon: 'none' });
    }

    const dashboardRows = extractArray(shiftsRes, ['shifts', 'items', 'list', 'rows']);

    const shifts = dashboardRows.map((item) => ({
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

    const pendingRequests = extractArray(pendingRes, ['items', 'requests', 'list', 'rows']);

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const todayShiftCountFromRows = shifts.filter((s) => normalizeDateKey(s.departure_time) === todayKey).length;
    const publishedCountFromRows = shifts.filter((s) => (s.status || '').toLowerCase() === 'published').length;

    const pendingCountFromShift = pickNumber(shiftsRes, ['pending_count', 'pendingCount']);
    const pendingCountFromPending = pickNumber(pendingRes, ['pending_count', 'pendingCount', 'total']);
    const pendingCount = Number.isFinite(pendingCountFromShift)
      ? pendingCountFromShift
      : (Number.isFinite(pendingCountFromPending) ? pendingCountFromPending : pendingRequests.length);

    const todayShiftCountFromApi = pickNumber(shiftsRes, ['today_shift_count', 'todayShiftCount', 'today_count']);
    const todayShiftCount = Number.isFinite(todayShiftCountFromApi) ? todayShiftCountFromApi : todayShiftCountFromRows;

    const publishedCountFromApi = pickNumber(shiftsRes, ['published_count', 'publishedCount']);
    const publishedCount = Number.isFinite(publishedCountFromApi) ? publishedCountFromApi : publishedCountFromRows;

    const limitedPendingActions = pendingRequests.slice(0, MAX_PENDING_ACTIONS).map((r) => {
      const rideWith = buildRideWithText(r);
      return {
        name: `${resolveRequestName(r)} | ${(r.flight_no || '--')}`,
        subname: rideWith
          ? `${rideWith} | ${t('assign_arrival_time')}${r.arrival_time_api || r.arrival_date || '--'}`
          : `${t('assign_arrival_time')}${r.arrival_time_api || r.arrival_date || '--'}`,
        request: r,
      };
    });

    const overflow = Math.max(0, pendingRequests.length - limitedPendingActions.length);
    this.setData({
      shifts,
      pendingRequests,
      pendingCount,
      todayShiftCount,
      publishedCount,
      pendingActions: limitedPendingActions,
      pendingActionOverflow: overflow,
      overflowTipText: overflow > 0
        ? `${t('dashboard_pending_pool_label')}${t('common_op_in_progress').replace('操作进行中，请稍候', '')}仅展示前${limitedPendingActions.length}条，请缩小范围`
        : '',
      loading: false,
    });

    const cache = app.globalData.dashboardCache || {};
    app.globalData.dashboardCache = {
      ...cache,
      lastLoadAt: Date.now(),
      ttlMs: Number(cache.ttlMs) || 45 * 1000,
    };
    app.clearDashboardDirty();
  },

  openPendingPool() {
    this.setTabBarHidden(true);
    this.setData({
      showPendingSheet: true,
      currentShiftIdForAdd: 0,
    });

    if (this.data.pendingActionOverflow > 0) {
      wx.showToast({ title: `仅展示前${MAX_PENDING_ACTIONS}条，请缩小范围`, icon: 'none' });
    }
  },

  onAddPassenger(e) {
    const detail = (e && e.detail) || {};
    const shiftId = Number(detail.shiftId || detail.shiftid || detail.id || 0);
    if (!shiftId) {
      wx.showToast({ title: t('dashboard_shift_id_invalid'), icon: 'none' });
      return;
    }
    if (!(this.data.pendingRequests || []).length) {
      wx.showToast({ title: t('dashboard_no_pending_students'), icon: 'none' });
      return;
    }

    this.setData({
      showPendingSheet: true,
      currentShiftIdForAdd: shiftId,
    });
    this.setTabBarHidden(true);
  },

  onManageShift(e) {
    const detail = (e && e.detail) || {};
    const shiftId = Number(detail.shiftId || detail.shiftid || detail.id || 0);
    if (!shiftId) {
      wx.showToast({ title: t('dashboard_shift_id_invalid'), icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/admin/shift-detail/index?id=${shiftId}` });
  },

  onSelectPendingRequest(e) {
    const action = this.getSelectedAction(e, this.data.pendingActions);
    const req = action.request;
    const shifts = this.data.shifts || [];

    if (!req) return;

    if (this.data.currentShiftIdForAdd) {
      this.assignStudentToShift(this.data.currentShiftIdForAdd, req.id);
      this.setData({ showPendingSheet: false, selectedPendingRequest: null });
      return;
    }

    const shiftActions = shifts.map((s) => ({
      name: `#${s.id} ${s.departure_time || '--'}`,
      subname: `${(s.driver && s.driver.name) || t('common_unassigned_driver')} | ${shiftStatusText(s.status)}`,
      shiftId: s.id,
    }));

    this.setData({
      selectedPendingRequest: req,
      shiftActions,
      showPendingSheet: false,
      showShiftPicker: true,
    });
    this.setTabBarHidden(true);
  },

  async onSelectShift(e) {
    const action = this.getSelectedAction(e, this.data.shiftActions);
    const req = this.data.selectedPendingRequest;
    if (!req || !action.shiftId) return;

    await this.assignStudentToShift(action.shiftId, req.id);
    this.setData({
      showShiftPicker: false,
      selectedPendingRequest: null,
    });
  },

  async assignStudentToShift(shiftId, requestId) {
    await this.runWithActionLock(async () => {
      try {
        const result = await api.assignStudent(shiftId, requestId);
        if (result && result.warning) {
          wx.showToast({ title: `${t('dashboard_assign_success')} (${result.warning})`, icon: 'none' });
        } else {
          wx.showToast({ title: t('dashboard_assign_success'), icon: 'success' });
        }
        await this.loadAll();
      } catch (error) {
        wx.showToast({ title: t('dashboard_assign_failed'), icon: 'none' });
      }
    });
  },

  onRemovePassenger(e) {
    const detail = (e && e.detail) || {};
    const shiftId = Number(detail.shiftId || detail.shiftid || detail.id || 0);
    if (!shiftId) {
      wx.showToast({ title: t('dashboard_shift_id_invalid'), icon: 'none' });
      return;
    }

    let requests = Array.isArray(detail.requests) ? detail.requests : [];

    if (!requests.length) {
      const shift = (this.data.shifts || []).find((s) => Number(s.id || s.ID || s.shift_id || 0) === shiftId);
      requests = shift
        ? (Array.isArray(shift.requests)
          ? shift.requests
          : (Array.isArray(shift.Requests)
            ? shift.Requests
            : (Array.isArray(shift.passengers) ? shift.passengers : [])))
        : [];
    }

    if (!requests.length && Array.isArray(detail.passengers) && detail.passengers.length) {
      requests = detail.passengers.map((item) => ({
        id: item.id || item.ID || item.request_id || 0,
        user: { name: item.name || '' },
        user_id: item.user_id || item.id || 0,
        flight_no: item.flightNo || item.flight_no || '--',
        ride_with_note: item.ride_with_note || '',
        ride_with_wechat: item.ride_with_wechat || '',
      }));
    }

    if (!requests.length) {
      wx.showToast({ title: t('dashboard_no_passengers'), icon: 'none' });
      return;
    }

    this.setData({
      removeShiftId: shiftId,
      removeActions: requests.map((r) => ({
        name: `${resolveRequestName(r)} | ${r.flight_no || '--'}`,
        subname: buildRideWithText(r),
        requestId: r.id || r.ID || r.request_id || 0,
      })),
      showRemoveSheet: true,
    });
    this.setTabBarHidden(true);
  },

  async onSelectRemoveRequest(e) {
    const action = this.getSelectedAction(e, this.data.removeActions);
    if (!action.requestId || !this.data.removeShiftId) return;

    await this.runWithActionLock(async () => {
      try {
        await api.removeStudent(this.data.removeShiftId, action.requestId);
        wx.showToast({ title: t('dashboard_remove_success'), icon: 'success' });
        this.setData({ showRemoveSheet: false, removeShiftId: 0, removeActions: [] });
        await this.loadAll();
      } catch (error) {
        wx.showToast({ title: t('dashboard_remove_failed'), icon: 'none' });
      }
    });
  },

  async onPublishShift(e) {
    const detail = (e && e.detail) || {};
    const shiftId = Number(detail.shiftId || detail.shiftid || detail.id || 0);
    if (!shiftId) return;

    await this.runWithActionLock(async () => {
      try {
        await api.publishShift(shiftId);
        wx.showToast({ title: t('dashboard_publish_success'), icon: 'success' });
        await this.loadAll();
      } catch (error) {
        wx.showToast({ title: t('dashboard_publish_failed'), icon: 'none' });
      }
    });
  },

  async runWithActionLock(task) {
    return runWithActionLock(this, task);
  },

  getSelectedAction(e, actions) {
    const detail = e.detail || {};
    if (detail.index !== undefined && actions[detail.index]) {
      return actions[detail.index];
    }
    if (detail.name !== undefined) {
      const found = actions.find((a) => a.name === detail.name);
      if (found) return found;
    }
    return detail;
  },

  onClosePendingSheet() {
    this.setTabBarHidden(false);
    this.setData({ showPendingSheet: false });
  },

  onCloseShiftPicker() {
    this.setTabBarHidden(false);
    this.setData({ showShiftPicker: false });
  },

  onCloseRemoveSheet() {
    this.setTabBarHidden(false);
    this.setData({ showRemoveSheet: false });
  },

  setTabBarHidden(hidden) {
    setTabBarHidden(this, hidden);
  },

  async onShowCreatePopup() {
    const now = Date.now();
    this.setTabBarHidden(true);
    this.setData({
      showCreatePopup: true,
      selectedDateTs: this.data.selectedDateTs || now,
      minDateTs: now,
    });
    await this.fetchDrivers();
  },

  onCloseCreatePopup() {
    this.setTabBarHidden(false);
    this.setData({ showCreatePopup: false });
  },

  async fetchDrivers() {
    try {
      const drivers = await api.getDrivers();
      const driverList = Array.isArray(drivers) ? drivers : [];
      const unnamedDriver = t('dashboard_unnamed_driver');
      const unknownCar = t('dashboard_unknown_car');
      const pickerColumns = driverList.map((item) => ({
        text: `${item.name || unnamedDriver} - ${item.car_model || unknownCar}`,
        value: item.id,
      }));
      this.setData({
        driverList,
        pickerColumns,
      });
    } catch (error) {
      wx.showToast({ title: t('dashboard_driver_load_failed'), icon: 'none' });
    }
  },

  onOpenDriverPicker() {
    if (!this.data.pickerColumns.length) {
      wx.showToast({ title: t('dashboard_no_drivers'), icon: 'none' });
      return;
    }
    this.setTabBarHidden(true);
    this.setData({ showDriverPicker: true });
  },

  onCancelDriverPicker() {
    this.setData({ showDriverPicker: false });
  },

  onConfirmDriver(event) {
    const detail = event.detail || {};
    const rawIndex = detail.index;
    const index = Array.isArray(rawIndex) ? rawIndex[0] : rawIndex;

    let driver = null;
    if (typeof index === 'number' && this.data.driverList[index]) {
      driver = this.data.driverList[index];
    }

    if (!driver) {
      const rawValue = detail.value;
      const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      const valueText = value && typeof value === 'object' ? value.text : String(value || '');
      const unnamedDriver = t('dashboard_unnamed_driver');
      const unknownCar = t('dashboard_unknown_car');
      driver = this.data.driverList.find((item) => (`${item.name || unnamedDriver} - ${item.car_model || unknownCar}`) === valueText) || null;
    }

    if (!driver) {
      this.setData({ showDriverPicker: false });
      return;
    }

    const unnamedDriver = t('dashboard_unnamed_driver');
    const unknownCar = t('dashboard_unknown_car');
    this.setData({
      selectedDriverId: driver.id,
      selectedDriverName: `${driver.name || unnamedDriver} - ${driver.car_model || unknownCar}`,
      showDriverPicker: false,
    });
  },

  onOpenDatePicker() {
    this.setTabBarHidden(true);
    this.setData({ showDatePicker: true });
  },

  onCancelDatePicker() {
    this.setData({ showDatePicker: false });
  },

  onConfirmDate(event) {
    const detail = event.detail || {};
    const timestamp = Number(detail);
    if (!timestamp) {
      this.setData({ showDatePicker: false });
      return;
    }

    this.setData({
      selectedDateTs: timestamp,
      selectedDate: formatDateOnly(timestamp),
      showDatePicker: false,
    });
    this.syncFormattedTime();
  },

  onOpenTimePicker() {
    this.setTabBarHidden(true);
    this.setData({
      selectedClock: this.data.selectedClock || '12:00',
      showTimePicker: true,
    });
  },

  onCancelTimePicker() {
    this.setData({ showTimePicker: false });
  },

  onConfirmTime(event) {
    const detail = event.detail || {};
    const raw = Array.isArray(detail) ? detail[0] : detail;
    const picked = typeof raw === 'string' ? raw : '';
    if (!picked) {
      this.setData({ showTimePicker: false });
      return;
    }

    this.setData({
      selectedClock: picked,
      showTimePicker: false,
    });
    this.syncFormattedTime();
  },

  syncFormattedTime() {
    const { selectedDate, selectedClock } = this.data;
    const formattedTime = selectedDate && selectedClock ? `${selectedDate} ${selectedClock}:00` : '';
    this.setData({ formattedTime });
  },

  resetCreateForm() {
    const now = Date.now();
    this.setData({
      selectedDriverId: null,
      selectedDriverName: '',
      selectedDate: '',
      selectedClock: '',
      selectedDateTs: now,
      minDateTs: now,
      formattedTime: '',
      showDriverPicker: false,
      showDatePicker: false,
      showTimePicker: false,
    });
  },

  async onSubmitShift() {
    if (!this.data.selectedDriverId || !this.data.formattedTime) {
      wx.showToast({ title: t('dashboard_form_incomplete'), icon: 'none' });
      return;
    }

    await this.runWithActionLock(async () => {
      try {
        await api.createShift({
          driver_id: this.data.selectedDriverId,
          departure_time: this.data.formattedTime,
        });
        wx.showToast({ title: t('dashboard_create_success'), icon: 'success' });
        this.setData({ showCreatePopup: false });
        this.resetCreateForm();
        await this.loadAll();
      } catch (error) {
        wx.showToast({ title: t('dashboard_create_failed'), icon: 'none' });
      }
    });
  },

  // 角色模拟相关方法
  onOpenRoleSimulator() {
    this.setData({ showRoleSimulator: true });
  },

  onCloseRoleSimulator() {
    this.setData({ showRoleSimulator: false });
  },

  async onSelectRole(e) {
    const detail = e.detail || {};
    const index = detail.index;
    if (index === undefined || index === null) return;

    const roleOption = this.data.roleOptions[index];
    if (!roleOption) return;

    const app = getApp();
    if (app && typeof app.setViewAsRole === 'function') {
      app.setViewAsRole(roleOption.value);
    }

    const currentEffectiveRole = app.getEffectiveRole ? app.getEffectiveRole() : roleOption.value;
    const viewAsRole = app.getViewAsRole ? app.getViewAsRole() : '';

    const toastTitle = roleOption.value === 'admin'
      ? t('dashboard_switch_admin')
      : `已切换为${roleOption.label}`;
    wx.showToast({ title: toastTitle, icon: 'success' });

    this.setData({
      isViewingAsUser: !!viewAsRole,
      currentEffectiveRole,
      showRoleSimulator: false,
    });
    this.refreshView();
  },

  onExitRoleSimulation() {
    const app = getApp();
    if (app && typeof app.resetViewAsRole === 'function') {
      app.resetViewAsRole();
    } else if (app && typeof app.setViewAsRole === 'function') {
      app.setViewAsRole('admin');
    }

    wx.showToast({ title: t('dashboard_exit_simulation'), icon: 'success' });
    this.setData({
      isViewingAsUser: false,
      currentEffectiveRole: 'admin',
    });
    this.refreshView();
  },

  refreshView() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && typeof tabBar.refreshTabs === 'function') {
      tabBar.refreshTabs();
    }
    this.loadAll();
  },

  // 日期筛选方法
  filterPrevDay() {
    const current = this.data.filterDate;
    let date;
    if (!current) {
      const today = new Date();
      today.setDate(today.getDate() - 1);
      date = this._formatDate(today);
    } else {
      const d = new Date(current + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      date = this._formatDate(d);
    }
    this.setData({ filterDate: date, filterDateLabel: date });
    this.loadAll();
  },

  filterNextDay() {
    const current = this.data.filterDate;
    let date;
    if (!current) {
      const today = new Date();
      today.setDate(today.getDate() + 1);
      date = this._formatDate(today);
    } else {
      const d = new Date(current + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      date = this._formatDate(d);
    }
    this.setData({ filterDate: date, filterDateLabel: date });
    this.loadAll();
  },

  filterPickDate() {
    const current = this.data.filterDate;
    const defaultDate = current ? new Date(current + 'T00:00:00').getTime() : Date.now();
    this.setData({ showCalendar: true, calendarDefaultDate: defaultDate });
  },

  onCalendarConfirm(e) {
    const d = e.detail;
    const date = this._formatDate(d);
    this.setData({ showCalendar: false, filterDate: date, filterDateLabel: date });
    this.loadAll();
  },

  onCalendarClose() {
    this.setData({ showCalendar: false });
  },

  filterToday() {
    const date = this._formatDate(new Date());
    this.setData({ filterDate: date, filterDateLabel: date });
    this.loadAll();
  },

  filterReset() {
    this.setData({ filterDate: null, filterDateLabel: '-' });
    this.loadAll();
  },

  _formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  },

  onQuickAssign() {
    wx.navigateTo({ url: '/pages/admin/assign/index' });
  },

  getRoleDisplayText() {
    const roleMap = {
      'student': t('dashboard_role_student'),
      'staff': t('dashboard_role_staff'),
      'driver': t('dashboard_role_driver'),
      'admin': t('dashboard_role_admin'),
    };
    return roleMap[this.data.currentEffectiveRole] || this.data.currentEffectiveRole;
  },
});
