(function () {
  'use strict';

  const { loadAll } = AkumoData;
  const { search } = AkumoSearch;
  const { sectionOf } = AkumoNormalize;
  const { getHistory, rememberQuery, getFavorites, toggleFavorite, isFavorite } = AkumoStorage;
  const { renderSectionNav, renderRack, pulseDrawer, reducedMotion } = AkumoMap;

  const els = {
    status: document.getElementById('data-status'),
    search: document.getElementById('search-input'),
    clear: document.getElementById('search-clear'),
    form: document.getElementById('search-form'),
    results: document.getElementById('results'),
    resultCount: document.getElementById('result-count'),
    quick: document.getElementById('quick-answer'),
    history: document.getElementById('history'),
    favorites: document.getElementById('favorites'),
    sectionNav: document.getElementById('section-nav'),
    grid: document.getElementById('drawer-grid'),
    sectionLabel: document.getElementById('section-label'),
    mapNote: document.getElementById('map-note'),
    detail: document.getElementById('drawer-detail'),
    modeIso: document.getElementById('mode-iso'),
    modeFlat: document.getElementById('mode-flat'),
    stats: document.getElementById('stats-line'),
    share: document.getElementById('share-link'),
    toast: document.getElementById('toast'),
  };

  let drawers = [];
  let parts = [];
  let sections = [];
  let meta = null;
  let query = '';
  let matched = { type: 'empty', drawers: [], parts: [], focusDrawer: null };
  let activeSection = 'A';
  let selectedDrawer = null;
  let mapMode = localStorage.getItem('akumoSklad3.mapMode') || 'iso';
  let resultCursor = -1;

  function partsInDrawer(code) {
    return parts.filter((p) => p.drawer === code);
  }

  function showToast(text) {
    els.toast.textContent = text;
    els.toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      els.toast.hidden = true;
    }, 2200);
  }

  function setMapMode(mode) {
    mapMode = mode === 'flat' ? 'flat' : 'iso';
    try {
      localStorage.setItem('akumoSklad3.mapMode', mapMode);
    } catch (_) {}
    els.modeIso.classList.toggle('is-active', mapMode === 'iso');
    els.modeFlat.classList.toggle('is-active', mapMode === 'flat');
    els.modeIso.setAttribute('aria-pressed', mapMode === 'iso' ? 'true' : 'false');
    els.modeFlat.setAttribute('aria-pressed', mapMode === 'flat' ? 'true' : 'false');
    paintMap();
  }

  function matchCodes() {
    const set = new Set();
    matched.parts.forEach((p) => set.add(p.drawer));
    matched.drawers.forEach((d) => set.add(d.code));
    if (selectedDrawer) set.add(selectedDrawer);
    return set;
  }

  function sectionCounts() {
    const counts = {};
    sections.forEach((s) => {
      counts[s] = parts.filter((p) => sectionOf(p.drawer) === s).length;
    });
    return counts;
  }

  function paintMap() {
    els.sectionLabel.textContent = 'Sekce ' + activeSection;
    renderSectionNav(els.sectionNav, sections, activeSection, sectionCounts(), (name) => {
      activeSection = name;
      paintMap();
    });
    renderRack({
      gridEl: els.grid,
      drawers,
      section: activeSection,
      mode: mapMode,
      matchCodes: query ? matchCodes() : new Set(),
      selectedCode: selectedDrawer,
      contentsCount: (code) => partsInDrawer(code).length,
      onSelect: (code) => selectDrawer(code, true),
    });
  }

  function selectDrawer(code, fromMap) {
    selectedDrawer = code;
    const section = sectionOf(code);
    if (section) activeSection = section;
    paintMap();
    renderDetail(code);
    if (!fromMap) {
      document.getElementById('map-panel').scrollIntoView({
        behavior: reducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    }
    pulseDrawer(els.grid, code);
  }

  function renderDetail(code) {
    const drawer = drawers.find((d) => d.code === code);
    const list = partsInDrawer(code);
    const fav = isFavorite(code);
    els.detail.replaceChildren();

    const head = document.createElement('div');
    head.className = 'detail-head';
    head.innerHTML =
      '<div><p class="eyebrow">Šuplík</p><h3>' +
      code +
      '</h3><p class="detail-name">' +
      escapeHtml(drawer ? drawer.name : 'Popis není v mapě šuplíků') +
      '</p></div>';

    const actions = document.createElement('div');
    actions.className = 'detail-actions';
    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'btn btn-ghost' + (fav ? ' is-on' : '');
    favBtn.textContent = fav ? '★ V oblíbených' : '☆ Oblíbený';
    favBtn.addEventListener('click', () => {
      toggleFavorite(code);
      renderDetail(code);
      renderFavorites();
      showToast(isFavorite(code) ? 'Uloženo do oblíbených (jen v tomto prohlížeči)' : 'Odebráno z oblíbených');
    });
    actions.append(favBtn);
    head.append(actions);
    els.detail.append(head);

    if (drawer && drawer.status) {
      const st = document.createElement('p');
      st.className = 'detail-status';
      st.textContent = 'Poznámka u šuplíku: ' + drawer.status;
      els.detail.append(st);
    }

    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'V inventuře dílů zatím není u tohoto šuplíku žádná položka.';
      els.detail.append(empty);
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'detail-list';
    list.forEach((item) => {
      const li = document.createElement('li');
      li.innerHTML =
        '<strong>' +
        escapeHtml(item.name) +
        '</strong><span class="meta">⌗ ' +
        escapeHtml(item.code) +
        ' · ' +
        escapeHtml(item.category) +
        ' · stav inventury ' +
        escapeHtml(item.quantity || '—') +
        '</span>';
      ul.append(li);
    });
    els.detail.append(ul);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function runSearch(remember) {
    query = els.search.value.trim();
    matched = search({ query, drawers, parts, sections });
    resultCursor = -1;
    els.clear.hidden = !query;

    if (remember && query) {
      rememberQuery(query);
      renderHistory();
      syncShareLink(query);
    }

    renderQuick();
    renderResults();

    if (matched.focusDrawer) {
      const section = sectionOf(matched.focusDrawer);
      if (section) activeSection = section;
      selectedDrawer = matched.focusDrawer;
    } else if (!query) {
      selectedDrawer = null;
    }
    paintMap();
    if (selectedDrawer) renderDetail(selectedDrawer);
    else {
      els.detail.innerHTML = '<p class="muted">Vyber šuplík na mapě nebo vyhledej díl.</p>';
    }

    const partN = matched.parts.length;
    const drawerN = matched.drawers.length;
    if (!query) els.resultCount.textContent = 'Zadej název, kód nebo šuplík';
    else if (matched.type === 'none') els.resultCount.textContent = 'Nic nenalezeno';
    else els.resultCount.textContent = partN + ' dílů · ' + drawerN + ' šuplíků';
  }

  function syncShareLink(value) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set('q', value);
    else url.searchParams.delete('q');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function renderQuick() {
    els.quick.replaceChildren();
    if (!query) {
      els.quick.hidden = true;
      return;
    }
    els.quick.hidden = false;

    if (matched.type === 'none') {
      els.quick.innerHTML =
        '<div class="quick-card is-empty"><p class="eyebrow">Výsledek</p><h2>Nic jsem nenašel</h2><p>Zkus kratší slovo, kód výrobce nebo označení šuplíku (např. E3).</p></div>';
      return;
    }

    const focus = matched.focusDrawer;
    const focusParts = matched.parts.filter((p) => p.drawer === focus);
    const title =
      matched.type === 'drawer'
        ? 'Šuplík ' + focus
        : matched.type === 'barcode'
          ? 'Přesný kód'
          : matched.type === 'section'
            ? 'Sekce ' + activeSection
            : focusParts[0]
              ? focusParts[0].name
              : matched.drawers[0]
                ? matched.drawers[0].name
                : 'Nalezeno';

    const card = document.createElement('div');
    card.className = 'quick-card';
    card.innerHTML =
      '<p class="eyebrow">Kam jít</p>' +
      '<div class="quick-row">' +
      '<div><span class="drawer-pill">' +
      escapeHtml(focus && focus !== 'OSTATNÍ' ? focus : focus === 'OSTATNÍ' ? 'MIMO' : '—') +
      '</span><h2>' +
      escapeHtml(title) +
      '</h2><p class="muted">' +
      (focusParts.length
        ? focusParts.length + ' položek v tomto šuplíku z aktuálního výsledku'
        : matched.drawers[0]
          ? escapeHtml(matched.drawers[0].name)
          : '') +
      '</p></div>' +
      '</div>';

    const actions = document.createElement('div');
    actions.className = 'quick-actions';
    if (focus && focus !== 'OSTATNÍ') {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'btn btn-primary btn-xl';
      go.textContent = 'Ukaž šuplík na mapě';
      go.addEventListener('click', () => selectDrawer(focus, false));
      actions.append(go);
    }
    card.append(actions);
    els.quick.append(card);
  }

  function renderResults() {
    els.results.replaceChildren();
    if (!query) {
      els.results.innerHTML =
        '<p class="muted results-hint">Piš libovolně — bez diakritiky, podle názvu, čárového kódu i šuplíku.</p>';
      return;
    }
    if (matched.type === 'none') {
      els.results.innerHTML = '<p class="muted">Žádná shoda. Uprav hledaný text.</p>';
      return;
    }

    const frag = document.createDocumentFragment();

    if (matched.parts.length) {
      matched.parts.slice(0, 80).forEach((item, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'result-card';
        btn.dataset.index = String(index);
        btn.innerHTML =
          '<span class="result-drawer">' +
          escapeHtml(item.drawer === 'OSTATNÍ' ? 'MIMO' : item.drawer) +
          '</span>' +
          '<span class="result-body"><strong>' +
          escapeHtml(item.name) +
          '</strong><span class="meta">⌗ ' +
          escapeHtml(item.code) +
          ' · ' +
          escapeHtml(item.category) +
          ' · stav ' +
          escapeHtml(item.quantity || '—') +
          '</span></span>' +
          '<span class="result-go" aria-hidden="true">→</span>';
        btn.addEventListener('click', () => {
          els.search.value = item.name;
          query = item.name;
          matched = search({ query, drawers, parts, sections });
          selectedDrawer = item.drawer;
          activeSection = sectionOf(item.drawer) || activeSection;
          rememberQuery(item.name);
          renderHistory();
          renderQuick();
          renderResults();
          paintMap();
          selectDrawer(item.drawer, false);
        });
        frag.append(btn);
      });
    } else {
      matched.drawers.slice(0, 80).forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'result-card';
        btn.innerHTML =
          '<span class="result-drawer">' +
          escapeHtml(item.code) +
          '</span>' +
          '<span class="result-body"><strong>' +
          escapeHtml(item.name) +
          '</strong><span class="meta">Šuplík v sekci ' +
          escapeHtml(item.section) +
          '</span></span>' +
          '<span class="result-go" aria-hidden="true">→</span>';
        btn.addEventListener('click', () => selectDrawer(item.code, false));
        frag.append(btn);
      });
    }

    els.results.append(frag);
  }

  function renderHistory() {
    els.history.replaceChildren();
    const items = getHistory();
    if (!items.length) {
      els.history.innerHTML = '<span class="muted">Zatím prázdné</span>';
      return;
    }
    items.forEach((value) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = value;
      b.addEventListener('click', () => {
        els.search.value = value;
        runSearch(true);
        els.search.focus();
      });
      els.history.append(b);
    });
  }

  function renderFavorites() {
    els.favorites.replaceChildren();
    const items = getFavorites();
    if (!items.length) {
      els.favorites.innerHTML = '<span class="muted">Označ šuplík hvězdičkou</span>';
      return;
    }
    items.forEach((code) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip chip-fav';
      b.textContent = '★ ' + code;
      b.addEventListener('click', () => selectDrawer(code, false));
      els.favorites.append(b);
    });
  }

  function bindEvents() {
    els.form.addEventListener('submit', (event) => {
      event.preventDefault();
      runSearch(true);
    });
    els.search.addEventListener('input', () => {
      runSearch(false);
    });
    els.clear.addEventListener('click', () => {
      els.search.value = '';
      syncShareLink('');
      runSearch(false);
      els.search.focus();
    });
    els.modeIso.addEventListener('click', () => setMapMode('iso'));
    els.modeFlat.addEventListener('click', () => setMapMode('flat'));
    els.share.addEventListener('click', async () => {
      const url = window.location.href;
      try {
        await navigator.clipboard.writeText(url);
        showToast('Odkaz na hledání zkopírován');
      } catch {
        showToast(url);
      }
    });

    document.addEventListener('keydown', (event) => {
      const tag = (event.target && event.target.tagName) || '';
      if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        event.preventDefault();
        els.search.focus();
        els.search.select();
      }
      if (event.key === 'Escape') {
        if (document.activeElement === els.search && els.search.value) {
          els.search.value = '';
          syncShareLink('');
          runSearch(false);
        } else {
          els.search.blur();
        }
      }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && query) {
        const cards = [...els.results.querySelectorAll('.result-card')];
        if (!cards.length) return;
        event.preventDefault();
        if (event.key === 'ArrowDown') resultCursor = Math.min(resultCursor + 1, cards.length - 1);
        else resultCursor = Math.max(resultCursor - 1, 0);
        cards.forEach((card, i) => card.classList.toggle('is-active', i === resultCursor));
        cards[resultCursor].focus();
      }
    });
  }

  async function boot() {
    bindEvents();
    setMapMode(mapMode);
    renderHistory();
    renderFavorites();
    els.status.textContent = 'Načítám data…';
    try {
      const data = await loadAll();
      drawers = data.drawers;
      parts = data.parts;
      sections = data.sections;
      meta = data.meta;
      activeSection = sections[0] || 'A';
      els.status.textContent =
        meta.partCount + ' dílů · ' + meta.drawerCount + ' šuplíků · ' + meta.sectionCount + ' sekcí';
      els.stats.textContent = meta.sourceNote;
      els.mapNote.textContent =
        'Schematická mapa podle označení šuplíků (např. A1, E3). Přesné 3D souřadnice v datech nejsou — rozložení v sekci je přehledové, ne fyzický půdorys skladu.';

      const params = new URLSearchParams(window.location.search);
      const initial = params.get('q');
      if (initial) {
        els.search.value = initial;
        runSearch(true);
      } else {
        runSearch(false);
      }
      paintMap();
    } catch (err) {
      console.error(err);
      els.status.textContent = 'Chyba načtení dat';
      els.results.innerHTML =
        '<p class="error">Data se nepodařilo načíst. Obnov stránku. (' +
        escapeHtml(err.message || String(err)) +
        ')</p>';
    }
  }

  boot();
})();
