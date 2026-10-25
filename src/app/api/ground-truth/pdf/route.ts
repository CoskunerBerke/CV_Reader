import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

const LOCAL_ZIP_PATH = "C:\\Users\\berke\\OneDrive\\Masaüstü\\Yeni klasör.zip";

export async function GET(req: NextRequest) {
  try {
    const fileName = req.nextUrl.searchParams.get("file");
    if (!fileName) {
      return new NextResponse("Missing file parameter", { status: 400 });
    }

    // 1. Önce repo içindeki public/cvs/ klasöründen oku (Hem Vercel'de hem Local'de çalışır!)
    const publicPdfPath = path.join(process.cwd(), "public", "cvs", path.basename(fileName));
    if (fs.existsSync(publicPdfPath)) {
      const pdfBuf = fs.readFileSync(publicPdfPath);
      return new NextResponse(pdfBuf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // 2. Yedek: Local ZIP dosyasından oku
    if (!fs.existsSync(LOCAL_ZIP_PATH)) {
      return new NextResponse("PDF file not found", { status: 404 });
    }

    const zipBuf = fs.readFileSync(LOCAL_ZIP_PATH);
    const zip = await JSZip.loadAsync(zipBuf);
    const targetEntry = Object.values(zip.files).find((e) => {
      if (e.dir) return false;
      const base = e.name.split(/[\\/]/).pop() || e.name;
      return base === fileName;
    });

    if (!targetEntry) {
      return new NextResponse("File not found in archive", { status: 404 });
    }

    const pdfUint8 = await targetEntry.async("uint8array");
    return new NextResponse(Buffer.from(pdfUint8), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error loading PDF";
    return new NextResponse(msg, { status: 500 });
  }
}
