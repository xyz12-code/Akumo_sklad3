(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      (typeof globalThis !== 'undefined' && globalThis.AkumoWarehouse)
        ? globalThis.AkumoWarehouse
        : require('./warehouse.js')
    );
  } else {
    root.AkumoMap = factory(root.AkumoWarehouse);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Warehouse) {
  'use strict';

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function shortLabel(name) {
    const text = String(name || '').trim();
    if (!text) return '—';
    return text.length > 28 ? text.slice(0, 27) + '…' : text;
  }

  function renderWallTabs(navEl, walls, activeWallId, onSelect) {
    navEl.replaceChildren();
    const frag = document.createDocumentFragment();
    walls.forEach((wall) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wall-tab' + (wall.id === activeWallId ? ' is-active' : '');
      btn.setAttribute('aria-pressed', wall.id === activeWallId ? 'true' : 'false');
      btn.dataset.wall = wall.id;
      btn.innerHTML = '<span class="wall-tab-title">' + wall.title + '</span>';
      btn.addEventListener('click', () => onSelect(wall.id));
      frag.append(btn);
    });
    navEl.append(frag);
  }

  function renderSectionNav(navEl, sections, active, counts, onSelect) {
    navEl.replaceChildren();
    const frag = document.createDocumentFragment();
    sections.forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'section-chip' + (name === active ? ' is-active' : '');
      btn.setAttribute('aria-pressed', name === active ? 'true' : 'false');
      btn.dataset.section = name;
      btn.innerHTML =
        '<span class="section-chip-letter">' +
        name +
        '</span><span class="section-chip-count">' +
        (counts[name] || 0) +
        '</span>';
      btn.addEventListener('click', () => onSelect(name));
      frag.append(btn);
    });
    navEl.append(frag);
  }

  function renderRack(options) {
    const gridEl = options.gridEl;
    const wallModel = options.wallModel;
    const mode = options.mode === 'flat' ? 'flat' : 'iso';
    const matchCodes = options.matchCodes || new Set();
    const selectedCode = options.selectedCode || null;
    const contentsCount = options.contentsCount || function () { return 0; };
    const onSelect = options.onSelect || function () {};
    const focusSection = options.focusSection || null;

    gridEl.replaceChildren();
    gridEl.dataset.mode = mode;
    gridEl.dataset.wall = wallModel.id;
    gridEl.classList.toggle('is-iso', mode === 'iso');
    gridEl.classList.toggle('is-flat', mode === 'flat');
    gridEl.classList.add('rack-facade');

    const scene = document.createElement('div');
    scene.className = 'rack-scene' + (mode === 'iso' ? ' is-iso' : ' is-flat');
    scene.setAttribute('role', 'group');
    scene.setAttribute('aria-label', wallModel.title + ' — schematické průčelí');

    const frame = document.createElement('div');
    frame.className = 'rack-aluminum';
    frame.innerHTML =
      '<div class="rack-beam rack-beam-top" aria-hidden="true"></div>' +
      '<div class="rack-beam rack-beam-bottom" aria-hidden="true"></div>';

    const columnsWrap = document.createElement('div');
    columnsWrap.className = 'rack-columns';
    columnsWrap.id = 'rack-columns';

    wallModel.columns.forEach((column) => {
      const col = document.createElement('div');
      col.className =
        'rack-column' +
        (focusSection && focusSection === column.section ? ' is-focus-col' : '');
      col.dataset.section = column.section;

      const head = document.createElement('div');
      head.className = 'rack-column-head';
      head.innerHTML =
        '<span class="rack-col-letter">' +
        column.section +
        '</span><span class="rack-col-meta">' +
        column.mappedCount +
        '×</span>';
      col.append(head);

      const rail = document.createElement('div');
      rail.className = 'rack-column-rail';
      rail.setAttribute('role', 'list');
      rail.setAttribute('aria-label', 'Sekce ' + column.section + ', shora dolů');

      column.slots.forEach((slot) => {
        const isMatch = slot.mapped && matchCodes.has(slot.code);
        const isOpen = slot.mapped && slot.code === selectedCode;
        const count = slot.mapped ? contentsCount(slot.code) : 0;

        if (!slot.mapped) {
          const ghost = document.createElement('div');
          ghost.className = 'bin bin-unmapped';
          ghost.setAttribute('role', 'listitem');
          ghost.setAttribute('aria-label', 'Nezmapovaná pozice ' + slot.code);
          ghost.innerHTML =
            '<span class="bin-body"><span class="bin-face">' +
            '<span class="bin-label"><span class="bin-code">' +
            slot.code +
            '</span><span class="bin-name">nezmapováno</span></span>' +
            '</span></span>';
          rail.append(ghost);
          return;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'bin' +
          (count ? ' has-items' : '') +
          (isOpen ? ' is-open' : '') +
          (isMatch ? ' is-match' : '') +
          (matchCodes.size && !isMatch ? ' is-dim' : '');
        btn.dataset.code = slot.code;
        btn.dataset.section = column.section;
        btn.dataset.row = String(slot.row);
        btn.setAttribute('role', 'listitem');
        btn.setAttribute(
          'aria-label',
          'Šuplík ' +
            slot.code +
            ', ' +
            slot.name +
            (count ? ', ' + count + ' položek' : '') +
            (isMatch ? ', nalezený' : '')
        );
        btn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');

        const labelName = shortLabel(slot.name);
        btn.innerHTML =
          '<span class="bin-body">' +
          '<span class="bin-top" aria-hidden="true"></span>' +
          '<span class="bin-side" aria-hidden="true"></span>' +
          '<span class="bin-face">' +
          '<span class="bin-label">' +
          '<span class="bin-code">' +
          slot.code +
          '</span>' +
          '<span class="bin-name">' +
          labelName.replace(/</g, '&lt;') +
          '</span>' +
          '</span>' +
          '<span class="bin-handle" aria-hidden="true"></span>' +
          '<span class="bin-qty">' +
          (count ? count + '×' : '—') +
          '</span>' +
          '</span></span>';

        btn.addEventListener('click', () => onSelect(slot.code));
        rail.append(btn);
      });

      col.append(rail);
      columnsWrap.append(col);
    });

    frame.append(columnsWrap);
    scene.append(frame);
    gridEl.append(scene);
  }

  function pulseDrawer(gridEl, code) {
    const btn = gridEl.querySelector('.bin[data-code="' + cssEscape(code) + '"]');
    if (!btn) return;
    btn.classList.remove('is-pulse');
    void btn.offsetWidth;
    if (!reducedMotion()) btn.classList.add('is-pulse');
  }

  function panToDrawer(gridEl, code) {
    const btn = gridEl.querySelector('.bin[data-code="' + cssEscape(code) + '"]');
    if (!btn) return;
    const col = btn.closest('.rack-column');
    const behavior = reducedMotion() ? 'auto' : 'smooth';
    if (col && typeof col.scrollIntoView === 'function') {
      col.scrollIntoView({ inline: 'center', block: 'nearest', behavior: behavior });
    }
    if (typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ block: 'center', inline: 'nearest', behavior: behavior });
    }
  }

  return {
    renderWallTabs: renderWallTabs,
    renderSectionNav: renderSectionNav,
    renderRack: renderRack,
    pulseDrawer: pulseDrawer,
    panToDrawer: panToDrawer,
    reducedMotion: reducedMotion,
  };
});
