// The app's own photo library: CC0 photos from Wikimedia Commons shipped in public/photos
// (built by tools/fetch_photos.py). Nothing is fetched from the internet.
let cache = null;

/** { categories: [{key, th}], items: [{id, cat, title, author, licence, page, w, h}] } (empty when missing). */
export function loadPhotos() {
  if (!cache) {
    cache = fetch(new URL('photos/manifest.json', document.baseURI))
      .then((r) => (r.ok ? r.json() : { categories: [], items: [] }))
      .catch(() => ({ categories: [], items: [] }));
  }
  return cache;
}

export const photoThumb = (id) => new URL(`photos/thumbs/${id}.webp`, document.baseURI).href;
export const photoURL = (id) => new URL(`photos/${id}.webp`, document.baseURI).href;

/** The full-size photo as a data URL, so a design keeps working even if the library changes. */
export async function photoDataURL(id) {
  const res = await fetch(photoURL(id));
  if (!res.ok) throw new Error('photo ' + id + ' ' + res.status);
  const blob = await res.blob();
  return new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(blob); });
}
