(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AkumoNormalize = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DIACRITICS = /[\u0300-\u036f]/g;

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(DIACRITICS, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  function compact(value) {
    return normalize(value).replace(/\s+/g, '');
  }

  function sectionOf(code) {
    const match = String(code || '').match(/^[A-Za-z]+/);
    return match ? match[0].toUpperCase() : '';
  }

  function isDrawerCode(value) {
    return /^[A-Za-z]+\d+$/.test(String(value || '').replace(/\s+/g, ''));
  }

  return { normalize, compact, sectionOf, isDrawerCode };
});
