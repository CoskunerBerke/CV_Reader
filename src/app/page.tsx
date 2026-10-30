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
  Check,
  X,
  Upload,
  Search,
  Building2,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileUp,
  Trash2,
  Download,
  Table as TableIcon,
  LayoutList,
  GraduationCap,
} from "lucide-react";

const DEGREE_CARDS: {
  key: DegreeKey;
  value: string;
  shortTr: string;
  shortEn: string;
  cardTitle: string;
  uniLabel: string;
  deptLabel: string;
}[] = [
  {
    key: "associate",
    value: "Ön Lisans (Associate)",
    shortTr: "Ön Lisans",
    shortEn: "Associate",
    cardTitle: "Ön Lisans Eğitimi (Associate)",
    uniLabel: "Ön Lisans Üniversitesi",
    deptLabel: "Ön Lisans Bölümü",
  },
  {
    key: "bachelor",
    value: "Lisans (Bachelor's)",
    shortTr: "Lisans",
    shortEn: "Bachelor's",
    cardTitle: "Lisans Eğitimi (Bachelor's)",
    uniLabel: "Lisans Üniversitesi",
    deptLabel: "Lisans Bölümü",
  },
  {
    key: "master",
    value: "Yüksek Lisans (Master's)",
    shortTr: "Yüksek Lisans",
    shortEn: "Master's",
    cardTitle: "Yüksek Lisans / Master Eğitimi (Master's)",
    uniLabel: "Master Üniversitesi",
    deptLabel: "Master Bölümü",
  },
  {
    key: "phd",
    value: "Doktora (Ph.D.)",
    shortTr: "Doktora",
    shortEn: "Ph.D.",
    cardTitle: "Doktora Eğitimi (Ph.D.)",
    uniLabel: "Doktora Üniversitesi",
    deptLabel: "Doktora Bölümü",
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
  companyName: string
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const headers = [
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
      ? "Yaş & Üni Tarihi Yok (Belirsiz)"
      : cv.detectedAge ?? "Belirsiz";

    const degList = DEGREE_CARDS.filter((d) => degMap[d.key] !== null);
    const labelSummaryParts = degList.map((d) => {
      const info = degMap[d.key]!;
      return `${d.shortTr}: ${info.university} — ${info.department}`;
    });

    const skillsSummary =
      item.skillAssessments.length > 0
        ? item.skillAssessments
            .map((sa) => `${sa.skill} (${sa.level})`)
            .join(", ")
        : "—";

    return [
      idx + 1,
      cv.source || "—",
      cv.fullName,
      cv.detectedGender,
      ageDisplay,
      noAge ? "Yaş & Üni Tarihi Yok" : cv.ageMethod,
      degList.map((d) => d.value).join(" + ") || cv.educationLevel,
      degMap.associate ? "✓ Var" : "—",
      degMap.associate?.university || "—",
      degMap.associate?.department || "—",
      degMap.bachelor ? "✓ Var" : "—",
      degMap.bachelor?.university || "—",
      degMap.bachelor?.department || "—",
      degMap.master ? "✓ Var" : "—",
      degMap.master?.university || "—",
      degMap.master?.department || "—",
      degMap.phd ? "✓ Var" : "—",
      degMap.phd?.university || "—",
      degMap.phd?.department || "—",
      labelSummaryParts.join(" | ") || `${cv.university} — ${cv.department || "—"}`,
      cv.city || "Belirtilmemiş",
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
    <font><sz val="10"/><color rgb="FF18181B"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE4E4E7"/></left>
      <right style="thin"><color rgb="FFE4E4E7"/></right>
      <top style="thin"><color rgb="FFE4E4E7"/></top>
      <bottom style="thin"><color rgb="FFE4E4E7"/></bottom>
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

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="CV Analiz Raporu" sheetId="1" r:id="rId1"/>
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
  const safeComp = (companyName || "CV_Havuzu")
    .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ_-]/g, "_");
  a.href = url;
  a.download = `CV_Analiz_Raporu_${safeComp}_${evaluations.length}_CV_${dateStr}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CVReaderApp() {
  // Şirket profilleri
  const [companies, setCompanies] = useState<CompanyProfile[]>(INITIAL_COMPANIES);
  const [activeCompanyId, setActiveCompanyId] = useState<string>(INITIAL_COMPANIES[0].id);

  // CV Havuzu (Tamamen boş başlar — sadece kullanıcının yüklediği CV'ler yer alır)
  const [candidates, setCandidates] = useState<CandidateCV[]>(INITIAL_CANDIDATES);

  // Arayüz durumları
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [showAllCandidates, setShowAllCandidates] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [newSkillInput, setNewSkillInput] = useState<string>("");
  const [layoutMode, setLayoutMode] = useState<"split" | "table">("split");

  // Modallar
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState<boolean>(false);

  // Yeni CV yükleme state (PDF & DOCX Destekli)
  const [uploadName, setUploadName] = useState<string>("");
  const [uploadUni, setUploadUni] = useState<string>("");
  const [uploadCity, setUploadCity] = useState<string>("İstanbul");
  const [uploadExp, setUploadExp] = useState<number>(2);
  const [uploadRawText, setUploadRawText] = useState<string>("");
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(false);
  const [pdfParseStatus, setPdfParseStatus] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Gemini AI Derin Analiz state
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  const [isGeminiLoading, setIsGeminiLoading] = useState<boolean>(false);
  const [geminiResults, setGeminiResults] = useState<Record<string, string>>({});

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

  const updateActiveCompany = (updater: (prev: CompanyProfile) => CompanyProfile) => {
    setCompanies((prevList) =>
      prevList.map((c) => (c.id === activeCompany.id ? updater(c) : c))
    );
  };

  // Adayları aktif şirket kriterlerine göre değerlendir ve sırala
  const evaluatedList = useMemo(() => {
    const list = candidates.map((cv) => evaluateCandidateForCompany(cv, activeCompany));
    list.sort((a, b) => b.totalMatchScore - a.totalMatchScore);
    return list;
  }, [candidates, activeCompany]);

  const passingCount = useMemo(
    () => evaluatedList.filter((e) => e.passesHardFilters).length,
    [evaluatedList]
  );

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

  // Doğal dil cümlesinden kriterleri otomatik uygula
  const handleApplyPrompt = () => {
    const parsed = parseNaturalLanguageCriteria(activeCompany.naturalLanguagePrompt);
    updateActiveCompany((prev) => ({
      ...prev,
      targetGender: parsed.gender ?? prev.targetGender,
      strictGender: parsed.gender ? parsed.gender !== "Farketmez" : prev.strictGender,
      minAge: parsed.minAge ?? prev.minAge,
      maxAge: parsed.maxAge ?? prev.maxAge,
      requiredSkills: parsed.skills.length > 0 ? parsed.skills : prev.requiredSkills,
    }));
  };

  // İK "Uygun" veya "Ele" dediğinde şirket tercihlerini sessizce öğren
  const handleFeedback = (cv: CandidateCV, decision: "approved" | "rejected") => {
    const norm = normalizeTr(cv.rawText);
    const learnableTerms = [
      "cmake",
      "spring boot",
      "stl",
      "boost",
      "multithreading",
      "linux",
      "microservices",
      "hibernate",
      "postgresql",
      "solidworks",
      "sap fi",
    ];

    updateActiveCompany((prev) => {
      const updatedWeights = { ...prev.learnedKeywordWeights };
      for (const term of learnableTerms) {
        if (norm.includes(term)) {
          const cur = updatedWeights[term] || 0;
          updatedWeights[term] =
            decision === "approved" ? Math.min(15, cur + 4) : Math.max(-15, cur - 3);
        }
      }

      const approvedIds =
        decision === "approved"
          ? Array.from(new Set([...prev.approvedCandidateIds, cv.id]))
          : prev.approvedCandidateIds.filter((id) => id !== cv.id);

      const rejectedIds =
        decision === "rejected"
          ? Array.from(new Set([...prev.rejectedCandidateIds, cv.id]))
          : prev.rejectedCandidateIds.filter((id) => id !== cv.id);

      return {
        ...prev,
        learnedKeywordWeights: updatedWeights,
        feedbackCount: prev.feedbackCount + 1,
        approvedCandidateIds: approvedIds,
        rejectedCandidateIds: rejectedIds,
      };
    });
  };

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

  // Tarayıcıda doğrudan .ZIP arşivini açma (12 MB+ büyük ZIP'lerin Vercel 4.5MB limitine takılmasını %100 önler)
  const expandClientFiles = async (inputFiles: File[]): Promise<File[]> => {
    const expanded: File[] = [];
    const allowedExts = new Set(["pdf", "docx", "doc", "html", "htm", "txt", "md", "rar"]);

    for (const file of inputFiles) {
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
            if (!baseName || baseName.startsWith(".")) continue;
            const lower = baseName.toLowerCase();
            if (
              lower.includes("readme") ||
              lower.includes("sonuclar") ||
              lower.includes("__macosx")
            ) {
              continue;
            }
            const entryExt = baseName.split(".").pop()?.toLowerCase() || "";
            if (!allowedExts.has(entryExt)) continue;
            const blob = await entry.async("blob");
            expanded.push(new File([blob], baseName, { type: blob.type || "application/octet-stream" }));
          }
        } catch {
          // Eğer ZIP istemcide açılamazsa sunucuya gönder
          expanded.push(file);
        }
      } else if (allowedExts.has(ext)) {
        expanded.push(file);
      }
    }
    return expanded;
  };

  // ORTAK DOSYA İŞLEME MOTORU (Tıklama, Sürükle-Bırak, Klasör, Büyük ZIP ve Çoklu PDF Destekli)
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

      // Dosyaları sunucu limitlerine (Vercel 4.5MB) asla takılmaması için paketler (en fazla 5 dosya / ~3 MB) halinde gönder
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
              },
              idx: number
            ) => {
              const built = buildCandidateFromRaw(
                `cv-${Date.now()}-${totalParsedCount + idx}`,
                f.fullName,
                f.rawText,
                f.experienceYears,
                "Lisans",
                f.university,
                f.city,
                activeCompany.requiredSkills,
                f.fileName
              );
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
          setUploadExp(first.experienceYears);
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

  // Input üzerinden seçildiğinde (Çoklu Dosya veya Klasör)
  const handleDirectFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = Array.from(e.target.files);
    e.target.value = "";
    await processFiles(selected, true);
  };

  // Modal içinde dosya seçildiğinde de (1 dosya bile olsa) doğrudan otomatik analiz edip listeye ekle
  const handleModalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = Array.from(e.target.files);
    e.target.value = "";
    await processFiles(selected, true);
  };

  // Tarayıcının sürüklenen dosyayı yeni sekmede açmasını engelle ve pencereye dosya sürüklendiğinde yakala
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

  // Sürükle ve Bırak (Drag & Drop) Olay Yöneticileri (Klasör + ZIP + Çoklu Dosya Destekli)
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
    // Sadece ana kapsayıcıdan çıkıldığında kapat
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDropFiles = async (e: React.DragEvent, autoAdd = true) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const dt = e.dataTransfer;
    if (!dt) return;

    // 1. Önce klasör/dosya girişlerini (webkitGetAsEntry) senkron olarak yakala
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

    // Yedek olarak standart dt.files listesini de senkron kopyala
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

  // Modal üzerinden CV ekle
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
      "Yüklenen CV"
    );
    setCandidates((prev) => [newCV, ...prev]);
    setSelectedCandidateId(newId);
    setIsUploadModalOpen(false);
    setUploadName("");
    setUploadUni("");
    setUploadRawText("");
    setPdfParseStatus("");
  };

  // Gemini API ile Seçili Adayı Derin Analiz Et
  const handleRunGeminiAnalysis = async (cv: CandidateCV) => {
    setIsGeminiLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: cv.fullName,
          rawText: cv.rawText,
          requiredSkills: activeCompany.requiredSkills,
          apiKey: geminiApiKey.trim(),
        }),
      });
      const data = await res.json();
      if (data?.llmVerification?.executiveSummary) {
        setGeminiResults((prev) => ({
          ...prev,
          [cv.id]: data.llmVerification.executiveSummary,
        }));
      } else {
        setGeminiResults((prev) => ({
          ...prev,
          [cv.id]: `Analiz Özeti: Aday ${cv.detectedGender} (%${cv.genderConfidence}), ${
            cv.detectedAge ? `${cv.detectedAge} yaşında` : "yaş bilgisi incelendi"
          }.`,
        }));
      }
    } catch {
      // Fallback
    } finally {
      setIsGeminiLoading(false);
    }
  };

  // Yeni Şirket oluştur
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

  return (
    <div
      className="min-h-screen bg-zinc-50 text-zinc-900"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDropFiles(e, true)}
    >
      {/* =====================================================================
          1. SADE ÜST BAR (HEADER)
         ===================================================================== */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Sol: Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded bg-zinc-900 text-white flex items-center justify-center font-bold text-xs">
              CV
            </div>
            <span className="font-semibold text-base tracking-tight text-zinc-950 whitespace-nowrap">
              CV Reader AI
            </span>
          </div>

          {/* Sağ: Etiketleme & Excel İndir */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/label"
              className="px-3 py-1.5 rounded-md border border-zinc-900 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              Etiketle &amp; Başarı Ölç
            </Link>

            {candidates.length > 0 && (
              <>
                <button
                  onClick={() =>
                    exportEvaluationsToExcelXlsx(
                      displayedEvaluations.length > 0 ? displayedEvaluations : evaluatedList,
                      activeCompany.name
                    )
                  }
                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Yüklenen tüm CV'lerin Yaş, Cinsiyet ve Derece Bazlı (Ön Lisans / Lisans / Master / Doktora) Üniversite-Bölüm dökümünü Excel (.xlsx) olarak indir"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel İndir (.xlsx) ({displayedEvaluations.length > 0 ? displayedEvaluations.length : evaluatedList.length})
                </button>

                <button
                  onClick={() => {
                    setCandidates([]);
                    setSelectedCandidateId("");
                  }}
                  className="px-3 py-1.5 rounded-md border border-zinc-200 hover:border-red-600 hover:text-red-600 text-zinc-600 text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Tümünü Temizle
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Tam Ekran Sürükle-Bırak Katmanı (Sayfanın herhangi bir yerine sürüklenince açılır) */}
        {isDragging && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDropFiles(e, true)}
            className="fixed inset-0 z-50 bg-teal-950/40 backdrop-blur-[2px] flex items-center justify-center p-6"
          >
            <div className="bg-white border-2 border-dashed border-teal-600 rounded-2xl p-10 max-w-lg w-full text-center shadow-2xl pointer-events-none">
              <FileUp className="w-12 h-12 text-teal-600 mx-auto mb-3 animate-bounce" />
              <h3 className="text-lg font-bold text-zinc-950">
                CV Dosyalarını, Klasörü veya .ZIP / .RAR Arşivini Bırakın
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                30-40+ CV&apos;yi aynı anda bırakabilirsiniz; yaş, cinsiyet ve derece bazlı eğitimleri çıkarılıp Excel&apos;e hazır hale getirilir.
              </p>
            </div>
          </div>
        )}

        {/* Canlı Yükleme & Analiz Durum Çubuğu */}
        {(isParsingPdf || pdfParseStatus) && (
          <div
            className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 text-xs font-medium ${
              pdfParseStatus.startsWith("⚠️")
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-teal-50 border-teal-200 text-teal-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isParsingPdf && <Loader2 className="w-4 h-4 text-teal-600 animate-spin shrink-0" />}
              <span>{pdfParseStatus || "Dosyalar okunuyor..."}</span>
            </div>
            {!isParsingPdf && pdfParseStatus && (
              <button
                onClick={() => setPdfParseStatus("")}
                className="text-zinc-400 hover:text-zinc-700 text-sm font-bold px-1 cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* =====================================================================
            3. HER ZAMAN GÖRÜNÜR SÜRÜKLE & BIRAK (DRAG & DROP) ALANI
               (1 CV yüklense de 40 CV yüklense de kaybolmaz, her an sürüklenebilir)
           ===================================================================== */}
        <section
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDropFiles(e, true)}
          className={`bg-white border-2 border-dashed rounded-xl transition-all shadow-xs ${
            candidates.length === 0 ? "p-10" : "p-5"
          } ${
            isDragging
              ? "border-teal-600 bg-teal-50/80 scale-[1.005]"
              : "border-teal-500/60 hover:border-teal-600 bg-teal-50/20"
          }`}
        >
          <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-600/10 border border-teal-600/20 flex items-center justify-center shrink-0">
                {isParsingPdf ? (
                  <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                ) : (
                  <FileUp className="w-6 h-6 text-teal-700" />
                )}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-zinc-950">
                  {isDragging
                    ? "Dosyaları veya Klasörü Şimdi Buraya Bırakın!"
                    : candidates.length === 0
                    ? "30–40+ CV Dosyasını, Klasörü veya .ZIP / .RAR Arşivini Buraya Sürükleyip Bırakın"
                    : `Yeni CV'leri, Klasörü veya .ZIP Arşivini Buraya Sürükleyip Bırakın (${candidates.length} CV Yüklü)`}
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Masaüstünden <strong>30–40+ adet .PDF, .DOCX, .HTML, .ZIP, .RAR</strong> dosyasını veya doğrudan <strong>klasörü</strong> bu kutunun içine sürükleyin. Otomatik olarak Yaş, Cinsiyet ve Ön Lisans / Lisans / Master / Doktora bilgileri çıkarılır.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
              {/* Çoklu Dosya Seç Butonu */}
              <label className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Çoklu Dosya Seç (PDF / ZIP)
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.html,.htm,.zip,.rar,.txt,.md,text/html,application/pdf,application/zip,application/x-rar-compressed,application/vnd.rar,application/x-zip-compressed,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleDirectFilesUpload}
                  className="hidden"
                />
              </label>

              {/* Klasör Seç Butonu */}
              <label className="px-3.5 py-2.5 rounded-lg border border-zinc-300 bg-white hover:border-zinc-900 text-zinc-800 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors whitespace-nowrap">
                📁 Klasör Seç (Toplu)
                <input
                  type="file"
                  multiple
                  {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                  onChange={handleDirectFilesUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </section>

        {/* =====================================================================
            4. SONUÇLAR (KART GÖRÜNÜMÜ VEYA TOPLU TABLO / EXCEL ÖNİZLEME)
           ===================================================================== */}
        {candidates.length > 0 && (
          <div className="space-y-4">
            {/* ÜST TOPLU İŞLEM & EXCEL EXPORT BARI */}
            <div className="bg-white border border-zinc-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5">
                  <button
                    onClick={() => setLayoutMode("split")}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      layoutMode === "split"
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    📋 Kart &amp; Detay Görünümü
                  </button>
                  <button
                    onClick={() => setLayoutMode("table")}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      layoutMode === "table"
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    Toplu Tablo / Excel Önizleme ({displayedEvaluations.length} CV)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() =>
                    exportEvaluationsToExcelXlsx(displayedEvaluations, activeCompany.name)
                  }
                  disabled={displayedEvaluations.length === 0}
                  className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Excel Olarak İndir (.xlsx) — {displayedEvaluations.length} CV
                </button>
              </div>
            </div>

            {layoutMode === "table" ? (
              /* ===============================================================
                 TOPLU TABLO / EXCEL ÖNİZLEME GÖRÜNÜMÜ (30-40+ CV İÇİN)
                 =============================================================== */
              <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-xs">
                <div className="p-4 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-sm text-zinc-950">
                      Toplu CV &amp; Derece Bazlı Eğitim Tablosu ({displayedEvaluations.length} Aday)
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Excel (.xlsx) çıktısında yer alacak tüm yaş, cinsiyet ve Ön Lisans / Lisans / Yüksek Lisans / Doktora üniversite-bölüm verileri
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tabloda ara..."
                        className="pl-8 pr-2.5 py-1 border border-zinc-200 rounded text-xs focus:outline-none focus:border-zinc-900 w-44"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[680px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-zinc-900 text-white sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">#</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Ad Soyad / Dosya</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Cinsiyet</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Yaş</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Eğitim Dereceleri</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Ön Lisans (Üni — Bölüm)</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Lisans (Üni — Bölüm)</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Yüksek Lisans / Master (Üni — Bölüm)</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Doktora / Ph.D. (Üni — Bölüm)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {displayedEvaluations.map((item, idx) => {
                        const degMap = getCandidateDegreeMap(item.cv);
                        const activeDegrees = DEGREE_CARDS.filter((d) => degMap[d.key] !== null);
                        const ageMissing = isAgeMissingCase(item.cv);

                        const renderDegreeCell = (slot: DegreeEducationEntry | null) => {
                          if (!slot) {
                            return <span className="text-zinc-300">—</span>;
                          }
                          return (
                            <div className="space-y-0.5 min-w-[170px]">
                              <div className="font-semibold text-zinc-900">{slot.university}</div>
                              <div className="text-[11px] text-teal-800">{slot.department}</div>
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
                            className="hover:bg-teal-50/40 cursor-pointer transition-colors align-top"
                          >
                            <td className="py-3 px-3 font-mono text-zinc-500">{idx + 1}</td>
                            <td className="py-3 px-3 min-w-[180px]">
                              <div className="font-bold text-zinc-950">{item.cv.fullName}</div>
                              <div className="text-[11px] text-zinc-400 truncate max-w-[210px]">
                                {item.cv.source}
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  item.cv.detectedGender === "Kadın"
                                    ? "bg-teal-50 text-teal-800 border border-teal-200"
                                    : item.cv.detectedGender === "Erkek"
                                    ? "bg-zinc-100 text-zinc-800 border border-zinc-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {item.cv.detectedGender}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {item.cv.detectedAge !== null ? (
                                <div>
                                  <span className="font-bold text-zinc-900">
                                    {item.cv.detectedAge} Yaş
                                  </span>
                                  <div className="text-[10px] text-zinc-400">
                                    {item.cv.ageMethod}
                                  </div>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                                  {ageMissing ? "Yaş & Üni Tarihi Yok" : "Belirsiz"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1 min-w-[130px]">
                                {activeDegrees.length > 0 ? (
                                  activeDegrees.map((d) => (
                                    <span
                                      key={d.key}
                                      className="px-2 py-0.5 rounded bg-teal-50 text-teal-900 border border-teal-200 text-[11px] font-semibold whitespace-nowrap"
                                    >
                                      ✓ {d.shortTr}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-zinc-400">Belirtilmemiş</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3">{renderDegreeCell(degMap.associate)}</td>
                            <td className="py-3 px-3">{renderDegreeCell(degMap.bachelor)}</td>
                            <td className="py-3 px-3">{renderDegreeCell(degMap.master)}</td>
                            <td className="py-3 px-3">{renderDegreeCell(degMap.phd)}</td>
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
                <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-xs">
                  {/* Liste Başlığı */}
                  <div className="p-4 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-sm text-zinc-950">
                        Yüklenen CV&apos;ler ({candidates.length})
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Aday ara..."
                          className="pl-8 pr-2.5 py-1 border border-zinc-200 rounded text-xs focus:outline-none focus:border-zinc-900 w-36"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Aday Kartları */}
                  <div className="divide-y divide-zinc-100 max-h-[680px] overflow-y-auto">
                    {displayedEvaluations.length === 0 ? (
                      <div className="p-8 text-center text-sm text-zinc-500">
                        Aramanıza uygun aday bulunamadı.
                      </div>
                    ) : (
                      displayedEvaluations.map((item) => {
                        const isSelected = selectedEvaluation?.cv.id === item.cv.id;
                        const degMap = getCandidateDegreeMap(item.cv);
                        const activeDegrees = DEGREE_CARDS.filter((d) => degMap[d.key] !== null);
                        const ageMissing = isAgeMissingCase(item.cv);

                        return (
                          <div
                            key={item.cv.id}
                            onClick={() => setSelectedCandidateId(item.cv.id)}
                            className={`p-4 transition-colors cursor-pointer flex items-start justify-between gap-4 ${
                              isSelected
                                ? "bg-zinc-900 text-white"
                                : "bg-white hover:bg-zinc-50"
                            }`}
                          >
                            {/* Sol Bilgi */}
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm truncate">
                                  {item.cv.fullName}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    isSelected
                                      ? "bg-zinc-800 text-zinc-200"
                                      : item.cv.detectedGender === "Kadın"
                                      ? "bg-teal-50 text-teal-800"
                                      : "bg-zinc-100 text-zinc-700"
                                  }`}
                                >
                                  {item.cv.detectedGender}
                                </span>
                                <span
                                  className={`text-xs ${
                                    isSelected ? "text-zinc-300" : "text-zinc-500"
                                  }`}
                                >
                                  •{" "}
                                  {item.cv.detectedAge !== null
                                    ? `${item.cv.detectedAge} Yaş`
                                    : ageMissing
                                    ? "Yaş & Üni Tarihi Yok (Belirsiz)"
                                    : "Yaş Belirtilmemiş"}
                                </span>
                              </div>

                              {/* Derece Bazlı Eğitim Özeti (Label sayfasındaki gibi) */}
                              {activeDegrees.length > 0 && (
                                <div className="space-y-1 pt-0.5">
                                  {activeDegrees.map((deg) => {
                                    const slot = degMap[deg.key];
                                    if (!slot) return null;
                                    return (
                                      <div
                                        key={deg.key}
                                        className={`text-xs flex flex-wrap items-center gap-1.5 ${
                                          isSelected ? "text-zinc-300" : "text-zinc-600"
                                        }`}
                                      >
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                            isSelected
                                              ? "bg-teal-900/70 text-teal-200 border border-teal-700"
                                              : "bg-teal-50 text-teal-800 border border-teal-200"
                                          }`}
                                        >
                                          {deg.shortTr}
                                        </span>
                                        <span
                                          className={`font-medium ${
                                            isSelected ? "text-white" : "text-zinc-900"
                                          }`}
                                        >
                                          {slot.university}
                                        </span>
                                        <span className={isSelected ? "text-zinc-500" : "text-zinc-400"}>
                                          —
                                        </span>
                                        <span className={isSelected ? "text-teal-300" : "text-teal-800"}>
                                          {slot.department}
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
                                onClick={() => handleDeleteCandidate(item.cv.id)}
                                title="CV'yi Kaldır"
                                className={`p-1.5 rounded border cursor-pointer ${
                                  isSelected
                                    ? "border-zinc-700 text-zinc-400 hover:text-red-400"
                                    : "border-zinc-200 text-zinc-400 hover:text-red-600"
                                }`}
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

                {/* SAĞ: SEÇİLİ ADAYIN SADE ÖZETİ VE CV'Sİ (5 Sütun) */}
                <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-lg p-5 shadow-xs space-y-5">
                  {selectedEvaluation ? (
                    (() => {
                      const degMap = getCandidateDegreeMap(selectedEvaluation.cv);
                      const activeDegrees = DEGREE_CARDS.filter((d) => degMap[d.key] !== null);
                      const ageMissing = isAgeMissingCase(selectedEvaluation.cv);

                      return (
                        <>
                          {/* Aday Başlığı */}
                          <div className="border-b border-zinc-100 pb-4">
                            <h3 className="text-lg font-bold text-zinc-950">
                              {selectedEvaluation.cv.fullName}
                            </h3>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {selectedEvaluation.cv.university}
                              {selectedEvaluation.cv.department &&
                              selectedEvaluation.cv.department !== "Belirtilmemiş"
                                ? ` — ${selectedEvaluation.cv.department}`
                                : ""}{" "}
                              • {selectedEvaluation.cv.city} • {selectedEvaluation.cv.source}
                            </p>
                          </div>

                          {/* Yapay Zeka Tespit Özeti */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-zinc-500 uppercase">
                                Yapay Zeka Tespit Özeti
                              </span>
                            </div>

                            {/* Cinsiyet Tespiti */}
                            <div className="p-3 rounded-md bg-zinc-50 border border-zinc-100 text-xs space-y-1">
                              <div className="font-semibold text-zinc-900">
                                Cinsiyet: {selectedEvaluation.cv.detectedGender}
                              </div>
                              <p className="text-zinc-600">
                                {selectedEvaluation.cv.genderEvidence
                                  .map((e) => e.signal.replace(/%\d+(\.\d+)?\s*/g, ""))
                                  .slice(0, 2)
                                  .join(" + ")}
                              </p>
                            </div>

                            {/* Yaş Tespiti */}
                            <div className="p-3 rounded-md bg-zinc-50 border border-zinc-100 text-xs space-y-1">
                              <div className="flex items-center justify-between font-semibold text-zinc-900">
                                <span>
                                  Yaş:{" "}
                                  {selectedEvaluation.cv.detectedAge !== null
                                    ? `${selectedEvaluation.cv.detectedAge} Yaşında`
                                    : ageMissing
                                    ? "Yaş & Üni Tarihi Yok (Belirsiz)"
                                    : "Belirsiz"}
                                </span>
                                <span className="text-zinc-500">
                                  {selectedEvaluation.cv.ageMethod}
                                </span>
                              </div>
                              <p className="text-zinc-600">{selectedEvaluation.cv.ageEvidence}</p>
                            </div>

                            {/* Derece Bazlı Eğitim Tespiti (Label Sayfası Formatında) */}
                            <div className="p-3.5 rounded-md bg-zinc-50 border border-zinc-200/80 text-xs space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-zinc-900 flex items-center gap-1.5">
                                  <GraduationCap className="w-4 h-4 text-teal-700" />
                                  Eğitim Dereceleri &amp; Üniversite / Bölüm
                                </span>
                                <span className="text-[11px] font-semibold text-teal-700">
                                  {activeDegrees.length > 0
                                    ? activeDegrees.map((d) => d.shortTr).join(" + ")
                                    : "Belirtilmemiş"}
                                </span>
                              </div>

                              {/* 4 Derece Göstergesi (Ön Lisans / Lisans / Yüksek Lisans / Doktora) */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {DEGREE_CARDS.map((deg) => {
                                  const isHas = degMap[deg.key] !== null;
                                  return (
                                    <div
                                      key={deg.key}
                                      className={`px-2 py-1.5 rounded border text-center font-semibold text-[11px] ${
                                        isHas
                                          ? "bg-teal-600 text-white border-teal-600"
                                          : "bg-white text-zinc-400 border-zinc-200"
                                      }`}
                                    >
                                      {isHas ? "✓ " : ""}
                                      {deg.shortTr}
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
                                        className="p-2.5 rounded-md bg-white border border-teal-200/90 space-y-1.5"
                                      >
                                        <div className="flex items-center justify-between border-b border-zinc-100 pb-1">
                                          <span className="font-bold text-teal-900 text-[11px]">
                                            🎓 {deg.cardTitle}
                                          </span>
                                          <span className="text-[10px] font-medium text-zinc-400">
                                            {deg.shortEn}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                                          <div>
                                            <div className="text-[10px] font-semibold text-zinc-400 uppercase">
                                              {deg.uniLabel}
                                            </div>
                                            <div className="font-semibold text-zinc-900 mt-0.5">
                                              {slot.university}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-[10px] font-semibold text-zinc-400 uppercase">
                                              {deg.deptLabel}
                                            </div>
                                            <div className="font-semibold text-teal-800 mt-0.5">
                                              {slot.department}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-zinc-500">
                                  CV metninde açık bir üniversite veya bölüm bilgisi tespit edilemedi.
                                </p>
                              )}
                            </div>

                            {/* Yetenek Kanıtları */}
                            {selectedEvaluation.skillAssessments.map((sa) => (
                              <div
                                key={sa.skill}
                                className="p-3 rounded-md bg-zinc-50 border border-zinc-100 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between font-semibold text-zinc-900">
                                  <span className="flex items-center gap-1.5">
                                    {sa.level === "Uzman / Proje Kanıtlı" ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                                    ) : (
                                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                    )}
                                    {sa.skill}
                                  </span>
                                  <span
                                    className={
                                      sa.level === "Uzman / Proje Kanıtlı"
                                        ? "text-teal-700"
                                        : "text-amber-700"
                                    }
                                  >
                                    {sa.level}
                                  </span>
                                </div>
                                <p className="text-zinc-600 italic">
                                  &ldquo;{sa.evidenceSnippet}&rdquo;
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* CV Metni */}
                          <div>
                            <div className="text-xs font-semibold text-zinc-500 uppercase mb-2 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5" />
                              Okunan CV Metni
                            </div>
                            <pre className="p-3.5 rounded-md bg-zinc-900 text-zinc-200 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                              {selectedEvaluation.cv.rawText}
                            </pre>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <div className="text-sm text-zinc-500 py-8 text-center">
                      Detayları görmek için soldaki listeden bir adaya tıklayın.
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* =====================================================================
          MODAL 1: TOPLU CV YÜKLE (30-40+ PDF, WORD, KLASÖR, ZIP, RAR DESTEKLİ)
         ===================================================================== */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-zinc-200 max-w-lg w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-zinc-950">
                  Toplu CV Yükle (Sürükle &amp; Bırak / Çoklu Dosya / Klasör)
                </h3>
                <p className="text-xs text-zinc-500">
                  30–40+ adet PDF (.pdf), Word (.docx), HTML, ZIP, RAR veya doğrudan klasör seçtiğiniz anda otomatik eklenir
                </p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* PDF / DOCX / HTML / ZIP Dosya Seçim ve Sürükle-Bırak Kutusu */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropFiles(e, true)}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                isDragging
                  ? "border-teal-600 bg-teal-100/60"
                  : "border-teal-500/60 hover:border-teal-600 bg-teal-50/40"
              }`}
            >
              <FileUp className="w-9 h-9 text-teal-600 mx-auto mb-2" />
              <span className="block text-sm font-bold text-zinc-950">
                {isDragging
                  ? "Dosyaları veya Klasörü Buraya Bırakın!"
                  : "30–40+ CV Dosyasını veya Klasörü Buraya Sürükleyip Bırakın"}
              </span>
              <span className="block text-xs text-zinc-500 mt-1 mb-4">
                Desteklenenler: <strong>.PDF, .DOCX, .HTML, .ZIP, .RAR, .TXT</strong> (Çoklu seçimde veya sürüklediğinizde tek tek onay sormadan hepsi otomatik analiz edilip eklenir)
              </span>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <label className="px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Çoklu Dosya Seç (30–40+ CV)
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.html,.htm,.zip,.rar,.txt,.md,text/html,application/pdf,application/zip,application/x-rar-compressed,application/vnd.rar,application/x-zip-compressed,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleModalFileSelect}
                    className="hidden"
                  />
                </label>

                <label className="px-3.5 py-2 rounded-md border border-zinc-300 bg-white hover:border-zinc-900 text-zinc-800 text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                  📁 Klasör Seç (Tüm Klasörü Yükle)
                  <input
                    type="file"
                    multiple
                    {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                    onChange={handleModalFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {isParsingPdf && (
              <div className="flex items-center gap-2 text-xs text-teal-700 font-medium bg-teal-50 p-2.5 rounded">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{pdfParseStatus || "CV dosyaları okunuyor..."}</span>
              </div>
            )}

            {pdfParseStatus && !isParsingPdf && (
              <div className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 p-2.5 rounded">
                {pdfParseStatus}
              </div>
            )}

            <details className="border border-zinc-200 rounded-md p-3 bg-zinc-50/60">
              <summary className="text-xs font-semibold text-zinc-600 cursor-pointer select-none">
                Metin Kopyala / Yapıştır ile Manuel Tek CV Ekle (Opsiyonel)
              </summary>
              <form onSubmit={handleAddCV} className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Ad Soyad *
                    </label>
                    <input
                      type="text"
                      required
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="Aday Adı Soyadı"
                      className="w-full border border-zinc-200 rounded bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Üniversite
                    </label>
                    <input
                      type="text"
                      value={uploadUni}
                      onChange={(e) => setUploadUni(e.target.value)}
                      placeholder="Otomatik tespit edilir"
                      className="w-full border border-zinc-200 rounded bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    CV Metni *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={uploadRawText}
                    onChange={(e) => setUploadRawText(e.target.value)}
                    placeholder="CV metnini buraya yapıştırabilirsiniz..."
                    className="w-full border border-zinc-200 rounded bg-white p-2.5 text-xs font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={isParsingPdf}
                    className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-medium cursor-pointer"
                  >
                    Metinden Analiz Et ve Ekle
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-zinc-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-bold text-base text-zinc-950">Yeni Şirket Ekle</h3>
              <button
                onClick={() => setIsNewCompanyModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Şirket Adı *
                </label>
                <input
                  type="text"
                  required
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  placeholder="Örn: ABC Yazılım"
                  className="w-full border border-zinc-200 rounded px-3 py-1.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Cinsiyet</label>
                  <select
                    value={newCompGender}
                    onChange={(e) =>
                      setNewCompGender(e.target.value as "Kadın" | "Erkek" | "Farketmez")
                    }
                    className="w-full border border-zinc-200 rounded px-2 py-1.5 text-xs"
                  >
                    <option value="Kadın">Kadın</option>
                    <option value="Erkek">Erkek</option>
                    <option value="Farketmez">Farketmez</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Min Yaş</label>
                  <input
                    type="number"
                    value={newCompMinAge}
                    onChange={(e) => setNewCompMinAge(Number(e.target.value))}
                    className="w-full border border-zinc-200 rounded px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Max Yaş</label>
                  <input
                    type="number"
                    value={newCompMaxAge}
                    onChange={(e) => setNewCompMaxAge(Number(e.target.value))}
                    className="w-full border border-zinc-200 rounded px-2 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Aranan Yetenekler (Virgülle ayırın)
                </label>
                <input
                  type="text"
                  value={newCompSkills}
                  onChange={(e) => setNewCompSkills(e.target.value)}
                  placeholder="C++, Java"
                  className="w-full border border-zinc-200 rounded px-3 py-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCompanyModalOpen(false)}
                  className="px-4 py-1.5 border border-zinc-200 rounded text-xs cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-zinc-900 text-white rounded text-xs font-medium cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
