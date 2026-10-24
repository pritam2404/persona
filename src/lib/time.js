// Chhote time helpers. Sab pure functions hain (koi side effect nahi) -> test karna aasaan.

/** "09:30" -> 570 (din shuru hone se minutes). Galat input pe null. */
export function toMin(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

/** 570 -> "09:30" */
export function fromMin(total) {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Task kitne minute chala. Raat 12 ke paar gaya (23:00 -> 01:00) to bhi sahi. */
export function durationMin(start, end) {
  const s = toMin(start);
  const e = toMin(end);
  if (s === null || e === null) return 0;
  return e >= s ? e - s : e + 1440 - s;
}

/** Date object -> "2026-10-23" (local time, UTC nahi - warna IST mein din badal jaata hai) */
export function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "2026-10-23" + n din */
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return isoDate(dt);
}

export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function fmtDuration(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
