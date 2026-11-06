const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDrawers } = require('../js/data.js');
const {
  WALLS,
  buildWarehouse,
  buildSectionColumn,
  routeToCode,
  findSlot,
} = require('../js/warehouse.js');

const root = path.join(__dirname, '..');
const drawers = parseDrawers(
  JSON.parse(fs.readFileSync(path.join(root, 'supliky.json'), 'utf8'))
);

test('walls A–G / H–M / N–U cover all sections without locking N into H–M', () => {
  assert.deepEqual(WALLS.map((w) => w.id), ['ag', 'hm', 'nu']);
  assert.ok(!WALLS[1].sections.includes('N'));
  assert.ok(WALLS[2].sections.includes('N'));
  const wh = buildWarehouse(drawers);
  const covered = wh.walls.flatMap((w) => w.sections);
  assert.deepEqual(covered.join(''), 'ABCDEFGHIJKLMNOPQRSTU');
  assert.equal(wh.totalMapped, 277);
});

test('column model: A1 above A2 above A3; B is neighboring column', () => {
  const colA = buildSectionColumn('A', drawers);
  assert.equal(colA.slots[0].code, 'A1');
  assert.equal(colA.slots[1].code, 'A2');
  assert.equal(colA.slots[2].code, 'A3');
  assert.equal(colA.slots[0].row, 1);
  assert.equal(colA.maxIndex, 21);
  assert.equal(colA.mappedCount, 21);
  assert.equal(colA.gapCount, 0);

  const wh = buildWarehouse(drawers);
  const ag = wh.walls.find((w) => w.id === 'ag');
  assert.deepEqual(
    ag.columns.map((c) => c.section),
    ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  );
  assert.equal(ag.columns[0].slots[0].code, 'A1');
  assert.equal(ag.columns[1].slots[0].code, 'B1');
});

test('gap handling keeps empty unmapped rows without inventing stock', () => {
  const sparse = [
    { code: 'A1', name: 'one', status: '', section: 'A' },
    { code: 'A3', name: 'three', status: '', section: 'A' },
  ];
  const col = buildSectionColumn('A', sparse);
  assert.equal(col.maxIndex, 3);
  assert.equal(col.mappedCount, 2);
  assert.equal(col.gapCount, 1);
  assert.equal(col.slots[1].mapped, false);
  assert.equal(col.slots[1].status, 'UNMAPPED');
  assert.equal(col.slots[1].code, 'A2');
  assert.equal(col.slots[2].mapped, true);
});

test('routing targets A3 / E3 / U12 choose correct wall and row', () => {
  const wh = buildWarehouse(drawers);
  assert.deepEqual(routeToCode(wh, 'A3'), {
    wallId: 'ag',
    section: 'A',
    row: 3,
    code: 'A3',
    found: true,
    mapped: true,
  });
  const e3 = routeToCode(wh, 'E3');
  assert.equal(e3.wallId, 'ag');
  assert.equal(e3.section, 'E');
  assert.equal(e3.row, 3);
  const u = routeToCode(wh, 'U12');
  assert.equal(u.wallId, 'nu');
  assert.equal(u.section, 'U');
  assert.equal(u.row, 12);
  const h1 = routeToCode(wh, 'H1');
  assert.equal(h1.wallId, 'hm');
  const slot = findSlot(wh, 'C4');
  assert.equal(slot.slot.name.includes('LOŽISKA'), true);
});

test('all 277 drawer codes preserved across wall columns', () => {
  const wh = buildWarehouse(drawers);
  const codes = new Set();
  wh.walls.forEach((wall) => {
    wall.columns.forEach((col) => {
      col.slots.forEach((slot) => {
        if (slot.mapped) codes.add(slot.code);
      });
    });
  });
  assert.equal(codes.size, 277);
  drawers.forEach((d) => assert.ok(codes.has(d.code), d.code));
});

test('markup/css include façade walls and keep scanner gesture API', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.match(html, /id="wall-tabs"/);
  assert.match(html, /history1|warehouse1/);
  assert.match(html, /js\/warehouse\.js/);
  assert.match(css, /\.rack-columns/);
  assert.match(css, /\.bin-label/);
  assert.match(css, /\.rack-scene\.is-iso/);
  assert.match(app, /buildWarehouse/);
  assert.match(app, /panToDrawer/);
  assert.match(app, /primeFromGesture/);
});
