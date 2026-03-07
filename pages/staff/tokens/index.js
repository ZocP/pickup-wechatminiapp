const api = require('../../../utils/api');
const Dialog = require('../../../miniprogram_npm/@vant/weapp/dialog/dialog').default;

function formatTime(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
    wx.setNavigationBarTitle({ title: 'Token 管理' });
    this.loadList(true);
  },

  onShow() {
    const app = getApp();
    const role = app.getEffectiveRole ? app.getEffectiveRole() : 'student';
    if (role !== 'admin' && role !== 'staff') {
      wx.showToast({ title: '权限不足', icon: 'none' });
      wx.navigateBack();
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
      const res = await api.getTokenList({ page: this.data.page, per_page: 20 });
      const items = Array.isArray(res) ? res : (res && res.data ? res.data : []);

      const formatted = items.map((item) => ({
        ...item,
        created_at_text: formatTime(item.created_at),
        used_by_name: item.used_by ? (item.used_by.name || '用户#' + item.used_by.id) : '',
      }));

      this.setData({
        list: reset ? formatted : this.data.list.concat(formatted),
        page: this.data.page + 1,
        hasMore: items.length >= 20,
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
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
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!formPayment) {
      wx.showToast({ title: '请选择付款方式', icon: 'none' });
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      await api.generateToken({
        name: formName.trim(),
        payment_method: formPayment,
        amount: Number(formAmount),
      });

      wx.showToast({ title: '生成成功', icon: 'success' });
      this.setData({ showForm: false });
      this.loadList(true);
    } catch (err) {
      wx.showToast({ title: '生成失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onRevoke(e) {
    const id = e.currentTarget.dataset.id;
    Dialog.confirm({
      title: '确认作废',
      message: '作废后该注册码将无法使用，是否继续？',
    }).then(() => {
      this.doRevoke(id);
    }).catch(() => {});
  },

  async doRevoke(id) {
    try {
      await api.revokeToken(id);
      wx.showToast({ title: '已作废', icon: 'success' });
      this.loadList(true);
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onCopy(e) {
    const code = e.currentTarget.dataset.code;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },
});
