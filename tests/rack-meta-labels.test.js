const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDrawers } = require('../js/data.js');
const { buildWarehouse } = require('../js/warehouse.js');
const { renderWallTabs } = require('../js/map.js');

const root = path.join(__dirname, '..');

function fakeNav() {
  const children = [];
  return {
    children,
    replaceChildren() {
      children.length = 0;
    },
    append(node) {
      children.push(node);
    },
  };
}

test('wall tabs render titles only — no source meta or block counts', () => {
  const drawers = parseDrawers(
    JSON.parse(fs.readFileSync(path.join(root, 'supliky.json'), 'utf8'))
  );
  const warehouse = buildWarehouse(drawers);
  assert.equal(warehouse.totalMapped, 277);

  // Minimal DOM stubs for button creation
  global.document = {
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        dataset: {},
        attrs: {},
        children: [],
        innerHTML: '',
        textContent: '',
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
        addEventListener() {},
        append(...nodes) {
          this.children.push(...nodes);
        },
      };
      return el;
    },
    createDocumentFragment() {
      const frag = {
        children: [],
        append(...nodes) {
          this.children.push(...nodes);
        },
      };
      return frag;
    },
  };

  const nav = fakeNav();
  // patch append to unwrap fragment
  nav.append = function (frag) {
    if (frag && frag.children) this.children.push(...frag.children);
    else this.children.push(frag);
  };

  renderWallTabs(nav, warehouse.walls, 'ag', () => {});
  assert.equal(nav.children.length, 3);
  const html = nav.children.map((b) => b.innerHTML).join('\n');
  assert.match(html, /Regál A–G/);
  assert.match(html, /Regál H–M/);
  assert.match(html, /Další sekce N–U/);
  assert.doesNotMatch(html, /dle videa|dle evidence/i);
  assert.doesNotMatch(html, /wall-tab-sub/);
  assert.doesNotMatch(html, /·\s*\d+/);
  // counts that would have appeared previously
  for (const wall of warehouse.walls) {
    assert.doesNotMatch(html, new RegExp(String(wall.drawerCount)));
  }

  const note = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.doesNotMatch(note, /dle videa|dle evidence/i);
  assert.doesNotMatch(app, /dle videa|dle evidence/i);
  assert.match(note, /Sloupce zleva, čísla shora dolů/);
});

test('column order unchanged after meta-label cleanup', () => {
  const drawers = parseDrawers(
    JSON.parse(fs.readFileSync(path.join(root, 'supliky.json'), 'utf8'))
  );
  const warehouse = buildWarehouse(drawers);
  assert.deepEqual(
    warehouse.walls.map((w) => w.sections.join('')),
    ['ABCDEFG', 'HIJKLM', 'NOPQRSTU']
  );
  assert.equal(warehouse.walls[0].columns[0].slots[0].code, 'A1');
  assert.equal(warehouse.walls[0].columns[0].slots[1].code, 'A2');
  assert.equal(warehouse.walls[0].columns[1].slots[0].code, 'B1');
});
