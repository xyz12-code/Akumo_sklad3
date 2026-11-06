(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AkumoStorage = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HISTORY_KEY = 'akumoSklad3.history';
  const FAVORITES_KEY = 'akumoSklad3.favorites';

  function readList(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string').slice(0, 12) : [];
    } catch {
      return [];
    }
  }

  function writeList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list.slice(0, 12)));
    } catch {
      /* private mode / blocked storage */
    }
  }

  function getHistory() {
    return readList(HISTORY_KEY);
  }

  function rememberQuery(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return getHistory();
    const next = [trimmed, ...getHistory().filter((item) => item.toLowerCase() !== trimmed.toLowerCase())];
    writeList(HISTORY_KEY, next);
    return next;
  }

  function getFavorites() {
    return readList(FAVORITES_KEY);
  }

  function toggleFavorite(code) {
    const value = String(code || '').trim().toUpperCase();
    if (!value) return getFavorites();
    const current = getFavorites();
    const exists = current.some((item) => item.toUpperCase() === value);
    const next = exists
      ? current.filter((item) => item.toUpperCase() !== value)
      : [value, ...current];
    writeList(FAVORITES_KEY, next);
    return next;
  }

  function isFavorite(code) {
    const value = String(code || '').trim().toUpperCase();
    return getFavorites().some((item) => item.toUpperCase() === value);
  }

  return { getHistory, rememberQuery, getFavorites, toggleFavorite, isFavorite };
});
