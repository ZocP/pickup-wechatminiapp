function pad2(value) {
  return String(value).padStart(2, '0');
}

function normalizeDateTime(source) {
  if (!source) return null;
  const raw = String(source).trim();
  if (!raw) return null;
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateTime(input) {
  const date = normalizeDateTime(input) || (input instanceof Date ? input : null);
  if (!date || Number.isNaN(date.getTime())) return '--';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatMonthDay(date) {
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatHourMinute(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

module.exports = {
  pad2,
  normalizeDateTime,
  formatDateOnly,
  formatDateTime,
  formatMonthDay,
  formatHourMinute,
};
