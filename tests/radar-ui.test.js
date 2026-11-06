const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { formatItemsLabel, formatCountLabel } = require('../js/normalize.js');

const root = path.join(__dirname, '..');

test('product renamed to AKUMO RADAR in html/readme; old footer paragraphs gone', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(html, /<title>AKUMO RADAR<\/title>/);
  assert.match(html, /AKUMO RADAR/);
  assert.doesNotMatch(html, /AKUMO SKLAD 3/);
  assert.doesNotMatch(html, /Data pocházejí z veřejného inventárního exportu/);
  assert.doesNotMatch(html, /Historie, oblíbené a režim mapy/);
  assert.doesNotMatch(html, /Inspirace barevností/);
  assert.doesNotMatch(html, /id="stats-line"/);
  assert.match(readme, /AKUMO RADAR/);
  assert.match(readme, /lokální kopie|inventárních JSON/);
  assert.match(readme, /nečte/);
});

test('mobile dock + scanner modal markup present', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="mobile-dock"/);
  assert.match(html, /id="dock-scan"/);
  assert.match(html, /id="scanner-modal"/);
  assert.match(html, /id="scanner-video"[^>]*playsinline/i);
  assert.match(html, /open-scanner/);
  assert.match(html, /vendor\/zxing\/zxing-browser\.min\.js|scanner\.js/);
  assert.doesNotMatch(html, /cdn\.jsdelivr|unpkg\.com/);
});

test('css has dock safe-area, 16px input, mobile view switch, no tiny fonts', () => {
  const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /#search-input[\s\S]*font-size: 16px/);
  assert.match(css, /body\.show-map \.panel-results/);
  assert.match(css, /\.mobile-dock/);
  assert.match(css, /--touch: 48px/);
});

test('položky plural and inventory wording helpers', () => {
  assert.equal(formatItemsLabel(1), '1 položka');
  assert.equal(formatItemsLabel(2), '2 položky');
  assert.equal(formatItemsLabel(5), '5 položek');
  assert.equal(formatCountLabel(2, 1), '2 díly · 1 šuplík');
});

test('zxing vendored locally with license notice', () => {
  assert.ok(fs.existsSync(path.join(root, 'vendor/zxing/zxing-browser.min.js')));
  assert.ok(fs.existsSync(path.join(root, 'vendor/zxing/LICENSE')));
  assert.ok(fs.existsSync(path.join(root, 'vendor/zxing/NOTICE.md')));
  const notice = fs.readFileSync(path.join(root, 'vendor/zxing/NOTICE.md'), 'utf8');
  assert.match(notice, /0\.1\.5/);
  assert.match(notice, /Apache/);
});

test('app wires scanner lifecycle hooks', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.match(app, /createScannerController/);
  assert.match(app, /createZXingLoader\('vendor\/zxing\/zxing-browser\.min\.js'\)/);
  assert.match(app, /pagehide/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /scheduleSearch/);
  assert.match(app, /inventurní údaj/);
  assert.doesNotMatch(app, /stats-line/);
});
