// Coach video ki script banata hai: "aaj kaisa gaya" + "kal kaise better".
//
// PRIVACY RULE: script ek AI video service ko ja sakti hai (photo + awaaz banane ke liye).
// Isliye office task / private task ka NAAM kabhi script mein nahi jaata - sirf
// "office kaam" aur total time. Ye rule yahan code mein hai, user ki yaad pe nahi.
//
// Output format = Shorts Studio wala: line 1 = title, har agli line = ek "beat".

import { summarize, tasksOn, insights } from './analyze.js';

const T = {
  hi: {
    title: (name) => (name ? `${name}, आपका कल का प्लान` : 'आपका कल का प्लान'),
    hello: (name) => (name ? `नमस्ते ${name}। आज का छोटा सा रिव्यू।` : 'नमस्ते। आज का छोटा सा रिव्यू।'),
    noData: 'आज कोई टास्क नोट नहीं हुआ। कल से हर काम लिखना शुरू करें।',
    today: (n, done, total) =>
      `आज आपने ${n} काम नोट ${n === 1 ? 'किया' : 'किए'}, ${done} ${done === 1 ? 'पूरा हुआ' : 'पूरे हुए'}, कुल ${total}।`,
    office: (d) => `ऑफिस के काम में ${d} लगे।`,
    officeLabel: 'एक ऑफिस का काम',
    privateLabel: 'एक निजी काम',
    planIntro: (n) => `कल के लिए ${n} काम प्लान किए हैं।`,
    planItem: (time, label) => `${time} बजे, ${label}।`,
    officeBlock: (from, to) => `${from} से ${to} तक ऑफिस का काम।`,
    focus: 'मुश्किल काम आपके सबसे ज़्यादा एनर्जी वाले समय में रखे हैं।',
    bye: 'बस इतना ही। कल थोड़ा बेहतर, बस यही लक्ष्य है।',
    ins: {
      energy: (d) => `आपकी एनर्जी ${d.hours.map((h) => `${h} बजे`).join(' और ')} के आसपास सबसे ज़्यादा रहती है।`,
      focus: (d) => `फोकस वाले ${d.focus} में से ${d.low} काम कम एनर्जी में हुए।`,
      estimate: (d) => (d.over
        ? `काम आमतौर पर अंदाज़े से ${d.pct} प्रतिशत ज़्यादा समय लेता है, इसलिए थोड़ा बफर रखें।`
        : `काम आमतौर पर अंदाज़े से ${d.pct} प्रतिशत जल्दी खत्म होता है।`),
      skip: (d, label) => `${label} ${d.count} बार छूटा। इसे छोटा करें या दिन में पहले रखें।`,
      health: (d) => `${d.days} दिन में कोई वॉक या एक्सरसाइज़ नहीं हुई। बीस मिनट की वॉक से शुरू करें।`,
    },
  },
  en: {
    title: (name) => (name ? `${name}, your plan for tomorrow` : 'Your plan for tomorrow'),
    hello: (name) => (name ? `Hi ${name}. Here is a quick review of today.` : 'Hi. Here is a quick review of today.'),
    noData: 'No tasks were logged today. Start noting each task from tomorrow.',
    today: (n, done, total) => `Today you logged ${n} task${n === 1 ? '' : 's'}, finished ${done}, ${total} in total.`,
    office: (d) => `Office work took ${d}.`,
    officeLabel: 'an office task',
    privateLabel: 'a private task',
    planIntro: (n) => `I have planned ${n} tasks for tomorrow.`,
    planItem: (time, label) => `At ${time}, ${label}.`,
    officeBlock: (from, to) => `From ${from} to ${to}, office work.`,
    focus: 'Hard tasks are placed in your highest-energy hours.',
    bye: 'That is it. Just aim to be a little better tomorrow.',
    ins: {
      energy: (d) => `Your energy peaks around ${d.hours.map((h) => `${h} o'clock`).join(' and ')}.`,
      focus: (d) => `${d.low} of your ${d.focus} focus tasks happened at low energy.`,
      estimate: (d) => (d.over
        ? `Tasks usually take ${d.pct} percent longer than you estimate, so keep a buffer.`
        : `Tasks usually finish ${d.pct} percent faster than you estimate.`),
      skip: (d, label) => `${label} was skipped ${d.count} times. Make it smaller or do it earlier.`,
      health: (d) => `No walk or exercise in ${d.days} days. Start with a twenty minute walk.`,
    },
  },
};

// Baaki 6 bhashayein. NOTE: native speaker se review karwana (machine-quality translation).
// `time` jaise "07:00" aata hai; awaaz ke liye speech.js use saaf karta hai.
const mk = (L) => ({
  title: (name) => (name ? `${name}, ${L.planOf}` : L.planOfCap),
  hello: (name) => (name ? `${L.hi} ${name}${L.stop} ${L.review}` : `${L.hi}${L.stop} ${L.review}`),
  noData: L.noData,
  today: L.today,
  office: L.office,
  officeLabel: L.officeLabel,
  privateLabel: L.privateLabel,
  planIntro: L.planIntro,
  planItem: L.planItem,
  officeBlock: L.officeBlock,
  focus: L.focus,
  bye: L.bye,
  ins: L.ins,
});

T.bn = mk({
  planOf: 'আপনার আগামীকালের পরিকল্পনা', planOfCap: 'আপনার আগামীকালের পরিকল্পনা',
  hi: 'নমস্কার', review: 'আজকের একটা ছোট্ট রিভিউ।', stop: '।',
  noData: 'আজ কোনো কাজ লেখা হয়নি। কাল থেকে প্রতিটা কাজ লিখতে শুরু করুন।',
  today: (n, d, total) => `আজ আপনি ${n}টি কাজ লিখেছেন, ${d}টি শেষ হয়েছে, মোট ${total}।`,
  office: (d) => `অফিসের কাজে ${d} গেছে।`,
  officeLabel: 'একটি অফিসের কাজ', privateLabel: 'একটি ব্যক্তিগত কাজ',
  planIntro: (n) => `আগামীকালের জন্য ${n}টি কাজের পরিকল্পনা করা হয়েছে।`,
  planItem: (time, label) => `${time}-এ, ${label}।`,
  officeBlock: (f, to) => `${f} থেকে ${to} পর্যন্ত অফিসের কাজ।`,
  focus: 'কঠিন কাজগুলো আপনার সবচেয়ে বেশি এনার্জির সময়ে রাখা হয়েছে।',
  bye: 'আজ এই পর্যন্ত। কাল একটু ভালো, এটাই লক্ষ্য।',
  ins: {
    energy: (d) => `আপনার এনার্জি ${d.hours.map((h) => `${h}টা`).join(' আর ')}-র দিকে সবচেয়ে বেশি থাকে।`,
    focus: (d) => `ফোকাসের ${d.focus}টি কাজের মধ্যে ${d.low}টি কম এনার্জিতে হয়েছে।`,
    estimate: (d) => (d.over
      ? `কাজ সাধারণত আন্দাজের চেয়ে ${d.pct} শতাংশ বেশি সময় নেয়, তাই একটু সময় হাতে রাখুন।`
      : `কাজ সাধারণত আন্দাজের চেয়ে ${d.pct} শতাংশ তাড়াতাড়ি শেষ হয়।`),
    skip: (d, label) => `${label} ${d.count} বার বাদ গেছে। এটাকে ছোট করুন বা দিনের শুরুতে রাখুন।`,
    health: (d) => `${d.days} দিনে কোনো হাঁটা বা ব্যায়াম হয়নি। কুড়ি মিনিট হাঁটা দিয়ে শুরু করুন।`,
  },
});

T.pa = mk({
  planOf: 'ਤੁਹਾਡੀ ਕੱਲ੍ਹ ਦੀ ਯੋਜਨਾ', planOfCap: 'ਤੁਹਾਡੀ ਕੱਲ੍ਹ ਦੀ ਯੋਜਨਾ',
  hi: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', review: 'ਅੱਜ ਦਾ ਛੋਟਾ ਜਿਹਾ ਰਿਵਿਊ।', stop: '।',
  noData: 'ਅੱਜ ਕੋਈ ਕੰਮ ਨਹੀਂ ਲਿਖਿਆ ਗਿਆ। ਕੱਲ੍ਹ ਤੋਂ ਹਰ ਕੰਮ ਲਿਖਣਾ ਸ਼ੁਰੂ ਕਰੋ।',
  today: (n, d, total) => `ਅੱਜ ਤੁਸੀਂ ${n} ਕੰਮ ਲਿਖੇ, ${d} ਪੂਰੇ ਹੋਏ, ਕੁੱਲ ${total}।`,
  office: (d) => `ਦਫ਼ਤਰ ਦੇ ਕੰਮ ਵਿੱਚ ${d} ਲੱਗੇ।`,
  officeLabel: 'ਇੱਕ ਦਫ਼ਤਰ ਦਾ ਕੰਮ', privateLabel: 'ਇੱਕ ਨਿੱਜੀ ਕੰਮ',
  planIntro: (n) => `ਕੱਲ੍ਹ ਲਈ ${n} ਕੰਮ ਯੋਜਨਾ ਵਿੱਚ ਰੱਖੇ ਹਨ।`,
  planItem: (time, label) => `${time} ਵਜੇ, ${label}।`,
  officeBlock: (f, to) => `${f} ਤੋਂ ${to} ਤੱਕ ਦਫ਼ਤਰ ਦਾ ਕੰਮ।`,
  focus: 'ਔਖੇ ਕੰਮ ਤੁਹਾਡੀ ਸਭ ਤੋਂ ਵੱਧ ਊਰਜਾ ਵਾਲੇ ਸਮੇਂ ਵਿੱਚ ਰੱਖੇ ਹਨ।',
  bye: 'ਬੱਸ ਇੰਨਾ ਹੀ। ਕੱਲ੍ਹ ਥੋੜ੍ਹਾ ਬਿਹਤਰ, ਇਹੀ ਟੀਚਾ ਹੈ।',
  ins: {
    energy: (d) => `ਤੁਹਾਡੀ ਊਰਜਾ ${d.hours.map((h) => `${h} ਵਜੇ`).join(' ਅਤੇ ')} ਦੇ ਆਸ-ਪਾਸ ਸਭ ਤੋਂ ਵੱਧ ਹੁੰਦੀ ਹੈ।`,
    focus: (d) => `ਫੋਕਸ ਵਾਲੇ ${d.focus} ਕੰਮਾਂ ਵਿੱਚੋਂ ${d.low} ਘੱਟ ਊਰਜਾ ਵਿੱਚ ਹੋਏ।`,
    estimate: (d) => (d.over
      ? `ਕੰਮ ਆਮ ਤੌਰ 'ਤੇ ਅੰਦਾਜ਼ੇ ਨਾਲੋਂ ${d.pct} ਪ੍ਰਤੀਸ਼ਤ ਵੱਧ ਸਮਾਂ ਲੈਂਦਾ ਹੈ।`
      : `ਕੰਮ ਆਮ ਤੌਰ 'ਤੇ ਅੰਦਾਜ਼ੇ ਨਾਲੋਂ ${d.pct} ਪ੍ਰਤੀਸ਼ਤ ਜਲਦੀ ਖਤਮ ਹੁੰਦਾ ਹੈ।`),
    skip: (d, label) => `${label} ${d.count} ਵਾਰ ਛੁੱਟ ਗਿਆ। ਇਸਨੂੰ ਛੋਟਾ ਕਰੋ ਜਾਂ ਦਿਨ ਵਿੱਚ ਪਹਿਲਾਂ ਰੱਖੋ।`,
    health: (d) => `${d.days} ਦਿਨਾਂ ਵਿੱਚ ਕੋਈ ਸੈਰ ਜਾਂ ਕਸਰਤ ਨਹੀਂ ਹੋਈ। ਵੀਹ ਮਿੰਟ ਦੀ ਸੈਰ ਨਾਲ ਸ਼ੁਰੂ ਕਰੋ।`,
  },
});

T.kn = mk({
  planOf: 'ನಿಮ್ಮ ನಾಳೆಯ ಯೋಜನೆ', planOfCap: 'ನಿಮ್ಮ ನಾಳೆಯ ಯೋಜನೆ',
  hi: 'ನಮಸ್ಕಾರ', review: 'ಇಂದಿನ ಒಂದು ಸಣ್ಣ ವಿಮರ್ಶೆ.', stop: '.',
  noData: 'ಇಂದು ಯಾವುದೇ ಕೆಲಸ ದಾಖಲಾಗಿಲ್ಲ. ನಾಳೆಯಿಂದ ಪ್ರತಿ ಕೆಲಸವನ್ನು ಬರೆಯಲು ಶುರು ಮಾಡಿ.',
  today: (n, d, total) => `ಇಂದು ನೀವು ${n} ಕೆಲಸಗಳನ್ನು ಬರೆದಿದ್ದೀರಿ, ${d} ಪೂರ್ಣಗೊಂಡಿವೆ, ಒಟ್ಟು ${total}.`,
  office: (d) => `ಕಚೇರಿ ಕೆಲಸಕ್ಕೆ ${d} ಹಿಡಿಯಿತು.`,
  officeLabel: 'ಒಂದು ಕಚೇರಿ ಕೆಲಸ', privateLabel: 'ಒಂದು ವೈಯಕ್ತಿಕ ಕೆಲಸ',
  planIntro: (n) => `ನಾಳೆಗೆ ${n} ಕೆಲಸಗಳನ್ನು ಯೋಜಿಸಲಾಗಿದೆ.`,
  planItem: (time, label) => `${time}ಕ್ಕೆ, ${label}.`,
  officeBlock: (f, to) => `${f} ರಿಂದ ${to} ರವರೆಗೆ ಕಚೇರಿ ಕೆಲಸ.`,
  focus: 'ಕಷ್ಟದ ಕೆಲಸಗಳನ್ನು ನಿಮ್ಮ ಅತಿ ಹೆಚ್ಚು ಶಕ್ತಿಯ ಸಮಯದಲ್ಲಿ ಇಡಲಾಗಿದೆ.',
  bye: 'ಇಷ್ಟೇ. ನಾಳೆ ಸ್ವಲ್ಪ ಉತ್ತಮ, ಅದೇ ಗುರಿ.',
  ins: {
    energy: (d) => `ನಿಮ್ಮ ಶಕ್ತಿ ${d.hours.map((h) => `${h} ಗಂಟೆ`).join(' ಮತ್ತು ')} ಸುಮಾರಿಗೆ ಅತಿ ಹೆಚ್ಚು ಇರುತ್ತದೆ.`,
    focus: (d) => `ಗಮನದ ${d.focus} ಕೆಲಸಗಳಲ್ಲಿ ${d.low} ಕಡಿಮೆ ಶಕ್ತಿಯಲ್ಲಿ ನಡೆದವು.`,
    estimate: (d) => (d.over
      ? `ಕೆಲಸ ಸಾಮಾನ್ಯವಾಗಿ ಅಂದಾಜಿಗಿಂತ ${d.pct} ಶೇಕಡಾ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತದೆ.`
      : `ಕೆಲಸ ಸಾಮಾನ್ಯವಾಗಿ ಅಂದಾಜಿಗಿಂತ ${d.pct} ಶೇಕಡಾ ಬೇಗ ಮುಗಿಯುತ್ತದೆ.`),
    skip: (d, label) => `${label} ${d.count} ಬಾರಿ ಬಿಟ್ಟುಹೋಯಿತು. ಅದನ್ನು ಚಿಕ್ಕದಾಗಿಸಿ ಅಥವಾ ದಿನದ ಆರಂಭದಲ್ಲಿ ಇಡಿ.`,
    health: (d) => `${d.days} ದಿನಗಳಲ್ಲಿ ಯಾವುದೇ ನಡಿಗೆ ಅಥವಾ ವ್ಯಾಯಾಮ ಇಲ್ಲ. ಇಪ್ಪತ್ತು ನಿಮಿಷದ ನಡಿಗೆಯಿಂದ ಶುರು ಮಾಡಿ.`,
  },
});

T.ta = mk({
  planOf: 'உங்கள் நாளைய திட்டம்', planOfCap: 'உங்கள் நாளைய திட்டம்',
  hi: 'வணக்கம்', review: 'இன்றைய ஒரு சிறு மதிப்பாய்வு.', stop: '.',
  noData: 'இன்று எந்த வேலையும் பதிவு செய்யப்படவில்லை. நாளை முதல் ஒவ்வொரு வேலையையும் எழுதத் தொடங்குங்கள்.',
  today: (n, d, total) => `இன்று நீங்கள் ${n} வேலைகளைப் பதிவு செய்தீர்கள், ${d} முடிந்தன, மொத்தம் ${total}.`,
  office: (d) => `அலுவலக வேலைக்கு ${d} ஆனது.`,
  officeLabel: 'ஒரு அலுவலக வேலை', privateLabel: 'ஒரு தனிப்பட்ட வேலை',
  planIntro: (n) => `நாளைக்கு ${n} வேலைகள் திட்டமிடப்பட்டுள்ளன.`,
  planItem: (time, label) => `${time} மணிக்கு, ${label}.`,
  officeBlock: (f, to) => `${f} முதல் ${to} வரை அலுவலக வேலை.`,
  focus: 'கடினமான வேலைகள் உங்கள் அதிக ஆற்றல் நேரத்தில் வைக்கப்பட்டுள்ளன.',
  bye: 'இவ்வளவுதான். நாளை கொஞ்சம் சிறப்பாக, அதுதான் இலக்கு.',
  ins: {
    energy: (d) => `உங்கள் ஆற்றல் ${d.hours.map((h) => `${h} மணி`).join(' மற்றும் ')} அளவில் அதிகமாக இருக்கும்.`,
    focus: (d) => `கவனம் தேவைப்படும் ${d.focus} வேலைகளில் ${d.low} குறைந்த ஆற்றலில் நடந்தன.`,
    estimate: (d) => (d.over
      ? `வேலை பொதுவாக மதிப்பீட்டை விட ${d.pct} சதவீதம் அதிக நேரம் எடுக்கிறது.`
      : `வேலை பொதுவாக மதிப்பீட்டை விட ${d.pct} சதவீதம் சீக்கிரம் முடிகிறது.`),
    skip: (d, label) => `${label} ${d.count} முறை தவறியது. அதைச் சிறியதாக்குங்கள் அல்லது நாளின் தொடக்கத்தில் வையுங்கள்.`,
    health: (d) => `${d.days} நாட்களில் நடை அல்லது உடற்பயிற்சி இல்லை. இருபது நிமிட நடையுடன் தொடங்குங்கள்.`,
  },
});

T.te = mk({
  planOf: 'మీ రేపటి ప్రణాళిక', planOfCap: 'మీ రేపటి ప్రణాళిక',
  hi: 'నమస్కారం', review: 'ఈరోజు ఒక చిన్న సమీక్ష.', stop: '.',
  noData: 'ఈరోజు ఏ పనీ నమోదు కాలేదు. రేపటి నుండి ప్రతి పనిని రాయడం మొదలుపెట్టండి.',
  today: (n, d, total) => `ఈరోజు మీరు ${n} పనులు నమోదు చేశారు, ${d} పూర్తయ్యాయి, మొత్తం ${total}.`,
  office: (d) => `ఆఫీసు పనికి ${d} పట్టింది.`,
  officeLabel: 'ఒక ఆఫీసు పని', privateLabel: 'ఒక వ్యక్తిగత పని',
  planIntro: (n) => `రేపటి కోసం ${n} పనులు ప్లాన్ చేశాం.`,
  planItem: (time, label) => `${time}కి, ${label}.`,
  officeBlock: (f, to) => `${f} నుండి ${to} వరకు ఆఫీసు పని.`,
  focus: 'కష్టమైన పనులు మీ అత్యధిక శక్తి సమయంలో పెట్టాం.',
  bye: 'ఇంతే. రేపు కొంచెం మెరుగ్గా, అదే లక్ష్యం.',
  ins: {
    energy: (d) => `మీ శక్తి ${d.hours.map((h) => `${h} గంటలకు`).join(' మరియు ')} దగ్గర ఎక్కువగా ఉంటుంది.`,
    focus: (d) => `ఫోకస్ అవసరమైన ${d.focus} పనుల్లో ${d.low} తక్కువ శక్తిలో జరిగాయి.`,
    estimate: (d) => (d.over
      ? `పని సాధారణంగా అంచనా కంటే ${d.pct} శాతం ఎక్కువ సమయం తీసుకుంటుంది.`
      : `పని సాధారణంగా అంచనా కంటే ${d.pct} శాతం త్వరగా పూర్తవుతుంది.`),
    skip: (d, label) => `${label} ${d.count} సార్లు దాటవేయబడింది. దాన్ని చిన్నదిగా చేయండి లేదా రోజు ప్రారంభంలో పెట్టండి.`,
    health: (d) => `${d.days} రోజుల్లో నడక లేదా వ్యాయామం లేదు. ఇరవై నిమిషాల నడకతో మొదలుపెట్టండి.`,
  },
});

T.ml = mk({
  planOf: 'നിങ്ങളുടെ നാളത്തെ പ്ലാൻ', planOfCap: 'നിങ്ങളുടെ നാളത്തെ പ്ലാൻ',
  hi: 'നമസ്കാരം', review: 'ഇന്നത്തെ ഒരു ചെറിയ അവലോകനം.', stop: '.',
  noData: 'ഇന്ന് ഒരു ജോലിയും രേഖപ്പെടുത്തിയിട്ടില്ല. നാളെ മുതൽ ഓരോ ജോലിയും എഴുതാൻ തുടങ്ങൂ.',
  today: (n, d, total) => `ഇന്ന് നിങ്ങൾ ${n} ജോലികൾ രേഖപ്പെടുത്തി, ${d} പൂർത്തിയായി, ആകെ ${total}.`,
  office: (d) => `ഓഫീസ് ജോലിക്ക് ${d} എടുത്തു.`,
  officeLabel: 'ഒരു ഓഫീസ് ജോലി', privateLabel: 'ഒരു സ്വകാര്യ ജോലി',
  planIntro: (n) => `നാളേക്ക് ${n} ജോലികൾ പ്ലാൻ ചെയ്തിട്ടുണ്ട്.`,
  planItem: (time, label) => `${time}ന്, ${label}.`,
  officeBlock: (f, to) => `${f} മുതൽ ${to} വരെ ഓഫീസ് ജോലി.`,
  focus: 'ബുദ്ധിമുട്ടുള്ള ജോലികൾ നിങ്ങളുടെ ഏറ്റവും ഊർജമുള്ള സമയത്ത് വെച്ചിട്ടുണ്ട്.',
  bye: 'ഇത്രമാത്രം. നാളെ കുറച്ചുകൂടി നന്നായി, അതാണ് ലക്ഷ്യം.',
  ins: {
    energy: (d) => `നിങ്ങളുടെ ഊർജം ${d.hours.map((h) => `${h} മണിക്ക്`).join(', ')} ചുറ്റും ഏറ്റവും കൂടുതലാണ്.`,
    focus: (d) => `ശ്രദ്ധ വേണ്ട ${d.focus} ജോലികളിൽ ${d.low} എണ്ണം കുറഞ്ഞ ഊർജത്തിൽ നടന്നു.`,
    estimate: (d) => (d.over
      ? `ജോലി സാധാരണയായി കണക്കുകൂട്ടിയതിനേക്കാൾ ${d.pct} ശതമാനം കൂടുതൽ സമയം എടുക്കുന്നു.`
      : `ജോലി സാധാരണയായി കണക്കുകൂട്ടിയതിനേക്കാൾ ${d.pct} ശതമാനം നേരത്തെ തീരുന്നു.`),
    skip: (d, label) => `${label} ${d.count} തവണ ഒഴിവായി. അത് ചെറുതാക്കുക അല്ലെങ്കിൽ ദിവസത്തിന്റെ തുടക്കത്തിൽ വെക്കുക.`,
    health: (d) => `${d.days} ദിവസമായി നടത്തമോ വ്യായാമമോ ഇല്ല. ഇരുപത് മിനിറ്റ് നടത്തത്തോടെ തുടങ്ങൂ.`,
  },
});

export const SCRIPT_LANGS = Object.keys(T);

// Ghante / minute ke shabd har bhasha mein
const UNITS = {
  hi: ['घंटे', 'मिनट'], bn: ['ঘণ্টা', 'মিনিট'], pa: ['ਘੰਟੇ', 'ਮਿੰਟ'], kn: ['ಗಂಟೆ', 'ನಿಮಿಷ'],
  ta: ['மணி நேரம்', 'நிமிடம்'], te: ['గంటలు', 'నిమిషాలు'], ml: ['മണിക്കൂർ', 'മിനിറ്റ്'],
};

/** Awaaz ke liye duration: "6h 15m" TTS ajeeb padhta hai, isliye pura shabd */
export function spokenDuration(min, lang = 'hi') {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const parts = [];
  if (lang === 'en') {
    if (h) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
    if (m || !h) parts.push(`${m} minutes`);
    return parts.join(' ');
  }
  const [hw, mw] = UNITS[lang] || UNITS.hi;
  if (h) parts.push(`${h} ${hw}`);
  if (m || !h) parts.push(`${m} ${mw}`);
  return parts.join(' ');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Private / office task ka naam chhupata hai */
export function safeLabel(item, lang = 'hi') {
  const t = T[lang] || T.hi;
  if (item.area === 'office') return t.officeLabel;
  if (item.private) return t.privateLabel;
  return item.title;
}

/**
 * @param {Array} allTasks
 * @param {string} today  YYYY-MM-DD
 * @param {object} plan   planTomorrow() ka output
 * @param {{lang?:'hi'|'en', name?:string, maxPlanItems?:number}} opts
 * @returns {{title:string, beats:string[], lang:string}}
 */
export function buildCoachScript(allTasks, today, plan, opts = {}) {
  const lang = T[opts.lang] ? opts.lang : 'hi';
  const t = T[lang];
  const name = String(opts.name || '').trim().slice(0, 40);
  const maxItems = opts.maxPlanItems ?? 5;
  const beats = [t.hello(name)];

  const todays = tasksOn(allTasks, today);
  if (!todays.length) {
    beats.push(t.noData);
  } else {
    const s = summarize(todays);
    beats.push(t.today(s.count, s.done, spokenDuration(s.totalMin, lang)));
    if (s.byArea.office) beats.push(t.office(spokenDuration(s.byArea.office, lang)));
  }

  // 2 sabse kaam ke insights, video ki bhasha mein (private naam data.title = null hota hai)
  for (const ins of insights(allTasks, today).filter((i) => t.ins[i.kind]).slice(0, 2)) {
    if (ins.kind === 'skip') {
      const label = ins.data.title
        ? `"${ins.data.title}"`
        : ins.data.area === 'office' ? capitalize(t.officeLabel) : capitalize(t.privateLabel);
      beats.push(t.ins.skip(ins.data, label));
    } else {
      beats.push(t.ins[ins.kind](ins.data));
    }
  }

  if (plan?.items?.length) {
    beats.push(t.planIntro(plan.items.length));
    // Lagatar office items ko ek block bana do ("9 se 2 tak office ka kaam")
    const blocks = [];
    for (const it of plan.items) {
      const last = blocks[blocks.length - 1];
      if (it.area === 'office' && last?.office) last.end = it.end;
      else blocks.push({ office: it.area === 'office', start: it.start, end: it.end, item: it });
    }
    for (const b of blocks.slice(0, maxItems)) {
      beats.push(b.office ? t.officeBlock(b.start, b.end) : t.planItem(b.start, safeLabel(b.item, lang)));
    }
    if (plan.items.some((i) => i.focus)) beats.push(t.focus);
  }
  beats.push(t.bye);

  return { title: t.title(name), beats, lang };
}

/** Shorts Studio / make_coach_video.py ke liye .txt */
export function toScriptTxt(script) {
  return [`# Persona coach script (lang=${script.lang})`, script.title, ...script.beats].join('\n') + '\n';
}

/** Avatar website mein paste karne ke liye ek hi paragraph */
export function toNarration(script) {
  return script.beats.join(' ');
}
