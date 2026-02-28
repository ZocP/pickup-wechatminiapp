const api = require('../../../utils/api');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function formatDateOnly(timestamp) {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

function resolveRequestName(request) {
  const user = (request && request.user) || {};
  const name = user.name
    || user.real_name
    || user.user_name
    || user.nickname
    || request.real_name
    || request.passenger_name
    || request.user_name
    || request.student_name
    || request.nickname
    || request.name
    || '';
  const normalized = String(name || '').trim();
  if (normalized) return normalized;
  return `学生#${request.user_id || request.id || '--'}`;
}

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
  const roots = [payload, unwrapPayload(payload), unwrapPayload(unwrapPayload(payload)?.data)].filter(Boolean);
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

function normalizeShiftStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'draft') return 'unpublished';
  return value || 'unpublished';
}

function shiftStatusText(status) {
  return normalizeShiftStatus(status) === 'published' ? '已发布' : '未发布';
}

const MAX_PENDING_ACTIONS = 40;

Page({
  data: {
    loading: false,
    shifts: [],
    pendingRequests: [],

    pendingCount: 0,
    todayShiftCount: 0,
    publishedCount: 0,
    pendingActionOverflow: 0,

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
  },

  onShow() {
    const app = getApp();
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
      wx.showToast({ title: '仅管理员可访问', icon: 'none' });
      wx.switchTab({ url: '/pages/home/index' });
      return;
    }

    this.loadAll();
  },

  async onPullDownRefresh() {
    await this.loadAll();
    wx.stopPullDownRefresh();
  },

  async loadAll() {
    this.setData({ loading: true });

    const [dashboardResult, pendingResult] = await Promise.allSettled([
      api.getDashboard(),
      api.getPendingRequests(),
    ]);

    const shiftsRes = dashboardResult.status === 'fulfilled' ? dashboardResult.value : [];
    const pendingRes = pendingResult.status === 'fulfilled' ? pendingResult.value : [];

    if (dashboardResult.status === 'rejected' && pendingResult.status === 'rejected') {
      wx.showToast({ title: '加载失败，请下拉重试', icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    if (dashboardResult.status === 'rejected' || pendingResult.status === 'rejected') {
      wx.showToast({ title: '部分数据加载失败', icon: 'none' });
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

    const pendingCount = pickNumber(shiftsRes, ['pending_count', 'pendingCount'])
      ?? pickNumber(pendingRes, ['pending_count', 'pendingCount', 'total'])
      ?? pendingRequests.length;
    const todayShiftCount = pickNumber(shiftsRes, ['today_shift_count', 'todayShiftCount', 'today_count'])
      ?? todayShiftCountFromRows;
    const publishedCount = pickNumber(shiftsRes, ['published_count', 'publishedCount'])
      ?? publishedCountFromRows;

    const limitedPendingActions = pendingRequests.slice(0, MAX_PENDING_ACTIONS).map((r) => ({
      name: `${resolveRequestName(r)} | ${(r.flight_no || '--')}`,
      subname: `落地: ${r.arrival_time_api || r.arrival_date || '--'}`,
      request: r,
    }));

    this.setData({
      shifts,
      pendingRequests,
      pendingCount,
      todayShiftCount,
      publishedCount,
      pendingActions: limitedPendingActions,
      pendingActionOverflow: Math.max(0, pendingRequests.length - limitedPendingActions.length),
      loading: false,
    });
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
      wx.showToast({ title: '班次ID无效', icon: 'none' });
      return;
    }
    if (!(this.data.pendingRequests || []).length) {
      wx.showToast({ title: '当前无待分配学生', icon: 'none' });
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
      wx.showToast({ title: '班次ID无效', icon: 'none' });
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
      subname: `${(s.driver && s.driver.name) || '未分配司机'} | ${shiftStatusText(s.status)}`,
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
    try {
      const result = await api.assignStudent(shiftId, requestId);
      if (result && result.warning) {
        wx.showToast({ title: `已分配 (${result.warning})`, icon: 'none' });
      } else {
        wx.showToast({ title: '分配成功', icon: 'success' });
      }
      await this.loadAll();
    } catch (error) {
      wx.showToast({ title: '分配失败', icon: 'none' });
    }
  },

  onRemovePassenger(e) {
    const detail = (e && e.detail) || {};
    const shiftId = Number(detail.shiftId || detail.shiftid || detail.id || 0);
    if (!shiftId) {
      wx.showToast({ title: '班次ID无效', icon: 'none' });
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
      }));
    }

    if (!requests.length) {
      wx.showToast({ title: '当前班次暂无乘客', icon: 'none' });
      return;
    }

    this.setData({
      removeShiftId: shiftId,
      removeActions: requests.map((r) => ({
        name: `${resolveRequestName(r)} | ${r.flight_no || '--'}`,
        requestId: r.id || r.ID || r.request_id || 0,
      })),
      showRemoveSheet: true,
    });
    this.setTabBarHidden(true);
  },

  async onSelectRemoveRequest(e) {
    const action = this.getSelectedAction(e, this.data.removeActions);
    if (!action.requestId || !this.data.removeShiftId) return;

    try {
      await api.removeStudent(this.data.removeShiftId, action.requestId);
      wx.showToast({ title: '移出成功', icon: 'success' });
      this.setData({ showRemoveSheet: false, removeShiftId: 0, removeActions: [] });
      await this.loadAll();
    } catch (error) {
      wx.showToast({ title: '移出失败', icon: 'none' });
    }
  },

  async onPublishShift(e) {
    const detail = (e && e.detail) || {};
    const shiftId = Number(detail.shiftId || detail.shiftid || detail.id || 0);
    if (!shiftId) return;

    try {
      await api.publishShift(shiftId);
      wx.showToast({ title: '发布成功', icon: 'success' });
      await this.loadAll();
    } catch (error) {
      wx.showToast({ title: '发布失败', icon: 'none' });
    }
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
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar && typeof tabBar.setHidden === 'function') {
      tabBar.setHidden(!!hidden);
    }
  },

  async onShowCreatePopup() {
    const now = Date.now();
    this.setData({
      showCreatePopup: true,
      selectedDateTs: this.data.selectedDateTs || now,
      minDateTs: now,
    });
    await this.fetchDrivers();
  },

  onCloseCreatePopup() {
    this.setData({ showCreatePopup: false });
  },

  async fetchDrivers() {
    try {
      const drivers = await api.getDrivers();
      const driverList = Array.isArray(drivers) ? drivers : [];
      const pickerColumns = driverList.map((item) => ({
        text: `${item.name || '未命名司机'} - ${item.car_model || '未知车型'}`,
        value: item.id,
      }));
      this.setData({
        driverList,
        pickerColumns,
      });
    } catch (error) {
      wx.showToast({ title: '司机列表加载失败', icon: 'none' });
    }
  },

  onOpenDriverPicker() {
    if (!this.data.pickerColumns.length) {
      wx.showToast({ title: '暂无可选司机', icon: 'none' });
      return;
    }
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
      driver = this.data.driverList.find((item) => (`${item.name || '未命名司机'} - ${item.car_model || '未知车型'}`) === valueText) || null;
    }

    if (!driver) {
      this.setData({ showDriverPicker: false });
      return;
    }

    this.setData({
      selectedDriverId: driver.id,
      selectedDriverName: `${driver.name || '未命名司机'} - ${driver.car_model || '未知车型'}`,
      showDriverPicker: false,
    });
  },

  onOpenDatePicker() {
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
      wx.showToast({ title: '请先完善司机与发车时间', icon: 'none' });
      return;
    }

    try {
      await api.createShift({
        driver_id: this.data.selectedDriverId,
        departure_time: this.data.formattedTime,
      });
      wx.showToast({ title: '创建成功', icon: 'success' });
      this.setData({ showCreatePopup: false });
      this.resetCreateForm();
      await this.loadAll();
    } catch (error) {
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },
});
