const DEFAULT_BASE_URL = 'https://api.zocpstudio.com/api/v1';
const REQUEST_TIMEOUT = 15000;

let isRefreshing = false;
let pendingRetryQueue = [];

function getBaseURL() {
  return DEFAULT_BASE_URL;
}

function getToken() {
  return wx.getStorageSync('token') || '';
}

function getRefreshToken() {
  return wx.getStorageSync('refresh_token') || '';
}

function joinURL(baseURL, url) {
  if (/^https?:\/\//.test(url)) return url;
  const normalizedBase = baseURL.replace(/\/$/, '');
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${normalizedBase}${normalizedPath}`;
}

function showErrorToast(message) {
  wx.showToast({
    title: message || '请求失败',
    icon: 'none',
    duration: 2200,
  });
}

function getNetworkFailMessage(err, finalURL) {
  const errMsg = (err && err.errMsg) || 'Network error';

  if (/url not in domain list/i.test(errMsg)) {
    return '请求域名未配置到小程序后台';
  }

  if (/ssl|certificate|https/i.test(errMsg)) {
    return 'HTTPS 证书或域名校验失败';
  }

  if (/timeout/i.test(errMsg)) {
    return '请求超时，请检查后端与网络';
  }

  if (/fail|error/i.test(errMsg)) {
    return `网络异常：${errMsg}`;
  }

  return `网络异常：${errMsg} (${finalURL})`;
}

function clearTokenAndRedirect(message) {
  wx.removeStorageSync('token');
  wx.removeStorageSync('refresh_token');
  wx.removeStorageSync('userInfo');
  showErrorToast(message || '登录状态失效，请重新登录');

  const app = getApp && getApp();
  if (app && app.globalData) {
    app.globalData.userInfo = { id: 0, name: '', role: 'student', phone: '', wechat_id: '' };
    app.globalData.viewAsRole = '';
  }
  if (app && typeof app.onTokenExpired === 'function') {
    app.onTokenExpired();
  }

  wx.reLaunch({ url: '/pages/login/index' });
}

function doRefreshToken() {
  return new Promise((resolve, reject) => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      reject(new Error('no refresh token'));
      return;
    }

    const baseURL = getBaseURL();
    const url = joinURL(baseURL, '/auth/refresh');

    wx.request({
      url,
      method: 'POST',
      data: { refresh_token: refreshToken },
      header: { 'Content-Type': 'application/json' },
      timeout: REQUEST_TIMEOUT,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.token) {
          wx.setStorageSync('token', res.data.token);
          if (res.data.refresh_token) {
            wx.setStorageSync('refresh_token', res.data.refresh_token);
          }
          resolve(res.data.token);
        } else {
          reject(new Error('refresh failed'));
        }
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

function handleStatusCode(statusCode, data) {
  const serverMsg = (data && (data.message || data.error)) || '';

  if (statusCode === 403 && data && data.code === 'WECHAT_NOT_BOUND') {
    const app = getApp && getApp();
    if (app && typeof app.isWechatBound === 'function' && app.isWechatBound()) {
      clearTokenAndRedirect('登录状态已过期，请重新登录');
    } else {
      showErrorToast('请先绑定微信号后再继续使用');
      wx.reLaunch({ url: '/pages/bind/index' });
    }
    return;
  }

  // 401 with TOKEN_VERSION_MISMATCH: role changed, force re-login
  if (statusCode === 401 && data && data.code === 'TOKEN_VERSION_MISMATCH') {
    clearTokenAndRedirect('权限已变更，请重新登录');
    return;
  }

  if (statusCode === 401) {
    // 401 is now handled by the auto-refresh logic in request()
    // This branch only fires for non-retryable 401s
    return;
  }

  if (statusCode === 403) {
    showErrorToast(serverMsg || '权限不足');
    return;
  }

  if (statusCode >= 500) {
    showErrorToast(serverMsg || '服务器开小差了，请稍后再试');
    return;
  }

  if (statusCode >= 400) {
    showErrorToast(serverMsg || `请求错误(${statusCode})`);
  }
}

function rawRequest(options) {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    timeout = REQUEST_TIMEOUT,
  } = options;

  const token = getToken();
  const baseURL = getBaseURL();
  const finalURL = joinURL(baseURL, url);

  const finalHeader = {
    'Content-Type': 'application/json',
    ...header,
  };

  if (token) {
    finalHeader.Authorization = `Bearer ${token}`;
  }

  const app = (typeof getApp === 'function') ? getApp() : null;
  if (app && typeof app.getViewAsRole === 'function') {
    const viewAsRole = app.getViewAsRole();
    if (viewAsRole) {
      finalHeader['X-View-As'] = viewAsRole;
    }
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: finalURL,
      method,
      data,
      header: finalHeader,
      timeout,
      success(res) {
        resolve(res);
      },
      fail(err) {
        reject({
          statusCode: 0,
          data: null,
          message: err && err.errMsg ? err.errMsg : 'Network error',
          _networkError: true,
        });
      },
    });
  });
}

function request(options = {}) {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    timeout = REQUEST_TIMEOUT,
    showError = true,
    _isRetry = false,
  } = options;

  if (!url) {
    return Promise.reject(new Error('request url is required'));
  }

  return rawRequest({ url, method, data, header, timeout })
    .then(function (res) {
      const { statusCode, data: resData } = res;

      if (statusCode >= 200 && statusCode < 300) {
        return resData;
      }

      // Auto refresh on 401 (but not if this is already a retry)
      if (statusCode === 401 && !_isRetry) {
        // If TOKEN_VERSION_MISMATCH, don't try refresh — force re-login
        if (resData && resData.code === 'TOKEN_VERSION_MISMATCH') {
          clearTokenAndRedirect('权限已变更，请重新登录');
          return Promise.reject({
            statusCode,
            data: resData,
            message: resData.error || 'Token invalidated',
          });
        }

        // Try refresh token
        if (!isRefreshing) {
          isRefreshing = true;
          return doRefreshToken()
            .then(function (newToken) {
              isRefreshing = false;
              // Retry all queued requests
              pendingRetryQueue.forEach(function (cb) { cb(newToken); });
              pendingRetryQueue = [];
              // Retry current request
              return request({
                url, method, data, header, timeout, showError,
                _isRetry: true,
              });
            })
            .catch(function () {
              isRefreshing = false;
              pendingRetryQueue.forEach(function (cb) { cb(null); });
              pendingRetryQueue = [];
              clearTokenAndRedirect('登录已过期，请重新登录');
              return Promise.reject({
                statusCode: 401,
                data: resData,
                message: 'Session expired',
              });
            });
        } else {
          // Another request is already refreshing, queue this one
          return new Promise(function (resolve, reject) {
            pendingRetryQueue.push(function (newToken) {
              if (newToken) {
                resolve(request({
                  url, method, data, header, timeout, showError,
                  _isRetry: true,
                }));
              } else {
                reject({
                  statusCode: 401,
                  data: resData,
                  message: 'Session expired',
                });
              }
            });
          });
        }
      }

      // Always handle token_required regardless of showError
      if (statusCode === 403 && resData && resData.error === 'token_required') {
        // 同步本地状态
        const userInfo = wx.getStorageSync('userInfo') || {};
        userInfo.token_verified = false;
        wx.setStorageSync('userInfo', userInfo);
        const app = getApp && getApp();
        if (app && app.globalData) {
          app.globalData.userInfo = { ...app.globalData.userInfo, token_verified: false };
        }
        const pages = getCurrentPages();
        const current = pages.length ? pages[pages.length - 1] : null;
        const currentRoute = current ? `/${current.route}` : '';
        if (currentRoute !== '/pages/token/index') {
          wx.reLaunch({ url: '/pages/token/index' });
        }
        return Promise.reject({
          statusCode,
          data: resData,
          message: resData.error || 'token_required',
        });
      }

      if (showError) handleStatusCode(statusCode, resData);

      return Promise.reject({
        statusCode,
        data: resData,
        message: (resData && (resData.message || resData.error)) || `HTTP ${statusCode} Request failed`,
      });
    })
    .catch(function (err) {
      if (err && err._networkError) {
        const baseURL = getBaseURL();
        const finalURL = joinURL(baseURL, url);
        if (showError) showErrorToast(getNetworkFailMessage(err, finalURL));
      }
      return Promise.reject(err);
    });
}

request.get = (url, data = {}, options = {}) => request({
  ...options,
  url,
  data,
  method: 'GET',
});

request.post = (url, data = {}, options = {}) => request({
  ...options,
  url,
  data,
  method: 'POST',
});

request.put = (url, data = {}, options = {}) => request({
  ...options,
  url,
  data,
  method: 'PUT',
});

request.del = (url, data = {}, options = {}) => request({
  ...options,
  url,
  data,
  method: 'DELETE',
});

module.exports = request;
