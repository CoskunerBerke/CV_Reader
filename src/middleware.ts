import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "cv_gizli_label_session";
const SESSION_COOKIE_VALUE = "authorized_v1";
const INTERNAL_HEADER_NAME = "x-gizli-label-access";
const INTERNAL_HEADER_VALUE = "internal-gizlilabel-v1";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Block legacy /label route and direct static access to /cvs/*.pdf
  if (
    pathname === "/label" ||
    pathname.startsWith("/label/") ||
    pathname === "/cvs" ||
    pathname.startsWith("/cvs/")
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // 2. When entering /gizlilabel, set an HttpOnly SameSite=Strict session cookie
  //    so internal API calls and PDF iframe requests from /gizlilabel are authorized
  if (pathname === "/gizlilabel" || pathname.startsWith("/gizlilabel/")) {
    const res = NextResponse.next();
    res.cookies.set(SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("X-Frame-Options", "SAMEORIGIN");
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    return res;
  }

  // 3. Protect /api/ground-truth and /api/ground-truth/pdf from unauthorized direct access
  if (pathname.startsWith("/api/ground-truth")) {
    const hasSessionCookie =
      req.cookies.get(SESSION_COOKIE_NAME)?.value === SESSION_COOKIE_VALUE;
    const hasInternalHeader =
      req.headers.get(INTERNAL_HEADER_NAME) === INTERNAL_HEADER_VALUE;

    let hasValidReferer = false;
    const referer = req.headers.get("referer");
    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (
          refUrl.origin === req.nextUrl.origin &&
          (refUrl.pathname === "/gizlilabel" ||
            refUrl.pathname.startsWith("/gizlilabel/"))
        ) {
          hasValidReferer = true;
        }
      } catch {
        hasValidReferer = false;
      }
    }

    if (!hasSessionCookie && !hasInternalHeader && !hasValidReferer) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("X-Frame-Options", "SAMEORIGIN");
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/label",
    "/label/:path*",
    "/cvs",
    "/cvs/:path*",
    "/gizlilabel",
    "/gizlilabel/:path*",
    "/api/ground-truth/:path*",
    "/api/ground-truth",
  ],
};
