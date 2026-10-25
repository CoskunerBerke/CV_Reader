"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  Brain,
  FileText,
  Eye,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";

interface GroundTruthLabel {
  fileName: string;
  humanName?: string;
  humanGender: "Kadın" | "Erkek" | "Belirsiz";
  humanAge: number | null;
  updatedAt: string;
}

interface BenchmarkCVItem {
  index: number;
  fileName: string;
  rawText: string;
  aiName: string;
  aiGender: "Kadın" | "Erkek" | "Belirsiz";
  aiGenderConfidence: number;
  aiGenderReason: string;
  aiAge: number | null;
  aiAgeMethod: string;
  aiAgeReason: string;
  humanLabel: GroundTruthLabel | null;
}

export default function GroundTruthLabelerPage() {
  const [items, setItems] = useState<BenchmarkCVItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"pdf" | "text">("pdf");
  const [filterMode, setFilterMode] = useState<"all" | "unlabeled" | "mismatched">("all");

  // Kullanıcının aktif CV için girdiği değerler
  const [inputGender, setInputGender] = useState<"Erkek" | "Kadın">("Erkek");
  const [inputAge, setInputAge] = useState<string>("");
  const [inputName, setInputName] = useState<string>("");
  const [saveMessage, setSaveMessage] = useState<string>("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ground-truth");
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredItems = useMemo(() => {
    if (filterMode === "unlabeled") {
      return items.filter((it) => !it.humanLabel);
    }
    if (filterMode === "mismatched") {
      return items.filter((it) => {
        if (!it.humanLabel) return false;
        const genderMismatch = it.aiGender !== it.humanLabel.humanGender;
        const ageMismatch =
          it.humanLabel.humanAge !== null &&
          (it.aiAge === null || Math.abs(it.aiAge - it.humanLabel.humanAge) > 1);
        return genderMismatch || ageMismatch;
      });
    }
    return items;
  }, [items, filterMode]);

  const currentItem = filteredItems[currentIndex] || filteredItems[0] || null;

  // Aktif CV değiştiğinde form alanlarını doldur
  useEffect(() => {
    if (!currentItem) return;
    if (currentItem.humanLabel) {
      setInputGender(
        currentItem.humanLabel.humanGender === "Kadın" ? "Kadın" : "Erkek"
      );
      setInputAge(
        currentItem.humanLabel.humanAge !== null
          ? String(currentItem.humanLabel.humanAge)
          : ""
      );
      setInputName(currentItem.humanLabel.humanName || currentItem.aiName);
    } else {
      // Henüz etiketlenmemişse başlangıç kolaylığı için AI tahminini varsayılan getir ama kullanıcı tek tıkla değiştirebilsin
      setInputGender(currentItem.aiGender === "Kadın" ? "Kadın" : "Erkek");
      setInputAge(currentItem.aiAge !== null ? String(currentItem.aiAge) : "");
      setInputName(currentItem.aiName);
    }
    setSaveMessage("");
  }, [currentItem]);

  // GERÇEK BAŞARI YÜZDELERİ HESAPLAMA (Sadece Kullanıcının Etiketlediği CV'ler Üzerinden!)
  const stats = useMemo(() => {
    const labeled = items.filter((it) => it.humanLabel !== null);
    const totalLabeled = labeled.length;
    if (totalLabeled === 0) {
      return {
        totalLabeled: 0,
        genderCorrect: 0,
        genderAccuracy: 0,
        ageLabeledCount: 0,
        ageExactCorrect: 0,
        ageExactAccuracy: 0,
        ageCloseCorrect: 0,
        ageCloseAccuracy: 0,
        overallAccuracy: 0,
        mismatches: [] as BenchmarkCVItem[],
      };
    }

    let genderCorrect = 0;
    let ageLabeledCount = 0;
    let ageExactCorrect = 0;
    let ageCloseCorrect = 0; // ±1 yaş toleranslı
    const mismatches: BenchmarkCVItem[] = [];

    for (const it of labeled) {
      const lbl = it.humanLabel!;
      const isGenderOk = it.aiGender === lbl.humanGender;
      if (isGenderOk) genderCorrect++;

      let isAgeCloseOk = true;
      if (lbl.humanAge !== null) {
        ageLabeledCount++;
        const diff = it.aiAge !== null ? Math.abs(it.aiAge - lbl.humanAge) : 999;
        if (diff === 0) ageExactCorrect++;
        if (diff <= 1) {
          ageCloseCorrect++;
        } else {
          isAgeCloseOk = false;
        }
      }

      if (!isGenderOk || !isAgeCloseOk) {
        mismatches.push(it);
      }
    }

    const genderAccuracy = Number(((genderCorrect / totalLabeled) * 100).toFixed(1));
    const ageExactAccuracy =
      ageLabeledCount > 0
        ? Number(((ageExactCorrect / ageLabeledCount) * 100).toFixed(1))
        : 100;
    const ageCloseAccuracy =
      ageLabeledCount > 0
        ? Number(((ageCloseCorrect / ageLabeledCount) * 100).toFixed(1))
        : 100;

    const overallAccuracy = Number(
      ((genderAccuracy + ageCloseAccuracy) / 2).toFixed(1)
    );

    return {
      totalLabeled,
      genderCorrect,
      genderAccuracy,
      ageLabeledCount,
      ageExactCorrect,
      ageExactAccuracy,
      ageCloseCorrect,
      ageCloseAccuracy,
      overallAccuracy,
      mismatches,
    };
  }, [items]);

  const handleSaveLabel = async (
    customGender?: "Erkek" | "Kadın",
    customAge?: string,
    autoNext = true
  ) => {
    if (!currentItem) return;
    setSaving(true);
    const gToSave = customGender || inputGender;
    const aToSave = customAge !== undefined ? customAge : inputAge;
    const parsedAge = aToSave.trim() === "" ? null : parseInt(aToSave.trim(), 10);

    try {
      const res = await fetch("/api/ground-truth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: currentItem.fileName,
          humanName: inputName.trim() || currentItem.aiName,
          humanGender: gToSave,
          humanAge: parsedAge,
        }),
      });
      const data = await res.json();
      if (data.success && data.label) {
        setItems((prev) =>
          prev.map((it) =>
            it.fileName === currentItem.fileName
              ? { ...it, humanLabel: data.label }
              : it
          )
        );
        setSaveMessage("✓ Etiket kaydedildi ve öğrenme hafızasına işlendi.");
        if (autoNext && currentIndex < filteredItems.length - 1) {
          setTimeout(() => {
            setCurrentIndex((prev) => Math.min(filteredItems.length - 1, prev + 1));
          }, 180);
        }
      }
    } catch {
      setSaveMessage("⚠️ Kaydedilirken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearAllLabels = async () => {
    if (!confirm("Tüm girdiğiniz etiketleri sıfırlamak istediğinize emin misiniz?")) return;
    await fetch("/api/ground-truth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_all" }),
    });
    setItems((prev) => prev.map((it) => ({ ...it, humanLabel: null })));
  };

  // Aktif CV için anlık karşılaştırma durumu
  const activeComparison = useMemo(() => {
    if (!currentItem) return null;
    const compareGender = currentItem.humanLabel
      ? currentItem.humanLabel.humanGender
      : inputGender;
    const compareAge = currentItem.humanLabel
      ? currentItem.humanLabel.humanAge
      : inputAge.trim() !== ""
      ? parseInt(inputAge, 10)
      : null;

    const genderMatch = currentItem.aiGender === compareGender;
    const ageDiff =
      compareAge !== null && currentItem.aiAge !== null
        ? Math.abs(currentItem.aiAge - compareAge)
        : null;

    return {
      compareGender,
      compareAge,
      genderMatch,
      ageDiff,
    };
  }, [currentItem, inputGender, inputAge]);

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      {/* ÜST BAR: GERÇEK BAŞARI YÜZDELERİ SKOR TABLOSU */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-900 text-xs font-semibold flex items-center gap-1.5 bg-zinc-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Ana Uygulama
            </Link>
            <div>
              <h1 className="font-bold text-sm sm:text-base text-zinc-950 flex items-center gap-2">
                <span>CV Etiketleme (Labeling) & Gerçek Doğruluk Testi</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-900 text-white">
                  {stats.totalLabeled} / {items.length} Etiketlendi
                </span>
              </h1>
              <p className="text-[11px] text-zinc-500">
                AI&apos;nın kendi iddia ettiği yüzde değil; doğrudan sizin girdiğiniz gerçek etiketlerle karşılaştırmalı başarı yüzdesi
              </p>
            </div>
          </div>

          {/* CANLI GERÇEK BAŞARI KARTLARI */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-center min-w-[120px]">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Cinsiyet Başarısı
              </div>
              <div className="text-sm font-bold text-zinc-950">
                {stats.totalLabeled === 0 ? "—" : `%${stats.genderAccuracy}`}
                <span className="text-[11px] text-zinc-500 font-normal ml-1">
                  ({stats.genderCorrect}/{stats.totalLabeled})
                </span>
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-center min-w-[130px]">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Yaş Başarısı (Tam / ±1)
              </div>
              <div className="text-sm font-bold text-zinc-950">
                {stats.ageLabeledCount === 0
                  ? "—"
                  : `%${stats.ageExactAccuracy} / %${stats.ageCloseAccuracy}`}
                <span className="text-[11px] text-zinc-500 font-normal ml-1">
                  ({stats.ageCloseCorrect}/{stats.ageLabeledCount})
                </span>
              </div>
            </div>

            <div
              className={`px-3.5 py-1.5 rounded-lg border text-center min-w-[135px] ${
                stats.totalLabeled === 0
                  ? "border-zinc-200 bg-zinc-50 text-zinc-800"
                  : stats.overallAccuracy >= 90
                  ? "border-teal-300 bg-teal-50 text-teal-900"
                  : "border-red-300 bg-red-50 text-red-900"
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold">
                Genel AI Başarısı
              </div>
              <div className="text-base font-extrabold">
                {stats.totalLabeled === 0 ? "Bekleniyor" : `%${stats.overallAccuracy}`}
              </div>
            </div>

            {stats.totalLabeled > 0 && (
              <button
                onClick={handleClearAllLabels}
                title="Tüm etiketleri sıfırla"
                className="p-2 border border-zinc-200 rounded-lg hover:border-red-600 hover:text-red-600 text-zinc-500 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* %90 ALTI UYARI BANNER'I */}
        {stats.totalLabeled > 0 && stats.overallAccuracy < 90 && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3.5 flex items-center justify-between gap-3 text-xs text-red-900">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <strong>Uyarı: AI Gerçek Başarı Yüzdesi %{stats.overallAccuracy} seviyesine (%90 altına) düştü!</strong>{" "}
                Kaydettiğiniz her doğru etiket <code>data/ground-truth-labels.json</code> hafızasına işleniyor; hatalı{" "}
                {stats.mismatches.length} CV aşağıda listelenmiştir.
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-600">
            53 CV yükleniyor...
          </div>
        ) : !currentItem ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center space-y-3">
            <p className="text-sm font-semibold">Bu filtrede gösterilecek CV kalmadı.</p>
            <button
              onClick={() => {
                setFilterMode("all");
                setCurrentIndex(0);
              }}
              className="px-4 py-2 bg-zinc-900 text-white rounded-md text-xs font-medium cursor-pointer"
            >
              Tüm 53 CV&apos;yi Göster
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* SOL SÜTUN (7 Sütun): ORİJİNAL PDF GÖRÜNTÜLEYİCİ VEYA HAM METİN */}
            <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-zinc-900 text-white text-xs font-bold">
                    #{currentItem.index} / {items.length}
                  </span>
                  <span className="font-semibold text-xs sm:text-sm text-zinc-900 truncate max-w-[280px] sm:max-w-[380px]">
                    {currentItem.fileName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setViewMode("pdf")}
                    className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer ${
                      viewMode === "pdf"
                        ? "bg-zinc-900 text-white"
                        : "bg-white border border-zinc-200 text-zinc-700"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Orijinal PDF
                  </button>
                  <button
                    onClick={() => setViewMode("text")}
                    className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer ${
                      viewMode === "text"
                        ? "bg-zinc-900 text-white"
                        : "bg-white border border-zinc-200 text-zinc-700"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Okunan Metin
                  </button>
                </div>
              </div>

              {viewMode === "pdf" ? (
                <iframe
                  key={currentItem.fileName}
                  src={`/api/ground-truth/pdf?file=${encodeURIComponent(currentItem.fileName)}`}
                  className="w-full h-[700px] border-0 bg-zinc-200"
                  title={currentItem.fileName}
                />
              ) : (
                <pre className="w-full h-[700px] overflow-y-auto p-4 bg-zinc-950 text-zinc-100 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                  {currentItem.rawText || "Metin okunamadı (Taranmış görüntü olabilir)."}
                </pre>
              )}
            </div>

            {/* SAĞ SÜTUN (5 Sütun): TEK TEK ETİKETLEME & AI İLE ANLIK KARŞILAŞTIRMA */}
            <div className="lg:col-span-5 space-y-4">
              {/* 1. GEZİNME VE FİLTRE KUTUSU */}
              <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <button
                    disabled={currentIndex <= 0}
                    onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
                    className="px-3 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-900 disabled:opacity-40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Önceki
                  </button>

                  <select
                    value={currentIndex}
                    onChange={(e) => setCurrentIndex(Number(e.target.value))}
                    className="flex-1 border border-zinc-200 rounded-md px-2.5 py-1.5 text-xs font-medium bg-zinc-50 truncate"
                  >
                    {filteredItems.map((it, idx) => {
                      const statusIcon = !it.humanLabel
                        ? "⚪"
                        : it.aiGender === it.humanLabel.humanGender &&
                          (it.humanLabel.humanAge === null ||
                            (it.aiAge !== null &&
                              Math.abs(it.aiAge - it.humanLabel.humanAge) <= 1))
                        ? "✅"
                        : "❌";
                      return (
                        <option key={it.fileName} value={idx}>
                          {statusIcon} #{it.index} - {it.aiName} ({it.fileName})
                        </option>
                      );
                    })}
                  </select>

                  <button
                    disabled={currentIndex >= filteredItems.length - 1}
                    onClick={() =>
                      setCurrentIndex((p) => Math.min(filteredItems.length - 1, p + 1))
                    }
                    className="px-3 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-900 disabled:opacity-40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    Sonraki
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Hızlı Filtre Sekmeleri */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      setFilterMode("all");
                      setCurrentIndex(0);
                    }}
                    className={`py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      filterMode === "all"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    Tümü ({items.length})
                  </button>
                  <button
                    onClick={() => {
                      setFilterMode("unlabeled");
                      setCurrentIndex(0);
                    }}
                    className={`py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      filterMode === "unlabeled"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    Etiketlenmeyen ({items.length - stats.totalLabeled})
                  </button>
                  <button
                    onClick={() => {
                      setFilterMode("mismatched");
                      setCurrentIndex(0);
                    }}
                    className={`py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      filterMode === "mismatched"
                        ? "bg-red-600 text-white"
                        : "bg-red-50 text-red-700 hover:bg-red-100"
                    }`}
                  >
                    AI Hataları ({stats.mismatches.length})
                  </button>
                </div>
              </div>

              {/* 2. SENİN GERÇEK ETİKETİN (GROUND TRUTH GİRİŞ FORMU) */}
              <div className="bg-white border-2 border-teal-600 rounded-xl p-4 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-950">
                      1. Senin Gerçek Cevabın (Ground Truth)
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      Soldaki CV&apos;ye bakarak gerçek cinsiyet ve yaşı girip kaydedin
                    </p>
                  </div>
                  {currentItem.humanLabel && (
                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[11px] font-bold">
                      ✓ Etiketlendi
                    </span>
                  )}
                </div>

                {/* Ad Soyad (İsteğe bağlı düzeltme) */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Aday Adı Soyadı
                  </label>
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-teal-600"
                  />
                </div>

                {/* Gerçek Cinsiyet Seçimi */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Gerçek Cinsiyet *
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setInputGender("Erkek")}
                      className={`py-2.5 px-4 rounded-lg border text-sm font-bold transition-all cursor-pointer ${
                        inputGender === "Erkek"
                          ? "bg-zinc-900 border-zinc-900 text-white shadow-xs"
                          : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-400"
                      }`}
                    >
                      Erkek
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputGender("Kadın")}
                      className={`py-2.5 px-4 rounded-lg border text-sm font-bold transition-all cursor-pointer ${
                        inputGender === "Kadın"
                          ? "bg-zinc-900 border-zinc-900 text-white shadow-xs"
                          : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-400"
                      }`}
                    >
                      Kadın
                    </button>
                  </div>
                </div>

                {/* Gerçek Yaş Girişi */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Gerçek Yaş (2025 Bazlı) *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setInputAge((prev) =>
                          String(Math.max(17, (parseInt(prev, 10) || 24) - 1))
                        )
                      }
                      className="px-3 py-2 border border-zinc-300 rounded-lg bg-zinc-50 hover:bg-zinc-100 font-bold text-sm cursor-pointer"
                    >
                      -1
                    </button>
                    <input
                      type="number"
                      min={16}
                      max={75}
                      value={inputAge}
                      onChange={(e) => setInputAge(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveLabel();
                        }
                      }}
                      placeholder="Örn: 25"
                      className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-center text-base font-bold focus:outline-none focus:border-teal-600"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setInputAge((prev) =>
                          String(Math.min(75, (parseInt(prev, 10) || 24) + 1))
                        )
                      }
                      className="px-3 py-2 border border-zinc-300 rounded-lg bg-zinc-50 hover:bg-zinc-100 font-bold text-sm cursor-pointer"
                    >
                      +1
                    </button>
                  </div>
                </div>

                {/* Kaydet Butonları */}
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveLabel()}
                    className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Kaydet, Karşılaştır ve Sonraki CV&apos;ye Geç (Enter)
                  </button>

                  {saveMessage && (
                    <div className="text-xs font-semibold text-teal-700 text-center">
                      {saveMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. AI CEVABI İLE SENİN CEVABININ KARŞILAŞTIRMASI */}
              <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  2. Bu CV İçin AI Cevabı vs. Senin Cevabın
                </h3>

                {/* Cinsiyet Karşılaştırma Satırı */}
                <div
                  className={`p-3 rounded-lg border ${
                    activeComparison?.genderMatch
                      ? "bg-teal-50/60 border-teal-200"
                      : "bg-red-50/70 border-red-200"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>
                      AI Cinsiyet: <strong className="underline">{currentItem.aiGender}</strong>{" "}
                      <span className="text-zinc-500 font-normal">
                        (İddia: %{currentItem.aiGenderConfidence})
                      </span>
                    </span>
                    <span>
                      Senin Cevabın:{" "}
                      <strong className="underline">{activeComparison?.compareGender}</strong>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600">{currentItem.aiGenderReason}</span>
                    {activeComparison?.genderMatch ? (
                      <span className="text-teal-700 font-bold flex items-center gap-1 shrink-0 ml-2">
                        <CheckCircle2 className="w-3.5 h-3.5" /> DOĞRU
                      </span>
                    ) : (
                      <span className="text-red-700 font-bold flex items-center gap-1 shrink-0 ml-2">
                        <XCircle className="w-3.5 h-3.5" /> YANLIŞ
                      </span>
                    )}
                  </div>
                </div>

                {/* Yaş Karşılaştırma Satırı */}
                <div
                  className={`p-3 rounded-lg border ${
                    activeComparison?.ageDiff === 0
                      ? "bg-teal-50/60 border-teal-200"
                      : activeComparison?.ageDiff !== null &&
                        activeComparison?.ageDiff !== undefined &&
                        activeComparison.ageDiff <= 1
                      ? "bg-amber-50/60 border-amber-200"
                      : "bg-red-50/70 border-red-200"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>
                      AI Yaş:{" "}
                      <strong className="underline">
                        {currentItem.aiAge !== null ? `${currentItem.aiAge} Yaş` : "Belirsiz"}
                      </strong>
                    </span>
                    <span>
                      Senin Cevabın:{" "}
                      <strong className="underline">
                        {activeComparison?.compareAge !== null
                          ? `${activeComparison?.compareAge} Yaş`
                          : "Girilmedi"}
                      </strong>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600">{currentItem.aiAgeReason}</span>
                    {activeComparison?.ageDiff === 0 ? (
                      <span className="text-teal-700 font-bold flex items-center gap-1 shrink-0 ml-2">
                        <CheckCircle2 className="w-3.5 h-3.5" /> TAM İSABET
                      </span>
                    ) : activeComparison?.ageDiff === 1 ? (
                      <span className="text-amber-700 font-bold flex items-center gap-1 shrink-0 ml-2">
                        ±1 YAŞ YAKIN
                      </span>
                    ) : (
                      <span className="text-red-700 font-bold flex items-center gap-1 shrink-0 ml-2">
                        <XCircle className="w-3.5 h-3.5" /> FARK:{" "}
                        {activeComparison?.ageDiff ?? "?"} YAŞ
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ALT TABLO: ETİKETLENEN TÜM CV'LER VE AI KARŞILAŞTIRMA ÖZETİ */}
        {stats.totalLabeled > 0 && (
          <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-zinc-950">
                  Etiketlenen CV&apos;ler ve AI Karşılaştırma Tablosu ({stats.totalLabeled} CV)
                </h3>
              </div>
              <span className="text-xs text-zinc-500">
                Veriler otomatik olarak <code>data/ground-truth-labels.json</code> dosyasına kaydedilir
              </span>
            </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-zinc-100 text-zinc-600 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">#</th>
                    <th className="py-2.5 px-3 font-semibold">Dosya / Aday</th>
                    <th className="py-2.5 px-3 font-semibold">AI Cinsiyet</th>
                    <th className="py-2.5 px-3 font-semibold">Senin Cinsiyetin</th>
                    <th className="py-2.5 px-3 font-semibold">AI Yaş</th>
                    <th className="py-2.5 px-3 font-semibold">Senin Yaşın</th>
                    <th className="py-2.5 px-3 font-semibold">Sonuç</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items
                    .filter((it) => it.humanLabel !== null)
                    .map((it) => {
                      const lbl = it.humanLabel!;
                      const gOk = it.aiGender === lbl.humanGender;
                      const aDiff =
                        lbl.humanAge !== null && it.aiAge !== null
                          ? Math.abs(it.aiAge - lbl.humanAge)
                          : 0;
                      const aOk = lbl.humanAge === null || aDiff <= 1;
                      return (
                        <tr
                          key={it.fileName}
                          onClick={() => {
                            setFilterMode("all");
                            setCurrentIndex(it.index - 1);
                          }}
                          className="hover:bg-zinc-50 cursor-pointer"
                        >
                          <td className="py-2 px-3 font-mono text-zinc-500">#{it.index}</td>
                          <td className="py-2 px-3 font-medium text-zinc-900">
                            {lbl.humanName || it.aiName}{" "}
                            <span className="text-zinc-400 font-normal">({it.fileName})</span>
                          </td>
                          <td className="py-2 px-3">{it.aiGender}</td>
                          <td className="py-2 px-3 font-bold">{lbl.humanGender}</td>
                          <td className="py-2 px-3">{it.aiAge ?? "—"}</td>
                          <td className="py-2 px-3 font-bold">{lbl.humanAge ?? "—"}</td>
                          <td className="py-2 px-3">
                            {gOk && aOk ? (
                              <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                                ✓ Başarılı {aDiff === 1 ? "(±1 Yaş)" : ""}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">
                                ✗ Hatalı ({!gOk ? "Cinsiyet" : ""} {!aOk ? `Yaş ${aDiff}f` : ""})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
