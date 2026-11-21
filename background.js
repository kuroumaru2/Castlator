const translationCache = new Map();

const KANA_2CHAR = {
  "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
  "しゃ": "sha", "しゅ": "shu", "しょ": "sho",
  "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho",
  "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
  "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
  "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
  "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
  "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
  "じゃ": "ja",  "じゅ": "ju",  "じょ": "jo",
  "ぢゃ": "ja",  "ぢゅ": "ju",  "ぢょ": "jo",
  "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
  "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",
  "ふぁ": "fa",  "ふぃ": "fi",  "ふぇ": "fe",  "ふぉ": "fo",
  "うぃ": "wi",  "うぇ": "we",  "うぉ": "wo",
  "てぃ": "ti",  "でぃ": "di",  "とぅ": "tu",  "どぅ": "du",
  "ゔぁ": "va",  "ゔぃ": "vi",  "ゔ": "vu",   "ゔぇ": "ve",  "ゔぉ": "vo"
};

const KANA_1CHAR = {
  "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
  "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
  "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
  "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
  "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
  "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
  "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
  "や": "ya", "ゆ": "yu", "よ": "yo",
  "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
  "わ": "wa", "ゐ": "wi", "ゑ": "we", "を": "o", "ん": "n",
  "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
  "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
  "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do",
  "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
  "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
  "ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o",
  "ゃ": "ya", "ゅ": "yu", "ょ": "yo", "ゎ": "wa"
};

function katakanaToHiragana(str) {
  return str.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function fallbackKanaToRomaji(text) {
  const hira = katakanaToHiragana(text);
  let out = "";
  let doubleConsonant = false;
  let lastVowel = "";

  for (let i = 0; i < hira.length; i++) {
    const ch = hira[i];
    const pair = hira.slice(i, i + 2);

    if (ch === "っ") {
      doubleConsonant = true;
      continue;
    }

    if (ch === "ー") {
      if (lastVowel) out += lastVowel;
      continue;
    }

    let syl = null;
    if (KANA_2CHAR[pair]) {
      syl = KANA_2CHAR[pair];
      i += 1;
    } else if (KANA_1CHAR[ch]) {
      syl = KANA_1CHAR[ch];
    } else {
      doubleConsonant = false;
      lastVowel = "";
      out += ch;
      continue;
    }

    if (ch === "ん") {
      const nextPair = hira.slice(i + 1, i + 3);
      const nextChar = hira[i + 1] || "";
      const nextSyl = KANA_2CHAR[nextPair] || KANA_1CHAR[nextChar] || "";
      out += /^[bmp]/.test(nextSyl) ? "m" : "n";
      lastVowel = "";
      continue;
    }

    if (doubleConsonant && syl.length > 0) {
      const first = syl[0];
      if (first === "c") out += "t";
      else if (!/[aiueo]/.test(first)) out += first;
      doubleConsonant = false;
    }

    out += syl;
    const vowelMatch = syl.match(/[aiueo](?!.*[aiueo])/);
    lastVowel = vowelMatch ? vowelMatch[0] : "";
  }

  return out.replace(/\s+/g, " ").trim();
}

function extractRomajiFromPayload(data, fallbackSourceText) {
  if (!Array.isArray(data)) return fallbackKanaToRomaji(fallbackSourceText);

  // Google Translate with dt=rm often places transliteration items in data[0] or deeper arrays
  const candidates = [];

  if (Array.isArray(data[0])) {
    for (const entry of data[0]) {
      if (Array.isArray(entry) && typeof entry[3] === "string" && entry[3].trim()) {
        candidates.push(entry[3].trim());
      }
      if (Array.isArray(entry) && typeof entry[2] === "string" && entry[2].trim()) {
        // Sometimes entry[2] is source transliteration when entry[3] is absent
        if (!/[\u3040-\u30ff\u4e00-\u9faf]/.test(entry[2])) {
          candidates.push(entry[2].trim());
        }
      }
    }
  }

  if (candidates.length > 0) {
    return candidates.join(" ").trim();
  }

  return fallbackKanaToRomaji(fallbackSourceText);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translate") {
    const { text, targetLang } = request;
    const cacheKey = `${targetLang}:${text}`;

    if (translationCache.has(cacheKey)) {
      sendResponse(translationCache.get(cacheKey));
      return true;
    }

    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        targetLang
      )}&dt=t&dt=rm&q=${encodeURIComponent(text)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data && data[0]) {
          const translated = data[0]
            .filter((item) => Array.isArray(item) && typeof item[0] === "string")
            .map((item) => item[0])
            .join("");
          const detectedLang = data[2] || "";
          const hasJapanese = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f\u4e00-\u9faf]/.test(text);
          const romaji = hasJapanese ? extractRomajiFromPayload(data, text) : null;

          const alreadyTarget =
            detectedLang && detectedLang.toLowerCase().startsWith(targetLang.toLowerCase());

          const result = {
            translatedText: alreadyTarget ? null : translated,
            romaji
          };

          translationCache.set(cacheKey, result);
          sendResponse(result);
        } else {
          sendResponse({ translatedText: null, romaji: null });
        }
      })
      .catch((err) => {
        console.error("Translation error:", err);
        const hasJapanese = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f\u4e00-\u9faf]/.test(text);
        sendResponse({
          translatedText: null,
          romaji: hasJapanese ? fallbackKanaToRomaji(text) : null
        });
      });

    return true;
  }
});