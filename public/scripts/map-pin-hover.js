/**
 * Shared listing ↔ pin hover for every map in the app.
 * Pins register here; list rows use [data-map-listing] to drive the same highlight + InfoWindow.
 */

const ROW_SEL = '[data-map-listing]';

/** @type {Map<string, PinEntry>} */
const registry = new Map();

/** @type {{ listingId: string | null, infoWindow: object | null }} */
const active = { listingId: null, infoWindow: null };

let listHoverInstalled = false;

/**
 * @typedef {{
 *   marker: object,
 *   pinEl: Element,
 *   listing: object,
 *   header?: string,
 *   map: object,
 *   infoWindow: object,
 * }} PinEntry
 */

const PIN_INFO_WIDTH_PX = 100;

export function buildListingInfoContent(listing, header) {
  const wrap = document.createElement('div');
  wrap.className = 'map-pin-info';
  // Inline sizes beat Maps measuring unwrapped text before CSS applies.
  wrap.style.cssText = [
    `width:${PIN_INFO_WIDTH_PX}px`,
    `max-width:${PIN_INFO_WIDTH_PX}px`,
    'box-sizing:border-box',
    'white-space:normal',
    'overflow-wrap:anywhere',
    'word-break:break-word',
  ].join(';');

  if (header != null && String(header).trim()) {
    const stop = document.createElement('div');
    stop.className = 'map-pin-info__stop';
    stop.textContent = String(header).trim();
    wrap.appendChild(stop);
  }

  if (listing.photoUrl) {
    const img = document.createElement('img');
    img.className = 'map-pin-info__photo';
    img.src = listing.photoUrl;
    img.alt = '';
    img.width = PIN_INFO_WIDTH_PX;
    img.height = PIN_INFO_WIDTH_PX;
    img.style.cssText = [
      `width:${PIN_INFO_WIDTH_PX}px`,
      `height:${PIN_INFO_WIDTH_PX}px`,
      'max-width:100%',
      'display:block',
      'object-fit:cover',
    ].join(';');
    wrap.appendChild(img);
  }

  const title = document.createElement('div');
  title.className = 'map-pin-info__title';
  title.textContent = listing.name || 'Listing';
  wrap.appendChild(title);

  if (listing.address) {
    const addr = document.createElement('div');
    addr.className = 'map-pin-info__address';
    addr.textContent = listing.address;
    wrap.appendChild(addr);
  }

  return wrap;
}

function clearRowHighlight() {
  document.querySelectorAll(`${ROW_SEL}.is-map-hover`).forEach((el) => {
    el.classList.remove('is-map-hover');
  });
}

function setRowHighlight(listingId) {
  clearRowHighlight();
  if (listingId == null || listingId === '') return;
  document
    .querySelectorAll(`${ROW_SEL}[data-map-listing="${CSS.escape(String(listingId))}"]`)
    .forEach((el) => el.classList.add('is-map-hover'));
}

function setPinActive(listingId) {
  for (const [id, entry] of registry) {
    const on = listingId != null && id === String(listingId);
    entry.pinEl.classList.toggle('is-map-pin-hover', on);
    entry.marker.zIndex = on ? 1000 : null;
  }
}

function showEntry(entry) {
  const listingId = entry.listing?.id ?? null;
  if (active.infoWindow && active.infoWindow !== entry.infoWindow) {
    active.infoWindow.close();
  }
  active.listingId = listingId != null ? String(listingId) : null;
  active.infoWindow = entry.infoWindow;

  entry.infoWindow.close();
  entry.infoWindow.setContent(buildListingInfoContent(entry.listing, entry.header));
  entry.infoWindow.open({ anchor: entry.marker, map: entry.map });
  setPinActive(listingId);
  setRowHighlight(listingId);
}

function hideListing(listingId) {
  if (
    listingId != null &&
    active.listingId != null &&
    String(listingId) !== String(active.listingId)
  ) {
    return;
  }
  if (active.infoWindow) active.infoWindow.close();
  active.listingId = null;
  active.infoWindow = null;
  setPinActive(null);
  clearRowHighlight();
}

function showByListingId(listingId) {
  const entry = registry.get(String(listingId));
  if (!entry) return;
  showEntry(entry);
}

function rowListingIdFromEventTarget(target) {
  if (!(target instanceof Element)) return null;
  const row = target.closest(ROW_SEL);
  if (!row) return null;
  const id = row.getAttribute('data-map-listing');
  return id || null;
}

function ensureListHover() {
  if (listHoverInstalled) return;
  listHoverInstalled = true;

  document.addEventListener(
    'pointerover',
    (e) => {
      const id = rowListingIdFromEventTarget(e.target);
      if (!id || !registry.has(id)) return;
      const fromId = rowListingIdFromEventTarget(e.relatedTarget);
      if (fromId === id) return;
      showByListingId(id);
    },
    true,
  );

  document.addEventListener(
    'pointerout',
    (e) => {
      const id = rowListingIdFromEventTarget(e.target);
      if (!id || !registry.has(id)) return;
      const toId = rowListingIdFromEventTarget(e.relatedTarget);
      if (toId === id) return;
      hideListing(id);
    },
    true,
  );
}

function clearRegistry() {
  for (const entry of registry.values()) {
    entry.pinEl.classList.remove('is-map-pin-hover');
    entry.marker.zIndex = null;
  }
  registry.clear();
  if (active.infoWindow) active.infoWindow.close();
  active.listingId = null;
  active.infoWindow = null;
  clearRowHighlight();
}

/**
 * Create a hover controller bound to one map instance.
 * Replaces any previously registered pins (one active listing map at a time).
 */
export function createPinHoverController(map, InfoWindow) {
  clearRegistry();
  const infoWindow = new InfoWindow({
    maxWidth: PIN_INFO_WIDTH_PX,
    disableAutoPan: true,
  });
  ensureListHover();

  function show(marker, listing, header) {
    const listingId = listing?.id;
    if (listingId == null) {
      // Single-pin maps (listing detail) without a list id — still show tooltip.
      infoWindow.close();
      infoWindow.setContent(buildListingInfoContent(listing, header));
      infoWindow.open({ anchor: marker, map });
      active.infoWindow = infoWindow;
      return;
    }
    const entry = registry.get(String(listingId));
    if (entry) showEntry(entry);
    else {
      showEntry({ marker, pinEl: marker.content ?? marker, listing, header, map, infoWindow });
    }
  }

  function hide(listingId) {
    hideListing(listingId);
  }

  function bind(marker, pinEl, listing, header) {
    const listingId = listing?.id ?? null;

    if (listingId != null) {
      registry.set(String(listingId), {
        marker,
        pinEl,
        listing,
        header,
        map,
        infoWindow,
      });
    }

    const onEnter = () => {
      if (listingId != null) showByListingId(listingId);
      else show(marker, listing, header);
    };
    const onLeave = () => hide(listingId);

    pinEl.addEventListener('pointerenter', onEnter);
    pinEl.addEventListener('pointerleave', onLeave);
    marker.addEventListener('pointerenter', onEnter);
    marker.addEventListener('pointerleave', onLeave);
  }

  return { bind, show, hide, infoWindow };
}
