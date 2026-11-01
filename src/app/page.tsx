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
          "Bachelor's University",
          "Associate Degree (Premium)",
          "Bachelor's Department (Premium)",
          "Master's Degree (Premium)",
          "Ph.D. / Doctorate (Premium)",
          "Profession / Role (Premium)",
          "Experience & Skills (Premium)",
        ]
      : [
          "Sıra No",
          "Dosya Adı",
          "Ad Soyad",
          "Cinsiyet",
          "Yaş",
          "Lisans Üniversitesi",
          "Ön Lisans (Premium)",
          "Lisans Bölümü (Premium)",
          "Yüksek Lisans (Premium)",
          "Doktora / Ph.D. (Premium)",
          "Meslek / Pozisyon (Premium)",
          "Deneyim, Dil & Yazılım (Premium)",
        ];

  const colWidths = [9, 28, 24, 14, 12, 28, 28, 30, 30, 30, 30, 32];

  const rows: (string | number)[][] = evaluations.map((item, idx) => {
    const cv = item.cv;
    const noAge = isAgeMissingCase(cv);
    const ageDisplay = noAge ? "-" : cv.detectedAge ?? "-";

    const hasBsc = hasBachelorDiploma(cv);
    const bscUniRaw =
      cv.educationByDegree?.bachelor?.university || cv.university || "";
    const bscDisplay =
      hasBsc &&
      bscUniRaw &&
      bscUniRaw !== "Belirtilmemiş" &&
      bscUniRaw !== "Belirsiz"
        ? bscUniRaw
        : "-";
    const lockedLabel =
      lang === "en"
        ? "🔒 Premium — Contact Us"
        : "🔒 Premium — Bize Ulaşın";

    return [
      idx + 1,
      cv.source || "-",
      cv.fullName || "-",
      cv.detectedGender === "Belirsiz"
        ? "-"
        : translateGender(cv.detectedGender, lang),
      ageDisplay,
      bscDisplay,
      lockedLabel,
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
        let bodyTxt = "";
        try {
          const mammoth = (await import("mammoth")).default;
          const res = await mammoth.extractRawText({ arrayBuffer });
          bodyTxt = (res.value || "").trim();
        } catch {
          bodyTxt = "";
        }
        try {
          const JSZip = (await import("jszip")).default;
          const docxZip = await JSZip.loadAsync(arrayBuffer);
          const parseWordXml = (xml: string): string =>
            xml
              .replace(/<\/w:tc>/gi, " | ")
              .replace(/<\/w:p>|<\/w:tr>|<w:br[^>]*\/>/gi, "\n")
              .replace(/<[^>]+>/g, "")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/[ \t]+/g, " ")
              .replace(/\n\s*\n+/g, "\n")
              .trim();
          const headerChunks: string[] = [];
          for (const hName of ["word/header1.xml", "word/header2.xml", "word/header3.xml"]) {
            const hf = docxZip.file(hName);
            if (hf) {
              const hTxt = parseWordXml(await hf.async("string"));
              if (hTxt && !bodyTxt.includes(hTxt)) headerChunks.push(hTxt);
            }
          }
          if (!bodyTxt) {
            const docFile = docxZip.file("word/document.xml");
            if (docFile) {
              bodyTxt = parseWordXml(await docFile.async("string"));
            }
          }
          extractedText = [...headerChunks, bodyTxt].filter(Boolean).join("\n\n");
        } catch {
          extractedText =
            bodyTxt ||
            new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
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
        ? "Corporate CV Analysis & Excel Reporting"
        : "Kurumsal Özgeçmiş Analizi & Excel Raporlama",
    navUpload: lang === "en" ? "Upload" : "Yükleme",
    navSystem: lang === "en" ? "Services" : "Hizmetler",
    navResults: lang === "en" ? "Results" : "Sonuçlar",
    btnBenchmark:
      lang === "en" ? "Label & Benchmark" : "Etiketle & Başarı Ölç",
    btnExportTop: lang === "en" ? "Export Excel (.xlsx)" : "Excel İndir (.xlsx)",
    btnExportTooltip:
      lang === "en"
        ? "Download extracted candidate data as Excel (.xlsx)"
        : "Yüklenen tüm CV'lerin ayrıştırılmış verilerini Excel (.xlsx) olarak indir",
    btnClear: lang === "en" ? "Clear" : "Temizle",
    dragOverlayTitle:
      lang === "en"
        ? "Drop Any Number of CV Files, Folders, or .ZIP / .RAR Archives Here"
        : "İstediğiniz Kadar CV Dosyasını, Klasörü veya .ZIP / .RAR Arşivini Bırakın",
    dragOverlaySub:
      lang === "en"
        ? "No file limits—drop 10 or 1,000+ CVs at once; all candidate fields are extracted for instant Excel export."
        : "Sınır yok; ister 10 ister 1.000+ CV'yi aynı anda bırakın. Tüm aday verileri çıkarılıp anında Excel'e hazır hale getirilir.",
    heroEyebrow:
      lang === "en"
        ? "01 — CORPORATE CV ANALYSIS & EXCEL REPORTING"
        : "01 — ŞİRKETLER İÇİN KURUMSAL ÖZGEÇMİŞ ANALİZİ VE EXCEL RAPORLAMA",
    heroTitle:
      lang === "en"
        ? "Turn Hundreds or Thousands of CVs into a Clean Excel Table in Seconds."
        : "Yüzlerce Hatta Binlerce Özgeçmişi Saniyeler İçinde Düzenli Excel Tablosuna Dönüştürün.",
    heroDescStart:
      lang === "en"
        ? "Drop any number of PDF, Word, folder, or archive files at once. Extract "
        : "Adet sınırı olmadan tüm PDF, Word, klasör veya arşiv dosyalarınızı tek seferde bırakın; ",
    heroAge: lang === "en" ? "Age, Gender, Education" : "Yaş, Cinsiyet, Eğitim",
    heroGender:
      lang === "en"
        ? "Profession, Experience"
        : "Meslek, Deneyim Yılı",
    heroAnd: lang === "en" ? ", and " : " ve ",
    heroDegrees:
      lang === "en"
        ? "100+ Custom Company Criteria"
        : "Şirketinize Özel 100+ Kriteri",
    heroDescMid:
      lang === "en"
        ? " into a ready-to-filter "
        : " tek tıkla düzenli ",
    heroExcel: lang === "en" ? "Excel (.xlsx)" : "Excel (.xlsx)",
    heroDescEnd:
      lang === "en" ? " spreadsheet." : " tablosu olarak indirin.",
    readingFiles:
      lang === "en" ? "Reading CV files..." : "Dosyalar okunuyor...",
    dropTitleDragging:
      lang === "en"
        ? "Release Your Files or Folder Here Now!"
        : "Dosyaları veya Klasörü Şimdi Buraya Bırakın!",
    dropTitleEmpty:
      lang === "en"
        ? "Drag & Drop CV Files, Folders, or .ZIP / .RAR Archives Here"
        : "CV Dosyalarını, Klasörü veya .ZIP / .RAR Arşivini Buraya Bırakın",
    dropTitleLoaded: (count: number) =>
      lang === "en"
        ? `Drag & Drop Additional CVs, Folder, or .ZIP Archive Here (${count} CVs Loaded)`
        : `Yeni CV'leri, Klasörü veya .ZIP Arşivini Buraya Sürükleyip Bırakın (${count} CV Yüklü)`,
    dropSubText:
      lang === "en"
        ? "No file limits — upload 10 or 1,000+ .PDF, .DOCX, .ZIP, or .RAR files at once and export directly to Excel (.xlsx)."
        : "Sınır yok — ister 10 ister 1.000+ adet .PDF, .DOCX, .ZIP, .RAR dosyasını veya klasörü tek seferde yükleyin.",
    btnSelectFiles:
      lang === "en"
        ? "Upload CV"
        : "CV Yükle",
    btnSelectFolder:
      lang === "en" ? "Select Folder" : "Klasör Seç",
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
        ? "100+ Extracted Data Columns"
        : "100+ Farklı Veri Sütunu",
    step2Desc:
      lang === "en"
        ? "From education tiers to profession, experience years, languages, software, and certificates."
        : "Eğitim kademelerinden mesleğe, deneyim yılından yabancı dil, yazılım ve sertifikalara kadar her detayı çıkarır.",
    step3Title:
      lang === "en"
        ? "Instant Corporate Excel (.xlsx)"
        : "Anında Kurumsal Excel (.xlsx)",
    step3Desc:
      lang === "en"
        ? "Download your entire applicant pool as a ready-to-filter Excel table."
        : "Tüm aday havuzunuzu dilediğiniz kırılımlarla hazır Excel tablosu olarak indirin.",
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
        ? `Candidate Data Table (${count} Candidates)`
        : `Aday Veri Tablosu (${count} Aday)`,
    tableSub:
      lang === "en"
        ? "Preview of candidate records included in the Excel (.xlsx) export"
        : "Excel (.xlsx) çıktısında yer alacak aday verileri",
    searchTablePlaceholder:
      lang === "en" ? "Search in table..." : "Tabloda ara...",
    colNameFile:
      lang === "en" ? "Full Name / File" : "Ad Soyad / Dosya",
    colGender: lang === "en" ? "Gender" : "Cinsiyet",
    colAge: lang === "en" ? "Age" : "Yaş",
    colDegrees: lang === "en" ? "Academic Degrees" : "Eğitim Dereceleri",
    colAssoc:
      lang === "en"
        ? "Associate"
        : "Ön Lisans",
    colBachelor:
      lang === "en"
        ? "Bachelor's"
        : "Lisans",
    colMaster:
      lang === "en"
        ? "Master's"
        : "Yüksek Lisans",
    colPhd:
      lang === "en"
        ? "Ph.D. / Doctorate"
        : "Doktora / Ph.D.",
    ageUnit: lang === "en" ? "" : "",
    ageYearsOld: lang === "en" ? "" : "",
    noAgeEduDate: "-",
    noAgeEduDateLong: "-",
    unspecified: "-",
    notSpecified: "-",
    ageNotSpecified: "-",
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
        ? "Extracted Candidate Summary"
        : "Aday Bilgi Özeti",
    genderLabel: lang === "en" ? "Gender" : "Cinsiyet",
    ageLabel: lang === "en" ? "Age" : "Yaş",
    eduSectionTitle:
      lang === "en"
        ? "Extracted Education, Profession & Competency Fields"
        : "Eğitim, Meslek, Deneyim ve Yetkinlik Alanları",
    noUniDeptDetected: "-",
    rawCvTextHeading:
      lang === "en" ? "CV Text" : "CV Metni",
    selectCandidatePrompt:
      lang === "en"
        ? "Select a candidate from the list on the left to inspect details."
        : "Detayları görmek için soldaki listeden bir adaya tıklayın.",
    sec2Eyebrow:
      lang === "en"
        ? "02 — WHAT WE EXTRACT FOR YOUR COMPANY"
        : "02 — ŞİRKETİNİZ İÇİN ÇIKARDIĞIMIZ VERİLER VE HİZMETLERİMİZ",
    sec2Title:
      lang === "en"
        ? "Not Just Age, Gender & School — We Extract Every Detail in a CV"
        : "Sadece Yaş, Cinsiyet ve Okul Değil; Özgeçmişteki Tüm Bilgileri Tabloya Çıkarıyoruz",
    sec2Sub:
      lang === "en"
        ? "We turn unstructured CV files into a clean Excel spreadsheet tailored to your company's exact hiring criteria."
        : "Yüzlerce özgeçmişi tek tek okumak yerine, şirketinizin aradığı tüm kriterleri tek bir düzenli Excel tablosunda teslim alın.",
    arch1Tag:
      lang === "en" ? "01 / EDUCATION & IDENTITY" : "01 / KİMLİK, İLETİŞİM & TÜM EĞİTİM KADEMELERİ",
    arch1Title:
      lang === "en"
        ? "Age, Gender, City & All University Degrees"
        : "Yaş, Cinsiyet, Şehir ve Ön Lisans · Lisans · Master · Doktora",
    arch1Desc:
      lang === "en"
        ? "Full name, age, gender, city/district, phone, email, and separate columns for Associate, Bachelor's, Master's, and Ph.D. universities, departments, and GPA."
        : "Ad soyad, yaş, cinsiyet, ikamet şehri/ilçesi, telefon, e-posta ile Ön Lisans, Lisans, Yüksek Lisans ve Doktora üniversite ve bölümlerini ayrı sütunlara çıkarır.",
    arch2Tag:
      lang === "en" ? "02 / PROFESSION & EXPERIENCE" : "02 / MESLEK, DENEYİM YILI & ÇALIŞTIĞI ŞİRKETLER",
    arch2Title:
      lang === "en"
        ? "Role, Total Experience Years & Past Employers"
        : "Ne İşi Yapar (Meslek), Toplam Deneyim Yılı ve Geçmiş Şirketler",
    arch2Desc:
      lang === "en"
        ? "Candidate's profession/role title, total years of experience, last company, all previous employers, sector experience, and seniority level."
        : "Adayın ne iş yaptığı (uzmanlık/pozisyon), toplam kaç yıl deneyimi olduğu, son çalıştığı firma, geçmiş tüm şirketleri ve kıdem seviyesi.",
    arch3Tag:
      lang === "en"
        ? "03 / LANGUAGES, SOFTWARE & 100+ CRITERIA"
        : "03 / YABANCI DİL, YAZILIM, SERTİFİKA & 100+ ÖZEL KRİTER",
    arch3Title:
      lang === "en"
        ? "Foreign Languages, ERP/Software, Certificates & Custom Fields"
        : "Dil Seviyeleri, SAP/Office/Yazılım, Ehliyet, Askerlik ve 100+ Kriter",
    arch3Desc:
      lang === "en"
        ? "English/German/foreign language levels, SAP, Excel, AutoCAD, software stacks, professional certificates, military status, driving license, and any custom company criterion."
        : "İngilizce ve diğer yabancı diller, SAP/ERP, ileri Excel, mühendislik ve yazılım programları, sertifikalar, askerlik, ehliyet ve şirketinize özel 100+ ek kriter.",
    footerDesc:
      lang === "en"
        ? "Corporate Curriculum Vitae Analysis and Excel Reporting System"
        : "Kurumsal Özgeçmiş Analizi & Excel Raporlama Sistemi",
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
        <div className="absolute inset-0 bg-gradient-to-b from-[#c4bdb0]/78 via-[#ccc5b7]/72 to-[#beb7a8]/82 backdrop-blur-[1px]" />
      </div>

      {/* =====================================================================
          1. ÜST BAR (NAVBAR)
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

          {/* Orta: Tek Kelimelik Menü Linkleri */}
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
            {candidates.length > 0 && (
              <a
                href="#sonuclar"
                className="text-[#93c5fd] hover:text-white transition-colors whitespace-nowrap"
              >
                {t.navResults} ({candidates.length})
              </a>
            )}
          </nav>

          {/* Sağ: Dil Seçici (TR | EN), Premium & Excel İndir */}
          <div className="flex items-center gap-2 shrink-0">
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
              {lang === "en" ? "Unlock All 100+ Fields" : "Premium İçin Ulaşın"}
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

        {candidates.length === 0 ? (
          <section id="yukleme" className="space-y-7 pt-2">
            <div className="max-w-3xl space-y-3.5">
              <div className="text-[11px] font-mono-academic font-bold uppercase tracking-[0.2em] text-[#182235] border-l-2 border-[#9a5b13] pl-2.5">
                {t.heroEyebrow}
              </div>
              <h1 className="font-serif-academic text-2xl sm:text-4xl font-bold tracking-tight text-[#121926] leading-[1.18]">
                {t.heroTitle}
              </h1>
              <p className="text-sm sm:text-base text-[#252f40] leading-[1.65] max-w-3xl">
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

            {/* ANA SAYFA SÜRÜKLE & BIRAK KARTI (SADE, SİMETRİK VE DÜZENLİ) */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropFiles(e, true)}
              className={`bg-[#e4dfd3]/96 backdrop-blur-md border-2 border-dashed rounded-2xl p-6 sm:p-8 academic-card-transition shadow-xl ${
                isDragging
                  ? "border-[#9a5b13] bg-[#dbd4c4] scale-[1.005]"
                  : "border-[#182235]/60 hover:border-[#182235]"
              }`}
            >
              <div className="flex flex-col lg:flex-row items-center justify-between gap-5 text-center lg:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-13 h-13 rounded-xl bg-[#182235] border border-[#334566] text-[#f0ece1] flex items-center justify-center shrink-0 shadow-sm">
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
                    <p className="text-xs sm:text-sm text-[#333d4f] mt-1 leading-relaxed max-w-xl">
                      {t.dropSubText}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center shrink-0">
                  <label className="px-5 py-3 rounded-lg bg-[#182235] hover:bg-[#22304a] text-[#f0ece1] text-xs sm:text-sm font-semibold cursor-pointer flex items-center gap-2 shadow-sm transition-all whitespace-nowrap shrink-0 border border-[#2c3d5e]">
                    <Upload className="w-4 h-4 text-[#eab308]" />
                    {t.btnSelectFiles}
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc,.html,.htm,.zip,.rar,.txt,.md,text/html,application/pdf,application/zip,application/x-rar-compressed,application/vnd.rar,application/x-zip-compressed,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleDirectFilesUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* SİMETRİK 4x5 SÜTUN SEÇİM MATRİSİ (Eşit Genişlikli 20 Kutu: 4 Açık + 16 Kilitli) */}
              <div className="mt-6 pt-5 border-t border-[#c4bdb0] text-left space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-mono-academic font-bold uppercase tracking-[0.14em] text-[#182235]">
                    {lang === "en"
                      ? "EXCEL TABLE COLUMNS (4 DEFAULT OPEN & 100+ PREMIUM OPTIONS)"
                      : "TABLO SÜTUNLARI (STANDART AÇIK & PREMİUM SEÇENEKLER)"}
                  </span>
                  <button
                    type="button"
                    onClick={() => openPremiumModal()}
                    className="text-xs font-semibold text-[#7c470b] hover:text-[#182235] cursor-pointer flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3" />
                    {lang === "en"
                      ? "Contact Us for Locked Columns →"
                      : "Kilitli Sütunları Açmak İçin Bize Ulaşın →"}
                  </button>
                </div>

                {/* 4 Sütun x 5 Satır Tam Hizalı ve Eşit Genişlikli Grid (20 Kutu) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* 1. Satır: 4 Varsayılan Açık Sütun */}
                  {[
                    lang === "en" ? "Full Name" : "Ad Soyad",
                    lang === "en" ? "Age" : "Yaş",
                    lang === "en" ? "Gender" : "Cinsiyet",
                    lang === "en"
                      ? "Bachelor's University"
                      : "Lisans Üniversitesi",
                  ].map((fieldLabel) => (
                    <div
                      key={fieldLabel}
                      className="h-10 px-3.5 rounded-lg bg-[#182235] text-[#f0ece1] border border-[#182235] text-xs font-semibold flex items-center justify-between gap-2 select-none"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="w-4 h-4 rounded-xs bg-[#eab308] text-[#182235] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                        <span className="truncate">{fieldLabel}</span>
                      </span>
                      <span className="text-[10px] font-mono-academic text-[#93c5fd] shrink-0">
                        {lang === "en" ? "Active" : "Açık"}
                      </span>
                    </div>
                  ))}

                  {/* 2.–5. Satırlar: 16 Kilitli Seçilebilir Sütun (Eşit Genişlikte ve Tam Hizalı) */}
                  {[
                    lang === "en" ? "Associate Degree" : "Ön Lisans & Bölümü",
                    lang === "en"
                      ? "Bachelor's Department"
                      : "Lisans Bölümü",
                    lang === "en"
                      ? "Master's (M.Sc.)"
                      : "Yüksek Lisans (Master)",
                    lang === "en" ? "Ph.D. / Doctorate" : "Doktora (Ph.D.)",
                    lang === "en"
                      ? "Graduation Year & GPA"
                      : "Mezuniyet Yılı & GPA",
                    lang === "en"
                      ? "Profession / Role"
                      : "Meslek / Ne İşi Yapar",
                    lang === "en"
                      ? "Total Experience (Years)"
                      : "Toplam Deneyim (Yıl)",
                    lang === "en"
                      ? "Past Employers"
                      : "Çalıştığı Şirketler",
                    lang === "en"
                      ? "English Level"
                      : "İngilizce Seviyesi",
                    lang === "en"
                      ? "2nd Foreign Language"
                      : "2. Yabancı Dil",
                    lang === "en"
                      ? "SAP / ERP & Office"
                      : "SAP / ERP & Office",
                    lang === "en"
                      ? "Software & Tools"
                      : "Yazılım & Programlar",
                    lang === "en"
                      ? "City & District"
                      : "İkamet Şehri & İlçe",
                    lang === "en"
                      ? "Certificates & Licenses"
                      : "Mesleki Sertifikalar",
                    lang === "en"
                      ? "Military & Driving"
                      : "Askerlik & Ehliyet",
                    lang === "en"
                      ? "+80 Custom Criteria"
                      : "+80 Özel Şirket Kriteri",
                  ].map((lockedLabel) => (
                    <button
                      key={lockedLabel}
                      type="button"
                      onClick={() => openPremiumModal(lockedLabel)}
                      className="group h-10 px-3.5 rounded-lg bg-[#d8d1c3] hover:bg-[#182235] text-[#182235] hover:text-[#f0ece1] border border-[#a8a090] hover:border-[#182235] text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-all text-left"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="w-4 h-4 rounded-xs border border-[#6b7280] group-hover:border-[#eab308] bg-[#e4dfd3] group-hover:bg-[#eab308]/20 flex items-center justify-center shrink-0">
                          <Lock className="w-2.5 h-2.5 text-[#7c470b] group-hover:text-[#eab308]" />
                        </span>
                        <span className="truncate">{lockedLabel}</span>
                      </span>
                      <span className="text-[10px] font-mono-academic text-[#7c470b] group-hover:text-[#eab308] shrink-0">
                        {lang === "en" ? "Unlock" : "Kilitli"}
                      </span>
                    </button>
                  ))}
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

                  {/* + CV Ekle (Tek Buton) */}
                  <label className="px-3.5 py-1.5 rounded-lg border border-[#3b4d6b] bg-[#212f47] hover:bg-[#2a3b57] text-[#f0ece1] text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5 text-[#93c5fd]" />
                    {lang === "en" ? "+ Upload CV" : "+ CV Yükle"}
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc,.html,.htm,.zip,.rar,.txt,.md,text/html,application/pdf,application/zip,application/x-rar-compressed,application/vnd.rar,application/x-zip-compressed,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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

              {/* YÜKLEME SONRASI SİMETRİK SÜTUN BARI */}
              <div className="px-4 sm:px-5 py-2.5 bg-[#131b2b] border-t border-[#2c3a52] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    lang === "en" ? "Full Name" : "Ad Soyad",
                    lang === "en" ? "Age" : "Yaş",
                    lang === "en" ? "Gender" : "Cinsiyet",
                    lang === "en"
                      ? "Bachelor's University"
                      : "Lisans Üniversitesi",
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
                    lang === "en" ? "Associate Degree" : "Ön Lisans & Bölümü",
                    lang === "en" ? "Bachelor's Dept" : "Lisans Bölümü",
                    lang === "en" ? "Master's (M.Sc.)" : "Yüksek Lisans",
                    lang === "en" ? "Ph.D." : "Doktora",
                  ].map((lockedField) => (
                    <button
                      key={lockedField}
                      type="button"
                      onClick={() => openPremiumModal(lockedField)}
                      className="px-2.5 py-1 rounded bg-[#182235] hover:bg-[#eab308] text-[#d2ccc0] hover:text-[#182235] border border-[#eab308]/40 hover:border-[#eab308] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Lock className="w-3 h-3 text-[#eab308]" />
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
                    ? "Unlock All 100+ Columns →"
                    : "Tüm Kilitli Sütunları Açın →"}
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
                        ? "02 / CANDIDATE DATA TABLE"
                        : "02 / ADAY VERİ TABLOSU"}
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
                            ? "Bachelor's University"
                            : "Lisans Üniversitesi"}
                        </th>
                        {[
                          lang === "en"
                            ? "Bachelor's Department"
                            : "Lisans Bölümü",
                          lang === "en"
                            ? "Associate & Master's / Ph.D."
                            : "Ön Lisans · Master · Doktora",
                          lang === "en"
                            ? "Profession / Role"
                            : "Meslek / Ne İşi Yapar",
                          lang === "en"
                            ? "Experience & Companies"
                            : "Deneyim Yılı & Şirketler",
                          lang === "en"
                            ? "Languages, Software & 100+ More"
                            : "Yabancı Dil, Yazılım & 100+ Kriter",
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
                        const bscUniRaw =
                          item.cv.educationByDegree?.bachelor?.university ||
                          item.cv.university ||
                          "";
                        const bscUniDisplay =
                          hasBsc &&
                          bscUniRaw &&
                          bscUniRaw !== "Belirtilmemiş" &&
                          bscUniRaw !== "Belirsiz"
                            ? bscUniRaw
                            : "-";

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
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#182235] text-[#f0ece1]">
                                {item.cv.detectedGender === "Belirsiz"
                                  ? "-"
                                  : translateGender(
                                      item.cv.detectedGender,
                                      lang
                                    )}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap font-bold text-[#121926]">
                              {item.cv.detectedAge !== null && !ageMissing
                                ? item.cv.detectedAge
                                : "-"}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap font-semibold text-[#121926]">
                              {bscUniDisplay}
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
                                  ? "Associate, Master's & Ph.D."
                                  : "Ön Lisans, Yüksek Lisans & Doktora"
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              {renderLockedPremiumCell(
                                lang === "en"
                                  ? "Profession / Role"
                                  : "Meslek / Ne İşi Yapar"
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              {renderLockedPremiumCell(
                                lang === "en"
                                  ? "Experience Years & Companies"
                                  : "Deneyim Yılı & Çalıştığı Şirketler"
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              {renderLockedPremiumCell(
                                lang === "en"
                                  ? "Foreign Languages, Software & 100+ Criteria"
                                  : "Yabancı Dil, Yazılım, Sertifika & 100+ Kriter"
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
                        ? `Showing ${visibleEvaluations.length} of ${displayedEvaluations.length} candidates`
                        : `Toplam ${displayedEvaluations.length} adaydan ilk ${visibleEvaluations.length} aday gösteriliyor`}
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
                 İKİLİ GÖRÜNÜM (SOL: ADAY LİSTESİ, SAĞ: ADAY ÖZETİ)
                 =============================================================== */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* SOL SÜTUN: ADAY HAVUZU LİSTESİ (5 Sütun) */}
                <div className="lg:col-span-5 bg-[#e2dcd0]/96 backdrop-blur-md border border-[#b8b0a0] rounded-xl overflow-hidden shadow-md">
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
                        const bscUniRaw =
                          item.cv.educationByDegree?.bachelor?.university ||
                          item.cv.university ||
                          "";
                        const bscUniDisplay =
                          hasBsc &&
                          bscUniRaw &&
                          bscUniRaw !== "Belirtilmemiş" &&
                          bscUniRaw !== "Belirsiz"
                            ? bscUniRaw
                            : "-";

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

                                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#d4cdc0] border border-[#b8b0a0] text-[#182235] font-semibold">
                                      {item.cv.detectedGender === "Belirsiz"
                                        ? "-"
                                        : translateGender(
                                            item.cv.detectedGender,
                                            lang
                                          )}
                                    </span>
                                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#d4cdc0] border border-[#b8b0a0] text-[#273142] font-medium">
                                      {item.cv.detectedAge !== null &&
                                      !ageMissing
                                        ? `${item.cv.detectedAge}`
                                        : "-"}
                                    </span>
                                    <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-[#182235] text-[#f0ece1] truncate max-w-[200px]">
                                      {bscUniDisplay}
                                    </span>
                                  </div>
                                </div>

                                <div className="pt-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPremiumModal(
                                        lang === "en"
                                          ? "Department, Profession, Experience & 100+ Criteria"
                                          : "Bölüm, Yüksek Lisans, Meslek, Deneyim, Dil & 100+ Kriter"
                                      );
                                    }}
                                    className="w-full text-left text-[11px] bg-[#e4dfd3] hover:bg-[#182235] text-[#333d4f] hover:text-[#f0ece1] border border-[#b8b0a0] hover:border-[#182235] rounded-md px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition-all"
                                  >
                                    <span className="inline-flex items-center gap-1.5 font-medium truncate">
                                      <Lock className="w-3 h-3 text-[#7c470b] shrink-0" />
                                      <span className="truncate">
                                        {lang === "en"
                                          ? "Dept · Master's · Profession · Exp · Languages · Software"
                                          : "Bölüm · Master · Meslek · Deneyim · Dil · Yazılım · 100+ Kriter"}
                                      </span>
                                    </span>
                                    <span className="text-[10px] font-mono-academic font-bold text-[#7c470b] bg-[#d6cfc0] px-1.5 py-0.5 rounded shrink-0">
                                      {lang === "en" ? "Unlock" : "Bize Ulaşın"}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>

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

                {/* SAĞ SÜTUN: SEÇİLİ ADAY ÖZETİ (7 Sütun) */}
                <div className="lg:col-span-7 bg-[#e2dcd0]/96 backdrop-blur-md border border-[#b8b0a0] rounded-xl overflow-hidden shadow-md">
                  {selectedEvaluation ? (
                    (() => {
                      const hasBsc = hasBachelorDiploma(selectedEvaluation.cv);
                      const ageMissing = isAgeMissingCase(
                        selectedEvaluation.cv
                      );
                      const bscUniRaw =
                        selectedEvaluation.cv.educationByDegree?.bachelor
                          ?.university ||
                        selectedEvaluation.cv.university ||
                        "";
                      const bscUniDisplay =
                        hasBsc &&
                        bscUniRaw &&
                        bscUniRaw !== "Belirtilmemiş" &&
                        bscUniRaw !== "Belirsiz"
                          ? bscUniRaw
                          : "-";

                      return (
                        <div>
                          <div className="bg-[#182235] text-[#f0ece1] px-5 py-4 border-b border-[#2c3a52] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[10px] font-mono-academic font-bold uppercase tracking-[0.18em] text-[#93c5fd]">
                                {lang === "en"
                                  ? "02 / CANDIDATE SUMMARY"
                                  : "02 / ADAY VERİ ÖZETİ"}
                              </div>
                              <h3 className="font-serif-academic text-xl sm:text-2xl font-bold text-[#f0ece1] mt-0.5 truncate">
                                {selectedEvaluation.cv.fullName}
                              </h3>
                              <p className="text-xs text-[#b8b2a6] mt-0.5 truncate">
                                {selectedEvaluation.cv.source}
                              </p>
                            </div>
                          </div>

                          <div className="p-5 space-y-5">
                            {/* BÖLÜM I: TEMEL AÇIK ALANLAR (Cinsiyet, Yaş, Lisans Üniversitesi — Varsa değeri, yoksa '-') */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="p-3.5 rounded-lg bg-[#ece7db] border border-[#b8b0a0] space-y-1">
                                <span className="text-[10px] font-mono-academic font-bold uppercase tracking-wider text-[#4a5363]">
                                  {t.genderLabel}
                                </span>
                                <div className="font-serif-academic text-base font-bold text-[#121926]">
                                  {selectedEvaluation.cv.detectedGender ===
                                  "Belirsiz"
                                    ? "-"
                                    : translateGender(
                                        selectedEvaluation.cv.detectedGender,
                                        lang
                                      )}
                                </div>
                              </div>

                              <div className="p-3.5 rounded-lg bg-[#ece7db] border border-[#b8b0a0] space-y-1">
                                <span className="text-[10px] font-mono-academic font-bold uppercase tracking-wider text-[#4a5363]">
                                  {t.ageLabel}
                                </span>
                                <div className="font-serif-academic text-base font-bold text-[#121926]">
                                  {selectedEvaluation.cv.detectedAge !== null &&
                                  !ageMissing
                                    ? selectedEvaluation.cv.detectedAge
                                    : "-"}
                                </div>
                              </div>

                              <div className="p-3.5 rounded-lg bg-[#ece7db] border border-[#b8b0a0] space-y-1">
                                <span className="text-[10px] font-mono-academic font-bold uppercase tracking-wider text-[#4a5363]">
                                  {lang === "en"
                                    ? "Bachelor's University"
                                    : "Lisans Üniversitesi"}
                                </span>
                                <div className="font-serif-academic text-sm font-bold text-[#121926] truncate">
                                  {bscUniDisplay}
                                </div>
                              </div>
                            </div>

                            {/* BÖLÜM II: DİĞER TÜM HİZMETLERİMİZ VE PREMİUM ALANLAR (100+ KRİTER) */}
                            <div className="rounded-lg bg-[#ece7db] border border-[#b8b0a0] p-4 space-y-3.5">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#cfc8b8] pb-2.5">
                                <div className="flex items-center gap-2">
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
                                    ? "Unlock All 100+ Fields"
                                    : "Tüm Alanları Açmak İçin Bize Ulaşın"}
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {[
                                  {
                                    title:
                                      lang === "en"
                                        ? "Bachelor's & Associate Department"
                                        : "Lisans & Ön Lisans Bölümü",
                                    sub:
                                      lang === "en"
                                        ? "Faculty, department, GPA & graduation year"
                                        : "Fakülte, bölüm, mezuniyet yılı ve ortalama",
                                  },
                                  {
                                    title:
                                      lang === "en"
                                        ? "Master's & Ph.D. Degrees"
                                        : "Yüksek Lisans (Master) & Doktora",
                                    sub:
                                      lang === "en"
                                        ? "Graduate university & specialization"
                                        : "Lisansüstü üniversite ve uzmanlık alanı",
                                  },
                                  {
                                    title:
                                      lang === "en"
                                        ? "Profession / What They Do"
                                        : "Meslek / Ne İşi Yapar (Pozisyon)",
                                    sub:
                                      lang === "en"
                                        ? "Primary role title & specialization"
                                        : "Adayın ana mesleği, unvanı ve uzmanlığı",
                                  },
                                  {
                                    title:
                                      lang === "en"
                                        ? "Total Experience Years & Companies"
                                        : "Toplam Deneyim Yılı & Çalıştığı Şirketler",
                                    sub:
                                      lang === "en"
                                        ? "Years of experience & employer list"
                                        : "Kaç yıl tecrübeli olduğu ve geçmiş firmaları",
                                  },
                                  {
                                    title:
                                      lang === "en"
                                        ? "Foreign Languages & Software / ERP"
                                        : "Yabancı Dil, Yazılım, SAP & Office",
                                    sub:
                                      lang === "en"
                                        ? "English/German, SAP, Excel, AutoCAD, Python..."
                                        : "İngilizce/Almanca, SAP, Excel, AutoCAD, Yazılım...",
                                  },
                                  {
                                    title:
                                      lang === "en"
                                        ? "Certificates, City, Military & 100+ Criteria"
                                        : "Sertifika, Şehir/İlçe, Ehliyet, Askerlik & 100+ Kriter",
                                    sub:
                                      lang === "en"
                                        ? "All custom criteria tailored to your company"
                                        : "Şirketinize özel 100'den fazla ek değerlendirme alanı",
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
            4. KURUMSAL HİZMETLERİMİZ VE ÇIKARDIĞIMIZ VERİLER (6 NET HİZMET KATEGORİSİ)
           ===================================================================== */}
        <section
          id="sistem"
          className="pt-8 border-t border-[#a8a090] space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="text-[11px] font-mono-academic font-bold uppercase tracking-[0.2em] text-[#182235] border-l-2 border-[#9a5b13] pl-2.5">
                {lang === "en"
                  ? "02 — OUR SERVICES & EXTRACTED DATA SCOPE"
                  : "02 — HİZMETLERİMİZ VE ÇIKARDIĞIMIZ VERİ TABLOSU"}
              </div>
              <h2 className="font-serif-academic text-xl sm:text-2xl font-bold text-[#121926] tracking-tight">
                {lang === "en"
                  ? "Not Just Age & School — We Extract Every Candidate Detail Your Company Needs"
                  : "Sadece Yaş, Cinsiyet ve Okul Değil; Şirketinizin Aradığı Tüm Verileri Çıkarıyoruz"}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => openPremiumModal()}
              className="px-4 py-2.5 rounded-lg bg-[#182235] hover:bg-[#22304a] text-[#f0ece1] text-xs font-semibold cursor-pointer inline-flex items-center gap-2 shrink-0 self-start md:self-auto shadow-sm transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-[#eab308]" />
              <span>
                {lang === "en"
                  ? "Request Custom Table for Your Company →"
                  : "Şirketinize Özel Tablo Talep Edin →"}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                num: "01",
                title:
                  lang === "en"
                    ? "Identity, Age, Gender & Contact"
                    : "Kimlik, Yaş, Cinsiyet & İletişim",
                items:
                  lang === "en"
                    ? [
                        "Full Name & Birth Year / Age",
                        "Gender & Marital Status",
                        "City & District of Residence",
                        "Phone, Email & LinkedIn",
                      ]
                    : [
                        "Ad Soyad & Doğum Yılı / Yaş",
                        "Cinsiyet & Medeni Durum",
                        "İkamet Şehri & İlçesi",
                        "Telefon, E-Posta & LinkedIn",
                      ],
              },
              {
                num: "02",
                title:
                  lang === "en"
                    ? "All Education Tiers & Departments"
                    : "Tüm Eğitim Kademeleri & Bölümler",
                items:
                  lang === "en"
                    ? [
                        "Associate University & Department",
                        "Bachelor's University & Department",
                        "Master's (M.Sc. / MBA) & Thesis",
                        "Ph.D. / Doctorate & GPA",
                      ]
                    : [
                        "Ön Lisans Üniversite & Bölümü",
                        "Lisans Üniversite & Bölümü",
                        "Yüksek Lisans (Master) & Bölümü",
                        "Doktora (Ph.D.) & Mezuniyet Ortalaması",
                      ],
              },
              {
                num: "03",
                title:
                  lang === "en"
                    ? "Profession, Role & Experience Years"
                    : "Meslek, Pozisyon & Deneyim Yılı",
                items:
                  lang === "en"
                    ? [
                        "Profession / What They Do (Role)",
                        "Total Years of Experience",
                        "Current / Last Employer & Title",
                        "All Past Companies & Seniority",
                      ]
                    : [
                        "Ne İşi Yapar (Meslek / Uzmanlık)",
                        "Toplam İş Deneyimi (Yıl)",
                        "Son Çalıştığı Şirket & Görevi",
                        "Geçmiş Tüm Şirketler & Kıdem Seviyesi",
                      ],
              },
              {
                num: "04",
                title:
                  lang === "en"
                    ? "Foreign Languages & Software Tools"
                    : "Yabancı Dil, Yazılım & Programlar",
                items:
                  lang === "en"
                    ? [
                        "English, German & 2nd Foreign Language",
                        "SAP, ERP & Advanced Excel",
                        "Engineering & Design Software (AutoCAD, etc.)",
                        "Programming Languages & Tech Stack",
                      ]
                    : [
                        "İngilizce, Almanca & İkinci Yabancı Dil",
                        "SAP, ERP & İleri Excel Yetkinliği",
                        "Mühendislik & Tasarım Programları",
                        "Yazılım Dilleri & Teknik Araçlar",
                      ],
              },
              {
                num: "05",
                title:
                  lang === "en"
                    ? "Certificates, Military & Driving Status"
                    : "Sertifika, Askerlik, Ehliyet & Koşullar",
                items:
                  lang === "en"
                    ? [
                        "Professional Certificates (PMP, OHS, CPA)",
                        "Military Service Status",
                        "Driving License Class",
                        "Travel, Shift & Relocation Readiness",
                      ]
                    : [
                        "Mesleki Sertifikalar & Belgeler",
                        "Askerlik Durumu (Yapıldı / Muaf / Tecilli)",
                        "Sürücü Belgesi (Ehliyet Sınıfı)",
                        "Seyahat, Vardiya & Şehir Dışı Uyumu",
                      ],
              },
              {
                num: "06",
                title:
                  lang === "en"
                    ? "Custom Company Screening & 100+ Criteria"
                    : "Şirkete Özel Eleme & 100+ Kriter",
                items:
                  lang === "en"
                    ? [
                        "100+ Custom Columns for Your Job Post",
                        "Automated Candidate Pre-Screening",
                        "Bulk Parsing for 1,000+ CV Archives",
                        "Ready-to-Filter Corporate Excel (.xlsx)",
                      ]
                    : [
                        "İlanınıza Özel 100+ Ek Kriter Sütunu",
                        "Aranan Niteliklere Göre Aday Filtreleme",
                        "Binlerce CV'lik Arşivlerin Toplu Analizi",
                        "Kurumsal İK Sistemlerine Hazır Excel (.xlsx)",
                      ],
              },
            ].map((service) => (
              <div
                key={service.num}
                onClick={() => openPremiumModal(service.title)}
                className="group p-5 rounded-xl bg-[#e4dfd3]/96 hover:bg-[#182235] border border-[#b0a898] hover:border-[#182235] transition-all cursor-pointer shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#c4bdb0] group-hover:border-[#2c3a52] pb-2.5 mb-3">
                    <span className="font-mono-academic text-xs font-bold text-[#7c470b] group-hover:text-[#eab308]">
                      {service.num}
                    </span>
                    <span className="text-[11px] font-mono-academic font-semibold text-[#4a5363] group-hover:text-[#93c5fd]">
                      {lang === "en" ? "Excel Columns →" : "Tabloya Ekle →"}
                    </span>
                  </div>

                  <h3 className="font-serif-academic text-base font-bold text-[#121926] group-hover:text-[#f0ece1] mb-3">
                    {service.title}
                  </h3>

                  <ul className="space-y-1.5">
                    {service.items.map((item) => (
                      <li
                        key={item}
                        className="text-xs text-[#273142] group-hover:text-[#d2ccc0] flex items-center gap-2 py-1 border-b border-[#d4cdc0]/70 group-hover:border-[#2c3a52]/70 last:border-b-0"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7c470b] group-hover:bg-[#eab308] shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* =====================================================================
          ALT BİLGİ (FOOTER — Sağdaki "Toplu CV Yükle" yazısı kaldırıldı)
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
                    lang === "en"
                      ? "Associate & Bachelor's Dept"
                      : "Ön Lisans & Lisans Bölümü",
                    lang === "en"
                      ? "Master's & Ph.D."
                      : "Yüksek Lisans & Doktora",
                    lang === "en"
                      ? "Profession & Experience"
                      : "Meslek & Deneyim Yılı",
                    lang === "en"
                      ? "Languages & Software"
                      : "Yabancı Dil & Yazılım",
                    lang === "en"
                      ? "100+ Custom Criteria"
                      : "100+ Özel Kriter",
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
                      ? "Our team will contact your company shortly to activate all requested academic, profession, experience, language, software, and custom criteria columns."
                      : "Ekibimiz en kısa sürede sizinle iletişime geçerek şirketiniz için tüm eğitim, meslek, deneyim, yabancı dil, yazılım ve özel kriter sütunlarını aktif edecektir."}
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
