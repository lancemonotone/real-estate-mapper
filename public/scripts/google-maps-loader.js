/** Shared Maps JS bootstrap (loading=async per Google best practice). */

let loadPromise = null;

function mapsApi() {
  return window.google?.maps;
}

function importLibraryReady() {
  return typeof mapsApi()?.importLibrary === 'function';
}

function waitForImportLibrary(timeoutMs = 15000) {
  if (importLibraryReady()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (importLibraryReady()) {
        resolve();
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error('Google Maps importLibrary not available'));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export function loadGoogleMapsJs(key) {
  if (importLibraryReady()) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => {
      waitForImportLibrary()
        .then(resolve)
        .catch((err) => {
          loadPromise = null;
          reject(err);
        });
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Maps JS'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/** @returns {typeof google.maps} */
export function requireMapsApi() {
  const maps = mapsApi();
  if (!maps || typeof maps.importLibrary !== 'function') {
    throw new Error('Google Maps not loaded');
  }
  return maps;
}
