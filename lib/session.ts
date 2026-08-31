import { cookies } from "next/headers";
import { COOKIE, verify, type Role, type Session } from "./auth";

/** The current request's session, re-verified server-side. Never trust the client for this. */
export async function currentSession(): Promise<Session | null> {
  return verify((await cookies()).get(COOKIE)?.value);
}

/** Role only, and only once the access code step is done. */
export async function currentRole(): Promise<Role | null> {
  return (await currentSession())?.role ?? null;
}

export const googleClientId = () => process.env.GOOGLE_CLIENT_ID ?? "";

/**
 * Optional allowlist. Empty means any Google account may reach the access-code step —
 * the code is still the gate, Google just puts a name on who used it.
 */
export function emailAllowed(email: string) {
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(email.toLowerCase());
}
