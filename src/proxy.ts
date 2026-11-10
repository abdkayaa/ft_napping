import { NextResponse, type NextRequest } from "next/server";

// The intra app's registered redirect URI is the site root (https://localhost:4242 today).
// Forward "/?code=..&state=.." to the real callback handler.
export function proxy(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  if (searchParams.has("code") && searchParams.has("state")) {
    const url = req.nextUrl.clone();
    url.pathname = "/api/auth/callback";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };
