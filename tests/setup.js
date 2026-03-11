// Mock wx global
global.wx = {
  request: jest.fn(),
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  showToast: jest.fn(),
  showModal: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  navigateTo: jest.fn(),
  redirectTo: jest.fn(),
  switchTab: jest.fn(),
  reLaunch: jest.fn(),
  navigateBack: jest.fn(),
  getSystemInfoSync: jest.fn(() => ({ platform: 'devtools', pixelRatio: 2 })),
  login: jest.fn(),
  setNavigationBarTitle: jest.fn(),
  stopPullDownRefresh: jest.fn(),
  scanCode: jest.fn(),
  vibrateShort: jest.fn(),
  nextTick: jest.fn((cb) => cb && cb()),
  canvasToTempFilePath: jest.fn(),
  createCanvasContext: jest.fn(() => ({
    setFillStyle: jest.fn(),
    fillRect: jest.fn(),
    draw: jest.fn((_, cb) => cb && cb()),
  })),
  createSelectorQuery: jest.fn(() => ({
    in: jest.fn(() => ({
      select: jest.fn(() => ({
        fields: jest.fn(() => ({
          exec: jest.fn((cb) => cb && cb([null])),
        })),
      })),
    })),
  })),
  saveImageToPhotosAlbum: jest.fn(),
  requestSubscribeMessage: jest.fn(({ complete }) => complete && complete()),
};

// Mock __wxConfig for logger.js
global.__wxConfig = { envVersion: 'develop' };

// Mock Page and Component
global.Page = jest.fn();
global.Component = jest.fn();

// Mock getApp
global.getApp = jest.fn(() => ({
  globalData: { userInfo: null, baseUrl: 'http://localhost:9090', dashboardCache: {} },
  ensureWechatBound: jest.fn(() => true),
  markDashboardDirty: jest.fn(),
  isDashboardDirty: jest.fn(() => false),
  clearDashboardDirty: jest.fn(),
  getEffectiveRole: jest.fn(() => 'admin'),
  setViewAsRole: jest.fn(),
  getViewAsRole: jest.fn(() => ''),
  resetViewAsRole: jest.fn(),
  setUserInfo: jest.fn(),
}));

// Mock getCurrentPages
global.getCurrentPages = jest.fn(() => []);
