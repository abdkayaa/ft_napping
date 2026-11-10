import { createHmac } from "node:crypto";

const INTRA = "https://api.intra.42.fr";
export const CAMPUS_ID = 49; // 42 Istanbul
export const CURSUS_ID = 21; // 42cursus

export const redirectUri = () => process.env.FT_REDIRECT_URI || "https://localhost:4242";

export function authorizeUrl(state: string) {
  const u = new URL(`${INTRA}/oauth/authorize`);
  u.searchParams.set("client_id", process.env.FT_CLIENT_ID ?? "");
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "public");
  u.searchParams.set("state", state);
  return u.toString();
}

/** Exchanges the code; falls back to FT_CLIENT_SECRET_NEXT after the intra secret rotation (16/11/2026). */
export async function exchangeCode(code: string): Promise<string> {
  const secrets = [process.env.FT_CLIENT_SECRET, process.env.FT_CLIENT_SECRET_NEXT].filter(Boolean) as string[];
  let last = "";
  for (const secret of secrets) {
    const r = await fetch(`${INTRA}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.FT_CLIENT_ID ?? "",
        client_secret: secret,
        code,
        redirect_uri: redirectUri(),
      }),
    });
    const j = (await r.json().catch(() => ({}))) as { access_token?: string; error?: string };
    if (j.access_token) return j.access_token;
    last = j.error ?? `HTTP ${r.status}`;
    if (last !== "invalid_client") break; // only a bad secret is worth retrying with the next one
  }
  throw new Error(`token exchange failed: ${last}`);
}

export type Me = {
  id: number;
  kind?: string;
  "active?"?: boolean;
  "alumni?"?: boolean;
  "staff?"?: boolean;
  campus_users?: { campus_id: number }[];
  cursus_users?: { cursus_id: number; end_at: string | null; blackholed_at: string | null }[];
};

export async function fetchMe(token: string): Promise<Me> {
  const r = await fetch(`${INTRA}/v2/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`/v2/me HTTP ${r.status}`);
  return (await r.json()) as Me;
}

export type Eligibility = { ok: true } | { ok: false; reason: "not_student" | "inactive" | "campus" | "cursus" };

/** Active 42 Istanbul student with a running 42cursus (not ended, not blackholed). */
export function checkEligibility(me: Me, now = new Date()): Eligibility {
  if (me.kind !== "student" || me["staff?"]) return { ok: false, reason: "not_student" };
  if (me["active?"] === false || me["alumni?"] === true) return { ok: false, reason: "inactive" };
  if (!me.campus_users?.some((c) => c.campus_id === CAMPUS_ID)) return { ok: false, reason: "campus" };
  const future = (d: string | null) => d === null || new Date(d) > now;
  const cursus = me.cursus_users?.some((c) => c.cursus_id === CURSUS_ID && future(c.end_at) && future(c.blackholed_at));
  if (!cursus) return { ok: false, reason: "cursus" };
  return { ok: true };
}

/** One-way voter id. Without VOTER_SALT nobody (admins included) can map it back to a person. */
export function voterHash(userId: number): string {
  const salt = process.env.VOTER_SALT;
  if (!salt || salt.length < 32) throw new Error("VOTER_SALT must be set (>= 32 chars)");
  return createHmac("sha256", salt).update(`42:${userId}`).digest("hex");
}
