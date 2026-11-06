(function () {
  'use strict';

  const { loadAll } = AkumoData;
  const { search } = AkumoSearch;
  const { sectionOf, formatCountLabel, formatItemsLabel } = AkumoNormalize;
  const { getHistory, rememberQuery, getFavorites, toggleFavorite, isFavorite } = AkumoStorage;
  const { buildWarehouse, routeToCode } = AkumoWarehouse;
  const { renderWallTabs, renderSectionNav, renderRack, pulseDrawer, panToDrawer, reducedMotion } = AkumoMap;
  const { createScannerController, createZXingLoader, SCANNER_BETA_PREFIX } = AkumoScanner;
  const historyLogger =
    typeof AkumoHistoryLog !== 'undefined' && typeof AkumoSupabaseConfig !== 'undefined'
      ? AkumoHistoryLog.createHistoryLogger({
          url: AkumoSupabaseConfig.url,
          publishableKey: AkumoSupabaseConfig.publishableKey,
          table: AkumoSupabaseConfig.historyTable,
        })
      : null;

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
    wallTabs: document.getElementById('wall-tabs'),
    sectionNav: document.getElementById('section-nav'),
    grid: document.getElementById('drawer-grid'),
    sectionLabel: document.getElementById('section-label'),
    mapNote: document.getElementById('map-note'),
    detail: document.getElementById('drawer-detail'),
    modeIso: document.getElementById('mode-iso'),
    modeFlat: document.getElementById('mode-flat'),
    shareFeedback: document.getElementById('scan-feedback'),
    toast: document.getElementById('toast'),
    openScanner: document.getElementById('open-scanner'),
    closeScanner: document.getElementById('close-scanner'),
    retryScanner: document.getElementById('retry-scanner'),
    scannerModal: document.getElementById('scanner-modal'),
    scannerVideo: document.getElementById('scanner-video'),
    scannerStatus: document.getElementById('scanner-status'),
    dockSearch: document.getElementById('dock-search'),
    dockScan: document.getElementById('dock-scan'),
    dockMap: document.getElementById('dock-map'),
    backResults: document.getElementById('back-to-results'),
    resultsPanel: document.getElementById('results-panel'),
    mapPanel: document.getElementById('map-panel'),
    layout: document.getElementById('main-layout'),
  };

  let drawers = [];
  let parts = [];
  let sections = [];
  let warehouse = null;
  let query = '';
  let matched = { type: 'empty', drawers: [], parts: [], focusDrawer: null };
  let activeWallId = 'ag';
  let activeSection = 'A';
  let selectedDrawer = null;
  let selectedPartCode = null;
  let mapMode = 'iso';
  try {
    mapMode = localStorage.getItem('akumoRadar.mapMode') || localStorage.getItem('akumoSklad3.mapMode') || 'iso';
  } catch (_) {}
  let resultCursor = -1;
  let searchTimer = null;
  let lastPaintKey = '';

  const loadZXing = createZXingLoader('vendor/zxing/zxing-browser.min.js');
  const scanner = createScannerController({
    video: els.scannerVideo,
    statusEl: els.scannerStatus,
    modal: els.scannerModal,
    loadZXing,
    onDetected: (raw) => {
      els.search.value = raw;
      setFeedback(SCANNER_BETA_PREFIX + 'Načteno: ' + raw);
      showView('results');
      runSearch(true);
      els.search.focus();
    },
  });

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

  function setFeedback(text, isWarning) {
    if (!els.shareFeedback) return;
    els.shareFeedback.textContent = text || '';
    els.shareFeedback.classList.toggle('is-warning', !!isWarning);
    els.shareFeedback.hidden = !text;
  }

  function showView(which) {
    document.body.classList.toggle('show-map', which === 'map');
    document.body.classList.toggle('show-results', which !== 'map');
    if (els.dockMap) els.dockMap.classList.toggle('is-active', which === 'map');
    if (els.dockSearch) els.dockSearch.classList.toggle('is-active', which !== 'map');
  }

  function setMapMode(mode) {
    mapMode = mode === 'flat' ? 'flat' : 'iso';
    try {
      localStorage.setItem('akumoRadar.mapMode', mapMode);
    } catch (_) {}
    els.modeIso.classList.toggle('is-active', mapMode === 'iso');
    els.modeFlat.classList.toggle('is-active', mapMode === 'flat');
    els.modeIso.setAttribute('aria-pressed', mapMode === 'iso' ? 'true' : 'false');
    els.modeFlat.setAttribute('aria-pressed', mapMode === 'flat' ? 'true' : 'false');
    paintMap(true);
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

  function currentWallModel() {
    if (!warehouse) return null;
    return warehouse.walls.find((w) => w.id === activeWallId) || warehouse.walls[0];
  }

  function paintMap(force) {
    if (!warehouse) return;
    const wall = currentWallModel();
    const codes = query ? [...matchCodes()].sort().join(',') : '';
    const key = [activeWallId, activeSection, mapMode, selectedDrawer || '', codes].join('|');
    if (!force && key === lastPaintKey) return;
    lastPaintKey = key;

    els.sectionLabel.textContent = wall.title;
    renderWallTabs(els.wallTabs, warehouse.walls, activeWallId, (wallId) => {
      activeWallId = wallId;
      const next = warehouse.walls.find((w) => w.id === wallId);
      if (next && next.sections.length) activeSection = next.sections[0];
      paintMap(true);
    });

    const wallSections = wall.sections;
    const counts = sectionCounts();
    renderSectionNav(els.sectionNav, wallSections, activeSection, counts, (name) => {
      activeSection = name;
      const col = els.grid.querySelector('.rack-column[data-section="' + name + '"]');
      if (col) col.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      paintMap(true);
    });

    renderRack({
      gridEl: els.grid,
      wallModel: wall,
      mode: mapMode,
      matchCodes: query ? matchCodes() : new Set(),
      selectedCode: selectedDrawer,
      focusSection: activeSection,
      contentsCount: (code) => partsInDrawer(code).length,
      onSelect: (code) => selectDrawer(code, true),
    });
  }

  function selectDrawer(code, fromMap) {
    selectedDrawer = code;
    if (selectedPartCode) {
      const part = parts.find((item) => item.code === selectedPartCode);
      if (!part || part.drawer !== code) selectedPartCode = null;
    }
    if (warehouse) {
      const route = routeToCode(warehouse, code);
      activeWallId = route.wallId;
      if (route.section) activeSection = route.section;
    } else {
      const section = sectionOf(code);
      if (section) activeSection = section;
    }
    updateResultCount();
    paintMap(true);
    renderDetail(code);
    showView('map');
    const behavior = reducedMotion() ? 'auto' : 'smooth';
    const top = els.mapPanel.getBoundingClientRect().top + window.scrollY - 12;
    if (!fromMap || window.matchMedia('(max-width: 920px)').matches) {
      window.scrollTo({ top: Math.max(0, top), behavior });
    }
    requestAnimationFrame(() => {
      panToDrawer(els.grid, code);
      pulseDrawer(els.grid, code);
    });
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
      showToast(isFavorite(code) ? 'Uloženo do oblíbených' : 'Odebráno z oblíbených');
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
      empty.textContent = 'V evidenci u tohoto šuplíku zatím není žádná položka.';
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
        ' · inventurní údaj ' +
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

  function updateResultCount() {
    if (!query) {
      els.resultCount.textContent = 'Zadej název, kód nebo šuplík';
      return;
    }
    if (matched.type === 'none') {
      els.resultCount.textContent = 'Nic nenalezeno';
      return;
    }
    const found = 'Nalezeno: ' + formatCountLabel(matched.parts.length, matched.drawers.length);
    if (selectedPartCode) {
      const part = matched.parts.find((item) => item.code === selectedPartCode);
      if (part) {
        els.resultCount.textContent = found + ' · vybráno: ' + part.drawer;
        return;
      }
    }
    if (selectedDrawer && matched.drawers.some((d) => d.code === selectedDrawer)) {
      els.resultCount.textContent = found + ' · vybráno: ' + selectedDrawer;
      return;
    }
    els.resultCount.textContent = found;
  }

  function runSearch(remember) {
    query = els.search.value.trim();
    matched = search({ query, drawers, parts, sections });
    resultCursor = -1;
    selectedPartCode = null;
    els.clear.hidden = !query;

    if (remember && query) {
      rememberQuery(query);
      renderHistory();
      syncShareLink(query);
      if (historyLogger) {
        historyLogger.cancelPending();
        historyLogger.logCompleted(query);
      }
    } else if (!remember && query && historyLogger) {
      historyLogger.noteLiveInput(query);
    } else if (!query && historyLogger) {
      historyLogger.cancelPending();
    }

    renderQuick();
    renderResults();

    if (matched.focusDrawer) {
      selectedDrawer = matched.focusDrawer;
      if (warehouse) {
        const route = routeToCode(warehouse, matched.focusDrawer);
        activeWallId = route.wallId;
        if (route.section) activeSection = route.section;
      } else {
        const section = sectionOf(matched.focusDrawer);
        if (section) activeSection = section;
      }
    } else if (!query) {
      selectedDrawer = null;
    }

    paintMap(true);
    if (selectedDrawer) renderDetail(selectedDrawer);
    else els.detail.innerHTML = '<p class="muted">Vyber šuplík nebo vyhledej díl.</p>';
    updateResultCount();

    if (matched.type === 'none') {
      setFeedback('Kód nebo výraz v evidenci není. Zkus jiný zápis.', true);
    } else if (remember && query) {
      setFeedback('');
    }
  }

  function scheduleSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(false), 140);
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
        '<div class="quick-card is-empty"><p class="eyebrow">Výsledek</p><h2>Nic jsem nenašel</h2><p>Zkus kratší slovo, EAN nebo šuplík (např. E3).</p></div>';
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
        ? formatItemsLabel(focusParts.length) + ' v tomto šuplíku z aktuálního výsledku'
        : matched.drawers[0]
          ? escapeHtml(matched.drawers[0].name)
          : '') +
      '</p></div></div>';

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
      els.results.innerHTML = '<p class="muted results-hint">Piš název, EAN nebo šuplík — i bez diakritiky.</p>';
      return;
    }
    if (matched.type === 'none') {
      els.results.innerHTML = '<p class="muted">Žádná shoda. Uprav text nebo naskenuj kód skenerem (beta).</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    if (matched.parts.length) {
      matched.parts.slice(0, 80).forEach((item, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'result-card' + (selectedPartCode === item.code ? ' is-selected' : '');
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
          ' · údaj ' +
          escapeHtml(item.quantity || '—') +
          '</span></span>' +
          '<span class="result-go" aria-hidden="true">→</span>';
        btn.addEventListener('click', () => {
          selectedPartCode = item.code;
          selectedDrawer = item.drawer;
          activeSection = sectionOf(item.drawer) || activeSection;
          rememberQuery(query || item.name);
          renderHistory();
          renderQuick();
          renderResults();
          updateResultCount();
          paintMap(true);
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
          '</strong><span class="meta">Sekce ' +
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

  function openScanner() {
    setFeedback('');
    // getUserMedia MUST start in this synchronous click turn (Safari gesture).
    let prime;
    try {
      prime = scanner.primeFromGesture();
    } catch (err) {
      console.error(err);
      setFeedback(SCANNER_BETA_PREFIX + 'Kameru nelze spustit. Zadej kód ručně.', true);
      return;
    }
    scanner.continueAfterPrime(prime).then(function (result) {
      if (!result || result.ok) return;
      if (result.reason === 'permission') {
        setFeedback(SCANNER_BETA_PREFIX + 'Kamera je blokovaná v prohlížeči. Kód můžeš napsat ručně.', true);
      } else if (result.reason === 'cancelled') {
        /* user closed */
      } else if (result.reason === 'insecure-or-unsupported') {
        setFeedback(SCANNER_BETA_PREFIX + 'Kamera na tomto zařízení/prohlížeči není dostupná. Napiš kód.', true);
      }
    }).catch(function (err) {
      console.error(err);
      setFeedback(SCANNER_BETA_PREFIX + 'Chyba skeneru. Zkus znovu nebo napiš kód.', true);
    });
  }

  function bindEvents() {
    els.form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearTimeout(searchTimer);
      runSearch(true);
    });
    els.search.addEventListener('input', () => scheduleSearch());
    els.clear.addEventListener('click', () => {
      els.search.value = '';
      syncShareLink('');
      clearTimeout(searchTimer);
      runSearch(false);
      els.search.focus();
      showView('results');
    });
    els.modeIso.addEventListener('click', () => setMapMode('iso'));
    els.modeFlat.addEventListener('click', () => setMapMode('flat'));
    els.openScanner.addEventListener('click', openScanner);
    els.dockScan.addEventListener('click', openScanner);
    els.closeScanner.addEventListener('click', () => {
      scanner.close();
      els.openScanner.focus();
    });
    els.retryScanner.addEventListener('click', openScanner);
    els.dockSearch.addEventListener('click', () => {
      showView('results');
      els.search.focus();
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
    els.dockMap.addEventListener('click', () => {
      showView('map');
      const top = els.mapPanel.getBoundingClientRect().top + window.scrollY - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
    els.backResults.addEventListener('click', () => {
      showView('results');
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !els.scannerModal.hidden) {
        scanner.close();
        els.openScanner.focus();
        return;
      }
      const tag = (event.target && event.target.tagName) || '';
      if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && els.scannerModal.hidden) {
        event.preventDefault();
        showView('results');
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
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && query && els.scannerModal.hidden) {
        const cards = [...els.results.querySelectorAll('.result-card')];
        if (!cards.length) return;
        event.preventDefault();
        if (event.key === 'ArrowDown') resultCursor = Math.min(resultCursor + 1, cards.length - 1);
        else resultCursor = Math.max(resultCursor - 1, 0);
        cards.forEach((card, i) => card.classList.toggle('is-active', i === resultCursor));
        cards[resultCursor].focus();
      }
    });

    window.addEventListener('pagehide', () => scanner.stop());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') scanner.stop();
    });
  }

  async function boot() {
    bindEvents();
    showView('results');
    setMapMode(mapMode);
    renderHistory();
    renderFavorites();
    els.status.textContent = 'Načítám…';
    try {
      const data = await loadAll();
      drawers = data.drawers;
      parts = data.parts;
      sections = data.sections;
      warehouse = buildWarehouse(drawers);
      activeWallId = warehouse.walls[0].id;
      activeSection = warehouse.walls[0].sections[0] || 'A';
      els.status.textContent = formatCountLabel(data.meta.partCount, data.meta.drawerCount);
      els.mapNote.textContent =
        'Sloupce zleva, čísla shora dolů – orientační pohled.';

      const params = new URLSearchParams(window.location.search);
      const initial = params.get('q');
      if (initial) {
        els.search.value = initial;
        runSearch(true);
      } else {
        runSearch(false);
      }
      paintMap(true);
    } catch (err) {
      console.error(err);
      els.status.textContent = 'Chyba dat';
      els.results.innerHTML =
        '<p class="error">Data se nepodařilo načíst. Obnov stránku. (' +
        escapeHtml(err.message || String(err)) +
        ')</p>';
    }
  }

  boot();
})();
