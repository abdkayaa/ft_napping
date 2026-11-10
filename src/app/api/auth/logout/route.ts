import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
  res.cookies.delete("uyku_voter");
  res.cookies.delete("uyku_admin");
  return res;
}
