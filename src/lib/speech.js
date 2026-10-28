// Bolne ke liye text ko saaf karta hai (captions mein original text hi rehta hai).
// TTS "07:00" ko "zero saat colon zero zero" jaisa padh sakta hai -> "subah 7 baje" bana do.
// Pure functions -> Node mein test hote hain.

function partOfDayHi(h) {
  if (h < 4) return 'रात';
  if (h < 12) return 'सुबह';
  if (h < 16) return 'दोपहर';
  if (h < 20) return 'शाम';
  return 'रात';
}

function to12(h) {
  const x = h % 12;
  return x === 0 ? 12 : x;
}

/** "07:00 बजे" -> "सुबह 7 बजे", "21:30 बजे" -> "रात 9 बजकर 30 मिनट" */
function hiTime(h, m) {
  const base = `${partOfDayHi(h)} ${to12(h)}`;
  if (m === 0) return `${base} बजे`;
  if (m === 30) return `${partOfDayHi(h)} साढ़े ${to12(h)} बजे`;
  return `${base} बजकर ${m} मिनट`;
}

/** "07:00" -> "7 AM", "21:30" -> "9:30 PM" */
function enTime(h, m) {
  const ap = h < 12 ? 'AM' : 'PM';
  return m === 0 ? `${to12(h)} ${ap}` : `${to12(h)}:${String(m).padStart(2, '0')} ${ap}`;
}

export function forSpeech(text, lang = 'hi') {
  let s = String(text);
  if (lang === 'hi') {
    // "07:00 बजे" / "09:00 से 14:00 तक" -> bolne layak
    s = s.replace(/\b(\d{1,2}):(\d{2})(\s*बजे)?/g, (_, h, m) => hiTime(Number(h), Number(m)));
    s = s.replace(/बजे\s+बजे/g, 'बजे');
    s = s.replace(/(\d+)\s*%/g, '$1 प्रतिशत');
  } else if (lang === 'en') {
    s = s.replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => enTime(Number(h), Number(m)));
    s = s.replace(/(\d+)\s*%/g, '$1 percent');
  } else {
    // bn / te / ml: "07:00" -> "7", "21:30" -> "21 30" (awaaz number apni bhasha mein padhti hai)
    s = s.replace(/(\d{1,2}):(\d{2})/g, (_, h, m) => (Number(m) === 0 ? `${Number(h)}` : `${Number(h)} ${Number(m)}`));
    s = s.replace(/(\d+)\s*%/g, '$1');
  }
  // Quotes awaaz mein ajeeb pause dete hain
  return s.replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
}
