import assert from "node:assert/strict";
import test from "node:test";

const { toHinglish, asLang, render } = await import("./hinglish.ts");

test("schwa deletion: final, medial, and the ones that must stay", () => {
  assert.equal(toHinglish("अगर"), "agar"); // not "agra" — final schwa goes before any medial one
  assert.equal(toHinglish("मतलब"), "matlab"); // medial drops, final drops
  assert.equal(toHinglish("एक"), "ek");
  assert.equal(toHinglish("होना"), "honaa"); // "aa" is a long vowel, not a schwa
  assert.equal(toHinglish("क्या"), "kyaa");
});

test("aspirated consonants are one letter, so the syllable split respects them", () => {
  assert.equal(toHinglish("रखना"), "rakhnaa"); // not "rakhanaa"
  assert.equal(toHinglish("छुट्टी"), "chhutti"); // छ -> chh, च -> ch
  assert.equal(toHinglish("पूछ"), "puchh");
});

test("characters sanscript has no IAST mapping for are folded, not passed through", () => {
  const out = toHinglish("ऑफिस में पॉइंट बड़ा");
  assert.ok(!/[ऀ-ॿ]/.test(out), `Devanagari leaked through: ${out}`);
  assert.equal(out, "ophis men point badaa");
});

test("danda becomes a full stop", () => {
  assert.equal(toHinglish("ठीक है।"), "thik hai.");
});

test("ASCII is left alone so English words and markdown survive", () => {
  assert.equal(toHinglish("कोई HRD ने"), "koi HRD ne");
  assert.equal(toHinglish("## Heading"), "## Heading"); // no Devanagari at all: untouched
  assert.ok(toHinglish("**मतलब**").includes("**matlab**"));
  assert.equal(toHinglish(""), "");
});

test("lang parsing defaults to Hindi and render() is a no-op for it", () => {
  assert.equal(asLang(undefined), "hi");
  assert.equal(asLang("nonsense"), "hi");
  assert.equal(asLang("hinglish"), "hinglish");
  assert.equal(asLang(["hinglish", "hi"]), "hinglish");
  assert.equal(render("मतलब", "hi"), "मतलब"); // Devanagari untouched
  assert.equal(render("मतलब", "hinglish"), "matlab");
});

test("a markdown heading does not switch transliteration off for the rest", () => {
  // sanscript treats ## as ITRANS's "stop transliterating" marker, which silently killed
  // everything after the first heading in Plaud's Hindi notes.
  const md = "## बैठक की जानकारी\n\n- नई भर्ती शुरू करने के लिए\n- हायरिंग मैनेजर को कंपनी";
  const out = toHinglish(md);
  assert.ok(!/[ऀ-ॿ]/.test(out), `Devanagari survived past the heading: ${out}`);
  assert.ok(out.startsWith("## baithak ki jaankaari"), out.slice(0, 40));
  assert.ok(out.includes("\n\n- "), "markdown structure must be preserved");
});

test("lowercase English inside Hindi text is not mangled by the letter rules", () => {
  assert.equal(toHinglish("पोर्टलों (जैसे, Naukri, LinkedIn) पर"), "portlon (jaise, Naukri, LinkedIn) par");
});
