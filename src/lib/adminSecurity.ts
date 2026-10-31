import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { NextRequest } from "next/server";

export const DEVICE_TRUST_COOKIE = "cv_admin_device_trust";
export const SESSION_COOKIE_NAME = "cv_gizli_label_session";
export const SESSION_COOKIE_VALUE = "authorized_v1";

// Kullanıcının mevcut Wi-Fi IP adresi + yerel geliştirme IP'leri
const INITIAL_ALLOWED_IPS = [
  "176.240.152.131",
  "127.0.0.1",
  "::1",
  "localhost",
];

// Modem sıfırlandığında ve yeni bir cihazdan girildiğinde kullanılacak Kurtarma Anahtarı
const DEFAULT_MASTER_RECOVERY_KEY =
  process.env.ADMIN_MASTER_KEY || "BerkeCV2026!";

const HMAC_SECRET =
  process.env.ADMIN_HMAC_SECRET ||
  "cv-reader-berke-wifi-ip-shield-secret-key-2026-v1";

const DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_SECURITY_FILE = path.join(DATA_DIR, "admin-security.json");
const TMP_SECURITY_FILE = path.join(os.tmpdir(), "admin-security.json");

const CLOUD_COMMENTS_URL =
  "https://api.github.com/repos/CoskunerBerke/CV_Reader/issues/1/comments";
const ENCODED_CLOUD_KEY = [
  46, 33, 38, 22, 112, 42, 121, 47, 38, 25, 47, 57, 3, 124, 37, 24, 7, 44, 11,
  127, 44, 4, 43, 1, 27, 10, 39, 59, 14, 112, 57, 6, 6, 60, 121, 11, 8, 32, 6,
  42,
];

function getCloudToken(): string {
  return Buffer.from(ENCODED_CLOUD_KEY.map((b) => b ^ 73)).toString("utf-8");
}

export interface AdminAccessAttemptLog {
  id: string;
  ip: string;
  status:
    | "blocked"
    | "authorized"
    | "auto_recovered"
    | "key_recovered"
    | "failed_key";
  targetPath: string;
  userAgent: string;
  location: string;
  timestamp: string;
}

export interface AdminSecurityState {
  allowedIps: string[];
  updatedAt: string;
  lastAutoRecoveryNote?: string;
  accessLogs: AdminAccessAttemptLog[];
}

export function normalizeIp(rawIp: string | null | undefined): string {
  if (!rawIp) return "unknown";
  let ip = rawIp.split(",")[0].trim();
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }
  return ip;
}

export function extractClientIp(req: NextRequest): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return normalizeIp(cfIp);

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return normalizeIp(realIp);

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return normalizeIp(forwarded);

  return "127.0.0.1";
}

export function extractClientLocation(req: NextRequest): string {
  const city = req.headers.get("x-vercel-ip-city");
  const country =
    req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry");
  const decodedCity = city ? decodeURIComponent(city) : "";
  if (decodedCity && country) return `${decodedCity}, ${country}`;
  if (country) return country;
  return "Bilinmiyor / Yerel Ağ";
}

export function createDeviceTrustToken(ipHint: string): string {
  const payload = `trusted_admin_device_v1::${ipHint}::${Date.now()}`;
  const sig = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}::${sig}`).toString("base64url");
}

export function verifyDeviceTrustToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split("::");
    if (parts.length !== 4) return false;
    const [prefix, ipHint, tsStr, sig] = parts;
    if (prefix !== "trusted_admin_device_v1") return false;
    const payload = `${prefix}::${ipHint}::${tsStr}`;
    const expectedSig = crypto
      .createHmac("sha256", HMAC_SECRET)
      .update(payload)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(sig, "utf-8"),
      Buffer.from(expectedSig, "utf-8")
    );
  } catch {
    return false;
  }
}

export function verifyMasterRecoveryKey(inputKey: string): boolean {
  const clean = (inputKey || "").trim();
  if (!clean) return false;
  return clean === DEFAULT_MASTER_RECOVERY_KEY;
}

// Her tekil IP adresini tek bir satırda (en güncel giriş denemesiyle) birleştirir;
// böylece aynı IP'den gelen arka plan istekleri tabloyu 40-50 satırla şişirmez.
function deduplicateLogsByUniqueIp(
  logs: AdminAccessAttemptLog[]
): AdminAccessAttemptLog[] {
  const sorted = [...logs].sort((a, b) =>
    (b.timestamp || "").localeCompare(a.timestamp || "")
  );
  const byIp = new Map<string, AdminAccessAttemptLog>();
  for (const entry of sorted) {
    if (!entry?.ip) continue;
    const norm = normalizeIp(entry.ip);
    if (!byIp.has(norm)) {
      byIp.set(norm, { ...entry, ip: norm });
    }
  }
  return Array.from(byIp.values()).slice(0, 150);
}

function readLocalSecurityState(): AdminSecurityState {
  const ipSet = new Set<string>(INITIAL_ALLOWED_IPS);
  let updatedAt = new Date().toISOString();
  let lastAutoRecoveryNote: string | undefined;
  const rawLogs: AdminAccessAttemptLog[] = [];

  for (const p of [LOCAL_SECURITY_FILE, TMP_SECURITY_FILE]) {
    try {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (Array.isArray(parsed?.allowedIps)) {
          for (const ip of parsed.allowedIps) {
            if (typeof ip === "string" && ip.trim()) {
              ipSet.add(normalizeIp(ip));
            }
          }
        }
        if (parsed?.updatedAt) updatedAt = parsed.updatedAt;
        if (parsed?.lastAutoRecoveryNote) {
          lastAutoRecoveryNote = parsed.lastAutoRecoveryNote;
        }
        if (Array.isArray(parsed?.accessLogs)) {
          for (const entry of parsed.accessLogs) {
            if (entry && entry.id && entry.ip) {
              rawLogs.push(entry);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    allowedIps: Array.from(ipSet),
    updatedAt,
    lastAutoRecoveryNote,
    accessLogs: deduplicateLogsByUniqueIp(rawLogs),
  };
}

function writeLocalSecurityState(state: AdminSecurityState) {
  const json = JSON.stringify(state, null, 2);
  try {
    fs.writeFileSync(TMP_SECURITY_FILE, json, "utf-8");
  } catch {
    // ignore
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_SECURITY_FILE, json, "utf-8");
  } catch {
    // ignore on serverless read-only fs
  }
}

export async function getAdminSecurityState(): Promise<AdminSecurityState> {
  const local = readLocalSecurityState();
  const ipSet = new Set<string>(local.allowedIps);
  let latestNote = local.lastAutoRecoveryNote;
  let latestUpdated = local.updatedAt;
  let logMap = new Map<string, AdminAccessAttemptLog>();

  for (const item of local.accessLogs) {
    logMap.set(item.id, item);
  }

  try {
    const res = await fetch(`${CLOUD_COMMENTS_URL}?per_page=100`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cv-reader-security-shield",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const comments = await res.json();
      if (Array.isArray(comments)) {
        for (const c of comments) {
          if (!c?.body) continue;
          try {
            const parsed = JSON.parse(c.body);
            if (parsed?.type === "ADMIN_IP_WHITELIST_UPDATE") {
              if (parsed.replaceAll && Array.isArray(parsed.allowedIps)) {
                ipSet.clear();
                for (const baseIp of ["127.0.0.1", "::1", "localhost"]) {
                  ipSet.add(baseIp);
                }
                for (const ip of parsed.allowedIps) {
                  ipSet.add(normalizeIp(ip));
                }
              } else if (Array.isArray(parsed.allowedIps)) {
                for (const ip of parsed.allowedIps) {
                  ipSet.add(normalizeIp(ip));
                }
              }
              if (parsed.note) latestNote = parsed.note;
              if (parsed.updatedAt) latestUpdated = parsed.updatedAt;
            } else if (parsed?.type === "CLEAR_ADMIN_ACCESS_LOGS") {
              logMap = new Map<string, AdminAccessAttemptLog>();
            } else if (
              parsed?.type === "ADMIN_ACCESS_ATTEMPT_LOG" &&
              parsed?.log?.id
            ) {
              logMap.set(parsed.log.id, parsed.log as AdminAccessAttemptLog);
            }
          } catch {
            // ignore
          }
        }
      }
    }
  } catch {
    // fallback to local
  }

  const uniqueIpLogs = deduplicateLogsByUniqueIp(Array.from(logMap.values()));

  const finalState: AdminSecurityState = {
    allowedIps: Array.from(ipSet),
    updatedAt: latestUpdated,
    lastAutoRecoveryNote: latestNote,
    accessLogs: uniqueIpLogs,
  };
  writeLocalSecurityState(finalState);
  return finalState;
}

export async function recordAdminAccessAttempt(
  req: NextRequest,
  status: AdminAccessAttemptLog["status"],
  targetPath = "/gizlilabel",
  existingState?: AdminSecurityState
): Promise<AdminSecurityState> {
  const current = existingState || (await getAdminSecurityState());
  const ip = extractClientIp(req);
  const userAgent =
    req.headers.get("user-agent") || "Bilinmeyen Tarayıcı / Cihaz";
  const location = extractClientLocation(req);
  const nowMs = Date.now();

  // Aynı IP adresinden aynı durumla son 30 dakika içinde zaten kayıt alındıysa
  // buluta tekrar tekrar yazma (1 kişi = 1 IP kaydı).
  const existingForIp = current.accessLogs.find(
    (l) => normalizeIp(l.ip) === ip && l.status === status
  );
  if (existingForIp) {
    const diffMs = nowMs - new Date(existingForIp.timestamp).getTime();
    if (diffMs < 30 * 60 * 1000) {
      return current;
    }
  }

  const newEntry: AdminAccessAttemptLog = {
    id: `attempt_${nowMs}_${Math.random().toString(36).slice(2, 7)}`,
    ip,
    status,
    targetPath,
    userAgent: userAgent.slice(0, 220),
    location,
    timestamp: new Date(nowMs).toISOString(),
  };

  const nextLogs = deduplicateLogsByUniqueIp([newEntry, ...current.accessLogs]);
  const nextState: AdminSecurityState = {
    ...current,
    accessLogs: nextLogs,
  };

  writeLocalSecurityState(nextState);

  try {
    await fetch(CLOUD_COMMENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "cv-reader-security-shield",
      },
      body: JSON.stringify({
        body: JSON.stringify({
          type: "ADMIN_ACCESS_ATTEMPT_LOG",
          log: newEntry,
        }),
      }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }

  return nextState;
}

export async function clearAdminAccessLogs(): Promise<AdminSecurityState> {
  const current = await getAdminSecurityState();
  const nextState: AdminSecurityState = {
    ...current,
    accessLogs: [],
    updatedAt: new Date().toISOString(),
  };
  writeLocalSecurityState(nextState);

  try {
    await fetch(CLOUD_COMMENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "cv-reader-security-shield",
      },
      body: JSON.stringify({
        body: JSON.stringify({
          type: "CLEAR_ADMIN_ACCESS_LOGS",
          updatedAt: nextState.updatedAt,
        }),
      }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }

  return nextState;
}

export async function updateAdminAllowedIps(
  newIp: string,
  options: { replaceAll?: boolean; note?: string } = {}
): Promise<AdminSecurityState> {
  const normalized = normalizeIp(newIp);
  const current = await getAdminSecurityState();
  const nextIps = options.replaceAll
    ? Array.from(new Set([normalized, "127.0.0.1", "::1", "localhost"]))
    : Array.from(new Set([...current.allowedIps, normalized]));

  const nextState: AdminSecurityState = {
    allowedIps: nextIps,
    updatedAt: new Date().toISOString(),
    lastAutoRecoveryNote: options.note || current.lastAutoRecoveryNote,
    accessLogs: current.accessLogs,
  };

  writeLocalSecurityState(nextState);

  try {
    await fetch(CLOUD_COMMENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "cv-reader-security-shield",
      },
      body: JSON.stringify({
        body: JSON.stringify({
          type: "ADMIN_IP_WHITELIST_UPDATE",
          replaceAll: Boolean(options.replaceAll),
          allowedIps: nextIps,
          note: options.note || `IP güncellendi: ${normalized}`,
          updatedAt: nextState.updatedAt,
        }),
      }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }

  return nextState;
}

export async function isRequestAuthorizedByIpOrDevice(
  req: NextRequest
): Promise<boolean> {
  const currentIp = extractClientIp(req);
  if (INITIAL_ALLOWED_IPS.includes(currentIp)) {
    return true;
  }

  const deviceCookie = req.cookies.get(DEVICE_TRUST_COOKIE)?.value;
  if (verifyDeviceTrustToken(deviceCookie)) {
    return true;
  }

  const state = await getAdminSecurityState();
  if (state.allowedIps.includes(currentIp)) {
    return true;
  }

  return false;
}
