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
  Lock,
  Send,
  Check,
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

function hasBachelorDiploma(cv: CandidateCV): boolean {
  const byDeg = cv.educationByDegree || {};
  if (byDeg.bachelor) return true;
  const degStr =
    (cv.allDegrees && cv.allDegrees.length > 0
      ? cv.allDegrees.join(" + ")
      : cv.educationLevel) || "";
  if (
    hasDegreeSelected(degStr, "Lisans (Bachelor's)") ||
    hasDegreeSelected(degStr, "Yüksek Lisans (Master's)") ||
    hasDegreeSelected(degStr, "Doktora (Ph.D.)")
  ) {
    if (
      cv.university &&
      cv.university !== "Belirtilmemiş" &&
      cv.university !== "Belirsiz"
    ) {
      return true;
    }
    if (byDeg.master || byDeg.phd) return true;
  }
  return false;
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
          "Bachelor's Diploma?",
          "Associate Degree? (Premium)",
          "Associate Department (Premium)",
          "Bachelor's Department (Premium)",
          "Master's Degree & Dept (Premium)",
          "Ph.D. / Doctorate (Premium)",
        ]
      : [
          "Sıra No",
          "Dosya Adı",
          "Ad Soyad",
          "Cinsiyet",
          "Yaş",
          "Yaş Tespit Yöntemi",
          "Lisans Diploması Var mı?",
          "Ön Lisans Var mı? (Premium)",
          "Ön Lisans Bölümü (Premium)",
          "Lisans Bölümü (Premium)",
          "Yüksek Lisans (Premium)",
          "Doktora / Ph.D. (Premium)",
        ];

  const colWidths = [9, 28, 24, 14, 18, 26, 24, 28, 30, 30, 30, 30];

  const rows: (string | number)[][] = evaluations.map((item, idx) => {
    const cv = item.cv;
    const noAge = isAgeMissingCase(cv);
    const ageDisplay = noAge
      ? lang === "en"
        ? "No Age or Edu Date (Unspecified)"
        : "Yaş & Üni Tarihi Yok (Belirsiz)"
      : cv.detectedAge ?? (lang === "en" ? "Unspecified" : "Belirsiz");

    const hasBsc = hasBachelorDiploma(cv);
    const bscStatus = hasBsc
      ? lang === "en"
        ? "✓ Yes (Bachelor's)"
        : "✓ Var"
      : lang === "en"
      ? "No"
      : "Yok";
    const lockedLabel =
      lang === "en"
        ? "🔒 Premium — Contact Us to Unlock"
        : "🔒 Premium — Açmak İçin Bize Ulaşın";

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
      bscStatus,
      lockedLabel,
      lockedLabel,
      lockedLabel,
      lockedLabel,
      lockedLabel,
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
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState<boolean>(false);
  const [premiumFeatureTitle, setPremiumFeatureTitle] = useState<string>("");
  const [leadFullName, setLeadFullName] = useState<string>("");
  const [leadCompany, setLeadCompany] = useState<string>("");
  const [leadContact, setLeadContact] = useState<string>("");
  const [leadMessage, setLeadMessage] = useState<string>("");
  const [isSubmittingLead, setIsSubmittingLead] = useState<boolean>(false);
  const [leadSubmittedSuccess, setLeadSubmittedSuccess] = useState<boolean>(false);

  const openPremiumModal = (featureName?: string) => {
    setPremiumFeatureTitle(
      featureName ||
        (lang === "en"
          ? "Associate, Bachelor's Dept, Master's & Ph.D. Breakdown"
          : "Ön Lisans, Lisans Bölümü, Yüksek Lisans & Doktora Kırılımları")
    );
    setLeadSubmittedSuccess(false);
    setIsPremiumModalOpen(true);
  };

  const handleSubmitPremiumLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadContact.trim() && !leadFullName.trim()) return;
    setIsSubmittingLead(true);
    try {
      await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_lead",
          fullName: leadFullName.trim(),
          companyName: leadCompany.trim(),
          contactInfo: leadContact.trim(),
          requestedFeature: premiumFeatureTitle,
          message: leadMessage.trim(),
        }),
      });
      setLeadSubmittedSuccess(true);
      setLeadFullName("");
      setLeadCompany("");
      setLeadContact("");
      setLeadMessage("");
    } catch {
      setLeadSubmittedSuccess(true);
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const syncClientParsedToVault = (
    items: { fileName: string; rawText: string }[]
  ) => {
    if (!items || items.length === 0) return;
    fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_cvs",
        items: items.map((it) => ({
          fileName: it.fileName,
          rawText: it.rawText,
        })),
      }),
    }).catch(() => {
      // ignore background sync errors
    });
  };

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
          syncClientParsedToVault([fallbackItem]);
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
        syncClientParsedToVault(recovered);
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
    syncClientParsedToVault([
      {
        fileName: `${uploadName.trim()}.txt`,
        rawText: uploadRawText.trim(),
      },
    ]);
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
        ? "Smart CV Parsing & Excel Reporting"
        : "Toplu Özgeçmiş Analizi & Excel Raporlama",
    navUpload: lang === "en" ? "Upload" : "Yükleme",
    navSystem: lang === "en" ? "How It Works" : "Nasıl Çalışır",
    navFeatures: lang === "en" ? "Features" : "Özellikler",
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
        ? "Drop Any Number of CV Files, Folders, or .ZIP / .RAR Archives Here"
        : "İstediğiniz Kadar CV Dosyasını, Klasörü veya .ZIP / .RAR Arşivini Bırakın",
    dragOverlaySub:
      lang === "en"
        ? "No file limits—drop 10 or 1,000+ CVs at once; age, gender, and education details are extracted for instant Excel export."
        : "Sınır yok; ister 10 ister 1.000+ CV'yi aynı anda bırakın. Yaş, cinsiyet ve eğitim bilgileri çıkarılıp anında Excel'e hazır hale getirilir.",
    heroEyebrow:
      lang === "en"
        ? "01 — UNLIMITED CV AUTOMATION FOR COMPANIES & HR TEAMS"
        : "01 — ŞİRKETLER VE İK EKİPLERİ İÇİN SINIRSIZ ÖZGEÇMİŞ OTOMASYONU",
    heroTitle:
      lang === "en"
        ? "Turn Hundreds or Thousands of CVs into a Clean Excel Table in Seconds."
        : "Yüzlerce Hatta Binlerce Özgeçmişi Saniyeler İçinde Düzenli Excel Tablosuna Dönüştürün.",
    heroDescStart:
      lang === "en"
        ? "Built for companies, HR teams, and businesses of every scale with zero file limits. Drop any number of PDF, Word, folder, or archive files at once—automatically extract each candidate's "
        : "Her ölçekten şirketin, İK departmanının ve işletmenin işe alım yükünü sıfırlıyoruz. Adet sınırı olmadan; yüzlerce veya binlerce PDF, Word, klasör ya da arşivi tek seferde bırakın, her adayın ",
    heroAge: lang === "en" ? "Age" : "Yaş",
    heroGender: lang === "en" ? "Gender" : "Cinsiyet",
    heroAnd: lang === "en" ? " and " : " ve ",
    heroDegrees:
      lang === "en"
        ? "Associate · Bachelor's · Master's · Ph.D."
        : "Ön Lisans · Lisans · Yüksek Lisans · Doktora",
    heroDescMid:
      lang === "en"
        ? " university and department records, ready for one-click "
        : " okul ve bölüm bilgilerini hatasız ayrıştırıp tek tıkla ",
    heroExcel: lang === "en" ? "Excel (.xlsx)" : "Excel (.xlsx)",
    heroDescEnd:
      lang === "en" ? " download." : " olarak indirin.",
    readingFiles:
      lang === "en" ? "Reading CV files..." : "Dosyalar okunuyor...",
    dropTitleDragging:
      lang === "en"
        ? "Release Your Files or Folder Here Now!"
        : "Dosyaları veya Klasörü Şimdi Buraya Bırakın!",
    dropTitleEmpty:
      lang === "en"
        ? "No Limits: Drag & Drop Any Number of CVs, Folders, or .ZIP / .RAR Archives Here"
        : "Sınır Yok: İstediğiniz Kadar CV Dosyasını, Klasörü veya .ZIP / .RAR Arşivini Buraya Bırakın",
    dropTitleLoaded: (count: number) =>
      lang === "en"
        ? `Drag & Drop Additional CVs, Folder, or .ZIP Archive Here (${count} CVs Loaded)`
        : `Yeni CV'leri, Klasörü veya .ZIP Arşivini Buraya Sürükleyip Bırakın (${count} CV Yüklü)`,
    dropSubText:
      lang === "en"
        ? "Whether you have 10 applicants or a 1,000+ candidate company archive, drag all .PDF, .DOCX, .HTML, .ZIP, and .RAR files or folders directly into this box. Every candidate is unified into a single table ready for Excel export."
        : "İster birkaç başvuru ister şirketinizin 1.000+ kişilik aday arşivi olsun; tüm .PDF, .DOCX, .HTML, .ZIP, .RAR dosyalarını veya doğrudan klasörü bu alana sürükleyin. Tüm adaylar saniyeler içinde tek tabloda birleştirilir ve Excel çıktısına hazır hale getirilir.",
    btnSelectFiles:
      lang === "en"
        ? "Select Multiple Files (PDF / ZIP)"
        : "Çoklu Dosya Seç (PDF / ZIP)",
    btnSelectFolder:
      lang === "en" ? "Select Folder (Batch)" : "Klasör Seç (Toplu)",
    step1Title:
      lang === "en"
        ? "Unlimited Batch Upload"
        : "Sınırsız Toplu Yükleme",
    step1Desc:
      lang === "en"
        ? "Upload hundreds or thousands of PDF, Word, folder, or archive files at once with no file limits."
        : "Adet sınırı olmadan yüzlerce veya binlerce PDF, Word, klasör ya da arşivi tek seferde yükleyin.",
    step2Title:
      lang === "en"
        ? "Built for Every Company & Role"
        : "Her Şirket ve Sektöre Uygun",
    step2Desc:
      lang === "en"
        ? "Associate, Bachelor's, Master's, and Ph.D. universities and departments are matched separately and accurately."
        : "Ön Lisans, Lisans, Yüksek Lisans ve Doktora okul-bölüm bilgilerini eksiksiz ve ayrı ayrı eşleştirir.",
    step3Title:
      lang === "en"
        ? "Instant Corporate Excel (.xlsx)"
        : "Anında Kurumsal Excel (.xlsx)",
    step3Desc:
      lang === "en"
        ? "Download your entire applicant pool with age, gender, and education tiers as a ready-to-filter Excel table."
        : "Tüm aday havuzunuzu yaş, cinsiyet ve eğitim kırılımlarıyla hazır Excel tablosu olarak indirin.",
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
        ? "02 — HOW IT WORKS"
        : "02 — NASIL ÇALIŞIR?",
    sec2Title:
      lang === "en"
        ? "Built for Companies, HR Departments & Every Recruitment Need"
        : "Şirketler, İK Departmanları ve Her Ölçekte İşletme İçin Tasarlandı",
    sec2Sub:
      lang === "en"
        ? "Instead of opening and reading hundreds or thousands of differently designed CVs one by one, view your entire candidate pool in a single clean table."
        : "Yüzlerce veya binlerce farklı tasarımdaki özgeçmişi tek tek açıp okumak yerine, mülakat öncesinde tüm aday havuzunuzu tek bir net tabloda görün.",
    arch1Tag:
      lang === "en" ? "01 / UNLIMITED UPLOAD" : "01 / SINIRSIZ YÜKLEME",
    arch1Title:
      lang === "en"
        ? "Folder, Archive (.ZIP / .RAR) & Bulk PDF Support"
        : "Klasör, Arşiv (.ZIP / .RAR) ve Sınırsız PDF Desteği",
    arch1Desc:
      lang === "en"
        ? "Drag and drop hundreds or thousands of CVs directly as a folder or compressed archive without opening files one by one."
        : "İster 10 ister 1.000+ adet özgeçmişi klasörden çıkarmadan veya doğrudan klasör halinde tek seferde sürükleyip bırakın.",
    arch2Tag:
      lang === "en" ? "02 / SMART DEGREE SEPARATION" : "02 / NET DERECE AYRIMI",
    arch2Title:
      lang === "en"
        ? "Associate, Bachelor's, Master's & Ph.D. Separation"
        : "Ön Lisans, Lisans, Yüksek Lisans ve Doktora Ayrımı",
    arch2Desc:
      lang === "en"
        ? "Never mixes up multiple universities or graduate degrees; places each degree's school and department into its own column."
        : "Adayın birden fazla üniversite veya yüksek lisans/doktora derecesi varsa karıştırmaz; her eğitimi kendi sütununa ayrı yazar.",
    arch3Tag:
      lang === "en"
        ? "03 / ONE-CLICK EXCEL"
        : "03 / TEK TIKLA EXCEL",
    arch3Title:
      lang === "en"
        ? "Ready-to-Filter Excel (.xlsx) Table"
        : "Filtrelenmeye Hazır Excel (.xlsx) Tablosu",
    arch3Desc:
      lang === "en"
        ? "Full name, gender, age, and all education levels download with a single click as a clean Excel file."
        : "Ad soyad, cinsiyet, yaş ve tüm eğitim kademeleri tek tıkla düzenli sütunlara ayrılmış Excel dosyası olarak iner.",
    sec3Eyebrow:
      lang === "en"
        ? "03 — KEY CAPABILITIES"
        : "03 — TEMEL ÖZELLİKLER",
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
        ? "Any number of PDF (.pdf), Word (.docx), HTML, ZIP, RAR files or an entire folder are automatically parsed upon selection"
        : "Sınır olmadan istediğiniz kadar PDF (.pdf), Word (.docx), HTML, ZIP, RAR veya doğrudan klasör seçtiğiniz anda otomatik eklenir",
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
          <source src="/videos/interview-bg.mp4?v=2" type="video/mp4" />
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

            <button
              type="button"
              onClick={() => openPremiumModal()}
              className="px-3 py-1.5 rounded-md border border-[#eab308]/50 bg-[#eab308]/15 hover:bg-[#eab308]/25 text-[#fde047] text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-[#eab308]" />
              {lang === "en" ? "Unlock Premium" : "Premium İçin Ulaşın"}
            </button>

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
            {/* Sade, Doğrudan Odaklı Başlık ve Değer Önerisi */}
            <div className="max-w-3xl space-y-3.5">
              <div className="text-[11px] font-mono-academic font-bold uppercase tracking-[0.2em] text-[#182235] border-l-2 border-[#9a5b13] pl-2.5">
                {t.heroEyebrow}
              </div>
              <h1 className="font-serif-academic text-2xl sm:text-4xl font-bold tracking-tight text-[#121926] leading-[1.18]">
                {t.heroTitle}
              </h1>
              <p className="text-sm sm:text-base text-[#252f40] leading-[1.65] max-w-2xl">
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
                <strong className="text-[#182235] font-bold underline decoration-[#9a5b13]/70 underline-offset-4">
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

            {/* ANA SAYFA SÜRÜKLE & BIRAK (DRAG & DROP) KARTI — Von Restorff Odak Alanı (`#e4dfd3`) */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropFiles(e, true)}
              className={`bg-[#e4dfd3]/96 backdrop-blur-md border-2 border-dashed rounded-2xl p-7 sm:p-9 academic-card-transition shadow-xl ${
                isDragging
                  ? "border-[#9a5b13] bg-[#dbd4c4] scale-[1.005]"
                  : "border-[#182235]/60 hover:border-[#182235]"
              }`}
            >
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 text-center lg:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[#182235] border border-[#334566] text-[#f0ece1] flex items-center justify-center shrink-0 shadow-sm">
                    {isParsingPdf ? (
                      <Loader2 className="w-6 h-6 text-[#eab308] animate-spin" />
                    ) : (
                      <FileUp className="w-6 h-6 text-[#eab308]" />
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
                  {/* Çoklu Dosya Seç Butonu (Von Restorff Birincil Odak Butonu) */}
                  <label className="px-4 py-2.5 rounded-lg bg-[#182235] hover:bg-[#22304a] text-[#f0ece1] text-xs font-semibold cursor-pointer flex items-center gap-2 shadow-sm transition-all whitespace-nowrap shrink-0 border border-[#2c3d5e]">
                    <Upload className="w-3.5 h-3.5 text-[#eab308]" />
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
                  <label className="px-4 py-2.5 rounded-lg border border-[#9e9585] bg-[#d6cfc0] hover:bg-[#cbc3b3] hover:border-[#182235] text-[#141c2b] text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0">
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

              {/* SEÇİLEBİLİR PARSER KRİTERLERİ: DEFAULT AÇIK ALANLAR & KİLİTLİ PREMİUM ALANLAR */}
              <div className="mt-6 pt-5 border-t border-[#c4bdb0] text-left space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-mono-academic font-bold uppercase tracking-[0.15em] text-[#182235]">
                    {lang === "en"
                      ? "EXTRACTED DATA FIELDS (DEFAULT & PREMIUM SELECTION)"
                      : "ÇIKARILACAK VERİ SÜTUNLARI (AKTİF VE PREMİUM SEÇİM ALANLARI)"}
                  </span>
                  <button
                    type="button"
                    onClick={() => openPremiumModal()}
                    className="text-xs font-semibold text-[#7c470b] hover:text-[#182235] underline underline-offset-4 cursor-pointer flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3" />
                    {lang === "en"
                      ? "Unlock Premium Fields — Contact Us"
                      : "Kilitli Alanları Açmak İçin Bize Ulaşın →"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* 4 Default Açık Alan (✓) */}
                  {[
                    lang === "en" ? "Full Name" : "İsim Soyisim",
                    lang === "en" ? "Age" : "Yaş",
                    lang === "en" ? "Gender" : "Cinsiyet",
                    lang === "en"
                      ? "Bachelor's Diploma?"
                      : "Lisans Diploması Var mı?",
                  ].map((fieldLabel) => (
                    <span
                      key={fieldLabel}
                      className="px-3 py-1.5 rounded-lg bg-[#182235] text-[#f0ece1] border border-[#182235] text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs select-none"
                    >
                      <span className="w-3.5 h-3.5 rounded-xs bg-[#eab308] text-[#182235] flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                      {fieldLabel}
                    </span>
                  ))}

                  {/* 5 Seçilebilir Görünümlü Kilitli Premium Alan (🔒 — Tıklayınca Bize Ulaşın Formu Açılır) */}
                  {[
                    lang === "en"
                      ? "Associate Degree?"
                      : "Ön Lisans Var mı?",
                    lang === "en"
                      ? "Associate Department"
                      : "Ön Lisans Bölümü",
                    lang === "en"
                      ? "Bachelor's Department"
                      : "Lisans Bölümü",
                    lang === "en"
                      ? "Master's Degree & Dept"
                      : "Yüksek Lisans (Master)",
                    lang === "en"
                      ? "Ph.D. / Doctorate"
                      : "Doktora (Ph.D.)",
                  ].map((lockedLabel) => (
                    <button
                      key={lockedLabel}
                      type="button"
                      onClick={() => openPremiumModal(lockedLabel)}
                      title={
                        lang === "en"
                          ? "Click to request Premium access"
                          : "Bu alanı aktif etmek için tıklayıp bize ulaşın"
                      }
                      className="group px-3 py-1.5 rounded-lg bg-[#d6cfc0] hover:bg-[#182235] text-[#182235] hover:text-[#f0ece1] border border-[#9e9585] hover:border-[#182235] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                    >
                      <span className="w-3.5 h-3.5 rounded-xs border border-[#525b6c] group-hover:border-[#eab308] bg-[#e4dfd3] group-hover:bg-[#eab308]/20 flex items-center justify-center">
                        <Lock className="w-2.5 h-2.5 text-[#7c470b] group-hover:text-[#eab308]" />
                      </span>
                      <span>{lockedLabel}</span>
                      <span className="text-[10px] font-mono-academic px-1.5 py-0.2 rounded bg-[#c4bdb0] group-hover:bg-[#eab308] text-[#182235] font-bold">
                        Premium
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Alt 01-02-03 Akademik İş Akışı Şeridi (Cowan 3-Chunk Kuralı) */}
              <div className="mt-6 pt-5 border-t border-[#c4bdb0] grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                <div className="flex items-start gap-2.5">
                  <span className="font-mono-academic text-xs font-bold text-[#7c470b] shrink-0">
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
                  <span className="font-mono-academic text-xs font-bold text-[#7c470b] shrink-0">
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
                  <span className="font-mono-academic text-xs font-bold text-[#7c470b] shrink-0">
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

              {/* YÜKLEME SONRASI SEÇİLEBİLİR PARSER KRİTER BARI (4 DEFAULT AÇIK + 5 KİLİTLİ PREMİUM) */}
              <div className="px-4 sm:px-5 py-3 bg-[#131b2b] border-t border-[#2c3a52] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono-academic font-bold uppercase tracking-wider text-[#93c5fd] mr-1">
                    {lang === "en" ? "FIELDS:" : "AKTİF & KİLİTLİ ALANLAR:"}
                  </span>
                  {[
                    lang === "en" ? "Full Name" : "İsim Soyisim",
                    lang === "en" ? "Age" : "Yaş",
                    lang === "en" ? "Gender" : "Cinsiyet",
                    lang === "en"
                      ? "Bachelor's Diploma?"
                      : "Lisans Diploması Var mı?",
                  ].map((openField) => (
                    <span
                      key={openField}
                      className="px-2.5 py-1 rounded bg-[#212f47] border border-[#3b4d6b] text-[#f0ece1] text-[11px] font-semibold inline-flex items-center gap-1"
                    >
                      <Check className="w-3 h-3 text-[#eab308] stroke-[2.5]" />
                      {openField}
                    </span>
                  ))}

                  {[
                    lang === "en"
                      ? "Associate Degree?"
                      : "Ön Lisans Var mı?",
                    lang === "en"
                      ? "Associate Dept"
                      : "Ön Lisans Bölümü",
                    lang === "en"
                      ? "Bachelor's Dept"
                      : "Lisans Bölümü",
                    lang === "en"
                      ? "Master's (M.Sc.)"
                      : "Yüksek Lisans",
                    lang === "en"
                      ? "Ph.D. / Doctorate"
                      : "Doktora (Ph.D.)",
                  ].map((lockedField) => (
                    <button
                      key={lockedField}
                      type="button"
                      onClick={() => openPremiumModal(lockedField)}
                      className="px-2.5 py-1 rounded bg-[#182235] hover:bg-[#eab308] text-[#d2ccc0] hover:text-[#182235] border border-[#eab308]/40 hover:border-[#eab308] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Lock className="w-3 h-3 text-[#eab308] group-hover:text-[#182235]" />
                      <span>{lockedField}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => openPremiumModal()}
                  className="text-[11px] font-bold text-[#eab308] hover:text-white underline underline-offset-4 cursor-pointer whitespace-nowrap"
                >
                  {lang === "en"
                    ? "Contact Us for Premium →"
                    : "Premium İçin Bize Ulaşın →"}
                </button>
              </div>
            </div>

            {layoutMode === "table" ? (
              /* ===============================================================
                 TOPLU TABLO / EXCEL ÖNİZLEME GÖRÜNÜMÜ
                 =============================================================== */
              <div className="bg-[#e2dcd0]/96 backdrop-blur-md border border-[#b8b0a0] rounded-xl overflow-hidden shadow-md">
                <div className="p-4 border-b border-[#c4bdb0] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-mono-academic font-bold uppercase tracking-[0.18em] text-[#4a5363]">
                      {lang === "en"
                        ? "02 / STRUCTURED CANDIDATE MATRIX"
                        : "02 / YAPILANDIRILMIŞ ADAY MATRİSİ"}
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
                          {lang === "en"
                            ? "Bachelor's Diploma?"
                            : "Lisans Diploması Var mı?"}
                        </th>
                        {[
                          lang === "en"
                            ? "Associate Degree?"
                            : "Ön Lisans Var mı?",
                          lang === "en"
                            ? "Associate Department"
                            : "Ön Lisans Bölümü",
                          lang === "en"
                            ? "Bachelor's Department"
                            : "Lisans Bölümü",
                          lang === "en"
                            ? "Master's (M.Sc.)"
                            : "Yüksek Lisans (Master)",
                          lang === "en"
                            ? "Ph.D. / Doctorate"
                            : "Doktora (Ph.D.)",
                        ].map((lockedCol) => (
                          <th
                            key={lockedCol}
                            onClick={() => openPremiumModal(lockedCol)}
                            className="py-3 px-3.5 font-semibold whitespace-nowrap cursor-pointer hover:text-[#eab308] transition-colors"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Lock className="w-3 h-3 text-[#eab308]" />
                              {lockedCol}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c4bdb0]">
                      {visibleEvaluations.map((item, idx) => {
                        const hasBsc = hasBachelorDiploma(item.cv);
                        const ageMissing = isAgeMissingCase(item.cv);

                        const renderLockedPremiumCell = (
                          featureLabel: string
                        ) => (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPremiumModal(featureLabel);
                            }}
                            className="px-2.5 py-1 rounded bg-[#d6cfc0] hover:bg-[#182235] text-[#3b4454] hover:text-[#f0ece1] border border-[#b0a898] hover:border-[#182235] text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap"
                          >
                            <Lock className="w-3 h-3 text-[#7c470b]" />
                            <span>
                              {lang === "en"
                                ? "Premium · Contact Us"
                                : "Premium · Bize Ulaşın"}
                            </span>
                          </button>
                        );

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
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {hasBsc ? (
                                <span className="px-2.5 py-1 rounded bg-[#182235] text-[#f0ece1] text-[11px] font-bold inline-flex items-center gap-1">
                                  <Check className="w-3 h-3 text-[#eab308]" />
                                  {lang === "en" ? "Yes" : "Var"}
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded bg-[#cfc8b8] text-[#3b4454] border border-[#b0a898] text-[11px] font-semibold">
                                  {lang === "en" ? "No" : "Yok"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              {renderLockedPremiumCell(
                                lang === "en"
                                  ? "Associate Degree Status"
                                  : "Ön Lisans Var mı?"
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              {renderLockedPremiumCell(
                                lang === "en"
                                  ? "Associate Department"
                                  : "Ön Lisans Bölümü"
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              {renderLockedPremiumCell(
                                lang === "en"
                                  ? "Bachelor's Department"
                                  : "Lisans Bölümü"
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              {renderLockedPremiumCell(
                                lang === "en"
                                  ? "Master's Degree & Department"
                                  : "Yüksek Lisans (Master)"
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              {renderLockedPremiumCell(
                                lang === "en"
                                  ? "Ph.D. / Doctorate"
                                  : "Doktora (Ph.D.)"
                              )}
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
                        const hasBsc = hasBachelorDiploma(item.cv);
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

                                  {/* 4 Default Açık Alan: İsim + Cinsiyet + Yaş + Lisans Diploması Var mı? */}
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
                                    <span
                                      className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                                        hasBsc
                                          ? "bg-[#182235] text-[#f0ece1]"
                                          : "bg-[#cfc8b8] text-[#3b4454] border border-[#b0a898]"
                                      }`}
                                    >
                                      {lang === "en"
                                        ? `Bachelor's Diploma: ${
                                            hasBsc ? "✓ Yes" : "No"
                                          }`
                                        : `Lisans Diploması: ${
                                            hasBsc ? "✓ Var" : "Yok"
                                          }`}
                                    </span>
                                  </div>
                                </div>

                                {/* Kilitli Premium Eğitim Kırılımları Satırı */}
                                <div className="pt-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPremiumModal(
                                        lang === "en"
                                          ? "Department & Graduate Degree Breakdown"
                                          : "Ön Lisans, Lisans Bölümü, Yüksek Lisans & Doktora"
                                      );
                                    }}
                                    className="w-full text-left text-[11px] bg-[#e4dfd3] hover:bg-[#182235] text-[#333d4f] hover:text-[#f0ece1] border border-[#b8b0a0] hover:border-[#182235] rounded-md px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition-all"
                                  >
                                    <span className="inline-flex items-center gap-1.5 font-medium truncate">
                                      <Lock className="w-3 h-3 text-[#7c470b] shrink-0" />
                                      <span className="truncate">
                                        {lang === "en"
                                          ? "Associate · Bachelor's Dept · Master's · Ph.D."
                                          : "Ön Lisans · Lisans Bölümü · Yüksek Lisans · Ph.D."}
                                      </span>
                                    </span>
                                    <span className="text-[10px] font-mono-academic font-bold text-[#7c470b] bg-[#d6cfc0] px-1.5 py-0.5 rounded shrink-0">
                                      {lang === "en" ? "Unlock" : "Bize Ulaşın"}
                                    </span>
                                  </button>
                                </div>
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
                      const hasBsc = hasBachelorDiploma(selectedEvaluation.cv);
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

                            {/* Sağ: Varsayılan Lisans Diploması Durumu */}
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <span
                                className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 ${
                                  hasBsc
                                    ? "bg-[#e2dcd0] text-[#182235]"
                                    : "bg-[#25344f] text-[#d2ccc0]"
                                }`}
                              >
                                {hasBsc && (
                                  <Check className="w-3.5 h-3.5 text-[#7c470b] stroke-[3]" />
                                )}
                                {lang === "en"
                                  ? `Bachelor's Diploma: ${
                                      hasBsc ? "Yes" : "No"
                                    }`
                                  : `Lisans Diploması: ${
                                      hasBsc ? "Var" : "Yok"
                                    }`}
                              </span>
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

                            {/* BÖLÜM II: LİSANS DİPLOMASI (DEFAULT AÇIK) & PREMİUM EĞİTİM KIRILIMLARI (KİLİTLİ SEÇİLEBİLİR) */}
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
                                <button
                                  type="button"
                                  onClick={() => openPremiumModal()}
                                  className="text-xs font-semibold text-[#7c470b] hover:text-[#182235] underline underline-offset-4 cursor-pointer flex items-center gap-1"
                                >
                                  <Lock className="w-3 h-3" />
                                  {lang === "en"
                                    ? "Unlock All Academic Fields"
                                    : "Tüm Eğitim Detayları İçin Bize Ulaşın"}
                                </button>
                              </div>

                              {/* VARSAYILAN AÇIK ALAN: LİSANS DİPLOMASI VAR MI? */}
                              <div className="p-3.5 rounded-lg bg-[#e2dcd0] border border-[#b0a898] flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-[10px] font-mono-academic font-bold uppercase tracking-wider text-[#4a5363]">
                                    {lang === "en"
                                      ? "DEFAULT ACTIVE FIELD"
                                      : "VARSAYILAN AÇIK KRİTER (DEFAULT)"}
                                  </div>
                                  <div className="font-serif-academic font-bold text-sm text-[#121926] mt-0.5">
                                    {lang === "en"
                                      ? "Bachelor's Degree Diploma Status"
                                      : "Lisans Diploması Var mı?"}
                                  </div>
                                </div>
                                <span
                                  className={`px-3 py-1.5 rounded-md text-xs font-bold inline-flex items-center gap-1.5 ${
                                    hasBsc
                                      ? "bg-[#182235] text-[#f0ece1]"
                                      : "bg-[#cfc8b8] text-[#3b4454] border border-[#b0a898]"
                                  }`}
                                >
                                  {hasBsc && (
                                    <Check className="w-3.5 h-3.5 text-[#eab308] stroke-[3]" />
                                  )}
                                  {hasBsc
                                    ? lang === "en"
                                      ? "✓ Yes (Bachelor's Diploma)"
                                      : "✓ Var (Lisans Diploması Mevcut)"
                                    : lang === "en"
                                    ? "No"
                                    : "Yok"}
                                </span>
                              </div>

                              {/* KİLİTLİ PREMİUM AKADEMİK ALANLAR (SEÇİLEBİLİR KARTLAR — TIKLAYINCA BİZE ULAŞIN FORMU AÇILIR) */}
                              <div className="space-y-2.5">
                                <div className="text-[11px] font-mono-academic font-bold uppercase tracking-wider text-[#3b4454]">
                                  {lang === "en"
                                    ? "SELECTABLE PREMIUM ACADEMIC BREAKDOWN (CLICK TO UNLOCK)"
                                    : "PREMİUM AKADEMİK KIRILIMLAR (AKTİF ETMEK İÇİN SEÇİN / TIKLAYIN)"}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {[
                                    {
                                      title:
                                        lang === "en"
                                          ? "Associate Degree Status (Yes / No)"
                                          : "Ön Lisans Diploması Var mı?",
                                      sub:
                                        lang === "en"
                                          ? "Vocational / Associate graduation check"
                                          : "MYO / Ön Lisans mezuniyet durumu",
                                    },
                                    {
                                      title:
                                        lang === "en"
                                          ? "Associate Department & University"
                                          : "Ön Lisans Bölümü & Üniversitesi",
                                      sub:
                                        lang === "en"
                                          ? "2-year program and school details"
                                          : "Ön lisans okulu ve bölüm adı",
                                    },
                                    {
                                      title:
                                        lang === "en"
                                          ? "Bachelor's Department & University"
                                          : "Lisans Bölümü & Üniversitesi",
                                      sub:
                                        lang === "en"
                                          ? "4-year undergraduate major & faculty"
                                          : "Lisans fakülte, üniversite ve bölüm adı",
                                    },
                                    {
                                      title:
                                        lang === "en"
                                          ? "Master's Degree (M.Sc. / M.A. / MBA)"
                                          : "Yüksek Lisans (Master) & Bölümü",
                                      sub:
                                        lang === "en"
                                          ? "Graduate university & specialization"
                                          : "Yüksek lisans üniversite ve uzmanlık alanı",
                                    },
                                    {
                                      title:
                                        lang === "en"
                                          ? "Ph.D. / Doctorate & Department"
                                          : "Doktora (Ph.D.) & Bölümü",
                                      sub:
                                        lang === "en"
                                          ? "Doctoral institution & research field"
                                          : "Doktora üniversitesi ve akademik program",
                                    },
                                  ].map((pItem) => (
                                    <button
                                      key={pItem.title}
                                      type="button"
                                      onClick={() =>
                                        openPremiumModal(pItem.title)
                                      }
                                      className="group p-3 rounded-lg bg-[#dfd9ca] hover:bg-[#182235] border border-[#b8b0a0] hover:border-[#182235] text-left transition-all cursor-pointer flex items-start justify-between gap-2.5 shadow-2xs"
                                    >
                                      <div className="space-y-0.5 min-w-0">
                                        <div className="text-xs font-bold text-[#121926] group-hover:text-[#f0ece1] flex items-center gap-1.5">
                                          <Lock className="w-3.5 h-3.5 text-[#7c470b] group-hover:text-[#eab308] shrink-0" />
                                          <span className="truncate">
                                            {pItem.title}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-[#4a5363] group-hover:text-[#cbd5e1] truncate">
                                          {pItem.sub}
                                        </div>
                                      </div>
                                      <span className="px-2 py-0.5 rounded bg-[#cfc8b8] group-hover:bg-[#eab308] text-[#182235] text-[10px] font-mono-academic font-bold shrink-0">
                                        {lang === "en"
                                          ? "Contact Us"
                                          : "Bize Ulaşın"}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
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
              <div className="text-[11px] font-mono-academic font-bold uppercase tracking-[0.2em] text-[#182235] border-l-2 border-[#9a5b13] pl-2.5">
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
            <div className="p-6 rounded-xl bg-[#182235]/94 backdrop-blur-md border border-[#2c3a52] space-y-2.5 shadow-md academic-card-transition">
              <div className="text-xs font-mono-academic font-bold text-[#eab308]">
                {t.arch1Tag}
              </div>
              <h3 className="font-serif-academic text-base font-bold text-[#f0ece1]">
                {t.arch1Title}
              </h3>
              <p className="text-xs text-[#c7c1b4] leading-relaxed">
                {t.arch1Desc}
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#182235]/94 backdrop-blur-md border border-[#2c3a52] space-y-2.5 shadow-md academic-card-transition">
              <div className="text-xs font-mono-academic font-bold text-[#eab308]">
                {t.arch2Tag}
              </div>
              <h3 className="font-serif-academic text-base font-bold text-[#f0ece1]">
                {t.arch2Title}
              </h3>
              <p className="text-xs text-[#c7c1b4] leading-relaxed">
                {t.arch2Desc}
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#182235]/94 backdrop-blur-md border border-[#2c3a52] space-y-2.5 shadow-md academic-card-transition">
              <div className="text-xs font-mono-academic font-bold text-[#eab308]">
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
            <div className="text-[11px] font-mono-academic font-bold uppercase tracking-[0.2em] text-[#182235] border-l-2 border-[#9a5b13] pl-2.5">
              {t.sec3Eyebrow}
            </div>
            <h2 className="font-serif-academic text-xl sm:text-2xl font-bold text-[#121926] tracking-tight">
              {t.sec3Title}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-[#e3ddd0]/94 backdrop-blur-md border border-[#b5ad9d] space-y-2 shadow-xs academic-card-transition">
              <div className="text-xs font-mono-academic font-bold text-[#7c470b]">
                01
              </div>
              <h3 className="font-serif-academic text-sm font-bold text-[#121926]">
                {t.feat1Title}
              </h3>
              <p className="text-xs text-[#333d4f] leading-relaxed">
                {t.feat1Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#e3ddd0]/94 backdrop-blur-md border border-[#b5ad9d] space-y-2 shadow-xs academic-card-transition">
              <div className="text-xs font-mono-academic font-bold text-[#7c470b]">
                02
              </div>
              <h3 className="font-serif-academic text-sm font-bold text-[#121926]">
                {t.feat2Title}
              </h3>
              <p className="text-xs text-[#333d4f] leading-relaxed">
                {t.feat2Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#e3ddd0]/94 backdrop-blur-md border border-[#b5ad9d] space-y-2 shadow-xs academic-card-transition">
              <div className="text-xs font-mono-academic font-bold text-[#7c470b]">
                03
              </div>
              <h3 className="font-serif-academic text-sm font-bold text-[#121926]">
                {t.feat3Title}
              </h3>
              <p className="text-xs text-[#333d4f] leading-relaxed">
                {t.feat3Desc}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#e3ddd0]/94 backdrop-blur-md border border-[#b5ad9d] space-y-2 shadow-xs academic-card-transition">
              <div className="text-xs font-mono-academic font-bold text-[#7c470b]">
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

      {/* =====================================================================
          MODAL 3: PREMİUM ERİŞİM & KURUMSAL BİZE ULAŞIN FORMU
         ===================================================================== */}
      {isPremiumModalOpen && (
        <div
          onClick={() => setIsPremiumModalOpen(false)}
          className="fixed inset-0 z-50 bg-[#141c2b]/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#e2dcd0] rounded-2xl border border-[#b8b0a0] max-w-lg w-full overflow-hidden shadow-2xl"
          >
            {/* Üst Koyu Oxford Arduvaz Başlık */}
            <div className="bg-[#182235] text-[#f0ece1] px-6 py-4 flex items-start justify-between gap-3 border-b border-[#2c3a52]">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-mono-academic font-bold uppercase tracking-[0.18em] text-[#eab308]">
                  <Lock className="w-3 h-3" />
                  <span>
                    {lang === "en"
                      ? "CORPORATE & PREMIUM ACCESS"
                      : "KURUMSAL & PREMİUM PAKET TALEBİ"}
                  </span>
                </div>
                <h3 className="font-serif-academic font-bold text-lg text-[#f0ece1]">
                  {lang === "en"
                    ? "Contact Us to Unlock All Academic Fields"
                    : "Premium Kırılımları Açmak İçin Bize Ulaşın"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPremiumModalOpen(false)}
                className="text-[#b8b2a6] hover:text-white text-xl leading-none cursor-pointer px-1"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Seçilen Kilitli Kriter Özeti */}
              <div className="p-3.5 rounded-xl bg-[#ece7db] border border-[#b8b0a0] space-y-2">
                <div className="text-[11px] font-mono-academic font-bold uppercase tracking-wider text-[#7c470b]">
                  {lang === "en"
                    ? "REQUESTED PREMIUM FEATURE:"
                    : "AÇMAK İSTEDİĞİNİZ PREMİUM ÖZELLİK:"}
                </div>
                <div className="font-serif-academic font-bold text-sm text-[#121926]">
                  {premiumFeatureTitle}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    lang === "en" ? "Associate Degree?" : "Ön Lisans Var mı?",
                    lang === "en"
                      ? "Associate Department"
                      : "Ön Lisans Bölümü",
                    lang === "en"
                      ? "Bachelor's Department"
                      : "Lisans Bölümü",
                    lang === "en"
                      ? "Master's (M.Sc.)"
                      : "Yüksek Lisans (Master)",
                    lang === "en" ? "Ph.D. / Doctorate" : "Doktora (Ph.D.)",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#d6cfc0] text-[#182235] border border-[#b0a898]"
                    >
                      ✓ {tag}
                    </span>
                  ))}
                </div>
              </div>

              {leadSubmittedSuccess ? (
                <div className="p-5 rounded-xl bg-[#182235] text-[#f0ece1] space-y-2 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[#eab308] mx-auto" />
                  <h4 className="font-serif-academic font-bold text-base">
                    {lang === "en"
                      ? "Your Request Has Been Received!"
                      : "Talebiniz Başarıyla Alındı!"}
                  </h4>
                  <p className="text-xs text-[#cbd5e1] leading-relaxed">
                    {lang === "en"
                      ? "Our team will contact your company shortly to activate Associate, Bachelor's Department, Master's, and Ph.D. columns for your account."
                      : "Ekibimiz en kısa sürede sizinle iletişime geçerek şirketiniz için Ön Lisans, Lisans Bölümü, Yüksek Lisans ve Doktora sütunlarını aktif edecektir."}
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsPremiumModalOpen(false)}
                      className="px-5 py-2 rounded-lg bg-[#e2dcd0] text-[#182235] text-xs font-bold cursor-pointer hover:bg-white transition-colors"
                    >
                      {lang === "en" ? "Close" : "Tamam, Kapat"}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitPremiumLead} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#182235] mb-1">
                        {lang === "en" ? "Full Name *" : "Ad Soyad *"}
                      </label>
                      <input
                        type="text"
                        required
                        value={leadFullName}
                        onChange={(e) => setLeadFullName(e.target.value)}
                        placeholder={
                          lang === "en" ? "Your Name" : "Adınız Soyadınız"
                        }
                        className="w-full border border-[#a8a090] bg-[#ece7db] rounded-lg px-3 py-2 text-xs text-[#121926] focus:outline-none focus:border-[#182235]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#182235] mb-1">
                        {lang === "en"
                          ? "Company / Institution"
                          : "Şirket / Kurum Adı"}
                      </label>
                      <input
                        type="text"
                        value={leadCompany}
                        onChange={(e) => setLeadCompany(e.target.value)}
                        placeholder={
                          lang === "en" ? "Company Name" : "Şirketinizin Adı"
                        }
                        className="w-full border border-[#a8a090] bg-[#ece7db] rounded-lg px-3 py-2 text-xs text-[#121926] focus:outline-none focus:border-[#182235]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#182235] mb-1">
                      {lang === "en"
                        ? "Phone or Work Email *"
                        : "Telefon Numarası veya Kurumsal E-Posta *"}
                    </label>
                    <input
                      type="text"
                      required
                      value={leadContact}
                      onChange={(e) => setLeadContact(e.target.value)}
                      placeholder={
                        lang === "en"
                          ? "+90 5XX XXX XX XX or name@company.com"
                          : "05XX XXX XX XX veya ad@sirket.com"
                      }
                      className="w-full border border-[#a8a090] bg-[#ece7db] rounded-lg px-3 py-2 text-xs text-[#121926] focus:outline-none focus:border-[#182235]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#182235] mb-1">
                      {lang === "en"
                        ? "Your Note / Monthly CV Volume (Optional)"
                        : "Notunuz / İhtiyacınız (Opsiyonel)"}
                    </label>
                    <textarea
                      rows={3}
                      value={leadMessage}
                      onChange={(e) => setLeadMessage(e.target.value)}
                      placeholder={
                        lang === "en"
                          ? "Tell us about your recruitment needs or CV volume..."
                          : "Şirketinizin işe alım süreci veya açmak istediğiniz ek kriterler hakkında kısa bilgi yazabilirsiniz..."
                      }
                      className="w-full border border-[#a8a090] bg-[#ece7db] rounded-lg p-2.5 text-xs text-[#121926] focus:outline-none focus:border-[#182235]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#c4bdb0]">
                    <button
                      type="button"
                      onClick={() => setIsPremiumModalOpen(false)}
                      className="px-4 py-2 rounded-lg border border-[#a8a090] bg-[#d6cfc0] hover:bg-[#cbc3b3] text-xs font-semibold text-[#182235] cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingLead}
                      className="px-5 py-2 rounded-lg bg-[#182235] hover:bg-[#22304a] text-[#f0ece1] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      {isSubmittingLead ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5 text-[#eab308]" />
                      )}
                      {lang === "en"
                        ? "Send Premium Request"
                        : "Talebi Gönder & Bize Ulaşın"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
