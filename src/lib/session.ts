import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { timingSafeEqual, createHash } from "node:crypto";

const key = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(s);
};

export async function sign(payload: Record<string, unknown>, ttl: string) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(ttl).sign(key());
}

export async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    return (await jwtVerify(token, key())).payload as T;
  } catch {
    return null;
  }
}

const secure = process.env.NODE_ENV === "production" || (process.env.FT_REDIRECT_URI ?? "https://").startsWith("https");
const base = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };

export const VOTER = "uyku_voter";
export const ADMIN = "uyku_admin";

/** Voter session carries only the hashed id — never login or name. */
export async function setVoter(vh: string) {
  (await cookies()).set(VOTER, await sign({ vh }, "1h"), { ...base, maxAge: 3600 });
}
export async function getVoter() {
  return verify<{ vh: string }>((await cookies()).get(VOTER)?.value);
}
export async function clearVoter() {
  (await cookies()).delete(VOTER);
}

export async function setAdmin() {
  (await cookies()).set(ADMIN, await sign({ admin: true }, "8h"), { ...base, maxAge: 8 * 3600 });
}
export async function isAdmin() {
  return !!(await verify<{ admin: boolean }>((await cookies()).get(ADMIN)?.value))?.admin;
}
export async function clearAdmin() {
  (await cookies()).delete(ADMIN);
}

export function passwordMatches(input: string) {
  const want = process.env.ADMIN_PASSWORD;
  if (!want || want.length < 10) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(input), h(want));
}
