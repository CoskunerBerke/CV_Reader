"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  CandidateCV,
  CompanyProfile,
  EvaluatedCandidate,
  DegreeKey,
  DegreeEducationEntry,
  evaluateCandidateForCompany,
  parseNaturalLanguageCriteria,
  normalizeTr,
  hasDegreeSelected,
} from "@/lib/cvEngine";
import {
  INITIAL_CANDIDATES,
  INITIAL_COMPANIES,
  buildCandidateFromRaw,
} from "@/lib/mockGenerator";
import {
  AppLang,
  LANG_STORAGE_KEY,
  translateGender,
  translateAgeMethod,
  translateAgeEvidence,
  translateGenderSignal,
  translateEduField,
  translateSkillLevel,
  translateParseStatus,
} from "@/lib/i18n";
import {
  Upload,
  Search,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileUp,
  Trash2,
  Download,
  Table as TableIcon,
  GraduationCap,
  Globe,
} from "lucide-react";

const DEGREE_CARDS: {
  key: DegreeKey;
  value: string;
  shortTr: string;
  shortEn: string;
  cardTitleTr: string;
  cardTitleEn: string;
  uniLabelTr: string;
  uniLabelEn: string;
  deptLabelTr: string;
  deptLabelEn: string;
}[] = [
  {
    key: "associate",
    value: "Ön Lisans (Associate)",
    shortTr: "Ön Lisans",
    shortEn: "Associate",
    cardTitleTr: "Ön Lisans Eğitimi (Associate)",
    cardTitleEn: "Associate Degree Education",
    uniLabelTr: "Ön Lisans Üniversitesi",
    uniLabelEn: "Associate University",
    deptLabelTr: "Ön Lisans Bölümü",
    deptLabelEn: "Associate Department",
  },
  {
    key: "bachelor",
    value: "Lisans (Bachelor's)",
    shortTr: "Lisans",
    shortEn: "Bachelor's",
    cardTitleTr: "Lisans Eğitimi (Bachelor's)",
    cardTitleEn: "Bachelor's Degree Education",
    uniLabelTr: "Lisans Üniversitesi",
    uniLabelEn: "Bachelor's University",
    deptLabelTr: "Lisans Bölümü",
    deptLabelEn: "Bachelor's Department",
  },
  {
    key: "master",
    value: "Yüksek Lisans (Master's)",
    shortTr: "Yüksek Lisans",
    shortEn: "Master's",
    cardTitleTr: "Yüksek Lisans / Master Eğitimi (Master's)",
    cardTitleEn: "Master's Degree Education",
    uniLabelTr: "Master Üniversitesi",
    uniLabelEn: "Master's University",
    deptLabelTr: "Master Bölümü",
    deptLabelEn: "Master's Department",
  },
  {
    key: "phd",
    value: "Doktora (Ph.D.)",
    shortTr: "Doktora",
    shortEn: "Ph.D.",
    cardTitleTr: "Doktora Eğitimi (Ph.D.)",
    cardTitleEn: "Doctoral (Ph.D.) Education",
    uniLabelTr: "Doktora Üniversitesi",
    uniLabelEn: "Ph.D. University",
    deptLabelTr: "Doktora Bölümü",
    deptLabelEn: "Ph.D. Department",
  },
];

function getCandidateDegreeMap(
  cv: CandidateCV
): Record<DegreeKey, DegreeEducationEntry | null> {
  const degStr =
    (cv.allDegrees && cv.allDegrees.length > 0
      ? cv.allDegrees.join(" + ")
      : cv.educationLevel) || "Lisans (Bachelor's)";
  const byDeg = cv.educationByDegree || {};
  const fallbackUni = cv.university || "Belirtilmemiş";
  const fallbackDept = cv.department || "Belirtilmemiş";

  const hasAssoc = hasDegreeSelected(degStr, "Ön Lisans (Associate)");
  const hasBsc =
    hasDegreeSelected(degStr, "Lisans (Bachelor's)") ||
    (!hasAssoc &&
      !hasDegreeSelected(degStr, "Yüksek Lisans (Master's)") &&
      !hasDegreeSelected(degStr, "Doktora (Ph.D.)"));
  const hasMsc = hasDegreeSelected(degStr, "Yüksek Lisans (Master's)");
  const hasPhd = hasDegreeSelected(degStr, "Doktora (Ph.D.)");

  return {
    associate: hasAssoc
      ? byDeg.associate || { university: fallbackUni, department: fallbackDept }
      : null,
    bachelor: hasBsc
      ? byDeg.bachelor || { university: fallbackUni, department: fallbackDept }
      : null,
    master: hasMsc
      ? byDeg.master ||
        byDeg.bachelor || { university: fallbackUni, department: fallbackDept }
      : null,
    phd: hasPhd
      ? byDeg.phd ||
        byDeg.master ||
        byDeg.bachelor || { university: fallbackUni, department: fallbackDept }
      : null,
  };
}

function isAgeMissingCase(cv: CandidateCV): boolean {
  return (
    cv.detectedAge === null ||
    cv.ageMethod === "İlk İş Deneyimi Tahmini" ||
    cv.ageMethod === "Bilinmiyor"
  );
}

function escapeXml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getExcelColLetter(colIdx0: number): string {
  let n = colIdx0 + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function exportEvaluationsToExcelXlsx(
  evaluations: EvaluatedCandidate[],
  companyName: string,
  lang: AppLang
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const headers =
    lang === "en"
      ? [
          "No",
          "File Name",
          "Full Name",
          "Gender",
          "Age",
          "Age Detection Method",
          "Academic Degrees (Summary)",
          "Associate Degree",
          "Associate University",
          "Associate Department",
          "Bachelor's Degree",
          "Bachelor's University",
          "Bachelor's Department",
          "Master's Degree",
          "Master's University",
          "Master's Department",
          "Ph.D. / Doctorate",
          "Ph.D. University",
          "Ph.D. Department",
          "Full Academic Summary (Label Format)",
          "City",
          "Detected Skills",
        ]
      : [
          "Sıra No",
          "Dosya Adı",
          "Ad Soyad",
          "Cinsiyet",
          "Yaş",
          "Yaş Tespit Yöntemi",
          "Eğitim Dereceleri (Özet)",
          "Ön Lisans (Associate)",
          "Ön Lisans Üniversitesi",
          "Ön Lisans Bölümü",
          "Lisans (Bachelor's)",
          "Lisans Üniversitesi",
          "Lisans Bölümü",
          "Yüksek Lisans (Master's)",
          "Master Üniversitesi",
          "Master Bölümü",
          "Doktora (Ph.D.)",
          "Doktora Üniversitesi",
          "Doktora Bölümü",
          "Tüm Eğitim Özeti (Label Formatı)",
          "Şehir",
          "Aranan Yetenekler",
        ];

  const colWidths = [
    9, 28, 24, 12, 22, 26, 36, 14, 28, 28, 14, 32, 32, 16, 30, 32, 14, 28, 32,
    55, 15, 34,
  ];

  const rows: (string | number)[][] = evaluations.map((item, idx) => {
    const cv = item.cv;
    const degMap = getCandidateDegreeMap(cv);
    const noAge = isAgeMissingCase(cv);
    const ageDisplay = noAge
      ? lang === "en"
        ? "No Age or Edu Date (Unspecified)"
        : "Yaş & Üni Tarihi Yok (Belirsiz)"
      : cv.detectedAge ?? (lang === "en" ? "Unspecified" : "Belirsiz");

    const degList = DEGREE_CARDS.filter((d) => degMap[d.key] !== null);
    const labelSummaryParts = degList.map((d) => {
      const info = degMap[d.key]!;
      const degName = lang === "en" ? d.shortEn : d.shortTr;
      return `${degName}: ${translateEduField(
        info.university,
        lang
      )} — ${translateEduField(info.department, lang)}`;
    });

    const skillsSummary =
      item.skillAssessments.length > 0
        ? item.skillAssessments
            .map((sa) => `${sa.skill} (${translateSkillLevel(sa.level, lang)})`)
            .join(", ")
        : "—";

    const yesMark = lang === "en" ? "✓ Yes" : "✓ Var";

    return [
      idx + 1,
      cv.source || "—",
      cv.fullName,
      translateGender(cv.detectedGender, lang),
      ageDisplay,
      noAge
        ? lang === "en"
          ? "No Age or Edu Date"
          : "Yaş & Üni Tarihi Yok"
        : translateAgeMethod(cv.ageMethod, lang),
      degList.map((d) => (lang === "en" ? d.shortEn : d.value)).join(" + ") ||
        translateEduField(cv.educationLevel, lang),
      degMap.associate ? yesMark : "—",
      degMap.associate
        ? translateEduField(degMap.associate.university, lang)
        : "—",
      degMap.associate
        ? translateEduField(degMap.associate.department, lang)
        : "—",
      degMap.bachelor ? yesMark : "—",
      degMap.bachelor
        ? translateEduField(degMap.bachelor.university, lang)
        : "—",
      degMap.bachelor
        ? translateEduField(degMap.bachelor.department, lang)
        : "—",
      degMap.master ? yesMark : "—",
      degMap.master ? translateEduField(degMap.master.university, lang) : "—",
      degMap.master ? translateEduField(degMap.master.department, lang) : "—",
      degMap.phd ? yesMark : "—",
      degMap.phd ? translateEduField(degMap.phd.university, lang) : "—",
      degMap.phd ? translateEduField(degMap.phd.department, lang) : "—",
      labelSummaryParts.join(" | ") ||
        `${translateEduField(cv.university, lang)} — ${translateEduField(
          cv.department || "—",
          lang
        )}`,
      translateEduField(cv.city || "Belirtilmemiş", lang),
      skillsSummary,
    ];
  });

  const colsXml = colWidths
    .map(
      (w, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`
    )
    .join("");

  const headerCellsXml = headers
    .map((h, cIdx) => {
      const ref = `${getExcelColLetter(cIdx)}1`;
      return `<c r="${ref}" s="1" t="inlineStr"><is><t>${escapeXml(
        h
      )}</t></is></c>`;
    })
    .join("");

  const dataRowsXml = rows
    .map((r, rIdx) => {
      const rowNum = rIdx + 2;
      const cells = r
        .map((val, cIdx) => {
          const ref = `${getExcelColLetter(cIdx)}${rowNum}`;
          if (typeof val === "number" && Number.isFinite(val)) {
            return `<c r="${ref}" s="2"><v>${val}</v></c>`;
          }
          return `<c r="${ref}" s="2" t="inlineStr"><is><t>${escapeXml(
            String(val ?? "")
          )}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowNum}" ht="22" customHeight="1">${cells}</row>`;
    })
    .join("");

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${colsXml}</cols>
  <sheetData>
    <row r="1" ht="26" customHeight="1">${headerCellsXml}</row>
    ${dataRowsXml}
  </sheetData>
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`;

  const sheetTitle = lang === "en" ? "CV Analysis Report" : "CV Analiz Raporu";
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${sheetTitle}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  zip.file("[Content_Types].xml", contentTypesXml);
  zip.file("_rels/.rels", rootRelsXml);
  zip.file("xl/workbook.xml", workbookXml);
  zip.file("xl/_rels/workbook.xml.rels", workbookRelsXml);
  zip.file("xl/styles.xml", stylesXml);
  zip.file("xl/worksheets/sheet1.xml", sheetXml);

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeComp = (companyName || (lang === "en" ? "CV_Pool" : "CV_Havuzu"))
    .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ_-]/g, "_");
  const filePrefix =
    lang === "en" ? "CV_Analysis_Report" : "CV_Analiz_Raporu";
  a.href = url;
  a.download = `${filePrefix}_${safeComp}_${evaluations.length}_CV_${dateStr}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CVReaderApp() {
  // Dil Seçeneği (TR / EN) — Tüm sayfada ve localStorage üzerinde senkronize
  const [lang, setLang] = useState<AppLang>("tr");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === "tr" || saved === "en") {
        setLang(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSwitchLang = (next: AppLang) => {
    setLang(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
      document.documentElement.lang = next;
    } catch {
      // ignore
    }
  };

  // Şirket profilleri
  const [companies, setCompanies] = useState<CompanyProfile[]>(INITIAL_COMPANIES);
  const [activeCompanyId, setActiveCompanyId] = useState<string>(INITIAL_COMPANIES[0].id);

  // CV Havuzu
  const [candidates, setCandidates] = useState<CandidateCV[]>(INITIAL_CANDIDATES);

  // Arayüz durumları
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [layoutMode, setLayoutMode] = useState<"split" | "table">("split");

  // Modallar
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState<boolean>(false);

  // Yeni CV yükleme state
  const [uploadName, setUploadName] = useState<string>("");
  const [uploadUni, setUploadUni] = useState<string>("");
  const [uploadCity, setUploadCity] = useState<string>("İstanbul");
  const [uploadExp] = useState<number>(2);
  const [uploadRawText, setUploadRawText] = useState<string>("");
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(false);
  const [pdfParseStatus, setPdfParseStatus] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Yeni Şirket oluşturma state
  const [newCompName, setNewCompName] = useState<string>("");
  const [newCompGender, setNewCompGender] = useState<"Kadın" | "Erkek" | "Farketmez">("Farketmez");
  const [newCompMinAge, setNewCompMinAge] = useState<number>(18);
  const [newCompMaxAge, setNewCompMaxAge] = useState<number>(45);
  const [newCompSkills, setNewCompSkills] = useState<string>("");

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) || companies[0],
    [companies, activeCompanyId]
  );

  // Adayları aktif şirket kriterlerine göre değerlendir ve sırala
  const evaluatedList = useMemo(() => {
    const list = candidates.map((cv) => evaluateCandidateForCompany(cv, activeCompany));
    list.sort((a, b) => b.totalMatchScore - a.totalMatchScore);
    return list;
  }, [candidates, activeCompany]);

  // Ekranda gösterilecek adaylar
  const displayedEvaluations = useMemo(() => {
    return evaluatedList.filter((item) => {
      if (searchQuery.trim() !== "") {
        const q = normalizeTr(searchQuery);
        const inName = normalizeTr(item.cv.fullName).includes(q);
        const inText = normalizeTr(item.cv.rawText).includes(q);
        if (!inName && !inText) return false;
      }
      return true;
    });
  }, [evaluatedList, searchQuery]);

  const selectedEvaluation = useMemo(() => {
    return (
      displayedEvaluations.find((e) => e.cv.id === selectedCandidateId) ||
      displayedEvaluations[0] ||
      evaluatedList[0]
    );
  }, [evaluatedList, displayedEvaluations, selectedCandidateId]);

  // Tek bir CV'yi sil
  const handleDeleteCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  // Klasör sürükleme (FileSystemEntry) ve çoklu dosya okuma yardımcısı
  const readEntryRecursively = async (entry: FileSystemEntry): Promise<File[]> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      return new Promise<File[]>((resolve) => {
        fileEntry.file(
          (f) => resolve([f]),
          () => resolve([])
        );
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const allEntries: FileSystemEntry[] = [];
      const readBatch = (): Promise<void> =>
        new Promise((resolve) => {
          reader.readEntries(
            async (entries) => {
              if (entries.length === 0) {
                resolve();
              } else {
                allEntries.push(...entries);
                await readBatch();
                resolve();
              }
            },
            () => resolve()
          );
        });
      await readBatch();
      const nested = await Promise.all(allEntries.map(readEntryRecursively));
      return nested.flat();
    }
    return [];
  };

  // Tarayıcıda doğrudan .ZIP arşivini açma
  const expandClientFiles = async (inputFiles: File[]): Promise<File[]> => {
    const expanded: File[] = [];
    const allowedExts = new Set(["pdf", "docx", "doc", "html", "htm", "txt", "md", "rar"]);

    for (const file of inputFiles) {
      const baseTop = file.name.split(/[\\/]/).pop() || file.name;
      if (!baseTop || baseTop.startsWith(".") || baseTop.startsWith("~$")) continue;
      const lowerTop = baseTop.toLowerCase();
      if (lowerTop === "desktop.ini" || lowerTop === "thumbs.db") continue;
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (ext === "zip") {
        try {
          setPdfParseStatus(`"${file.name}" arşivi tarayıcıda açılıyor...`);
          const JSZip = (await import("jszip")).default;
          const buf = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(buf);
          const entries = Object.values(zip.files).filter((e) => !e.dir);
          for (const entry of entries) {
            const baseName = entry.name.split(/[\\/]/).pop() || entry.name;
            if (!baseName || baseName.startsWith(".") || baseName.startsWith("~$")) continue;
            const lower = baseName.toLowerCase();
            if (
              lower.includes("readme") ||
              lower.includes("sonuclar") ||
              lower.includes("__macosx") ||
              lower === "desktop.ini" ||
              lower === "thumbs.db"
            ) {
              continue;
            }
            const entryExt = baseName.split(".").pop()?.toLowerCase() || "";
            if (!allowedExts.has(entryExt)) continue;
            const blob = await entry.async("blob");
            expanded.push(new File([blob], baseName, { type: blob.type || "application/octet-stream" }));
          }
        } catch {
          expanded.push(file);
        }
      } else if (allowedExts.has(ext)) {
        expanded.push(file);
      }
    }
    return expanded;
  };

  // ORTAK DOSYA İŞLEME MOTORU
  const processFiles = async (
    fileList: FileList | File[],
    autoAddSingleInModal = true
  ) => {
    const rawArray = Array.from(fileList);
    if (rawArray.length === 0) {
      setPdfParseStatus(
        "⚠️ Dosya algılanamadı. Eğer WinRAR/ZIP penceresinin içinden sürüklediyseniz, lütfen doğrudan .zip dosyasının kendisini veya klasöre çıkartıp dosyaları sürükleyin."
      );
      return;
    }

    setIsParsingPdf(true);
    setPdfParseStatus("Dosyalar hazırlanıyor...");

    try {
      const expandedFiles = await expandClientFiles(rawArray);
      if (expandedFiles.length === 0) {
        setPdfParseStatus("⚠️ Desteklenen bir CV dosyası (.pdf, .docx, .html, .zip, .rar, .txt) bulunamadı.");
        setIsParsingPdf(false);
        return;
      }

      const batches: File[][] = [];
      let currentBatch: File[] = [];
      let currentBytes = 0;
      const MAX_FILES_PER_BATCH = 5;
      const MAX_BYTES_PER_BATCH = 3 * 1024 * 1024;

      for (const f of expandedFiles) {
        if (
          currentBatch.length >= MAX_FILES_PER_BATCH ||
          (currentBatch.length > 0 && currentBytes + f.size > MAX_BYTES_PER_BATCH)
        ) {
          batches.push(currentBatch);
          currentBatch = [];
          currentBytes = 0;
        }
        currentBatch.push(f);
        currentBytes += f.size;
      }
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }

      const isBulkOrAuto = expandedFiles.length > 1 || autoAddSingleInModal;
      if (isBulkOrAuto) {
        setIsUploadModalOpen(false);
      }

      let totalParsedCount = 0;
      let processedFileCount = 0;
      let firstAddedId = "";

      for (const batch of batches) {
        setPdfParseStatus(
          `Analiz ediliyor: ${processedFileCount} / ${expandedFiles.length} dosya işlendi...`
        );

        const formData = new FormData();
        for (const f of batch) {
          formData.append("files", f);
        }

        const res = await fetch("/api/parse-cv", {
          method: "POST",
          body: formData,
        });

        processedFileCount += batch.length;

        if (!res.ok) continue;
        const data = await res.json();
        if (!data.files || data.files.length === 0) continue;

        if (isBulkOrAuto) {
          const addedCVs: CandidateCV[] = data.files.map(
            (
              f: {
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
              },
              idx: number
            ) => {
              const built = buildCandidateFromRaw(
                `cv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${totalParsedCount + idx}`,
                f.fullName,
                f.rawText,
                f.experienceYears,
                f.humanDegree || "Lisans",
                f.humanUniversity || f.university,
                f.city,
                activeCompany.requiredSkills,
                f.fileName
              );
              if (f.humanUniversity) {
                built.university = f.humanUniversity;
              }
              if (f.humanDepartment) {
                built.department = f.humanDepartment;
              }
              if (f.humanDegree) {
                built.educationLevel = f.humanDegree;
              }
              if (f.humanGender) {
                built.detectedGender = f.humanGender;
                built.genderConfidence = 100;
                built.genderEvidence = [
                  {
                    layer: "Kullanıcı Ground-Truth Etiketi",
                    signal: `Kullanıcı tarafından '${f.humanGender}' olarak doğrulandı ve öğrenildi`,
                    weight: 100,
                    direction: f.humanGender === "Kadın" ? "Kadın" : "Erkek",
                  },
                ];
              }
              if (f.humanAge !== null && f.humanAge !== undefined) {
                built.detectedAge = f.humanAge;
                built.ageMethod = "Doğrudan Yaş Beyanı";
                built.ageConfidence = 100;
                built.ageEvidence = `Kullanıcı tarafından '${f.humanAge} yaş' olarak etiketlendi ve öğrenildi.`;
              } else if (f.hasHumanLabel && f.humanAge === null) {
                built.detectedAge = null;
                built.ageMethod = "Bilinmiyor";
                built.ageConfidence = 100;
                built.ageEvidence =
                  "CV'de ne doğum tarihi ne de üniversite/eğitim başlangıç yılı yer alıyor (Yaş & Üni Tarihi Yok).";
              }
              return built;
            }
          );

          totalParsedCount += addedCVs.length;
          if (!firstAddedId && addedCVs[0]) {
            firstAddedId = addedCVs[0].id;
            setSelectedCandidateId(firstAddedId);
          }

          setCandidates((prev) => [...prev, ...addedCVs]);
          setPdfParseStatus(
            `Analiz ediliyor: ${processedFileCount} / ${expandedFiles.length} dosya (${totalParsedCount} CV eklendi)...`
          );
        } else {
          const first = data.files[0];
          setUploadName(first.fullName);
          setUploadUni(first.university);
          setUploadCity(first.city);
          setUploadRawText(first.rawText);
          totalParsedCount = 1;
          setPdfParseStatus(
            `✓ "${first.fileName}" okundu. "Analiz Et ve Ekle" butonuna basabilirsiniz.`
          );
        }
      }

      if (isBulkOrAuto) {
        if (totalParsedCount > 0) {
          setPdfParseStatus(`✓ Toplam ${totalParsedCount} adet CV başarıyla yüklendi ve analiz edildi.`);
        } else {
          setPdfParseStatus("⚠️ Seçilen dosyalardan CV metni çıkarılamadı.");
        }
      }
    } catch {
      setPdfParseStatus("Dosya okunurken bir hata oluştu.");
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleDirectFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = Array.from(e.target.files);
    e.target.value = "";
    await processFiles(selected, true);
  };

  const handleModalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = Array.from(e.target.files);
    e.target.value = "";
    await processFiles(selected, true);
  };

  useEffect(() => {
    let dragCounter = 0;

    const handleWinDragEnter = (ev: DragEvent) => {
      ev.preventDefault();
      if (ev.dataTransfer?.types?.includes("Files")) {
        dragCounter++;
        setIsDragging(true);
      }
    };

    const handleWinDragOver = (ev: DragEvent) => {
      ev.preventDefault();
      if (ev.dataTransfer) {
        ev.dataTransfer.dropEffect = "copy";
      }
      if (ev.dataTransfer?.types?.includes("Files")) {
        setIsDragging(true);
      }
    };

    const handleWinDragLeave = (ev: DragEvent) => {
      ev.preventDefault();
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0 || ev.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const handleWinDrop = (ev: DragEvent) => {
      ev.preventDefault();
      dragCounter = 0;
      setIsDragging(false);
    };

    window.addEventListener("dragenter", handleWinDragEnter);
    window.addEventListener("dragover", handleWinDragOver);
    window.addEventListener("dragleave", handleWinDragLeave);
    window.addEventListener("drop", handleWinDrop);
    return () => {
      window.removeEventListener("dragenter", handleWinDragEnter);
      window.removeEventListener("dragover", handleWinDragOver);
      window.removeEventListener("dragleave", handleWinDragLeave);
      window.removeEventListener("drop", handleWinDrop);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDropFiles = async (e: React.DragEvent, autoAdd = true) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const dt = e.dataTransfer;
    if (!dt) return;

    const entries: FileSystemEntry[] = [];
    if (dt.items && dt.items.length > 0) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === "file") {
          const entry = item.webkitGetAsEntry?.();
          if (entry) entries.push(entry);
        }
      }
    }

    const fallbackFiles = dt.files ? Array.from(dt.files) : [];

    if (entries.length > 0 && entries.some((en) => en.isDirectory)) {
      const nestedFiles = await Promise.all(entries.map(readEntryRecursively));
      const flatFiles = nestedFiles.flat();
      if (flatFiles.length > 0) {
        await processFiles(flatFiles, autoAdd);
        return;
      }
    }

    if (fallbackFiles.length > 0) {
      await processFiles(fallbackFiles, autoAdd);
    } else if (entries.length > 0) {
      const nestedFiles = await Promise.all(entries.map(readEntryRecursively));
      await processFiles(nestedFiles.flat(), autoAdd);
    } else {
      await processFiles([], autoAdd);
    }
  };

  const handleAddCV = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadName.trim() || !uploadRawText.trim()) return;
    const newId = `cv-${Date.now().toString().slice(-4)}`;
    const newCV = buildCandidateFromRaw(
      newId,
      uploadName.trim(),
      uploadRawText.trim(),
      uploadExp,
      "Lisans",
      uploadUni || "Belirtilmemiş",
      uploadCity || "İstanbul",
      activeCompany.requiredSkills,
      lang === "en" ? "Uploaded CV" : "Yüklenen CV"
    );
    setCandidates((prev) => [newCV, ...prev]);
    setSelectedCandidateId(newId);
    setIsUploadModalOpen(false);
    setUploadName("");
    setUploadUni("");
    setUploadRawText("");
    setPdfParseStatus("");
  };

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) return;
    const id = `comp-${Date.now()}`;
    const skillsArr = newCompSkills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const created: CompanyProfile = {
      id,
      name: newCompName.trim(),
      sector: "Kurumsal",
      roleTitle: "Genel Başvuru",
      naturalLanguagePrompt: "",
      targetGender: newCompGender,
      minAge: newCompMinAge,
      maxAge: newCompMaxAge,
      strictGender: newCompGender !== "Farketmez",
      strictAge: true,
      requiredSkills: skillsArr,
      preferredSkills: [],
      minExperienceYears: 0,
      learnedKeywordWeights: {},
      learnedUniversityBonus: false,
      feedbackCount: 0,
      approvedCandidateIds: [],
      rejectedCandidateIds: [],
    };

    setCompanies((prev) => [...prev, created]);
    setActiveCompanyId(id);
    setIsNewCompanyModalOpen(false);
    setNewCompName("");
    setNewCompSkills("");
  };

  const t = {
    brandSub:
      lang === "en"
        ? "Academic & Corporate Curriculum Vitae Parsing"
        : "Akademik & Kurumsal Özgeçmiş Ayrıştırma",
    navUpload: lang === "en" ? "Upload" : "Yükleme",
    navSystem: lang === "en" ? "Architecture" : "Mimari",
    navFeatures: lang === "en" ? "Standards" : "Standartlar",
    navResults: lang === "en" ? "Results" : "Sonuçlar",
    btnBenchmark:
      lang === "en" ? "Label & Benchmark" : "Etiketle & Başarı Ölç",
    btnExportTop: lang === "en" ? "Export Excel (.xlsx)" : "Excel İndir (.xlsx)",
    btnExportTooltip:
      lang === "en"
        ? "Download Age, Gender, and Degree-Specific (Associate / Bachelor's / Master's / Ph.D.) University-Department breakdown as Excel (.xlsx)"
        : "Yüklenen tüm CV'lerin Yaş, Cinsiyet ve Derece Bazlı (Ön Lisans / Lisans / Master / Doktora) Üniversite-Bölüm dökümünü Excel (.xlsx) olarak indir",
    btnClear: lang === "en" ? "Clear" : "Temizle",
    dragOverlayTitle:
      lang === "en"
        ? "Drop CV Files, Folder, or .ZIP / .RAR Archive Here"
        : "CV Dosyalarını, Klasörü veya .ZIP / .RAR Arşivini Bırakın",
    dragOverlaySub:
      lang === "en"
        ? "Drop 30–40+ CVs at once; chronological age, gender, and degree-specific education are extracted for instant Excel export."
        : "30–40+ CV'yi aynı anda bırakabilirsiniz; yaş, cinsiyet ve derece bazlı eğitimleri çıkarılıp Excel'e hazır hale getirilir.",
    heroEyebrow:
      lang === "en"
        ? "01 — ACADEMIC & CORPORATE HR AUTOMATION"
        : "01 — AKADEMİK VE KURUMSAL İK OTOMASYONU",
    heroTitle:
      lang === "en"
        ? "Transform Dozens of Curricula Vitae into a Structured Academic Excel Matrix in Seconds."
        : "Onlarca Özgeçmişi Saniyeler İçinde Yapılandırılmış Akademik Excel Tablosuna Dönüştürün.",
    heroDescStart:
      lang === "en"
        ? "Drop 30–40+ PDF, Word, folder, or archive files from your desktop in a single action. Accurately extract each candidate's "
        : "Masaüstünüzden 30–40+ adet PDF, Word, klasör veya arşivi tek seferde bırakın. Her adayın ",
    heroAge: lang === "en" ? "Chronological Age" : "Kronolojik Yaş",
    heroGender: lang === "en" ? "Gender" : "Cinsiyet",
    heroAnd: lang === "en" ? " and " : " ve ",
    heroDegrees:
      lang === "en"
        ? "Associate · Bachelor's · Master's · Ph.D."
        : "Ön Lisans · Lisans · Yüksek Lisans · Doktora",
    heroDescMid:
      lang === "en"
        ? " university and department records, ready for one-click "
        : " düzeyindeki üniversite ve bölüm bilgilerini hatasız ayrıştırıp tek tıkla ",
    heroExcel: lang === "en" ? "Excel (.xlsx)" : "Excel (.xlsx)",
    heroDescEnd:
      lang === "en" ? " export." : " olarak dışa aktarın.",
    readingFiles:
      lang === "en" ? "Reading CV files..." : "Dosyalar okunuyor...",
    dropTitleDragging:
      lang === "en"
        ? "Release Your Files or Folder Here Now!"
        : "Dosyaları veya Klasörü Şimdi Buraya Bırakın!",
    dropTitleEmpty:
      lang === "en"
        ? "Drag & Drop 30–40+ CV Files, Folder, or .ZIP / .RAR Archive Here"
        : "30–40+ CV Dosyasını, Klasörü veya .ZIP / .RAR Arşivini Buraya Sürükleyip Bırakın",
    dropTitleLoaded: (count: number) =>
      lang === "en"
        ? `Drag & Drop Additional CVs, Folder, or .ZIP Archive Here (${count} CVs Loaded)`
        : `Yeni CV'leri, Klasörü veya .ZIP Arşivini Buraya Sürükleyip Bırakın (${count} CV Yüklü)`,
    dropSubText:
      lang === "en"
        ? "Drag 30–40+ .PDF, .DOCX, .HTML, .ZIP, .RAR files or an entire folder directly into this workspace. All candidates are unified into a single structured table ready for Excel export."
        : "Masaüstünden 30–40+ adet .PDF, .DOCX, .HTML, .ZIP, .RAR dosyasını veya doğrudan klasörü bu alana sürükleyin. Tüm adaylar tek tabloda birleştirilir ve Excel çıktısına hazır hale getirilir.",
    btnSelectFiles:
      lang === "en"
        ? "Select Multiple Files (PDF / ZIP)"
        : "Çoklu Dosya Seç (PDF / ZIP)",
    btnSelectFolder:
      lang === "en" ? "Select Folder (Batch)" : "Klasör Seç (Toplu)",
    step1Title:
      lang === "en"
        ? "Batch File & Folder Ingestion"
        : "Toplu Dosya & Klasör Bırakma",
    step1Desc:
      lang === "en"
        ? "Upload dozens of PDF, Word, or archive files simultaneously without selecting one by one."
        : "Tek tek seçmeden onlarca PDF, Word veya arşiv dosyasını aynı anda yükleyin.",
    step2Title:
      lang === "en"
        ? "Degree-Specific Academic Parsing"
        : "Derece Bazlı Akademik Ayrıştırma",
    step2Desc:
      lang === "en"
        ? "Associate, Bachelor's, Master's, and Ph.D. universities and departments are matched separately."
        : "Ön Lisans, Lisans, Yüksek Lisans ve Doktora üniversite-bölümleri ayrı ayrı eşleşir.",
    step3Title:
      lang === "en"
        ? "Instant Excel (.xlsx) Export"
        : "Anında Excel (.xlsx) Çıktısı",
    step3Desc:
      lang === "en"
        ? "Download age, gender, and all academic tiers as a clean, filterable Excel spreadsheet."
        : "Yaş, cinsiyet ve tüm eğitim kırılımlarını düzenli Excel tablosu olarak indirin.",
    viewSplit:
      lang === "en" ? "Card & Detail View" : "Kart & Detay Görünümü",
    viewTable: (count: number) =>
      lang === "en"
        ? `Batch Table / Excel Preview (${count} CVs)`
        : `Toplu Tablo / Excel Önizleme (${count} CV)`,
    btnDownloadExcelFull: (count: number) =>
      lang === "en"
        ? `Download as Excel (.xlsx) — ${count} CVs`
        : `Excel Olarak İndir (.xlsx) — ${count} CV`,
    tableHeading: (count: number) =>
      lang === "en"
        ? `Batch CV & Degree-Specific Education Matrix (${count} Candidates)`
        : `Toplu CV & Derece Bazlı Eğitim Tablosu (${count} Aday)`,
    tableSub:
      lang === "en"
        ? "Complete preview of age, gender, and Associate / Bachelor's / Master's / Ph.D. university-department records included in the Excel (.xlsx) export"
        : "Excel (.xlsx) çıktısında yer alacak tüm yaş, cinsiyet ve Ön Lisans / Lisans / Yüksek Lisans / Doktora üniversite-bölüm verileri",
    searchTablePlaceholder:
      lang === "en" ? "Search in table..." : "Tabloda ara...",
    colNameFile:
      lang === "en" ? "Full Name / File" : "Ad Soyad / Dosya",
    colGender: lang === "en" ? "Gender" : "Cinsiyet",
    colAge: lang === "en" ? "Age" : "Yaş",
    colDegrees: lang === "en" ? "Academic Degrees" : "Eğitim Dereceleri",
    colAssoc:
      lang === "en"
        ? "Associate (Uni — Dept)"
        : "Ön Lisans (Üni — Bölüm)",
    colBachelor:
      lang === "en"
        ? "Bachelor's (Uni — Dept)"
        : "Lisans (Üni — Bölüm)",
    colMaster:
      lang === "en"
        ? "Master's (Uni — Dept)"
        : "Yüksek Lisans / Master (Üni — Bölüm)",
    colPhd:
      lang === "en"
        ? "Ph.D. / Doctorate (Uni — Dept)"
        : "Doktora / Ph.D. (Üni — Bölüm)",
    ageUnit: lang === "en" ? "yrs" : "Yaş",
    ageYearsOld: lang === "en" ? "Years Old" : "Yaşında",
    noAgeEduDate:
      lang === "en" ? "No Age / Edu Date" : "Yaş & Üni Tarihi Yok",
    noAgeEduDateLong:
      lang === "en"
        ? "No Age / Edu Date (Unspecified)"
        : "Yaş & Üni Tarihi Yok (Belirsiz)",
    unspecified: lang === "en" ? "Unspecified" : "Belirsiz",
    notSpecified: lang === "en" ? "Not Specified" : "Belirtilmemiş",
    ageNotSpecified:
      lang === "en" ? "Age Not Specified" : "Yaş Belirtilmemiş",
    uploadedCvsTitle: (count: number) =>
      lang === "en" ? `Uploaded CVs (${count})` : `Yüklenen CV'ler (${count})`,
    searchCandidatePlaceholder:
      lang === "en" ? "Search candidate..." : "Aday ara...",
    noCandidatesMatch:
      lang === "en"
        ? "No candidates match your search query."
        : "Aramanıza uygun aday bulunamadı.",
    removeCvTooltip: lang === "en" ? "Remove CV" : "CV'yi Kaldır",
    aiSummaryHeading:
      lang === "en"
        ? "Automated Academic & Demographic Extraction"
        : "Yapay Zeka Akademik & Demografik Tespit Özeti",
    genderLabel: lang === "en" ? "Gender" : "Cinsiyet",
    ageLabel: lang === "en" ? "Age" : "Yaş",
    eduSectionTitle:
      lang === "en"
        ? "Academic Degrees & University / Department"
        : "Eğitim Dereceleri & Üniversite / Bölüm",
    noUniDeptDetected:
      lang === "en"
        ? "No explicit university or department record could be detected in the CV text."
        : "CV metninde açık bir üniversite veya bölüm bilgisi tespit edilemedi.",
    rawCvTextHeading:
      lang === "en" ? "Extracted CV Text" : "Okunan CV Metni",
    selectCandidatePrompt:
      lang === "en"
        ? "Select a candidate from the list on the left to inspect detailed academic records."
        : "Detayları görmek için soldaki listeden bir adaya tıklayın.",
    sec2Eyebrow:
      lang === "en"
        ? "02 — SYSTEM ARCHITECTURE & WORKFLOW"
        : "02 — ÇALIŞMA MİMARİSİ VE SÜREÇ AKIŞI",
    sec2Title:
      lang === "en"
        ? "Reduce Pre-Interview Screening & Academic Verification to Minutes"
        : "İşe Alım ve Mülakat Öncesi Ön Eleme Sürecini Dakikalara İndirin",
    sec2Sub:
      lang === "en"
        ? "Instead of manually opening and reading hundreds of differently formatted CVs, convert your entire applicant pool into a standardized academic dataset before sitting at the interview table."
        : "Yüzlerce sayfalık farklı tasarımlardaki özgeçmişleri tek tek açıp okumak yerine, mülakat masasına oturmadan önce tüm aday havuzunu standart bir veri tablosuna dönüştürün.",
    arch1Tag:
      lang === "en" ? "01 / BATCH INGESTION" : "01 / TOPLU VERİ GİRİŞİ",
    arch1Title:
      lang === "en"
        ? "Folder, Archive (.ZIP / .RAR) & Multi-PDF Support"
        : "Klasör, Arşiv (.ZIP / .RAR) ve Çoklu PDF Desteği",
    arch1Desc:
      lang === "en"
        ? "Drag and drop 30–40+ CVs downloaded from career portals or email attachments directly as a folder or compressed archive without extracting."
        : "Kariyer portallarından veya e-posta eklerinden indirdiğiniz 30–40+ adet özgeçmişi klasörden çıkarmadan ya da doğrudan klasör halinde sürükleyip bırakın.",
    arch2Tag:
      lang === "en" ? "02 / MULTI-DEGREE ENGINE" : "02 / ÇOKLU DERECE MOTORU",
    arch2Title:
      lang === "en"
        ? "Associate, Bachelor's, Master's & Ph.D. Separation"
        : "Ön Lisans, Lisans, Yüksek Lisans ve Doktora Ayrımı",
    arch2Desc:
      lang === "en"
        ? "Never conflates multiple universities or graduate degrees; maps each academic tier's institution and department under its own dedicated column."
        : "Adayın birden fazla üniversite veya lisansüstü derecesi varsa birbirine karıştırmaz; her kademenin üniversite ve bölümünü kendi başlığı altına ayrı ayrı yazar.",
    arch3Tag:
      lang === "en"
        ? "03 / STANDARDIZED REPORTING"
        : "03 / STANDART RAPORLAMA",
    arch3Title:
      lang === "en"
        ? "Filterable Corporate & Academic Excel (.xlsx) Output"
        : "Filtrelenebilir Kurumsal Excel (.xlsx) Çıktısı",
    arch3Desc:
      lang === "en"
        ? "Full name, verified gender, chronological age, and all academic degrees download with a single click as a clean, multi-column Excel workbook."
        : "Ad soyad, tespit edilen cinsiyet, kronolojik yaş ve tüm akademik dereceler tek tıkla düzenli sütunlara ayrılmış Excel dosyası olarak bilgisayarınıza iner.",
    sec3Eyebrow:
      lang === "en"
        ? "03 — ACCURACY & METHODOLOGICAL STANDARDS"
        : "03 — DOĞRULUK VE AKADEMİK STANDARTLAR",
    sec3Title:
      lang === "en"
        ? "Resilient Parsing Engine Across Diverse CV Layouts"
        : "Farklı CV Şablonlarına Karşı Dayanıklı Okuma Motoru",
    feat1Title:
      lang === "en"
        ? "Chronological Age Estimation"
        : "Kronolojik Yaş Hesaplama",
    feat1Desc:
      lang === "en"
        ? "Automatically estimates candidate age from undergraduate and high school entry chronology when date of birth is omitted."
        : "Doğum tarihi yazmayan özgeçmişlerde lisans ve lise başlangıç kronolojisinden adayın yaşını otomatik tahmin eder.",
    feat2Title:
      lang === "en"
        ? "Structural Department Extraction"
        : "Yapısal Bölüm Çıkarımı",
    feat2Desc:
      lang === "en"
        ? "Recognizes Engineering, Economics/Business, Law, Arts & Sciences, and Vocational programs in both Turkish and English."
        : "Mühendislik, İİBF, Hukuk, Fen-Edebiyat ve MYO dahil tüm Türkçe ve İngilizce bölümleri satır yapısından tanır.",
    feat3Title:
      lang === "en"
        ? "Domestic & International Universities"
        : "Yurtiçi & Yurtdışı Üniversiteler",
    feat3Desc:
      lang === "en"
        ? "Pairs state and foundation universities in Turkey as well as European and US institutions with their corresponding degree tier."
        : "Türkiye'deki devlet ve vakıf üniversiteleri ile Avrupa/ABD üniversitelerini ilgili derece kademesiyle eşleştirir.",
    feat4Title:
      lang === "en"
        ? "Ground-Truth Memory"
        : "Ground-Truth Öğrenme",
    feat4Desc:
      lang === "en"
        ? "Candidate records verified in the labeling benchmark are persisted and automatically applied in future batch uploads."
        : "Etiketleme ekranında doğruladığınız aday verileri sistem hafızasına kaydedilir ve sonraki toplu yüklemelerde korunur.",
    footerDesc:
      lang === "en"
        ? "Academic & Corporate Curriculum Vitae Analysis and Excel Reporting System"
        : "Akademik ve Kurumsal Özgeçmiş Analizi & Excel Raporlama Sistemi",
    footerUploadLink:
      lang === "en" ? "Batch CV Upload" : "Toplu CV Yükle",
    footerLabelLink:
      lang === "en"
        ? "Ground-Truth Labeling & Accuracy Benchmark"
        : "Etiketleme & Doğruluk Ölçümü",
    modalUploadTitle:
      lang === "en"
        ? "Batch CV Upload (Drag & Drop / Multiple Files / Folder)"
        : "Toplu CV Yükle (Sürükle & Bırak / Çoklu Dosya / Klasör)",
    modalUploadSub:
      lang === "en"
        ? "30–40+ PDF (.pdf), Word (.docx), HTML, ZIP, RAR files or an entire folder are automatically parsed upon selection"
        : "30–40+ adet PDF (.pdf), Word (.docx), HTML, ZIP, RAR veya doğrudan klasör seçtiğiniz anda otomatik eklenir",
    modalManualSummary:
      lang === "en"
        ? "Manually Add a Single CV via Copy / Paste Text (Optional)"
        : "Metin Kopyala / Yapıştır ile Manuel Tek CV Ekle (Opsiyonel)",
    modalNameLabel: lang === "en" ? "Full Name *" : "Ad Soyad *",
    modalNamePlaceholder:
      lang === "en" ? "Candidate Full Name" : "Aday Adı Soyadı",
    modalUniLabel: lang === "en" ? "University" : "Üniversite",
    modalUniPlaceholder:
      lang === "en" ? "Auto-detected" : "Otomatik tespit edilir",
    modalCvTextLabel: lang === "en" ? "CV Text *" : "CV Metni *",
    modalCvTextPlaceholder:
      lang === "en"
        ? "Paste CV text here..."
        : "CV metnini buraya yapıştırabilirsiniz...",
    modalSubmitBtn:
      lang === "en"
        ? "Analyze & Add from Text"
        : "Metinden Analiz Et ve Ekle",
    newCompTitle: lang === "en" ? "Add New Company" : "Yeni Şirket Ekle",
    newCompName: lang === "en" ? "Company Name *" : "Şirket Adı *",
    newCompSkillsLabel:
      lang === "en"
        ? "Required Skills (Comma separated)"
        : "Aranan Yetenekler (Virgülle ayırın)",
    cancel: lang === "en" ? "Cancel" : "İptal",
    save: lang === "en" ? "Save" : "Kaydet",
  };

  return (
    <div
      className="relative min-h-screen bg-[#f7f5f0] text-[#0f172a] overflow-x-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDropFiles(e, true)}
    >
      {/* =====================================================================
          0. TÜM SAYFAYA YAYILAN SÜREKLİ DÖNGÜDE İŞ MÜLAKATI ARKA PLAN VİDEOSU
             (AÇIK RENK AKADEMİK FİLDİŞİ / ALABASTER KATMANI İLE)
         ===================================================================== */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover scale-[1.02] filter brightness-[1.06] contrast-[0.98] saturate-[0.92]"
        >
          <source src="/videos/interview-bg.mp4" type="video/mp4" />
          <source
            src="https://assets.mixkit.co/videos/41695/41695-720.mp4"
            type="video/mp4"
          />
          <source
            src="https://assets.mixkit.co/videos/23225/23225-720.mp4"
            type="video/mp4"
          />
        </video>
        {/* Açık Renk Akademik Fildişi (Warm Ivory / Oxford Paper) Yarı Saydam Katman */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#f8f6f0]/80 via-[#f8f6f0]/72 to-[#f3f0e8]/84 backdrop-blur-[1px]" />
      </div>

      {/* =====================================================================
          1. ÜST BAR (NAVBAR — Açık Akademik Tema, Tek Satır & TR/EN Dil Seçimi)
         ===================================================================== */}
      <header className="bg-[#fcfbf8]/90 backdrop-blur-md border-b border-[#dedad0] sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Sol: Logo & Başlık */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded bg-[#1e3a8a] text-white flex items-center justify-center font-serif-academic font-bold text-xs tracking-tight shadow-2xs">
              CV
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-serif-academic font-bold text-base sm:text-lg tracking-tight text-[#0f172a] whitespace-nowrap">
                CV Reader AI
              </span>
              <span className="hidden md:inline-block text-slate-300">|</span>
              <span className="hidden md:inline-block text-xs text-slate-600 font-medium whitespace-nowrap">
                {t.brandSub}
              </span>
            </div>
          </div>

          {/* Orta: Tek Kelimelik Akıcı Menü Linkleri */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-slate-700">
            <a
              href="#yukleme"
              className="hover:text-[#1e3a8a] transition-colors whitespace-nowrap"
            >
              {t.navUpload}
            </a>
            <a
              href="#sistem"
              className="hover:text-[#1e3a8a] transition-colors whitespace-nowrap"
            >
              {t.navSystem}
            </a>
            <a
              href="#ozellikler"
              className="hover:text-[#1e3a8a] transition-colors whitespace-nowrap"
            >
              {t.navFeatures}
            </a>
            {candidates.length > 0 && (
              <a
                href="#sonuclar"
                className="text-[#1e3a8a] hover:text-[#172e6e] transition-colors whitespace-nowrap"
              >
                {t.navResults} ({candidates.length})
              </a>
            )}
          </nav>

          {/* Sağ: Dil Seçici (TR | EN), Etiketleme & Excel İndir */}
          <div className="flex items-center gap-2 shrink-0">
            {/* TR | EN Dil Seçeneği */}
            <div
              className="inline-flex items-center rounded-md border border-[#d5d0c5] bg-[#f4f1ea] p-0.5 shrink-0"
              role="group"
              aria-label="Language Switcher"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1 hidden sm:inline" />
              <button
                type="button"
                onClick={() => handleSwitchLang("tr")}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  lang === "tr"
                    ? "bg-[#1e3a8a] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                TR
              </button>
              <button
                type="button"
                onClick={() => handleSwitchLang("en")}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  lang === "en"
                    ? "bg-[#1e3a8a] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                EN
              </button>
            </div>

            <Link
              href="/label"
              className="px-3 py-1.5 rounded-md border border-[#d5d0c5] bg-white hover:border-[#1e3a8a] text-[#0f172a] text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1e3a8a]" />
              {t.btnBenchmark}
            </Link>

            {candidates.length > 0 && (
              <>
                <button
                  onClick={() =>
                    exportEvaluationsToExcelXlsx(
                      displayedEvaluations.length > 0
                        ? displayedEvaluations
                        : evaluatedList,
                      activeCompany.name,
                      lang
                    )
                  }
                  className="px-3.5 py-1.5 rounded-md bg-[#1e3a8a] hover:bg-[#172e6e] text-white text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  title={t.btnExportTooltip}
                >
                  <Download className="w-3.5 h-3.5" />
                  {t.btnExportTop} (
                  {displayedEvaluations.length > 0
                    ? displayedEvaluations.length
                    : evaluatedList.length}
                  )
                </button>

                <button
                  onClick={() => {
                    setCandidates([]);
                    setSelectedCandidateId("");
                  }}
                  className="px-2.5 py-1.5 rounded-md border border-[#d5d0c5] bg-white hover:border-red-600 hover:text-red-700 text-slate-600 text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t.btnClear}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-12">
        {/* Tam Ekran Sürükle-Bırak Katmanı */}
        {isDragging && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDropFiles(e, true)}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-6"
          >
            <div className="bg-[#fcfbf9] border-2 border-dashed border-[#1e3a8a] rounded-2xl p-10 max-w-lg w-full text-center shadow-2xl pointer-events-none">
              <FileUp className="w-12 h-12 text-[#1e3a8a] mx-auto mb-3 animate-bounce" />
              <h3 className="font-serif-academic text-xl font-bold text-[#0f172a]">
                {t.dragOverlayTitle}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {t.dragOverlaySub}
              </p>
            </div>
          </div>
        )}

        {/* =====================================================================
            2. HERO TANITIM VE DOĞRUDAN CV SÜRÜKLE-BIRAK MERKEZİ
           ===================================================================== */}
        <section id="yukleme" className="space-y-7 pt-2">
          {/* Akademik Editoryal Başlık ve Değer Önerisi */}
          <div className="max-w-3xl space-y-3.5">
            <div className="text-[11px] font-mono-academic font-semibold uppercase tracking-[0.2em] text-[#1e3a8a] border-l-2 border-[#1e3a8a] pl-2.5">
              {t.heroEyebrow}
            </div>
            <h1 className="font-serif-academic text-2xl sm:text-4xl font-bold tracking-tight text-[#0f172a] leading-[1.2]">
              {t.heroTitle}
            </h1>
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl">
              {t.heroDescStart}
              <strong className="text-[#0f172a] font-semibold">
                {t.heroAge}
              </strong>
              ,{" "}
              <strong className="text-[#0f172a] font-semibold">
                {t.heroGender}
              </strong>
              {t.heroAnd}
              <strong className="text-[#0f172a] font-semibold">
                {t.heroDegrees}
              </strong>
              {t.heroDescMid}
              <strong className="text-[#1e3a8a] font-semibold underline decoration-[#1e3a8a]/35 underline-offset-4">
                {t.heroExcel}
              </strong>
              {t.heroDescEnd}
            </p>
          </div>

          {/* Canlı Yükleme & Analiz Durum Çubuğu */}
          {(isParsingPdf || pdfParseStatus) && (
            <div
              className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 text-xs font-medium backdrop-blur-md shadow-sm ${
                pdfParseStatus.startsWith("⚠️")
                  ? "bg-amber-50/95 border-amber-300 text-amber-950"
                  : "bg-[#f0f4ff]/95 border-[#1e3a8a]/30 text-[#0f172a]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isParsingPdf && (
                  <Loader2 className="w-4 h-4 text-[#1e3a8a] animate-spin shrink-0" />
                )}
                <span>
                  {translateParseStatus(pdfParseStatus, lang) || t.readingFiles}
                </span>
              </div>
              {!isParsingPdf && pdfParseStatus && (
                <button
                  onClick={() => setPdfParseStatus("")}
                  className="text-slate-500 hover:text-slate-900 text-sm font-bold px-1 cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>
          )}

          {/* HER ZAMAN GÖRÜNÜR SÜRÜKLE & BIRAK (DRAG & DROP) KARTI */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDropFiles(e, true)}
            className={`bg-[#fcfbf9]/94 backdrop-blur-md border-2 border-dashed rounded-2xl transition-all shadow-lg ${
              candidates.length === 0 ? "p-7 sm:p-10" : "p-6"
            } ${
              isDragging
                ? "border-[#1e3a8a] bg-[#f0f4ff]/95 scale-[1.005]"
                : "border-[#1e3a8a]/45 hover:border-[#1e3a8a]"
            }`}
          >
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 text-center lg:text-left">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shrink-0 shadow-sm">
                  {isParsingPdf ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <FileUp className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="font-serif-academic text-base sm:text-xl font-bold text-[#0f172a]">
                    {isDragging
                      ? t.dropTitleDragging
                      : candidates.length === 0
                      ? t.dropTitleEmpty
                      : t.dropTitleLoaded(candidates.length)}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed max-w-2xl">
                    {t.dropSubText}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
                {/* Çoklu Dosya Seç Butonu */}
                <label className="px-4 py-2.5 rounded-lg bg-[#1e3a8a] hover:bg-[#172e6e] text-white text-xs font-semibold cursor-pointer flex items-center gap-2 shadow-xs transition-colors whitespace-nowrap shrink-0">
                  <Upload className="w-3.5 h-3.5 text-blue-200" />
                  {t.btnSelectFiles}
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.html,.htm,.zip,.rar,.txt,.md,text/html,application/pdf,application/zip,application/x-rar-compressed,application/vnd.rar,application/x-zip-compressed,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleDirectFilesUpload}
                    className="hidden"
                  />
                </label>

                {/* Klasör Seç Butonu */}
                <label className="px-4 py-2.5 rounded-lg border border-[#cfc9bc] bg-white hover:border-[#1e3a8a] text-[#0f172a] text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0">
                  📁 {t.btnSelectFolder}
                  <input
                    type="file"
                    multiple
                    {...({
                      webkitdirectory: "",
                      directory: "",
                    } as React.InputHTMLAttributes<HTMLInputElement>)}
                    onChange={handleDirectFilesUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Alt 01-02-03 Akademik İş Akışı Şeridi */}
            <div className="mt-6 pt-5 border-t border-[#e5e0d5] grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div className="flex items-start gap-2.5">
                <span className="font-mono-academic text-xs font-bold text-[#1e3a8a] shrink-0">
                  01
                </span>
                <div className="text-xs text-slate-600">
                  <strong className="text-[#0f172a] font-semibold block">
                    {t.step1Title}
                  </strong>
                  {t.step1Desc}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="font-mono-academic text-xs font-bold text-[#1e3a8a] shrink-0">
                  02
                </span>
                <div className="text-xs text-slate-600">
                  <strong className="text-[#0f172a] font-semibold block">
                    {t.step2Title}
                  </strong>
                  {t.step2Desc}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="font-mono-academic text-xs font-bold text-[#1e3a8a] shrink-0">
                  03
                </span>
                <div className="text-xs text-slate-600">
                  <strong className="text-[#0f172a] font-semibold block">
                    {t.step3Title}
                  </strong>
                  {t.step3Desc}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            3. SONUÇLAR (KART GÖRÜNÜMÜ VEYA TOPLU TABLO / EXCEL ÖNİZLEME)
           ===================================================================== */}
        {candidates.length > 0 && (
          <div id="sonuclar" className="space-y-4">
            {/* ÜST TOPLU İŞLEM & EXCEL EXPORT BARI */}
            <div className="bg-[#fcfbf9]/95 backdrop-blur-md border border-[#dedad0] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-md border border-[#d5d0c5] bg-[#f4f1ea] p-0.5">
                  <button
                    onClick={() => setLayoutMode("split")}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      layoutMode === "split"
                        ? "bg-[#1e3a8a] text-white"
                        : "text-slate-600 hover:text-[#0f172a]"
                    }`}
                  >
                    📋 {t.viewSplit}
                  </button>
                  <button
                    onClick={() => setLayoutMode("table")}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      layoutMode === "table"
                        ? "bg-[#1e3a8a] text-white"
                        : "text-slate-600 hover:text-[#0f172a]"
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    {t.viewTable(displayedEvaluations.length)}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() =>
                    exportEvaluationsToExcelXlsx(
                      displayedEvaluations,
                      activeCompany.name,
                      lang
                    )
                  }
                  disabled={displayedEvaluations.length === 0}
                  className="px-4 py-2 rounded-md bg-[#1e3a8a] hover:bg-[#172e6e] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-2xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {t.btnDownloadExcelFull(displayedEvaluations.length)}
                </button>
              </div>
            </div>

            {layoutMode === "table" ? (
              /* ===============================================================
                 TOPLU TABLO / EXCEL ÖNİZLEME GÖRÜNÜMÜ (30-40+ CV İÇİN)
                 =============================================================== */
              <section className="bg-[#fcfbf9]/95 backdrop-blur-md border border-[#dedad0] rounded-xl overflow-hidden shadow-md">
                <div className="p-4 border-b border-[#e5e0d5] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif-academic font-bold text-base text-[#0f172a]">
                      {t.tableHeading(displayedEvaluations.length)}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">{t.tableSub}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.searchTablePlaceholder}
                        className="pl-8 pr-2.5 py-1.5 bg-white border border-[#cfc9bc] rounded text-xs focus:outline-none focus:border-[#1e3a8a] w-48"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[680px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#1e3a8a] text-white sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          #
                        </th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {t.colNameFile}
                        </th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {t.colGender}
                        </th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {t.colAge}
                        </th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {t.colDegrees}
                        </th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {t.colAssoc}
                        </th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {t.colBachelor}
                        </th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {t.colMaster}
                        </th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {t.colPhd}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e0d5]">
                      {displayedEvaluations.map((item, idx) => {
                        const degMap = getCandidateDegreeMap(item.cv);
                        const activeDegrees = DEGREE_CARDS.filter(
                          (d) => degMap[d.key] !== null
                        );
                        const ageMissing = isAgeMissingCase(item.cv);

                        const renderDegreeCell = (
                          slot: DegreeEducationEntry | null
                        ) => {
                          if (!slot) {
                            return <span className="text-slate-300">—</span>;
                          }
                          return (
                            <div className="space-y-0.5 min-w-[170px]">
                              <div className="font-semibold text-[#0f172a]">
                                {translateEduField(slot.university, lang)}
                              </div>
                              <div className="text-[11px] text-[#1e3a8a] font-medium">
                                {translateEduField(slot.department, lang)}
                              </div>
                            </div>
                          );
                        };

                        return (
                          <tr
                            key={item.cv.id}
                            onClick={() => {
                              setSelectedCandidateId(item.cv.id);
                              setLayoutMode("split");
                            }}
                            className="hover:bg-[#f0f4ff]/60 cursor-pointer transition-colors align-top"
                          >
                            <td className="py-3 px-3 font-mono-academic text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3 min-w-[180px]">
                              <div className="font-bold text-[#0f172a]">
                                {item.cv.fullName}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[210px]">
                                {item.cv.source}
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  item.cv.detectedGender === "Kadın"
                                    ? "bg-[#f0f4ff] text-[#1e3a8a] border border-[#1e3a8a]/25"
                                    : item.cv.detectedGender === "Erkek"
                                    ? "bg-slate-100 text-slate-800 border border-slate-300"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {translateGender(item.cv.detectedGender, lang)}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {item.cv.detectedAge !== null ? (
                                <div>
                                  <span className="font-bold text-[#0f172a]">
                                    {item.cv.detectedAge} {t.ageUnit}
                                  </span>
                                  <div className="text-[10px] text-slate-500">
                                    {translateAgeMethod(
                                      item.cv.ageMethod,
                                      lang
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                                  {ageMissing
                                    ? t.noAgeEduDate
                                    : t.unspecified}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1 min-w-[130px]">
                                {activeDegrees.length > 0 ? (
                                  activeDegrees.map((d) => (
                                    <span
                                      key={d.key}
                                      className="px-2 py-0.5 rounded bg-[#f0f4ff] text-[#1e3a8a] border border-[#1e3a8a]/25 text-[11px] font-semibold whitespace-nowrap"
                                    >
                                      ✓ {lang === "en" ? d.shortEn : d.shortTr}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-400">
                                    {t.notSpecified}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              {renderDegreeCell(degMap.associate)}
                            </td>
                            <td className="py-3 px-3">
                              {renderDegreeCell(degMap.bachelor)}
                            </td>
                            <td className="py-3 px-3">
                              {renderDegreeCell(degMap.master)}
                            </td>
                            <td className="py-3 px-3">
                              {renderDegreeCell(degMap.phd)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* SOL: ADAY LİSTESİ (7 Sütun) */}
                <div className="lg:col-span-7 bg-[#fcfbf9]/95 backdrop-blur-md border border-[#dedad0] rounded-xl overflow-hidden shadow-sm">
                  {/* Liste Başlığı */}
                  <div className="p-4 border-b border-[#e5e0d5] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h2 className="font-serif-academic font-bold text-base text-[#0f172a]">
                        {t.uploadedCvsTitle(candidates.length)}
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t.searchCandidatePlaceholder}
                          className="pl-8 pr-2.5 py-1.5 bg-white border border-[#cfc9bc] rounded text-xs focus:outline-none focus:border-[#1e3a8a] w-40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Aday Kartları */}
                  <div className="divide-y divide-[#e5e0d5] max-h-[680px] overflow-y-auto">
                    {displayedEvaluations.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-500">
                        {t.noCandidatesMatch}
                      </div>
                    ) : (
                      displayedEvaluations.map((item) => {
                        const isSelected =
                          selectedEvaluation?.cv.id === item.cv.id;
                        const degMap = getCandidateDegreeMap(item.cv);
                        const activeDegrees = DEGREE_CARDS.filter(
                          (d) => degMap[d.key] !== null
                        );
                        const ageMissing = isAgeMissingCase(item.cv);

                        return (
                          <div
                            key={item.cv.id}
                            onClick={() => setSelectedCandidateId(item.cv.id)}
                            className={`p-4 transition-colors cursor-pointer flex items-start justify-between gap-4 ${
                              isSelected
                                ? "bg-[#f0f4ff] border-l-4 border-l-[#1e3a8a]"
                                : "bg-white/80 hover:bg-[#f8f6f0]"
                            }`}
                          >
                            {/* Sol Bilgi */}
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-serif-academic font-bold text-base text-[#0f172a] truncate">
                                  {item.cv.fullName}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                    item.cv.detectedGender === "Kadın"
                                      ? "bg-[#e8effd] text-[#1e3a8a]"
                                      : "bg-slate-200/80 text-slate-800"
                                  }`}
                                >
                                  {translateGender(
                                    item.cv.detectedGender,
                                    lang
                                  )}
                                </span>
                                <span className="text-xs text-slate-600 font-medium">
                                  •{" "}
                                  {item.cv.detectedAge !== null
                                    ? `${item.cv.detectedAge} ${t.ageUnit}`
                                    : ageMissing
                                    ? t.noAgeEduDateLong
                                    : t.ageNotSpecified}
                                </span>
                              </div>

                              {/* Derece Bazlı Eğitim Özeti */}
                              {activeDegrees.length > 0 && (
                                <div className="space-y-1 pt-0.5">
                                  {activeDegrees.map((deg) => {
                                    const slot = degMap[deg.key];
                                    if (!slot) return null;
                                    return (
                                      <div
                                        key={deg.key}
                                        className="text-xs flex flex-wrap items-center gap-1.5 text-slate-700"
                                      >
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-[#1e3a8a] text-white">
                                          {lang === "en"
                                            ? deg.shortEn
                                            : deg.shortTr}
                                        </span>
                                        <span className="font-semibold text-[#0f172a]">
                                          {translateEduField(
                                            slot.university,
                                            lang
                                          )}
                                        </span>
                                        <span className="text-slate-400">
                                          —
                                        </span>
                                        <span className="text-[#1e3a8a] font-medium">
                                          {translateEduField(
                                            slot.department,
                                            lang
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Sağ: Sil */}
                            <div
                              className="flex items-center gap-1 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() =>
                                  handleDeleteCandidate(item.cv.id)
                                }
                                title={t.removeCvTooltip}
                                className="p-1.5 rounded border border-[#d5d0c5] bg-white text-slate-500 hover:text-red-600 hover:border-red-300 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* SAĞ: SEÇİLİ ADAYIN AKADEMİK ÖZETİ VE CV METNİ (5 Sütun) */}
                <div className="lg:col-span-5 bg-[#fcfbf9]/95 backdrop-blur-md border border-[#dedad0] rounded-xl p-5 shadow-sm space-y-5">
                  {selectedEvaluation ? (
                    (() => {
                      const degMap = getCandidateDegreeMap(
                        selectedEvaluation.cv
                      );
                      const activeDegrees = DEGREE_CARDS.filter(
                        (d) => degMap[d.key] !== null
                      );
                      const ageMissing = isAgeMissingCase(
                        selectedEvaluation.cv
                      );

                      return (
                        <>
                          {/* Aday Başlığı */}
                          <div className="border-b border-[#e5e0d5] pb-4">
                            <h3 className="font-serif-academic text-xl font-bold text-[#0f172a]">
                              {selectedEvaluation.cv.fullName}
                            </h3>
                            <p className="text-xs text-slate-600 mt-1">
                              {translateEduField(
                                selectedEvaluation.cv.university,
                                lang
                              )}
                              {selectedEvaluation.cv.department &&
                              selectedEvaluation.cv.department !==
                                "Belirtilmemiş"
                                ? ` — ${translateEduField(
                                    selectedEvaluation.cv.department,
                                    lang
                                  )}`
                                : ""}{" "}
                              •{" "}
                              {translateEduField(
                                selectedEvaluation.cv.city,
                                lang
                              )}{" "}
                              • {selectedEvaluation.cv.source}
                            </p>
                          </div>

                          {/* Yapay Zeka Tespit Özeti */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono-academic font-semibold text-[#1e3a8a] uppercase tracking-wider">
                                {t.aiSummaryHeading}
                              </span>
                            </div>

                            {/* Cinsiyet Tespiti */}
                            <div className="p-3 rounded-lg bg-white border border-[#e5e0d5] text-xs space-y-1">
                              <div className="font-semibold text-[#0f172a]">
                                {t.genderLabel}:{" "}
                                {translateGender(
                                  selectedEvaluation.cv.detectedGender,
                                  lang
                                )}
                              </div>
                              <p className="text-slate-600">
                                {selectedEvaluation.cv.genderEvidence
                                  .map((e) =>
                                    translateGenderSignal(e.signal, lang)
                                  )
                                  .slice(0, 2)
                                  .join(" + ")}
                              </p>
                            </div>

                            {/* Yaş Tespiti */}
                            <div className="p-3 rounded-lg bg-white border border-[#e5e0d5] text-xs space-y-1">
                              <div className="flex items-center justify-between font-semibold text-[#0f172a]">
                                <span>
                                  {t.ageLabel}:{" "}
                                  {selectedEvaluation.cv.detectedAge !== null
                                    ? `${selectedEvaluation.cv.detectedAge} ${t.ageYearsOld}`
                                    : ageMissing
                                    ? t.noAgeEduDateLong
                                    : t.unspecified}
                                </span>
                                <span className="text-[#1e3a8a] text-[11px] font-medium">
                                  {translateAgeMethod(
                                    selectedEvaluation.cv.ageMethod,
                                    lang
                                  )}
                                </span>
                              </div>
                              <p className="text-slate-600">
                                {translateAgeEvidence(
                                  selectedEvaluation.cv.ageEvidence,
                                  lang
                                )}
                              </p>
                            </div>

                            {/* Derece Bazlı Eğitim Tespiti */}
                            <div className="p-3.5 rounded-lg bg-white border border-[#dedad0] text-xs space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#0f172a] flex items-center gap-1.5">
                                  <GraduationCap className="w-4 h-4 text-[#1e3a8a]" />
                                  {t.eduSectionTitle}
                                </span>
                                <span className="text-[11px] font-semibold text-[#1e3a8a]">
                                  {activeDegrees.length > 0
                                    ? activeDegrees
                                        .map((d) =>
                                          lang === "en" ? d.shortEn : d.shortTr
                                        )
                                        .join(" + ")
                                    : t.notSpecified}
                                </span>
                              </div>

                              {/* 4 Derece Göstergesi */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {DEGREE_CARDS.map((deg) => {
                                  const isHas = degMap[deg.key] !== null;
                                  return (
                                    <div
                                      key={deg.key}
                                      className={`px-2 py-1.5 rounded border text-center font-semibold text-[11px] ${
                                        isHas
                                          ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                                          : "bg-[#f8f6f0] text-slate-400 border-[#e5e0d5]"
                                      }`}
                                    >
                                      {isHas ? "✓ " : ""}
                                      {lang === "en"
                                        ? deg.shortEn
                                        : deg.shortTr}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Aktif olan her derece için ayrı Üniversite & Bölüm kartı */}
                              {activeDegrees.length > 0 ? (
                                <div className="space-y-2">
                                  {activeDegrees.map((deg) => {
                                    const slot = degMap[deg.key];
                                    if (!slot) return null;
                                    return (
                                      <div
                                        key={deg.key}
                                        className="p-2.5 rounded-md bg-[#f8f6f0] border border-[#1e3a8a]/25 space-y-1.5"
                                      >
                                        <div className="flex items-center justify-between border-b border-[#e5e0d5] pb-1">
                                          <span className="font-bold text-[#1e3a8a] text-[11px]">
                                            🎓{" "}
                                            {lang === "en"
                                              ? deg.cardTitleEn
                                              : deg.cardTitleTr}
                                          </span>
                                          <span className="text-[10px] font-medium text-slate-500">
                                            {deg.shortEn}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                                          <div>
                                            <div className="text-[10px] font-semibold text-slate-500 uppercase">
                                              {lang === "en"
                                                ? deg.uniLabelEn
                                                : deg.uniLabelTr}
                                            </div>
                                            <div className="font-semibold text-[#0f172a] mt-0.5">
                                              {translateEduField(
                                                slot.university,
                                                lang
                                              )}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-[10px] font-semibold text-slate-500 uppercase">
                                              {lang === "en"
                                                ? deg.deptLabelEn
                                                : deg.deptLabelTr}
                                            </div>
                                            <div className="font-semibold text-[#1e3a8a] mt-0.5">
                                              {translateEduField(
                                                slot.department,
                                                lang
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-slate-500">
                                  {t.noUniDeptDetected}
                                </p>
                              )}
                            </div>

                            {/* Yetenek Kanıtları */}
                            {selectedEvaluation.skillAssessments.map((sa) => (
                              <div
                                key={sa.skill}
                                className="p-3 rounded-lg bg-white border border-[#e5e0d5] text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between font-semibold text-[#0f172a]">
                                  <span className="flex items-center gap-1.5">
                                    {sa.level === "Uzman / Proje Kanıtlı" ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1e3a8a]" />
                                    ) : (
                                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                    )}
                                    {sa.skill}
                                  </span>
                                  <span
                                    className={
                                      sa.level === "Uzman / Proje Kanıtlı"
                                        ? "text-[#1e3a8a]"
                                        : "text-amber-700"
                                    }
                                  >
                                    {translateSkillLevel(sa.level, lang)}
                                  </span>
                                </div>
                                <p className="text-slate-600 italic">
                                  &ldquo;{sa.evidenceSnippet}&rdquo;
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* CV Metni */}
                          <div>
                            <div className="text-[11px] font-mono-academic font-semibold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-[#1e3a8a]" />
                              {t.rawCvTextHeading}
                            </div>
                            <pre className="p-3.5 rounded-lg bg-[#f4f1ea] border border-[#dedad0] text-[#0f172a] text-xs font-mono-academic whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                              {selectedEvaluation.cv.rawText}
                            </pre>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <div className="text-sm text-slate-500 py-8 text-center">
                      {t.selectCandidatePrompt}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* =====================================================================
            4. SİSTEM MİMARİSİ & PAZARLAMA AKIŞI (Açık Akademik Kartlar)
           ===================================================================== */}
        <section
          id="sistem"
          className="pt-8 border-t border-[#d8d3c8] space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="text-[11px] font-mono-academic font-semibold uppercase tracking-[0.2em] text-[#1e3a8a] border-l-2 border-[#1e3a8a] pl-2.5">
                {t.sec2Eyebrow}
              </div>
              <h2 className="font-serif-academic text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                {t.sec2Title}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 max-w-md leading-relaxed">
              {t.sec2Sub}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-6 rounded-xl bg-[#fcfbf9]/92 backdrop-blur-md border border-[#dedad0] space-y-2.5 shadow-xs">
              <div className="text-xs font-mono-academic font-bold text-[#1e3a8a]">
                {t.arch1Tag}
              </div>
              <h3 className="font-serif-academic text-base font-bold text-[#0f172a]">
                {t.arch1Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.arch1Desc}
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#fcfbf9]/92 backdrop-blur-md border border-[#dedad0] space-y-2.5 shadow-xs">
              <div className="text-xs font-mono-academic font-bold text-[#1e3a8a]">
                {t.arch2Tag}
              </div>
              <h3 className="font-serif-academic text-base font-bold text-[#0f172a]">
                {t.arch2Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.arch2Desc}
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#fcfbf9]/92 backdrop-blur-md border border-[#dedad0] space-y-2.5 shadow-xs">
              <div className="text-xs font-mono-academic font-bold text-[#1e3a8a]">
                {t.arch3Tag}
              </div>
              <h3 className="font-serif-academic text-base font-bold text-[#0f172a]">
                {t.arch3Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.arch3Desc}
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================================
            5. TEKNİK ÖZELLİKLER (01–04 Akademik Kırılım)
           ===================================================================== */}
        <section
          id="ozellikler"
          className="pt-8 border-t border-[#d8d3c8] space-y-6"
        >
          <div className="space-y-2 max-w-2xl">
            <div className="text-[11px] font-mono-academic font-semibold uppercase tracking-[0.2em] text-[#1e3a8a] border-l-2 border-[#1e3a8a] pl-2.5">
              {t.sec3Eyebrow}
            </div>
            <h2 className="font-serif-academic text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
              {t.sec3Title}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-[#fcfbf9]/92 backdrop-blur-md border border-[#dedad0] space-y-2 shadow-2xs">
              <div className="text-xs font-mono-academic font-bold text-[#1e3a8a]">
                01
              </div>
              <h3 className="font-serif-academic text-sm font-bold text-[#0f172a]">
                {t.feat1Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.feat1Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#fcfbf9]/92 backdrop-blur-md border border-[#dedad0] space-y-2 shadow-2xs">
              <div className="text-xs font-mono-academic font-bold text-[#1e3a8a]">
                02
              </div>
              <h3 className="font-serif-academic text-sm font-bold text-[#0f172a]">
                {t.feat2Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.feat2Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#fcfbf9]/92 backdrop-blur-md border border-[#dedad0] space-y-2 shadow-2xs">
              <div className="text-xs font-mono-academic font-bold text-[#1e3a8a]">
                03
              </div>
              <h3 className="font-serif-academic text-sm font-bold text-[#0f172a]">
                {t.feat3Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.feat3Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#fcfbf9]/92 backdrop-blur-md border border-[#dedad0] space-y-2 shadow-2xs">
              <div className="text-xs font-mono-academic font-bold text-[#1e3a8a]">
                04
              </div>
              <h3 className="font-serif-academic text-sm font-bold text-[#0f172a]">
                {t.feat4Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.feat4Desc}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          ALT BİLGİ (FOOTER — Açık Akademik Tema)
         ===================================================================== */}
      <footer className="relative z-10 border-t border-[#dedad0] bg-[#fcfbf8]/90 backdrop-blur-md mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-serif-academic font-bold text-[#0f172a]">
              CV Reader AI
            </span>
            <span>—</span>
            <span>{t.footerDesc}</span>
          </div>
          <div className="flex items-center gap-5 font-medium">
            <a
              href="#yukleme"
              className="hover:text-[#1e3a8a] transition-colors"
            >
              {t.footerUploadLink}
            </a>
            <Link
              href="/label"
              className="hover:text-[#1e3a8a] transition-colors"
            >
              {t.footerLabelLink}
            </Link>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          MODAL 1: TOPLU CV YÜKLE
         ===================================================================== */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fcfbf9] rounded-xl border border-[#dedad0] max-w-lg w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e5e0d5] pb-3">
              <div>
                <h3 className="font-serif-academic font-bold text-base text-[#0f172a]">
                  {t.modalUploadTitle}
                </h3>
                <p className="text-xs text-slate-600">{t.modalUploadSub}</p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropFiles(e, true)}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                isDragging
                  ? "border-[#1e3a8a] bg-[#f0f4ff]"
                  : "border-[#1e3a8a]/50 hover:border-[#1e3a8a] bg-white"
              }`}
            >
              <FileUp className="w-9 h-9 text-[#1e3a8a] mx-auto mb-2" />
              <span className="block font-serif-academic text-sm font-bold text-[#0f172a]">
                {isDragging ? t.dropTitleDragging : t.dropTitleEmpty}
              </span>
              <span className="block text-xs text-slate-600 mt-1 mb-4">
                {t.dropSubText}
              </span>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <label className="px-4 py-2 rounded-md bg-[#1e3a8a] hover:bg-[#172e6e] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  {t.btnSelectFiles}
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.html,.htm,.zip,.rar,.txt,.md,text/html,application/pdf,application/zip,application/x-rar-compressed,application/vnd.rar,application/x-zip-compressed,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleModalFileSelect}
                    className="hidden"
                  />
                </label>

                <label className="px-3.5 py-2 rounded-md border border-[#cfc9bc] bg-white hover:border-[#1e3a8a] text-[#0f172a] text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                  📁 {t.btnSelectFolder}
                  <input
                    type="file"
                    multiple
                    {...({
                      webkitdirectory: "",
                      directory: "",
                    } as React.InputHTMLAttributes<HTMLInputElement>)}
                    onChange={handleModalFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {isParsingPdf && (
              <div className="flex items-center gap-2 text-xs text-[#1e3a8a] font-medium bg-[#f0f4ff] p-2.5 rounded">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {translateParseStatus(pdfParseStatus, lang) || t.readingFiles}
                </span>
              </div>
            )}

            {pdfParseStatus && !isParsingPdf && (
              <div className="text-xs font-medium text-[#1e3a8a] bg-[#f0f4ff] border border-[#1e3a8a]/25 p-2.5 rounded">
                {translateParseStatus(pdfParseStatus, lang)}
              </div>
            )}

            <details className="border border-[#e5e0d5] rounded-md p-3 bg-white">
              <summary className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                {t.modalManualSummary}
              </summary>
              <form onSubmit={handleAddCV} className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t.modalNameLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder={t.modalNamePlaceholder}
                      className="w-full border border-[#cfc9bc] rounded bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t.modalUniLabel}
                    </label>
                    <input
                      type="text"
                      value={uploadUni}
                      onChange={(e) => setUploadUni(e.target.value)}
                      placeholder={t.modalUniPlaceholder}
                      className="w-full border border-[#cfc9bc] rounded bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.modalCvTextLabel}
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={uploadRawText}
                    onChange={(e) => setUploadRawText(e.target.value)}
                    placeholder={t.modalCvTextPlaceholder}
                    className="w-full border border-[#cfc9bc] rounded bg-white p-2.5 text-xs font-mono-academic"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={isParsingPdf}
                    className="px-4 py-1.5 bg-[#1e3a8a] hover:bg-[#172e6e] text-white rounded text-xs font-medium cursor-pointer"
                  >
                    {t.modalSubmitBtn}
                  </button>
                </div>
              </form>
            </details>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: YENİ ŞİRKET EKLE
         ===================================================================== */}
      {isNewCompanyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fcfbf9] rounded-xl border border-[#dedad0] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e5e0d5] pb-3">
              <h3 className="font-serif-academic font-bold text-base text-[#0f172a]">
                {t.newCompTitle}
              </h3>
              <button
                onClick={() => setIsNewCompanyModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.newCompName}
                </label>
                <input
                  type="text"
                  required
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  className="w-full border border-[#cfc9bc] bg-white rounded px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.newCompSkillsLabel}
                </label>
                <input
                  type="text"
                  value={newCompSkills}
                  onChange={(e) => setNewCompSkills(e.target.value)}
                  placeholder="C++, Java"
                  className="w-full border border-[#cfc9bc] bg-white rounded px-3 py-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCompanyModalOpen(false)}
                  className="px-4 py-1.5 border border-[#cfc9bc] bg-white rounded text-xs cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1e3a8a] text-white rounded text-xs font-medium cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
