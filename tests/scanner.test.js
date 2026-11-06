const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createScannerController } = require('../js/scanner.js');

function mockVideo() {
  return {
    srcObject: null,
    muted: false,
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
  return {
    getTracks: () => tracks,
  };
}

test('stop closes tracks and cancels late gum', async () => {
  const track = mockTrack();
  let resolveGum;
  const gumPromise = new Promise((resolve) => {
    resolveGum = resolve;
  });
  const video = mockVideo();
  const status = { textContent: '', classList: { toggle() {} } };
  const modal = { hidden: true };
  const c = createScannerController({
    video,
    statusEl: status,
    modal,
    isSecureContext: true,
    getUserMedia: () => gumPromise,
    BarcodeDetector: undefined,
    loadZXing: async () => ({ BrowserMultiFormatReader: class {} }),
    onDetected: () => {},
  });

  const startPromise = c.openAndStart();
  // User closes before gum resolves
  c.close();
  assert.equal(modal.hidden, true);
  resolveGum(mockStream([track]));
  const result = await startPromise;
  assert.equal(result.reason, 'cancelled');
  assert.equal(track.stopped, true);
  assert.equal(c.isActive(), false);
});

test('permission denied yields clear reason and stopped state', async () => {
  const video = mockVideo();
  const status = { textContent: '', classList: { toggle() {} } };
  const err = new Error('denied');
  err.name = 'NotAllowedError';
  const c = createScannerController({
    video,
    statusEl: status,
    modal: { hidden: false },
    isSecureContext: true,
    getUserMedia: async () => {
      throw err;
    },
    loadZXing: async () => ({}),
    onDetected: () => {},
  });
  const result = await c.openAndStart();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'permission');
  assert.match(status.textContent, /zamítnut/i);
  assert.equal(c.isActive(), false);
});

test('native without 1D formats falls back to ZXing', async () => {
  const track = mockTrack();
  const video = mockVideo();
  let zxingLoaded = false;
  let decodeCalled = false;
  function FakeDetector() {}
  FakeDetector.getSupportedFormats = async () => ['qr_code'];
  class BrowserMultiFormatReader {
    async decodeFromStream(stream, vid, cb) {
      decodeCalled = true;
      assert.ok(stream);
      setTimeout(() => cb({ getText: () => '0123456789012' }), 5);
      return { stop() {} };
    }
    async decodeFromConstraints() {
      throw new Error('should prefer decodeFromStream');
    }
    reset() {}
  }
  const seen = [];
  const c = createScannerController({
    video,
    statusEl: { textContent: '', classList: { toggle() {} } },
    modal: { hidden: false },
    isSecureContext: true,
    getUserMedia: async () => mockStream([track]),
    BarcodeDetector: FakeDetector,
    loadZXing: async () => {
      zxingLoaded = true;
      return { BrowserMultiFormatReader };
    },
    onDetected: (raw) => seen.push(raw),
  });
  const result = await c.openAndStart();
  assert.equal(result.ok, true);
  assert.equal(result.engine, 'zxing');
  assert.equal(zxingLoaded, true);
  assert.equal(decodeCalled, true);
  // wait for callback
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(seen, ['0123456789012']);
  assert.equal(track.stopped, true);
});

test('native with 1D support uses BarcodeDetector path', async () => {
  const track = mockTrack();
  const video = mockVideo();
  let zxingLoaded = false;
  function FakeDetector() {
    this.detect = async () => [{ rawValue: '8591234567890' }];
  }
  FakeDetector.getSupportedFormats = async () => ['ean_13', 'ean_8', 'code_128', 'qr_code'];
  const seen = [];
  const c = createScannerController({
    video,
    statusEl: { textContent: '', classList: { toggle() {} } },
    modal: { hidden: false },
    isSecureContext: true,
    getUserMedia: async () => mockStream([track]),
    BarcodeDetector: FakeDetector,
    loadZXing: async () => {
      zxingLoaded = true;
      return {};
    },
    onDetected: (raw) => seen.push(raw),
  });
  const result = await c.openAndStart();
  assert.equal(result.ok, true);
  assert.equal(result.engine, 'native');
  assert.equal(zxingLoaded, false);
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(seen, ['8591234567890']);
});

test('duplicate raw within window ignored', async () => {
  const seen = [];
  const video = mockVideo();
  let calls = 0;
  function FakeDetector() {
    this.detect = async () => {
      calls += 1;
      return [{ rawValue: '000111' }];
    };
  }
  FakeDetector.getSupportedFormats = async () => ['ean_13', 'ean_8', 'code_128'];
  const c = createScannerController({
    video,
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
  // Manual second accept should be ignored while generation advanced / inactive
  assert.equal(c.acceptRawForTest('000111', c.getGeneration()), false);
});

test('insecure context blocks camera without gum call', async () => {
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
  const result = await c.openAndStart();
  assert.equal(result.reason, 'insecure-or-unsupported');
  assert.equal(gum, 0);
});
