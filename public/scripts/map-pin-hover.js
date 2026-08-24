/**
 * Shared listing pin hover: InfoWindow tooltip + optional table/list row highlight.
 */

export function buildListingInfoContent(listing) {
  const wrap = document.createElement('div');
  wrap.className = 'map-pin-info';

  if (listing.photoUrl) {
    const img = document.createElement('img');
    img.className = 'map-pin-info__photo';
    img.src = listing.photoUrl;
    img.alt = '';
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

export function createPinHoverController(map, InfoWindow) {
  const infoWindow = new InfoWindow({ maxWidth: 280, disableAutoPan: true });
  let activeListingId = null;

  function clearRowHighlight() {
    document.querySelectorAll('[data-listing-id].is-map-hover').forEach((el) => {
      el.classList.remove('is-map-hover');
    });
  }

  function setRowHighlight(listingId) {
    clearRowHighlight();
    if (!listingId) return;
    document
      .querySelectorAll(`[data-listing-id="${CSS.escape(String(listingId))}"]`)
      .forEach((el) => el.classList.add('is-map-hover'));
  }

  function show(marker, listing, header) {
    const listingId = listing?.id ?? null;
    activeListingId = listingId;
    infoWindow.close();
    if (header != null && header !== '') {
      infoWindow.setHeaderContent(header);
    } else {
      infoWindow.setHeaderContent('');
    }
    infoWindow.setContent(buildListingInfoContent(listing));
    infoWindow.open({ anchor: marker, map });
    setRowHighlight(listingId);
  }

  function hide(listingId) {
    if (listingId != null && activeListingId != null && String(listingId) !== String(activeListingId)) {
      return;
    }
    activeListingId = null;
    infoWindow.close();
    clearRowHighlight();
  }

  function bind(marker, pinEl, listing, header) {
    const listingId = listing?.id ?? null;

    const onEnter = () => show(marker, listing, header);
    const onLeave = () => hide(listingId);

    pinEl.addEventListener('pointerenter', onEnter);
    pinEl.addEventListener('pointerleave', onLeave);

    // AdvancedMarker surface can receive pointer events independently of custom content.
    marker.addEventListener('pointerenter', onEnter);
    marker.addEventListener('pointerleave', onLeave);
  }

  return { bind, show, hide, infoWindow };
}
