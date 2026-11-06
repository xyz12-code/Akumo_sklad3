const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseDrawers, parseParts } = require('../js/data.js');

const root = path.join(__dirname, '..');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('supliky.json parses to 277 drawers with letter+number codes', () => {
  const rows = JSON.parse(fs.readFileSync(path.join(root, 'supliky.json'), 'utf8'));
  const drawers = parseDrawers(rows);
  assert.equal(drawers.length, 277);
  assert.ok(drawers.every((d) => /^[A-Z]+\d+$/.test(d.code)));
  const sections = new Set(drawers.map((d) => d.section));
  assert.ok(sections.has('A'));
  assert.ok(sections.has('U'));
});

test('beta-data parts parse to 209 items and preserve fields', () => {
  const parts = ['part1.json', 'part2.json', 'part3.json', 'part4.json']
    .map((name) => JSON.parse(fs.readFileSync(path.join(root, 'beta-data', name), 'utf8')))
    .flat();
  assert.equal(parts.length, 209);
  const parsed = parseParts(parts);
  assert.equal(parsed.length, 209);
  assert.equal(parsed[0].code, '3050801338');
  assert.equal(parsed[0].drawer, 'E3');
  assert.ok(parsed.every((p) => p.quantity !== undefined));
});

test('checksums match copied public source files', () => {
  const expected = fs
    .readFileSync(path.join(root, 'data/CHECKSUMS.sha256'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/));
  for (const [hash, file] of expected) {
    assert.equal(sha256(path.join(root, file)), hash, file);
  }
});

test('no real XYZ coordinates invented in source JSON', () => {
  const blobs = [
    fs.readFileSync(path.join(root, 'supliky.json'), 'utf8'),
    ...['part1', 'part2', 'part3', 'part4'].map((p) =>
      fs.readFileSync(path.join(root, 'beta-data', p + '.json'), 'utf8')
    ),
  ].join('\n');
  assert.equal(/\b(coord|latitude|longitude|posX|posY|posZ)\b/i.test(blobs), false);
});

test('relative asset paths used in index.html', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /href="css\/app\.css(\?v=[^"]+)?"/);
  assert.match(html, /src="js\/app\.js(\?v=[^"]+)?"/);
  assert.equal(/https?:\/\/xyz12-code\.github\.io\//.test(html), false);
});
