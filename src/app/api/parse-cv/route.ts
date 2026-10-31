import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import JSZip from "jszip";
import { createExtractorFromData } from "node-unrar-js";
import { extractCandidateMetadataFromText } from "@/lib/cvEngine";
import {
  appendUploadedCVsToVault,
  saveRawUploadedBufferLocally,
} from "@/lib/cvVault";

type GroundTruthRecord = {
  humanName?: string;
  humanGender: "Kadın" | "Erkek" | "Belirsiz";
  humanAge: number | null;
  humanUniversity?: string | null;
  humanDepartment?: string | null;
  humanDegree?: string | null;
};

function getGroundTruthLabels(): Record<string, GroundTruthRecord> {
  let merged: Record<string, GroundTruthRecord> = {};
  try {
    const p = path.join(process.cwd(), "data", "ground-truth-labels.json");
    if (fs.existsSync(p)) {
      merged = { ...merged, ...JSON.parse(fs.readFileSync(p, "utf-8")) };
    }
  } catch {
    // ignore
  }
  try {
    const tmpP = path.join(os.tmpdir(), "ground-truth-labels.json");
    if (fs.existsSync(tmpP)) {
      merged = { ...merged, ...JSON.parse(fs.readFileSync(tmpP, "utf-8")) };
    }
  } catch {
    // ignore
  }
  return merged;
}

function decodeBufferSmart(arrayBuffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
  if (utf8.includes("\uFFFD")) {
    try {
      return new TextDecoder("windows-1254", { fatal: false }).decode(
        arrayBuffer
      );
    } catch {
      return utf8;
    }
  }
  return utf8;
}

function parseHtmlToCleanText(html: string): string {
  return html
    .replace(/<(script|style|svg|noscript|head)[^>]*>[\s\S]*?<\/\1>/gi, "\n")
    .replace(/<\/?(?:td|th)[^>]*>/gi, " | ")
    .replace(
      /<\/?(?:br|p|div|li|tr|h[1-6]|section|article|header|footer|blockquote|dd|dt)[^>]*>/gi,
      "\n"
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/&rarr;|&rightarrow;/gi, " -> ")
    .replace(/&ndash;|&mdash;/gi, " - ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&copy;/gi, "(c)")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\|\s*/g, "\n")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function parseRtfToCleanText(rtf: string): string {
  return rtf
    .replace(/\\par\b|\\line\b/gi, "\n")
    .replace(/\\tab\b/gi, " ")
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
      const code = parseInt(hex, 16);
      const trMap: Record<number, string> = {
        0xd0: "Ğ",
        0xf0: "ğ",
        0xdd: "İ",
        0xfd: "ı",
        0xde: "Ş",
        0xfe: "ş",
        0xc7: "Ç",
        0xe7: "ç",
        0xd6: "Ö",
        0xf6: "ö",
        0xdc: "Ü",
        0xfc: "ü",
      };
      return trMap[code] || String.fromCharCode(code);
    })
    .replace(/\\u(-?\d+)\??/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return String.fromCharCode(code < 0 ? code + 65536 : code);
    })
    .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|pict)[\s\S]*?\}/gi, " ")
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function resolveArchiveEntryDisplayName(entryPath: string): string {
  const parts = entryPath.split(/[\\/]/).filter(Boolean);
  const baseName = parts[parts.length - 1] || entryPath;
  const stem = baseName.replace(/\.[a-zA-Z0-9]+$/, "").trim();
  const isGenericBase =
    /^(?:cv|resume|ozgecmis|özgeçmiş|belge|document|file|scan|untitled|1|2|3)$/i.test(
      stem
    );
  if (isGenericBase && parts.length >= 2) {
    const parentFolder = parts[parts.length - 2];
    if (
      parentFolder &&
      !/^(?:cv|cvs|resumes|ozgecmisler|özgeçmişler|adaylar|candidates|files|folder|yeni\s*klasör)$/i.test(
        parentFolder
      )
    ) {
      return `${parentFolder} - ${baseName}`;
    }
  }
  return baseName;
}

async function parseSingleBuffer(
  fileName: string,
  arrayBuffer: ArrayBuffer,
  labels: Record<string, GroundTruthRecord>
): Promise<{
  fileName: string;
  rawText: string;
  fullName: string;
  university: string;
  city: string;
  experienceYears: number;
  hasHumanLabel?: boolean;
  humanGender?: "Kadın" | "Erkek" | "Belirsiz" | null;
  humanAge?: number | null;
  humanUniversity?: string | null;
  humanDepartment?: string | null;
  humanDegree?: string | null;
} | null> {
  const baseOnly = fileName.split(/[\\/]/).pop() || fileName;
  const ext = baseOnly.split(".").pop()?.toLowerCase() || "";

  // Ignore non-CV helper files inside zip archives (e.g. readme.txt, sonuclar.json, .DS_Store, ~$temp.docx)
  const lowerBase = baseOnly.toLowerCase();
  if (
    lowerBase.startsWith("~$") ||
    lowerBase.startsWith(".") ||
    lowerBase.includes("readme") ||
    lowerBase.includes("sonuclar") ||
    lowerBase.includes("__macosx") ||
    lowerBase === "desktop.ini" ||
    lowerBase === "thumbs.db" ||
    ext === "json"
  ) {
    return null;
  }

  let extractedText = "";

  if (ext === "pdf") {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
      try {
        const { text } = await extractText(pdf, { mergePages: false });
        extractedText = Array.isArray(text) ? text.join("\n\n") : text || "";
      } finally {
        try {
          await (
            pdf as unknown as { destroy?: () => Promise<void> }
          ).destroy?.();
        } catch {
          // ignore cleanup error
        }
      }
    } catch {
      extractedText = "";
    }
  } else if (ext === "docx" || ext === "doc") {
    try {
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(arrayBuffer),
      });
      extractedText = result.value || "";
    } catch {
      extractedText = decodeBufferSmart(arrayBuffer).replace(
        /[^\x20-\x7E\xA0-\uFFFF\r\n]/g,
        " "
      );
    }
  } else if (ext === "html" || ext === "htm") {
    const rawHtml = decodeBufferSmart(arrayBuffer);
    extractedText = parseHtmlToCleanText(rawHtml);
  } else if (ext === "rtf") {
    const rawRtf = decodeBufferSmart(arrayBuffer);
    extractedText = parseRtfToCleanText(rawRtf);
  } else if (ext === "txt" || ext === "md") {
    extractedText = decodeBufferSmart(arrayBuffer);
  } else {
    return null;
  }

  const cleanText = extractedText.replace(/\r\n/g, "\n").trim();
  saveRawUploadedBufferLocally(fileName, Buffer.from(arrayBuffer));
  const meta = extractCandidateMetadataFromText(cleanText, fileName, false);
  const matchedLabel = labels[fileName] || labels[baseOnly] || null;

  return {
    fileName,
    rawText: cleanText,
    fullName: matchedLabel?.humanName || meta.fullName,
    university: meta.university,
    city: meta.city,
    experienceYears: meta.experienceYears,
    hasHumanLabel: !!matchedLabel,
    humanGender: matchedLabel?.humanGender || null,
    humanAge: matchedLabel !== null ? matchedLabel.humanAge : undefined,
    humanUniversity: matchedLabel?.humanUniversity || null,
    humanDepartment: matchedLabel?.humanDepartment || null,
    humanDegree: matchedLabel?.humanDegree || null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      const singleFile = formData.get("file") as File | null;
      if (singleFile) files.push(singleFile);
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          error:
            "Lütfen en az bir CV dosyası (.pdf, .docx, .html, .zip, .rar, .txt) seçin.",
        },
        { status: 400 }
      );
    }

    // Load ground-truth labels ONCE per batch request (not per file)
    const labels = getGroundTruthLabels();
    const parsedResults = [];

    for (const file of files) {
      try {
        const fileName = file.name || "cv.pdf";
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        const arrayBuffer = await file.arrayBuffer();

        if (ext === "zip") {
          const zip = await JSZip.loadAsync(arrayBuffer);
          const entries = Object.values(zip.files).filter((e) => !e.dir);
          for (const entry of entries) {
            try {
              const rawBase = entry.name.split(/[\\/]/).pop() || entry.name;
              if (rawBase.startsWith(".") || rawBase.startsWith("~$")) continue;
              const displayEntryName = resolveArchiveEntryDisplayName(
                entry.name
              );
              const entryBuf = await entry.async("arraybuffer");
              const parsed = await parseSingleBuffer(
                displayEntryName,
                entryBuf,
                labels
              );
              if (parsed) {
                parsedResults.push(parsed);
              }
            } catch {
              // Tekil arşiv dosyası okunamazsa diğerlerine devam et
            }
          }
        } else if (ext === "rar") {
          const extractor = await createExtractorFromData({
            data: arrayBuffer,
          });
          const extracted = extractor.extract();
          for (const item of extracted.files) {
            try {
              if (item.fileHeader.flags.directory || !item.extraction) continue;
              const rawBase =
                item.fileHeader.name.split(/[\\/]/).pop() ||
                item.fileHeader.name;
              if (rawBase.startsWith(".") || rawBase.startsWith("~$")) continue;
              const displayEntryName = resolveArchiveEntryDisplayName(
                item.fileHeader.name
              );
              const entryBuf = item.extraction.buffer.slice(
                item.extraction.byteOffset,
                item.extraction.byteOffset + item.extraction.byteLength
              ) as ArrayBuffer;
              const parsed = await parseSingleBuffer(
                displayEntryName,
                entryBuf,
                labels
              );
              if (parsed) {
                parsedResults.push(parsed);
              }
            } catch {
              // Tekil arşiv dosyası okunamazsa diğerlerine devam et
            }
          }
        } else {
          const parsed = await parseSingleBuffer(fileName, arrayBuffer, labels);
          if (parsed) {
            parsedResults.push(parsed);
          }
        }
      } catch {
        // Dosya okunamazsa diğer dosyalara devam et
      }
    }

    if (parsedResults.length > 0) {
      const clientHint = req.headers.get("user-agent") || undefined;
      await appendUploadedCVsToVault(
        parsedResults.map((p) => ({
          fileName: p.fileName,
          rawText: p.rawText,
        })),
        clientHint
      );
    }

    return NextResponse.json({
      success: true,
      files: parsedResults,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Dosya okunurken hata oluştu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
