// Signed session cookie. Web Crypto only, so this works in the proxy (edge) and in route handlers.
export type Role = "member" | "admin";

export const COOKIE = "baithak_session";
export const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET missing or too short (need 32+ chars)");
  return s;
}

async function hmac(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

/** Constant-time string compare, so neither the cookie signature nor the access code leaks by timing. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sign(role: Role) {
  const payload = `${role}.${Date.now() + MAX_AGE * 1000}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verify(token: string | undefined): Promise<Role | null> {
  if (!token) return null;
  const [role, exp, sig] = token.split(".");
  if (!role || !exp || !sig) return null;
  if (role !== "member" && role !== "admin") return null;
  if (!(Number(exp) > Date.now())) return null;
  return safeEqual(sig, await hmac(`${role}.${exp}`)) ? role : null;
}
