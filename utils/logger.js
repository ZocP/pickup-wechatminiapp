/**
 * 统一日志工具
 * 开发环境输出，生产环境静默
 */

const isDev = typeof __wxConfig !== 'undefined'
  ? __wxConfig.envVersion === 'develop' || __wxConfig.envVersion === 'trial'
  : true;

function logError(msg, err) {
  if (isDev) {
    console.error(msg, err);
  }
}

function logWarn(msg, err) {
  if (isDev) {
    console.warn(msg, err);
  }
}

module.exports = { logError, logWarn };
