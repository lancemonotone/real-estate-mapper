/** Shared Maps JS bootstrap (loading=async per Google best practice). */

let loadPromise = null;

export function loadGoogleMapsJs(key) {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => resolve(undefined);
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Maps JS'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
