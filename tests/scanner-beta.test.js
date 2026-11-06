const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createScannerController, SCANNER_BETA_PREFIX } = require('../js/scanner.js');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

test('static scanner UI is labelled beta (buttons, dialog, aria)', () => {
  assert.equal(SCANNER_BETA_PREFIX, 'Skener (beta): ');
  assert.match(html, /id="open-scanner">Skenovat \(beta\)<\/button>/);
  assert.match(html, /id="dock-scan">[\s\S]*?<span>Skenovat \(beta\)<\/span>/);
  assert.match(html, /<dialog id="scanner-modal"[^>]*aria-labelledby="scanner-eyebrow scanner-title"/);
  assert.match(html, /<p class="eyebrow" id="scanner-eyebrow">Skener \(beta\)<\/p>/);
  assert.match(html, /id="close-scanner" aria-label="Zavřít skener \(beta\)"/);
  assert.match(html, /class="scanner-help">Skener je ve verzi beta\./);
  assert.match(html, /id="scanner-status"[^>]*>Skener \(beta\): Připravuji fotoaparát…</);
  assert.match(html, /id="retry-scanner">Zkusit skener znovu \(beta\)<\/button>/);
  // manual search stays untouched
  assert.match(html, /id="btn-search">Hledat<\/button>/);
  assert.match(html, /placeholder="název, EAN nebo šuplík"/);
  assert.match(html, /<h1 class="wordmark">AKUMO <span class="wordmark-accent">RADAR<\/span><\/h1>/);
  assert.match(html, /js\/scanner\.js\?v=20261106-scanbeta1/);
  assert.match(html, /js\/app\.js\?v=20261106-layout2/);
});

test('dynamic scanner status messages are prefixed with beta', async () => {
  const status = { textContent: '', classList: { toggle() {} } };
  const err = new Error('denied');
  err.name = 'NotAllowedError';
  const c = createScannerController({
    video: { srcObject: null, play: async () => {}, pause() {}, setAttribute() {}, readyState: 0 },
    statusEl: status,
    modal: { hidden: false },
    isSecureContext: true,
    getUserMedia: async () => { throw err; },
    loadZXing: async () => ({}),
    onDetected: () => {},
  });
  const prime = c.primeFromGesture();
  assert.match(status.textContent, /^Skener \(beta\): /);
  await c.continueAfterPrime(prime);
  assert.match(status.textContent, /^Skener \(beta\): Kamera je blokovaná v prohlížeči/);

  const status2 = { textContent: '', classList: { toggle() {} } };
  const c2 = createScannerController({
    video: null, statusEl: status2, modal: { hidden: false },
    isSecureContext: false, getUserMedia: null,
    loadZXing: async () => ({}), onDetected: () => {},
  });
  c2.primeFromGesture();
  assert.match(status2.textContent, /^Skener \(beta\): Kamera vyžaduje HTTPS/);
});

test('app scanner feedback is beta-prefixed, scanned value and search query stay raw', () => {
  assert.match(app, /SCANNER_BETA_PREFIX \} = AkumoScanner/);
  assert.match(app, /els\.search\.value = raw;/);
  assert.match(app, /setFeedback\(SCANNER_BETA_PREFIX \+ 'Načteno: ' \+ raw\)/);
  const idx = app.indexOf('function openScanner');
  const block = app.slice(idx, idx + 1400);
  const calls = block.match(/setFeedback\('[^']+'/g) || [];
  assert.deepEqual(calls, [], 'no unprefixed scanner feedback text');
  assert.equal((block.match(/setFeedback\(SCANNER_BETA_PREFIX \+/g) || []).length, 4);
  assert.match(app, /naskenuj kód skenerem \(beta\)/);
});
