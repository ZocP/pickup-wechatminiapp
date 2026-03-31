const locales = {
  'zh-CN': require('../locales/zh-CN.js'),
  'en': require('../locales/en.js'),
}

let currentLocale = 'zh-CN'

function setLocale(lang) {
  if (locales[lang]) currentLocale = lang
}

function getLocale() {
  return currentLocale
}

function t(key) {
  const dict = locales[currentLocale] || locales['zh-CN']
  return dict[key] || key
}

module.exports = { t, setLocale, getLocale }
