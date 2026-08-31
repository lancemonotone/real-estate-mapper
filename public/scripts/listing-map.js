import { createPinHoverController } from "./map-pin-hover.js";
import { fitMapForPinTooltips } from "./map-fit.js";
import { nudgeMapLayout, whenMapVisible } from "./map-lazy.js";

function cssVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function themePinPalette() {
  const primary = cssVar("--primary") || "#0d9488";
  const primaryContrast = cssVar("--primary-contrast") || "#ffffff";
  const accent = cssVar("--accent") || "#2563eb";
  const placeGlyph = cssVar("--bg-0") || "#0b1220";
  return {
    listing: {
      background: primary,
      borderColor: primary,
      glyphColor: primaryContrast,
    },
    place: {
      background: accent,
      borderColor: accent,
      glyphColor: placeGlyph,
    },
  };
}

function parsePlaces(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadGoogleMaps(key) {
  if (window.google?.maps?.importLibrary) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve(undefined);
    script.onerror = () => reject(new Error("Failed to load Maps JS"));
    document.head.appendChild(script);
  });
}

let listingMapBootId = 0;

async function initListingMap() {
  let el = document.getElementById("listing-map");
  if (!el) return;

  // Soft-nav can reuse a host that already had a Map instance.
  const fresh = el.cloneNode(false);
  el.replaceWith(fresh);
  el = fresh;

  const bootId = ++listingMapBootId;

  const key = el.dataset.key;
  const mapId = el.dataset.mapId;
  const lat = Number(el.dataset.lat);
  const lng = Number(el.dataset.lng);
  const title = el.dataset.title || "Listing";
  const address = el.dataset.address || "";
  const photoUrl = el.dataset.photoUrl || "";
  const places = parsePlaces(el.dataset.places);

  if (!key || !mapId) {
    el.textContent =
      "Missing PUBLIC_GOOGLE_MAPS_BROWSER_KEY or PUBLIC_GOOGLE_MAPS_MAP_ID";
    return;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    el.textContent = "No geocoded location to show";
    return;
  }

  await loadGoogleMaps(key);
  if (bootId !== listingMapBootId || !document.getElementById("listing-map"))
    return;

  const { Map, InfoWindow } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement, PinElement } =
    await google.maps.importLibrary("marker");
  if (bootId !== listingMapBootId) return;

  el.replaceChildren();

  const position = { lat, lng };
  const map = new Map(el, {
    center: position,
    zoom: 15,
    mapId,
  });

  const pinHover = createPinHoverController(map, InfoWindow);
  const bounds = new google.maps.LatLngBounds();
  const palette = themePinPalette();

  function addPin(pos, colors, listing, header) {
    bounds.extend(pos);
    const pin = new PinElement({
      background: colors.background,
      borderColor: colors.borderColor,
      glyphColor: colors.glyphColor,
      scale: 1.1,
    });
    const marker = new AdvancedMarkerElement({
      map,
      position: pos,
      title: listing.name || header || "Place",
      content: pin.element,
    });
    pinHover.bind(marker, pin.element, listing, header);
  }

  addPin(
    position,
    palette.listing,
    {
      id: el.dataset.listingId || null,
      name: title,
      address,
      photoUrl: photoUrl || null,
    },
    "Listing",
  );

  for (const place of places) {
    const plat = Number(place.lat);
    const plng = Number(place.lng);
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
    const photo =
      place.photoUrl ||
      (place.placeId
        ? `/api/places/photo?place_id=${encodeURIComponent(place.placeId)}&max=160`
        : null);
    addPin(
      { lat: plat, lng: plng },
      palette.place,
      {
        id: place.id || null,
        name: place.name || "Place",
        address: place.address || "",
        photoUrl: photo,
      },
      place.label || place.name || "Place",
    );
  }

  if (bootId !== listingMapBootId) return;
  const fit = () => fitMapForPinTooltips(map, bounds);
  fit();
  nudgeMapLayout(map, fit);
}

function bootListingMap() {
  const el = document.getElementById("listing-map");
  if (!el) return;

  whenMapVisible(el, () => {
    initListingMap().catch((err) => {
      const host = document.getElementById("listing-map");
      if (host)
        host.textContent = err instanceof Error ? err.message : "Map failed";
    });
  });
}

bootListingMap();
document.addEventListener("astro:page-load", bootListingMap);
