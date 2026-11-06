(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AkumoMap = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function renderSectionNav(navEl, sections, active, counts, onSelect) {
    navEl.replaceChildren();
    const frag = document.createDocumentFragment();
    sections.forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'section-chip' + (name === active ? ' is-active' : '');
      btn.setAttribute('aria-pressed', name === active ? 'true' : 'false');
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

  function renderRack({
    gridEl,
    drawers,
    section,
    mode,
    matchCodes,
    selectedCode,
    contentsCount,
    onSelect,
  }) {
    gridEl.replaceChildren();
    gridEl.dataset.mode = mode;
    gridEl.classList.toggle('is-iso', mode === 'iso');
    gridEl.classList.toggle('is-flat', mode === 'flat');

    const list = drawers.filter((d) => d.section === section);
    const frag = document.createDocumentFragment();

    list.forEach((item) => {
      const count = contentsCount(item.code);
      const isMatch = matchCodes.has(item.code);
      const isOpen = item.code === selectedCode;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'drawer' +
        (count ? ' has-items' : '') +
        (isOpen ? ' is-open' : '') +
        (isMatch ? ' is-match' : '') +
        (matchCodes.size && !isMatch ? ' is-dim' : '');
      btn.dataset.code = item.code;
      btn.setAttribute(
        'aria-label',
        'Šuplík ' + item.code + (count ? ', ' + count + ' položek' : '') + (isMatch ? ', nalezený' : '')
      );
      btn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');

      const body = document.createElement('span');
      body.className = 'drawer-body';
      body.innerHTML =
        '<span class="drawer-face">' +
        '<span class="drawer-code">' +
        item.code +
        '</span>' +
        '<span class="drawer-handle" aria-hidden="true"></span>' +
        '<span class="drawer-meta">' +
        (count ? count + '×' : '—') +
        '</span>' +
        '<span class="drawer-led" aria-hidden="true"></span>' +
        '</span>';
      btn.append(body);
      btn.addEventListener('click', () => onSelect(item.code));
      frag.append(btn);
    });

    gridEl.append(frag);

    if (isOpenSafe(selectedCode) && !reducedMotion()) {
      const openBtn = gridEl.querySelector('.drawer.is-open');
      if (openBtn) openBtn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }

  function isOpenSafe(code) {
    return Boolean(code);
  }

  function pulseDrawer(gridEl, code) {
    const btn = gridEl.querySelector('.drawer[data-code="' + CSS.escape(code) + '"]');
    if (!btn) return;
    btn.classList.remove('is-pulse');
    void btn.offsetWidth;
    if (!reducedMotion()) btn.classList.add('is-pulse');
  }

  return { renderSectionNav, renderRack, pulseDrawer, reducedMotion };
});
