const { t } = require('./i18n');

function normalizeStatus(status) {
  return String(status || '').toLowerCase().trim();
}

/**
 * 统一班次状态标准化 — draft → unpublished
 */
function normalizeShiftStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'draft') return 'unpublished';
  return value || 'unpublished';
}

/**
 * 申请状态中文文本（i18n）
 */
function requestStatusText(status) {
  const value = normalizeStatus(status);
  if (value === 'pending') return t('status_pending');
  if (value === 'assigned') return t('status_assigned');
  if (value === 'published') return t('status_published');
  return status || '--';
}

module.exports = {
  normalizeStatus,
  normalizeShiftStatus,
  requestStatusText,
};
