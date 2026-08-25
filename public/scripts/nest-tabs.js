function pillMetrics(nav, control) {
  return {
    x: control.offsetLeft,
    y: control.offsetTop,
    w: control.offsetWidth,
    h: control.offsetHeight,
  };
}

function applyPill(pill, metrics, { animate } = { animate: true }) {
  if (!animate) {
    pill.style.transition = 'none';
  }
  pill.style.width = `${metrics.w}px`;
  pill.style.height = `${metrics.h}px`;
  pill.style.transform = `translate(${metrics.x}px, ${metrics.y}px)`;
  if (!animate) {
    void pill.offsetWidth;
    pill.style.transition = '';
  }
}

function activateTab(root, tab, { animate } = { animate: true }) {
  const bar = root.querySelector('[data-nest-tabs-bar]');
  const pill = bar?.querySelector('[data-nest-tabs-pill]');
  if (!(bar instanceof HTMLElement) || !(tab instanceof HTMLButtonElement)) return;

  const tabId = tab.dataset.nestTab;
  if (!tabId) return;

  bar.querySelectorAll('[data-nest-tab]').forEach((control) => {
    if (!(control instanceof HTMLButtonElement)) return;
    const selected = control === tab;
    control.classList.toggle('locale-nav__link--active', selected);
    control.setAttribute('aria-selected', selected ? 'true' : 'false');
    control.tabIndex = selected ? 0 : -1;
  });

  root.querySelectorAll('[data-nest-tab-panel]').forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    const show = panel.dataset.nestTabPanel === tabId;
    panel.hidden = !show;
  });

  if (pill instanceof HTMLElement) {
    applyPill(pill, pillMetrics(bar, tab), { animate });
    bar.classList.add('is-ready');
  }
}

function bindNestTabs(root) {
  if (!(root instanceof HTMLElement) || root.dataset.nestTabsBound === 'true') return;
  root.dataset.nestTabsBound = 'true';

  const bar = root.querySelector('[data-nest-tabs-bar]');
  if (!(bar instanceof HTMLElement)) return;

  const tabs = [...bar.querySelectorAll('[data-nest-tab]')].filter(
    (el) => el instanceof HTMLButtonElement,
  );
  if (tabs.length === 0) return;

  const selectFromHash = () => {
    const hash = location.hash.replace('#', '');
    const match = tabs.find((tab) => tab.dataset.nestTab === hash);
    return match ?? tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? tabs[0];
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.nestTab;
      if (tabId) {
        history.replaceState(null, '', `#${tabId}`);
      }
      activateTab(root, tab, { animate: true });
    });
  });

  bar.addEventListener('keydown', (event) => {
    if (!(event.target instanceof HTMLButtonElement) || !event.target.matches('[data-nest-tab]')) {
      return;
    }
    const index = tabs.indexOf(event.target);
    if (index < 0) return;

    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;

    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  });

  window.addEventListener('resize', () => {
    const active = selectFromHash();
    if (active) activateTab(root, active, { animate: false });
  });

  window.addEventListener('hashchange', () => {
    const active = selectFromHash();
    if (active) activateTab(root, active, { animate: true });
  });

  const firstPaint = root.dataset.nestTabsReady !== 'true';
  root.dataset.nestTabsReady = 'true';
  activateTab(root, selectFromHash(), { animate: !firstPaint });
}

function bootNestTabs() {
  document.querySelectorAll('[data-nest-tabs]').forEach((root) => bindNestTabs(root));
}

bootNestTabs();
document.addEventListener('astro:page-load', bootNestTabs);
