"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Sliders,
} from "lucide-react";
import {
  isSameUniversity,
  isSameDepartment,
  isSameDegree,
} from "@/lib/cvEngine";
import { cleanCriterionDisplayValue } from "@/lib/criteriaCatalog";

interface GroundTruthLabel {
  fileName: string;
  humanName?: string;
  humanGender: "Kadın" | "Erkek" | "Belirsiz";
  humanAge: number | null;
  humanUniversity?: string | null;
  humanDepartment?: string | null;
  humanDegree?: string | null;
  updatedAt: string;
}

interface BenchmarkCVItem {
  index: number;
  fileName: string;
  rawText: string;
  aiName: string;
  aiGender: "Kadın" | "Erkek" | "Belirsiz";
  aiAge: number | null;
  aiAgeMethod: string;
  aiUniversity: string;
  aiAllUniversities: string[];
  aiDepartment: string;
  aiAllDepartments: string[];
  aiDegree: string;
  aiAllDegrees: string[];
  humanLabel: GroundTruthLabel | null;
}

export default function BasarilarPage() {
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [currentIp, setCurrentIp] = useState<string>("");
  const [secretClickCount, setSecretClickCount] = useState<number>(0);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState<string>("");
  const [replaceOldIps, setReplaceOldIps] = useState<boolean>(true);
  const [recoveryError, setRecoveryError] = useState<string>("");

  const [items, setItems] = useState<BenchmarkCVItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const authRes = await fetch(
        `/api/admin-auth?path=/gizlilabel/basarilar&t=${Date.now()}`,
        { cache: "no-store" }
      );
      const authData = await authRes.json();
      setCurrentIp(authData?.currentIp || "");
      if (!authRes.ok || !authData?.authorized) {
        setIsAuthorized(false);
        setAuthChecking(false);
        setLoading(false);
        return;
      }
      setIsAuthorized(true);
      setAuthChecking(false);

      const res = await fetch(`/api/ground-truth?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "x-gizli-label-access": "internal-gizlilabel-v1" },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.items)) {
          setItems(data.items);
        }
      }
    } catch {
      setIsAuthorized(false);
    } finally {
      setAuthChecking(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("kurtar=1")
    ) {
      setSecretClickCount(5);
    }
  }, [loadData]);

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
      await loadData();
    } catch {
      setRecoveryError("Bağlantı hatası oluştu.");
    }
  };

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
        uniLabeledCount: 0,
        uniCorrect: 0,
        uniAccuracy: 0,
        deptLabeledCount: 0,
        deptCorrect: 0,
        deptAccuracy: 0,
        degLabeledCount: 0,
        degCorrect: 0,
        degAccuracy: 0,
        overallAccuracy: 0,
      };
    }

    let genderCorrect = 0;
    let ageLabeledCount = 0;
    let ageExactCorrect = 0;
    let ageCloseCorrect = 0;
    let uniLabeledCount = 0;
    let uniCorrect = 0;
    let deptLabeledCount = 0;
    let deptCorrect = 0;
    let degLabeledCount = 0;
    let degCorrect = 0;

    for (const it of labeled) {
      const lbl = it.humanLabel!;
      if (it.aiGender === lbl.humanGender) genderCorrect++;

      ageLabeledCount++;
      if (lbl.humanAge !== null) {
        const diff =
          it.aiAge !== null ? Math.abs(it.aiAge - lbl.humanAge) : 999;
        if (diff === 0) ageExactCorrect++;
        if (diff <= 1) ageCloseCorrect++;
      } else {
        const aiAlsoMissing =
          it.aiAge === null ||
          it.aiAgeMethod === "İlk İş Deneyimi Tahmini" ||
          it.aiAgeMethod === "Bilinmiyor";
        if (aiAlsoMissing) {
          ageExactCorrect++;
          ageCloseCorrect++;
        }
      }

      const cleanUni = cleanCriterionDisplayValue(lbl.humanUniversity);
      if (cleanUni !== "-") {
        uniLabeledCount++;
        if (
          isSameUniversity(
            it.aiUniversity,
            cleanUni,
            it.aiAllUniversities || []
          )
        ) {
          uniCorrect++;
        }
      }

      const cleanDept = cleanCriterionDisplayValue(lbl.humanDepartment);
      if (cleanDept !== "-") {
        deptLabeledCount++;
        if (
          isSameDepartment(
            it.aiDepartment,
            cleanDept,
            it.aiAllDepartments || []
          )
        ) {
          deptCorrect++;
        }
      }

      const cleanDeg = cleanCriterionDisplayValue(lbl.humanDegree);
      if (cleanDeg !== "-") {
        degLabeledCount++;
        if (isSameDegree(it.aiDegree, cleanDeg, it.aiAllDegrees || [])) {
          degCorrect++;
        }
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
    const uniAccuracy =
      uniLabeledCount > 0
        ? Number(((uniCorrect / uniLabeledCount) * 100).toFixed(1))
        : 100;
    const deptAccuracy =
      deptLabeledCount > 0
        ? Number(((deptCorrect / deptLabeledCount) * 100).toFixed(1))
        : 100;
    const degAccuracy =
      degLabeledCount > 0
        ? Number(((degCorrect / degLabeledCount) * 100).toFixed(1))
        : 100;

    const activeMetrics = [genderAccuracy, ageCloseAccuracy];
    if (uniLabeledCount > 0) activeMetrics.push(uniAccuracy);
    if (deptLabeledCount > 0) activeMetrics.push(deptAccuracy);
    if (degLabeledCount > 0) activeMetrics.push(degAccuracy);

    const overallAccuracy = Number(
      (
        activeMetrics.reduce((acc, v) => acc + v, 0) / activeMetrics.length
      ).toFixed(1)
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
      uniLabeledCount,
      uniCorrect,
      uniAccuracy,
      deptLabeledCount,
      deptCorrect,
      deptAccuracy,
      degLabeledCount,
      degCorrect,
      degAccuracy,
      overallAccuracy,
    };
  }, [items]);

  const handleExportLabelsJson = () => {
    const map: Record<string, GroundTruthLabel> = {};
    for (const it of items) {
      if (it.humanLabel) {
        map[it.fileName] = it.humanLabel;
      }
    }
    const blob = new Blob([JSON.stringify(map, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ground-truth-labels.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#141c2b] text-[#f0ece1] flex items-center justify-center text-sm font-mono-academic">
        Yükleniyor...
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#141c2b] text-[#f0ece1] flex flex-col items-center justify-center p-6 select-none">
        <div className="max-w-md w-full text-center space-y-4">
          <div
            onClick={() => setSecretClickCount((c) => c + 1)}
            className="text-6xl font-serif-academic font-bold text-[#93c5fd] cursor-default"
          >
            404
          </div>
          <h1 className="text-xl font-bold">Sayfa Bulunamadı</h1>
          <p className="text-xs text-[#9ca3af] leading-relaxed">
            Aradığınız sayfa mevcut değil veya erişim yetkiniz bulunmuyor.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#212f47] hover:bg-[#2c3e5e] text-xs font-bold text-[#f0ece1]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Ana Sayfaya Dön
            </Link>
          </div>

          {secretClickCount >= 3 && (
            <form
              onSubmit={handleRecoverySubmit}
              className="mt-6 p-5 rounded-xl bg-[#182235] border border-[#384966] text-left space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono-academic font-bold uppercase tracking-wider text-[#eab308]">
                  YENİ IP TANIMLAMA
                </span>
                <span className="text-[10px] font-mono-academic text-[#93c5fd]">
                  IP: {currentIp || "-"}
                </span>
              </div>
              <input
                type="password"
                required
                value={recoveryKeyInput}
                onChange={(e) => setRecoveryKeyInput(e.target.value)}
                placeholder="Kurtarma Anahtarı"
                className="w-full px-3 py-2 rounded-lg bg-[#111927] border border-[#33435e] text-xs text-white focus:outline-none focus:border-[#eab308]"
              />
              <label className="flex items-center gap-2 text-xs text-[#d2ccc0] cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceOldIps}
                  onChange={(e) => setReplaceOldIps(e.target.checked)}
                />
                Eski IP&apos;leri sil, sadece bu IP&apos;ye ({currentIp}) kilitle
              </label>
              {recoveryError && (
                <div className="text-xs text-red-400 font-semibold">
                  {recoveryError}
                </div>
              )}
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-[#eab308] text-[#182235] font-bold text-xs cursor-pointer hover:bg-[#fde047]"
              >
                Yetkilendir ve Aç
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#cfc8b8] text-[#141c2b]">
      {/* ÜST BAR */}
      <header className="bg-[#182235] border-b border-[#2c3a52] sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/gizlilabel"
              className="px-3 py-1.5 rounded-lg border border-[#384966] bg-[#212f47] hover:bg-[#2a3b57] text-xs font-semibold text-[#f0ece1] flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#93c5fd]" />
              Etiketleme Ekranı (/gizlilabel)
            </Link>

            <Link
              href="/gizlilabel/kriterler"
              className="px-3 py-1.5 rounded-lg border border-[#384966] bg-[#212f47] hover:bg-[#2a3b57] text-xs font-semibold text-[#f0ece1] flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-[#eab308]" />
              100 Alan Matrisi (/gizlilabel/kriterler)
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="px-3 py-1.5 rounded-lg bg-[#e2dcd0] text-[#182235] text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Etiketlenen: {stats.totalLabeled} / {items.length} CV
            </div>

            <button
              type="button"
              onClick={loadData}
              className="p-2 rounded-lg border border-[#33435e] bg-[#212f47] hover:bg-[#2a3b57] text-[#d2ccc0] cursor-pointer"
              title="Yenile"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>

            {stats.totalLabeled > 0 && (
              <button
                type="button"
                onClick={handleExportLabelsJson}
                className="px-3 py-1.5 rounded-lg bg-[#eab308] hover:bg-[#fde047] text-[#182235] text-xs font-bold cursor-pointer"
              >
                JSON İndir
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ANA İÇERİK */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="font-serif-academic text-2xl font-bold text-[#121926]">
            Başarı Oranları & Doğrulama Tablosu
          </h1>
          <p className="text-xs text-[#3b4454] mt-1">
            Etiketlenen özgeçmişler üzerinden hesaplanan doğruluk oranları ve
            kayıtların tam listesi.
          </p>
        </div>

        {/* 6 BAŞARI KARTI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-[#182235] text-[#f0ece1] border border-[#2c3a52]">
            <div className="text-[11px] uppercase tracking-wider text-[#eab308] font-bold">
              Genel Başarı
            </div>
            <div className="text-2xl font-extrabold mt-1">
              {stats.totalLabeled === 0 ? "-" : `%${stats.overallAccuracy}`}
            </div>
            <div className="text-[11px] text-[#9ca3af] mt-0.5">
              {stats.totalLabeled} / {items.length} CV
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#e2dcd0] border border-[#b8b0a0]">
            <div className="text-[11px] uppercase tracking-wider text-[#3b4454] font-bold">
              Cinsiyet
            </div>
            <div className="text-2xl font-extrabold text-[#121926] mt-1">
              {stats.totalLabeled === 0 ? "-" : `%${stats.genderAccuracy}`}
            </div>
            <div className="text-[11px] text-[#4a5363] mt-0.5">
              {stats.genderCorrect} / {stats.totalLabeled} doğru
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#e2dcd0] border border-[#b8b0a0]">
            <div className="text-[11px] uppercase tracking-wider text-[#3b4454] font-bold">
              Yaş (Tam / ±1)
            </div>
            <div className="text-xl font-extrabold text-[#121926] mt-1">
              {stats.ageLabeledCount === 0
                ? "-"
                : `%${stats.ageExactAccuracy} / %${stats.ageCloseAccuracy}`}
            </div>
            <div className="text-[11px] text-[#4a5363] mt-0.5">
              {stats.ageExactCorrect} / {stats.ageLabeledCount} tam
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#e2dcd0] border border-[#b8b0a0]">
            <div className="text-[11px] uppercase tracking-wider text-[#3b4454] font-bold">
              Üniversite
            </div>
            <div className="text-2xl font-extrabold text-[#121926] mt-1">
              {stats.uniLabeledCount === 0 ? "-" : `%${stats.uniAccuracy}`}
            </div>
            <div className="text-[11px] text-[#4a5363] mt-0.5">
              {stats.uniCorrect} / {stats.uniLabeledCount} doğru
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#e2dcd0] border border-[#b8b0a0]">
            <div className="text-[11px] uppercase tracking-wider text-[#3b4454] font-bold">
              Bölüm
            </div>
            <div className="text-2xl font-extrabold text-[#121926] mt-1">
              {stats.deptLabeledCount === 0 ? "-" : `%${stats.deptAccuracy}`}
            </div>
            <div className="text-[11px] text-[#4a5363] mt-0.5">
              {stats.deptCorrect} / {stats.deptLabeledCount} doğru
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#e2dcd0] border border-[#b8b0a0]">
            <div className="text-[11px] uppercase tracking-wider text-[#3b4454] font-bold">
              Eğitim Derecesi
            </div>
            <div className="text-2xl font-extrabold text-[#121926] mt-1">
              {stats.degLabeledCount === 0 ? "-" : `%${stats.degAccuracy}`}
            </div>
            <div className="text-[11px] text-[#4a5363] mt-0.5">
              {stats.degCorrect} / {stats.degLabeledCount} doğru
            </div>
          </div>
        </div>

        {/* ETİKETLENEN CV'LER TABLOSU */}
        <section className="bg-[#e2dcd0] border border-[#b8b0a0] rounded-xl overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-[#c4bdb0] bg-[#d6cfc0] flex items-center justify-between">
            <h2 className="font-serif-academic text-sm font-bold text-[#121926]">
              Etiketlenen Özgeçmişler ({stats.totalLabeled})
            </h2>
            <span className="text-xs text-[#3b4454]">
              Yok olan alanlar &ldquo;-&rdquo; olarak gösterilir
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#182235] text-[#f0ece1]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">#</th>
                  <th className="py-2.5 px-3 font-semibold">Dosya / Aday</th>
                  <th className="py-2.5 px-3 font-semibold">
                    Kaydedilen Etiket (Cinsiyet / Yaş / Okul / Bölüm / Derece)
                  </th>
                  <th className="py-2.5 px-3 font-semibold">
                    Sistem Çıkarımı
                  </th>
                  <th className="py-2.5 px-3 font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c4bdb0]">
                {items
                  .filter((it) => it.humanLabel !== null)
                  .map((it) => {
                    const lbl = it.humanLabel!;
                    const hUni = cleanCriterionDisplayValue(lbl.humanUniversity);
                    const hDept = cleanCriterionDisplayValue(lbl.humanDepartment);
                    const hDeg = cleanCriterionDisplayValue(lbl.humanDegree);
                    const aiUni = cleanCriterionDisplayValue(it.aiUniversity);
                    const aiDept = cleanCriterionDisplayValue(it.aiDepartment);
                    const aiDeg = cleanCriterionDisplayValue(it.aiDegree);

                    const gOk = it.aiGender === lbl.humanGender;
                    const aDiff =
                      lbl.humanAge !== null && it.aiAge !== null
                        ? Math.abs(it.aiAge - lbl.humanAge)
                        : 0;
                    const aOk = lbl.humanAge === null || aDiff <= 1;
                    const uOk =
                      hUni === "-" ||
                      isSameUniversity(
                        it.aiUniversity,
                        hUni,
                        it.aiAllUniversities || []
                      );
                    const dOk =
                      hDept === "-" ||
                      isSameDepartment(
                        it.aiDepartment,
                        hDept,
                        it.aiAllDepartments || []
                      );
                    const degOk =
                      hDeg === "-" ||
                      isSameDegree(it.aiDegree, hDeg, it.aiAllDegrees || []);

                    return (
                      <tr
                        key={it.fileName}
                        className="hover:bg-[#d6cfc0] transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono-academic text-[#4a5363]">
                          #{it.index}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#121926]">
                          <Link
                            href={`/gizlilabel?cv=${it.index - 1}`}
                            className="hover:underline"
                          >
                            {lbl.humanName || it.aiName}{" "}
                            <span className="text-[#4a5363] font-normal">
                              ({it.fileName})
                            </span>
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#121926]">
                          {lbl.humanGender} • {lbl.humanAge ?? "-"} • {hUni} •{" "}
                          {hDept} • {hDeg}
                        </td>
                        <td className="py-2.5 px-3 text-[#273142]">
                          {it.aiGender} • {it.aiAge ?? "-"} • {aiUni} • {aiDept}{" "}
                          • {aiDeg}
                        </td>
                        <td className="py-2.5 px-3">
                          {gOk && aOk && uOk && dOk && degOk ? (
                            <span className="px-2 py-0.5 rounded bg-[#182235] text-[#f0ece1] font-bold">
                              ✓ Eşleşti
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-red-900/20 text-red-950 font-bold">
                              ✗ Fark Var
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
      </main>
    </div>
  );
}
