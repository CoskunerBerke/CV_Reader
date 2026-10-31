import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { isRequestAuthorizedByIpOrDevice } from "@/lib/adminSecurity";

const LOCAL_ZIP_PATH = "C:\\Users\\berke\\OneDrive\\Masaüstü\\Yeni klasör.zip";

export async function GET(req: NextRequest) {
  if (!(await isRequestAuthorizedByIpOrDevice(req))) {
    return new NextResponse("Not Found", { status: 404 });
  }
  try {
    const rawFileParam = req.nextUrl.searchParams.get("file");
    if (!rawFileParam) {
      return new NextResponse("Missing file parameter", { status: 400 });
    }
    const safeFileName = path.basename(rawFileParam);
    if (
      !safeFileName ||
      safeFileName !== rawFileParam ||
      safeFileName.includes("..") ||
      !safeFileName.toLowerCase().endsWith(".pdf")
    ) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // 1. Önce repo içindeki public/cvs/ klasöründen oku (Hem Vercel'de hem Local'de çalışır!)
    const publicPdfPath = path.join(process.cwd(), "public", "cvs", safeFileName);
    if (fs.existsSync(publicPdfPath)) {
      const pdfBuf = fs.readFileSync(publicPdfPath);
      return new NextResponse(pdfBuf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(safeFileName)}"`,
          "Cache-Control": "private, no-store, max-age=0",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
          "X-Frame-Options": "SAMEORIGIN",
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
      return base === safeFileName;
    });

    if (!targetEntry) {
      return new NextResponse("File not found in archive", { status: 404 });
    }

    const pdfUint8 = await targetEntry.async("uint8array");
    return new NextResponse(Buffer.from(pdfUint8), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(safeFileName)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error loading PDF";
    return new NextResponse(msg, { status: 500 });
  }
}
