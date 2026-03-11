/**
 * Tests for utils/request.js
 *
 * Key challenge: request.js uses module-level state (isRefreshing, pendingRetryQueue).
 * We must re-require the module for tests that depend on fresh state, or carefully
 * manage test order. We use jest.isolateModules for isolation.
 */

// Helper: create a fresh request module with mocks reset
function loadRequest() {
  let mod;
  jest.isolateModules(() => {
    mod = require('../../../utils/request');
  });
  return mod;
}

// Helper: simulate wx.request behavior
function mockWxRequest(impl) {
  wx.request.mockImplementation(impl);
}

// Helper: create a wx.request mock that resolves with given response
function mockWxRequestSuccess(statusCode, data, opts = {}) {
  mockWxRequest((options) => {
    if (opts.delay) {
      setTimeout(() => options.success({ statusCode, data }), opts.delay);
    } else {
      options.success({ statusCode, data });
    }
  });
}

// Helper: create a wx.request mock that fails
function mockWxRequestFail(errMsg) {
  mockWxRequest((options) => {
    options.fail({ errMsg });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no token, no refresh token
  wx.getStorageSync.mockReturnValue('');
  // Default getApp
  global.getApp = jest.fn(() => ({
    globalData: { userInfo: null, baseUrl: 'http://localhost:9090' },
  }));
  global.getCurrentPages = jest.fn(() => []);
});

describe('request - basic functionality', () => {
  test('rejects when url is not provided', async () => {
    const request = loadRequest();
    await expect(request({})).rejects.toThrow('request url is required');
    await expect(request()).rejects.toThrow('request url is required');
  });

  test('GET request success returns response data', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, { id: 1, name: 'test' });

    const result = await request({ url: '/users/1' });
    expect(result).toEqual({ id: 1, name: 'test' });
  });

  test('POST request success', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(201, { created: true });

    const result = await request({ url: '/users', method: 'POST', data: { name: 'new' } });
    expect(result).toEqual({ created: true });
  });

  test('request.get shorthand', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, { list: [] });

    const result = await request.get('/items', { page: 1 });
    expect(result).toEqual({ list: [] });

    // Verify wx.request was called with correct params
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        data: { page: 1 },
      })
    );
  });

  test('request.post shorthand', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, { ok: true });

    const result = await request.post('/items', { title: 'hello' });
    expect(result).toEqual({ ok: true });

    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        data: { title: 'hello' },
      })
    );
  });

  test('request.put shorthand', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, { updated: true });

    await request.put('/items/1', { title: 'updated' });
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'PUT' })
    );
  });

  test('request.del shorthand', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(204, null);

    await request.del('/items/1');
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  test('request.patch shorthand', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, { patched: true });

    await request.patch('/items/1', { title: 'patched' });
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'PATCH' })
    );
  });
});

describe('request - URL construction', () => {
  test('relative URL is joined with base URL', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, {});

    await request({ url: '/users' });
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.zocpstudio.com/api/v1/users',
      })
    );
  });

  test('relative URL without leading slash', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, {});

    await request({ url: 'users' });
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.zocpstudio.com/api/v1/users',
      })
    );
  });

  test('absolute URL bypasses base URL', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, {});

    await request({ url: 'https://other.com/api/data' });
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://other.com/api/data',
      })
    );
  });
});

describe('request - headers', () => {
  test('includes Content-Type: application/json by default', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, {});

    await request({ url: '/test' });
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        header: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  test('includes Authorization header when token exists', async () => {
    const request = loadRequest();
    wx.getStorageSync.mockImplementation((key) => {
      if (key === 'token') return 'my-jwt-token';
      return '';
    });
    mockWxRequestSuccess(200, {});

    await request({ url: '/test' });
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        header: expect.objectContaining({
          Authorization: 'Bearer my-jwt-token',
        }),
      })
    );
  });

  test('no Authorization header when no token', async () => {
    const request = loadRequest();
    wx.getStorageSync.mockReturnValue('');
    mockWxRequestSuccess(200, {});

    await request({ url: '/test' });
    const callHeader = wx.request.mock.calls[0][0].header;
    expect(callHeader.Authorization).toBeUndefined();
  });

  test('custom headers are merged', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, {});

    await request({ url: '/test', header: { 'X-Custom': 'value' } });
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        header: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Custom': 'value',
        }),
      })
    );
  });

  test('X-View-As header set when getViewAsRole returns a role', async () => {
    const request = loadRequest();
    global.getApp = jest.fn(() => ({
      globalData: {},
      getViewAsRole: () => 'student',
    }));
    mockWxRequestSuccess(200, {});

    await request({ url: '/test' });
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        header: expect.objectContaining({
          'X-View-As': 'student',
        }),
      })
    );
  });

  test('X-View-As header NOT set when getViewAsRole returns empty', async () => {
    const request = loadRequest();
    global.getApp = jest.fn(() => ({
      globalData: {},
      getViewAsRole: () => '',
    }));
    mockWxRequestSuccess(200, {});

    await request({ url: '/test' });
    const callHeader = wx.request.mock.calls[0][0].header;
    expect(callHeader['X-View-As']).toBeUndefined();
  });
});

describe('request - error handling (non-401)', () => {
  test('403 rejects with error info and shows toast', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(403, { message: '权限不足' });

    await expect(request({ url: '/admin' })).rejects.toMatchObject({
      statusCode: 403,
      message: '权限不足',
    });
    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '权限不足' })
    );
  });

  test('500 rejects with server error', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(500, { error: 'Internal error' });

    await expect(request({ url: '/test' })).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(wx.showToast).toHaveBeenCalled();
  });

  test('400 error shows toast with status code', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(400, {});

    await expect(request({ url: '/test' })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(wx.showToast).toHaveBeenCalled();
  });

  test('showError=false suppresses toast for non-401 errors', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(500, { error: 'boom' });

    await expect(request({ url: '/test', showError: false })).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(wx.showToast).not.toHaveBeenCalled();
  });

  test('empty response data generates default message', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(404, null);

    await expect(request({ url: '/test' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'HTTP 404 Request failed',
    });
  });
});

describe('request - network errors', () => {
  test('network failure rejects with _networkError', async () => {
    const request = loadRequest();
    mockWxRequestFail('request:fail timeout');

    await expect(request({ url: '/test' })).rejects.toMatchObject({
      _networkError: true,
    });
    expect(wx.showToast).toHaveBeenCalled();
  });

  test('timeout error shows network error message', async () => {
    // Note: rawRequest rejects with {message: errMsg, _networkError: true}
    // but getNetworkFailMessage checks (err && err.errMsg) which is undefined
    // on the reject object, so it falls through to 'Network error' default
    // The regex checks on 'Network error' then match /fail|error/
    const request = loadRequest();
    mockWxRequestFail('request:fail timeout');

    await expect(request({ url: '/test' })).rejects.toBeDefined();
    const toastCall = wx.showToast.mock.calls[0][0];
    // The reject object doesn't have .errMsg, getNetworkFailMessage gets 'Network error'
    // which matches /fail|error/ → '网络异常：Network error'
    expect(toastCall.title).toContain('网络异常');
  });

  test('SSL error shows network error message', async () => {
    const request = loadRequest();
    mockWxRequestFail('request:fail ssl error');

    await expect(request({ url: '/test' })).rejects.toBeDefined();
    const toastCall = wx.showToast.mock.calls[0][0];
    // Same issue: errMsg is lost in rawRequest's reject transform
    expect(toastCall.title).toContain('网络异常');
  });

  test('domain error shows network error message', async () => {
    const request = loadRequest();
    mockWxRequestFail('url not in domain list');

    await expect(request({ url: '/test' })).rejects.toBeDefined();
    const toastCall = wx.showToast.mock.calls[0][0];
    expect(toastCall.title).toContain('网络异常');
  });

  test('network error suppressed when showError=false', async () => {
    const request = loadRequest();
    mockWxRequestFail('request:fail');

    await expect(request({ url: '/test', showError: false })).rejects.toBeDefined();
    expect(wx.showToast).not.toHaveBeenCalled();
  });

  test('generic network error', async () => {
    const request = loadRequest();
    mockWxRequestFail('request:fail something');

    await expect(request({ url: '/test' })).rejects.toBeDefined();
    const toastCall = wx.showToast.mock.calls[0][0];
    expect(toastCall.title).toContain('网络异常');
  });
});

describe('request - 401 auto-refresh token', () => {
  test('401 triggers token refresh and retries original request', async () => {
    const request = loadRequest();

    wx.getStorageSync.mockImplementation((key) => {
      if (key === 'refresh_token') return 'valid-refresh';
      if (key === 'token') return 'old-token';
      return '';
    });

    let callCount = 0;
    mockWxRequest((options) => {
      callCount++;
      if (options.url.includes('/auth/refresh')) {
        // Refresh succeeds
        options.success({
          statusCode: 200,
          data: { token: 'new-token', refresh_token: 'new-refresh' },
        });
      } else if (callCount === 1) {
        // First call returns 401
        options.success({ statusCode: 401, data: { error: 'token expired' } });
      } else {
        // Retry succeeds
        options.success({ statusCode: 200, data: { result: 'success' } });
      }
    });

    const result = await request({ url: '/protected' });
    expect(result).toEqual({ result: 'success' });
    expect(wx.setStorageSync).toHaveBeenCalledWith('token', 'new-token');
    expect(wx.setStorageSync).toHaveBeenCalledWith('refresh_token', 'new-refresh');
  });

  test('401 with no refresh token → redirect to login', async () => {
    const request = loadRequest();

    wx.getStorageSync.mockImplementation((key) => {
      if (key === 'refresh_token') return '';
      if (key === 'token') return 'some-token';
      return '';
    });

    mockWxRequestSuccess(401, { error: 'unauthorized' });

    await expect(request({ url: '/protected' })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Session expired',
    });
    expect(wx.removeStorageSync).toHaveBeenCalledWith('token');
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' });
  });

  test('401 with TOKEN_VERSION_MISMATCH → force re-login without refresh', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(401, { code: 'TOKEN_VERSION_MISMATCH', error: 'Token invalidated' });

    await expect(request({ url: '/protected' })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Token invalidated',
    });
    expect(wx.removeStorageSync).toHaveBeenCalledWith('token');
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' });
  });

  test('refresh token fails → redirect to login', async () => {
    const request = loadRequest();

    wx.getStorageSync.mockImplementation((key) => {
      if (key === 'refresh_token') return 'expired-refresh';
      if (key === 'token') return 'old-token';
      return '';
    });

    mockWxRequest((options) => {
      if (options.url.includes('/auth/refresh')) {
        options.success({ statusCode: 401, data: {} });
      } else {
        options.success({ statusCode: 401, data: { error: 'unauthorized' } });
      }
    });

    await expect(request({ url: '/protected' })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Session expired',
    });
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' });
  });

  test('refresh network failure → redirect to login', async () => {
    const request = loadRequest();

    wx.getStorageSync.mockImplementation((key) => {
      if (key === 'refresh_token') return 'some-refresh';
      if (key === 'token') return 'old-token';
      return '';
    });

    mockWxRequest((options) => {
      if (options.url.includes('/auth/refresh')) {
        options.fail({ errMsg: 'request:fail network error' });
      } else {
        options.success({ statusCode: 401, data: {} });
      }
    });

    await expect(request({ url: '/protected' })).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' });
  });
});

describe('request - concurrent 401 queuing', () => {
  test('concurrent 401s: only one refresh, others queue and retry after', async () => {
    const request = loadRequest();
    let refreshCallCount = 0;

    wx.getStorageSync.mockImplementation((key) => {
      if (key === 'refresh_token') return 'valid-refresh';
      if (key === 'token') return 'old-token';
      return '';
    });

    let refreshResolve;
    const refreshPromise = new Promise((resolve) => { refreshResolve = resolve; });

    let requestCallCount = 0;
    mockWxRequest((options) => {
      if (options.url.includes('/auth/refresh')) {
        refreshCallCount++;
        // Delay the refresh response
        refreshPromise.then(() => {
          options.success({
            statusCode: 200,
            data: { token: 'new-token' },
          });
        });
      } else {
        requestCallCount++;
        if (requestCallCount <= 2) {
          // First two calls return 401
          options.success({ statusCode: 401, data: {} });
        } else {
          // Retries succeed
          options.success({ statusCode: 200, data: { ok: true } });
        }
      }
    });

    // Fire two requests concurrently
    const p1 = request({ url: '/api/a' });
    const p2 = request({ url: '/api/b' });

    // Let refresh complete
    await new Promise((r) => setTimeout(r, 10));
    refreshResolve();

    const [r1, r2] = await Promise.all([p1, p2]);

    // Only one refresh should have been called
    expect(refreshCallCount).toBe(1);
    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });
  });

  test('concurrent 401s: refresh fails → all queued requests reject', async () => {
    const request = loadRequest();

    wx.getStorageSync.mockImplementation((key) => {
      if (key === 'refresh_token') return 'bad-refresh';
      if (key === 'token') return 'old-token';
      return '';
    });

    let refreshResolve;
    const refreshPromise = new Promise((resolve) => { refreshResolve = resolve; });

    let requestCallCount = 0;
    mockWxRequest((options) => {
      if (options.url.includes('/auth/refresh')) {
        refreshPromise.then(() => {
          options.success({ statusCode: 401, data: {} }); // refresh fails
        });
      } else {
        requestCallCount++;
        options.success({ statusCode: 401, data: {} });
      }
    });

    const p1 = request({ url: '/api/a' });
    const p2 = request({ url: '/api/b' });

    await new Promise((r) => setTimeout(r, 10));
    refreshResolve();

    await expect(p1).rejects.toMatchObject({ statusCode: 401 });
    await expect(p2).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('request - 403 WECHAT_NOT_BOUND', () => {
  test('403 with WECHAT_NOT_BOUND when not bound → redirect to bind', async () => {
    const request = loadRequest();
    global.getApp = jest.fn(() => ({
      globalData: { userInfo: null },
      isWechatBound: () => false,
    }));

    mockWxRequestSuccess(403, { code: 'WECHAT_NOT_BOUND' });

    await expect(request({ url: '/test' })).rejects.toMatchObject({ statusCode: 403 });
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/bind/index' });
  });

  test('403 with WECHAT_NOT_BOUND when already bound → redirect to login', async () => {
    const request = loadRequest();
    global.getApp = jest.fn(() => ({
      globalData: { userInfo: null },
      isWechatBound: () => true,
      onTokenExpired: jest.fn(),
    }));

    mockWxRequestSuccess(403, { code: 'WECHAT_NOT_BOUND' });

    await expect(request({ url: '/test' })).rejects.toMatchObject({ statusCode: 403 });
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' });
  });
});

describe('request - 403 token_required', () => {
  test('403 token_required → redirect to token page', async () => {
    const request = loadRequest();
    global.getCurrentPages = jest.fn(() => [{ route: 'pages/home/index' }]);

    mockWxRequestSuccess(403, { error: 'token_required' });

    await expect(request({ url: '/test' })).rejects.toMatchObject({
      statusCode: 403,
      message: 'token_required',
    });
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/token/index' });
  });

  test('403 token_required when already on token page → no redirect', async () => {
    const request = loadRequest();
    global.getCurrentPages = jest.fn(() => [{ route: 'pages/token/index' }]);

    mockWxRequestSuccess(403, { error: 'token_required' });

    await expect(request({ url: '/test' })).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(wx.reLaunch).not.toHaveBeenCalled();
  });

  test('403 token_required updates local userInfo.token_verified', async () => {
    const request = loadRequest();
    wx.getStorageSync.mockImplementation((key) => {
      if (key === 'userInfo') return { name: 'Test', token_verified: true };
      return '';
    });

    mockWxRequestSuccess(403, { error: 'token_required' });

    await expect(request({ url: '/test' })).rejects.toBeDefined();
    expect(wx.setStorageSync).toHaveBeenCalledWith('userInfo', expect.objectContaining({
      token_verified: false,
    }));
  });

  test('403 token_required is handled even with showError=false', async () => {
    const request = loadRequest();
    global.getCurrentPages = jest.fn(() => [{ route: 'pages/home/index' }]);

    mockWxRequestSuccess(403, { error: 'token_required' });

    await expect(request({ url: '/test', showError: false })).rejects.toMatchObject({
      statusCode: 403,
    });
    // Should still redirect even with showError=false
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/token/index' });
  });
});

describe('request - 2xx range', () => {
  test.each([200, 201, 204, 299])('status %d is treated as success', async (statusCode) => {
    const request = loadRequest();
    mockWxRequestSuccess(statusCode, { ok: true });

    const result = await request({ url: '/test' });
    expect(result).toEqual({ ok: true });
  });
});

describe('request - timeout configuration', () => {
  test('default timeout is 15000ms', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, {});

    await request({ url: '/test' });
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 15000 })
    );
  });

  test('custom timeout is passed through', async () => {
    const request = loadRequest();
    mockWxRequestSuccess(200, {});

    await request({ url: '/test', timeout: 5000 });
    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 5000 })
    );
  });
});

describe('request - 401 retry does not retry again', () => {
  test('retried request that gets 401 does NOT refresh again', async () => {
    const request = loadRequest();
    let refreshCount = 0;

    wx.getStorageSync.mockImplementation((key) => {
      if (key === 'refresh_token') return 'some-refresh';
      if (key === 'token') return 'old-token';
      return '';
    });

    mockWxRequest((options) => {
      if (options.url.includes('/auth/refresh')) {
        refreshCount++;
        options.success({
          statusCode: 200,
          data: { token: 'new-token' },
        });
      } else {
        // Always return 401 (even on retry)
        options.success({ statusCode: 401, data: { error: 'still unauthorized' } });
      }
    });

    // Should refresh once, retry once, then the retried 401 is treated as non-retryable
    await expect(request({ url: '/test' })).rejects.toMatchObject({ statusCode: 401 });
    expect(refreshCount).toBe(1);
  });
});
