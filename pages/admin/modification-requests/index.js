const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');

Page({
  data: {
    i18n: {},
    activeTab: 'pending',
    tabs: [],
    list: [],
    loading: false,
  },

  onLoad() {
    this.setData({
      i18n: {
        mod_review_title: t('mod_review_title'),
        mod_review_tab_all: t('mod_review_tab_all'),
        mod_review_tab_pending: t('mod_review_tab_pending'),
        mod_review_tab_approved: t('mod_review_tab_approved'),
        mod_review_tab_rejected: t('mod_review_tab_rejected'),
        mod_review_reason_label: t('mod_review_reason_label'),
        mod_review_status_label: t('mod_review_status_label'),
        mod_review_time_label: t('mod_review_time_label'),
        mod_review_approve: t('mod_review_approve'),
        mod_review_reject: t('mod_review_reject'),
        mod_review_approve_confirm: t('mod_review_approve_confirm'),
        mod_review_reject_confirm: t('mod_review_reject_confirm'),
        mod_review_op_success: t('mod_review_op_success'),
        mod_review_op_fail: t('mod_review_op_fail'),
        mod_review_empty: t('mod_review_empty'),
      },
      tabs: [
        { name: 'pending', title: t('mod_review_tab_pending') },
        { name: '', title: t('mod_review_tab_all') },
        { name: 'approved', title: t('mod_review_tab_approved') },
        { name: 'rejected', title: t('mod_review_tab_rejected') },
      ],
    });
    wx.setNavigationBarTitle({ title: t('mod_review_nav_title') });
  },

  onShow() {
    this.loadList();
  },

  async onPullDownRefresh() {
    try {
      await this.loadList();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.name });
    this.loadList();
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const status = this.data.activeTab || '';
      const result = await api.getModificationRequests(status);
      const statusMap = {
        'pending': '待分配',
        'assigned': '已分配',
        'published': '已发布',
      };
      const list = Array.isArray(result) ? result.map(item => ({
        ...item,
        formattedTime: item.created_at ? item.created_at.replace('T', ' ').substring(0, 16) : '--',
        formattedNewArrival: item.new_arrival_time ? item.new_arrival_time.replace('T', ' ').substring(0, 16) : '--',
        statusLabel: statusMap[item.request_status] || item.request_status || '--',
      })) : [];
      this.setData({ list });
    } catch (e) {
      wx.showToast({ title: this.data.i18n.mod_review_op_fail, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onApprove(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认',
      content: this.data.i18n.mod_review_approve_confirm,
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.approveModification(id);
            wx.showToast({ title: this.data.i18n.mod_review_op_success, icon: 'success' });
            this.loadList();
          } catch (err) {
            wx.showToast({ title: (err && err.message) || this.data.i18n.mod_review_op_fail, icon: 'none' });
          }
        }
      },
    });
  },

  onReject(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认',
      content: this.data.i18n.mod_review_reject_confirm,
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.rejectModification(id);
            wx.showToast({ title: this.data.i18n.mod_review_op_success, icon: 'success' });
            this.loadList();
          } catch (err) {
            wx.showToast({ title: (err && err.message) || this.data.i18n.mod_review_op_fail, icon: 'none' });
          }
        }
      },
    });
  },
});
