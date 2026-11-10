import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { authorizeUrl } from "@/lib/intra";
import { getVoter } from "@/lib/session";

export async function GET(req: NextRequest) {
  // already signed in (came back to the home page): no second trip to intra
  if (await getVoter()) {
    const res = NextResponse.redirect(new URL("/vote", req.nextUrl.origin));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
