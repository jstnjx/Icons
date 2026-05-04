(async function () {
  'use strict';

  const api = typeof browser !== "undefined" ? browser : chrome;
  const { apiKey: API_KEY } = await api.storage.sync.get("apiKey");

  let currentIcons = [];
  let filteredIcons = [];
  let countries = [];
  let currentPage = 1;
  const ITEMS_PER_PAGE = 70;

  const uploadingIcons = new Set();

  let initialized = false;
  let setupShown = false;

  // -----------------------------
  // API CACHE
  const apiCache = new Map();
  const CACHE_TTL = 5 * 60 * 1000;

  // -----------------------------
  function openSettings() {
    api.runtime.openOptionsPage();
  }

  // -----------------------------
  function showToast(message, type = 'success') {
    let container = document.getElementById('uc-toast-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'uc-toast-container';
      Object.assign(container.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '99999',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      });
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.textContent = message;

    Object.assign(toast.style, {
      padding: '12px 16px',
      borderRadius: '12px',
      fontSize: '14px',
      color: '#fff',
      background: type === 'error' ? '#ff4d4f' : '#1f1f1f',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      opacity: '0',
      transform: 'translateY(10px)',
      transition: 'all 0.2s ease'
    });

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  // -----------------------------
  function showSetupState(message) {
    if (setupShown) return;
    setupShown = true;

    const panel = document.getElementById('icon-library-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;box-sizing:border-box;">
        <div style="width:100%;max-width:360px;background:#1a1a1c;border-radius:16px;padding:24px;box-sizing:border-box;text-align:center;">
          <h3 style="margin:0 0 10px 0;">Setup Required</h3>
          <p id="setup-message" style="color:#aaa;font-size:13px;margin-bottom:20px;"></p>

          <input id="inline-api-key" placeholder="Enter API key"
            style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:#111;color:#fff;margin-bottom:12px;box-sizing:border-box;" />

          <button id="save-inline-key"
            style="width:100%;padding:10px;border-radius:10px;background:#4da3ff;border:none;margin-bottom:10px;cursor:pointer;">
            Save API Key
          </button>

          <button id="open-settings"
            style="width:100%;padding:10px;border-radius:10px;background:#2a2a2d;border:none;cursor:pointer;">
            Open Settings
          </button>
        </div>
      </div>
    `;

    document.getElementById("setup-message").textContent = message;

    document.getElementById("save-inline-key").onclick = async () => {
      const value = document.getElementById("inline-api-key").value.trim();
      if (!value) return;

      await api.storage.sync.set({ apiKey: value });
      showToast("API key saved");
      location.reload();
    };

    document.getElementById("open-settings").onclick = openSettings;
  }

  // -----------------------------
  async function apiFetch(url) {
    if (!API_KEY) {
      showSetupState("No API key provided");
      throw new Error();
    }

    const cached = apiCache.get(url);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return cached.data;
    }

    const res = await fetch(url, {
      headers: { 'X-API-Key': API_KEY }
    });

    if (res.status === 401 || res.status === 403) {
      showSetupState("Invalid API key");
      throw new Error();
    }

    if (!res.ok) throw new Error();

    const data = await res.json();
    apiCache.set(url, { data, time: Date.now() });

    return data;
  }

  // -----------------------------
  function createSkeletonOverlay() {
    const overlay = document.createElement('div');

    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.borderRadius = '8px';
    overlay.style.background =
      'linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.06) 75%)';
    overlay.style.backgroundSize = '200% 100%';
    overlay.style.animation = 'uc-skeleton 1.2s infinite';
    overlay.style.zIndex = '2';

    return overlay;
  }

  if (!document.getElementById('uc-skeleton-style')) {
    const style = document.createElement('style');
    style.id = 'uc-skeleton-style';
    style.textContent = `
      @keyframes uc-skeleton {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // -----------------------------
  function isCustomiseRoute() {
    return location.hash.includes('/customise-remote');
  }

  function injectTabButton() {
    const tabList = document.querySelector('.tab-menu__list');
    if (!tabList || document.getElementById('icon-library-tab')) return;

    const li = document.createElement('li');
    li.id = 'icon-library-tab';
    li.className = 'tab-menu__list__item';

    li.innerHTML = `
      <i class="tab-menu__list__item__icon fa-light fa-grid-2"></i>
      <span class="tab-menu__list__item__label">Icon Library</span>
    `;

    li.onclick = () => {
      document.querySelectorAll('.tab-menu__list__item')
        .forEach(el => el.classList.remove('active'));

      li.classList.add('active');

      document.querySelectorAll('.customise-remote__tab')
        .forEach(el => el.style.display = 'none');

      const panel = document.getElementById('icon-library-panel');
      if (panel) panel.style.display = '';
    };

    tabList.appendChild(li);
  }

  function injectPanel() {
    const tabs = document.querySelector('.customise-remote__tabs');
    if (!tabs || document.getElementById('icon-library-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'icon-library-panel';
    panel.className = 'customise-remote__tab';
    panel.style.display = 'none';
    panel.style.width = '100%';
    panel.style.flex = '1';
    panel.style.overflow = 'auto';

    tabs.insertBefore(panel, tabs.firstChild);

    const iconList = document.createElement('div');
    iconList.className = 'icon-list';

    const list = document.createElement('div');
    list.className = 'list-with-filter list-with-filter--pagination';
    list.style.padding = '0 24px';

    const form = document.createElement('div');
    form.className = 'list-with-filter__form';
    form.style.marginTop = '16px';

    const tools = document.createElement('div');
    tools.className = 'list-with-filter__form__tools';

    const left = document.createElement('div');
    left.className = 'button-group';

    const right = document.createElement('div');
    right.className = 'list-with-filter__form__tools__col-right';
    right.style.display = 'flex';
    right.style.gap = '10px';

    const tabsDef = [
      { key: 'apps', label: 'Apps' },
      { key: 'tv-apps', label: 'TV Apps' },
      { key: 'community', label: 'Community' },
      { key: 'tv-logos', label: 'TV Logos' }
    ];

    tabsDef.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.className = 'button';
      btn.textContent = t.label;

      if (i === 0) btn.classList.add('active');

      btn.onclick = () => {
        left.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchTab(t.key);
      };

      left.appendChild(btn);
    });

    const searchWrap = document.createElement('div');
    searchWrap.className = 'list-with-filter__search icon-list__search';

    const searchItem = document.createElement('div');
    searchItem.className = 'form-item form-item--search form-item--search--gray';

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search';

    searchItem.appendChild(search);
    searchWrap.appendChild(searchItem);

    const select = document.createElement('select');
    select.style.display = 'none';
    select.style.background = '#000000';
    select.style.color = '#fff';
    select.style.borderRadius = '20px';
    select.style.padding = '12px 16px';
    select.style.border = '1px solid rgba(255,255,255,0.1)';
    select.style.fontSize = '14px';

    right.appendChild(searchWrap);
    right.appendChild(select);

    tools.appendChild(left);
    tools.appendChild(right);
    form.appendChild(tools);

    const items = document.createElement('div');
    items.className = 'list-with-filter__items';
    items.id = 'icon-library-grid';

    const paging = document.createElement('div');
    paging.className = 'list-paging';
    paging.id = 'icon-pagination';

    list.appendChild(form);
    list.appendChild(items);
    list.appendChild(paging);

    iconList.appendChild(list);
    panel.appendChild(iconList);

    search.oninput = () => {
      currentPage = 1;
      filterIcons();
    };

    switchTab('apps');
  }

  function setupTabSync() {
    const wait = new MutationObserver(() => {
      const tabList = document.querySelector('.tab-menu__list');
      if (!tabList) return;

      wait.disconnect();

      tabList.addEventListener('click', (e) => {
        const clicked = e.target.closest('.tab-menu__list__item');
        if (!clicked) return;

        const panel = document.getElementById('icon-library-panel');
        if (!panel) return;

        if (clicked.id !== 'icon-library-tab') {
          panel.style.display = 'none';
        }
      });
    });

    wait.observe(document.body, { childList: true, subtree: true });
  }

  async function switchTab(tab) {
    currentPage = 1;

    const select = document.querySelector('#icon-library-panel select');

    if (tab === 'tv-logos') {
      select.style.display = '';
      await loadCountries(select);
    } else {
      select.style.display = 'none';
      await loadIcons(`/v1/icons/${tab}`);
    }
  }

  async function loadIcons(endpoint) {
    const data = await apiFetch(`https://api.unfolded.tools${endpoint}`);
    currentIcons = data.icons;
    filteredIcons = currentIcons;
    render();
  }

  async function loadCountries(select) {
    const data = await apiFetch(`https://api.unfolded.tools/v1/icons/tv-logos/countries`);
    countries = data.countries;

    select.innerHTML = '';

    countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.country;
      opt.textContent = c.country.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      select.appendChild(opt);
    });

    select.onchange = () => {
      currentPage = 1;
      loadTVLogos(select.value);
    };

    loadTVLogos(countries[0].country);
  }

  async function loadTVLogos(country) {
    const data = await apiFetch(`https://api.unfolded.tools/v1/icons/tv-logos/${country}`);
    currentIcons = data.icons;
    filteredIcons = currentIcons;
    render();
  }

  function filterIcons() {
    const q = document.querySelector('#icon-library-panel input').value.toLowerCase();
    filteredIcons = currentIcons.filter(i => i.name.toLowerCase().includes(q));
    render();
  }

  function render() {
    renderGrid();
    renderPagination();
  }

  function renderGrid() {
    const grid = document.getElementById('icon-library-grid');
    grid.innerHTML = '';

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filteredIcons.slice(start, start + ITEMS_PER_PAGE);

    pageItems.forEach(icon => {
      const item = document.createElement('div');
      item.className = 'icon-list__item';

      const wrapper = document.createElement('div');
      wrapper.className = 'icon-list__item__image-wrapper';

      const img = document.createElement('img');
      img.src = `data:image/webp;base64,${icon.base64}`;

      const label = document.createElement('span');
      label.className = 'icon-list__item__label';
      label.textContent = icon.name;

      wrapper.appendChild(img);
      item.appendChild(wrapper);
      item.appendChild(label);

      item.onclick = () => importIcon(icon, item);

      grid.appendChild(item);
    });
  }

  function renderPagination() {
    const container = document.getElementById('icon-pagination');
    container.innerHTML = '';

    const totalPages = Math.ceil(filteredIcons.length / ITEMS_PER_PAGE);

    const wrapper = document.createElement('div');
    wrapper.className = 'list-paging__page-buttons';

    function addPage(p) {
      const btn = document.createElement('button');
      btn.className = 'button button--blank';

      if (p === currentPage) btn.classList.add('button--active');

      btn.textContent = p;
      btn.onclick = () => {
        currentPage = p;
        render();
      };

      wrapper.appendChild(btn);
    }

    function dots() {
      const span = document.createElement('span');
      span.className = 'list-paging__page-buttons__spacer';
      span.textContent = '...';
      wrapper.appendChild(span);
    }

    addPage(1);

    let start = Math.max(2, currentPage - 2);
    let end = Math.min(totalPages - 1, currentPage + 2);

    if (start > 2) dots();

    for (let i = start; i <= end; i++) addPage(i);

    if (end < totalPages - 1) dots();

    if (totalPages > 1) addPage(totalPages);

    container.appendChild(wrapper);
  }

  async function importIcon(icon, itemEl) {
    if (uploadingIcons.has(icon.name)) return;
    uploadingIcons.add(icon.name);

    let skeleton;

    try {
      const wrapper = itemEl.querySelector('.icon-list__item__image-wrapper');
      wrapper.style.position = 'relative';

      skeleton = createSkeletonOverlay();
      wrapper.appendChild(skeleton);

      itemEl.style.pointerEvents = 'none';
      itemEl.style.opacity = '0.6';

      const blob = await fetch(icon.download_url).then(r => r.blob());

      const form = new FormData();
      form.append('file', blob, `${icon.name}.png`);

      const res = await fetch('/api/resources/Icon', {
        method: 'POST',
        body: form,
        credentials: 'include'
      });

      if (!res.ok) throw new Error();

      showToast(`Imported "${icon.name}"`);
    } catch {
      showToast(`Import failed`, "error");
    } finally {
      uploadingIcons.delete(icon.name);
      if (skeleton) skeleton.remove();
      itemEl.style.pointerEvents = '';
      itemEl.style.opacity = '';
    }
  }

  const observer = new MutationObserver(() => {
    if (!isCustomiseRoute()) return;
    if (initialized) return;

    const tabList = document.querySelector('.tab-menu__list');
    const tabs = document.querySelector('.customise-remote__tabs');

    if (!tabList || !tabs) return;

    injectTabButton();
    injectPanel();

    initialized = true;
    observer.disconnect();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  setupTabSync();

})();
