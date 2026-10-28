// App lock: tasks PIN se ENCRYPT hote hain (sirf screen lock nahi).
//
// - PIN -> PBKDF2 (SHA-256, 210k rounds, random salt) -> AES-GCM 256-bit key
// - Tasks localStorage mein sirf encrypted rehte hain; plain copy delete ho jaati hai
// - Galat PIN = decrypt fail (AES-GCM authentication) -> alag "check" value store nahi karni padti
// - PIN kahin save NAHI hota. Bhool gaye = data wapas nahi (Backup rakho)
// Videos (IndexedDB) encrypt nahi hote - lock screen ke peeche chhupe rehte hain.

const LOCK_META = 'persona.lock.v1';
const ENC_TASKS = 'persona.tasks.enc.v1';
const PLAIN_TASKS = 'persona.tasks.v1';
const FAILS = 'persona.lock.fails';
const ITER = 210000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes) {
  let s = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) s += String.fromCharCode(arr[i]);
  return btoa(s);
}
function unb64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

export function validPin(pin) {
  return /^\d{4,6}$/.test(String(pin || ''));
}

export async function deriveKey(pin, salt, iterations = ITER) {
  const base = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // key kabhi export nahi ho sakti
    ['encrypt', 'decrypt']
  );
}

export async function encryptJSON(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptJSON(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
  return JSON.parse(dec.decode(pt));
}

// ---------------- localStorage wale kaam ----------------

export function isLockEnabled(store = localStorage) {
  return Boolean(store.getItem(LOCK_META) && store.getItem(ENC_TASKS));
}

/** Lock chalu: tasks encrypt karo, plain copy hatao. Key wapas (session ke liye memory mein). */
export async function enableLock(pin, tasks, store = localStorage) {
  if (!validPin(pin)) throw new Error('PIN 4-6 numbers ka hona chahiye');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(pin, salt);
  store.setItem(ENC_TASKS, JSON.stringify(await encryptJSON(key, tasks)));
  store.setItem(LOCK_META, JSON.stringify({ v: 1, salt: b64(salt), iter: ITER }));
  store.removeItem(PLAIN_TASKS);
  store.removeItem(FAILS);
  return key;
}

/** Galat PIN pe error. Bahut galat try -> thoda rukna padta hai. */
export async function unlock(pin, store = localStorage, now = Date.now()) {
  const wait = lockoutSeconds(store, now);
  if (wait > 0) {
    const e = new Error('wait');
    e.wait = wait;
    throw e;
  }
  const meta = JSON.parse(store.getItem(LOCK_META) || 'null');
  const blob = JSON.parse(store.getItem(ENC_TASKS) || 'null');
  if (!meta || !blob) throw new Error('Lock data nahi mila');
  const key = await deriveKey(pin, unb64(meta.salt), meta.iter);
  try {
    const tasks = await decryptJSON(key, blob);
    store.removeItem(FAILS);
    return { key, tasks: Array.isArray(tasks) ? tasks : [] };
  } catch {
    recordFail(store, now);
    const e = new Error('wrong');
    e.wrong = true;
    e.wait = lockoutSeconds(store, now);
    throw e;
  }
}

/** Unlocked hone ke baad har change pe */
export async function saveEncrypted(key, tasks, store = localStorage) {
  store.setItem(ENC_TASKS, JSON.stringify(await encryptJSON(key, tasks)));
}

/** Lock band: plain mein wapas likho, encrypted hatao */
export function disableLock(tasks, store = localStorage) {
  store.setItem(PLAIN_TASKS, JSON.stringify(tasks));
  store.removeItem(ENC_TASKS);
  store.removeItem(LOCK_META);
  store.removeItem(FAILS);
}

/** 5 galat try ke baad 30 sec, phir har galat pe double (max 1 ghanta) */
function recordFail(store, now) {
  const f = JSON.parse(store.getItem(FAILS) || '{"n":0,"until":0}');
  f.n += 1;
  if (f.n >= 5) f.until = now + Math.min(3600, 30 * 2 ** (f.n - 5)) * 1000;
  store.setItem(FAILS, JSON.stringify(f));
}

export function lockoutSeconds(store = localStorage, now = Date.now()) {
  const f = JSON.parse(store.getItem(FAILS) || '{"n":0,"until":0}');
  return f.until > now ? Math.ceil((f.until - now) / 1000) : 0;
}

/** PIN bhool gaye: is device ka saara Persona data delete (tasks, settings, videos, chat key) */
export async function resetEverything(store = localStorage) {
  const keys = [];
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (k && k.startsWith('persona.')) keys.push(k);
  }
  keys.forEach((k) => store.removeItem(k));
  try { sessionStorage.clear(); } catch { /* node */ }
  if (typeof indexedDB !== 'undefined') {
    await new Promise((res) => {
      const r = indexedDB.deleteDatabase('persona-videos');
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
  }
}
