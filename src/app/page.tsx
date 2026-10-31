"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  CandidateCV,
  CompanyProfile,
  EvaluatedCandidate,
  DegreeKey,
  DegreeEducationEntry,
  evaluateCandidateForCompany,
  extractCandidateMetadataFromText,
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

const candidateDegreeMapCache = new WeakMap<
  CandidateCV,
  Record<DegreeKey, DegreeEducationEntry | null>
>();

function getCandidateDegreeMap(
  cv: CandidateCV
): Record<DegreeKey, DegreeEducationEntry | null> {
  const cached = candidateDegreeMapCache.get(cv);
  if (cached) return cached;

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

  const computed: Record<DegreeKey, DegreeEducationEntry | null> = {
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

  candidateDegreeMapCache.set(cv, computed);
  return computed;
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
    <fill><patternFill patternType="solid"><fgColor rgb="FF182235"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
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
  // Dil Seçeneği (TR / EN)
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
  const [visibleLimit, setVisibleLimit] = useState<number>(100);

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
  const [newCompGender] = useState<"Kadın" | "Erkek" | "Farketmez">("Farketmez");
  const [newCompMinAge] = useState<number>(18);
  const [newCompMaxAge] = useState<number>(45);
  const [newCompSkills, setNewCompSkills] = useState<string>("");

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) || companies[0],
    [companies, activeCompanyId]
  );

  // 1000+ CV performansı için aday bazlı değerlendirme önbelleği (O(1) yeniden kullanım)
  const evaluationCacheRef = useRef<
    Map<string, { cvRef: CandidateCV; compRef: CompanyProfile; evaluated: EvaluatedCandidate }>
  >(new Map());

  // Adayları aktif şirket kriterlerine göre değerlendir ve sırala
  const evaluatedList = useMemo(() => {
    const cache = evaluationCacheRef.current;
    const list = candidates.map((cv) => {
      const existing = cache.get(cv.id);
      if (
        existing &&
        existing.cvRef === cv &&
        existing.compRef === activeCompany
      ) {
        return existing.evaluated;
      }
      const evaluated = evaluateCandidateForCompany(cv, activeCompany);
      cache.set(cv.id, { cvRef: cv, compRef: activeCompany, evaluated });
      return evaluated;
    });
    list.sort((a, b) => b.totalMatchScore - a.totalMatchScore);
    return list;
  }, [candidates, activeCompany]);

  // Arama değiştiğinde görünür pencereyi sıfırla
  useEffect(() => {
    setVisibleLimit(100);
  }, [searchQuery]);

  // Ekranda gösterilecek adaylar (Arama filtresi tüm 1000+ aday üzerinde çalışır)
  const displayedEvaluations = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (trimmed === "") return evaluatedList;
    const q = normalizeTr(trimmed);
    return evaluatedList.filter((item) => {
      if (normalizeTr(item.cv.fullName).includes(q)) return true;
      if (normalizeTr(item.cv.university).includes(q)) return true;
      if (item.cv.department && normalizeTr(item.cv.department).includes(q)) return true;
      if (item.cv.source && normalizeTr(item.cv.source).includes(q)) return true;
      return normalizeTr(item.cv.rawText).includes(q);
    });
  }, [evaluatedList, searchQuery]);

  // DOM'da aynı anda render edilen aday dilimi (1000+ CV'de sıfır kasma için kademeli pencereleme)
  const visibleEvaluations = useMemo(
    () => displayedEvaluations.slice(0, visibleLimit),
    [displayedEvaluations, visibleLimit]
  );

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (visibleLimit >= displayedEvaluations.length) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
      setVisibleLimit((prev) =>
        Math.min(displayedEvaluations.length, prev + 100)
      );
    }
  };

  const selectedEvaluation = useMemo(() => {
    return (
      displayedEvaluations.find((e) => e.cv.id === selectedCandidateId) ||
      displayedEvaluations[0] ||
      evaluatedList[0]
    );
  }, [evaluatedList, displayedEvaluations, selectedCandidateId]);

  const handleDeleteCandidate = (id: string) => {
    evaluationCacheRef.current.delete(id);
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  const formatSubfolderAwareFileName = (
    baseName: string,
    parentFolder?: string
  ): string => {
    const cleanBase = baseName.split(/[\\/]/).pop() || baseName;
    if (!parentFolder) return cleanBase;
    const stem = cleanBase.replace(/\.[a-zA-Z0-9]+$/, "").trim();
    const isGeneric =
      /^(?:cv|resume|ozgecmis|özgeçmiş|belge|document|file|scan|untitled|1|2|3)$/i.test(
        stem
      );
    if (
      isGeneric &&
      !/^(?:cv|cvs|resumes|ozgecmisler|özgeçmişler|adaylar|candidates|files|folder|yeni\s*klasör)$/i.test(
        parentFolder
      )
    ) {
      return `${parentFolder} - ${cleanBase}`;
    }
    return cleanBase;
  };

  const readEntryRecursively = async (
    entry: FileSystemEntry,
    parentDirName = ""
  ): Promise<File[]> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      return new Promise<File[]>((resolve) => {
        fileEntry.file(
          (f) => {
            const awareName = formatSubfolderAwareFileName(
              f.name,
              parentDirName
            );
            if (awareName !== f.name) {
              resolve([
                new File([f], awareName, {
                  type: f.type || "application/octet-stream",
                }),
              ]);
            } else {
              resolve([f]);
            }
          },
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
      const nested = await Promise.all(
        allEntries.map((child) => readEntryRecursively(child, dirEntry.name))
      );
      return nested.flat();
    }
    return [];
  };

  const isIgnoredHelperFile = (baseName: string): boolean => {
    if (!baseName || baseName.startsWith(".") || baseName.startsWith("~$")) {
      return true;
    }
    const lower = baseName.toLowerCase();
    return (
      lower.includes("readme") ||
      lower.includes("sonuclar") ||
      lower.includes("__macosx") ||
      lower === "desktop.ini" ||
      lower === "thumbs.db" ||
      lower.endsWith(".json") ||
      lower.endsWith(".DS_Store".toLowerCase())
    );
  };

  const expandClientFiles = async (
    inputFiles: File[],
    depth = 0
  ): Promise<File[]> => {
    const expanded: File[] = [];
    const allowedDocExts = new Set([
      "pdf",
      "docx",
      "doc",
      "html",
      "htm",
      "txt",
      "md",
      "rtf",
    ]);

    for (const file of inputFiles) {
      const relPath =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;
      const pathParts = relPath.split(/[\\/]/).filter(Boolean);
      const baseTop = pathParts[pathParts.length - 1] || file.name;
      const parentFolder =
        pathParts.length >= 2 ? pathParts[pathParts.length - 2] : "";

      if (isIgnoredHelperFile(baseTop)) continue;
      const ext = baseTop.split(".").pop()?.toLowerCase() || "";

      if (ext === "zip" && depth < 2) {
        try {
          setPdfParseStatus(`"${baseTop}" arşivi tarayıcıda açılıyor...`);
          const JSZip = (await import("jszip")).default;
          const buf = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(buf);
          const entries = Object.values(zip.files).filter((e) => !e.dir);
          for (const entry of entries) {
            const eParts = entry.name.split(/[\\/]/).filter(Boolean);
            const baseName = eParts[eParts.length - 1] || entry.name;
            const eParent =
              eParts.length >= 2 ? eParts[eParts.length - 2] : "";
            if (isIgnoredHelperFile(baseName)) continue;
            const entryExt = baseName.split(".").pop()?.toLowerCase() || "";
            if (entryExt === "zip" || entryExt === "rar") {
              const nestedBlob = await entry.async("blob");
              const nestedFile = new File([nestedBlob], baseName);
              const subExpanded = await expandClientFiles(
                [nestedFile],
                depth + 1
              );
              expanded.push(...subExpanded);
              continue;
            }
            if (!allowedDocExts.has(entryExt)) continue;
            const blob = await entry.async("blob");
            const finalName = formatSubfolderAwareFileName(baseName, eParent);
            expanded.push(
              new File([blob], finalName, {
                type: blob.type || "application/octet-stream",
              })
            );
          }
        } catch {
          expanded.push(file);
        }
      } else if (ext === "rar" && depth < 2) {
        try {
          setPdfParseStatus(`"${baseTop}" RAR arşivi tarayıcıda açılıyor...`);
          const { createExtractorFromData } = await import("node-unrar-js");
          const buf = await file.arrayBuffer();
          const extractor = await createExtractorFromData({ data: buf });
          const extracted = extractor.extract();
          for (const item of extracted.files) {
            if (item.fileHeader.flags.directory || !item.extraction) continue;
            const eParts = item.fileHeader.name.split(/[\\/]/).filter(Boolean);
            const baseName = eParts[eParts.length - 1] || item.fileHeader.name;
            const eParent =
              eParts.length >= 2 ? eParts[eParts.length - 2] : "";
            if (isIgnoredHelperFile(baseName)) continue;
            const entryExt = baseName.split(".").pop()?.toLowerCase() || "";
            if (!allowedDocExts.has(entryExt)) continue;
            const entryBuf = item.extraction.buffer.slice(
              item.extraction.byteOffset,
              item.extraction.byteOffset + item.extraction.byteLength
            ) as ArrayBuffer;
            const finalName = formatSubfolderAwareFileName(baseName, eParent);
            expanded.push(
              new File([entryBuf], finalName, {
                type: "application/octet-stream",
              })
            );
          }
        } catch {
          expanded.push(file);
        }
      } else if (allowedDocExts.has(ext)) {
        const finalName = formatSubfolderAwareFileName(baseTop, parentFolder);
        if (finalName !== file.name) {
          expanded.push(
            new File([file], finalName, {
              type: file.type || "application/octet-stream",
            })
          );
        } else {
          expanded.push(file);
        }
      }
    }
    return expanded;
  };

  type ServerParsedFileItem = {
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
  };

  // Büyük dosyalar (>3.2 MB) veya ağ/sunucu hatası durumları için %100 Tarayıcı İçi (Client-Side) Yedek Okuyucu
  const parseSingleFileClientFallback = async (
    file: File
  ): Promise<ServerParsedFileItem | null> => {
    try {
      const fileName = file.name || "cv.pdf";
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const arrayBuffer = await file.arrayBuffer();
      let extractedText = "";

      if (ext === "pdf") {
        try {
          const { extractText, getDocumentProxy } = await import("unpdf");
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
              // ignore
            }
          }
        } catch {
          extractedText = "";
        }
      } else if (ext === "docx" || ext === "doc") {
        try {
          const mammoth = (await import("mammoth")).default;
          const res = await mammoth.extractRawText({ arrayBuffer });
          extractedText = res.value || "";
        } catch {
          extractedText = new TextDecoder("utf-8", { fatal: false }).decode(
            arrayBuffer
          );
        }
      } else {
        const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(
          arrayBuffer
        );
        extractedText = utf8.includes("\uFFFD")
          ? new TextDecoder("windows-1254", { fatal: false }).decode(
              arrayBuffer
            )
          : utf8;
        if (ext === "html" || ext === "htm") {
          extractedText = extractedText
            .replace(
              /<(script|style|svg|noscript|head)[^>]*>[\s\S]*?<\/\1>/gi,
              "\n"
            )
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }
      }

      const cleanText = extractedText.replace(/\r\n/g, "\n").trim();
      const meta = extractCandidateMetadataFromText(cleanText, fileName, false);
      return {
        fileName,
        rawText: cleanText,
        fullName: meta.fullName,
        university: meta.university,
        city: meta.city,
        experienceYears: meta.experienceYears,
      };
    } catch {
      return null;
    }
  };

  const mapParsedItemToCandidate = (
    f: ServerParsedFileItem,
    uniqueIdx: number
  ): CandidateCV => {
    const built = buildCandidateFromRaw(
      `cv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${uniqueIdx}`,
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
  };

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
        setPdfParseStatus(
          "⚠️ Desteklenen bir CV dosyası (.pdf, .docx, .html, .zip, .rar, .txt, .rtf) bulunamadı."
        );
        setIsParsingPdf(false);
        return;
      }

      const isBulkOrAuto = expandedFiles.length > 1 || autoAddSingleInModal;
      if (isBulkOrAuto) {
        setIsUploadModalOpen(false);
      }

      // Vercel 4.5MB serverless body limitine takılmamak için >3.2MB dosyaları ayırıp tarayıcıda işle
      const MAX_SINGLE_SERVER_BYTES = 3.2 * 1024 * 1024;
      const MAX_FILES_PER_BATCH = 8;
      const MAX_BYTES_PER_BATCH = 3.2 * 1024 * 1024;

      const oversizedFiles: File[] = [];
      const normalFiles: File[] = [];
      for (const f of expandedFiles) {
        if (f.size > MAX_SINGLE_SERVER_BYTES) {
          oversizedFiles.push(f);
        } else {
          normalFiles.push(f);
        }
      }

      const batches: File[][] = [];
      let currentBatch: File[] = [];
      let currentBytes = 0;

      for (const f of normalFiles) {
        if (
          currentBatch.length >= MAX_FILES_PER_BATCH ||
          (currentBatch.length > 0 &&
            currentBytes + f.size > MAX_BYTES_PER_BATCH)
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

      let totalParsedCount = 0;
      let processedFileCount = 0;
      let firstAddedId = "";
      let uniqueCounter = 0;

      const appendParsedItems = (items: ServerParsedFileItem[]) => {
        if (items.length === 0) return;
        if (isBulkOrAuto) {
          const addedCVs = items.map((item) =>
            mapParsedItemToCandidate(item, ++uniqueCounter)
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
          const first = items[0];
          setUploadName(first.fullName);
          setUploadUni(first.university);
          setUploadCity(first.city);
          setUploadRawText(first.rawText);
          totalParsedCount = 1;
          setPdfParseStatus(
            `✓ "${first.fileName}" okundu. "Analiz Et ve Ekle" butonuna basabilirsiniz.`
          );
        }
      };

      // 1) Önce >3.2MB olan yüksek boyutlu CV'leri tarayıcı içinde (413 hatası olmadan) çözümle
      for (const bigFile of oversizedFiles) {
        setPdfParseStatus(
          `Analiz ediliyor: ${processedFileCount} / ${expandedFiles.length} dosya işlendi...`
        );
        const fallbackItem = await parseSingleFileClientFallback(bigFile);
        processedFileCount += 1;
        if (fallbackItem) {
          appendParsedItems([fallbackItem]);
        }
      }

      // 2) Normal boyutlu CV gruplarını 3 paralel işçi (worker) ile hızlı ve hataya dayanıklı şekilde işle
      let nextBatchIdx = 0;
      const CONCURRENCY = Math.min(3, batches.length);

      const processSingleBatch = async (batch: File[]) => {
        try {
          const formData = new FormData();
          for (const f of batch) {
            formData.append("files", f);
          }

          const res = await fetch("/api/parse-cv", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.files && Array.isArray(data.files) && data.files.length > 0) {
              processedFileCount += batch.length;
              appendParsedItems(data.files);
              return;
            }
          }
        } catch {
          // Sunucu veya ağ hatası durumunda aşağıdaki tekil client-side fallback devreye girer
        }

        // Eğer toplu istek başarısız olduysa (örn. 413/500/504), gruptaki hiçbir CV'yi kaybetmemek için tarayıcıda tek tek çözümle!
        const recovered: ServerParsedFileItem[] = [];
        for (const f of batch) {
          const item = await parseSingleFileClientFallback(f);
          if (item) recovered.push(item);
        }
        processedFileCount += batch.length;
        appendParsedItems(recovered);
      };

      const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (nextBatchIdx < batches.length) {
          const currentIdx = nextBatchIdx++;
          const batch = batches[currentIdx];
          if (!batch) break;
          setPdfParseStatus(
            `Analiz ediliyor: ${processedFileCount} / ${expandedFiles.length} dosya işlendi...`
          );
          await processSingleBatch(batch);
        }
      });

      await Promise.all(workers);

      if (isBulkOrAuto) {
        if (totalParsedCount > 0) {
          setPdfParseStatus(
            `✓ Toplam ${totalParsedCount} adet CV başarıyla yüklendi ve analiz edildi.`
          );
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
      const nestedFiles = await Promise.all(
        entries.map((en) => readEntryRecursively(en))
      );
      const flatFiles = nestedFiles.flat();
      if (flatFiles.length > 0) {
        await processFiles(flatFiles, autoAdd);
        return;
      }
    }

    if (fallbackFiles.length > 0) {
      await processFiles(fallbackFiles, autoAdd);
    } else if (entries.length > 0) {
      const nestedFiles = await Promise.all(
        entries.map((en) => readEntryRecursively(en))
      );
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
      className="relative min-h-screen bg-[#cbc4b4] text-[#141c2b] overflow-x-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDropFiles(e, true)}
    >
      {/* =====================================================================
          0. TÜM SAYFAYA YAYILAN SÜREKLİ DÖNGÜDE İŞ MÜLAKATI ARKA PLAN VİDEOSU
             (GÖZ YORMAYAN KOYU TAŞ / KUMTAŞI-ARDUVAZ KATMANI İLE)
         ===================================================================== */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover scale-[1.02] filter brightness-[0.86] contrast-[1.02] saturate-[0.88]"
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
        {/* Göz Yormayan Yumuşak Koyu Kumtaşı / Taş-Arduvaz Katman (Beyaz parlama sıfır) */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#c4bdb0]/78 via-[#ccc5b7]/72 to-[#beb7a8]/82 backdrop-blur-[1px]" />
      </div>

      {/* =====================================================================
          1. ÜST BAR (NAVBAR — Koyu Oxford Arduvaz `#182235`, Göz Yormayan Kontrast)
         ===================================================================== */}
      <header className="bg-[#182235]/95 backdrop-blur-md border-b border-[#2c3a52] sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Sol: Logo & Başlık */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded bg-[#e2dcd0] text-[#182235] flex items-center justify-center font-serif-academic font-bold text-xs tracking-tight shadow-2xs">
              CV
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-serif-academic font-bold text-base sm:text-lg tracking-tight text-[#f0ece1] whitespace-nowrap">
                CV Reader AI
              </span>
              <span className="hidden md:inline-block text-slate-600">|</span>
              <span className="hidden md:inline-block text-xs text-[#b8b2a6] font-medium whitespace-nowrap">
                {t.brandSub}
              </span>
            </div>
          </div>

          {/* Orta: Tek Kelimelik Akıcı Menü Linkleri */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-[#d2ccc0]">
            <a
              href="#yukleme"
              className="hover:text-[#f0ece1] transition-colors whitespace-nowrap"
            >
              {t.navUpload}
            </a>
            <a
              href="#sistem"
              className="hover:text-[#f0ece1] transition-colors whitespace-nowrap"
            >
              {t.navSystem}
            </a>
            <a
              href="#ozellikler"
              className="hover:text-[#f0ece1] transition-colors whitespace-nowrap"
            >
              {t.navFeatures}
            </a>
            {candidates.length > 0 && (
              <a
                href="#sonuclar"
                className="text-[#93c5fd] hover:text-white transition-colors whitespace-nowrap"
              >
                {t.navResults} ({candidates.length})
              </a>
            )}
          </nav>

          {/* Sağ: Dil Seçici (TR | EN), Etiketleme & Excel İndir */}
          <div className="flex items-center gap-2 shrink-0">
            {/* TR | EN Dil Seçeneği */}
            <div
              className="inline-flex items-center rounded-md border border-[#33435e] bg-[#111927] p-0.5 shrink-0"
              role="group"
              aria-label="Language Switcher"
            >
              <Globe className="w-3.5 h-3.5 text-[#9ca3af] ml-1.5 mr-1 hidden sm:inline" />
              <button
                type="button"
                onClick={() => handleSwitchLang("tr")}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  lang === "tr"
                    ? "bg-[#e2dcd0] text-[#182235] shadow-2xs"
                    : "text-[#b8b2a6] hover:text-white"
                }`}
              >
                TR
              </button>
              <button
                type="button"
                onClick={() => handleSwitchLang("en")}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  lang === "en"
                    ? "bg-[#e2dcd0] text-[#182235] shadow-2xs"
                    : "text-[#b8b2a6] hover:text-white"
                }`}
              >
                EN
              </button>
            </div>

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
                  className="px-3.5 py-1.5 rounded-md bg-[#e2dcd0] hover:bg-[#ece7dc] text-[#182235] text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
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
                  className="px-2.5 py-1.5 rounded-md border border-[#384966] bg-[#1c283d] hover:border-red-400 hover:text-red-300 text-[#d2ccc0] text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
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
            className="fixed inset-0 z-50 bg-[#141c2b]/65 backdrop-blur-xs flex items-center justify-center p-6"
          >
            <div className="bg-[#e3ddd0] border-2 border-dashed border-[#182235] rounded-2xl p-10 max-w-lg w-full text-center shadow-2xl pointer-events-none">
              <FileUp className="w-12 h-12 text-[#182235] mx-auto mb-3 animate-bounce" />
              <h3 className="font-serif-academic text-xl font-bold text-[#141c2b]">
                {t.dragOverlayTitle}
              </h3>
              <p className="text-xs text-[#3b4454] mt-1.5 leading-relaxed">
                {t.dragOverlaySub}
              </p>
            </div>
          </div>
        )}

        {/* =====================================================================
            2. HERO TANITIM (ADAY YOKKEN) VEYA KOMPAKT AKADEMİK KOMUTA BARI (ADAY YÜKLÜYKEN)
           ===================================================================== */}
        {candidates.length === 0 ? (
          <section id="yukleme" className="space-y-7 pt-2">
            {/* Akademik Editoryal Başlık ve Değer Önerisi */}
            <div className="max-w-3xl space-y-3.5">
              <div className="text-[11px] font-mono-academic font-bold uppercase tracking-[0.2em] text-[#182235] border-l-2 border-[#182235] pl-2.5">
                {t.heroEyebrow}
              </div>
              <h1 className="font-serif-academic text-2xl sm:text-4xl font-bold tracking-tight text-[#121926] leading-[1.2]">
                {t.heroTitle}
              </h1>
              <p className="text-sm sm:text-base text-[#273142] leading-relaxed max-w-2xl">
                {t.heroDescStart}
                <strong className="text-[#121926] font-semibold">
                  {t.heroAge}
                </strong>
                ,{" "}
                <strong className="text-[#121926] font-semibold">
                  {t.heroGender}
                </strong>
                {t.heroAnd}
                <strong className="text-[#121926] font-semibold">
                  {t.heroDegrees}
                </strong>
                {t.heroDescMid}
                <strong className="text-[#182235] font-bold underline decoration-[#182235]/50 underline-offset-4">
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
                    ? "bg-[#e8dcc4] border-amber-700/40 text-amber-950"
                    : "bg-[#182235] border-[#2c3a52] text-[#f0ece1]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isParsingPdf && (
                    <Loader2 className="w-4 h-4 text-[#93c5fd] animate-spin shrink-0" />
                  )}
                  <span>
                    {translateParseStatus(pdfParseStatus, lang) ||
                      t.readingFiles}
                  </span>
                </div>
                {!isParsingPdf && pdfParseStatus && (
                  <button
                    onClick={() => setPdfParseStatus("")}
                    className="text-[#b8b2a6] hover:text-white text-sm font-bold px-1 cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            {/* ANA SAYFA SÜRÜKLE & BIRAK (DRAG & DROP) KARTI — Göz Yormayan Sıcak Taş (`#e2dcd0`) */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropFiles(e, true)}
              className={`bg-[#e2dcd0]/95 backdrop-blur-md border-2 border-dashed rounded-2xl p-7 sm:p-10 transition-all shadow-xl ${
                isDragging
                  ? "border-[#182235] bg-[#d8d1c3] scale-[1.005]"
                  : "border-[#182235]/50 hover:border-[#182235]"
              }`}
            >
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 text-center lg:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[#182235] text-[#f0ece1] flex items-center justify-center shrink-0 shadow-sm">
                    {isParsingPdf ? (
                      <Loader2 className="w-6 h-6 text-[#93c5fd] animate-spin" />
                    ) : (
                      <FileUp className="w-6 h-6 text-[#93c5fd]" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-serif-academic text-base sm:text-xl font-bold text-[#121926]">
                      {isDragging ? t.dropTitleDragging : t.dropTitleEmpty}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#333d4f] mt-1 leading-relaxed max-w-2xl">
                      {t.dropSubText}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
                  {/* Çoklu Dosya Seç Butonu */}
                  <label className="px-4 py-2.5 rounded-lg bg-[#182235] hover:bg-[#22304a] text-[#f0ece1] text-xs font-semibold cursor-pointer flex items-center gap-2 shadow-xs transition-colors whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5 text-[#93c5fd]" />
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
                  <label className="px-4 py-2.5 rounded-lg border border-[#a8a090] bg-[#d6cfc0] hover:bg-[#cbc3b3] hover:border-[#182235] text-[#141c2b] text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0">
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
              <div className="mt-6 pt-5 border-t border-[#c4bdb0] grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                <div className="flex items-start gap-2.5">
                  <span className="font-mono-academic text-xs font-bold text-[#182235] shrink-0">
                    01
                  </span>
                  <div className="text-xs text-[#333d4f]">
                    <strong className="text-[#121926] font-semibold block">
                      {t.step1Title}
                    </strong>
                    {t.step1Desc}
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="font-mono-academic text-xs font-bold text-[#182235] shrink-0">
                    02
                  </span>
                  <div className="text-xs text-[#333d4f]">
                    <strong className="text-[#121926] font-semibold block">
                      {t.step2Title}
                    </strong>
                    {t.step2Desc}
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="font-mono-academic text-xs font-bold text-[#182235] shrink-0">
                    03
                  </span>
                  <div className="text-xs text-[#333d4f]">
                    <strong className="text-[#121926] font-semibold block">
                      {t.step3Title}
                    </strong>
                    {t.step3Desc}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* =====================================================================
             2B & 3. ADAY YÜKLENDİĞİNDE DOĞRUDAN EKRANA GELEN AKADEMİK ÇALIŞMA ALANI
                     (Kompakt Üst Komuta & Yükleme Barı + Aday Karnesi & Matris)
             ===================================================================== */
          <section id="sonuclar" className="space-y-5">
            {/* KOMPAKT AKADEMİK KOMUTA & YENİ CV SÜRÜKLE-BIRAK BARI */}
            <div
              id="yukleme"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropFiles(e, true)}
              className={`rounded-xl border transition-all shadow-md overflow-hidden ${
                isDragging
                  ? "bg-[#d8d1c3] border-2 border-dashed border-[#182235]"
                  : "bg-[#182235]/95 backdrop-blur-md border-[#2c3a52]"
              }`}
            >
              <div className="p-4 sm:px-5 sm:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Sol: Aktif Havuz Başlığı & Canlı Durum */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#e2dcd0] text-[#182235] flex items-center justify-center shrink-0 font-mono-academic font-bold text-sm shadow-2xs">
                    {isParsingPdf ? (
                      <Loader2 className="w-5 h-5 text-[#182235] animate-spin" />
                    ) : (
                      String(candidates.length).padStart(2, "0")
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono-academic font-bold uppercase tracking-[0.18em] text-[#93c5fd]">
                        {lang === "en"
                          ? "01 — ACADEMIC DOSSIER & EXTRACTION WORKSPACE"
                          : "01 — AKADEMİK ADAY HAVUZU VE ANALİZ MERKEZİ"}
                      </span>
                    </div>
                    <h1 className="font-serif-academic text-base sm:text-lg font-bold text-[#f0ece1] truncate mt-0.5">
                      {isParsingPdf || pdfParseStatus
                        ? translateParseStatus(pdfParseStatus, lang) ||
                          t.readingFiles
                        : lang === "en"
                        ? `${candidates.length} Curriculum Vitae Analyzed — Drag & Drop Any Time to Add More`
                        : `${candidates.length} Özgeçmiş Analiz Edildi — Yeni Dosya veya Klasörü Doğrudan Sürükleyebilirsiniz`}
                    </h1>
                  </div>
                </div>

                {/* Sağ: Hızlı CV Ekleme, Görünüm Seçici ve Excel Çıktısı */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Görünüm Değiştirici */}
                  <div className="inline-flex rounded-lg border border-[#33435e] bg-[#111927] p-0.5">
                    <button
                      type="button"
                      onClick={() => setLayoutMode("split")}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        layoutMode === "split"
                          ? "bg-[#e2dcd0] text-[#182235]"
                          : "text-[#b8b2a6] hover:text-white"
                      }`}
                    >
                      {t.viewSplit}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutMode("table")}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        layoutMode === "table"
                          ? "bg-[#e2dcd0] text-[#182235]"
                          : "text-[#b8b2a6] hover:text-white"
                      }`}
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                      {t.viewTable(displayedEvaluations.length)}
                    </button>
                  </div>

                  {/* + Çoklu Dosya Ekle */}
                  <label className="px-3 py-1.5 rounded-lg border border-[#3b4d6b] bg-[#212f47] hover:bg-[#2a3b57] text-[#f0ece1] text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5 text-[#93c5fd]" />
                    {lang === "en" ? "+ Add Files / ZIP" : "+ Dosya / ZIP Ekle"}
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc,.html,.htm,.zip,.rar,.txt,.md,text/html,application/pdf,application/zip,application/x-rar-compressed,application/vnd.rar,application/x-zip-compressed,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleDirectFilesUpload}
                      className="hidden"
                    />
                  </label>

                  {/* + Klasör Ekle */}
                  <label className="px-3 py-1.5 rounded-lg border border-[#3b4d6b] bg-[#1b263b] hover:bg-[#25344f] text-[#d2ccc0] text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0">
                    {lang === "en" ? "+ Add Folder" : "+ Klasör Ekle"}
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

                  {/* Excel İndir */}
                  <button
                    type="button"
                    onClick={() =>
                      exportEvaluationsToExcelXlsx(
                        displayedEvaluations,
                        activeCompany.name,
                        lang
                      )
                    }
                    disabled={displayedEvaluations.length === 0}
                    className="px-3.5 py-1.5 rounded-lg bg-[#e2dcd0] hover:bg-[#ece7dc] disabled:opacity-50 text-[#182235] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t.btnDownloadExcelFull(displayedEvaluations.length)}
                  </button>
                </div>
              </div>
            </div>

            {layoutMode === "table" ? (
              /* ===============================================================
                 TOPLU TABLO / EXCEL ÖNİZLEME GÖRÜNÜMÜ (30-40+ CV İÇİN)
                 =============================================================== */
              <div className="bg-[#e2dcd0]/96 backdrop-blur-md border border-[#b8b0a0] rounded-xl overflow-hidden shadow-md">
                <div className="p-4 border-b border-[#c4bdb0] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-mono-academic font-bold uppercase tracking-[0.18em] text-[#4a5363]">
                      {lang === "en"
                        ? "02 / STRUCTURED ACADEMIC MATRIX"
                        : "02 / YAPILANDIRILMIŞ AKADEMİK MATRİS"}
                    </div>
                    <h2 className="font-serif-academic font-bold text-base text-[#121926] mt-0.5">
                      {t.tableHeading(displayedEvaluations.length)}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#525b6c] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.searchTablePlaceholder}
                        className="pl-8 pr-2.5 py-1.5 bg-[#ece7db] border border-[#b0a898] rounded-md text-xs text-[#121926] focus:outline-none focus:border-[#182235] w-52"
                      />
                    </div>
                  </div>
                </div>

                <div
                  onScroll={handleListScroll}
                  className="overflow-x-auto max-h-[680px]"
                >
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#182235] text-[#f0ece1] sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-3.5 font-mono-academic font-semibold whitespace-nowrap">
                          #
                        </th>
                        <th className="py-3 px-3.5 font-semibold whitespace-nowrap">
                          {t.colNameFile}
                        </th>
                        <th className="py-3 px-3.5 font-semibold whitespace-nowrap">
                          {t.colGender}
                        </th>
                        <th className="py-3 px-3.5 font-semibold whitespace-nowrap">
                          {t.colAge}
                        </th>
                        <th className="py-3 px-3.5 font-semibold whitespace-nowrap">
                          {t.colDegrees}
                        </th>
                        <th className="py-3 px-3.5 font-semibold whitespace-nowrap">
                          {t.colAssoc}
                        </th>
                        <th className="py-3 px-3.5 font-semibold whitespace-nowrap">
                          {t.colBachelor}
                        </th>
                        <th className="py-3 px-3.5 font-semibold whitespace-nowrap">
                          {t.colMaster}
                        </th>
                        <th className="py-3 px-3.5 font-semibold whitespace-nowrap">
                          {t.colPhd}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c4bdb0]">
                      {visibleEvaluations.map((item, idx) => {
                        const degMap = getCandidateDegreeMap(item.cv);
                        const activeDegrees = DEGREE_CARDS.filter(
                          (d) => degMap[d.key] !== null
                        );
                        const ageMissing = isAgeMissingCase(item.cv);

                        const renderDegreeCell = (
                          slot: DegreeEducationEntry | null
                        ) => {
                          if (!slot) {
                            return <span className="text-[#857f72]">—</span>;
                          }
                          return (
                            <div className="space-y-0.5 min-w-[170px]">
                              <div className="font-semibold text-[#121926]">
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
                            className="hover:bg-[#d6cfc0] cursor-pointer transition-colors align-top"
                          >
                            <td className="py-3 px-3.5 font-mono-academic text-[#4a5363]">
                              {String(idx + 1).padStart(2, "0")}
                            </td>
                            <td className="py-3 px-3.5 min-w-[180px]">
                              <div className="font-serif-academic font-bold text-sm text-[#121926]">
                                {item.cv.fullName}
                              </div>
                              <div className="text-[11px] text-[#4a5363] truncate max-w-[210px]">
                                {item.cv.source}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  item.cv.detectedGender === "Kadın"
                                    ? "bg-[#182235] text-[#f0ece1]"
                                    : item.cv.detectedGender === "Erkek"
                                    ? "bg-[#cfc8b8] text-[#182235] border border-[#aba393]"
                                    : "bg-amber-900/15 text-amber-950 border border-amber-800/30"
                                }`}
                              >
                                {translateGender(item.cv.detectedGender, lang)}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {item.cv.detectedAge !== null ? (
                                <div>
                                  <span className="font-bold text-[#121926]">
                                    {item.cv.detectedAge} {t.ageUnit}
                                  </span>
                                  <div className="text-[10px] text-[#4a5363]">
                                    {translateAgeMethod(
                                      item.cv.ageMethod,
                                      lang
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-900/15 text-amber-950 border border-amber-800/30 text-[11px] font-medium">
                                  {ageMissing
                                    ? t.noAgeEduDate
                                    : t.unspecified}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="flex flex-wrap gap-1 min-w-[130px]">
                                {activeDegrees.length > 0 ? (
                                  activeDegrees.map((d) => (
                                    <span
                                      key={d.key}
                                      className="px-2 py-0.5 rounded bg-[#182235] text-[#f0ece1] text-[11px] font-semibold whitespace-nowrap"
                                    >
                                      {lang === "en" ? d.shortEn : d.shortTr}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[#5a6270]">
                                    {t.notSpecified}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3.5">
                              {renderDegreeCell(degMap.associate)}
                            </td>
                            <td className="py-3 px-3.5">
                              {renderDegreeCell(degMap.bachelor)}
                            </td>
                            <td className="py-3 px-3.5">
                              {renderDegreeCell(degMap.master)}
                            </td>
                            <td className="py-3 px-3.5">
                              {renderDegreeCell(degMap.phd)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {displayedEvaluations.length > visibleLimit && (
                  <div className="p-3 bg-[#dad3c5] border-t border-[#c4bdb0] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#3b4454] font-medium">
                      {lang === "en"
                        ? `Showing ${visibleEvaluations.length} of ${displayedEvaluations.length} candidates (Excel export includes all ${displayedEvaluations.length})`
                        : `Toplam ${displayedEvaluations.length} adaydan ilk ${visibleEvaluations.length} aday gösteriliyor (Excel çıktısı tüm ${displayedEvaluations.length} adayı kapsar)`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleLimit((prev) =>
                            Math.min(displayedEvaluations.length, prev + 100)
                          )
                        }
                        className="px-3 py-1 rounded bg-[#182235] text-[#f0ece1] font-semibold cursor-pointer hover:bg-[#22304a]"
                      >
                        {lang === "en" ? "+100 More" : "+100 Daha Göster"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleLimit(displayedEvaluations.length)
                        }
                        className="px-3 py-1 rounded border border-[#182235] text-[#182235] font-semibold cursor-pointer hover:bg-[#cfc8b8]"
                      >
                        {lang === "en"
                          ? `Show All (${displayedEvaluations.length})`
                          : `Tümünü Göster (${displayedEvaluations.length})`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ===============================================================
                 İKİLİ AKADEMİK DOSYA GÖRÜNÜMÜ (SOL: ADAY LİSTESİ, SAĞ: AKADEMİK KARNE)
                 =============================================================== */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* SOL SÜTUN: ADAY HAVUZU LİSTESİ (5 Sütun) */}
                <div className="lg:col-span-5 bg-[#e2dcd0]/96 backdrop-blur-md border border-[#b8b0a0] rounded-xl overflow-hidden shadow-md">
                  {/* Liste Üst Başlığı ve Arama */}
                  <div className="p-4 border-b border-[#c4bdb0] bg-[#dad3c5] flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-mono-academic font-bold uppercase tracking-[0.16em] text-[#4a5363]">
                        {lang === "en"
                          ? "01 / CANDIDATE ROSTER"
                          : "01 / ADAY LİSTESİ"}
                      </div>
                      <h2 className="font-serif-academic font-bold text-base text-[#121926]">
                        {t.uploadedCvsTitle(candidates.length)}
                      </h2>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#525b6c] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.searchCandidatePlaceholder}
                        className="pl-8 pr-2.5 py-1.5 bg-[#ece7db] border border-[#b0a898] rounded-md text-xs text-[#121926] focus:outline-none focus:border-[#182235] w-40 sm:w-44"
                      />
                    </div>
                  </div>

                  {/* Aday Kartları Listesi */}
                  <div
                    onScroll={handleListScroll}
                    className="divide-y divide-[#c4bdb0] max-h-[720px] overflow-y-auto"
                  >
                    {displayedEvaluations.length === 0 ? (
                      <div className="p-8 text-center text-sm text-[#4a5363]">
                        {t.noCandidatesMatch}
                      </div>
                    ) : (
                      visibleEvaluations.map((item, idx) => {
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
                            className={`p-4 transition-all cursor-pointer flex items-start justify-between gap-3 border-l-4 ${
                              isSelected
                                ? "bg-[#ece7db] border-l-[#182235]"
                                : "bg-[#e2dcd0] border-l-transparent hover:bg-[#d8d1c3]"
                            }`}
                          >
                            {/* Sol: Sıra No & Aday Özeti */}
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <span
                                className={`font-mono-academic text-xs font-bold px-2 py-1 rounded shrink-0 mt-0.5 ${
                                  isSelected
                                    ? "bg-[#182235] text-[#f0ece1]"
                                    : "bg-[#cfc8b8] text-[#273142]"
                                }`}
                              >
                                {String(idx + 1).padStart(2, "0")}
                              </span>

                              <div className="min-w-0 flex-1 space-y-2">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-serif-academic font-bold text-base text-[#121926] truncate">
                                      {item.cv.fullName}
                                    </span>
                                  </div>

                                  {/* Demografik Etiketler */}
                                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#d4cdc0] border border-[#b8b0a0] text-[#182235] font-semibold">
                                      {translateGender(
                                        item.cv.detectedGender,
                                        lang
                                      )}
                                    </span>
                                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#d4cdc0] border border-[#b8b0a0] text-[#273142] font-medium">
                                      {item.cv.detectedAge !== null
                                        ? `${item.cv.detectedAge} ${t.ageUnit}`
                                        : ageMissing
                                        ? t.noAgeEduDate
                                        : t.ageNotSpecified}
                                    </span>
                                  </div>
                                </div>

                                {/* Derece Bazlı Eğitim Satırları */}
                                {activeDegrees.length > 0 ? (
                                  <div className="space-y-1.5 pt-0.5">
                                    {activeDegrees.map((deg) => {
                                      const slot = degMap[deg.key];
                                      if (!slot) return null;
                                      return (
                                        <div
                                          key={deg.key}
                                          className="text-xs bg-[#e4dfd3] border border-[#c4bdb0] rounded-md px-2.5 py-1.5 space-y-0.5"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono-academic text-[10px] font-bold uppercase tracking-wider text-[#182235]">
                                              {lang === "en"
                                                ? deg.shortEn
                                                : deg.shortTr}
                                            </span>
                                            <span className="text-[11px] font-semibold text-[#1e3a8a] truncate">
                                              {translateEduField(
                                                slot.department,
                                                lang
                                              )}
                                            </span>
                                          </div>
                                          <div className="font-semibold text-[#121926] text-xs truncate">
                                            {translateEduField(
                                              slot.university,
                                              lang
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-[#5a6270] italic">
                                    {t.notSpecified}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Sağ: Adayı Kaldır */}
                            <div
                              className="shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteCandidate(item.cv.id)
                                }
                                title={t.removeCvTooltip}
                                className="p-1.5 rounded border border-[#b8b0a0] bg-[#d6cfc0] text-[#3b4454] hover:border-red-800/40 hover:text-red-800 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {displayedEvaluations.length > visibleLimit && (
                    <div className="p-3 bg-[#dad3c5] border-t border-[#c4bdb0] flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#3b4454] font-medium">
                        {lang === "en"
                          ? `${visibleEvaluations.length} / ${displayedEvaluations.length} shown`
                          : `${visibleEvaluations.length} / ${displayedEvaluations.length} gösteriliyor`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleLimit((prev) =>
                              Math.min(displayedEvaluations.length, prev + 100)
                            )
                          }
                          className="px-2.5 py-1 rounded bg-[#182235] text-[#f0ece1] font-semibold cursor-pointer hover:bg-[#22304a]"
                        >
                          +100
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleLimit(displayedEvaluations.length)
                          }
                          className="px-2.5 py-1 rounded border border-[#182235] text-[#182235] font-semibold cursor-pointer hover:bg-[#cfc8b8]"
                        >
                          {lang === "en" ? "Show All" : "Tümünü Göster"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* SAĞ SÜTUN: SEÇİLİ ADAY AKADEMİK KARNESİ (7 Sütun) */}
                <div className="lg:col-span-7 bg-[#e2dcd0]/96 backdrop-blur-md border border-[#b8b0a0] rounded-xl overflow-hidden shadow-md">
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
                        <div>
                          {/* AKADEMİK KARNE ÜST BAŞLIĞI (Koyu Oxford Arduvaz Şerit) */}
                          <div className="bg-[#182235] text-[#f0ece1] px-5 py-4 border-b border-[#2c3a52] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[10px] font-mono-academic font-bold uppercase tracking-[0.18em] text-[#93c5fd]">
                                {lang === "en"
                                  ? "02 / CANDIDATE ACADEMIC & DEMOGRAPHIC DOSSIER"
                                  : "02 / ADAY AKADEMİK VE DEMOGRAFİK KARNESİ"}
                              </div>
                              <h3 className="font-serif-academic text-xl sm:text-2xl font-bold text-[#f0ece1] mt-0.5 truncate">
                                {selectedEvaluation.cv.fullName}
                              </h3>
                              <p className="text-xs text-[#b8b2a6] mt-0.5 truncate">
                                {translateEduField(
                                  selectedEvaluation.cv.city,
                                  lang
                                )}{" "}
                                • {selectedEvaluation.cv.source}
                              </p>
                            </div>

                            {/* Sağ: Aktif Derece Rozetleri */}
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              {activeDegrees.length > 0 ? (
                                activeDegrees.map((d) => (
                                  <span
                                    key={d.key}
                                    className="px-2.5 py-1 rounded bg-[#e2dcd0] text-[#182235] text-xs font-bold whitespace-nowrap"
                                  >
                                    {lang === "en" ? d.shortEn : d.shortTr}
                                  </span>
                                ))
                              ) : (
                                <span className="px-2.5 py-1 rounded bg-[#25344f] text-[#d2ccc0] text-xs font-medium">
                                  {t.notSpecified}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* AKADEMİK KARNE GÖVDESİ */}
                          <div className="p-5 space-y-5">
                            {/* BÖLÜM I: DEMOGRAFİK VE KRONOLOJİK ANALİZ (2 Sütunlu Mimari Kartlar) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {/* 01 / Cinsiyet Kartı */}
                              <div className="p-4 rounded-lg bg-[#ece7db] border border-[#b8b0a0] flex flex-col justify-between space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono-academic font-bold uppercase tracking-[0.15em] text-[#4a5363]">
                                    01 / {t.genderLabel}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-[#182235] text-[#f0ece1] text-[11px] font-bold">
                                    {translateGender(
                                      selectedEvaluation.cv.detectedGender,
                                      lang
                                    )}
                                  </span>
                                </div>
                                <div className="font-serif-academic text-lg font-bold text-[#121926]">
                                  {translateGender(
                                    selectedEvaluation.cv.detectedGender,
                                    lang
                                  )}
                                </div>
                                <p className="text-xs text-[#333d4f] leading-relaxed border-t border-[#d4cdc0] pt-2">
                                  {selectedEvaluation.cv.genderEvidence
                                    .map((e) =>
                                      translateGenderSignal(e.signal, lang)
                                    )
                                    .slice(0, 2)
                                    .join(" + ")}
                                </p>
                              </div>

                              {/* 02 / Kronolojik Yaş Kartı */}
                              <div className="p-4 rounded-lg bg-[#ece7db] border border-[#b8b0a0] flex flex-col justify-between space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-mono-academic font-bold uppercase tracking-[0.15em] text-[#4a5363]">
                                    02 / {t.ageLabel}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-[#d6cfc0] border border-[#b0a898] text-[#182235] text-[10px] font-bold truncate">
                                    {translateAgeMethod(
                                      selectedEvaluation.cv.ageMethod,
                                      lang
                                    )}
                                  </span>
                                </div>
                                <div className="font-serif-academic text-lg font-bold text-[#121926]">
                                  {selectedEvaluation.cv.detectedAge !== null
                                    ? `${selectedEvaluation.cv.detectedAge} ${t.ageYearsOld}`
                                    : ageMissing
                                    ? t.noAgeEduDateLong
                                    : t.unspecified}
                                </div>
                                <p className="text-xs text-[#333d4f] leading-relaxed border-t border-[#d4cdc0] pt-2">
                                  {translateAgeEvidence(
                                    selectedEvaluation.cv.ageEvidence,
                                    lang
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* BÖLÜM II: EĞİTİM DERECELERİ & ÜNİVERSİTE / BÖLÜM MATRİSİ */}
                            <div className="rounded-lg bg-[#ece7db] border border-[#b8b0a0] p-4 space-y-4">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#cfc8b8] pb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono-academic font-bold uppercase tracking-[0.15em] text-[#4a5363]">
                                    03 /
                                  </span>
                                  <GraduationCap className="w-4 h-4 text-[#182235]" />
                                  <h4 className="font-serif-academic font-bold text-sm text-[#121926]">
                                    {t.eduSectionTitle}
                                  </h4>
                                </div>
                                <span className="text-xs font-mono-academic font-bold text-[#182235]">
                                  {activeDegrees.length > 0
                                    ? activeDegrees
                                        .map((d) =>
                                          lang === "en" ? d.shortEn : d.shortTr
                                        )
                                        .join(" · ")
                                    : t.notSpecified}
                                </span>
                              </div>

                              {/* 4 Kademeli Akademik Derece Şeridi */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {DEGREE_CARDS.map((deg, idx) => {
                                  const isHas = degMap[deg.key] !== null;
                                  return (
                                    <div
                                      key={deg.key}
                                      className={`px-3 py-2 rounded-md border text-left transition-colors ${
                                        isHas
                                          ? "bg-[#182235] text-[#f0ece1] border-[#182235] shadow-2xs"
                                          : "bg-[#dfd9ca] text-[#6b7280] border-[#c4bdb0]"
                                      }`}
                                    >
                                      <div
                                        className={`text-[10px] font-mono-academic font-bold ${
                                          isHas
                                            ? "text-[#93c5fd]"
                                            : "text-[#857f72]"
                                        }`}
                                      >
                                        0{idx + 1}
                                      </div>
                                      <div className="text-xs font-bold mt-0.5 truncate">
                                        {lang === "en"
                                          ? deg.shortEn
                                          : deg.shortTr}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Aktif Olan Her Akademik Derece İçin 2 Sütunlu Tablo Kartı */}
                              {activeDegrees.length > 0 ? (
                                <div className="space-y-3">
                                  {activeDegrees.map((deg) => {
                                    const slot = degMap[deg.key];
                                    if (!slot) return null;
                                    return (
                                      <div
                                        key={deg.key}
                                        className="rounded-lg bg-[#e2dcd0] border border-[#b0a898] overflow-hidden"
                                      >
                                        <div className="px-3.5 py-2 bg-[#d6cfc0] border-b border-[#b8b0a0] flex items-center justify-between">
                                          <span className="font-serif-academic font-bold text-xs text-[#182235]">
                                            {lang === "en"
                                              ? deg.cardTitleEn
                                              : deg.cardTitleTr}
                                          </span>
                                          <span className="text-[10px] font-mono-academic font-bold uppercase tracking-wider text-[#3b4454]">
                                            {deg.shortEn}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#c4bdb0]">
                                          <div className="p-3">
                                            <div className="text-[10px] font-mono-academic font-bold text-[#4a5363] uppercase tracking-wider">
                                              {lang === "en"
                                                ? deg.uniLabelEn
                                                : deg.uniLabelTr}
                                            </div>
                                            <div className="font-serif-academic font-bold text-sm text-[#121926] mt-1">
                                              {translateEduField(
                                                slot.university,
                                                lang
                                              )}
                                            </div>
                                          </div>
                                          <div className="p-3">
                                            <div className="text-[10px] font-mono-academic font-bold text-[#4a5363] uppercase tracking-wider">
                                              {lang === "en"
                                                ? deg.deptLabelEn
                                                : deg.deptLabelTr}
                                            </div>
                                            <div className="font-serif-academic font-bold text-sm text-[#1e3a8a] mt-1">
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
                                <p className="text-xs text-[#4a5363]">
                                  {t.noUniDeptDetected}
                                </p>
                              )}
                            </div>

                            {/* Yetenek Kanıtları (Varsa) */}
                            {selectedEvaluation.skillAssessments.length > 0 && (
                              <div className="space-y-2">
                                {selectedEvaluation.skillAssessments.map(
                                  (sa) => (
                                    <div
                                      key={sa.skill}
                                      className="p-3 rounded-lg bg-[#ece7db] border border-[#c4bdb0] text-xs space-y-1"
                                    >
                                      <div className="flex items-center justify-between font-semibold text-[#121926]">
                                        <span className="flex items-center gap-1.5">
                                          {sa.level ===
                                          "Uzman / Proje Kanıtlı" ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-[#182235]" />
                                          ) : (
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                                          )}
                                          {sa.skill}
                                        </span>
                                        <span
                                          className={
                                            sa.level === "Uzman / Proje Kanıtlı"
                                              ? "text-[#182235]"
                                              : "text-amber-800"
                                          }
                                        >
                                          {translateSkillLevel(sa.level, lang)}
                                        </span>
                                      </div>
                                      <p className="text-[#333d4f] italic">
                                        &ldquo;{sa.evidenceSnippet}&rdquo;
                                      </p>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            {/* BÖLÜM III: OKUNAN ÖZGEÇMİŞ METNİ (Koyu Oxford Arduvaz Belge Kutusu) */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] font-mono-academic font-bold text-[#3b4454] uppercase tracking-[0.15em] flex items-center gap-1.5">
                                  <span>04 /</span>
                                  <FileText className="w-3.5 h-3.5 text-[#182235]" />
                                  <span>{t.rawCvTextHeading}</span>
                                </div>
                              </div>
                              <pre className="p-4 rounded-lg bg-[#182235] border border-[#2c3a52] text-[#e2dcd0] text-xs font-mono-academic whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto shadow-inner">
                                {selectedEvaluation.cv.rawText}
                              </pre>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-sm text-[#4a5363] py-12 text-center">
                      {t.selectCandidatePrompt}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* =====================================================================
            4. SİSTEM MİMARİSİ & PAZARLAMA AKIŞI (Koyu Oxford Arduvaz Kartlar)
           ===================================================================== */}
        <section
          id="sistem"
          className="pt-8 border-t border-[#a8a090] space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="text-[11px] font-mono-academic font-bold uppercase tracking-[0.2em] text-[#182235] border-l-2 border-[#182235] pl-2.5">
                {t.sec2Eyebrow}
              </div>
              <h2 className="font-serif-academic text-xl sm:text-2xl font-bold text-[#121926] tracking-tight">
                {t.sec2Title}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#273142] max-w-md leading-relaxed">
              {t.sec2Sub}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-6 rounded-xl bg-[#182235]/94 backdrop-blur-md border border-[#2c3a52] space-y-2.5 shadow-md">
              <div className="text-xs font-mono-academic font-bold text-[#93c5fd]">
                {t.arch1Tag}
              </div>
              <h3 className="font-serif-academic text-base font-bold text-[#f0ece1]">
                {t.arch1Title}
              </h3>
              <p className="text-xs text-[#c7c1b4] leading-relaxed">
                {t.arch1Desc}
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#182235]/94 backdrop-blur-md border border-[#2c3a52] space-y-2.5 shadow-md">
              <div className="text-xs font-mono-academic font-bold text-[#93c5fd]">
                {t.arch2Tag}
              </div>
              <h3 className="font-serif-academic text-base font-bold text-[#f0ece1]">
                {t.arch2Title}
              </h3>
              <p className="text-xs text-[#c7c1b4] leading-relaxed">
                {t.arch2Desc}
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#182235]/94 backdrop-blur-md border border-[#2c3a52] space-y-2.5 shadow-md">
              <div className="text-xs font-mono-academic font-bold text-[#93c5fd]">
                {t.arch3Tag}
              </div>
              <h3 className="font-serif-academic text-base font-bold text-[#f0ece1]">
                {t.arch3Title}
              </h3>
              <p className="text-xs text-[#c7c1b4] leading-relaxed">
                {t.arch3Desc}
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================================
            5. TEKNİK ÖZELLİKLER (01–04 Sıcak Taş Kartlar)
           ===================================================================== */}
        <section
          id="ozellikler"
          className="pt-8 border-t border-[#a8a090] space-y-6"
        >
          <div className="space-y-2 max-w-2xl">
            <div className="text-[11px] font-mono-academic font-bold uppercase tracking-[0.2em] text-[#182235] border-l-2 border-[#182235] pl-2.5">
              {t.sec3Eyebrow}
            </div>
            <h2 className="font-serif-academic text-xl sm:text-2xl font-bold text-[#121926] tracking-tight">
              {t.sec3Title}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-[#ded8c8]/94 backdrop-blur-md border border-[#b8b0a0] space-y-2 shadow-xs">
              <div className="text-xs font-mono-academic font-bold text-[#182235]">
                01
              </div>
              <h3 className="font-serif-academic text-sm font-bold text-[#121926]">
                {t.feat1Title}
              </h3>
              <p className="text-xs text-[#333d4f] leading-relaxed">
                {t.feat1Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#ded8c8]/94 backdrop-blur-md border border-[#b8b0a0] space-y-2 shadow-xs">
              <div className="text-xs font-mono-academic font-bold text-[#182235]">
                02
              </div>
              <h3 className="font-serif-academic text-sm font-bold text-[#121926]">
                {t.feat2Title}
              </h3>
              <p className="text-xs text-[#333d4f] leading-relaxed">
                {t.feat2Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#ded8c8]/94 backdrop-blur-md border border-[#b8b0a0] space-y-2 shadow-xs">
              <div className="text-xs font-mono-academic font-bold text-[#182235]">
                03
              </div>
              <h3 className="font-serif-academic text-sm font-bold text-[#121926]">
                {t.feat3Title}
              </h3>
              <p className="text-xs text-[#333d4f] leading-relaxed">
                {t.feat3Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#ded8c8]/94 backdrop-blur-md border border-[#b8b0a0] space-y-2 shadow-xs">
              <div className="text-xs font-mono-academic font-bold text-[#182235]">
                04
              </div>
              <h3 className="font-serif-academic text-sm font-bold text-[#121926]">
                {t.feat4Title}
              </h3>
              <p className="text-xs text-[#333d4f] leading-relaxed">
                {t.feat4Desc}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          ALT BİLGİ (FOOTER — Koyu Oxford Arduvaz)
         ===================================================================== */}
      <footer className="relative z-10 border-t border-[#2c3a52] bg-[#182235]/95 backdrop-blur-md mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#b8b2a6]">
          <div className="flex items-center gap-2">
            <span className="font-serif-academic font-bold text-[#f0ece1]">
              CV Reader AI
            </span>
            <span>—</span>
            <span>{t.footerDesc}</span>
          </div>
          <div className="flex items-center gap-5 font-medium">
            <a
              href="#yukleme"
              className="hover:text-[#f0ece1] transition-colors"
            >
              {t.footerUploadLink}
            </a>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          MODAL 1: TOPLU CV YÜKLE
         ===================================================================== */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#141c2b]/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#e2dcd0] rounded-xl border border-[#b8b0a0] max-w-lg w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-[#c4bdb0] pb-3">
              <div>
                <h3 className="font-serif-academic font-bold text-base text-[#121926]">
                  {t.modalUploadTitle}
                </h3>
                <p className="text-xs text-[#3b4454]">{t.modalUploadSub}</p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-[#4a5363] hover:text-[#121926] text-lg cursor-pointer"
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
                  ? "border-[#182235] bg-[#d6cfc0]"
                  : "border-[#182235]/50 hover:border-[#182235] bg-[#ece7db]"
              }`}
            >
              <FileUp className="w-9 h-9 text-[#182235] mx-auto mb-2" />
              <span className="block font-serif-academic text-sm font-bold text-[#121926]">
                {isDragging ? t.dropTitleDragging : t.dropTitleEmpty}
              </span>
              <span className="block text-xs text-[#3b4454] mt-1 mb-4">
                {t.dropSubText}
              </span>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <label className="px-4 py-2 rounded-md bg-[#182235] hover:bg-[#22304a] text-[#f0ece1] text-xs font-bold cursor-pointer flex items-center gap-1.5">
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

                <label className="px-3.5 py-2 rounded-md border border-[#a8a090] bg-[#d6cfc0] hover:border-[#182235] text-[#141c2b] text-xs font-semibold cursor-pointer flex items-center gap-1.5">
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
              <div className="flex items-center gap-2 text-xs text-[#f0ece1] font-medium bg-[#182235] p-2.5 rounded">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {translateParseStatus(pdfParseStatus, lang) || t.readingFiles}
                </span>
              </div>
            )}

            {pdfParseStatus && !isParsingPdf && (
              <div className="text-xs font-medium text-[#f0ece1] bg-[#182235] border border-[#2c3a52] p-2.5 rounded">
                {translateParseStatus(pdfParseStatus, lang)}
              </div>
            )}

            <details className="border border-[#c4bdb0] rounded-md p-3 bg-[#ece7db]">
              <summary className="text-xs font-semibold text-[#273142] cursor-pointer select-none">
                {t.modalManualSummary}
              </summary>
              <form onSubmit={handleAddCV} className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#273142] mb-1">
                      {t.modalNameLabel}
                    </label>
                    <input
                      type="text"
                      required
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder={t.modalNamePlaceholder}
                      className="w-full border border-[#b0a898] rounded bg-[#e2dcd0] px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#273142] mb-1">
                      {t.modalUniLabel}
                    </label>
                    <input
                      type="text"
                      value={uploadUni}
                      onChange={(e) => setUploadUni(e.target.value)}
                      placeholder={t.modalUniPlaceholder}
                      className="w-full border border-[#b0a898] rounded bg-[#e2dcd0] px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#273142] mb-1">
                    {t.modalCvTextLabel}
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={uploadRawText}
                    onChange={(e) => setUploadRawText(e.target.value)}
                    placeholder={t.modalCvTextPlaceholder}
                    className="w-full border border-[#b0a898] rounded bg-[#e2dcd0] p-2.5 text-xs font-mono-academic"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={isParsingPdf}
                    className="px-4 py-1.5 bg-[#182235] hover:bg-[#22304a] text-[#f0ece1] rounded text-xs font-medium cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-[#141c2b]/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#e2dcd0] rounded-xl border border-[#b8b0a0] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#c4bdb0] pb-3">
              <h3 className="font-serif-academic font-bold text-base text-[#121926]">
                {t.newCompTitle}
              </h3>
              <button
                onClick={() => setIsNewCompanyModalOpen(false)}
                className="text-[#4a5363] hover:text-[#121926] text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#273142] mb-1">
                  {t.newCompName}
                </label>
                <input
                  type="text"
                  required
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  className="w-full border border-[#b0a898] bg-[#ece7db] rounded px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#273142] mb-1">
                  {t.newCompSkillsLabel}
                </label>
                <input
                  type="text"
                  value={newCompSkills}
                  onChange={(e) => setNewCompSkills(e.target.value)}
                  placeholder="C++, Java"
                  className="w-full border border-[#b0a898] bg-[#ece7db] rounded px-3 py-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCompanyModalOpen(false)}
                  className="px-4 py-1.5 border border-[#b0a898] bg-[#ece7db] rounded text-xs cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#182235] text-[#f0ece1] rounded text-xs font-medium cursor-pointer"
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
