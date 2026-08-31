// node --test lib/  — Node's built-in runner, no framework.
import assert from "node:assert/strict";
import test from "node:test";

process.env.AUTH_SECRET ||= "x".repeat(40);

const { sign, verify, safeEqual } = await import("./auth.ts");
const { ist, mins, clock, dueLabel, isOverdue, stripBriefHeader } = await import("./format.ts");

test("a signed cookie round-trips, a tampered one does not", async () => {
  const token = await sign("admin");
  assert.equal(await verify(token), "admin");
  assert.equal(await verify(await sign("member")), "member");

  const [role, exp, sig] = token.split(".");
  assert.equal(await verify(`member.${exp}.${sig}`), null, "role swap must fail");
  assert.equal(await verify(`${role}.${exp}.deadbeef`), null, "bad signature must fail");
  assert.equal(await verify(`${role}.${Number(exp) + 1}.${sig}`), null, "exp is signed too");
  assert.equal(await verify(`${role}.1.${sig}`), null, "expired must fail");
  assert.equal(await verify(undefined), null);
  assert.equal(await verify("garbage"), null);
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
