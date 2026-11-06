const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('visual polish keeps AKUMO palette and touch targets', () => {
  assert.match(css, /--akumo-green:\s*#7db828/);
  assert.match(css, /--akumo-black:\s*#0e0f10/);
  assert.match(css, /--touch:\s*48px/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.bin\.is-open/);
  assert.match(css, /\.rack-scene\.is-iso/);
  assert.match(css, /\.rack-scene\.is-flat/);
  assert.match(css, /min-width:\s*1280px|width:\s*min\(1280px/);
  assert.match(html, /css\/app\.css\?v=20261106-header2/);
  assert.match(html, /<h1 class="wordmark">AKUMO <span class="wordmark-accent">RADAR<\/span><\/h1>/);
  assert.match(html, /id="data-status"/);
  assert.match(html, /class="status-meta"/);
  assert.doesNotMatch(html, /brand-mark|Najdi díl\. Zaměř šuplík/);
  assert.doesNotMatch(css, /\.status-pill::before|\.brand-mark\s*\{/);
  assert.match(css, /\.panel-results[\s\S]*align-self:\s*start/);
  assert.match(css, /\.bin\.is-dim\s*\{\s*opacity:\s*1/);
  assert.match(css, /\.bin\.is-dim \.bin-label[\s\S]*opacity:\s*1/);
  assert.doesNotMatch(css, /\.bin\.is-dim\s*\{\s*opacity:\s*0\.5/);
  assert.doesNotMatch(html, /Data pocházejí z veřejného inventárního exportu/);
  assert.doesNotMatch(css, /\bneon\b|#00ff00|#39ff14/i);
});

test('header is integrated into the dark search console (no detached underline bar)', () => {
  const console_ = html.match(/<header class="console" id="app-console">([\s\S]*?)<\/header>/);
  assert.ok(console_, 'console header present');
  const inner = console_[1];
  // wordmark, data summary and search form live in one block, in this order
  const iH1 = inner.indexOf('<h1 class="wordmark">');
  const iStatus = inner.indexOf('id="data-status"');
  const iHero = inner.indexOf('<section class="hero" aria-labelledby="hero-title">');
  const iForm = inner.indexOf('id="search-form"');
  assert.ok(iH1 >= 0 && iStatus > iH1 && iHero > iStatus && iForm > iHero);
  assert.match(inner, /<h2 id="hero-title">Co hledáš\?<\/h2>/);
  assert.match(inner, /<label class="visually-hidden" for="search-input">Hledat díl, kód nebo šuplík<\/label>/);
  assert.match(inner, /role="search"/);
  assert.match(inner, /id="scan-feedback"[^>]*aria-live="polite"/);
  assert.doesNotMatch(html, /class="topbar"|class="brand-text"/);
  assert.doesNotMatch(css, /\.topbar\s*\{|\.brand-text h1/);
  assert.match(css, /\.console\s*\{[^}]*background:\s*var\(--akumo-black\)/);
  assert.match(css, /\.console\s*\{[^}]*border-radius:\s*var\(--radius\)/);
  assert.match(css, /\.console-head\s*\{[^}]*border-bottom:\s*1px solid rgba\(255, 255, 255/);
  assert.match(css, /\.wordmark\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(css, /\.wordmark-accent\s*\{\s*color:\s*var\(--akumo-green\)/);
  assert.doesNotMatch(css, /\.wordmark[^{]*\{[^}]*border-bottom/);
});

test('visual polish keeps map/result selectors used by JS', () => {
  for (const sel of [
    '.result-card',
    '.result-drawer',
    '.wall-tab',
    '.section-chip',
    '.rack-aluminum',
    '.bin-label',
    '.bin-code',
    '.mobile-dock',
    '.dock-primary',
    '#search-input',
  ]) {
    assert.match(css, new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
