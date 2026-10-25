"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Users,
  RefreshCw,
  Lock,
} from "lucide-react";

type RaterId = "ben" | "arkadasim";

interface SingleRaterVote {
  rater: RaterId;
  humanName?: string;
  humanGender: "Kadın" | "Erkek" | "Belirsiz";
  humanAge: number | null;
  updatedAt: string;
}

interface GroundTruthLabel {
  fileName: string;
  humanName?: string;
  humanGender: "Kadın" | "Erkek" | "Belirsiz";
  humanAge: number | null;
  updatedAt: string;
  votes?: {
    ben?: SingleRaterVote;
    arkadasim?: SingleRaterVote;
  };
  consensusStatus?: "agreed" | "conflict" | "single";
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
  const RATER_STORAGE_KEY = "cv_active_rater_role_v2";

  const [activeRater, setActiveRater] = useState<RaterId>("ben");
  const [items, setItems] = useState<BenchmarkCVItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"pdf" | "text">("pdf");
  const [filterMode, setFilterMode] = useState<
    "all" | "my_unlabeled" | "agreed" | "conflict" | "mismatched"
  >("all");

  // Kullanıcının aktif CV için girdiği değerler
  const [inputGender, setInputGender] = useState<"Erkek" | "Kadın">("Erkek");
  const [inputAge, setInputAge] = useState<string>("");
  const [inputName, setInputName] = useState<string>("");
  const [saveMessage, setSaveMessage] = useState<string>("");

  // Cihazdaki seçili etiketleyici rolünü ("ben" veya "arkadasim") hatırla
  useEffect(() => {
    try {
      const savedRole = localStorage.getItem(RATER_STORAGE_KEY);
      if (savedRole === "ben" || savedRole === "arkadasim") {
        setActiveRater(savedRole);
      }
      // Eski yerel önbelleği temizle ki sıfırdan başlasın
      localStorage.removeItem("cv_ground_truth_labels_v1");
    } catch {
      // ignore
    }
  }, []);

  const jumpToFirstUnlabeledForRole = useCallback(
    (list: BenchmarkCVItem[], role: RaterId) => {
      const firstUnlabeledIdx = list.findIndex(
        (it) => !it.humanLabel?.votes?.[role]
      );
      if (firstUnlabeledIdx !== -1) {
        setFilterMode("all");
        setCurrentIndex(firstUnlabeledIdx);
      }
    },
    []
  );

  const handleSelectRater = (role: RaterId) => {
    setActiveRater(role);
    try {
      localStorage.setItem(RATER_STORAGE_KEY, role);
    } catch {
      // ignore
    }
    jumpToFirstUnlabeledForRole(items, role);
  };

  const fetchAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setSyncing(true);
      try {
        const res = await fetch(`/api/ground-truth?t=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (data.items) {
          setItems(data.items);
          // İlk açılışta (sayfa yenilendiğinde veya kapatıp açıldığında) doğrudan kullanıcının kaldığı (henüz etiketlemediği ilk) CV'ye atla!
          if (!silent) {
            let role: RaterId = "ben";
            try {
              const savedRole = localStorage.getItem(RATER_STORAGE_KEY);
              if (savedRole === "ben" || savedRole === "arkadasim") {
                role = savedRole;
              }
            } catch {
              // ignore
            }
            const firstUnlabeledIdx = (data.items as BenchmarkCVItem[]).findIndex(
              (it) => !it.humanLabel?.votes?.[role]
            );
            if (firstUnlabeledIdx !== -1) {
              setCurrentIndex(firstUnlabeledIdx);
            }
          }
        }
      } catch {
        // ignore
      } finally {
        if (!silent) setLoading(false);
        else setSyncing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchAll(false);
    // Telefondan ve evdeki bilgisayardan eşzamanlı çalışırken her 6 saniyede bir ortak bulut verisini sessizce senkronize et
    const timer = setInterval(() => {
      fetchAll(true);
    }, 6000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  const filteredItems = useMemo(() => {
    if (filterMode === "my_unlabeled") {
      return items.filter((it) => !it.humanLabel?.votes?.[activeRater]);
    }
    if (filterMode === "agreed") {
      return items.filter((it) => it.humanLabel?.consensusStatus === "agreed");
    }
    if (filterMode === "conflict") {
      return items.filter((it) => it.humanLabel?.consensusStatus === "conflict");
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
  }, [items, filterMode, activeRater]);

  const currentItem = filteredItems[currentIndex] || filteredItems[0] || null;

  // Aktif CV veya aktif kişi ("ben" / "arkadasim") değiştiğinde form alanlarını doldur
  useEffect(() => {
    if (!currentItem) return;
    const myVote = currentItem.humanLabel?.votes?.[activeRater];
    if (myVote) {
      setInputGender(myVote.humanGender === "Kadın" ? "Kadın" : "Erkek");
      setInputAge(myVote.humanAge !== null ? String(myVote.humanAge) : "");
      setInputName(myVote.humanName || currentItem.aiName);
    } else if (currentItem.humanLabel) {
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
      setInputGender(currentItem.aiGender === "Kadın" ? "Kadın" : "Erkek");
      const isNoBirthOrEduDate =
        currentItem.aiAge === null ||
        currentItem.aiAgeMethod === "İlk İş Deneyimi Tahmini" ||
        currentItem.aiAgeMethod === "Bilinmiyor";
      setInputAge(isNoBirthOrEduDate ? "" : String(currentItem.aiAge));
      setInputName(currentItem.aiName);
    }
    setSaveMessage("");
  }, [currentItem?.fileName, activeRater]); // eslint-disable-line react-hooks/exhaustive-deps

  // GERÇEK BAŞARI YÜZDELERİ HESAPLAMA (Ortak Karar Öncelikli!)
  const stats = useMemo(() => {
    const allLabeled = items.filter((it) => it.humanLabel !== null);
    const agreedList = items.filter(
      (it) => it.humanLabel?.consensusStatus === "agreed"
    );
    const conflictList = items.filter(
      (it) => it.humanLabel?.consensusStatus === "conflict"
    );
    const myLabeledCount = items.filter(
      (it) => !!it.humanLabel?.votes?.[activeRater]
    ).length;
    const friendLabeledCount = items.filter(
      (it) =>
        !!it.humanLabel?.votes?.[activeRater === "ben" ? "arkadasim" : "ben"]
    ).length;

    // Karar Mekanizması: İkinizin aynı girdiği ("agreed") CV'ler + henüz tek kişinin girdiği ("single") CV'ler (Uyuşmazlık olanlar çözülene kadar hariç tutulur)
    const validDecisionPool = allLabeled.filter(
      (it) => it.humanLabel?.consensusStatus !== "conflict"
    );

    const totalLabeled = validDecisionPool.length;
    if (totalLabeled === 0) {
      return {
        totalAnyLabeled: allLabeled.length,
        totalLabeled: 0,
        agreedCount: agreedList.length,
        conflictCount: conflictList.length,
        myLabeledCount,
        friendLabeledCount,
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
    let ageCloseCorrect = 0;
    const mismatches: BenchmarkCVItem[] = [];

    for (const it of validDecisionPool) {
      const lbl = it.humanLabel!;
      const isGenderOk = it.aiGender === lbl.humanGender;
      if (isGenderOk) genderCorrect++;

      let isAgeCloseOk = true;
      ageLabeledCount++;
      if (lbl.humanAge !== null) {
        const diff = it.aiAge !== null ? Math.abs(it.aiAge - lbl.humanAge) : 999;
        if (diff === 0) ageExactCorrect++;
        if (diff <= 1) {
          ageCloseCorrect++;
        } else {
          isAgeCloseOk = false;
        }
      } else {
        // Ekstra Case: Kullanıcı "Yaş & Üni Tarihi Yok (Belirsiz)" seçtiyse ve AI da doğrudan doğum/eğitim tarihi bulamayıp Ekstra Case kullandıysa tam isabet sayılır
        const aiAlsoDetectedMissing =
          it.aiAge === null ||
          it.aiAgeMethod === "İlk İş Deneyimi Tahmini" ||
          it.aiAgeMethod === "Bilinmiyor";
        if (aiAlsoDetectedMissing) {
          ageExactCorrect++;
          ageCloseCorrect++;
        } else {
          isAgeCloseOk = false;
        }
      }

      if (!isGenderOk || !isAgeCloseOk) {
        mismatches.push(it);
      }
    }

    const genderAccuracy = Number(
      ((genderCorrect / totalLabeled) * 100).toFixed(1)
    );
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
      totalAnyLabeled: allLabeled.length,
      totalLabeled,
      agreedCount: agreedList.length,
      conflictCount: conflictList.length,
      myLabeledCount,
      friendLabeledCount,
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
  }, [items, activeRater]);

  const handleSaveLabel = async (
    customGender?: "Erkek" | "Kadın",
    customAge?: string,
    autoNext = true
  ) => {
    if (!currentItem) return;
    setSaving(true);
    const gToSave = customGender || inputGender;
    const aToSave = customAge !== undefined ? customAge : inputAge;
    const parsedAge =
      aToSave.trim() === "" ? null : parseInt(aToSave.trim(), 10);

    try {
      const res = await fetch("/api/ground-truth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: currentItem.fileName,
          humanName: inputName.trim() || currentItem.aiName,
          humanGender: gToSave,
          humanAge: parsedAge,
          rater: activeRater,
        }),
      });
      const data = await res.json();
      if (data.success && data.label) {
        const updatedList = items.map((it) =>
          it.fileName === currentItem.fileName
            ? { ...it, humanLabel: data.label }
            : it
        );
        setItems(updatedList);

        const statusMsg =
          data.label.consensusStatus === "agreed"
            ? "🔒 İkiniz de aynı cevabı verdiniz — Ortak Karar Kesinleşti!"
            : data.label.consensusStatus === "conflict"
            ? "⚡ Kaydedildi — Ancak arkadaşınızla farklı değer girdiniz!"
            : `✓ (${
                activeRater === "ben" ? "Ben" : "Arkadaşım"
              }) cevabı ortak buluta kaydedildi.`;
        setSaveMessage(statusMsg);

        if (autoNext) {
          setTimeout(() => {
            if (filterMode === "all") {
              // Doğrudan kullanıcının henüz etiketlemediği bir sonraki CV'ye atla (zaten yaptıklarını tekrar gösterme!)
              const nextUnlabeledAfter = updatedList.findIndex(
                (it, idx) => idx > currentIndex && !it.humanLabel?.votes?.[activeRater]
              );
              const anyUnlabeled =
                nextUnlabeledAfter !== -1
                  ? nextUnlabeledAfter
                  : updatedList.findIndex((it) => !it.humanLabel?.votes?.[activeRater]);
              if (anyUnlabeled !== -1) {
                setCurrentIndex(anyUnlabeled);
              } else {
                setCurrentIndex((prev) => Math.min(filteredItems.length - 1, prev + 1));
              }
            } else {
              setCurrentIndex((prev) => Math.min(filteredItems.length - 1, prev + 1));
            }
          }, 150);
        }
      }
    } catch {
      setSaveMessage("⚠️ Kaydedilirken bağlantı hatası oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const handleExportLabelsJson = () => {
    const map: Record<string, GroundTruthLabel> = {};
    for (const it of items) {
      if (it.humanLabel) {
        map[it.fileName] = it.humanLabel;
      }
    }
    const jsonStr = JSON.stringify(map, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ground-truth-labels.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAllLabels = async () => {
    if (
      !confirm(
        "Hem sizin hem arkadaşınızın girdiği TÜM etiketleri sıfırlamak istediğinize emin misiniz?"
      )
    )
      return;
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
    const isExtraCaseNoDate =
      currentItem.aiAgeMethod === "İlk İş Deneyimi Tahmini" ||
      currentItem.aiAgeMethod === "Bilinmiyor" ||
      currentItem.aiAge === null;

    const ageDiff =
      compareAge !== null && currentItem.aiAge !== null
        ? Math.abs(currentItem.aiAge - compareAge)
        : compareAge === null && isExtraCaseNoDate
        ? 0
        : null;

    return {
      compareGender,
      compareAge,
      genderMatch,
      ageDiff,
      isExtraCaseNoDate,
    };
  }, [currentItem, inputGender, inputAge]);

  const benVote = currentItem?.humanLabel?.votes?.ben;
  const arkVote = currentItem?.humanLabel?.votes?.arkadasim;

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      {/* ÜST BAR: ORTAK CANLI SKOR TABLOSU VE KULLANICI SEÇİMİ */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-900 text-xs font-semibold flex items-center gap-1.5 bg-zinc-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Ana Uygulama
            </Link>

            {/* KİM ETİKETLİYOR SEÇİCİ (BEN vs ARKADAŞIM) */}
            <div className="flex items-center bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              <span className="text-[11px] font-semibold text-zinc-500 px-2 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Kimsin:
              </span>
              <button
                onClick={() => handleSelectRater("ben")}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeRater === "ben"
                    ? "bg-zinc-900 text-white shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                📱 Ben ({items.filter((i) => !!i.humanLabel?.votes?.ben).length}/
                {items.length})
              </button>
              <button
                onClick={() => handleSelectRater("arkadasim")}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeRater === "arkadasim"
                    ? "bg-teal-700 text-white shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                💻 Arkadaşım (
                {items.filter((i) => !!i.humanLabel?.votes?.arkadasim).length}/
                {items.length})
              </button>
            </div>
          </div>

          {/* CANLI GERÇEK BAŞARI KARTLARI */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50/60 text-center">
              <div className="text-[10px] uppercase tracking-wider text-teal-800 font-bold flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Ortak Kesinleşen
              </div>
              <div className="text-sm font-extrabold text-teal-950">
                {stats.agreedCount} CV
                {stats.conflictCount > 0 && (
                  <span className="text-red-600 ml-1.5 text-xs">
                    ({stats.conflictCount} Uyuşmazlık)
                  </span>
                )}
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-center">
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

            <div className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-center">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Yaş Başarısı (Tam / ±1)
              </div>
              <div className="text-sm font-bold text-zinc-950">
                {stats.ageLabeledCount === 0
                  ? "—"
                  : `%${stats.ageExactAccuracy} / %${stats.ageCloseAccuracy}`}
                <span className="text-[11px] text-zinc-500 font-normal ml-1">
                  ({stats.ageExactCorrect}/{stats.ageLabeledCount})
                </span>
              </div>
            </div>

            <div
              className={`px-3 py-1.5 rounded-lg border text-center ${
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
                {stats.totalLabeled === 0
                  ? "0 / 53"
                  : `%${stats.overallAccuracy}`}
              </div>
            </div>

            <button
              onClick={() => fetchAll(true)}
              title="Canlı Buluttan Şimdi Yenile"
              className="p-2 border border-zinc-200 rounded-lg hover:border-zinc-900 text-zinc-600 bg-zinc-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${syncing ? "animate-spin text-teal-600" : ""}`}
              />
            </button>

            {stats.totalAnyLabeled > 0 && (
              <>
                <button
                  onClick={handleExportLabelsJson}
                  title="Etiketleri JSON olarak indir"
                  className="px-2.5 py-2 border border-zinc-200 rounded-lg hover:border-teal-600 text-xs font-semibold text-zinc-700 bg-zinc-50 cursor-pointer"
                >
                  📥 JSON
                </button>
                <button
                  onClick={handleClearAllLabels}
                  title="Tüm etiketleri sıfırla"
                  className="p-2 border border-zinc-200 rounded-lg hover:border-red-600 hover:text-red-600 text-zinc-500 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* İKİNİZİN FARKLI GİRDİĞİ CV UYARISI */}
        {stats.conflictCount > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3.5 flex items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong>
                  Dikkat: {stats.conflictCount} adet CV&apos;de arkadaşınızla farklı yaş/cinsiyet girdiniz!
                </strong>{" "}
                Sağdaki <strong>&quot;⚡ Uyuşmazlık ({stats.conflictCount})&quot;</strong> sekmesine tıklayarak farklı girdiğiniz CV&apos;leri tek tıkla görüp ortak karara bağlayabilirsiniz.
              </div>
            </div>
          </div>
        )}

        {/* %90 ALTI UYARI BANNER'I */}
        {stats.totalLabeled > 0 && stats.overallAccuracy < 90 && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3.5 flex items-center justify-between gap-3 text-xs text-red-900">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <strong>
                  Uyarı: AI Gerçek Başarı Yüzdesi %{stats.overallAccuracy} seviyesine (%90 altına) düştü!
                </strong>{" "}
                Ortak buluta kaydedilen her etiket sistem tarafından öğrenilmektedir.
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-600">
            53 CV ve ortak bulut verileri yükleniyor...
          </div>
        ) : !currentItem ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center space-y-3">
            <p className="text-sm font-semibold">
              Bu filtrede gösterilecek CV kalmadı.
            </p>
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
                  <span className="font-semibold text-xs sm:text-sm text-zinc-900 truncate max-w-[260px] sm:max-w-[360px]">
                    {currentItem.fileName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={`/api/ground-truth/pdf?file=${encodeURIComponent(
                      currentItem.fileName
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded text-xs font-medium bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100"
                  >
                    Tam Ekran PDF ↗
                  </a>
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
                  src={`/api/ground-truth/pdf?file=${encodeURIComponent(
                    currentItem.fileName
                  )}`}
                  className="w-full h-[680px] border-0 bg-zinc-200"
                  title={currentItem.fileName}
                />
              ) : (
                <pre className="w-full h-[680px] overflow-y-auto p-4 bg-zinc-950 text-zinc-100 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                  {currentItem.rawText ||
                    "Metin okunamadı (Taranmış görüntü olabilir)."}
                </pre>
              )}
            </div>

            {/* SAĞ SÜTUN (5 Sütun): TEK TEK ETİKETLEME, ARKADAŞ KARŞILAŞTIRMASI & AI KARŞILAŞTIRMASI */}
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
                      const cStatus = it.humanLabel?.consensusStatus;
                      const iDidIt = !!it.humanLabel?.votes?.[activeRater];
                      const icon = cStatus === "agreed"
                        ? "🔒"
                        : cStatus === "conflict"
                        ? "⚡"
                        : iDidIt
                        ? "✅"
                        : "⚪";
                      return (
                        <option key={it.fileName} value={idx}>
                          {icon} #{it.index} - {it.aiName} ({it.fileName})
                        </option>
                      );
                    })}
                  </select>

                  <button
                    disabled={currentIndex >= filteredItems.length - 1}
                    onClick={() =>
                      setCurrentIndex((p) =>
                        Math.min(filteredItems.length - 1, p + 1)
                      )
                    }
                    className="px-3 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-900 disabled:opacity-40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    Sonraki
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Eğer şu anki CV zaten bu kullanıcı tarafından etiketlenmişse tek tıkla kaldığı yere atlama butonu */}
                {currentItem.humanLabel?.votes?.[activeRater] &&
                  stats.myLabeledCount < items.length && (
                    <button
                      type="button"
                      onClick={() => jumpToFirstUnlabeledForRole(items, activeRater)}
                      className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      ⏭️ Bu CV&apos;yi Zaten Yaptın — Kaldığım Yere (İlk Yapmadığım CV&apos;ye) Atla
                    </button>
                  )}

                {/* Hızlı Filtre Sekmeleri */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
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
                      setFilterMode("my_unlabeled");
                      setCurrentIndex(0);
                    }}
                    className={`py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      filterMode === "my_unlabeled"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    Kalan ({items.length - stats.myLabeledCount})
                  </button>
                  <button
                    onClick={() => {
                      setFilterMode("agreed");
                      setCurrentIndex(0);
                    }}
                    className={`py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      filterMode === "agreed"
                        ? "bg-teal-700 text-white"
                        : "bg-teal-50 text-teal-800 hover:bg-teal-100"
                    }`}
                  >
                    🔒 Ortak ({stats.agreedCount})
                  </button>
                  <button
                    onClick={() => {
                      setFilterMode("conflict");
                      setCurrentIndex(0);
                    }}
                    className={`py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      filterMode === "conflict"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                    }`}
                  >
                    ⚡ Uyuşmazlık ({stats.conflictCount})
                  </button>
                </div>
              </div>

              {/* 2. BEN VE ARKADAŞIMIN BU CV İÇİN DURUMU (ORTAK KARAR KUTUSU) */}
              <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Ortak Etiketleme Durumu (Ben &amp; Arkadaşım)
                  </span>
                  {currentItem.humanLabel?.consensusStatus === "agreed" && (
                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 text-[11px] font-bold">
                      🔒 İkiniz Aynı Girdiniz (Kesinleşti)
                    </span>
                  )}
                  {currentItem.humanLabel?.consensusStatus === "conflict" && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-bold">
                      ⚡ Farklı Girdiniz!
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div
                    className={`p-2.5 rounded-lg border ${
                      benVote
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "bg-zinc-50 text-zinc-500 border-zinc-200"
                    }`}
                  >
                    <div className="text-[10px] opacity-75 font-semibold">
                      📱 Ben (Berke):
                    </div>
                    <div className="font-bold mt-0.5">
                      {benVote
                        ? `${benVote.humanGender} • ${
                            benVote.humanAge !== null
                              ? `${benVote.humanAge} Yaş`
                              : "🚫 Yaş/Üni Tarihi Yok"
                          }`
                        : "Henüz girilmedi"}
                    </div>
                  </div>

                  <div
                    className={`p-2.5 rounded-lg border ${
                      arkVote
                        ? "bg-teal-800 text-white border-teal-800"
                        : "bg-zinc-50 text-zinc-500 border-zinc-200"
                    }`}
                  >
                    <div className="text-[10px] opacity-75 font-semibold">
                      💻 Arkadaşım:
                    </div>
                    <div className="font-bold mt-0.5">
                      {arkVote
                        ? `${arkVote.humanGender} • ${
                            arkVote.humanAge !== null
                              ? `${arkVote.humanAge} Yaş`
                              : "🚫 Yaş/Üni Tarihi Yok"
                          }`
                        : "Henüz girilmedi"}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. SENİN GERÇEK ETİKETİN (GROUND TRUTH GİRİŞ FORMU) */}
              <div className="bg-white border-2 border-teal-600 rounded-xl p-4 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-950">
                      1. {activeRater === "ben" ? "📱 Benim Cevabım" : "💻 Arkadaşımın Cevabı"}
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      Soldaki CV&apos;ye bakarak gerçek cinsiyet ve yaşı girip kaydedin
                    </p>
                  </div>
                  {currentItem.humanLabel?.votes?.[activeRater] && (
                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[11px] font-bold">
                      ✓ Sen Girdin
                    </span>
                  )}
                </div>

                {/* EKSTRA CASE UYARI KUTUSU: CV'de hem doğum tarihi hem üniversite giriş yılı yoksa */}
                {activeComparison?.isExtraCaseNoDate && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      📌 EKSTRA CASE: CV&apos;de Yaş ve Üniversite Giriş Tarihi Yok!
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      Bu aday CV&apos;sinde ne doğum tarihini ne de üniversite giriş/mezuniyet yılını belirtmiş. Aşağıdaki{" "}
                      <strong>&quot;🚫 Yaş &amp; Üni Tarihi Yok (Ekstra Case)&quot;</strong> butonuna basabilir veya AI&apos;ın ilk staj/iş yılından tahmin ettiği yaşı (~{currentItem.aiAge ?? 25}) onaylayabilirsiniz.
                    </p>
                  </div>
                )}

                {/* Ad Soyad */}
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

                {/* Gerçek Yaş Girişi + EKSTRA CASE (Yaş & Üni Tarihi Yok) Seçeneği */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-zinc-700">
                      Gerçek Yaş (2026 Güncel Yıl Bazlı) *
                    </label>
                    {inputAge.trim() === "" && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-bold">
                        🚫 Yaş &amp; Üni Tarihi Yok Seçili
                      </span>
                    )}
                  </div>
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
                      placeholder="🚫 Yaş & Üni Tarihi Yok"
                      className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-center text-base font-bold focus:outline-none focus:border-teal-600 placeholder:text-xs placeholder:font-semibold placeholder:text-amber-700"
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

                  {/* EKSTRA CASE BUTONLARI: Yaş & Üni Tarihi Yok */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setInputAge("")}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        inputAge.trim() === ""
                          ? "bg-amber-600 border-amber-600 text-white shadow-2xs"
                          : "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
                      }`}
                    >
                      🚫 Yaş &amp; Üni Tarihi Yok Seç
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setInputAge("");
                        handleSaveLabel(inputGender, "", true);
                      }}
                      className="py-2 px-3 rounded-lg border border-zinc-900 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      ⚡ Yaş/Üni Yok Olarak Kaydet &amp; Geç
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
                    {saving
                      ? "Ortak Buluta Kaydediliyor..."
                      : `Kaydet (${
                          activeRater === "ben" ? "Ben" : "Arkadaşım"
                        }) ve Sonrakine Geç`}
                  </button>

                  {saveMessage && (
                    <div className="text-xs font-semibold text-teal-800 text-center">
                      {saveMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. AI CEVABI İLE SİZİN CEVABINIZIN KARŞILAŞTIRMASI */}
              <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  2. Bu CV İçin AI Cevabı vs. Sizin Cevabınız
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
                      AI Cinsiyet:{" "}
                      <strong className="underline">{currentItem.aiGender}</strong>
                    </span>
                    <span>
                      Sizin Kararınız:{" "}
                      <strong className="underline">
                        {activeComparison?.compareGender}
                      </strong>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600">
                      {currentItem.aiGenderReason}
                    </span>
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
                        {activeComparison?.isExtraCaseNoDate
                          ? `Ekstra Case (~${currentItem.aiAge ?? "?"} Yaş)`
                          : currentItem.aiAge !== null
                          ? `${currentItem.aiAge} Yaş`
                          : "Belirsiz"}
                      </strong>
                    </span>
                    <span>
                      Sizin Kararınız:{" "}
                      <strong className="underline">
                        {activeComparison?.compareAge !== null
                          ? `${activeComparison?.compareAge} Yaş`
                          : "🚫 Yaş & Üni Tarihi Yok"}
                      </strong>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600">{currentItem.aiAgeReason}</span>
                    {activeComparison?.ageDiff === 0 ? (
                      <span className="text-teal-700 font-bold flex items-center gap-1 shrink-0 ml-2">
                        <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                        {activeComparison?.compareAge === null
                          ? "EKSTRA CASE DOĞRU"
                          : "TAM İSABET"}
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

        {/* ALT TABLO: ETİKETLENEN TÜM CV'LER, BEN VS ARKADAŞIM VE AI KARŞILAŞTIRMA ÖZETİ */}
        {stats.totalAnyLabeled > 0 && (
          <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-zinc-950">
                  Canlı Ortak Etiketleme Tablosu ({stats.totalAnyLabeled} CV Etiketlendi •{" "}
                  {stats.agreedCount} Ortak Kesinleşti)
                </h3>
              </div>
              <span className="text-xs text-zinc-500">
                Telefon ve Evdeki Bilgisayar ortak bulut üzerinden otomatik eşitlenir
              </span>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-zinc-100 text-zinc-600 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">#</th>
                    <th className="py-2.5 px-3 font-semibold">Dosya / Aday</th>
                    <th className="py-2.5 px-3 font-semibold">📱 Ben</th>
                    <th className="py-2.5 px-3 font-semibold">💻 Arkadaşım</th>
                    <th className="py-2.5 px-3 font-semibold">Ortak Durum</th>
                    <th className="py-2.5 px-3 font-semibold">AI Tahmini</th>
                    <th className="py-2.5 px-3 font-semibold">AI Sonucu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items
                    .filter((it) => it.humanLabel !== null)
                    .map((it) => {
                      const lbl = it.humanLabel!;
                      const vB = lbl.votes?.ben;
                      const vA = lbl.votes?.arkadasim;
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
                          <td className="py-2 px-3 font-mono text-zinc-500">
                            #{it.index}
                          </td>
                          <td className="py-2 px-3 font-medium text-zinc-900">
                            {lbl.humanName || it.aiName}{" "}
                            <span className="text-zinc-400 font-normal">
                              ({it.fileName})
                            </span>
                          </td>
                          <td className="py-2 px-3 font-semibold">
                            {vB
                              ? `${vB.humanGender}, ${vB.humanAge ?? "—"}`
                              : "—"}
                          </td>
                          <td className="py-2 px-3 font-semibold text-teal-800">
                            {vA
                              ? `${vA.humanGender}, ${vA.humanAge ?? "—"}`
                              : "—"}
                          </td>
                          <td className="py-2 px-3">
                            {lbl.consensusStatus === "agreed" ? (
                              <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-bold">
                                🔒 İkisi Aynı (Kesin)
                              </span>
                            ) : lbl.consensusStatus === "conflict" ? (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                                ⚡ Farklı Girildi
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium">
                                ⏳ Tek Kişi Girdi
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {it.aiGender}, {it.aiAge ?? "—"}
                          </td>
                          <td className="py-2 px-3">
                            {lbl.consensusStatus === "conflict" ? (
                              <span className="text-amber-700 font-semibold">
                                Uzlaşma Bekleniyor
                              </span>
                            ) : gOk && aOk ? (
                              <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                                ✓ AI Doğru {aDiff === 1 ? "(±1)" : ""}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">
                                ✗ AI Yanıldı
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
