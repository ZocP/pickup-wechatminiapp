/**
 * Tests for utils/logger.js
 */

describe('utils/logger', () => {
  let originalWxConfig;

  beforeEach(() => {
    originalWxConfig = global.__wxConfig;
    jest.resetModules();
  });

  afterEach(() => {
    global.__wxConfig = originalWxConfig;
  });

  describe('in develop mode (isDev=true)', () => {
    let logError, logWarn;

    beforeEach(() => {
      global.__wxConfig = { envVersion: 'develop' };
      jest.resetModules();
      const logger = require('../../../utils/logger');
      logError = logger.logError;
      logWarn = logger.logWarn;
    });

    it('logError calls console.error with message and error', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const err = new Error('test error');
      logError('Something failed', err);
      expect(spy).toHaveBeenCalledWith('Something failed', err);
      spy.mockRestore();
    });

    it('logWarn calls console.warn with message and error', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      const err = new Error('test warning');
      logWarn('Something warned', err);
      expect(spy).toHaveBeenCalledWith('Something warned', err);
      spy.mockRestore();
    });

    it('logError handles null message', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      logError(null, null);
      expect(spy).toHaveBeenCalledWith(null, null);
      spy.mockRestore();
    });

    it('logWarn handles undefined arguments', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      logWarn(undefined, undefined);
      expect(spy).toHaveBeenCalledWith(undefined, undefined);
      spy.mockRestore();
    });

    it('logError handles string error', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      logError('msg', 'string error');
      expect(spy).toHaveBeenCalledWith('msg', 'string error');
      spy.mockRestore();
    });

    it('logWarn handles object error', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      const obj = { code: 500, message: 'server error' };
      logWarn('msg', obj);
      expect(spy).toHaveBeenCalledWith('msg', obj);
      spy.mockRestore();
    });
  });

  describe('in trial mode (isDev=true)', () => {
    beforeEach(() => {
      global.__wxConfig = { envVersion: 'trial' };
      jest.resetModules();
    });

    it('logError outputs in trial mode', () => {
      const logger = require('../../../utils/logger');
      const spy = jest.spyOn(console, 'error').mockImplementation();
      logger.logError('trial error', new Error('test'));
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('logWarn outputs in trial mode', () => {
      const logger = require('../../../utils/logger');
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      logger.logWarn('trial warn', null);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('in release mode (isDev=false)', () => {
    beforeEach(() => {
      global.__wxConfig = { envVersion: 'release' };
      jest.resetModules();
    });

    it('logError does NOT call console.error', () => {
      const logger = require('../../../utils/logger');
      const spy = jest.spyOn(console, 'error').mockImplementation();
      logger.logError('should be silent', new Error('test'));
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('logWarn does NOT call console.warn', () => {
      const logger = require('../../../utils/logger');
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      logger.logWarn('should be silent', new Error('test'));
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('when __wxConfig is undefined (fallback isDev=true)', () => {
    beforeEach(() => {
      delete global.__wxConfig;
      jest.resetModules();
    });

    it('logError outputs (defaults to dev mode)', () => {
      const logger = require('../../../utils/logger');
      const spy = jest.spyOn(console, 'error').mockImplementation();
      logger.logError('fallback dev', 'err');
      expect(spy).toHaveBeenCalledWith('fallback dev', 'err');
      spy.mockRestore();
    });

    it('logWarn outputs (defaults to dev mode)', () => {
      const logger = require('../../../utils/logger');
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      logger.logWarn('fallback dev', 'warn');
      expect(spy).toHaveBeenCalledWith('fallback dev', 'warn');
      spy.mockRestore();
    });
  });
});
