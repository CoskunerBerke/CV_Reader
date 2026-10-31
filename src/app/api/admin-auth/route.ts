import { NextRequest, NextResponse } from "next/server";
import {
  DEVICE_TRUST_COOKIE,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_VALUE,
  extractClientIp,
  createDeviceTrustToken,
  verifyDeviceTrustToken,
  verifyMasterRecoveryKey,
  getAdminSecurityState,
  updateAdminAllowedIps,
  recordAdminAccessAttempt,
  clearAdminAccessLogs,
} from "@/lib/adminSecurity";

function applyAdminAuthCookies(res: NextResponse, currentIp: string) {
  const trustToken = createDeviceTrustToken(currentIp);
  res.cookies.set(DEVICE_TRUST_COOKIE, trustToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 365 gün (Modem sıfırlansa bile cihazı tanır)
  });
  res.cookies.set(SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 gün
  });
}

export async function GET(req: NextRequest) {
  const currentIp = extractClientIp(req);
  const targetPath = req.nextUrl.searchParams.get("path") || "/gizlilabel";
  const isSilent = req.nextUrl.searchParams.get("silent") === "1";

  const deviceCookie = req.cookies.get(DEVICE_TRUST_COOKIE)?.value;
  const hasTrustedDevice = verifyDeviceTrustToken(deviceCookie);

  const securityState = await getAdminSecurityState();
  const isIpWhitelisted = securityState.allowedIps.includes(currentIp);

  // Durum 1: IP zaten izin verilen Wi-Fi IP listesinde (Örn: 176.240.152.131)
  if (isIpWhitelisted) {
    const finalState = isSilent
      ? securityState
      : await recordAdminAccessAttempt(
          req,
          "authorized",
          targetPath,
          securityState
        );

    const res = NextResponse.json({
      authorized: true,
      currentIp,
      allowedIps: finalState.allowedIps,
      accessLogs: finalState.accessLogs,
      autoRecovered: false,
      note: finalState.lastAutoRecoveryNote,
    });
    applyAdminAuthCookies(res, currentIp);
    return res;
  }

  // Durum 2: Modem sıfırlandı / IP değişti AMA tarayıcıda 365 günlük kriptografik Cihaz İmzası var -> Yeni IP'yi otomatik kaydet!
  if (hasTrustedDevice) {
    const updated = await updateAdminAllowedIps(currentIp, {
      replaceAll: false,
      note: `Modem/IP değişimi algılandı; güvenilir cihaz imzasıyla yeni IP (${currentIp}) otomatik tanımlandı.`,
    });
    const finalState = isSilent
      ? updated
      : await recordAdminAccessAttempt(
          req,
          "auto_recovered",
          targetPath,
          updated
        );

    const res = NextResponse.json({
      authorized: true,
      currentIp,
      allowedIps: finalState.allowedIps,
      accessLogs: finalState.accessLogs,
      autoRecovered: true,
      note: finalState.lastAutoRecoveryNote,
    });
    applyAdminAuthCookies(res, currentIp);
    return res;
  }

  // Durum 3: Hem IP yabancı hem de güvenilir cihaz imzası yok ->
  // Sadece ilk giriş denemesinde (!isSilent) kaydet ve 403 döndür!
  if (!isSilent) {
    await recordAdminAccessAttempt(req, "blocked", targetPath, securityState);
  }

  return NextResponse.json(
    {
      authorized: false,
      currentIp,
    },
    { status: 403 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const currentIp = extractClientIp(req);
    const body = await req.json();
    const action = body?.action;

    // 1) Modem sıfırlandı + Yeni bir cihazdan giriliyor -> Master Kurtarma Anahtarı ile Yeni Wi-Fi IP'sini Tanımla
    if (action === "recover_with_key") {
      const masterKey = String(body?.masterKey || "").trim();
      const replaceOldIps = Boolean(body?.replaceOldIps);

      if (!verifyMasterRecoveryKey(masterKey)) {
        await recordAdminAccessAttempt(req, "failed_key", "/gizlilabel");
        return NextResponse.json(
          { error: "Geçersiz Kurtarma Anahtarı. IP adresiniz kaydedildi." },
          { status: 401 }
        );
      }

      const updated = await updateAdminAllowedIps(currentIp, {
        replaceAll: replaceOldIps,
        note: `Kurtarma anahtarı ile yeni Wi-Fi IP (${currentIp}) yetkilendirildi.`,
      });
      const finalState = await recordAdminAccessAttempt(
        req,
        "key_recovered",
        "/gizlilabel",
        updated
      );

      const res = NextResponse.json({
        success: true,
        authorized: true,
        currentIp,
        allowedIps: finalState.allowedIps,
        accessLogs: finalState.accessLogs,
      });
      applyAdminAuthCookies(res, currentIp);
      return res;
    }

    // 2) Sadece mevcut bağlı olunan Wi-Fi IP'sine kilitle (Diğer eski IP'leri temizle)
    if (action === "lock_to_current_ip") {
      const deviceCookie = req.cookies.get(DEVICE_TRUST_COOKIE)?.value;
      const hasTrustedDevice = verifyDeviceTrustToken(deviceCookie);
      const state = await getAdminSecurityState();
      if (!hasTrustedDevice && !state.allowedIps.includes(currentIp)) {
        return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 });
      }

      const updated = await updateAdminAllowedIps(currentIp, {
        replaceAll: true,
        note: `Erişim yalnızca aktif Wi-Fi IP adresine (${currentIp}) kilitlendi.`,
      });

      const res = NextResponse.json({
        success: true,
        currentIp,
        allowedIps: updated.allowedIps,
        accessLogs: updated.accessLogs,
        note: updated.lastAutoRecoveryNote,
      });
      applyAdminAuthCookies(res, currentIp);
      return res;
    }

    // 3) Manuel olarak ek bir IP adresi ekle
    if (action === "add_custom_ip") {
      const deviceCookie = req.cookies.get(DEVICE_TRUST_COOKIE)?.value;
      const hasTrustedDevice = verifyDeviceTrustToken(deviceCookie);
      const state = await getAdminSecurityState();
      if (!hasTrustedDevice && !state.allowedIps.includes(currentIp)) {
        return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 });
      }

      const targetIp = String(body?.targetIp || body?.customIp || "").trim();
      if (!targetIp) {
        return NextResponse.json(
          { error: "Lütfen geçerli bir IP adresi girin." },
          { status: 400 }
        );
      }

      const updated = await updateAdminAllowedIps(targetIp, {
        replaceAll: false,
        note: `Manuel IP eklendi: ${targetIp}`,
      });

      return NextResponse.json({
        success: true,
        currentIp,
        allowedIps: updated.allowedIps,
        accessLogs: updated.accessLogs,
        note: updated.lastAutoRecoveryNote,
      });
    }

    // 4) Giriş denemesi loglarını temizle
    if (action === "clear_access_logs") {
      const deviceCookie = req.cookies.get(DEVICE_TRUST_COOKIE)?.value;
      const hasTrustedDevice = verifyDeviceTrustToken(deviceCookie);
      const state = await getAdminSecurityState();
      if (!hasTrustedDevice && !state.allowedIps.includes(currentIp)) {
        return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 });
      }

      const cleared = await clearAdminAccessLogs();
      return NextResponse.json({
        success: true,
        currentIp,
        allowedIps: cleared.allowedIps,
        accessLogs: cleared.accessLogs,
        note: "IP giriş denemesi kayıtları temizlendi.",
      });
    }

    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "İşlem başarısız.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
