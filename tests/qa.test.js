const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compareDrawerCodes, czechPlural, formatCountLabel } = require('../js/normalize.js');
const { parseDrawers } = require('../js/data.js');
const { search } = require('../js/search.js');

const root = path.join(__dirname, '..');

test('natural order A2 < A10, A9 < A10', () => {
  assert.ok(compareDrawerCodes('A2', 'A10') < 0);
  assert.ok(compareDrawerCodes('A9', 'A10') < 0);
  assert.ok(compareDrawerCodes('A21', 'B1') < 0);
  assert.deepEqual(['A10', 'A2', 'A1', 'A3'].sort(compareDrawerCodes), ['A1', 'A2', 'A3', 'A10']);
});

test('real data: every section ordered 1..n numerically, sections A..U', () => {
  const drawers = parseDrawers(JSON.parse(fs.readFileSync(path.join(root, 'supliky.json'), 'utf8')));
  assert.equal(drawers.length, 277);
  const bySec = {};
  for (const d of drawers) (bySec[d.section] ||= []).push(parseInt(d.code.slice(d.section.length), 10));
  assert.equal(Object.keys(bySec).join(''), 'ABCDEFGHIJKLMNOPQRSTU');
  for (const [s, nums] of Object.entries(bySec)) {
    assert.deepEqual(nums, nums.map((_, i) => i + 1), 'section ' + s);
  }
  assert.equal(drawers[0].code, 'A1');
  assert.equal(drawers[1].code, 'A2');
});

test('Czech plurals', () => {
  assert.equal(czechPlural(1, 'díl', 'díly', 'dílů'), 'díl');
  assert.equal(czechPlural(2, 'díl', 'díly', 'dílů'), 'díly');
  assert.equal(czechPlural(4, 'díl', 'díly', 'dílů'), 'díly');
  assert.equal(czechPlural(5, 'díl', 'díly', 'dílů'), 'dílů');
  assert.equal(czechPlural(0, 'díl', 'díly', 'dílů'), 'dílů');
  assert.equal(formatCountLabel(2, 1), '2 díly · 1 šuplík');
  assert.equal(formatCountLabel(1, 3), '1 díl · 3 šuplíky');
  assert.equal(formatCountLabel(209, 277), '209 dílů · 277 šuplíků');
});

test('search result counts equal listed items (count = filter, not selection)', () => {
  const drawers = [{ code: 'E3', name: 'X', status: '', section: 'E' }];
  const parts = [
    { code: '1', name: 'Převodník A', category: 'P', quantity: '1', drawer: 'E3', reason: '' },
    { code: '2', name: 'Převodník B', category: 'P', quantity: '1', drawer: 'E3', reason: '' },
  ];
  const r = search({ query: 'prevodnik', drawers, parts, sections: ['E'] });
  assert.equal(formatCountLabel(r.parts.length, r.drawers.length), '2 díly · 1 šuplík');
});

test('app keeps filter on result click and shows selection separately', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.match(app, /selectedPartCode = item\.code/);
  assert.doesNotMatch(app, /els\.search\.value = item\.name/);
  assert.match(app, /vybráno: /);
});

test('css: readable minimums and distinct modes', () => {
  const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
  assert.match(css, /--fs-aux: 14px/);
  assert.match(css, /--fs-body: 16px/);
  assert.match(css, /--fs-result: 18px/);
  assert.match(css, /--touch: 44px/);
  assert.match(css, /\.kbd \{[^}]*color: #14200a/);
  assert.match(css, /\.drawer-grid\.is-iso \.drawer-face::before/);
  assert.match(css, /\.drawer-grid\.is-flat \.drawer-body \{[^}]*transform: none/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /font-size: (0\.[0-7]\d*rem|[0-9]px|1[0-3]px)/);
});
