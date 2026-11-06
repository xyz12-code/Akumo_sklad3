(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./normalize.js'));
  } else {
    root.AkumoData = factory(root.AkumoNormalize);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (normApi) {
  'use strict';

  const { sectionOf } = normApi;
  const PART_FILES = [
    'beta-data/part1.json',
    'beta-data/part2.json',
    'beta-data/part3.json',
    'beta-data/part4.json',
  ];
  const DRAWERS_FILE = 'supliky.json';
  const VERSION = '20261106-v3';

  function parseDrawers(rows) {
    if (!Array.isArray(rows) || !rows.every((row) => Array.isArray(row) && row.length >= 2 && typeof row[0] === 'string' && typeof row[1] === 'string')) {
      throw new Error('Neplatný formát souboru šuplíků');
    }
    return rows
      .map((row) => ({
        code: row[0].trim(),
        name: row[1].trim(),
        status: (row[2] || '').trim(),
        section: sectionOf(row[0]),
      }))
      .filter((item) => item.code && item.section)
      .sort((a, b) => a.code.localeCompare(b.code, 'cs'));
  }

  function parseParts(rows) {
    if (!Array.isArray(rows)) throw new Error('Neplatný formát inventury');
    return rows
      .filter((row) => Array.isArray(row) && row.length >= 6)
      .map((row) => ({
        code: String(row[0]).trim(),
        name: String(row[1]).trim(),
        category: String(row[2]).trim(),
        quantity: String(row[3]).trim(),
        drawer: String(row[4]).trim(),
        reason: String(row[5] || '').trim(),
      }))
      .filter((item) => item.code && item.name);
  }

  async function fetchJson(url) {
    const response = await fetch(url + '?v=' + VERSION, { cache: 'no-store' });
    if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
    return response.json();
  }

  async function loadAll() {
    const payloads = await Promise.all(
      [...PART_FILES, DRAWERS_FILE].map((url) => fetchJson(url))
    );
    const partRows = payloads.slice(0, 4).flat();
    const drawerRows = payloads[4];
    const drawers = parseDrawers(drawerRows);
    const parts = parseParts(partRows);
    const sections = [...new Set(drawers.map((d) => d.section))].sort((a, b) =>
      a.localeCompare(b, 'cs')
    );
    return {
      drawers,
      parts,
      sections,
      meta: {
        drawerCount: drawers.length,
        partCount: parts.length,
        sectionCount: sections.length,
        sourceNote:
          'Data pocházejí z veřejného inventárního exportu AKUMO SKLAD 2. Stav množství je údaj z inventury, ne živý skladový systém.',
      },
    };
  }

  return { loadAll, parseDrawers, parseParts, PART_FILES, DRAWERS_FILE };
});
