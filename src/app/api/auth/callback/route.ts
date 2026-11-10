import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, fetchMe, checkEligibility, voterHash } from "@/lib/intra";
import { hasVoted } from "@/lib/survey";
import { setVoter } from "@/lib/session";

export async function GET(req: NextRequest) {
  const to = (path: string) => {
    const res = NextResponse.redirect(new URL(path, req.nextUrl.origin));
    res.cookies.delete("oauth_state");
    return res;
  };
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("oauth_state")?.value) return to("/?e=state");

  let me;
  try {
    me = await fetchMe(await exchangeCode(code));
  } catch (e) {
    console.error("[auth]", (e as Error).message);
    return to("/?e=oauth");
  }
  // From here on only the boolean result and the hash are used; the profile is dropped.
  const el = checkEligibility(me);
  if (!el.ok) return to(`/?e=${el.reason}`);
  const vh = voterHash(me.id);
  if (await hasVoted(vh)) return to("/thanks?already=1");
  await setVoter(vh);
  return to("/vote");
}
