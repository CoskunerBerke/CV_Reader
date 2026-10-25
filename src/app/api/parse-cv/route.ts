import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { extractCandidateMetadataFromText } from "@/lib/cvEngine";

function parseHtmlToCleanText(html: string): string {
  return html
    // Remove script, style, svg, noscript, head blocks completely
    .replace(/<(script|style|svg|noscript|head)[^>]*>[\s\S]*?<\/\1>/gi, "\n")
    // Convert table cells/headers to pipe separators on the same line
    .replace(/<\/?(?:td|th)[^>]*>/gi, " | ")
    // Convert block-level closing tags and breaks to newlines
    .replace(/<\/?(?:br|p|div|li|tr|h[1-6]|section|article|header|footer|blockquote|dd|dt)[^>]*>/gi, "\n")
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, " ")
    // Decode HTML entities including arrows and dashes
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
    // Clean up excessive spaces and empty lines
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\|\s*/g, "\n")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
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
        { error: "Lütfen en az bir CV dosyası (.pdf, .docx, .html, .txt) seçin." },
        { status: 400 }
      );
    }

    const parsedResults = [];

    for (const file of files) {
      const fileName = file.name || "cv.pdf";
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const arrayBuffer = await file.arrayBuffer();
      let extractedText = "";

      if (ext === "pdf") {
        const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
        const { text } = await extractText(pdf, { mergePages: true });
        extractedText = Array.isArray(text) ? text.join("\n") : text || "";
      } else if (ext === "docx" || ext === "doc") {
        const result = await mammoth.extractRawText({
          buffer: Buffer.from(arrayBuffer),
        });
        extractedText = result.value || "";
      } else if (ext === "html" || ext === "htm") {
        const rawHtml = new TextDecoder("utf-8").decode(arrayBuffer);
        extractedText = parseHtmlToCleanText(rawHtml);
      } else {
        // .txt, .md, .csv, vb.
        extractedText = new TextDecoder("utf-8").decode(arrayBuffer);
      }

      const cleanText = extractedText.replace(/\r\n/g, "\n").trim();
      const meta = extractCandidateMetadataFromText(cleanText, fileName);

      parsedResults.push({
        fileName,
        rawText: cleanText,
        fullName: meta.fullName,
        university: meta.university,
        city: meta.city,
        experienceYears: meta.experienceYears,
      });
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
