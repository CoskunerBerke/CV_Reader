import { NextRequest, NextResponse } from "next/server";
import {
  appendUploadedCVsToVault,
  appendPremiumLeadToVault,
  readFullVaultFromCloudAndLocal,
} from "@/lib/cvVault";

const SESSION_COOKIE_NAME = "cv_gizli_label_session";
const SESSION_COOKIE_VALUE = "authorized_v1";
const INTERNAL_HEADER_NAME = "x-gizli-label-access";
const INTERNAL_HEADER_VALUE = "internal-gizlilabel-v1";

function isAuthorizedGizliLabelRequest(req: NextRequest): boolean {
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

  return hasSessionCookie || hasInternalHeader || hasValidReferer;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedGizliLabelRequest(req)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const data = await readFullVaultFromCloudAndLocal();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Vault okunamadı.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "save_lead") {
      const fullName = String(body?.fullName || "").trim();
      const companyName = String(body?.companyName || "").trim();
      const contactInfo = String(body?.contactInfo || "").trim();
      const requestedFeature = String(body?.requestedFeature || "").trim();
      const message = String(body?.message || "").trim();

      if (!contactInfo && !fullName) {
        return NextResponse.json(
          { error: "Lütfen adınızı ve iletişim bilginizi girin." },
          { status: 400 }
        );
      }

      const lead = await appendPremiumLeadToVault({
        fullName: fullName || "İsimsiz Ziyaretçi",
        companyName: companyName || "-",
        contactInfo: contactInfo || "-",
        requestedFeature:
          requestedFeature ||
          "Lisans Bölümü, Ön Lisans, Yüksek Lisans & Doktora Kırılımları",
        message,
      });

      return NextResponse.json({
        success: true,
        lead,
      });
    }

    if (action === "save_cvs") {
      const items = Array.isArray(body?.items) ? body.items : [];
      if (items.length > 0) {
        const ua = req.headers.get("user-agent") || undefined;
        await appendUploadedCVsToVault(items, ua);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "İşlem kaydedilemedi.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
