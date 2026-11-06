(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./normalize.js'));
  } else {
    root.AkumoSearch = factory(root.AkumoNormalize);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (normApi) {
  'use strict';

  const { normalize, compact, sectionOf, isDrawerCode, compareDrawerCodes } = normApi;

  function rankPart(item, term, words) {
    const name = normalize(item.name);
    const category = normalize(item.category);
    const code = normalize(item.code);
    const drawer = normalize(item.drawer);
    const reason = normalize(item.reason);
    const blob = item._norm || [name, category, code, drawer, reason].join(' ');
    if (!words.every((word) => blob.includes(word))) return -1;
    if (code === term || compact(item.code) === compact(term)) return 100;
    if (drawer === term || compact(item.drawer) === compact(term)) return 90;
    if (name === term) return 80;
    if (name.startsWith(term)) return 70;
    if (category.startsWith(term)) return 50;
    if (name.includes(term)) return 40;
    return 10;
  }

  function search({ query, drawers, parts, sections }) {
    const raw = String(query || '');
    const term = normalize(raw);
    if (!term) {
      return { type: 'empty', drawers: [], parts: [], focusDrawer: null };
    }

    const packed = compact(raw).toUpperCase();

    // Exact drawer code → drawer + its parts
    if (isDrawerCode(packed)) {
      const drawer = drawers.find((d) => d.code.toUpperCase() === packed);
      if (drawer) {
        const inDrawer = parts.filter((p) => p.drawer.toUpperCase() === packed);
        return {
          type: 'drawer',
          drawers: [drawer],
          parts: inDrawer,
          focusDrawer: drawer.code,
        };
      }
    }

    // Exact barcode
    const packedCode = compact(raw);
    const barcodeHits = parts.filter(
      (p) => (p._normCode || compact(p.code)) === packedCode || normalize(p.code) === term
    );
    if (barcodeHits.length) {
      return {
        type: 'barcode',
        drawers: uniqueDrawers(drawers, barcodeHits),
        parts: barcodeHits,
        focusDrawer: barcodeHits[0].drawer,
      };
    }

    // Single section letter
    if (/^[a-z]$/i.test(term) && sections.includes(term.toUpperCase())) {
      const section = term.toUpperCase();
      const sectionDrawers = drawers.filter(
        (d) => d.section === section && d.status !== 'NEŘEŠIT'
      );
      const sectionParts = parts.filter((p) => sectionOf(p.drawer) === section);
      return {
        type: 'section',
        drawers: sectionDrawers,
        parts: sectionParts,
        focusDrawer: sectionDrawers[0] ? sectionDrawers[0].code : null,
      };
    }

    const words = term.split(/\s+/).filter(Boolean);

    const matchedDrawers = drawers
      .filter((d) => d.status !== 'NEŘEŠIT')
      .filter((d) => words.every((w) => normalize(d.code + ' ' + d.name).includes(w)))
      .sort((a, b) => compareDrawerCodes(a.code, b.code));

    const scored = parts
      .map((item) => ({ item, score: rankPart(item, term, words) }))
      .filter((row) => row.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, 'cs'))
      .map((row) => row.item);

    const focus =
      (scored[0] && scored[0].drawer) ||
      (matchedDrawers[0] && matchedDrawers[0].code) ||
      null;

    return {
      type: scored.length || matchedDrawers.length ? 'text' : 'none',
      drawers: matchedDrawers.length
        ? matchedDrawers
        : uniqueDrawers(drawers, scored),
      parts: scored,
      focusDrawer: focus,
    };
  }

  function uniqueDrawers(drawers, partsList) {
    const codes = [...new Set(partsList.map((p) => p.drawer))];
    return codes
      .map((code) => drawers.find((d) => d.code === code) || {
        code,
        name: code === 'OSTATNÍ' ? 'Mimo přiřazený šuplík' : 'Šuplík ' + code,
        status: '',
        section: sectionOf(code),
      })
      .filter(Boolean);
  }

  /**
   * Truthful summary of the whole current result (not just visible cards):
   * parts = number of matched parts; drawerCodes = unique real drawer codes
   * that hold a matched part OR whose own label matched the query.
   * Parts without a drawer ('OSTATNÍ' / empty) are not counted as a drawer.
   */
  function summarizeMatch(matched) {
    const partsList = (matched && Array.isArray(matched.parts)) ? matched.parts : [];
    const drawerList = (matched && Array.isArray(matched.drawers)) ? matched.drawers : [];
    const codes = new Set();
    const add = (code) => {
      const value = String(code || '').trim().toUpperCase();
      if (value && value !== 'OSTATNÍ') codes.add(value);
    };
    partsList.forEach((p) => add(p && p.drawer));
    drawerList.forEach((d) => add(d && d.code));
    return { partCount: partsList.length, drawerCount: codes.size, drawerCodes: codes };
  }

  return { search, rankPart, uniqueDrawers, summarizeMatch };
});
