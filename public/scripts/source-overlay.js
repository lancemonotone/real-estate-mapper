let lastFocus = null;

function ensureDom() {
  let root = document.getElementById('source-overlay');
  if (!root) return null;
  if (root.parentElement !== document.body) {
    document.body.appendChild(root);
  }
  return root;
}

function closeSourceOverlay() {
  const root = ensureDom();
  if (!root) return;
  root.hidden = true;
  document.body.classList.remove('source-overlay-open');
  const frame = document.getElementById('source-overlay-frame');
  if (frame instanceof HTMLIFrameElement) {
    frame.src = 'about:blank';
  }
  if (lastFocus instanceof HTMLElement) {
    lastFocus.focus();
  }
}

function bindCloseHandlers(root) {
  if (root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  root.querySelectorAll('[data-source-overlay-close]').forEach((el) => {
    el.addEventListener('click', () => closeSourceOverlay());
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden) closeSourceOverlay();
  });
}

/**
 * @param {{ url: string, title?: string }} opts
 */
export function openSourceOverlay(opts) {
  const root = ensureDom();
  if (!root) {
    console.error('Source overlay markup missing');
    return;
  }
  const url = typeof opts?.url === 'string' ? opts.url.trim() : '';
  if (!url) return;

  bindCloseHandlers(root);
  lastFocus = document.activeElement;

  const titleEl = document.getElementById('source-overlay-title');
  const statusEl = document.getElementById('source-overlay-status');
  const extEl = document.getElementById('source-overlay-external');
  const frame = document.getElementById('source-overlay-frame');

  if (titleEl) titleEl.textContent = opts.title || 'Listing source';
  if (extEl instanceof HTMLAnchorElement) {
    extEl.href = url;
    extEl.hidden = false;
  }
  if (statusEl) {
    statusEl.hidden = false;
    statusEl.textContent =
      'If the page stays blank, the listing site blocks embedding — use Open in new tab.';
  }

  root.hidden = false;
  document.body.classList.add('source-overlay-open');
  root.scrollTop = 0;

  if (frame instanceof HTMLIFrameElement) {
    frame.src = url;
  }
}

function initSourceLinks() {
  document.querySelectorAll('[data-source-overlay]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const href = el.getAttribute('href');
      if (!href) return;
      e.preventDefault();
      openSourceOverlay({
        url: href,
        title: el.getAttribute('data-source-title') || 'Listing source',
      });
    });
  });
}

window.openSourceOverlay = openSourceOverlay;
window.closeSourceOverlay = closeSourceOverlay;
ensureDom();
initSourceLinks();
