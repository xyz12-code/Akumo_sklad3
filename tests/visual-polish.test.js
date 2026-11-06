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
  assert.match(html, /css\/app\.css\?v=20261106-visual2/);
  assert.match(css, /\.panel-results[\s\S]*align-self:\s*start/);
  assert.match(css, /\.bin\.is-dim\s*\{\s*opacity:\s*1/);
  assert.match(css, /\.bin\.is-dim \.bin-label[\s\S]*opacity:\s*1/);
  assert.doesNotMatch(css, /\.bin\.is-dim\s*\{\s*opacity:\s*0\.5/);
  assert.doesNotMatch(html, /Data pocházejí z veřejného inventárního exportu/);
  assert.doesNotMatch(css, /\bneon\b|#00ff00|#39ff14/i);
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
