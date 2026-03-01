const DEFAULT_BASE_URL = 'https://api.zocpstudio.com/api/v1';
const REQUEST_TIMEOUT = 15000;

function getBaseURL() {
  return DEFAULT_BASE_URL;
}

function getToken() {
  return wx.getStorageSync('token') || '';
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

function handleStatusCode(statusCode, data) {
  const serverMsg = (data && (data.message || data.error)) || '';

  if (statusCode === 401) {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    showErrorToast(serverMsg || '登录状态失效，请重新登录');

    const app = getApp && getApp();
    if (app && typeof app.onTokenExpired === 'function') {
      app.onTokenExpired();
    }
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

function request(options = {}) {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    timeout = REQUEST_TIMEOUT,
    showError = true,
  } = options;

  if (!url) {
    return Promise.reject(new Error('request url is required'));
  }

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

  return new Promise((resolve, reject) => {
    wx.request({
      url: finalURL,
      method,
      data,
      header: finalHeader,
      timeout,
      success(res) {
        const { statusCode, data: resData } = res;

        if (statusCode >= 200 && statusCode < 300) {
          resolve(resData);
          return;
        }

        if (showError) handleStatusCode(statusCode, resData);

        reject({
          statusCode,
          data: resData,
          message: (resData && (resData.message || resData.error)) || `HTTP ${statusCode} Request failed`,
        });
      },
      fail(err) {
        if (showError) showErrorToast(getNetworkFailMessage(err, finalURL));
        reject({
          statusCode: 0,
          data: null,
          message: err && err.errMsg ? err.errMsg : 'Network error',
        });
      },
    });
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
