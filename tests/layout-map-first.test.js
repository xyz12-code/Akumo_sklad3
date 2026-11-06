const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildWarehouse } = require('../js/warehouse.js');
const { compareDrawerCodes } = require('../js/normalize.js');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

test('layout: results column (quick strip + tabs + results) then map panel', () => {
  const iLayout = html.indexOf('id="main-layout"');
  const iCol = html.indexOf('<div class="results-col">');
  const iQuick = html.indexOf('id="quick-answer"');
  const iTabs = html.indexOf('id="view-tabs"');
  const iResults = html.indexOf('id="results-panel"');
  const iMap = html.indexOf('id="map-panel"');
  assert.ok(iLayout < iCol && iCol < iQuick && iQuick < iTabs && iTabs < iResults && iResults < iMap);
  // all ids that app.js looks up still exist exactly once
  const ids = [...app.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(ids.length > 30);
  for (const id of ids) {
    const n = (html.match(new RegExp('id="' + id + '"', 'g')) || []).length;
    assert.equal(n, 1, 'id ' + id);
  }
  assert.doesNotMatch(html, /scene-label|Kam jít/);
});

test('mobile tabs are accessible tabs wired to both panes', () => {
  assert.match(html, /<div class="view-tabs" id="view-tabs" role="tablist" aria-label="Zobrazení">/);
  assert.match(html, /id="tab-results" role="tab" aria-selected="true" aria-controls="results-panel">Výsledky</);
  assert.match(html, /id="tab-map" role="tab" aria-selected="false" aria-controls="map-panel" tabindex="-1">Mapa</);
  assert.match(html, /id="results-panel" role="tabpanel"/);
  assert.match(html, /id="map-panel" role="tabpanel"/);
  // showView keeps aria-selected / roving tabindex in sync; arrows switch tabs
  assert.match(app, /tab\.setAttribute\('aria-selected', on \? 'true' : 'false'\)/);
  assert.match(app, /tab\.tabIndex = on \? 0 : -1/);
  assert.match(app, /els\.tabMap\.addEventListener\('click', \(\) => showView\('map'\)\)/);
  assert.match(app, /ArrowLeft[\s\S]*ArrowRight/);
  // map CTA / drawer selection still opens the map view
  const sel = app.slice(app.indexOf('function selectDrawer'), app.indexOf('function renderDetail'));
  assert.match(sel, /showView\('map'\)/);
  // hidden pane is display:none on mobile (not focusable), tabs hidden on desktop, 44px targets
  assert.match(css, /body\.show-map \.panel-results \{ display: none; \}/);
  assert.match(css, /body\.show-results \.panel-map \{ display: none; \}/);
  assert.match(css, /@media \(min-width: 921px\) \{[\s\S]*\.view-tabs \{ display: none; \}/);
  assert.match(css, /\.view-tab \{[^}]*min-height: 44px/);
});

test('desktop split ≈30/70 and dark matte surfaces; 2D | 3D two-option switch', () => {
  assert.match(css, /grid-template-columns: minmax\(300px, 3fr\) minmax\(0, 7fr\)/);
  assert.match(css, /--dk-bg: #121416/);
  assert.match(html, /id="mode-flat" aria-pressed="false">2D<\/button>\s*<button[^>]*id="mode-iso" aria-pressed="true">3D<\/button>/);
  assert.equal((html.match(/class="mode-btn"/g) || []).length, 2);
  assert.match(css, /\.mode-btn\.is-active \{ background: var\(--akumo-green\)/);
  // selected drawer label green, non-matches stay readable (no opacity wash)
  assert.match(css, /\.bin\.is-open \.bin-label \{ background: var\(--akumo-green\)/);
  assert.match(css, /\.bin\.is-dim\s*\{\s*opacity:\s*1/);
});

test('compact locator: drawer tag, title, "N díly", small map action', () => {
  const q = app.slice(app.indexOf('function renderQuick'), app.indexOf('function renderResults'));
  assert.match(q, /czechPlural\(focusParts\.length, 'díl', 'díly', 'dílů'\)/);
  assert.match(q, /go\.textContent = 'Ukázat na mapě'/);
  assert.match(q, /selectDrawer\(focus, false\)/);
  assert.doesNotMatch(q, /btn-xl/);
});

test('dock: three items with svg icons, scanner keeps beta label', () => {
  const dock = html.slice(html.indexOf('id="mobile-dock"'), html.indexOf('</nav>', html.indexOf('id="mobile-dock"')));
  assert.equal((dock.match(/<button/g) || []).length, 3);
  assert.equal((dock.match(/<svg class="dock-ico" aria-hidden="true"/g) || []).length, 3);
  assert.match(dock, /<span>Hledat<\/span>/);
  assert.match(dock, /<span>Skenovat \(beta\)<\/span>/);
  assert.match(dock, /<span>Mapa<\/span>/);
});

test('rack data order: every wall renders columns A→ by letter and rows 1↓ by number', () => {
  const { parseDrawers } = require('../js/data.js');
  const drawers = parseDrawers(JSON.parse(fs.readFileSync(path.join(root, 'supliky.json'), 'utf8')));
  const wh = buildWarehouse(drawers);
  assert.deepEqual(wh.walls.map((w) => w.columns.map((c) => c.section).join('')), ['ABCDEFG', 'HIJKLM', 'NOPQRSTU']);
  let mapped = 0;
  wh.walls.forEach((wall) => {
    wall.columns.forEach((col) => {
      col.slots.forEach((slot, i) => {
        assert.equal(slot.row, i + 1, col.section + ' row order');
        assert.equal(slot.code, col.section + slot.row, 'label matches column+row');
        if (slot.mapped) mapped += 1;
      });
    });
  });
  assert.equal(mapped, 277);
  assert.ok(typeof compareDrawerCodes === 'function');
});

test('script order and cache keys stay coherent', () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1].split('?')[0]);
  assert.deepEqual(scripts, [
    'js/normalize.js', 'js/search.js', 'js/storage.js', 'js/data.js', 'js/warehouse.js',
    'js/map.js', 'js/scanner.js', 'js/supabase-config.js', 'js/history-log.js', 'js/app.js',
  ]);
  assert.match(html, /js\/app\.js\?v=20261106-layout2/);
  assert.match(html, /css\/app\.css\?v=20261106-layout2/);
  assert.match(html, /js\/history-log\.js\?v=20261106-release1/);
  assert.match(html, /js\/supabase-config\.js\?v=20261106-release1/);
});

test('search.js cache bumped with the summary fix; other scripts unchanged', () => {
  assert.match(html, /js\/search\.js\?v=20261106-layout2/);
  assert.match(html, /js\/map\.js\?v=20261106-release1/);
  assert.match(html, /js\/scanner\.js\?v=20261106-scanbeta1/);
});
