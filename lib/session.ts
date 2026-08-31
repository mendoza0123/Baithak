import { cookies } from "next/headers";
import { COOKIE, verify, type Role } from "./auth";

/** Role of the current request, re-verified server-side. Never trust the client for this. */
export async function currentRole(): Promise<Role | null> {
  return verify((await cookies()).get(COOKIE)?.value);
}
