import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";
import {
  extractCandidateMetadataFromText,
  detectGenderFromCV,
  detectAgeFromCV,
  GenderType,
} from "@/lib/cvEngine";

export interface GroundTruthLabel {
  fileName: string;
  humanName?: string;
  humanGender: "Kadın" | "Erkek" | "Belirsiz";
  humanAge: number | null;
  updatedAt: string;
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

import os from "os";

const DATA_DIR = path.join(process.cwd(), "data");
const LABELS_FILE = path.join(DATA_DIR, "ground-truth-labels.json");
const TMP_LABELS_FILE = path.join(os.tmpdir(), "ground-truth-labels.json");
const TEXT_CACHE_FILE = path.join(DATA_DIR, "zip-rawtext-cache.json");
const LOCAL_ZIP_PATH = "C:\\Users\\berke\\OneDrive\\Masaüstü\\Yeni klasör.zip";

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Vercel read-only filesystem fallback
  }
}

function readSavedLabels(): Record<string, GroundTruthLabel> {
  let baseLabels: Record<string, GroundTruthLabel> = {};
  try {
    if (fs.existsSync(LABELS_FILE)) {
      baseLabels = JSON.parse(fs.readFileSync(LABELS_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }
  try {
    if (fs.existsSync(TMP_LABELS_FILE)) {
      const tmpLabels = JSON.parse(fs.readFileSync(TMP_LABELS_FILE, "utf-8"));
      baseLabels = { ...baseLabels, ...tmpLabels };
    }
  } catch {
    // ignore
  }
  return baseLabels;
}

function writeSavedLabels(labels: Record<string, GroundTruthLabel>) {
  // 1. Her zaman /tmp dizinine yaz (Vercel sunucusunda yazılabilir alan)
  try {
    fs.writeFileSync(TMP_LABELS_FILE, JSON.stringify(labels, null, 2), "utf-8");
  } catch {
    // ignore
  }
  // 2. Local geliştirme ortamındaysa doğrudan proje içindeki data/ground-truth-labels.json dosyasına da yaz
  try {
    ensureDataDir();
    fs.writeFileSync(LABELS_FILE, JSON.stringify(labels, null, 2), "utf-8");
  } catch {
    // Vercel read-only ortamında hata fırlatma
  }
}

async function getRawTextsFromZip(): Promise<{ fileName: string; rawText: string }[]> {
  ensureDataDir();
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
  fs.writeFileSync(TEXT_CACHE_FILE, JSON.stringify(items, null, 2), "utf-8");
  return items;
}

export async function GET() {
  try {
    const rawItems = await getRawTextsFromZip();
    const savedLabels = readSavedLabels();

    // Kullanıcı etiketlerinden öğrenilen isim->cinsiyet sözlüğü oluştur
    const learnedNameGenderMap: Record<string, "Kadın" | "Erkek"> = {};
    for (const lbl of Object.values(savedLabels)) {
      if (lbl.humanName && (lbl.humanGender === "Kadın" || lbl.humanGender === "Erkek")) {
        const firstWord = lbl.humanName.trim().split(/\s+/)[0]?.toLowerCase();
        if (firstWord && firstWord.length >= 2) {
          learnedNameGenderMap[firstWord] = lbl.humanGender;
        }
      }
    }

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

    return NextResponse.json({
      success: true,
      zipPath: LOCAL_ZIP_PATH,
      totalCount: items.length,
      items,
      learnedNameGenderMap,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, humanName, humanGender, humanAge, action } = body;

    const saved = readSavedLabels();

    if (action === "clear_all") {
      writeSavedLabels({});
      return NextResponse.json({ success: true, labels: {} });
    }

    if (action === "delete" && fileName) {
      delete saved[fileName];
      writeSavedLabels(saved);
      return NextResponse.json({ success: true, labels: saved });
    }

    if (!fileName || !humanGender) {
      return NextResponse.json(
        { error: "fileName ve humanGender zorunludur." },
        { status: 400 }
      );
    }

    saved[fileName] = {
      fileName,
      humanName: humanName || "",
      humanGender,
      humanAge:
        humanAge === null || humanAge === "" || Number.isNaN(Number(humanAge))
          ? null
          : Number(humanAge),
      updatedAt: new Date().toISOString(),
    };

    writeSavedLabels(saved);

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
