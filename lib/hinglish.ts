import Sanscript from "@indic-transliteration/sanscript";

/**
 * Devanagari -> Roman-script Hindi ("Hinglish"). This is transliteration, not translation:
 * the words are unchanged, only the script is. The Devanagari original is always one tap away.
 *
 * IAST is the useful starting point because it marks long vowels and retroflexes unambiguously;
 * everything below turns those into the plain-ASCII spellings people actually type.
 */

/** Characters sanscript has no IAST mapping for, folded to their closest base form first. */
function normalise(run: string) {
  return run
    .replace(/़/g, "") // nukta: ड़ -> ड, ज़ -> ज
    .replace(/ऑ/g, "ओ")
    .replace(/ॉ/g, "ो")
    .replace(/ऍ/g, "ए")
    .replace(/ॅ/g, "े")
    .replace(/[।॥]/g, ".");
}

const CHH = ""; // placeholder so छ survives while plain c becomes ch

// IAST diacritics -> what a Hindi speaker types on a QWERTY keyboard.
const LETTERS: [RegExp, string][] = [
  [/ch/g, CHH], // IAST ch is छ; park it
  [/c/g, "ch"], // IAST c is च
  [new RegExp(CHH, "g"), "chh"],
  [/ā/g, "aa"],
  [/ī/g, "i"],
  [/ū/g, "u"],
  [/ṛ|ṝ/g, "ri"],
  [/ḷ|ḹ/g, "li"],
  [/ṭ/g, "t"],
  [/ḍ/g, "d"],
  [/ṇ/g, "n"],
  [/ṅ|ñ/g, "n"],
  [/ś|ṣ/g, "sh"],
  [/ṃ|ṁ|~/g, "n"],
  [/ḥ/g, "h"],
  [/['ʼ·]/g, ""],
];

/**
 * Split into (consonants)(vowel) units. Working in units rather than characters is what keeps the
 * aspirated letters right — "kh", "chh" and "th" are one Devanagari consonant each, so रखना has to
 * come out "rakhna" and not "rakhanaa".
 */
function units(word: string) {
  const out: [string, string][] = [];
  const re = /([^aeiou]*)([aeiou]*)/gy;
  let m: RegExpExecArray | null;
  while ((m = re.exec(word)) && (m[1] || m[2])) out.push([m[1], m[2]]);
  return out;
}

/**
 * Hindi drops most inherent schwas: मतलब is "matlab", not "matalaba". Order matters — the final
 * schwa goes first, and a medial one drops only if the syllables on both sides still have vowels,
 * which is why अगर comes out "agar" and not "agra".
 *
 * ponytail: a heuristic, not a morphological analyser. Rare words and compounds can come out
 * clipped ("Bhiwandi" loses one). Upgrade path if it ever matters: have the pipeline emit a
 * romanised transcript alongside the Devanagari and delete this file.
 */
function dropSchwa(word: string) {
  const u = units(word);
  const last = u.length - 1;
  if (last < 1) return word;

  // Final schwa. "aa" is a long vowel, not a schwa, so "honaa" and "kyaa" keep theirs.
  if (u[last][1] === "a" && u[last][0]) u[last][1] = "";

  // Then medial, right to left.
  for (let i = last - 1; i >= 1; i--) {
    if (u[i][1] === "a" && u[i][0] && u[i - 1][1] && u[i + 1][1]) u[i][1] = "";
  }

  return u.map(([c, v]) => c + v).join("");
}

/**
 * Only maximal runs of Devanagari go through sanscript, one at a time. Handing it a whole document
 * does not work: `##` is ITRANS's "stop transliterating" marker, so one markdown heading silently
 * switches the rest of the text off. Per-run also means English words, markdown syntax, numbers
 * and timestamps are never touched by the letter rules.
 */
const RUN = /[ऀ-ॿ‌‍]+/g;

export function toHinglish(text: string): string {
  if (!text) return text;

  return text.replace(RUN, (run) => {
    let out = Sanscript.t(normalise(run), "devanagari", "iast") as string;
    for (const [re, to] of LETTERS) out = out.replace(re, to);
    return out.replace(/[a-z]+/g, dropSchwa);
  });
}

export type Lang = "hi" | "hinglish";

export const asLang = (v: string | string[] | undefined): Lang =>
  (Array.isArray(v) ? v[0] : v) === "hinglish" ? "hinglish" : "hi";

export const render = (text: string, lang: Lang) => (lang === "hinglish" ? toHinglish(text) : text);
