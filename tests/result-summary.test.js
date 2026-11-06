const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDrawers, parseParts, PART_FILES, DRAWERS_FILE } = require('../js/data.js');
const { search, summarizeMatch } = require('../js/search.js');
const { formatCountLabel, normalize } = require('../js/normalize.js');

const root = path.join(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const drawers = parseDrawers(read(DRAWERS_FILE));
const parts = PART_FILES.flatMap((f) => parseParts(read(f)));
const sections = [...new Set(drawers.map((d) => d.section))];
const run = (q) => search({ query: q, drawers, parts, sections });

// Independent expectation computed from the real data, not from search.js output
function expectedDrawerCodes(m) {
  const set = new Set();
  m.parts.forEach((p) => { if (p.drawer && p.drawer !== 'OSTATNÍ') set.add(p.drawer.toUpperCase()); });
  m.drawers.forEach((d) => set.add(d.code.toUpperCase()));
  return set;
}

test('"ložisko": summary counts every unique location of the full result', () => {
  const m = run('ložisko');
  const s = summarizeMatch(m);
  // parts: every real part whose searchable text contains the normalized word
  const word = normalize('ložisko');
  const direct = parts.filter((p) =>
    normalize([p.name, p.category, p.code, p.drawer, p.reason].join(' ')).includes(word)
  );
  assert.equal(s.partCount, direct.length);
  assert.ok(s.partCount > 1);
  const partDrawers = new Set(direct.map((p) => p.drawer.toUpperCase()));
  // drawers whose own label contains the word (e.g. a "LOŽISKO …" drawer) also count
  const labelDrawers = drawers
    .filter((d) => d.status !== 'NEŘEŠIT' && normalize(d.code + ' ' + d.name).includes(word))
    .map((d) => d.code.toUpperCase());
  const expected = new Set([...partDrawers, ...labelDrawers]);
  assert.deepEqual([...s.drawerCodes].sort(), [...expected].sort());
  assert.ok(s.drawerCount >= partDrawers.size, 'never fewer drawers than distinct part locations');
  assert.ok(s.drawerCount > 1, 'regression: previously reported "1 šuplík"');
  assert.equal(
    formatCountLabel(s.partCount, s.drawerCount),
    s.partCount + ' dílů · ' + s.drawerCount + ' šuplíků'
  );
});

test('A3 and H1 drawer queries: parts in that drawer, exactly one drawer', () => {
  for (const code of ['A3', 'H1']) {
    const m = run(code);
    const s = summarizeMatch(m);
    assert.equal(m.type, 'drawer');
    assert.equal(s.partCount, parts.filter((p) => p.drawer === code).length);
    assert.equal(s.drawerCount, 1);
    assert.deepEqual([...s.drawerCodes], [code]);
  }
  assert.equal(formatCountLabel(summarizeMatch(run('A3')).partCount, 1), '2 díly · 1 šuplík');
  assert.equal(formatCountLabel(summarizeMatch(run('H1')).partCount, 1), '8 dílů · 1 šuplík');
});

test('zero / empty / malformed results never produce NaN', () => {
  for (const m of [run('xyzneexistuje'), run(''), {}, null, { parts: null, drawers: undefined }]) {
    const s = summarizeMatch(m);
    assert.equal(s.partCount, 0);
    assert.equal(s.drawerCount, 0);
    assert.equal(formatCountLabel(s.partCount, s.drawerCount), '0 dílů · 0 šuplíků');
  }
});

test('multi-location queries match an independent unique count over real data', () => {
  for (const q of ['ložiska', 'ložisko', 'hlavové složení', 'náboje']) {
    const m = run(q);
    const s = summarizeMatch(m);
    assert.deepEqual([...s.drawerCodes].sort(), [...expectedDrawerCodes(m)].sort(), q);
    assert.equal(s.partCount, m.parts.length, q);
    assert.ok(!Number.isNaN(s.drawerCount));
  }
});

test('parts outside a drawer are not counted as a drawer; codes are normalized', () => {
  const s = summarizeMatch({
    parts: [{ drawer: 'OSTATNÍ' }, { drawer: 'c4' }, { drawer: 'C4' }, { drawer: '' }],
    drawers: [{ code: 'c4' }],
  });
  assert.equal(s.partCount, 4);
  assert.equal(s.drawerCount, 1);
});

test('app uses the full-result summary, selection does not narrow totals', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const fn = app.slice(app.indexOf('function updateResultCount'), app.indexOf('function runSearch'));
  assert.match(fn, /summarizeMatch\(matched\)/);
  assert.match(fn, /formatCountLabel\(summary\.partCount, summary\.drawerCount\)/);
  assert.doesNotMatch(fn, /matched\.drawers\.length/);
});
