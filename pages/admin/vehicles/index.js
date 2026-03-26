const api = require('../../../utils/api');
const { t } = require('../../../utils/i18n');

function buildI18n() {
  return {
    vehicles_title:          t('vehicles_title'),
    vehicles_add_btn:        t('vehicles_add_btn'),
    vehicles_empty:          t('vehicles_empty'),
    vehicles_seats:          t('vehicles_seats'),
    vehicles_checked:        t('vehicles_checked'),
    vehicles_carryon:        t('vehicles_carryon'),
    vehicles_delete_title:   t('vehicles_delete_title'),
    vehicles_delete_success: t('vehicles_delete_success'),
    common_confirm:          t('common_confirm'),
    common_cancel:           t('common_cancel'),
    vehicles_delete_btn:     t('vehicles_delete_btn'),
  };
}

Page({
  data: {
    i18n: {},
    loading: false,
    vehicleList: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: t('vehicles_title') });
    this.setData({ i18n: buildI18n() });
  },

  onShow() {
    this.setData({ i18n: buildI18n() });
    this.resetAndLoad();
  },

  async onPullDownRefresh() {
    try {
      await this.resetAndLoad();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadVehicles();
    }
  },

  resetAndLoad() {
    this.setData({ page: 1, vehicleList: [], hasMore: true });
    return this.loadVehicles();
  },

  async loadVehicles() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await api.getVehicles(this.data.page, this.data.pageSize);
      const rawList = Array.isArray(res) ? res : (res && res.vehicles ? res.vehicles : []);
      const list = rawList.map(item => ({ ...item, id: item.id || item.ID }));
      const hasMore = list.length >= this.data.pageSize;
      this.setData({
        vehicleList: this.data.page === 1 ? list : this.data.vehicleList.concat(list),
        page: this.data.page + 1,
        hasMore,
      });
    } catch (e) {
      console.error('loadVehicles error', e);
      wx.showToast({ title: t('operation_failed'), icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/admin/vehicle-form/index' });
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/admin/vehicle-form/index?id=${id}` });
  },

  onDeleteVehicle(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: this.data.i18n.vehicles_delete_title,
      content: ' ',
      confirmText: this.data.i18n.common_confirm,
      cancelText: this.data.i18n.common_cancel,
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.deleteVehicle(id);
            wx.showToast({ title: that.data.i18n.vehicles_delete_success, icon: 'success' });
            that.resetAndLoad();
          } catch (err) {
            console.error('deleteVehicle error', err);
            wx.showToast({ title: t('operation_failed'), icon: 'none' });
          }
        }
      },
    });
  },
});
