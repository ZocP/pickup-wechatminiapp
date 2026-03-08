/**
 * 通用辅助函数
 */
const { t } = require('./i18n');

/**
 * 统一用户名解析 — 合并各页面的不同实现
 */
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
  return `${t('common_student_prefix')}${request.user_id || request.id || '--'}`;
}

/**
 * 构建同乘信息文本
 */
function buildRideWithText(request) {
  const note = String((request && request.ride_with_note) || '').trim();
  const wxid = String((request && request.ride_with_wechat) || '').trim();
  if (!note && !wxid) return '';
  if (note && wxid) return `${t('common_ride_with_prefix')}${note} | ${t('common_wechat_prefix')}${wxid}`;
  if (note) return `${t('common_ride_with_prefix')}${note}`;
  return `${t('common_wechat_prefix')}${wxid}`;
}

/**
 * 通用操作锁 — 防止重复操作
 * @param {Object} ctx - Page/Component 实例（需要有 data.actionBusy 和 setData）
 * @param {Function} task - 异步任务
 */
async function runWithActionLock(ctx, task) {
  if (ctx.data.actionBusy) {
    wx.showToast({ title: t('common_op_in_progress'), icon: 'none' });
    return;
  }
  ctx.setData({ actionBusy: true });
  try {
    await task();
  } finally {
    ctx.setData({ actionBusy: false });
  }
}

module.exports = {
  resolveRequestName,
  buildRideWithText,
  runWithActionLock,
};
