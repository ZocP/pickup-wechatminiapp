function normalizeStatus(status) {
  return String(status || '').toLowerCase().trim();
}

function requestStatusText(status) {
  const value = normalizeStatus(status);
  if (value === 'pending') return '待分配';
  if (value === 'assigned') return '已分配待发布';
  if (value === 'published') return '已发布';
  return status || '--';
}

module.exports = {
  normalizeStatus,
  requestStatusText,
};
