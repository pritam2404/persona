// Videos phone ke andar IndexedDB mein save hote hain (localStorage video ke liye bahut chhota hai).
// Kahin upload nahi hota. App uninstall / browser data clear = videos bhi jayenge,
// isliye "Save to phone" se gallery/Downloads mein copy rakhna achha hai.

const DB = 'persona-videos';
const STORE = 'videos';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(result?.result ?? result); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error || new Error('Storage bhar gaya ho sakta hai')); };
  }));
}

/** @param {File} file */
export function addVideo(file) {
  const rec = {
    id: `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name || 'video.mp4',
    type: file.type || 'video/mp4',
    size: file.size,
    addedAt: new Date().toISOString(),
    blob: file,
  };
  return tx('readwrite', (s) => s.put(rec)).then(() => rec);
}

export function listVideos() {
  return tx('readonly', (s) => s.getAll()).then((list) =>
    (list || []).sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  );
}

export function deleteVideo(id) {
  return tx('readwrite', (s) => s.delete(id));
}

/** Phone kitni jagah de raha hai (MB). Har browser support nahi karta -> null. */
export async function storageInfo() {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usedMB: usage / 1e6, quotaMB: quota / 1e6 };
}
