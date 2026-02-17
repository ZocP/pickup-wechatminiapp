const request = require('./request');

module.exports = {
  health() {
    return request.get('/health');
  },

  authLogin(code) {
    return request.post('/auth/login', { code });
  },

  bindPhone(phoneCode) {
    return request.post('/auth/bind-phone', { phone_code: phoneCode });
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
};
