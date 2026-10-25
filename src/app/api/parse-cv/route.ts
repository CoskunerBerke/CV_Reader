import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import JSZip from "jszip";
import { extractCandidateMetadataFromText } from "@/lib/cvEngine";

function parseHtmlToCleanText(html: string): string {
  return html
    .replace(/<(script|style|svg|noscript|head)[^>]*>[\s\S]*?<\/\1>/gi, "\n")
    .replace(/<\/?(?:td|th)[^>]*>/gi, " | ")
    .replace(/<\/?(?:br|p|div|li|tr|h[1-6]|section|article|header|footer|blockquote|dd|dt)[^>]*>/gi, "\n")
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

async function parseSingleBuffer(
  fileName: string,
  arrayBuffer: ArrayBuffer
): Promise<{
  fileName: string;
  rawText: string;
  fullName: string;
  university: string;
  city: string;
  experienceYears: number;
} | null> {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // Ignore non-CV helper files inside zip archives (e.g. readme.txt, sonuclar.json, .DS_Store)
  const lowerBase = fileName.toLowerCase();
  if (
    lowerBase.includes("readme") ||
    lowerBase.includes("sonuclar") ||
    lowerBase.includes("__macosx") ||
    ext === "json"
  ) {
    return null;
  }

  let extractedText = "";

  if (ext === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const { text } = await extractText(pdf, { mergePages: false });
    extractedText = Array.isArray(text) ? text.join("\n\n") : text || "";
  } else if (ext === "docx" || ext === "doc") {
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(arrayBuffer),
    });
    extractedText = result.value || "";
  } else if (ext === "html" || ext === "htm") {
    const rawHtml = new TextDecoder("utf-8").decode(arrayBuffer);
    extractedText = parseHtmlToCleanText(rawHtml);
  } else if (ext === "txt" || ext === "md") {
    extractedText = new TextDecoder("utf-8").decode(arrayBuffer);
  } else {
    return null;
  }

  const cleanText = extractedText.replace(/\r\n/g, "\n").trim();
  const meta = extractCandidateMetadataFromText(cleanText, fileName);

  return {
    fileName,
    rawText: cleanText,
    fullName: meta.fullName,
    university: meta.university,
    city: meta.city,
    experienceYears: meta.experienceYears,
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
        { error: "Lütfen en az bir CV dosyası (.pdf, .docx, .html, .zip, .txt) seçin." },
        { status: 400 }
      );
    }

    const parsedResults = [];

    for (const file of files) {
      const fileName = file.name || "cv.pdf";
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const arrayBuffer = await file.arrayBuffer();

      if (ext === "zip") {
        // ZIP arşivinin içindeki tüm PDF / DOCX / HTML CV'leri otomatik çıkar!
        const zip = await JSZip.loadAsync(arrayBuffer);
        const entries = Object.values(zip.files).filter((e) => !e.dir);
        for (const entry of entries) {
          const cleanEntryName = entry.name.split("/").pop() || entry.name;
          if (cleanEntryName.startsWith(".")) continue;
          const entryBuf = await entry.async("arraybuffer");
          const parsed = await parseSingleBuffer(cleanEntryName, entryBuf);
          if (parsed) {
            parsedResults.push(parsed);
          }
        }
      } else {
        const parsed = await parseSingleBuffer(fileName, arrayBuffer);
        if (parsed) {
          parsedResults.push(parsed);
        }
      }
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
