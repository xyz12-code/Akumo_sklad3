const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const {
  prepareDotaz,
  charLength,
  createHistoryLogger,
  MAX_CHARS,
} = require('../js/history-log.js');

test('prepareDotaz trims ASCII spaces and rejects blank', () => {
  assert.deepEqual(prepareDotaz('  radar  '), { ok: true, dotaz: 'radar' });
  assert.equal(prepareDotaz('   ').ok, false);
  assert.equal(prepareDotaz('\n\t').ok, false);
  assert.equal(prepareDotaz('').ok, false);
});

test('prepareDotaz enforces max 256 Unicode code points like char_length', () => {
  assert.equal(prepareDotaz('a'.repeat(256)).ok, true);
  assert.equal(prepareDotaz('a'.repeat(257)).ok, false);
  assert.equal(prepareDotaz('ž'.repeat(256)).ok, true);
  assert.equal(prepareDotaz('ž'.repeat(257)).reason, 'too_long');
  assert.equal(charLength('ž'.repeat(3)), 3);
  assert.equal(MAX_CHARS, 256);
});

test('logCompleted dedupes identical completed searches', async () => {
  const calls = [];
  const logger = createHistoryLogger({
    url: 'https://example.test',
    publishableKey: 'sb_publishable_test',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 201 };
    },
  });
  assert.equal(logger.logCompleted('E3').skipped, false);
  assert.equal(logger.logCompleted('E3').reason, 'duplicate');
  assert.equal(logger.logCompleted('  E3  ').reason, 'duplicate');
  assert.equal(logger.logCompleted('E4').skipped, false);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(calls.length, 2);
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body, { dotaz: 'E3' });
  assert.equal(calls[0].init.headers.Prefer, 'return=minimal');
  assert.equal(calls[0].init.method, 'POST');
  assert.ok(!/'cas'|id/.test(calls[0].init.body));
});

test('network failure does not throw and does not retry-queue', async () => {
  let n = 0;
  const logger = createHistoryLogger({
    url: 'https://example.test',
    publishableKey: 'sb_publishable_test',
    fetchImpl: async () => {
      n += 1;
      throw new Error('offline');
    },
  });
  assert.doesNotThrow(() => logger.logCompleted('AKUMO_TEST_OFFLINE'));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(n, 1);
  // duplicate suppressed even after failed send (completed attempt recorded)
  assert.equal(logger.logCompleted('AKUMO_TEST_OFFLINE').reason, 'duplicate');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(n, 1);
});

test('live settle logs once after debounce, cancel prevents it', async () => {
  const calls = [];
  const logger = createHistoryLogger({
    url: 'https://example.test',
    publishableKey: 'sb_publishable_test',
    settleMs: 40,
    fetchImpl: async (url, init) => {
      calls.push(JSON.parse(init.body).dotaz);
      return { ok: true, status: 201 };
    },
  });
  logger.noteLiveInput('a');
  logger.noteLiveInput('ab');
  logger.noteLiveInput('abc');
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(calls, ['abc']);

  logger.noteLiveInput('xyz');
  logger.cancelPending();
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(calls, ['abc']);
});

test('explicit logCompleted cancels pending live settle', async () => {
  const calls = [];
  const logger = createHistoryLogger({
    url: 'https://example.test',
    publishableKey: 'sb_publishable_test',
    settleMs: 50,
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body).dotaz);
      return { ok: true, status: 201 };
    },
  });
  logger.noteLiveInput('draft');
  logger.logCompleted('final');
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(calls, ['final']);
});
