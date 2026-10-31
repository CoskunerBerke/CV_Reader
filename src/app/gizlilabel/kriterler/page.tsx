"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Lock,
  Check,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  Download,
  Sliders,
  CheckCircle2,
  Eye,
} from "lucide-react";
import {
  CRITERIA_CATEGORIES,
  INITIAL_100_CRITERIA,
  CriterionDefinition,
  CriterionAccessTier,
  extractAll100ValuesFromCV,
} from "@/lib/criteriaCatalog";

interface BenchmarkCVItem {
  index: number;
  fileName: string;
  rawText: string;
  aiName: string;
  aiGender: "Kadın" | "Erkek" | "Belirsiz";
  aiAge: number | null;
  aiUniversity: string;
  aiDepartment: string;
  aiDegree: string;
  humanLabel: {
    humanName?: string;
    humanGender: "Kadın" | "Erkek" | "Belirsiz";
    humanAge: number | null;
    humanUniversity?: string | null;
    humanDepartment?: string | null;
    humanDegree?: string | null;
  } | null;
}

const CUSTOM_CRITERIA_STORAGE_KEY = "cv_custom_criteria_definitions_v1";
const CV_100_LABELS_STORAGE_KEY = "cv_100_criteria_labels_by_file_v1";

export default function HundredCriteriaMatrixPage() {
  // 1. GÜVENLİK VE WI-FI IP KALKANI DURUMU
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [currentIp, setCurrentIp] = useState<string>("");
  const [allowedIps, setAllowedIps] = useState<string[]>([]);
  const [autoRecoveredNote, setAutoRecoveredNote] = useState<string>("");
  const [secretClickCount, setSecretClickCount] = useState<number>(0);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState<string>("");
  const [replaceOldIps, setReplaceOldIps] = useState<boolean>(true);
  const [recoveryError, setRecoveryError] = useState<string>("");

  // 2. 100+ KRİTER TANIMLARI VE FİLTRELER
  const [criteriaList, setCriteriaList] =
    useState<CriterionDefinition[]>(INITIAL_100_CRITERIA);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<"all" | CriterionAccessTier>(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [compactDensity, setCompactDensity] = useState<"ultra" | "normal">(
    "ultra"
  );

  // 3. ADAY CV LİSTESİ VE SEÇİLİ CV İÇİN 100 KRİTER DEĞERLERİ
  const [cvItems, setCvItems] = useState<BenchmarkCVItem[]>([]);
  const [selectedCvIndex, setSelectedCvIndex] = useState<number>(0);
  const [showPdfSplit, setShowPdfSplit] = useState<boolean>(false);
  const [cvValuesMap, setCvValuesMap] = useState<
    Record<string, Record<string, string>>
  >({});
  const [savingStatus, setSavingStatus] = useState<string>("");

  // 4. YENİ KRİTER EKLEME MODALI (101, 102...)
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newCritLabel, setNewCritLabel] = useState<string>("");
  const [newCritDesc, setNewCritDesc] = useState<string>("");
  const [newCritCategory, setNewCritCategory] =
    useState<string>("meslek_deneyim");
  const [newCritTier, setNewCritTier] =
    useState<CriterionAccessTier>("premium");

  // Güvenlik ve CV Verilerini Yükle
  const verifyIpAndLoadData = useCallback(async () => {
    setAuthChecking(true);
    try {
      const authRes = await fetch(`/api/admin-auth?t=${Date.now()}`, {
        cache: "no-store",
      });
      const authData = await authRes.json();
      setCurrentIp(authData?.currentIp || "");

      if (!authRes.ok || !authData?.authorized) {
        setIsAuthorized(false);
        setAuthChecking(false);
        return;
      }

      setIsAuthorized(true);
      setAllowedIps(authData?.allowedIps || []);
      if (authData?.autoRecovered && authData?.note) {
        setAutoRecoveredNote(authData.note);
      }

      // Kayıtlı özel kriterleri ve 100'lük etiketleri yükle
      try {
        const savedCustom = localStorage.getItem(CUSTOM_CRITERIA_STORAGE_KEY);
        if (savedCustom) {
          const parsedCustom = JSON.parse(savedCustom);
          if (Array.isArray(parsedCustom) && parsedCustom.length >= 100) {
            setCriteriaList(parsedCustom);
          }
        }
        const savedVals = localStorage.getItem(CV_100_LABELS_STORAGE_KEY);
        if (savedVals) {
          setCvValuesMap(JSON.parse(savedVals));
        }
      } catch {
        // ignore
      }

      // 53 CV'yi yükle
      const cvRes = await fetch(`/api/ground-truth?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (cvRes.ok) {
        const cvData = await cvRes.json();
        if (Array.isArray(cvData?.items)) {
          setCvItems(cvData.items);
          if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const cvIdxParam = params.get("cv");
            if (cvIdxParam !== null) {
              const parsedIdx = parseInt(cvIdxParam, 10);
              if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < cvData.items.length) {
                setSelectedCvIndex(parsedIdx);
              }
            }
          }
        }
      }
    } catch {
      setIsAuthorized(false);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    verifyIpAndLoadData();
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("kurtar=1")
    ) {
      setSecretClickCount(5);
    }
  }, [verifyIpAndLoadData]);

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError("");
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recover_with_key",
          masterKey: recoveryKeyInput,
          replaceOldIps,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.authorized) {
        setRecoveryError(data?.error || "Geçersiz kurtarma anahtarı.");
        return;
      }
      setRecoveryKeyInput("");
      await verifyIpAndLoadData();
    } catch {
      setRecoveryError("Bağlantı hatası oluştu.");
    }
  };

  const currentCv = cvItems[selectedCvIndex] || null;

  // Seçili CV için 100 kriterin otomatik veya kaydedilmiş değerlerini hesapla
  const activeCvValues = useMemo(() => {
    if (!currentCv) return {};
    const autoExtracted = extractAll100ValuesFromCV(
      currentCv.rawText,
      currentCv.fileName
    );
    // Varsa humanLabel ile ilk temel alanları senkronla
    if (currentCv.humanLabel) {
      if (currentCv.humanLabel.humanName) {
        autoExtracted.c001 = currentCv.humanLabel.humanName;
      }
      if (currentCv.humanLabel.humanAge !== null) {
        autoExtracted.c002 = String(currentCv.humanLabel.humanAge);
      }
      if (currentCv.humanLabel.humanGender) {
        autoExtracted.c003 = currentCv.humanLabel.humanGender;
      }
    }
    const savedForFile = cvValuesMap[currentCv.fileName] || {};
    return { ...autoExtracted, ...savedForFile };
  }, [currentCv, cvValuesMap]);

  const handleUpdateCriterionValue = (critId: string, val: string) => {
    if (!currentCv) return;
    setCvValuesMap((prev) => {
      const next = {
        ...prev,
        [currentCv.fileName]: {
          ...(prev[currentCv.fileName] || {}),
          [critId]: val,
        },
      };
      try {
        localStorage.setItem(CV_100_LABELS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleToggleCriterionTier = (critId: string) => {
    setCriteriaList((prev) => {
      const next: CriterionDefinition[] = prev.map((c) => {
        if (c.id !== critId) return c;
        const nextTier: CriterionAccessTier =
          c.tier === "default"
            ? "premium"
            : c.tier === "premium"
            ? "hidden"
            : "default";
        return { ...c, tier: nextTier };
      });
      try {
        localStorage.setItem(CUSTOM_CRITERIA_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleAddCustomCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCritLabel.trim()) return;
    const nextNum = criteriaList.length + 1;
    const code = String(nextNum).padStart(3, "0");
    const catObj =
      CRITERIA_CATEGORIES.find((c) => c.key === newCritCategory) ||
      CRITERIA_CATEGORIES[3];

    const created: CriterionDefinition = {
      id: `c${code}_${Date.now().toString().slice(-3)}`,
      code,
      categoryKey: catObj.key,
      categoryLabel: catObj.label,
      label: newCritLabel.trim(),
      shortDesc: newCritDesc.trim() || "Özel tanımlı değerlendirme kriteri",
      tier: newCritTier,
      inputType: "text",
    };

    const updated = [...criteriaList, created];
    setCriteriaList(updated);
    try {
      localStorage.setItem(
        CUSTOM_CRITERIA_STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch {
      // ignore
    }
    setNewCritLabel("");
    setNewCritDesc("");
    setIsAddModalOpen(false);
  };

  const handleSaveCurrentCvAllCriteria = async (goNext = true) => {
    if (!currentCv) return;
    setSavingStatus("Kaydediliyor...");
    try {
      const vals = activeCvValues;
      const parsedAge =
        vals.c002 && !Number.isNaN(Number(vals.c002))
          ? Number(vals.c002)
          : null;
      const genderVal =
        vals.c003 === "Kadın" || vals.c003 === "Erkek" ? vals.c003 : "Erkek";

      await fetch("/api/ground-truth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: currentCv.fileName,
          rater: "ben",
          humanName: vals.c001 || currentCv.aiName,
          humanGender: genderVal,
          humanAge: parsedAge,
          humanUniversity: vals.c012 || currentCv.aiUniversity,
          humanDepartment: vals.c013 || currentCv.aiDepartment,
          humanDegree:
            vals.c026 === "Var"
              ? "Doktora (Ph.D.)"
              : vals.c021 === "Var"
              ? "Yüksek Lisans (Master's)"
              : vals.c016 === "Var"
              ? "Ön Lisans (Associate)"
              : "Lisans (Bachelor's)",
        }),
      });

      setSavingStatus(`✓ ${currentCv.fileName} için ${criteriaList.length} kriter kaydedildi!`);
      if (goNext && selectedCvIndex < cvItems.length - 1) {
        setSelectedCvIndex((prev) => prev + 1);
      }
      setTimeout(() => setSavingStatus(""), 2500);
    } catch {
      setSavingStatus("Kaydedilirken hata oluştu.");
    }
  };

  const filteredCriteria = useMemo(() => {
    return criteriaList.filter((c) => {
      if (activeCategory !== "all" && c.categoryKey !== activeCategory) {
        return false;
      }
      if (tierFilter !== "all" && c.tier !== tierFilter) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLocaleLowerCase("tr-TR");
        return (
          c.label.toLocaleLowerCase("tr-TR").includes(q) ||
          c.shortDesc.toLocaleLowerCase("tr-TR").includes(q) ||
          c.code.includes(q) ||
          c.categoryLabel.toLocaleLowerCase("tr-TR").includes(q)
        );
      }
      return true;
    });
  }, [criteriaList, activeCategory, tierFilter, searchQuery]);

  const counts = useMemo(() => {
    const defCount = criteriaList.filter((c) => c.tier === "default").length;
    const premCount = criteriaList.filter((c) => c.tier === "premium").length;
    const hidCount = criteriaList.filter((c) => c.tier === "hidden").length;
    return { total: criteriaList.length, defCount, premCount, hidCount };
  }, [criteriaList]);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#141c2b] text-[#f0ece1] flex items-center justify-center text-sm font-mono-academic">
        Wi-Fi IP Kalkanı kontrol ediliyor...
      </div>
    );
  }

  // YETKİSİZ IP İSE GİZLİ 404 EKRANI VE MODEM SIFIRLAMA KURTARMA KAPISI
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#141c2b] text-[#f0ece1] flex flex-col items-center justify-center p-6 select-none">
        <div className="max-w-md w-full text-center space-y-4">
          <div
            onClick={() => setSecretClickCount((c) => c + 1)}
            className="inline-block font-mono-academic text-5xl font-bold text-[#93c5fd] cursor-default"
          >
            404
          </div>
          <h1 className="font-serif-academic text-xl font-bold">
            Sayfa Bulunamadı
          </h1>
          <p className="text-xs text-[#9ca3af] leading-relaxed">
            Aradığınız sayfa mevcut değil veya erişim yetkiniz bulunmuyor.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-[#e2dcd0] text-[#182235] text-xs font-bold"
            >
              Ana Sayfaya Dön
            </Link>
          </div>

          {/* 404 yazısına 3 kez tıklandığında veya ?kurtar=1 ile girildiğinde açılan Modem Sıfırlama Kurtarma Kutusu */}
          {secretClickCount >= 3 && (
            <form
              onSubmit={handleRecoverySubmit}
              className="mt-8 p-5 rounded-xl bg-[#182235] border border-[#33435e] text-left space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono-academic font-bold uppercase tracking-wider text-[#eab308]">
                  🛡️ MODEM SIFIRLAMA / YENİ WI-FI IP KURTARMA
                </span>
                <span className="text-[11px] font-mono-academic text-[#93c5fd]">
                  IP: {currentIp}
                </span>
              </div>
              <p className="text-xs text-[#cbd5e1] leading-relaxed">
                Modeminiz sıfırlandıysa veya farklı bir Wi-Fi ağına geçtiyseniz,
                Kurtarma Anahtarınızı girerek yeni IP adresinizi ({currentIp})
                güvenli listeye tanımlayın:
              </p>
              <input
                type="password"
                required
                value={recoveryKeyInput}
                onChange={(e) => setRecoveryKeyInput(e.target.value)}
                placeholder="Kurtarma Anahtarı (Master Şifre)"
                className="w-full px-3 py-2 rounded-lg bg-[#111927] border border-[#3b4d6b] text-xs text-white focus:outline-none focus:border-[#eab308]"
              />
              <label className="flex items-center gap-2 text-xs text-[#cbd5e1] cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceOldIps}
                  onChange={(e) => setReplaceOldIps(e.target.checked)}
                />
                <span>
                  Eski IP&apos;leri sil ve sadece bu yeni Wi-Fi IP adresine (
                  {currentIp}) kilitle
                </span>
              </label>
              {recoveryError && (
                <div className="text-xs text-red-400 font-semibold">
                  {recoveryError}
                </div>
              )}
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-[#eab308] text-[#182235] text-xs font-bold cursor-pointer hover:bg-[#fde047]"
              >
                Yeni Wi-Fi IP Adresimi Tanımla ve Aç
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#cfc8b8] text-[#141c2b]">
      {/* ÜST KOMUTA BARI */}
      <header className="bg-[#182235] border-b border-[#2c3a52] sticky top-0 z-30 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Sol: Navigasyon & Başlık */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/gizlilabel"
              className="px-3 py-1.5 rounded-lg border border-[#384966] bg-[#212f47] hover:bg-[#2a3b57] text-xs font-semibold text-[#f0ece1] flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#93c5fd]" />
              Etiketleme Ekranı (/gizlilabel)
            </Link>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111927] border border-[#33435e]">
              <Sliders className="w-3.5 h-3.5 text-[#eab308]" />
              <span className="font-serif-academic font-bold text-sm text-[#f0ece1]">
                {counts.total} Seçenekli Kriter & CV Değerlendirme Matrisi
              </span>
            </div>

            <div
              title={`İzinli IP'ler: ${allowedIps.join(", ")}`}
              className="px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono-academic flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Wi-Fi IP Korumalı: {currentIp}</span>
            </div>
          </div>

          {/* Orta: Aktif CV Seçici (53 CV Arasında Hızlı Geçiş) */}
          {cvItems.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#111927] border border-[#33435e] rounded-lg p-1">
              <button
                type="button"
                onClick={() =>
                  setSelectedCvIndex((i) => Math.max(0, i - 1))
                }
                disabled={selectedCvIndex === 0}
                className="p-1.5 rounded hover:bg-[#212f47] text-[#d2ccc0] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={selectedCvIndex}
                onChange={(e) => setSelectedCvIndex(Number(e.target.value))}
                className="bg-[#182235] text-[#f0ece1] text-xs font-semibold px-2.5 py-1 rounded border border-[#2c3a52] max-w-[260px] focus:outline-none"
              >
                {cvItems.map((it, idx) => (
                  <option key={it.fileName} value={idx}>
                    #{String(idx + 1).padStart(2, "0")} — {it.aiName} (
                    {it.fileName})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setSelectedCvIndex((i) =>
                    Math.min(cvItems.length - 1, i + 1)
                  )
                }
                disabled={selectedCvIndex === cvItems.length - 1}
                className="p-1.5 rounded hover:bg-[#212f47] text-[#d2ccc0] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowPdfSplit((s) => !s)}
                className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer flex items-center gap-1 ${
                  showPdfSplit
                    ? "bg-[#eab308] text-[#182235]"
                    : "bg-[#212f47] text-[#d2ccc0] hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {showPdfSplit ? "PDF'i Gizle" : "PDF'i Yanda Aç"}
              </button>
            </div>
          )}

          {/* Sağ: Yeni Seçenek Ekle & Kaydet */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-[#eab308]/60 bg-[#eab308]/15 hover:bg-[#eab308]/25 text-[#fde047] text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />+ Yeni Seçenek Ekle (
              {counts.total + 1})
            </button>

            <button
              type="button"
              onClick={() => handleSaveCurrentCvAllCriteria(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[#e2dcd0] hover:bg-white text-[#182235] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#182235]" />
              {counts.total} Kriteri Kaydet & Sonraki CV
            </button>
          </div>
        </div>

        {/* ALT FİLTRE & KATEGORİ ŞERİDİ (100 SEÇENEĞİ TEK EKRANDA YÖNETMEK İÇİN) */}
        <div className="bg-[#111927] border-t border-[#263349] px-4 py-2">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2.5">
            {/* 10 Kategori Sekmesi */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                  activeCategory === "all"
                    ? "bg-[#e2dcd0] text-[#182235]"
                    : "bg-[#182235] text-[#b8b2a6] hover:text-white"
                }`}
              >
                Tümü ({counts.total})
              </button>
              {CRITERIA_CATEGORIES.map((cat) => {
                const catCount = criteriaList.filter(
                  (c) => c.categoryKey === cat.key
                ).length;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategory(cat.key)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                      activeCategory === cat.key
                        ? "bg-[#eab308] text-[#182235] font-bold"
                        : "bg-[#182235] text-[#cbd5e1] hover:bg-[#212f47]"
                    }`}
                  >
                    {cat.label} ({catCount})
                  </button>
                );
              })}
            </div>

            {/* Arama & Erişim Kademesi Filtresi */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9ca3af] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="100 seçenek içinde ara (yaş, ne işi, master, sap...)"
                  className="pl-8 pr-3 py-1 rounded bg-[#182235] border border-[#33435e] text-xs text-[#f0ece1] w-64 focus:outline-none focus:border-[#eab308]"
                />
              </div>

              <div className="inline-flex rounded bg-[#182235] border border-[#33435e] p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTierFilter("all")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    tierFilter === "all"
                      ? "bg-[#e2dcd0] text-[#182235] font-bold"
                      : "text-[#b8b2a6]"
                  }`}
                >
                  Tümü ({counts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setTierFilter("default")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    tierFilter === "default"
                      ? "bg-emerald-400 text-[#182235] font-bold"
                      : "text-[#b8b2a6]"
                  }`}
                >
                  ✓ Default ({counts.defCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTierFilter("premium")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    tierFilter === "premium"
                      ? "bg-[#eab308] text-[#182235] font-bold"
                      : "text-[#b8b2a6]"
                  }`}
                >
                  🔒 Premium ({counts.premCount})
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCompactDensity((d) =>
                    d === "ultra" ? "normal" : "ultra"
                  )
                }
                className="px-2.5 py-1 rounded bg-[#182235] border border-[#33435e] text-[11px] text-[#d2ccc0] hover:text-white cursor-pointer"
              >
                {compactDensity === "ultra"
                  ? "5 Sütun Kompakt Görünüm"
                  : "3 Sütun Geniş Görünüm"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* BİLDİRİM BANNER'I */}
      {(savingStatus || autoRecoveredNote) && (
        <div className="max-w-[1600px] mx-auto px-4 pt-3">
          <div className="px-4 py-2 rounded-lg bg-[#182235] text-[#fde047] text-xs font-semibold flex items-center justify-between">
            <span>{savingStatus || autoRecoveredNote}</span>
            <button
              type="button"
              onClick={() => {
                setSavingStatus("");
                setAutoRecoveredNote("");
              }}
              className="text-white cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ANA İÇERİK: 100 SEÇENEĞİ TEK SAYFAYA SIĞDIRAN YÜKSEK YOĞUNLUKLU MATRİS */}
      <main className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* OPSİYONEL SOL SÜTUN: PDF ÖNİZLEME (AÇILDIĞINDA 5 SÜTUN KAPLAR) */}
          {showPdfSplit && currentCv && (
            <div className="lg:col-span-5 bg-[#e2dcd0] border border-[#b0a898] rounded-xl overflow-hidden shadow-md sticky top-28">
              <div className="bg-[#182235] text-[#f0ece1] px-3.5 py-2 flex items-center justify-between text-xs">
                <span className="font-bold truncate">
                  📄 {currentCv.fileName} — {currentCv.aiName}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPdfSplit(false)}
                  className="text-[#b8b2a6] hover:text-white cursor-pointer"
                >
                  Kapat ×
                </button>
              </div>
              <iframe
                src={`/api/ground-truth/pdf?file=${encodeURIComponent(
                  currentCv.fileName
                )}`}
                className="w-full h-[76vh] bg-[#dad3c5]"
                title="CV PDF Preview"
              />
            </div>
          )}

          {/* SAĞ / TAM EKRAN SÜTUN: 100 SEÇENEKLİ KOMPAKT KRİTER MATRİSİ */}
          <div
            className={
              showPdfSplit ? "lg:col-span-7" : "lg:col-span-12"
            }
          >
            <div
              className={`grid gap-2 ${
                showPdfSplit
                  ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                  : compactDensity === "ultra"
                  ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {filteredCriteria.map((crit) => {
                const val = activeCvValues[crit.id] ?? "";
                const isDefault = crit.tier === "default";
                const isPremium = crit.tier === "premium";

                return (
                  <div
                    key={crit.id}
                    className={`rounded-lg border p-2.5 transition-all flex flex-col justify-between gap-1.5 ${
                      isDefault
                        ? "bg-[#ece7db] border-[#182235] shadow-2xs"
                        : isPremium
                        ? "bg-[#e2dcd0] border-[#b0a898] hover:border-[#182235]"
                        : "bg-[#d6cfc0]/70 border-[#b8b0a0] opacity-75"
                    }`}
                  >
                    {/* Üst Satır: Kriter Kodu, Başlık ve Default/Premium Durum Butonu */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-mono-academic text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#182235] text-[#f0ece1] shrink-0">
                            #{crit.code}
                          </span>
                          <span className="text-[10px] text-[#4a5363] truncate">
                            {crit.categoryLabel.replace(/^\d+\.\s*/, "")}
                          </span>
                        </div>
                        <div
                          className="font-serif-academic font-bold text-xs text-[#121926] mt-0.5 truncate"
                          title={crit.label}
                        >
                          {crit.label}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleCriterionTier(crit.id)}
                        title="Tıklayarak Default (Açık) / Premium (Kilitli) / Gizli durumunu değiştirin"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono-academic font-bold shrink-0 cursor-pointer flex items-center gap-0.5 ${
                          isDefault
                            ? "bg-[#182235] text-[#eab308]"
                            : isPremium
                            ? "bg-[#cfc8b8] text-[#7c470b] border border-[#a8a090]"
                            : "bg-neutral-300 text-neutral-600"
                        }`}
                      >
                        {isDefault ? (
                          <>
                            <Check className="w-2.5 h-2.5" />
                            <span>Default</span>
                          </>
                        ) : isPremium ? (
                          <>
                            <Lock className="w-2.5 h-2.5" />
                            <span>Premium</span>
                          </>
                        ) : (
                          <span>Pasif</span>
                        )}
                      </button>
                    </div>

                    {/* Alt Satır: Seçili CV için Değer Girişi / Seçimi */}
                    <div>
                      {crit.inputType === "select" && crit.options ? (
                        <select
                          value={val}
                          onChange={(e) =>
                            handleUpdateCriterionValue(crit.id, e.target.value)
                          }
                          className={`w-full px-2 py-1 rounded border text-xs font-semibold focus:outline-none ${
                            val === "Var" ||
                            val === "Kadın" ||
                            val === "Erkek" ||
                            val.startsWith("İleri")
                              ? "bg-[#182235] text-[#f0ece1] border-[#182235]"
                              : "bg-[#f3efe6] text-[#121926] border-[#b8b0a0]"
                          }`}
                        >
                          {!crit.options.includes(val) && val && (
                            <option value={val}>{val}</option>
                          )}
                          {crit.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) =>
                            handleUpdateCriterionValue(crit.id, e.target.value)
                          }
                          placeholder={crit.shortDesc}
                          className="w-full px-2 py-1 rounded bg-[#f3efe6] border border-[#b8b0a0] text-xs font-semibold text-[#121926] focus:outline-none focus:border-[#182235]"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* YENİ SEÇENEK / KRİTER EKLEME MODALI */}
      {isAddModalOpen && (
        <div
          onClick={() => setIsAddModalOpen(false)}
          className="fixed inset-0 z-50 bg-[#141c2b]/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#e2dcd0] rounded-2xl border border-[#b8b0a0] max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#c4bdb0] pb-3">
              <h3 className="font-serif-academic font-bold text-base text-[#121926]">
                + Yeni Değerlendirme Seçeneği Ekle (#{counts.total + 1})
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#4a5363] hover:text-[#121926] text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddCustomCriterion} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#182235] mb-1">
                  Seçenek / Kriter Adı *
                </label>
                <input
                  type="text"
                  required
                  value={newCritLabel}
                  onChange={(e) => setNewCritLabel(e.target.value)}
                  placeholder="Örn: Vardiya Amirliği Deneyimi, Forklift Ehliyeti..."
                  className="w-full px-3 py-2 rounded-lg bg-[#ece7db] border border-[#a8a090] text-xs text-[#121926]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182235] mb-1">
                  Kategori
                </label>
                <select
                  value={newCritCategory}
                  onChange={(e) => setNewCritCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#ece7db] border border-[#a8a090] text-xs text-[#121926]"
                >
                  {CRITERIA_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182235] mb-1">
                  Varsayılan Durum
                </label>
                <select
                  value={newCritTier}
                  onChange={(e) =>
                    setNewCritTier(e.target.value as CriterionAccessTier)
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#ece7db] border border-[#a8a090] text-xs text-[#121926]"
                >
                  <option value="premium">
                    🔒 Premium Kilitli (Bize Ulaşın)
                  </option>
                  <option value="default">
                    ✓ Default Açık (Ana Sayfada Açık)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182235] mb-1">
                  Kısa Açıklama
                </label>
                <input
                  type="text"
                  value={newCritDesc}
                  onChange={(e) => setNewCritDesc(e.target.value)}
                  placeholder="Kısa açıklama..."
                  className="w-full px-3 py-2 rounded-lg bg-[#ece7db] border border-[#a8a090] text-xs text-[#121926]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#a8a090] bg-[#d6cfc0] text-xs font-semibold cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#182235] text-[#f0ece1] text-xs font-bold cursor-pointer"
                >
                  Listeye Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
