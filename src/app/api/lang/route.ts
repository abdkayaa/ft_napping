import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const l = req.nextUrl.searchParams.get("l") === "en" ? "en" : "tr";
  const back = req.headers.get("referer");
  const target = back && new URL(back).origin === req.nextUrl.origin ? back : new URL("/", req.nextUrl.origin);
  const res = NextResponse.redirect(target);
  res.cookies.set("lang", l, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  return res;
}
