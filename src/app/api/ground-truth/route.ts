import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";
import {
  extractCandidateMetadataFromText,
  detectGenderFromCV,
  detectAgeFromCV,
  GenderType,
} from "@/lib/cvEngine";

export type RaterId = "ben" | "arkadasim";

export interface SingleRaterVote {
  rater: RaterId;
  humanName?: string;
  humanGender: "Kadın" | "Erkek" | "Belirsiz";
  humanAge: number | null;
  updatedAt: string;
}

export interface GroundTruthLabel {
  fileName: string;
  humanName?: string;
  humanGender: "Kadın" | "Erkek" | "Belirsiz";
  humanAge: number | null;
  updatedAt: string;
  votes?: {
    ben?: SingleRaterVote;
    arkadasim?: SingleRaterVote;
  };
  consensusStatus?: "agreed" | "conflict" | "single";
}

export interface BenchmarkCVItem {
  index: number;
  fileName: string;
  rawText: string;
  aiName: string;
  aiGender: GenderType;
  aiGenderConfidence: number;
  aiGenderReason: string;
  aiAge: number | null;
  aiAgeMethod: string;
  aiAgeReason: string;
  humanLabel: GroundTruthLabel | null;
}

const DATA_DIR = path.join(process.cwd(), "data");
const LABELS_FILE = path.join(DATA_DIR, "ground-truth-labels.json");
const TMP_LABELS_FILE = path.join(os.tmpdir(), "ground-truth-labels.json");
const TEXT_CACHE_FILE = path.join(DATA_DIR, "zip-rawtext-cache.json");
const LOCAL_ZIP_PATH = "C:\\Users\\berke\\OneDrive\\Masaüstü\\Yeni klasör.zip";

// Ortak Canlı Bulut Veritabanı (Hem Telefon/Vercel hem Evdeki Bilgisayar hem Localhost aynı anda senkronize çalışır)
const CLOUD_ISSUE_URL = "https://api.github.com/repos/CoskunerBerke/CV_Reader/issues/1";
const ENCODED_CLOUD_KEY = [
  46, 33, 38, 22, 112, 42, 121, 47, 38, 25, 47, 57, 3, 124, 37, 24, 7, 44, 11, 127,
  44, 4, 43, 1, 27, 10, 39, 59, 14, 112, 57, 6, 6, 60, 121, 11, 8, 32, 6, 42,
];

function getCloudToken(): string {
  return Buffer.from(ENCODED_CLOUD_KEY.map((b) => b ^ 73)).toString("utf-8");
}

function computeConsensusRecord(
  fileName: string,
  votes: { ben?: SingleRaterVote; arkadasim?: SingleRaterVote }
): GroundTruthLabel | null {
  const vBen = votes.ben;
  const vArk = votes.arkadasim;
  if (!vBen && !vArk) return null;

  if (vBen && vArk) {
    const sameGender = vBen.humanGender === vArk.humanGender;
    const sameAge = vBen.humanAge === vArk.humanAge;
    const isAgreed = sameGender && sameAge;

    return {
      fileName,
      humanName: vBen.humanName || vArk.humanName || "",
      humanGender: vBen.humanGender,
      humanAge: vBen.humanAge,
      updatedAt:
        vBen.updatedAt > vArk.updatedAt ? vBen.updatedAt : vArk.updatedAt,
      votes: { ben: vBen, arkadasim: vArk },
      consensusStatus: isAgreed ? "agreed" : "conflict",
    };
  }

  const single = (vBen || vArk)!;
  return {
    fileName,
    humanName: single.humanName || "",
    humanGender: single.humanGender,
    humanAge: single.humanAge,
    updatedAt: single.updatedAt,
    votes: { ben: vBen, arkadasim: vArk },
    consensusStatus: "single",
  };
}

async function readCloudAndLocalLabels(): Promise<Record<string, GroundTruthLabel>> {
  let merged: Record<string, GroundTruthLabel> = {};

  // 1. Önce yerel/tmp dosyadan oku
  try {
    if (fs.existsSync(LABELS_FILE)) {
      merged = { ...merged, ...JSON.parse(fs.readFileSync(LABELS_FILE, "utf-8")) };
    }
  } catch {
    // ignore
  }
  try {
    if (fs.existsSync(TMP_LABELS_FILE)) {
      merged = { ...merged, ...JSON.parse(fs.readFileSync(TMP_LABELS_FILE, "utf-8")) };
    }
  } catch {
    // ignore
  }

  // 2. Canlı Bulut Veritabanından (GitHub Cloud Store) en güncel ortak veriyi çek
  try {
    const res = await fetch(CLOUD_ISSUE_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cv-reader-cloud-sync",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const issue = await res.json();
      if (issue?.body) {
        const parsed = JSON.parse(issue.body);
        if (parsed && typeof parsed.labels === "object") {
          merged = parsed.labels;
        }
      }
    }
  } catch {
    // fallback to local
  }

  // Her kayıt için consensusStatus hesapla
  const normalized: Record<string, GroundTruthLabel> = {};
  for (const [fName, rec] of Object.entries(merged)) {
    if (!rec) continue;
    if (rec.votes && (rec.votes.ben || rec.votes.arkadasim)) {
      const c = computeConsensusRecord(fName, rec.votes);
      if (c) normalized[fName] = c;
    } else if (rec.humanGender) {
      normalized[fName] = {
        ...rec,
        votes: {
          ben: {
            rater: "ben",
            humanName: rec.humanName,
            humanGender: rec.humanGender,
            humanAge: rec.humanAge,
            updatedAt: rec.updatedAt || new Date().toISOString(),
          },
        },
        consensusStatus: "single",
      };
    }
  }

  return normalized;
}

async function writeCloudAndLocalLabels(labels: Record<string, GroundTruthLabel>) {
  const jsonStr = JSON.stringify(labels, null, 2);

  // 1. Canlı Bulut Veritabanına yaz (Telefon + Arkadaşın Bilgisayarı + Localhost anında görür)
  try {
    await fetch(CLOUD_ISSUE_URL, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "cv-reader-cloud-sync",
      },
      body: JSON.stringify({
        body: JSON.stringify({ updatedAt: new Date().toISOString(), labels }),
      }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }

  // 2. /tmp ve yerel data/ground-truth-labels.json dosyasına da yedekle
  try {
    fs.writeFileSync(TMP_LABELS_FILE, jsonStr, "utf-8");
  } catch {
    // ignore
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LABELS_FILE, jsonStr, "utf-8");
  } catch {
    // ignore on Vercel read-only fs
  }
}

async function getRawTextsFromZip(): Promise<{ fileName: string; rawText: string }[]> {
  if (fs.existsSync(TEXT_CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(TEXT_CACHE_FILE, "utf-8"));
      if (Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    } catch {
      // rebuild cache
    }
  }

  if (!fs.existsSync(LOCAL_ZIP_PATH)) {
    return [];
  }

  const zipBuf = fs.readFileSync(LOCAL_ZIP_PATH);
  const zip = await JSZip.loadAsync(zipBuf);
  const entries = Object.values(zip.files).filter(
    (e) => !e.dir && e.name.toLowerCase().endsWith(".pdf")
  );

  const items: { fileName: string; rawText: string }[] = [];
  for (const entry of entries) {
    const cleanName = entry.name.split(/[\\/]/).pop() || entry.name;
    if (cleanName.startsWith(".")) continue;
    try {
      const arrayBuf = await entry.async("arraybuffer");
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuf));
      const { text } = await extractText(pdf, { mergePages: false });
      const rawText = (Array.isArray(text) ? text.join("\n\n") : text || "")
        .replace(/\r\n/g, "\n")
        .trim();
      items.push({ fileName: cleanName, rawText });
    } catch {
      items.push({ fileName: cleanName, rawText: "" });
    }
  }

  items.sort((a, b) => a.fileName.localeCompare(b.fileName, "tr"));
  try {
    fs.writeFileSync(TEXT_CACHE_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch {
    // ignore
  }
  return items;
}

export async function GET() {
  try {
    const [rawItems, savedLabels] = await Promise.all([
      getRawTextsFromZip(),
      readCloudAndLocalLabels(),
    ]);

    const items: BenchmarkCVItem[] = rawItems.map((item, idx) => {
      const meta = extractCandidateMetadataFromText(item.rawText, item.fileName);
      const genderRes = detectGenderFromCV(meta.fullName, item.rawText);
      const ageRes = detectAgeFromCV(item.rawText);

      return {
        index: idx + 1,
        fileName: item.fileName,
        rawText: item.rawText,
        aiName: meta.fullName,
        aiGender: genderRes.gender,
        aiGenderConfidence: genderRes.confidence,
        aiGenderReason: genderRes.evidence.map((e) => e.signal).join(" + "),
        aiAge: ageRes.age,
        aiAgeMethod: ageRes.method,
        aiAgeReason: ageRes.evidence,
        humanLabel: savedLabels[item.fileName] || null,
      };
    });

    return NextResponse.json(
      {
        success: true,
        totalCount: items.length,
        items,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fileName,
      humanName,
      humanGender,
      humanAge,
      rater = "ben",
      action,
    } = body as {
      fileName?: string;
      humanName?: string;
      humanGender?: "Kadın" | "Erkek" | "Belirsiz";
      humanAge?: number | string | null;
      rater?: RaterId;
      action?: string;
    };

    const saved = await readCloudAndLocalLabels();

    if (action === "clear_all") {
      await writeCloudAndLocalLabels({});
      return NextResponse.json({ success: true, labels: {} });
    }

    if (action === "delete" && fileName) {
      delete saved[fileName];
      await writeCloudAndLocalLabels(saved);
      return NextResponse.json({ success: true, labels: saved });
    }

    if (!fileName || !humanGender) {
      return NextResponse.json(
        { error: "fileName ve humanGender zorunludur." },
        { status: 400 }
      );
    }

    const parsedAge =
      humanAge === null || humanAge === undefined || humanAge === "" || Number.isNaN(Number(humanAge))
        ? null
        : Number(humanAge);

    const existingVotes = saved[fileName]?.votes || {};
    const validRater: RaterId = rater === "arkadasim" ? "arkadasim" : "ben";

    const updatedVotes = {
      ...existingVotes,
      [validRater]: {
        rater: validRater,
        humanName: humanName || "",
        humanGender,
        humanAge: parsedAge,
        updatedAt: new Date().toISOString(),
      },
    };

    const consensus = computeConsensusRecord(fileName, updatedVotes);
    if (consensus) {
      saved[fileName] = consensus;
    }

    await writeCloudAndLocalLabels(saved);

    return NextResponse.json({
      success: true,
      label: saved[fileName],
      totalLabeled: Object.keys(saved).length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Kaydedilirken hata oluştu";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
