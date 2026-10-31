import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "cv_gizli_label_session";
const SESSION_COOKIE_VALUE = "authorized_v1";
const DEVICE_TRUST_COOKIE = "cv_admin_device_trust";

const STATIC_TRUSTED_IPS = new Set([
  "176.240.152.131",
  "127.0.0.1",
  "::1",
  "localhost",
]);

function getRequestIp(req: NextRequest): string {
  const raw =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for") ||
    "127.0.0.1";
  let ip = raw.split(",")[0].trim();
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }
  return ip;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Eski /label rotalarını ve /cvs/*.pdf statik erişimini tamamen kapat
  if (
    pathname === "/label" ||
    pathname.startsWith("/label/") ||
    pathname === "/cvs" ||
    pathname.startsWith("/cvs/")
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const clientIp = getRequestIp(req);
  const isStaticTrustedIp = STATIC_TRUSTED_IPS.has(clientIp);
  const hasSessionCookie =
    req.cookies.get(SESSION_COOKIE_NAME)?.value === SESSION_COOKIE_VALUE;
  const hasDeviceCookie = Boolean(req.cookies.get(DEVICE_TRUST_COOKIE)?.value);

  // 2. /gizlilabel ve /gizlilabel/kriterler sayfaları:
  //    Sadece güvenilir Wi-Fi IP'si (176.240.152.131) veya daha önce yetkilendirilmiş cihaz çerezi varsa
  //    oturum çerezini otomatik ver. Aksi halde sayfa içindeki Wi-Fi IP Kalkanı (404 / Kurtarma Ekranı) devreye girer.
  if (pathname === "/gizlilabel" || pathname.startsWith("/gizlilabel/")) {
    const res = NextResponse.next();
    if (isStaticTrustedIp || hasDeviceCookie || hasSessionCookie) {
      res.cookies.set(SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("X-Frame-Options", "SAMEORIGIN");
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    return res;
  }

  // 3. Admin API'lerini (/api/ground-truth, GET /api/vault) yabancı IP'lerden gelen yetkisiz erişime kapat
  if (
    pathname.startsWith("/api/ground-truth") ||
    (pathname.startsWith("/api/vault") && req.method === "GET")
  ) {
    if (!isStaticTrustedIp && !hasSessionCookie && !hasDeviceCookie) {
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
    "/api/vault",
    "/api/vault/:path*",
  ],
};
