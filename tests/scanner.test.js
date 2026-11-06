const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createScannerController, resolveGetUserMedia } = require('../js/scanner.js');

function mockVideo() {
  return {
    srcObject: null,
    muted: false,
    defaultMuted: false,
    playsInline: false,
    readyState: 2,
    setAttribute() {},
    play: async () => {},
    pause() {},
  };
}
function mockTrack() {
  let stopped = false;
  return {
    stop() {
      stopped = true;
    },
    get stopped() {
      return stopped;
    },
  };
}
function mockStream(tracks) {
  return { getTracks: () => tracks };
}

test('primeFromGesture invokes getUserMedia synchronously before any loader/native await', async () => {
  const order = [];
  let resolveGum;
  const gumPromise = new Promise((resolve) => {
    resolveGum = resolve;
  });
  let loadStarted = false;
  function FakeBD() {}
  FakeBD.getSupportedFormats = async () => {
    order.push('getSupportedFormats');
    return ['ean_13', 'ean_8', 'code_128'];
  };
  const c = createScannerController({
    video: mockVideo(),
    statusEl: { textContent: '', classList: { toggle() {} } },
    modal: { hidden: true, showModal() { order.push('showModal'); this.open = true; }, close() { this.open = false; } },
    isSecureContext: true,
    BarcodeDetector: FakeBD,
    getUserMedia: (constraints) => {
      order.push('getUserMedia');
      assert.equal(constraints.audio, false);
      assert.deepEqual(constraints.video.facingMode, { ideal: 'environment' });
      return gumPromise;
    },
    loadZXing: async () => {
      loadStarted = true;
      order.push('loadZXing');
      return {};
    },
    onDetected: () => {},
  });

  const prime = c.primeFromGesture();
  // Synchronous evidence: gum already requested; loader/native not yet.
  assert.ok(order.includes('getUserMedia'));
  assert.equal(loadStarted, false);
  assert.ok(!order.includes('getSupportedFormats'));
  assert.equal(prime.ok, true);
  assert.ok(prime.streamPromise);

  const track = mockTrack();
  resolveGum(mockStream([track]));
  const result = await c.continueAfterPrime(prime);
  assert.equal(result.ok, true);
  assert.equal(result.engine, 'native');
  assert.ok(order.indexOf('getUserMedia') < order.indexOf('getSupportedFormats'));
  assert.equal(loadStarted, false);
  c.close();
});

test('Safari-like: no BarcodeDetector → gum first, then ZXing while stream live', async () => {
  const order = [];
  const track = mockTrack();
  const c = createScannerController({
    video: mockVideo(),
    statusEl: { textContent: '', classList: { toggle() {} } },
    modal: { hidden: true },
    isSecureContext: true,
    BarcodeDetector: undefined,
    getUserMedia: async () => {
      order.push('getUserMedia');
      return mockStream([track]);
    },
    loadZXing: async () => {
      order.push('loadZXing');
      class BrowserMultiFormatReader {
        async decodeFromStream() {
          order.push('decodeFromStream');
          return { stop() {} };
        }
        reset() {}
      }
      return { BrowserMultiFormatReader };
    },
    onDetected: () => {},
  });
  const prime = c.primeFromGesture();
  assert.deepEqual(order, ['getUserMedia']);
  const result = await c.continueAfterPrime(prime);
  assert.equal(result.engine, 'zxing');
  assert.deepEqual(order, ['getUserMedia', 'loadZXing', 'decodeFromStream']);
  c.close();
});

test('permission denied shows blocked camera copy', async () => {
  const status = { textContent: '', classList: { toggle() {} } };
  const err = new Error('denied');
  err.name = 'NotAllowedError';
  const c = createScannerController({
    video: mockVideo(),
    statusEl: status,
    modal: { hidden: false },
    isSecureContext: true,
    getUserMedia: async () => {
      throw err;
    },
    loadZXing: async () => ({}),
    onDetected: () => {},
  });
  const prime = c.primeFromGesture();
  const result = await c.continueAfterPrime(prime);
  assert.equal(result.reason, 'permission');
  assert.match(status.textContent, /Kamera je blokovaná v prohlížeči/);
});

test('close during pending gum cancels and stops late tracks', async () => {
  const track = mockTrack();
  let resolveGum;
  const gumPromise = new Promise((resolve) => {
    resolveGum = resolve;
  });
  const modal = { hidden: true };
  const c = createScannerController({
    video: mockVideo(),
    statusEl: { textContent: '', classList: { toggle() {} } },
    modal,
    isSecureContext: true,
    getUserMedia: () => gumPromise,
    loadZXing: async () => ({}),
    onDetected: () => {},
  });
  const prime = c.primeFromGesture();
  c.close();
  resolveGum(mockStream([track]));
  const result = await c.continueAfterPrime(prime);
  assert.equal(result.reason, 'cancelled');
  assert.equal(track.stopped, true);
  assert.equal(c.isActive(), false);
});

test('native without 1D formats falls back to ZXing after gum', async () => {
  const order = [];
  function FakeDetector() {}
  FakeDetector.getSupportedFormats = async () => ['qr_code'];
  class BrowserMultiFormatReader {
    async decodeFromStream() {
      order.push('zxing');
      return { stop() {} };
    }
    reset() {}
  }
  const c = createScannerController({
    video: mockVideo(),
    statusEl: { textContent: '', classList: { toggle() {} } },
    modal: { hidden: false },
    isSecureContext: true,
    getUserMedia: async () => {
      order.push('gum');
      return mockStream([mockTrack()]);
    },
    BarcodeDetector: FakeDetector,
    loadZXing: async () => ({ BrowserMultiFormatReader }),
    onDetected: () => {},
  });
  const result = await c.openAndStart();
  assert.equal(result.engine, 'zxing');
  assert.deepEqual(order, ['gum', 'zxing']);
  c.close();
});

test('leading zeros preserved; duplicates ignored', async () => {
  const seen = [];
  function FakeDetector() {
    this.detect = async () => [{ rawValue: '000111' }];
  }
  FakeDetector.getSupportedFormats = async () => ['ean_13', 'ean_8', 'code_128'];
  const c = createScannerController({
    video: mockVideo(),
    statusEl: { textContent: '', classList: { toggle() {} } },
    modal: { hidden: false },
    isSecureContext: true,
    getUserMedia: async () => mockStream([mockTrack()]),
    BarcodeDetector: FakeDetector,
    loadZXing: async () => ({}),
    onDetected: (raw) => seen.push(raw),
    duplicateWindowMs: 5000,
  });
  await c.openAndStart();
  await new Promise((r) => setTimeout(r, 250));
  assert.deepEqual(seen, ['000111']);
  assert.equal(c.acceptRawForTest('000111', c.getGeneration()), false);
  c.close();
});

test('insecure context never calls gum', async () => {
  let gum = 0;
  const c = createScannerController({
    video: mockVideo(),
    statusEl: { textContent: '', classList: { toggle() {} } },
    modal: { hidden: false },
    isSecureContext: false,
    getUserMedia: async () => {
      gum += 1;
      return mockStream([]);
    },
    loadZXing: async () => ({}),
    onDetected: () => {},
  });
  const prime = c.primeFromGesture();
  assert.equal(prime.ok, false);
  assert.equal(gum, 0);
});

test('resolveGetUserMedia is lazy-safe', () => {
  assert.equal(resolveGetUserMedia(null), null);
  const fn = async () => {};
  assert.equal(resolveGetUserMedia(fn), fn);
});

test('app click path primes before continueAfterPrime', () => {
  const app = require('fs').readFileSync(require('path').join(__dirname, '../js/app.js'), 'utf8');
  assert.match(app, /primeFromGesture\(\)/);
  assert.match(app, /continueAfterPrime\(prime\)/);
  assert.match(app, /Kamera je blokovaná v prohlížeči/);
  // ensure openScanner does not only call openAndStart alone
  const idx = app.indexOf('function openScanner');
  const block = app.slice(idx, idx + 700);
  assert.match(block, /primeFromGesture/);
  assert.doesNotMatch(block, /scanner\.openAndStart\(\)/);
});
