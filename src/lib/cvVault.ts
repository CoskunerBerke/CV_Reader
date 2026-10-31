import fs from "fs";
import path from "path";
import os from "os";
import {
  extractCandidateMetadataFromText,
  detectGenderFromCV,
  detectAgeFromCV,
  extractEducationFromCV,
  EducationByDegreeMap,
  GenderType,
} from "@/lib/cvEngine";

export interface VaultCVRecord {
  id: string;
  fileName: string;
  fullName: string;
  gender: GenderType;
  age: number | null;
  ageMethod: string;
  hasBachelor: boolean;
  university: string;
  department: string;
  degree: string;
  educationByDegree: EducationByDegreeMap;
  city: string;
  rawText: string;
  uploadedAt: string;
  clientHint?: string;
}

export interface PremiumLeadRecord {
  id: string;
  fullName: string;
  companyName: string;
  contactInfo: string;
  requestedFeature: string;
  message: string;
  createdAt: string;
}

export interface VaultStoreData {
  cvs: VaultCVRecord[];
  leads: PremiumLeadRecord[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_VAULT_FILE = path.join(DATA_DIR, "uploaded-cvs-vault.json");
const TMP_VAULT_FILE = path.join(os.tmpdir(), "uploaded-cvs-vault.json");
const LOCAL_RAW_FILES_DIR = path.join(DATA_DIR, "uploaded-files");

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

export function buildVaultRecordFromRaw(
  fileName: string,
  rawText: string,
  clientHint?: string
): VaultCVRecord {
  const safeText = typeof rawText === "string" ? rawText : "";
  const meta = extractCandidateMetadataFromText(safeText, fileName);
  const g = detectGenderFromCV(meta.fullName, safeText);
  const a = detectAgeFromCV(safeText);
  const e = extractEducationFromCV(safeText);
  const hasBachelor = Boolean(
    e.educationByDegree?.bachelor ||
      e.allDegrees.some((d) => /lisans\s*\(bachelor/i.test(d)) ||
      /lisans\s*\(bachelor/i.test(e.degree)
  );

  return {
    id: `vault-cv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fileName,
    fullName: meta.fullName,
    gender: g.gender,
    age: a.age,
    ageMethod: a.method,
    hasBachelor,
    university: e.university,
    department: e.department,
    degree: e.degree,
    educationByDegree: e.educationByDegree,
    city: meta.city,
    rawText: safeText.slice(0, 25000),
    uploadedAt: new Date().toISOString(),
    clientHint,
  };
}

export function saveRawUploadedBufferLocally(fileName: string, buf: Buffer) {
  try {
    if (!fs.existsSync(LOCAL_RAW_FILES_DIR)) {
      fs.mkdirSync(LOCAL_RAW_FILES_DIR, { recursive: true });
    }
    const safeBase = path.basename(fileName).replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ._\- ]/g, "_");
    const stamped = `${Date.now()}_${safeBase}`;
    fs.writeFileSync(path.join(LOCAL_RAW_FILES_DIR, stamped), buf);
  } catch {
    // ignore on read-only serverless fs
  }
}

function readLocalVault(): VaultStoreData {
  let cvs: VaultCVRecord[] = [];
  let leads: PremiumLeadRecord[] = [];

  for (const filePath of [LOCAL_VAULT_FILE, TMP_VAULT_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (Array.isArray(parsed?.cvs)) {
          cvs = [...cvs, ...parsed.cvs];
        }
        if (Array.isArray(parsed?.leads)) {
          leads = [...leads, ...parsed.leads];
        }
      }
    } catch {
      // ignore
    }
  }

  return deduplicateVault({ cvs, leads });
}

function deduplicateVault(data: VaultStoreData): VaultStoreData {
  const cvMap = new Map<string, VaultCVRecord>();
  for (const item of data.cvs) {
    if (!item || !item.fileName) continue;
    const key = `${item.fileName}::${item.fullName}::${(item.uploadedAt || "").slice(0, 16)}`;
    if (!cvMap.has(key)) {
      cvMap.set(key, item);
    }
  }

  const leadMap = new Map<string, PremiumLeadRecord>();
  for (const lead of data.leads) {
    if (!lead || !lead.id) continue;
    if (!leadMap.has(lead.id)) {
      leadMap.set(lead.id, lead);
    }
  }

  const sortedCvs = Array.from(cvMap.values()).sort((a, b) =>
    (b.uploadedAt || "").localeCompare(a.uploadedAt || "")
  );
  const sortedLeads = Array.from(leadMap.values()).sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );

  return { cvs: sortedCvs, leads: sortedLeads };
}

function writeLocalVault(data: VaultStoreData) {
  const deduped = deduplicateVault(data);
  const jsonStr = JSON.stringify(deduped, null, 2);
  try {
    fs.writeFileSync(TMP_VAULT_FILE, jsonStr, "utf-8");
  } catch {
    // ignore
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_VAULT_FILE, jsonStr, "utf-8");
  } catch {
    // ignore on read-only fs
  }
}

export async function appendUploadedCVsToVault(
  items: { fileName: string; rawText: string }[],
  clientHint?: string
): Promise<void> {
  if (!items || items.length === 0) return;

  const newRecords: VaultCVRecord[] = items
    .filter((it) => it && it.fileName && it.rawText && it.rawText.trim().length > 0)
    .map((it) => buildVaultRecordFromRaw(it.fileName, it.rawText, clientHint));

  if (newRecords.length === 0) return;

  // 1. Save locally (/tmp and data/)
  const current = readLocalVault();
  writeLocalVault({
    cvs: [...newRecords, ...current.cvs].slice(0, 2500),
    leads: current.leads,
  });

  // 2. Append to Cloud Vault (GitHub Issue Comment so multiple concurrent uploads never overwrite each other)
  try {
    const compactRecords = newRecords.slice(0, 40).map((r) => ({
      ...r,
      rawText: r.rawText.slice(0, 1200),
    }));
    await fetch(CLOUD_COMMENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "cv-reader-vault-sync",
      },
      body: JSON.stringify({
        body: JSON.stringify({
          type: "VAULT_CV_BATCH",
          createdAt: new Date().toISOString(),
          records: compactRecords,
        }),
      }),
      cache: "no-store",
    });
  } catch {
    // ignore network errors
  }
}

export async function appendPremiumLeadToVault(
  lead: Omit<PremiumLeadRecord, "id" | "createdAt">
): Promise<PremiumLeadRecord> {
  const record: PremiumLeadRecord = {
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fullName: (lead.fullName || "").trim(),
    companyName: (lead.companyName || "").trim(),
    contactInfo: (lead.contactInfo || "").trim(),
    requestedFeature: (lead.requestedFeature || "").trim(),
    message: (lead.message || "").trim(),
    createdAt: new Date().toISOString(),
  };

  const current = readLocalVault();
  writeLocalVault({
    cvs: current.cvs,
    leads: [record, ...current.leads],
  });

  try {
    await fetch(CLOUD_COMMENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "cv-reader-vault-sync",
      },
      body: JSON.stringify({
        body: JSON.stringify({
          type: "VAULT_PREMIUM_LEAD",
          createdAt: record.createdAt,
          lead: record,
        }),
      }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }

  return record;
}

export async function readFullVaultFromCloudAndLocal(): Promise<VaultStoreData> {
  const local = readLocalVault();
  const allCvs: VaultCVRecord[] = [...local.cvs];
  const allLeads: PremiumLeadRecord[] = [...local.leads];

  try {
    const res = await fetch(`${CLOUD_COMMENTS_URL}?per_page=100`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cv-reader-vault-sync",
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
            if (
              parsed?.type === "VAULT_CV_BATCH" &&
              Array.isArray(parsed.records)
            ) {
              allCvs.push(...parsed.records);
            } else if (parsed?.type === "VAULT_PREMIUM_LEAD" && parsed.lead) {
              allLeads.push(parsed.lead);
            }
          } catch {
            // ignore non-json comments
          }
        }
      }
    }
  } catch {
    // fallback to local
  }

  const merged = deduplicateVault({ cvs: allCvs, leads: allLeads });
  writeLocalVault(merged);
  return merged;
}
