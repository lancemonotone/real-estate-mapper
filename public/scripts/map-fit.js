/**
 * Fit a map so pins sit in the lower portion of the viewport,
 * leaving room above for InfoWindow tooltips.
 *
 * Lowest pin ≈ 10% from the bottom; generous top padding for hover cards.
 */
export function fitMapForPinTooltips(map, bounds) {
  if (!bounds || bounds.isEmpty()) return;

  const div = map.getDiv?.() ?? null;
  const h = Math.max(div?.clientHeight || 0, 240);
  const w = Math.max(div?.clientWidth || 0, 240);
  const padTop = Math.round(h * 0.5);
  const padBottom = Math.round(h * 0.1);
  const padX = Math.round(Math.min(48, w * 0.08));

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const samePoint = ne.lat() === sw.lat() && ne.lng() === sw.lng();

  if (samePoint) {
    map.setCenter(ne);
    map.setZoom(14);
    // Move pin from vertical center (~50%) toward ~90% (10% from bottom).
    map.panBy(0, Math.round(h * 0.4));
    return;
  }

  map.fitBounds(bounds, {
    top: padTop,
    right: padX,
    bottom: padBottom,
    left: padX,
  });
}
