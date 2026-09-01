import {
  buildListingDisplay,
  type ListingDisplayInput,
} from "../lib/listings/listing-display";
import { LISTING_FIELD_LABELS } from "../lib/listings/field-labels";
import type {
  ListingPageSurface,
  ListingPageSurfaceCompareRow,
} from "../lib/listings/listing-page-surface-types";
import { compareRowPlaceTypeKey } from "../lib/listings/compare-row-place-type-key";
import { sliceVisiblePhotoUrls } from "../lib/nest/entitlements/resolve";
import type { EntitlementPlan } from "../lib/nest/entitlements/constants";
import { formatTourDate } from "../lib/tours/format-tour-date";
import { updateListingHeroPhotos } from "./listing-gallery";

type SurfaceConfig = {
  plan: EntitlementPlan;
  listingId?: string;
  localeId?: string;
};

type ListingProxConfig = {
  listingId?: string;
};

declare global {
  interface Window {
    __WAYHOME_LISTING_SURFACE__?: SurfaceConfig;
    __WAYHOME_LISTING_PROX__?: ListingProxConfig;
    __WAYHOME_REFRESH_LISTING_SURFACE__?: (options?: {
      tourDay?: string;
      closePlaceOverlay?: boolean;
    }) => Promise<void>;
  }
}

function surfaceConfig(): SurfaceConfig | null {
  const raw = window.__WAYHOME_LISTING_SURFACE__;
  if (!raw || (raw.plan !== "free" && raw.plan !== "pro")) return null;
  return raw;
}

function listingId(): string | null {
  return (
    window.__WAYHOME_LISTING_PROX__?.listingId ??
    window.__WAYHOME_LISTING_SURFACE__?.listingId ??
    document.querySelector<HTMLElement>("#listing-map")?.dataset.listingId ??
    null
  );
}

function setText(el: Element | null, text: string) {
  if (el) el.textContent = text;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderFactGroup(
  group: ReturnType<typeof buildListingDisplay>["factGroups"][number],
): string {
  const titleClass = group.srOnlyTitle
    ? "listing-section__title visually-hidden"
    : "listing-section__title";
  return `
    <div class="listing-facts-group">
      <h2 class="${titleClass}">${escapeHtml(group.title)}</h2>
      <dl class="listing-facts">
        ${group.facts
          .map(
            (fact) => `
          <div class="listing-facts__row">
            <dt>${escapeHtml(fact.label)}</dt>
            <dd>
              <span class="${fact.prewrap ? "listing-facts__value--prewrap" : ""}">${escapeHtml(fact.value)}</span>
            </dd>
          </div>`,
          )
          .join("")}
      </dl>
    </div>`;
}

function renderFactGroups(
  groups: ReturnType<typeof buildListingDisplay>["factGroups"],
): string {
  if (groups.length === 0) return "";
  const attributeGroups = groups.filter((group) => group.column === "attributes");
  const costGroups = groups.filter((group) => group.column === "costs");
  const attributesCol =
    attributeGroups.length > 0
      ? `<div class="listing-hero__fact-col listing-hero__fact-col--attributes">${attributeGroups.map(renderFactGroup).join("")}</div>`
      : "";
  const costsCol =
    costGroups.length > 0
      ? `<div class="listing-hero__fact-col listing-hero__fact-col--costs">${costGroups.map(renderFactGroup).join("")}</div>`
      : "";
  return `<div class="listing-hero__fact-sections">${attributesCol}${costsCol}</div>`;
}

function renderCostSummary(
  display: ReturnType<typeof buildListingDisplay>,
): string {
  if (!display.monthlyTotal && !display.moveInTotal) return "";
  const monthly = display.monthlyTotal
    ? `<div class="listing-cost-summary__item">
        <dt>${escapeHtml(LISTING_FIELD_LABELS.totalMonthly)}</dt>
        <dd>${escapeHtml(display.monthlyTotal)}</dd>
      </div>`
    : "";
  const moveInQualifier = display.showMoveInDepositNote
    ? '<span class="listing-cost-summary__qualifier"> (includes deposit)</span>'
    : "";
  const moveIn = display.moveInTotal
    ? `<div class="listing-cost-summary__item">
        <dt>${escapeHtml(LISTING_FIELD_LABELS.totalMoveIn)}${moveInQualifier}</dt>
        <dd>${escapeHtml(display.moveInTotal)}</dd>
      </div>`
    : "";
  return `<section class="listing-cost-summary" aria-label="Cost totals" data-listing-cost-summary>
    <dl class="listing-cost-summary__grid">${monthly}${moveIn}</dl>
  </section>`;
}

function renderContact(
  display: ReturnType<typeof buildListingDisplay>,
): string {
  if (!display.address && !display.sourceUrl && !display.phone) return "";
  const address = display.address
    ? `<p class="listing-hero__address" data-listing-address>${escapeHtml(display.address)}</p>`
    : '<p class="muted">No address yet.</p>';
  const source = display.sourceUrl
    ? `<a
        class="secondary icon-btn"
        href="${escapeHtml(display.sourceUrl)}"
        target="_blank"
        rel="noopener noreferrer"
        title="Open listing source"
        aria-label="Open listing source"
        data-listing-source
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14 4h6v6"></path>
          <path d="M10 14L20 4"></path>
          <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"></path>
        </svg>
      </a>`
    : "";
  const phone = display.phone
    ? `<p class="listing-hero__phone" data-listing-phone>
        <a href="tel:${escapeHtml(display.phone.replace(/[^\d+]/g, ""))}">${escapeHtml(display.phone)}</a>
      </p>`
    : "";
  return `<div class="listing-hero__contact stack" data-listing-contact>
    ${display.address || display.sourceUrl ? `<div class="listing-hero__address-row">${address}${source}</div>` : ""}
    ${phone}
  </div>`;
}

function renderCompareRow(
  row: ListingPageSurfaceCompareRow,
  listingIdValue: string,
): string {
  const thumb = row.placeId
    ? `<img
        class="matrix-listing__thumb prox-saved-item__thumb"
        src="/api/places/photo?place_id=${encodeURIComponent(row.placeId)}&max=120"
        alt=""
        loading="lazy"
        onerror="this.hidden=true"
      />`
    : `<span class="matrix-listing__thumb matrix-listing__thumb--empty" aria-hidden="true">No photo</span>`;
  const seeded = row.result
    ? `<span class="seeded" hidden>${escapeHtml(JSON.stringify(row.result))}</span>`
    : "";
  return `<tr
    class="prox-saved-item prox-saved-item--compare"
    data-listing-prox-cell
    data-map-listing="criterion:${escapeHtml(row.criterionId)}"
    data-column-label="${escapeHtml(row.label)}"
    data-listing-id="${escapeHtml(listingIdValue)}"
    data-criterion-id="${escapeHtml(row.criterionId)}"
    data-place-type-key="${escapeHtml(compareRowPlaceTypeKey(row))}"
    data-listing-lat="${escapeHtml(row.listingLat)}"
    data-listing-lng="${escapeHtml(row.listingLng)}"
    data-travel-mode="${escapeHtml(row.travelMode)}"
  >
    <th scope="row" class="matrix-table__place">
      ${seeded}
      <div class="matrix-listing">
        <span class="matrix-listing__media" data-prox-thumb>${thumb}</span>
        <div class="cell-ok__place">
          <span class="matrix-listing__label">${escapeHtml(row.label)}</span>
          <div class="cell-ok__name">${escapeHtml(row.placeName)}</div>
          <div class="cell-ok__meta prox-cell-meta">${escapeHtml(row.metaLabel)}</div>
        </div>
        <div class="cell-actions" data-cell-actions></div>
      </div>
    </th>
    <td class="matrix-type">
      <span class="matrix-type__icon" title="On Travel Times" aria-label="On Travel Times">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 6h16"></path>
          <path d="M4 12h16"></path>
          <path d="M4 18h10"></path>
          <path d="M16 16l2 2 4-4"></path>
        </svg>
      </span>
    </td>
  </tr>`;
}

function renderListingPlaceRow(
  place: ListingPageSurface["travel"]["listingPlaces"][number],
): string {
  const thumb = place.placeId
    ? `<img
        class="matrix-listing__thumb prox-saved-item__thumb"
        src="/api/places/photo?place_id=${encodeURIComponent(place.placeId)}&max=120"
        alt=""
        loading="lazy"
        onerror="this.hidden=true"
      />`
    : `<span class="matrix-listing__thumb matrix-listing__thumb--empty" aria-hidden="true">No photo</span>`;
  return `<tr
    class="prox-saved-item prox-saved-item--listing"
    data-map-listing="listing-place:${escapeHtml(place.id)}"
    data-place-row-id="${escapeHtml(place.id)}"
    data-place-lat="${String(place.lat)}"
    data-place-lng="${String(place.lng)}"
    data-place-id="${escapeHtml(place.placeId)}"
    data-place-name="${escapeHtml(place.name)}"
    data-travel-mode="${escapeHtml(place.travelMode)}"
    data-duration-sec="${place.durationSec != null ? String(place.durationSec) : ""}"
    data-distance-m="${place.distanceM != null ? String(place.distanceM) : ""}"
    data-maps-url="${escapeHtml(place.mapsUrl ?? "")}"
  >
    <th scope="row" class="matrix-table__place">
      <div class="matrix-listing">
        <span class="matrix-listing__media" data-prox-thumb>${thumb}</span>
        <div class="cell-ok__place">
          <div class="cell-ok__name">${escapeHtml(place.name)}</div>
          <div class="cell-ok__meta prox-cell-meta">${escapeHtml(place.metaLabel)}</div>
        </div>
        <div class="cell-actions" data-cell-actions></div>
      </div>
    </th>
    <td class="matrix-type">
      <span class="matrix-type__icon" title="Listing only" aria-label="Listing only">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 10.5L12 3l9 7.5"></path>
          <path d="M5 9.5V21h14V9.5"></path>
          <path d="M10 21v-6h4v6"></path>
        </svg>
      </span>
    </td>
  </tr>`;
}

function renderTravel(
  surface: ListingPageSurface,
  listingIdValue: string,
): string {
  if (surface.travel.empty) {
    return `
      <h2 class="listing-section__title">Travel Times</h2>
      <p class="muted" id="listing-places-empty">
        None yet —
        <button type="button" class="linkish" data-listing-overlay-open="place">add a place</button>.
      </p>`;
  }

  const rows = [
    ...surface.travel.compareRows.map((row) =>
      renderCompareRow(row, listingIdValue),
    ),
    ...surface.travel.listingPlaces.map((place) =>
      renderListingPlaceRow(place),
    ),
  ].join("");

  return `<div class="matrix-panel">
    <div class="matrix-panel__header">
      <div class="matrix-panel__titles">
        <h2 class="listing-section__title compare-header__title">Travel Times</h2>
        <ul class="matrix-type-legend" aria-label="Place scope">
          <li>
            <span class="matrix-type__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M4 6h16"></path>
                <path d="M4 12h16"></path>
                <path d="M4 18h10"></path>
                <path d="M16 16l2 2 4-4"></path>
              </svg>
            </span>
            On Travel Times
          </li>
          <li>
            <span class="matrix-type__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M3 10.5L12 3l9 7.5"></path>
                <path d="M5 9.5V21h14V9.5"></path>
                <path d="M10 21v-6h4v6"></path>
              </svg>
            </span>
            Listing only
          </li>
        </ul>
      </div>
      <div class="matrix-panel__actions compare-header__actions">
        <button
          type="button"
          class="button icon-btn compare-header__add"
          data-listing-overlay-open="place"
          aria-label="Add place"
          title="Add place"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 5v14"></path>
            <path d="M5 12h14"></path>
          </svg>
        </button>
      </div>
    </div>
    <div class="matrix-scroll">
      <table class="data matrix-table matrix-table--fit" aria-label="Travel Times">
        <tbody id="listing-places-list">${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function renderTourStatus(
  tour: ListingPageSurface["tour"],
  basePath: string,
): string {
  const assignment = tour.assignment;
  if (!assignment) {
    return '<span class="muted">Not on a tour</span>';
  }
  const timeSuffix = assignment.formattedTime
    ? ` · ${escapeHtml(assignment.formattedTime)}`
    : "";
  if (assignment.hiddenOnPlan) {
    return `On tour <span>${escapeHtml(assignment.formattedDate)}${timeSuffix}</span>`;
  }
  return `On tour <a href="${escapeHtml(assignment.toursHref)}">${escapeHtml(assignment.formattedDate)}${timeSuffix}</a>`;
}

function renderTourAssignment(
  tour: ListingPageSurface["tour"],
  basePath: string,
): string {
  const assignment = tour.assignment;
  const config = surfaceConfig();
  const id = listingId();
  const locale = config?.localeId ?? "";
  if (!assignment || !id || !locale) return "";
  const link = assignment.hiddenOnPlan
    ? `<span>${escapeHtml(assignment.formattedDate)} (hidden on Free)</span>`
    : `<a href="${escapeHtml(`${basePath}/tours?day=${assignment.tourDate}`)}">${escapeHtml(assignment.formattedDate)}</a>`;
  return `<div class="stack" data-listing-tour-assignment>
    <p>Currently on ${link}.</p>
    <form method="post" action="/api/tours/unassign" data-listing-tour-unassign>
      <input type="hidden" name="listing_id" value="${escapeHtml(id)}" />
      <input type="hidden" name="tour_day_id" value="${escapeHtml(assignment.tourDayId)}" />
      <input type="hidden" name="locale_id" value="${escapeHtml(locale)}" />
      <button type="submit" class="secondary">Remove from tour</button>
    </form>
  </div>`;
}

function renderTourDayHost(tour: ListingPageSurface["tour"]): string {
  const stops =
    tour.selectedDayStops.length > 0
      ? `<ul class="stack">${tour.selectedDayStops.map((label) => `<li>${escapeHtml(label)}</li>`).join("")}</ul>`
      : '<p class="muted">No stops on this day yet.</p>';
  const blocked = tour.addButton.blockedMessage
    ? `<p class="plan-notice__text muted">${escapeHtml(tour.addButton.blockedMessage)}</p>`
    : "";
  return `<h3 class="listing-tour-day__title">${escapeHtml(formatTourDate(tour.selectedDate))}</h3>
    ${stops}
    <button
      type="button"
      class="button"
      data-listing-tour-add
      ${tour.addButton.disabled ? "disabled" : ""}
      title="${tour.addButton.blockedMessage ? escapeHtml(tour.addButton.blockedMessage) : ""}"
    >${escapeHtml(tour.addButton.label)}</button>
    ${blocked}`;
}

export function applyListingSurface(listing: ListingDisplayInput): void {
  const root = document.querySelector("[data-listing-surface]");
  if (!(root instanceof HTMLElement)) return;

  const config = surfaceConfig();
  const display = buildListingDisplay(listing);
  const visiblePhotos = config
    ? sliceVisiblePhotoUrls(display.photoUrls, config.plan)
    : display.photoUrls;

  const titleEl = root.querySelector("[data-listing-title]");
  if (titleEl) setText(titleEl, display.title);
  document.title = display.title;

  const contactHost = root.querySelector("[data-listing-contact-host]");
  if (contactHost instanceof HTMLElement) {
    contactHost.innerHTML = renderContact(display);
    contactHost.hidden =
      !display.address && !display.sourceUrl && !display.phone;
  }

  const costHost = root.querySelector("[data-listing-cost-host]");
  if (costHost instanceof HTMLElement) {
    costHost.innerHTML = renderCostSummary(display);
    costHost.hidden = !display.monthlyTotal && !display.moveInTotal;
  }

  const factsHost = root.querySelector("[data-listing-facts-host]");
  if (factsHost instanceof HTMLElement) {
    factsHost.innerHTML = renderFactGroups(display.factGroups);
    factsHost.hidden = !display.hasFactSections;
  }

  const emptyHost = root.querySelector("[data-listing-empty-host]");
  if (emptyHost instanceof HTMLElement) {
    emptyHost.hidden =
      display.hasFactSections ||
      display.monthlyTotal != null ||
      display.moveInTotal != null;
  }

  if (visiblePhotos.length > 0) {
    updateListingHeroPhotos(visiblePhotos);
  }
}

export function applyListingPageSurface(surface: ListingPageSurface): void {
  const id = listingId();
  applyListingSurface(surface.listing);

  const tourStatus = document.querySelector("[data-listing-tour-status]");
  if (tourStatus) {
    tourStatus.innerHTML = renderTourStatus(surface.tour, surface.basePath);
  }

  const tourPanel = document.querySelector(
    '[data-listing-overlay="tour"] .compare-column-overlay__panel',
  );
  if (tourPanel instanceof HTMLElement) {
    const existingAssignment = tourPanel.querySelector(
      "[data-listing-tour-assignment]",
    );
    const assignmentHtml = renderTourAssignment(surface.tour, surface.basePath);
    if (assignmentHtml) {
      if (existingAssignment) {
        existingAssignment.outerHTML = assignmentHtml;
      } else {
        const cal = tourPanel.querySelector("[data-listing-tour-calendar]");
        if (cal) cal.insertAdjacentHTML("beforebegin", assignmentHtml);
      }
    } else if (existingAssignment) {
      existingAssignment.remove();
    }
  }

  const tourDayHost = document.querySelector("[data-listing-tour-day-host]");
  if (tourDayHost instanceof HTMLElement) {
    tourDayHost.innerHTML = renderTourDayHost(surface.tour);
  }

  const travelHost = document.querySelector("[data-listing-travel-host]");
  if (travelHost instanceof HTMLElement && id) {
    travelHost.innerHTML = renderTravel(surface, id);
    document.dispatchEvent(
      new CustomEvent("wayhome:listing-travel-hydrate", { bubbles: true }),
    );
  }

  const mapEl = document.getElementById("listing-map");
  if (mapEl instanceof HTMLElement) {
    if (surface.map.lat != null) mapEl.dataset.lat = String(surface.map.lat);
    if (surface.map.lng != null) mapEl.dataset.lng = String(surface.map.lng);
    mapEl.dataset.title = surface.map.title;
    mapEl.dataset.address = surface.map.address ?? "";
    mapEl.dataset.photoUrl = surface.map.photoUrl ?? "";
    mapEl.dataset.places = JSON.stringify(surface.map.places);
    document.dispatchEvent(
      new CustomEvent("wayhome:listing-map-refresh", { bubbles: true }),
    );
  }

  const cfg = window.__WAYHOME_LISTING_TOUR_CAL__;
  if (cfg) {
    cfg.selectedDate = surface.tour.selectedDate;
    cfg.tourCalendar = surface.tour.calendar.tourCalendar;
  }

  document.dispatchEvent(
    new CustomEvent("wayhome:listing-surface-applied", {
      detail: { surface },
      bubbles: true,
    }),
  );
}

export async function refreshListingPageSurface(options?: {
  tourDay?: string;
  closePlaceOverlay?: boolean;
}): Promise<void> {
  const id = listingId();
  if (!id || !document.querySelector("[data-listing-surface]")) return;

  const url = new URL(
    `/api/listings/${encodeURIComponent(id)}/surface`,
    window.location.origin,
  );
  if (options?.tourDay) url.searchParams.set("tourDay", options.tourDay);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok || !data.surface) return;

  applyListingPageSurface(data.surface as ListingPageSurface);

  if (options?.tourDay) {
    const next = new URL(window.location.href);
    next.searchParams.set("tourDay", options.tourDay);
    next.searchParams.delete("openTour");
    window.history.replaceState(
      {},
      "",
      `${next.pathname}${next.search}${next.hash}`,
    );
  }

  if (options?.closePlaceOverlay) {
    window.__WAYHOME_LISTING_OVERLAY__?.close?.();
  }
}

export function bootListingDetailSync(): void {
  window.__WAYHOME_REFRESH_LISTING_SURFACE__ = refreshListingPageSurface;

  document.addEventListener("wayhome:listing-updated", (e) => {
    const listing = (e as CustomEvent<{ listing?: ListingDisplayInput }>).detail
      ?.listing;
    if (!listing || typeof listing !== "object") return;
    applyListingSurface(listing);
    void refreshListingPageSurface();
  });

  document.addEventListener("wayhome:listing-refresh-surface", (e) => {
    const detail = (
      e as CustomEvent<{ tourDay?: string; closePlaceOverlay?: boolean }>
    ).detail;
    void refreshListingPageSurface(detail);
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("astro:page-load", bootListingDetailSync);
  bootListingDetailSync();
}
