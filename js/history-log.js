(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AkumoHistoryLog = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_CHARS = 256;
  const DEFAULT_TIMEOUT_MS = 4000;
  const DEFAULT_SETTLE_MS = 1000;

  /** Match Postgres char_length for common Unicode (code points). */
  function charLength(value) {
    return Array.from(String(value || '')).length;
  }

  /**
   * Prepare query for insert. DB uses btrim (ASCII spaces) + char_length.
   * Client also rejects broader Unicode whitespace-only strings (stricter UX).
   */
  function prepareDotaz(raw) {
    const original = String(raw == null ? '' : raw);
    if (!original.replace(/\s/g, '').length) {
      return { ok: false, reason: 'blank' };
    }
    // Align stored form with DB trigger btrim (spaces only on ends).
    const dotaz = original.replace(/^ +| +$/g, '');
    if (!dotaz.length) return { ok: false, reason: 'blank' };
    if (charLength(dotaz) > MAX_CHARS) return { ok: false, reason: 'too_long' };
    return { ok: true, dotaz: dotaz };
  }

  function createHistoryLogger(options) {
    const opts = options || {};
    const baseUrl = String(opts.url || '').replace(/\/$/, '');
    const key = String(opts.publishableKey || '');
    const table = String(opts.table || 'akumo_search_history');
    const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    const timeoutMs = opts.timeoutMs == null ? DEFAULT_TIMEOUT_MS : opts.timeoutMs;
    const settleMs = opts.settleMs == null ? DEFAULT_SETTLE_MS : opts.settleMs;
    let lastLogged = null;
    let settleTimer = null;
    let aborted = false;

    function endpoint() {
      return baseUrl + '/rest/v1/' + encodeURIComponent(table);
    }

    function send(dotaz) {
      if (!fetchImpl || !baseUrl || !key || aborted) {
        return Promise.resolve({ ok: false, skipped: true, reason: 'unavailable' });
      }
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer =
        controller && timeoutMs > 0
          ? setTimeout(function () {
              try {
                controller.abort();
              } catch (_) {}
            }, timeoutMs)
          : null;

      const headers = {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      };

      return fetchImpl(endpoint(), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ dotaz: dotaz }),
        signal: controller ? controller.signal : undefined,
      })
        .then(function (res) {
          return { ok: !!(res && res.ok), status: res && res.status };
        })
        .catch(function () {
          // Offline / timeout / network — never break search UX.
          return { ok: false, reason: 'network' };
        })
        .finally(function () {
          if (timer) clearTimeout(timer);
        });
    }

    function logCompleted(raw) {
      cancelPending();
      const prepared = prepareDotaz(raw);
      if (!prepared.ok) return { skipped: true, reason: prepared.reason };
      if (lastLogged === prepared.dotaz) return { skipped: true, reason: 'duplicate' };
      lastLogged = prepared.dotaz;
      // Fire-and-forget: do not await in UI path.
      try {
        send(prepared.dotaz);
      } catch (_) {}
      return { skipped: false, dotaz: prepared.dotaz };
    }

    function noteLiveInput(raw) {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(function () {
        settleTimer = null;
        logCompleted(raw);
      }, settleMs);
    }

    function cancelPending() {
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
    }

    function resetDedupe() {
      lastLogged = null;
    }

    function dispose() {
      aborted = true;
      cancelPending();
    }

    return {
      prepareDotaz: prepareDotaz,
      charLength: charLength,
      logCompleted: logCompleted,
      noteLiveInput: noteLiveInput,
      cancelPending: cancelPending,
      resetDedupe: resetDedupe,
      dispose: dispose,
      send: send,
      MAX_CHARS: MAX_CHARS,
    };
  }

  return {
    prepareDotaz: prepareDotaz,
    charLength: charLength,
    createHistoryLogger: createHistoryLogger,
    MAX_CHARS: MAX_CHARS,
    DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    DEFAULT_SETTLE_MS: DEFAULT_SETTLE_MS,
  };
});
