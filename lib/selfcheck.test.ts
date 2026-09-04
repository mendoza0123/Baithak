// npm test  — Node's built-in runner, no framework.
import assert from "node:assert/strict";
import test from "node:test";

process.env.AUTH_SECRET ||= "x".repeat(40);

const { sign, verify, safeEqual } = await import("./auth.ts");
const { ist, mins, clock, dueLabel, isOverdue, stripBriefHeader } = await import("./format.ts");

const EMAIL = "aditya@example.com";

test("a signed session round-trips, a tampered one does not", async () => {
  const token = await sign({ email: EMAIL, role: "admin" }, 3600);
  const s = await verify(token);
  assert.equal(s?.email, EMAIL);
  assert.equal(s?.role, "admin");

  const [payload, sig] = token.split(".");
  assert.equal(await verify(`${payload}.deadbeef`), null, "bad signature must fail");
  assert.equal(await verify(`${payload}x.${sig}`), null, "edited payload must fail");
  assert.equal(await verify(undefined), null);
  assert.equal(await verify("garbage"), null);
  assert.equal(await verify("no-dot-here"), null);
});

test("a member cookie cannot be edited into an admin one", async () => {
  const member = await verify(await sign({ email: EMAIL, role: "member" }, 3600));
  assert.equal(member?.role, "member");

  // Forge the payload an attacker would want, then present it with any signature they can make.
  const forged = Buffer.from(JSON.stringify({ email: EMAIL, role: "admin", exp: Date.now() + 1e6 }))
    .toString("base64url");
  assert.equal(await verify(`${forged}.${await sign({ email: EMAIL }, 3600).then((t) => t.split(".")[1])}`), null);
});

test("expiry is enforced and the Google step carries no role", async () => {
  assert.equal(await verify(await sign({ email: EMAIL, role: "admin" }, -1)), null, "expired");

  // What /api/auth/google issues: identifies the person, grants nothing.
  const pending = await verify(await sign({ email: EMAIL }, 900));
  assert.equal(pending?.email, EMAIL);
  assert.equal(pending?.role, undefined, "no role until the access code is entered");
});

test("safeEqual matches === without leaking length early", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
});

test("timestamps render in IST whatever the server timezone is", () => {
  // 2026-08-26T07:20:00Z is 12:50 on Wednesday in Kolkata (+05:30).
  assert.equal(ist("2026-08-26T07:20:00.000Z"), "Wed 26 Aug, 12:50");
  // 19:00Z on the 25th is already past midnight in IST — the date must roll forward.
  assert.equal(ist("2026-08-25T19:00:00.000Z"), "Wed 26 Aug, 00:30");
  assert.equal(ist(null), "—");
});

test("durations and transcript clocks", () => {
  assert.equal(mins(1383), "23 min");
  assert.equal(mins(3), "3 sec");
  assert.equal(mins(null), null);
  assert.equal(mins(0), null);
  assert.equal(clock(549820), "09:09");
  assert.equal(clock(null), "--:--");
});

test("due dates are plain YYYY-MM-DD and never shift by a timezone", () => {
  assert.equal(dueLabel("2026-08-31"), "31 Aug 2026");
  assert.equal(dueLabel(null), null);
  assert.equal(isOverdue("2000-01-01"), true);
  assert.equal(isOverdue("2999-01-01"), false);
  assert.equal(isOverdue(null), false);
});

test("the brief's own title block is stripped, the body is not", () => {
  const md = [
    "# MIS review: audits move to HR",
    "*MIS · Wednesday 26 August 2026 · 12:50 IST · 16 min*",
    "*Participants: Naushi, Mahesh*",
    "",
    "## Executive summary",
    "Naushi opened with *dissatisfaction* about the handover.",
  ].join("\n");

  const out = stripBriefHeader(md);
  assert.ok(out.startsWith("## Executive summary"), out.slice(0, 40));
  assert.ok(out.includes("*dissatisfaction*"), "italics in the body must survive");

  // A brief that does not start with an H1 is left alone.
  assert.equal(stripBriefHeader("## Executive summary\nbody"), "## Executive summary\nbody");
});

test("gap() coarsens as the wait grows, and refuses nonsense", async () => {
  const { gap } = await import("./format.ts");
  const t = (a: string, b: string) => gap(`2026-09-01T00:00:00Z`, `2026-09-01T${a}:${b}:00Z`);

  assert.equal(t("00", "00"), "under a min");
  assert.equal(t("00", "32"), "32 min");
  assert.equal(t("01", "00"), "1 hr"); // exact hours drop the "0 min"
  assert.equal(t("01", "26"), "1 hr 26 min");
  assert.equal(gap("2026-09-01T00:00:00Z", "2026-09-03T00:00:00Z"), "2d");
  assert.equal(gap("2026-09-01T00:00:00Z", "2026-09-03T03:00:00Z"), "2d 3h");

  // A stage that hasn't happened, or clocks that disagree, must not render a negative duration.
  assert.equal(gap("2026-09-01T00:00:00Z", null), null);
  assert.equal(gap(null, "2026-09-01T00:00:00Z"), null);
  assert.equal(gap("2026-09-02T00:00:00Z", "2026-09-01T00:00:00Z"), null);
});
