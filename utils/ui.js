/**
 * UI 工具函数
 */

/**
 * 统一设置 TabBar 显示/隐藏
 * @param {Object} page - Page 实例
 * @param {boolean} hidden - 是否隐藏
 */
function setTabBarHidden(page, hidden) {
  const tabBar = typeof page.getTabBar === 'function' && page.getTabBar();
  if (tabBar && typeof tabBar.setHidden === 'function') {
    tabBar.setHidden(!!hidden);
  }
}

module.exports = { setTabBarHidden };
