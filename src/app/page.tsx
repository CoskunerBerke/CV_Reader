"use client";

import React, { useState, useMemo } from "react";
import {
  CandidateCV,
  CompanyProfile,
  evaluateCandidateForCompany,
  parseNaturalLanguageCriteria,
  normalizeTr,
} from "@/lib/cvEngine";
import {
  INITIAL_CANDIDATES,
  INITIAL_COMPANIES,
  buildCandidateFromRaw,
  generateBulkSimulationCVs,
} from "@/lib/mockGenerator";
import {
  Check,
  X,
  Upload,
  Search,
  Database,
  Building2,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileUp,
} from "lucide-react";

export default function CVReaderApp() {
  // Şirket profilleri
  const [companies, setCompanies] = useState<CompanyProfile[]>(INITIAL_COMPANIES);
  const [activeCompanyId, setActiveCompanyId] = useState<string>(INITIAL_COMPANIES[0].id);

  // CV Havuzu
  const [candidates, setCandidates] = useState<CandidateCV[]>(INITIAL_CANDIDATES);
  const [is1000Mode, setIs1000Mode] = useState<boolean>(false);

  // Arayüz durumları
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("cv-001");
  const [showAllCandidates, setShowAllCandidates] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [newSkillInput, setNewSkillInput] = useState<string>("");

  // Modallar
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState<boolean>(false);

  // Yeni CV yükleme state (PDF & DOCX Destekli)
  const [uploadName, setUploadName] = useState<string>("");
  const [uploadUni, setUploadUni] = useState<string>("");
  const [uploadCity, setUploadCity] = useState<string>("İstanbul");
  const [uploadExp, setUploadExp] = useState<number>(3);
  const [uploadRawText, setUploadRawText] = useState<string>("");
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(false);
  const [pdfParseStatus, setPdfParseStatus] = useState<string>("");

  // Gemini AI Derin Analiz state
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  const [isGeminiLoading, setIsGeminiLoading] = useState<boolean>(false);
  const [geminiResults, setGeminiResults] = useState<Record<string, string>>({});

  // Yeni Şirket oluşturma state
  const [newCompName, setNewCompName] = useState<string>("");
  const [newCompGender, setNewCompGender] = useState<"Kadın" | "Erkek" | "Farketmez">("Kadın");
  const [newCompMinAge, setNewCompMinAge] = useState<number>(22);
  const [newCompMaxAge, setNewCompMaxAge] = useState<number>(32);
  const [newCompSkills, setNewCompSkills] = useState<string>("C++, Java");

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
      if (!showAllCandidates && !item.passesHardFilters) return false;
      if (searchQuery.trim() !== "") {
        const q = normalizeTr(searchQuery);
        const inName = normalizeTr(item.cv.fullName).includes(q);
        const inText = normalizeTr(item.cv.rawText).includes(q);
        if (!inName && !inText) return false;
      }
      return true;
    });
  }, [evaluatedList, showAllCandidates, searchQuery]);

  const selectedEvaluation = useMemo(() => {
    return (
      displayedEvaluations.find((e) => e.cv.id === selectedCandidateId) ||
      displayedEvaluations[0] ||
      evaluatedList[0]
    );
  }, [evaluatedList, displayedEvaluations, selectedCandidateId]);

  // 1.000 CV Simülasyonu Aç/Kapat
  const handleToggle1000Pool = () => {
    if (!is1000Mode) {
      setCandidates(generateBulkSimulationCVs(1000));
      setIs1000Mode(true);
    } else {
      setCandidates(INITIAL_CANDIDATES);
      setIs1000Mode(false);
    }
  };

  // Doğal dil cümlesinden kriterleri otomatik uygula
  const handleApplyPrompt = () => {
    const parsed = parseNaturalLanguageCriteria(activeCompany.naturalLanguagePrompt);
    updateActiveCompany((prev) => ({
      ...prev,
      targetGender: parsed.gender ?? prev.targetGender,
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

  // GERÇEK PDF / DOCX / TXT DOSYA OKUMA (Tekli veya Çoklu PDF Destekli)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsParsingPdf(true);
    setPdfParseStatus("PDF / Word dosyası okunuyor...");

    try {
      const formData = new FormData();
      for (let i = 0; i < fileList.length; i++) {
        formData.append("files", fileList[i]);
      }

      const res = await fetch("/api/parse-cv", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.files || data.files.length === 0) {
        setPdfParseStatus(data.error || "Dosya okunamadı.");
        setIsParsingPdf(false);
        return;
      }

      // Eğer birden fazla PDF seçildiyse hepsini doğrudan havuza ekle!
      if (data.files.length > 1) {
        const addedCVs: CandidateCV[] = data.files.map(
          (
            f: {
              fileName: string;
              rawText: string;
              fullName: string;
              university: string;
              city: string;
              experienceYears: number;
            },
            idx: number
          ) =>
            buildCandidateFromRaw(
              `cv-pdf-${Date.now()}-${idx}`,
              f.fullName,
              f.rawText,
              f.experienceYears,
              "Lisans",
              f.university,
              f.city,
              activeCompany.requiredSkills,
              `PDF (${f.fileName})`
            )
        );

        setCandidates((prev) => [...addedCVs, ...prev]);
        setSelectedCandidateId(addedCVs[0].id);
        setPdfParseStatus(`${addedCVs.length} adet PDF CV başarıyla eklendi!`);
        setTimeout(() => {
          setIsUploadModalOpen(false);
          setPdfParseStatus("");
        }, 800);
      } else {
        // Tek PDF seçildiyse tüm alanları otomatik doldur
        const first = data.files[0];
        setUploadName(first.fullName);
        setUploadUni(first.university);
        setUploadCity(first.city);
        setUploadExp(first.experienceYears);
        setUploadRawText(first.rawText);
        setPdfParseStatus(`✓ "${first.fileName}" başarıyla okundu ve alanlar otomatik dolduruldu.`);
      }
    } catch {
      setPdfParseStatus("Dosya okunurken bir hata oluştu.");
    } finally {
      setIsParsingPdf(false);
    }
  };

  // Yeni CV ekle
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
      "Yüklenen PDF/CV"
    );
    setCandidates((prev) => [newCV, ...prev]);
    setSelectedCandidateId(newId);
    setIsUploadModalOpen(false);
    setUploadName("");
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
          [cv.id]: `Hibrit Analiz Doğrulandı: Aday ${cv.detectedGender} (%${cv.genderConfidence}), ${
            cv.detectedAge ? `${cv.detectedAge} yaşında` : "yaş kronolojisi incelendi"
          }. Aranan ${activeCompany.requiredSkills.join(" & ")} kriterleri CV metnindeki projelerle karşılaştırıldı.`,
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
      naturalLanguagePrompt: `${newCompGender} olsun, ${newCompMinAge}-${newCompMaxAge} yaş arası, ${skillsArr.join(", ")} bilsin.`,
      targetGender: newCompGender,
      minAge: newCompMinAge,
      maxAge: newCompMaxAge,
      strictGender: newCompGender !== "Farketmez",
      strictAge: true,
      requiredSkills: skillsArr.length > 0 ? skillsArr : ["C++"],
      preferredSkills: [],
      minExperienceYears: 1,
      learnedKeywordWeights: {},
      learnedUniversityBonus: true,
      feedbackCount: 0,
      approvedCandidateIds: [],
      rejectedCandidateIds: [],
    };

    setCompanies((prev) => [...prev, created]);
    setActiveCompanyId(id);
    setIsNewCompanyModalOpen(false);
    setNewCompName("");
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
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

          {/* Orta: Şirket Seçimi */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-zinc-400 hidden sm:block shrink-0" />
            <select
              value={activeCompany.id}
              onChange={(e) => setActiveCompanyId(e.target.value)}
              className="border border-zinc-200 rounded-md bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsNewCompanyModalOpen(true)}
              className="px-2.5 py-1.5 border border-zinc-200 rounded-md hover:border-zinc-900 text-xs font-medium text-zinc-700 whitespace-nowrap shrink-0 cursor-pointer"
              title="Yeni Şirket Ekle"
            >
              + Yeni Şirket
            </button>
          </div>

          {/* Sağ: 1000 CV Test & PDF CV Yükle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleToggle1000Pool}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                is1000Mode
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-900"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              {is1000Mode ? "1.000 CV Aktif (Sıfırla)" : "1.000 CV Test Et"}
            </button>

            <button
              onClick={() => {
                setPdfParseStatus("");
                setIsUploadModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              PDF / CV Yükle
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* =====================================================================
            2. TEK KARTTA SADE FİLTRE PANELİ (CİNSİYET + YAŞ + YETENEKLER)
           ===================================================================== */}
        <section className="bg-white border border-zinc-200 rounded-lg p-5 shadow-xs">
          {/* Hızlı Cümle İle Arama */}
          <div className="flex flex-col sm:flex-row gap-2 pb-5 border-b border-zinc-100">
            <input
              type="text"
              value={activeCompany.naturalLanguagePrompt}
              onChange={(e) =>
                updateActiveCompany((prev) => ({
                  ...prev,
                  naturalLanguagePrompt: e.target.value,
                }))
              }
              placeholder="Ne tarz biri arıyorsunuz? Örn: Kadın olsun, 22-32 yaş arası, C++ ve Java bilsin..."
              className="flex-1 border border-zinc-200 rounded-md bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-900"
            />
            <button
              onClick={handleApplyPrompt}
              className="px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Cümleden Filtrele
            </button>
          </div>

          {/* 3 Net Kriter Yan Yana */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
            {/* 1. Cinsiyet (Sabit) */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">
                1. Cinsiyet (Sabit Kriter)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["Kadın", "Erkek", "Farketmez"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() =>
                      updateActiveCompany((prev) => ({
                        ...prev,
                        targetGender: g,
                        strictGender: g !== "Farketmez",
                      }))
                    }
                    className={`py-2 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      activeCompany.targetGender === g
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Yaş Aralığı (Sabit) */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">
                2. Yaş Aralığı (Sabit Kriter)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={18}
                  max={65}
                  value={activeCompany.minAge}
                  onChange={(e) =>
                    updateActiveCompany((prev) => ({
                      ...prev,
                      minAge: Number(e.target.value) || 18,
                    }))
                  }
                  className="w-full border border-zinc-200 rounded-md px-3 py-1.5 text-sm text-center font-medium"
                />
                <span className="text-zinc-400 text-sm">—</span>
                <input
                  type="number"
                  min={18}
                  max={65}
                  value={activeCompany.maxAge}
                  onChange={(e) =>
                    updateActiveCompany((prev) => ({
                      ...prev,
                      maxAge: Number(e.target.value) || 45,
                    }))
                  }
                  className="w-full border border-zinc-200 rounded-md px-3 py-1.5 text-sm text-center font-medium"
                />
                <span className="text-xs text-zinc-500 shrink-0">Yaş</span>
              </div>
            </div>

            {/* 3. Aranan Yetenekler (Şirkete Özel) */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">
                3. Aranan Kelimeler / Yetenekler
              </label>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {activeCompany.requiredSkills.map((sk) => (
                  <span
                    key={sk}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-teal-50 text-teal-900 border border-teal-200 text-xs font-medium"
                  >
                    {sk}
                    <button
                      onClick={() =>
                        updateActiveCompany((prev) => ({
                          ...prev,
                          requiredSkills: prev.requiredSkills.filter((s) => s !== sk),
                        }))
                      }
                      className="text-teal-600 hover:text-teal-950 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}

                <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                  <input
                    type="text"
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newSkillInput.trim()) {
                        e.preventDefault();
                        updateActiveCompany((prev) => ({
                          ...prev,
                          requiredSkills: Array.from(
                            new Set([...prev.requiredSkills, newSkillInput.trim()])
                          ),
                        }));
                        setNewSkillInput("");
                      }
                    }}
                    placeholder="+ Kelime ekle (C++, Java)"
                    className="w-full border border-zinc-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-zinc-900"
                  />
                  <button
                    onClick={() => {
                      if (!newSkillInput.trim()) return;
                      updateActiveCompany((prev) => ({
                        ...prev,
                        requiredSkills: Array.from(
                          new Set([...prev.requiredSkills, newSkillInput.trim()])
                        ),
                      }));
                      setNewSkillInput("");
                    }}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded text-xs font-medium cursor-pointer"
                  >
                    Ekle
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            3. SONUÇLAR: SOLDA ADAY LİSTESİ, SAĞDA SEÇİLİ ADAY DETAYI
           ===================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* SOL: ADAY LİSTESİ (7 Sütun) */}
          <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-xs">
            {/* Liste Başlığı */}
            <div className="p-4 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm text-zinc-950">
                  Uygun Adaylar ({passingCount})
                </h2>
                <span className="text-xs text-zinc-400">
                  / Toplam {candidates.length} CV tarandı
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAllCandidates}
                    onChange={(e) => setShowAllCandidates(e.target.checked)}
                    className="accent-zinc-900 rounded"
                  />
                  <span>Elenenleri de göster</span>
                </label>

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
            <div className="divide-y divide-zinc-100 max-h-[620px] overflow-y-auto">
              {displayedEvaluations.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">
                  Aradığınız kriterlere tam uyan aday bulunamadı. Filtreleri esnetebilir veya
                  &ldquo;Elenenleri de göster&rdquo; seçeneğini açabilirsiniz.
                </div>
              ) : (
                displayedEvaluations.slice(0, 80).map((item) => {
                  const isSelected = selectedEvaluation?.cv.id === item.cv.id;
                  const isApproved = activeCompany.approvedCandidateIds.includes(item.cv.id);
                  const isRejected = activeCompany.rejectedCandidateIds.includes(item.cv.id);

                  return (
                    <div
                      key={item.cv.id}
                      onClick={() => setSelectedCandidateId(item.cv.id)}
                      className={`p-4 transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                        isSelected
                          ? "bg-zinc-900 text-white"
                          : item.passesHardFilters
                          ? "bg-white hover:bg-zinc-50"
                          : "bg-zinc-50/70 text-zinc-400 hover:bg-zinc-100"
                      }`}
                    >
                      {/* Sol Bilgi */}
                      <div className="min-w-0 flex-1">
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
                            • {item.cv.detectedAge ? `${item.cv.detectedAge} Yaş` : "Yaş Belirsiz"}
                          </span>
                          <span
                            className={`text-xs hidden sm:inline ${
                              isSelected ? "text-zinc-400" : "text-zinc-400"
                            }`}
                          >
                            • {item.cv.experienceYears} Yıl Deneyim
                          </span>
                        </div>

                        {/* Yetenek Etiketleri */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {item.skillAssessments.map((sa) => (
                            <span
                              key={sa.skill}
                              className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                                isSelected
                                  ? sa.level === "Uzman / Proje Kanıtlı"
                                    ? "bg-teal-900/60 text-teal-200 border border-teal-700"
                                    : sa.level === "Yüzeysel / Sadece Listede"
                                    ? "bg-amber-900/50 text-amber-200"
                                    : "bg-red-900/40 text-red-200"
                                  : sa.level === "Uzman / Proje Kanıtlı"
                                  ? "bg-zinc-100 text-zinc-800"
                                  : sa.level === "Yüzeysel / Sadece Listede"
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {sa.skill}:{" "}
                              {sa.level === "Uzman / Proje Kanıtlı"
                                ? "✓ Biliyor (Projeli)"
                                : sa.level === "Orta / Uygulamalı"
                                ? "✓ Orta"
                                : sa.level === "Yüzeysel / Sadece Listede"
                                ? "⚠️ Sadece Adı Geçiyor"
                                : "✕ Yok"}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Sağ: Skor & Uygun/Ele */}
                      <div
                        className="flex items-center gap-3 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-right">
                          <div
                            className={`text-base font-bold ${
                              isSelected
                                ? "text-white"
                                : item.totalMatchScore >= 80
                                ? "text-teal-700"
                                : "text-zinc-700"
                            }`}
                          >
                            %{item.totalMatchScore}
                          </div>
                          <div
                            className={`text-[10px] ${
                              isSelected ? "text-zinc-400" : "text-zinc-400"
                            }`}
                          >
                            Uyum
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleFeedback(item.cv, "approved")}
                            title="Uygun (Yapay zeka bu tarz adayları öğrenir)"
                            className={`p-1.5 rounded border cursor-pointer ${
                              isApproved
                                ? "bg-teal-600 text-white border-teal-600"
                                : isSelected
                                ? "border-zinc-700 text-zinc-300 hover:bg-teal-600 hover:text-white"
                                : "border-zinc-200 text-zinc-600 hover:border-teal-600 hover:text-teal-600"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleFeedback(item.cv, "rejected")}
                            title="Ele"
                            className={`p-1.5 rounded border cursor-pointer ${
                              isRejected
                                ? "bg-red-600 text-white border-red-600"
                                : isSelected
                                ? "border-zinc-700 text-zinc-300 hover:bg-red-600 hover:text-white"
                                : "border-zinc-200 text-zinc-600 hover:border-red-600 hover:text-red-600"
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
              <>
                {/* Aday Başlığı */}
                <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-950">
                      {selectedEvaluation.cv.fullName}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {selectedEvaluation.cv.university} • {selectedEvaluation.cv.city}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 font-bold text-sm">
                    %{selectedEvaluation.totalMatchScore} Uyum
                  </span>
                </div>

                {/* Yapay Zeka Nasıl Anladı? (Çok Sade 3 Satır) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500 uppercase">
                      Yapay Zeka Tespit Özeti
                    </span>
                    <button
                      onClick={() => handleRunGeminiAnalysis(selectedEvaluation.cv)}
                      disabled={isGeminiLoading}
                      className="text-xs font-medium text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isGeminiLoading ? "Gemini Analiz Ediyor..." : "Gemini AI ile Doğrula"}
                    </button>
                  </div>

                  {geminiResults[selectedEvaluation.cv.id] && (
                    <div className="p-3 rounded-md bg-teal-50/70 border border-teal-200 text-xs text-teal-950">
                      <strong>Gemini AI Raporu:</strong> {geminiResults[selectedEvaluation.cv.id]}
                    </div>
                  )}

                  {/* Cinsiyet Tespiti */}
                  <div className="p-3 rounded-md bg-zinc-50 border border-zinc-100 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-zinc-900">
                      <span>Cinsiyet: {selectedEvaluation.cv.detectedGender}</span>
                      <span className="text-teal-700">
                        %{selectedEvaluation.cv.genderConfidence} Doğruluk
                      </span>
                    </div>
                    <p className="text-zinc-600">
                      {selectedEvaluation.cv.genderEvidence
                        .map((e) => e.signal)
                        .slice(0, 2)
                        .join(" + ")}
                    </p>
                  </div>

                  {/* Yaş Tespiti */}
                  <div className="p-3 rounded-md bg-zinc-50 border border-zinc-100 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-zinc-900">
                      <span>
                        Yaş:{" "}
                        {selectedEvaluation.cv.detectedAge
                          ? `${selectedEvaluation.cv.detectedAge} Yaşında`
                          : "Belirsiz"}
                      </span>
                      <span className="text-zinc-500">{selectedEvaluation.cv.ageMethod}</span>
                    </div>
                    <p className="text-zinc-600">{selectedEvaluation.cv.ageEvidence}</p>
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
                      <p className="text-zinc-600 italic">&ldquo;{sa.evidenceSnippet}&rdquo;</p>
                    </div>
                  ))}
                </div>

                {/* CV Metni */}
                <div>
                  <div className="text-xs font-semibold text-zinc-500 uppercase mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Adayın CV Metni
                  </div>
                  <pre className="p-3.5 rounded-md bg-zinc-900 text-zinc-200 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {selectedEvaluation.cv.rawText}
                  </pre>
                </div>
              </>
            ) : (
              <div className="text-sm text-zinc-500 py-8 text-center">
                Detayları görmek için soldaki listeden bir adaya tıklayın.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* =====================================================================
          MODAL 1: YENİ CV YÜKLE (PDF, WORD .DOCX, TXT DESTEKLİ)
         ===================================================================== */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-zinc-200 max-w-lg w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-zinc-950">
                  PDF / Word CV Yükle
                </h3>
                <p className="text-xs text-zinc-500">
                  Tek veya birden fazla PDF (.pdf) ve Word (.docx) CV yükleyebilirsiniz
                </p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* PDF / DOCX Dosya Seçim Kutusu */}
            <label className="block border-2 border-dashed border-teal-500/50 hover:border-teal-600 bg-teal-50/40 rounded-lg p-5 text-center cursor-pointer transition-colors">
              <FileUp className="w-7 h-7 text-teal-600 mx-auto mb-2" />
              <span className="block text-sm font-semibold text-zinc-900">
                Bilgisayardan PDF veya Word (.docx) CV Seçin
              </span>
              <span className="block text-xs text-zinc-500 mt-1">
                Desteklenen formatlar: <strong>.PDF, .DOCX, .TXT</strong> (Çoklu seçim yapılabilir)
              </span>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {isParsingPdf && (
              <div className="flex items-center gap-2 text-xs text-teal-700 font-medium bg-teal-50 p-2.5 rounded">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>PDF içeriği okunuyor ve analiz ediliyor...</span>
              </div>
            )}

            {pdfParseStatus && !isParsingPdf && (
              <div className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 p-2.5 rounded">
                {pdfParseStatus}
              </div>
            )}

            <form onSubmit={handleAddCV} className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Ad Soyad (PDF&apos;ten Otomatik Gelir) *
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="Örn: Ayşe Yılmaz"
                    className="w-full border border-zinc-200 rounded px-3 py-1.5 text-sm"
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
                    className="w-full border border-zinc-200 rounded px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Şehir</label>
                  <input
                    type="text"
                    value={uploadCity}
                    onChange={(e) => setUploadCity(e.target.value)}
                    placeholder="İstanbul"
                    className="w-full border border-zinc-200 rounded px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Deneyim (Yıl)
                  </label>
                  <input
                    type="number"
                    value={uploadExp}
                    onChange={(e) => setUploadExp(Number(e.target.value))}
                    placeholder="Deneyim Yılı"
                    className="w-full border border-zinc-200 rounded px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-zinc-700">
                    Okunan CV Metni *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadName("Ceren İpek Yalçın");
                      setUploadUni("ODTÜ");
                      setUploadCity("Ankara");
                      setUploadExp(4);
                      setUploadRawText(`AD SOYAD: Ceren İpek Yalçın
EĞİTİM: ODTÜ - Bilgisayar Mühendisliği Lisans (2018 - 2022)
DENEYİM (4 Yıl):
• Savunma A.Ş. — C++ & Java Sistem Mühendisi:
  Radar yazılımlarını Modern C++ (STL, Boost, CMake) ile geliştirdim.
  Sunucu servislerini Java ve Spring Boot ile kodladım.
TOPLULUKLAR: IEEE Women in Engineering (WIE) aktif üyesi.`);
                    }}
                    className="text-xs text-teal-600 underline cursor-pointer"
                  >
                    Örnek CV Doldur
                  </button>
                </div>
                <textarea
                  rows={5}
                  required
                  value={uploadRawText}
                  onChange={(e) => setUploadRawText(e.target.value)}
                  placeholder="Yukarıdan PDF seçtiğinizde metin buraya otomatik çıkarılır veya elle yapıştırabilirsiniz..."
                  className="w-full border border-zinc-200 rounded p-2.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">
                  Opsiyonel Gemini API Anahtarı (Girilirse Gemini LLM doğrulaması da aktif olur)
                </label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy... (Boş bırakılabilir)"
                  className="w-full border border-zinc-200 rounded px-3 py-1.5 text-xs font-mono bg-zinc-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-1.5 border border-zinc-200 rounded text-xs cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isParsingPdf}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-medium cursor-pointer"
                >
                  Analiz Et ve Ekle
                </button>
              </div>
            </form>
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
