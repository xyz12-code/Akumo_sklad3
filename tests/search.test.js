const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalize, compact, sectionOf, isDrawerCode } = require('../js/normalize.js');
const { search } = require('../js/search.js');

const drawers = [
  { code: 'A1', name: 'HLAVOVÉ SLOŽENÍ (SADA – NEKOMPLETNÍ)', status: '', section: 'A' },
  { code: 'A3', name: 'HLAVOVÉ SLOŽENÍ (SADA – KOMPLETNÍ)', status: '', section: 'A' },
  { code: 'A30', name: 'FAKE LONG', status: '', section: 'A' },
  { code: 'E3', name: 'Převodníky', status: '', section: 'E' },
  { code: 'G1', name: 'Nová sekce', status: 'NEŘEŠIT', section: 'G' },
];
const parts = [
  { code: '3050801338', name: 'Převodník FSA 36 zubů, 104mm', category: 'Převodníky', quantity: '12', drawer: 'E3', reason: '36z převodník' },
  { code: '401312', name: 'Klika pravá 170mm k motoru Bafang M500 ISIS', category: 'Kliky', quantity: '1', drawer: 'H9', reason: 'Kliky Bafang' },
  { code: 'X1', name: 'Něco mimo', category: 'Ostatní', quantity: '1', drawer: 'OSTATNÍ', reason: '' },
];
const sections = ['A', 'E', 'G', 'H'];

test('normalize strips diacritics and lowercases', () => {
  assert.equal(normalize('Převodník'), 'prevodnik');
  assert.equal(normalize('  HLAVOVÉ   SLOŽENÍ '), 'hlavove slozeni');
});

test('exact drawer A3 does not match A30', () => {
  const result = search({ query: 'A3', drawers, parts, sections });
  assert.equal(result.type, 'drawer');
  assert.deepEqual(result.drawers.map((d) => d.code), ['A3']);
  assert.equal(result.focusDrawer, 'A3');
});

test('diacritics-insensitive multiword search', () => {
  const result = search({ query: 'prevodnik fsa', drawers, parts, sections });
  assert.equal(result.type, 'text');
  assert.equal(result.parts.length, 1);
  assert.equal(result.parts[0].code, '3050801338');
  assert.equal(result.focusDrawer, 'E3');
});

test('barcode exact match', () => {
  const result = search({ query: '401312', drawers, parts, sections });
  assert.equal(result.type, 'barcode');
  assert.equal(result.parts[0].drawer, 'H9');
});

test('section letter filters drawers and skips NEŘEŠIT', () => {
  const result = search({ query: 'a', drawers, parts, sections });
  assert.equal(result.type, 'section');
  assert.ok(result.drawers.every((d) => d.section === 'A'));
  assert.ok(!result.drawers.some((d) => d.status === 'NEŘEŠIT'));
});

test('no results', () => {
  const result = search({ query: 'qwertyxyz', drawers, parts, sections });
  assert.equal(result.type, 'none');
  assert.equal(result.parts.length, 0);
});

test('helpers', () => {
  assert.equal(sectionOf('e12'), 'E');
  assert.equal(isDrawerCode('E3'), true);
  assert.equal(isDrawerCode('OSTATNÍ'), false);
  assert.equal(compact('E 3'), 'e3');
});
