const api = require('../../utils/api');

function getCurrentBaseURL() {
  return wx.getStorageSync('baseURL') || 'http://192.168.50.94:9090/api/v1';
}

Page({
  data: {
    loading: false,
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
        throw new Error('登录响应异常');
      }

      wx.setStorageSync('token', result.token);
      wx.setStorageSync('userInfo', result.user || {});
      getApp().setUserInfo(result.user || {});

      const me = await api.getAuthMe();
      const mergedUser = { ...(result.user || {}), ...(me || {}) };
      wx.setStorageSync('userInfo', mergedUser);
      getApp().setUserInfo(mergedUser);

      wx.showToast({ title: '登录成功', icon: 'success' });

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
      const message = (error && error.message) || '登录失败';
      const runtimeAppId = this.getRuntimeAppId();

      if (/40013|invalid appid/i.test(message)) {
        if (error && error.origin === 'backend-auth') {
          wx.showModal({
            title: '登录失败（后端微信配置异常）',
            content: `wx.login 已拿到 code，后端换取 session_key 时返回 40013。请检查后端使用的 appid/appsecret 是否与当前小程序一致。\n运行时 AppID：${runtimeAppId || '未获取到'}\n当前 API：${error.baseURL || getCurrentBaseURL()}`,
            showCancel: false,
          });
        } else {
          wx.showModal({
            title: '登录失败（AppID 异常）',
            content: `wx.login 返回 40013。当前运行时 AppID：${runtimeAppId || '未获取到'}。请在开发者工具“项目详情”确认 AppID 与 project.config.json 一致，并重新导入项目。`,
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
            reject(new Error('获取 code 失败'));
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
