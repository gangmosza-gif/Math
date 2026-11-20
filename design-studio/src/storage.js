// Local persistence in the browser (IndexedDB). Falls back to memory if unavailable.
const DB_NAME = 'lai-studio';
const DB_VERSION = 1;
const STORES = ['designs', 'uploads'];

let dbPromise = null;
const memory = { designs: new Map(), uploads: new Map() };

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        for (const s of STORES) {
          if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function op(store, kind, arg) {
  const db = await openDB();
  if (!db) {
    const m = memory[store];
    if (kind === 'getAll') return [...m.values()];
    if (kind === 'get') return m.get(arg);
    if (kind === 'put') return void m.set(arg.id, arg);
    if (kind === 'delete') return void m.delete(arg);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, kind === 'get' || kind === 'getAll' ? 'readonly' : 'readwrite');
    const s = tx.objectStore(store);
    const req = kind === 'getAll' ? s.getAll() : s[kind](arg);
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const getAll = (store) => op(store, 'getAll');
const get = (store, id) => op(store, 'get', id);
const put = (store, v) => op(store, 'put', v);
const del = (store, id) => op(store, 'delete', id);

export const listDesigns = async () => ((await getAll('designs')) || []).sort((a, b) => b.updatedAt - a.updatedAt);
export const getDesign = (id) => get('designs', id);
export const saveDesign = (d) => put('designs', d);
export const deleteDesign = (id) => del('designs', id);

export const listUploads = async () => ((await getAll('uploads')) || []).sort((a, b) => b.createdAt - a.createdAt);
export const saveUpload = (u) => put('uploads', u);
export const deleteUpload = (id) => del('uploads', id);

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
