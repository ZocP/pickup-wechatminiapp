const { t } = require('../utils/i18n');

Component({
  data: {
    selected: '/pages/home/index',
    list: [],
    hidden: false,
  },

  lifetimes: {
    attached() {
      this.refreshTabs();
    },
  },

  methods: {
    setHidden(hidden) {
      this.setData({ hidden: !!hidden });
    },

    refreshTabs() {
      const app = getApp();
      const effectiveRole = app.getEffectiveRole();

      const baseList = [
        {
          pagePath: '/pages/home/index',
          text: t('tab_home'),
          iconPath: '/assets/tabbar/home.png',
          selectedIconPath: '/assets/tabbar/home-active.png',
        },
        {
          pagePath: '/pages/admin/dashboard/index',
          text: t('tab_dispatch'),
          iconPath: '/assets/tabbar/dashboard.png',
          selectedIconPath: '/assets/tabbar/dashboard-active.png',
          manageOnly: true,
        },
        {
          pagePath: '/pages/profile/index',
          text: t('tab_profile'),
          iconPath: '/assets/tabbar/profile.png',
          selectedIconPath: '/assets/tabbar/profile-active.png',
        },
      ];

      const canManage = effectiveRole === 'admin' || effectiveRole === 'staff';
      const list = baseList.filter((item) => !(item.manageOnly && !canManage));
      this.setData({ list });
    },

    onSwitchTab(e) {
      const pagePath = e.currentTarget.dataset.path;
      if (!pagePath || pagePath === this.data.selected) return;
      wx.switchTab({ url: pagePath });
    },
  },
});
