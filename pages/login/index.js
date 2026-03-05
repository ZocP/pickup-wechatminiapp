const api = require('../../utils/api');
const { t } = require('../../utils/i18n');

function getCurrentBaseURL() {
  return wx.getStorageSync('baseURL') || 'http://192.168.50.94:9090/api/v1';
}

Page({
  data: {
    i18n: {},
    loading: false,
  },

  onLoad() {
    this.setData({
      i18n: {
        login_title: t('login_title'),
        login_subtitle: t('login_subtitle'),
        login_notice: t('login_notice'),
        login_btn: t('login_btn'),
      },
    });
    wx.setNavigationBarTitle({ title: t('login_nav_title') });
  },

  onPullDownRefresh() {
    wx.stopPullDownRefresh();
  },

  getRuntimeAppId() {
    try {
      const info = wx.getAccountInfoSync();
      return (info && info.miniProgram && info.miniProgram.appId) || '';
    } catch (e) {
      return '';
    }
  },

  async onLogin() {
    await this.doWechatLogin();
  },

  async doWechatLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      let result = await this.loginOnce();

      if (!result || !result.token) {
        throw new Error(t('login_response_error'));
      }

      wx.setStorageSync('token', result.token);
      if (result.refresh_token) {
        wx.setStorageSync('refresh_token', result.refresh_token);
      }
      wx.setStorageSync('userInfo', result.user || {});
      getApp().setUserInfo(result.user || {});

      const me = await api.getAuthMe();
      const mergedUser = { ...(result.user || {}), ...(me || {}) };
      wx.setStorageSync('userInfo', mergedUser);
      getApp().setUserInfo(mergedUser);

      wx.showToast({ title: t('login_success'), icon: 'success' });

      const wechatID = String((mergedUser && mergedUser.wechat_id) || '').trim();
      if (!wechatID) {
        wx.reLaunch({ url: '/pages/bind/index' });
        return;
      }

      const role = (mergedUser && mergedUser.role) || 'student';
      if (role === 'admin' || role === 'staff') {
        wx.switchTab({ url: '/pages/admin/dashboard/index' });
      } else {
        wx.switchTab({ url: '/pages/home/index' });
      }
    } catch (error) {
      const message = (error && error.message) || t('login_failed');
      const runtimeAppId = this.getRuntimeAppId();

      if (/40013|invalid appid/i.test(message)) {
        if (error && error.origin === 'backend-auth') {
          wx.showModal({
            title: t('login_backend_title'),
            content: `wx.login 已拿到 code，后端换取 session_key 时返回 40013。请检查后端使用的 appid/appsecret 是否与当前小程序一致。\n运行时 AppID：${runtimeAppId || '未获取到'}\n当前 API：${error.baseURL || getCurrentBaseURL()}`,
            showCancel: false,
          });
        } else {
          wx.showModal({
            title: t('login_appid_title'),
            content: `wx.login 返回 40013。当前运行时 AppID：${runtimeAppId || '未获取到'}。请在开发者工具"项目详情"确认 AppID 与 project.config.json 一致，并重新导入项目。`,
            showCancel: false,
          });
        }
      }

      wx.showToast({
        title: message,
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (!res.code) {
            reject(new Error(t('login_code_failed')));
            return;
          }
          resolve(res);
        },
        fail: (err) => {
          const errMsg = (err && err.errMsg) || 'wx.login 失败';
          reject(new Error(errMsg));
        },
      });
    });
  },

  async loginOnce() {
    const loginRes = await this.wxLogin();

    try {
      return await api.authLogin(loginRes.code);
    } catch (err) {
      const serverMsg = (err && err.message) || '后端登录接口失败';
      const wrapped = new Error(`后端 auth/login 失败：${serverMsg}`);
      wrapped.origin = 'backend-auth';
      wrapped.baseURL = getCurrentBaseURL();
      throw wrapped;
    }
  },
});
