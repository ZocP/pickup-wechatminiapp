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
          text: '首页',
          iconPath: '/assets/tabbar/home.png',
          selectedIconPath: '/assets/tabbar/home-active.png',
        },
        {
          pagePath: '/pages/admin/dashboard/index',
          text: '调度',
          iconPath: '/assets/tabbar/dashboard.png',
          selectedIconPath: '/assets/tabbar/dashboard-active.png',
          manageOnly: true,
        },
        {
          pagePath: '/pages/profile/index',
          text: '我的',
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
