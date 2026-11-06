(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./normalize.js'));
  } else {
    root.AkumoWarehouse = factory(root.AkumoNormalize);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (normApi) {
  'use strict';

  const { sectionOf, compareDrawerCodes, parseDrawerCode } = normApi;

  /** Video-backed façades + evidence-only remainder. N is NOT locked into H–M. */
  const WALLS = [
    {
      id: 'ag',
      title: 'Regál A–G',
      subtitle: 'dle videa',
      sections: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      source: 'video',
    },
    {
      id: 'hm',
      title: 'Regál H–M',
      subtitle: 'dle videa',
      sections: ['H', 'I', 'J', 'K', 'L', 'M'],
      source: 'video',
    },
    {
      id: 'nu',
      title: 'Další sekce N–U',
      subtitle: 'dle evidence',
      sections: ['N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'],
      source: 'evidence',
    },
  ];

  function wallForSection(section) {
    const sec = String(section || '').toUpperCase();
    return WALLS.find((wall) => wall.sections.includes(sec)) || WALLS[0];
  }

  function wallForCode(code) {
    return wallForSection(sectionOf(code));
  }

  /**
   * Build column model per section.
   * Rows are ordered TOP → BOTTOM as physical labels 1..maxIndex.
   * Missing numbers become unmapped slots (not invented stock).
   */
  function buildSectionColumn(section, drawers) {
    const sec = String(section).toUpperCase();
    const byNum = new Map();
    drawers
      .filter((d) => d.section === sec)
      .forEach((d) => {
        const parsed = parseDrawerCode(d.code);
        if (Number.isFinite(parsed.num)) byNum.set(parsed.num, d);
      });
    const nums = [...byNum.keys()];
    const maxIndex = nums.length ? Math.max.apply(null, nums) : 0;
    const slots = [];
    for (let n = 1; n <= maxIndex; n += 1) {
      const drawer = byNum.get(n) || null;
      slots.push({
        row: n,
        code: drawer ? drawer.code : sec + n,
        mapped: !!drawer,
        drawer: drawer,
        name: drawer ? drawer.name : 'Nezmapovaná pozice',
        status: drawer ? drawer.status || '' : 'UNMAPPED',
      });
    }
    return {
      section: sec,
      maxIndex: maxIndex,
      mappedCount: byNum.size,
      gapCount: maxIndex - byNum.size,
      slots: slots, // top-to-bottom
    };
  }

  function buildWallModel(wall, drawers) {
    const columns = wall.sections.map((sec) => buildSectionColumn(sec, drawers));
    return {
      id: wall.id,
      title: wall.title,
      subtitle: wall.subtitle,
      source: wall.source,
      sections: wall.sections.slice(),
      columns: columns,
      drawerCount: columns.reduce((sum, col) => sum + col.mappedCount, 0),
    };
  }

  function buildWarehouse(drawers) {
    const list = Array.isArray(drawers) ? drawers.slice() : [];
    list.sort((a, b) => compareDrawerCodes(a.code, b.code));
    const walls = WALLS.map((wall) => buildWallModel(wall, list));
    const allSections = walls.flatMap((w) => w.sections);
    return {
      walls: walls,
      sections: allSections,
      totalMapped: list.length,
      wallForSection: wallForSection,
      wallForCode: wallForCode,
    };
  }

  function findSlot(warehouse, code) {
    const parsed = parseDrawerCode(code);
    const wall = wallForSection(parsed.section);
    const model = warehouse.walls.find((w) => w.id === wall.id);
    if (!model) return null;
    const column = model.columns.find((c) => c.section === parsed.section);
    if (!column) return null;
    const slot = column.slots.find((s) => s.row === parsed.num) || null;
    return { wall: model, column: column, slot: slot, section: parsed.section, row: parsed.num };
  }

  /** Target for auto-pan after search/scan. */
  function routeToCode(warehouse, code) {
    const hit = findSlot(warehouse, code);
    if (!hit) {
      return {
        wallId: WALLS[0].id,
        section: sectionOf(code),
        row: parseDrawerCode(code).num || 1,
        code: code,
        found: false,
      };
    }
    return {
      wallId: hit.wall.id,
      section: hit.section,
      row: hit.row,
      code: hit.slot ? hit.slot.code : code,
      found: !!(hit.slot && hit.slot.mapped),
      mapped: !!(hit.slot && hit.slot.mapped),
    };
  }

  return {
    WALLS: WALLS,
    buildWarehouse: buildWarehouse,
    buildSectionColumn: buildSectionColumn,
    wallForSection: wallForSection,
    wallForCode: wallForCode,
    findSlot: findSlot,
    routeToCode: routeToCode,
  };
});
