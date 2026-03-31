const request = require('./request');

module.exports = {
  // health() — 保留注释：用于后端健康检查，当前前端未调用
  // health() { return request.get('/health'); },

  authLogin(code) {
    return request.post('/auth/login', { code });
  },

  authRefresh(refreshToken) {
    return request.post('/auth/refresh', { refresh_token: refreshToken });
  },

  // bindPhone / bindWechatID — 已被 bindProfile 替代，删除

  bindProfile(payload) {
    return request.post('/auth/bind-profile', payload);
  },

  getAuthMe() {
    return request.get('/auth/me');
  },

  getDashboard(date, page, pageSize, status) {
    const params = [];
    if (date) params.push(`date=${date}`);
    if (page) params.push(`page=${page}`);
    if (pageSize) params.push(`page_size=${pageSize}`);
    if (status) params.push(`status=${status}`);
    const url = params.length ? `/admin/shifts/dashboard?${params.join('&')}` : '/admin/shifts/dashboard';
    return request.get(url);
  },

  getPendingRequests() {
    return request.get('/admin/requests/pending');
  },

  getDrivers() {
    return request.get('/admin/drivers');
  },

  updateDriver(id, payload) {
    return request.put(`/admin/drivers/${id}`, payload);
  },

  getUsers() {
    return request.get('/admin/users');
  },

  setUserAsStaff(userId) {
    return request.post(`/admin/users/${userId}/set-staff`, {});
  },

  cancelUserAsStaff(userId) {
    return request.post(`/admin/users/${userId}/unset-staff`, {});
  },

  setUserAsDriver(userId, driverId) {
    return request.post(`/admin/users/${userId}/set-driver`, { driver_id: driverId });
  },

  cancelUserAsDriver(userId) {
    return request.post(`/admin/users/${userId}/unset-driver`, {});
  },

  createDriver(payload) {
    return request.post('/admin/drivers', payload);
  },

  getDriver(id) {
    return request.get(`/admin/drivers/${id}`);
  },

  deleteDriver(id) {
    return request.del(`/admin/drivers/${id}`);
  },

  getShift(id) {
    return request.get(`/admin/shifts/${id}`);
  },

  createShift(payload) {
    return request.post('/admin/shifts', payload);
  },

  updateShift(id, payload) {
    return request.put(`/admin/shifts/${id}`, payload);
  },

  updateShiftVehicles(id, manualVehicleCount) {
    return request.patch(`/admin/shifts/${id}/vehicles`, { manual_vehicle_count: manualVehicleCount });
  },

  publishShift(shiftId) {
    return request.post(`/admin/shifts/${shiftId}/publish`, {});
  },

  unpublishShift(shiftId) {
    return request.post(`/admin/shifts/${shiftId}/unpublish`, {});
  },

  assignStudent(shiftId, requestId) {
    return request.post(`/admin/shifts/${shiftId}/assign-student`, { request_id: requestId });
  },

  removeStudent(shiftId, requestId) {
    return request.post(`/admin/shifts/${shiftId}/remove-student`, { request_id: requestId });
  },

  // assignStaff / removeStaff — 已废弃，删除

  createStudentRequest(payload) {
    return request.post('/student/requests', payload);
  },

  getMyStudentRequests() {
    return request.get('/student/requests/my');
  },

  getStudentRequest(id) {
    return request.get(`/student/requests/${id}`);
  },

  updateStudentRequest(id, payload) {
    return request.put(`/student/requests/${id}`, payload);
  },

  // 司机相关接口
  getDriverShifts() {
    return request.get('/driver/shifts');
  },

  getShiftPassengers(shiftId) {
    return request.get(`/driver/shifts/${shiftId}/passengers`);
  },

  // 登车核销接口
  verifyBoarding(qrCode) {
    return request.post('/driver/boarding/verify', { qr_code: qrCode });
  },

  // 获取登车token（学生端）
  getBoardingToken(requestId) {
    return request.get(`/student/requests/${requestId}/boarding-token`);
  },

  // 快速分配相关接口
  getUnassignedRequests() {
    return request.get('/admin/requests/unassigned');
  },

  getAvailableShifts(arrivalTime, limit) {
    let url = `/admin/shifts/available?arrival_time=${encodeURIComponent(arrivalTime)}`;
    if (limit) url += `&limit=${limit}`;
    return request.get(url);
  },

  assignRequestToShift(requestId, shiftId) {
    return request.post(`/admin/requests/${requestId}/assign`, { shift_id: shiftId });
  },

  // 修改申请相关接口
  submitModification(requestId, data) {
    return request.post(`/student/requests/${requestId}/modification`, data);
  },

  withdrawModification(requestId) {
    return request.del(`/student/requests/${requestId}/modification`);
  },

  getModificationStatus(requestId) {
    return request.get(`/student/requests/${requestId}/modification`, {}, { showError: false });
  },

  getModificationRequests(status) {
    const query = status ? `?status=${status}` : '';
    return request.get(`/admin/modification-requests${query}`);
  },

  approveModification(id) {
    return request.post(`/admin/modification-requests/${id}/approve`, {});
  },

  rejectModification(id, adminNote) {
    return request.post(`/admin/modification-requests/${id}/reject`, { admin_note: adminNote || '' });
  },

  // 智能推荐相关接口
  suggestShifts(windowHours = 2, topN = 5) {
    return request.get(`/admin/shifts/suggest?window_hours=${windowHours}&top_n=${topN}`);
  },

  batchCreateShifts(suggestions) {
    return request.post('/admin/shifts/batch', { suggestions });
  },

  // Token 相关 API
  generateToken(data) {
    return request.post('/staff/tokens', data);
  },

  getTokenList(params) {
    return request.get('/staff/tokens', params);
  },

  revokeToken(id) {
    return request.post(`/staff/tokens/${id}/revoke`, {});
  },

  verifyToken(code) {
    return request.post('/auth/verify-token', { code });
  },

  // ─── Student Management ────────────────────────────────────────────
  getManageRequests(tab, search, page, pageSize) {
    const params = [];
    if (tab) params.push(`tab=${encodeURIComponent(tab)}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (page) params.push(`page=${page}`);
    if (pageSize) params.push(`page_size=${pageSize}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return request.get(`/admin/requests/manage${qs}`);
  },

  getRecommendShifts(requestId, limit) {
    let url = `/admin/requests/${requestId}/recommend-shifts`;
    if (limit) url += `?limit=${limit}`;
    return request.get(url);
  },

  reassignRequest(requestId, shiftId) {
    return request.post(`/admin/requests/${requestId}/reassign`, { shift_id: shiftId });
  },
};