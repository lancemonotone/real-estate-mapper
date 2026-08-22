/**
 * Shared place search typeahead.
 * mountPlaceSearch(rootEl, { localeId, onResolved })
 */
export function mountPlaceSearch(rootEl, options) {
  const input = rootEl.querySelector('[data-place-search-input]');
  const list = rootEl.querySelector('[data-place-search-results]');
  const errorEl = rootEl.querySelector('[data-place-search-error]');
  if (!(input instanceof HTMLInputElement) || !list) {
    throw new Error('place-search root missing input or results');
  }

  let sessionToken = crypto.randomUUID();
  let debounceTimer = null;
  let resolved = null;

  function setError(message) {
    if (errorEl instanceof HTMLElement) {
      errorEl.textContent = message || '';
      errorEl.hidden = !message;
    }
  }

  function clearResults() {
    list.replaceChildren();
    list.hidden = true;
  }

  input.addEventListener('focus', () => {
    sessionToken = crypto.randomUUID();
  });

  input.addEventListener('input', () => {
    resolved = null;
    setError('');
    const q = input.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (q.length < 2) {
      clearResults();
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch('/api/places/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: q,
            locale_id: options.localeId,
            session_token: sessionToken,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Search failed');
          clearResults();
          return;
        }
        list.replaceChildren();
        const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        if (suggestions.length === 0) {
          clearResults();
          setError('No places found');
          return;
        }
        list.hidden = false;
        for (const s of suggestions) {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'place-search__option secondary';
          const primary = document.createElement('strong');
          primary.textContent = s.primaryText || 'Place';
          btn.appendChild(primary);
          if (s.secondaryText) {
            const secondary = document.createElement('span');
            secondary.className = 'place-search__secondary muted';
            secondary.textContent = s.secondaryText;
            btn.appendChild(secondary);
          }
          btn.addEventListener('click', async () => {
            setError('');
            clearResults();
            input.value = s.primaryText || '';
            try {
              const detailRes = await fetch('/api/places/details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  place_id: s.placeId,
                  session_token: sessionToken,
                }),
              });
              const detailData = await detailRes.json();
              if (!detailRes.ok || !detailData.place) {
                setError(detailData.error || 'Could not resolve place');
                resolved = null;
                return;
              }
              resolved = {
                placeId: detailData.place.placeId,
                name: detailData.place.name,
                lat: detailData.place.lat,
                lng: detailData.place.lng,
              };
              options.onResolved?.(resolved);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Resolve failed');
              resolved = null;
            }
          });
          li.appendChild(btn);
          list.appendChild(li);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
        clearResults();
      }
    }, 250);
  });

  return {
    getResolved() {
      return resolved;
    },
    clear() {
      resolved = null;
      input.value = '';
      clearResults();
      setError('');
    },
  };
}
