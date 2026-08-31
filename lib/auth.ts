// Signed session cookie. Web Crypto only, so this works in the proxy (edge) and in route handlers.
export type Role = "member" | "admin";

/**
 * One cookie covers both steps of the gate.
 *   after Google  -> { email }        no role yet, short-lived, only /login accepts it
 *   after the code -> { email, role }  the real session
 * The proxy lets a request through only when `role` is set.
 */
export type Session = { email: string; role?: Role; exp: number };

export const COOKIE = "baithak_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, once the code is entered
export const PENDING_MAX_AGE = 60 * 15; // 15 min to type the code after signing in

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
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
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload))));
}

/** Constant-time compare, so neither the cookie signature nor the access code leaks by timing. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sign(session: Omit<Session, "exp">, maxAgeSec: number) {
  const payload = b64url(
    enc.encode(JSON.stringify({ ...session, exp: Date.now() + maxAgeSec * 1000 })),
  );
  return `${payload}.${await hmac(payload)}`;
}

export async function verify(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  if (!safeEqual(token.slice(dot + 1), await hmac(payload))) return null;

  let s: Session;
  try {
    s = JSON.parse(new TextDecoder().decode(unb64url(payload)));
  } catch {
    return null;
  }

  if (!s || typeof s.email !== "string" || !(s.exp > Date.now())) return null;
  if (s.role !== undefined && s.role !== "member" && s.role !== "admin") return null;
  return s;
}
