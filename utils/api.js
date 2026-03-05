const request = require('./request');

module.exports = {
  health() {
    return request.get('/health');
  },

  authLogin(code) {
    return request.post('/auth/login', { code });
  },

  authRefresh(refreshToken) {
    return request.post('/auth/refresh', { refresh_token: refreshToken });
  },

  bindPhone(phoneCode) {
    return request.post('/auth/bind-phone', { phone_code: phoneCode });
  },

  bindWechatID(wechatID) {
    return request.post('/auth/bind-wechat-id', { wechat_id: wechatID });
  },

  bindProfile(payload) {
    return request.post('/auth/bind-profile', payload);
  },

  getAuthMe() {
    return request.get('/auth/me');
  },

  getDashboard() {
    return request.get('/admin/shifts/dashboard');
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

  createShift(payload) {
    return request.post('/admin/shifts', payload);
  },

  updateShift(id, payload) {
    return request.put(`/admin/shifts/${id}`, payload);
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

  assignStaff(shiftId, staffId) {
    return request.post(`/admin/shifts/${shiftId}/assign-staff`, { staff_id: staffId });
  },

  removeStaff(shiftId, staffId) {
    return request.post(`/admin/shifts/${shiftId}/remove-staff`, { staff_id: staffId });
  },

  createStudentRequest(payload) {
    return request.post('/student/requests', payload);
  },

  getMyStudentRequests() {
    return request.get('/student/requests/my');
  },

  updateStudentRequest(id, payload) {
    return request.put(`/student/requests/${id}`, payload);
  },

  // 司机相关接口
  getDriverShifts() {
    return request.get('/driver/shifts');
  },

  getDriverShiftDetail(shiftId) {
    return request.get(`/driver/shifts/${shiftId}`);
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
};