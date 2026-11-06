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

  function parseDrawerCode(code) {
    const raw = String(code || '').trim();
    const match = raw.match(/^([A-Za-z]+)(\d+)$/);
    if (!match) {
      return { section: raw.toUpperCase(), num: Number.POSITIVE_INFINITY, raw };
    }
    return {
      section: match[1].toUpperCase(),
      num: parseInt(match[2], 10),
      raw,
    };
  }

  function compareDrawerCodes(a, b) {
    const pa = parseDrawerCode(a);
    const pb = parseDrawerCode(b);
    if (pa.section !== pb.section) return pa.section.localeCompare(pb.section, 'cs');
    if (pa.num !== pb.num) return pa.num - pb.num;
    return pa.raw.localeCompare(pb.raw, 'cs');
  }

  function czechPlural(count, one, few, many) {
    const n = Math.abs(Number(count)) || 0;
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return few;
    return many;
  }

  function formatCountLabel(parts, drawers) {
    const p = Number(parts) || 0;
    const d = Number(drawers) || 0;
    return (
      p +
      ' ' +
      czechPlural(p, 'díl', 'díly', 'dílů') +
      ' · ' +
      d +
      ' ' +
      czechPlural(d, 'šuplík', 'šuplíky', 'šuplíků')
    );
  }

  return {
    normalize,
    compact,
    sectionOf,
    isDrawerCode,
    parseDrawerCode,
    compareDrawerCodes,
    czechPlural,
    formatCountLabel,
  };
});
