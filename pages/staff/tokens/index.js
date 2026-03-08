const api = require('../../../utils/api');
const { formatDateTime } = require('../../../utils/formatters');
const { t } = require('../../../utils/i18n');
const Dialog = require('../../../miniprogram_npm/@vant/weapp/dialog/dialog').default;

Page({
  data: {
    loading: false,
    list: [],
    showForm: false,
    formName: '',
    formPayment: '',
    formAmount: '',
    submitting: false,
    showPaymentPicker: false,
    paymentMethods: ['微信转账', '支付宝', '银行转账', '现金', '其他'],
    page: 1,
    hasMore: true,
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('tokens_nav_title') });
    this.loadList(true);
  },

  onShow() {
    const app = getApp();
    const role = app.getEffectiveRole ? app.getEffectiveRole() : 'student';
    if (role !== 'admin' && role !== 'staff') {
      wx.showToast({ title: t('tokens_no_permission'), icon: 'none' });
      wx.navigateBack({ delta: 1, fail: () => { wx.reLaunch({ url: '/pages/home/index' }); } });
    }
  },

  onPullDownRefresh() {
    this.loadList(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList(false);
    }
  },

  async loadList(reset) {
    if (reset) {
      this.setData({ page: 1, hasMore: true, list: [] });
    }

    this.setData({ loading: true });

    try {
      const res = await api.getTokenList({ page: this.data.page, page_size: 20 });
      const items = Array.isArray(res) ? res : (res && Array.isArray(res.tokens) ? res.tokens : []);

      const formatted = items.map((item) => ({
        ...item,
        created_at_text: formatDateTime(item.created_at),
        expires_at_text: item.status === 'unused' && item.expires_at ? formatDateTime(item.expires_at) : '',
        used_by_name: item.used_by_user ? (item.used_by_user.name || t('tokens_user_prefix') + item.used_by_user.id) : '',
      }));

      this.setData({
        list: reset ? formatted : this.data.list.concat(formatted),
        page: this.data.page + 1,
        hasMore: (res && res.total != null) ? (this.data.page * 20 < res.total) : items.length >= 20,
      });
    } catch (err) {
      wx.showToast({ title: t('tokens_load_failed'), icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onShowForm() {
    this.setData({ showForm: true, formName: '', formPayment: '', formAmount: '' });
  },

  onHideForm() {
    this.setData({ showForm: false });
  },

  onFormName(e) {
    this.setData({ formName: e.detail || '' });
  },

  onFormAmount(e) {
    this.setData({ formAmount: e.detail || '' });
  },

  onShowPaymentPicker() {
    this.setData({ showPaymentPicker: true });
  },

  onHidePaymentPicker() {
    this.setData({ showPaymentPicker: false });
  },

  onPaymentConfirm(e) {
    const value = e.detail && e.detail.value;
    this.setData({ formPayment: value || '', showPaymentPicker: false });
  },

  async onGenerate() {
    const { formName, formPayment, formAmount } = this.data;

    if (!formName.trim()) {
      wx.showToast({ title: t('tokens_name_required'), icon: 'none' });
      return;
    }
    if (!formPayment) {
      wx.showToast({ title: t('tokens_payment_required'), icon: 'none' });
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      wx.showToast({ title: t('tokens_amount_invalid'), icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      await api.generateToken({
        name: formName.trim(),
        payment_method: formPayment,
        amount: Number(formAmount),
      });

      wx.showToast({ title: t('tokens_generate_success'), icon: 'success' });
      this.setData({ showForm: false });
      this.loadList(true);
    } catch (err) {
      wx.showToast({ title: t('tokens_generate_failed'), icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onRevoke(e) {
    const id = e.currentTarget.dataset.id;
    Dialog.confirm({
      title: t('tokens_revoke_title'),
      message: t('tokens_revoke_confirm'),
    }).then(() => {
      this.doRevoke(id);
    }).catch(() => {});
  },

  async doRevoke(id) {
    try {
      await api.revokeToken(id);
      wx.showToast({ title: t('tokens_revoke_success'), icon: 'success' });
      this.loadList(true);
    } catch (err) {
      wx.showToast({ title: t('tokens_op_failed'), icon: 'none' });
    }
  },

  onCopy(e) {
    const code = e.currentTarget.dataset.code;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: t('tokens_copied'), icon: 'success' }),
    });
  },
});
