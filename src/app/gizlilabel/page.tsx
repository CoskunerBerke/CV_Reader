"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Check,
  FileText,
  Eye,
  ArrowLeft,
  RefreshCw,
  Lock,
  Sliders,
  BarChart3,
  Search,
  Plus,
} from "lucide-react";
import { EducationByDegreeMap } from "@/lib/cvEngine";
import {
  CRITERIA_CATEGORIES,
  INITIAL_100_CRITERIA,
  CriterionDefinition,
  CriterionAccessTier,
  extractAll100ValuesFromCV,
  cleanCriterionDisplayValue,
} from "@/lib/criteriaCatalog";

type RaterId = "ben" | "arkadasim";

interface SingleRaterVote {
  rater: RaterId;
  humanName?: string;
  humanGender: "Kadın" | "Erkek" | "Belirsiz";
  humanAge: number | null;
  humanUniversity?: string | null;
  humanDepartment?: string | null;
  humanDegree?: string | null;
  updatedAt: string;
}

interface GroundTruthLabel {
  fileName: string;
  humanName?: string;
  humanGender: "Kadın" | "Erkek" | "Belirsiz";
  humanAge: number | null;
  humanUniversity?: string | null;
  humanDepartment?: string | null;
  humanDegree?: string | null;
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
  aiUniversity: string;
  aiAllUniversities: string[];
  aiDepartment: string;
  aiAllDepartments: string[];
  aiDegree: string;
  aiAllDegrees: string[];
  aiEducationByDegree?: EducationByDegreeMap;
  aiEducationSummary: string;
  humanLabel: GroundTruthLabel | null;
}

const CUSTOM_CRITERIA_STORAGE_KEY = "cv_custom_criteria_definitions_v4";
const CV_100_LABELS_STORAGE_KEY = "cv_100_criteria_labels_by_file_v4";

// Etiketleme panelinde "Temel Alanlar" sekmesinde ilk gösterilecek 16 anahtar alan (Üniversite ve Bölüm yan yana)
const CORE_FIELD_IDS = new Set([
  "c001", // #001 Ad Soyad
  "c002", // #002 Yaş
  "c003", // #003 Cinsiyet
  "c005", // #005 İkamet Şehri
  "c011", // #011 Lisans Üniversitesi
  "c012", // #012 Lisans Bölümü
  "c016", // #016 Ön Lisans Üniversitesi
  "c017", // #017 Ön Lisans Bölümü
  "c021", // #021 Yüksek Lisans Üniversitesi
  "c022", // #022 Yüksek Lisans Bölümü
  "c026", // #026 Doktora (Ph.D.) Üniversitesi
  "c027", // #027 Doktora (Ph.D.) Bölümü
  "c031", // #031 Meslek / Uzmanlık Unvanı
  "c032", // #032 Toplam İş Deneyimi (Yıl)
  "c043", // #043 İngilizce Seviyesi
  "c055", // #055 Python & Veri Bilimi Araçları
]);

export default function GroundTruthLabelerPage() {
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [currentIp, setCurrentIp] = useState<string>("");
  const [allowedIps, setAllowedIps] = useState<string[]>([]);
  const [accessLogs, setAccessLogs] = useState<
    {
      id: string;
      ip: string;
      status:
        | "blocked"
        | "authorized"
        | "auto_recovered"
        | "key_recovered"
        | "failed_key";
      targetPath: string;
      userAgent: string;
      location: string;
      timestamp: string;
    }[]
  >([]);
  const [autoRecoveredNote, setAutoRecoveredNote] = useState<string>("");
  const [secretClickCount, setSecretClickCount] = useState<number>(0);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState<string>("");
  const [replaceOldIps, setReplaceOldIps] = useState<boolean>(true);
  const [recoveryError, setRecoveryError] = useState<string>("");
  const [isIpModalOpen, setIsIpModalOpen] = useState<boolean>(false);
  const [customIpInput, setCustomIpInput] = useState<string>("");
  const [ipActionMessage, setIpActionMessage] = useState<string>("");

  const [items, setItems] = useState<BenchmarkCVItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveNote, setSaveNote] = useState<string>("");
  const [viewMode, setViewMode] = useState<"pdf" | "text">("pdf");
  const [filterMode, setFilterMode] = useState<"all" | "my_unlabeled">("all");

  // 100+ Alan Etiketleme Durumu (Sağ Panelde 100 Alana Kadar Ölçeklenen Mimari)
  const [criteriaList, setCriteriaList] =
    useState<CriterionDefinition[]>(INITIAL_100_CRITERIA);
  const [cvValuesMap, setCvValuesMap] = useState<
    Record<string, Record<string, string>>
  >({});
  const [fieldCategoryFilter, setFieldCategoryFilter] =
    useState<string>("core");
  const [fieldSearchQuery, setFieldSearchQuery] = useState<string>("");
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] =
    useState<boolean>(false);
  const [newFieldLabel, setNewFieldLabel] = useState<string>("");
  const [newFieldCategory, setNewFieldCategory] =
    useState<string>("meslek_deneyim");
  const [newFieldTier, setNewFieldTier] =
    useState<CriterionAccessTier>("premium");

  // CV Kasası & Talepler Modalı
  const [isVaultModalOpen, setIsVaultModalOpen] = useState<boolean>(false);
  const [vaultTab, setVaultTab] = useState<"cvs" | "leads">("cvs");
  const [vaultCvs, setVaultCvs] = useState<
    {
      id: string;
      fileName: string;
      fullName: string;
      gender: string;
      age: number | null;
      ageMethod: string;
      hasBachelor: boolean;
      university: string;
      department: string;
      degree: string;
      educationByDegree?: EducationByDegreeMap;
      city: string;
      rawText: string;
      uploadedAt: string;
    }[]
  >([]);
  const [vaultLeads, setVaultLeads] = useState<
    {
      id: string;
      fullName: string;
      companyName: string;
      contactInfo: string;
      requestedFeature: string;
      message: string;
      createdAt: string;
    }[]
  >([]);

  const isRaterFullyDone = useCallback((it: BenchmarkCVItem) => {
    const v = it.humanLabel?.votes?.ben || it.humanLabel;
    return !!(v && v.humanUniversity && v.humanDepartment && v.humanDegree);
  }, []);

  useEffect(() => {
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
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("kurtar=1")
    ) {
      setSecretClickCount(5);
    }
  }, []);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setAuthChecking(true);
    } else {
      setSyncing(true);
    }
    try {
      const authRes = await fetch(
        `/api/admin-auth?path=/gizlilabel&silent=${
          silent ? "1" : "0"
        }&t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );
      const authData = await authRes.json();
      setCurrentIp(authData?.currentIp || "");

      if (!authRes.ok || !authData?.authorized) {
        setIsAuthorized(false);
        setAuthChecking(false);
        setLoading(false);
        setSyncing(false);
        return;
      }

      setIsAuthorized(true);
      setAllowedIps(authData?.allowedIps || []);
      if (Array.isArray(authData?.accessLogs)) {
        setAccessLogs(authData.accessLogs);
      }
      if (authData?.autoRecovered && authData?.note) {
        setAutoRecoveredNote(authData.note);
      }
      setAuthChecking(false);

      const [res, vaultRes] = await Promise.all([
        fetch(`/api/ground-truth?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "x-gizli-label-access": "internal-gizlilabel-v1",
          },
        }),
        fetch(`/api/vault?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "x-gizli-label-access": "internal-gizlilabel-v1",
          },
        }),
      ]);
      if (vaultRes.ok) {
        const vData = await vaultRes.json();
        if (Array.isArray(vData?.cvs)) setVaultCvs(vData.cvs);
        if (Array.isArray(vData?.leads)) setVaultLeads(vData.leads);
      }
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
        if (!silent) {
          if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const cvParam = params.get("cv");
            if (cvParam !== null) {
              const idx = parseInt(cvParam, 10);
              if (!isNaN(idx) && idx >= 0 && idx < data.items.length) {
                setCurrentIndex(idx);
                return;
              }
            }
          }
          const firstUnlabeledIdx = (
            data.items as BenchmarkCVItem[]
          ).findIndex((it) => {
            const v = it.humanLabel?.votes?.ben || it.humanLabel;
            return !(
              v &&
              v.humanUniversity &&
              v.humanDepartment &&
              v.humanDegree
            );
          });
          if (firstUnlabeledIdx !== -1) {
            setCurrentIndex(firstUnlabeledIdx);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      if (!silent) {
        setLoading(false);
        setAuthChecking(false);
      } else {
        setSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  useEffect(() => {
    if (!isAuthorized) return;
    const timer = setInterval(() => {
      fetchAll(true);
    }, 6000);
    return () => clearInterval(timer);
  }, [isAuthorized, fetchAll]);

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
      await fetchAll(false);
    } catch {
      setRecoveryError("Bağlantı hatası oluştu.");
    }
  };

  const handleLockToCurrentWifiIp = async () => {
    setIpActionMessage("");
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lock_to_current_ip",
        }),
      });
      const data = await res.json();
      if (res.ok && data?.allowedIps) {
        setAllowedIps(data.allowedIps);
        setIpActionMessage(
          data.note || `Sadece mevcut IP adresinize (${currentIp}) kilitlendi.`
        );
      }
    } catch {
      setIpActionMessage("İşlem sırasında hata oluştu.");
    }
  };

  const handleAddCustomIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customIpInput.trim()) return;
    setIpActionMessage("");
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_custom_ip",
          customIp: customIpInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data?.allowedIps) {
        setAllowedIps(data.allowedIps);
        if (Array.isArray(data?.accessLogs)) setAccessLogs(data.accessLogs);
        setCustomIpInput("");
        setIpActionMessage(data.note || "Yeni IP eklendi.");
      }
    } catch {
      setIpActionMessage("IP eklenemedi.");
    }
  };

  const handleClearAccessLogs = async () => {
    setIpActionMessage("");
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_access_logs",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAccessLogs(data?.accessLogs || []);
        setIpActionMessage("Giriş kayıtları temizlendi.");
      }
    } catch {
      setIpActionMessage("Kayıtlar temizlenemedi.");
    }
  };

  const filteredItems = useMemo(() => {
    if (filterMode === "my_unlabeled") {
      return items.filter((it) => !isRaterFullyDone(it));
    }
    return items;
  }, [items, filterMode, isRaterFullyDone]);

  const currentItem = filteredItems[currentIndex] || filteredItems[0] || null;

  // Seçili CV için 100 alanın değerlerini hesapla (varsa direkt ne olduğu, yoksa '-')
  const activeCvValues = useMemo(() => {
    if (!currentItem) return {};
    const autoExtracted = extractAll100ValuesFromCV(
      currentItem.rawText,
      currentItem.fileName
    );
    const lbl = currentItem.humanLabel?.votes?.ben || currentItem.humanLabel;
    if (lbl) {
      if (lbl.humanName) {
        autoExtracted.c001 = cleanCriterionDisplayValue(lbl.humanName);
      }
      if (lbl.humanAge !== null) {
        autoExtracted.c002 = String(lbl.humanAge);
      } else {
        autoExtracted.c002 = "-";
      }
      if (lbl.humanGender) {
        autoExtracted.c003 = cleanCriterionDisplayValue(lbl.humanGender);
      }
      const cleanU = cleanCriterionDisplayValue(lbl.humanUniversity);
      if (cleanU !== "-") {
        for (const rawPart of cleanU.split("|")) {
          const part = rawPart.trim();
          if (!part) continue;
          if (/^ön\s*lisans\s*:/i.test(part)) {
            autoExtracted.c016 = cleanCriterionDisplayValue(
              part.replace(/^ön\s*lisans\s*:\s*/i, "")
            );
          } else if (/^(?:master|yüksek\s*lisans)\s*:/i.test(part)) {
            autoExtracted.c021 = cleanCriterionDisplayValue(
              part.replace(/^(?:master|yüksek\s*lisans)\s*:\s*/i, "")
            );
          } else if (/^(?:doktora|ph\.?d\.?)\s*:/i.test(part)) {
            autoExtracted.c026 = cleanCriterionDisplayValue(
              part.replace(/^(?:doktora|ph\.?d\.?)\s*:\s*/i, "")
            );
          } else {
            autoExtracted.c011 = cleanCriterionDisplayValue(
              part.replace(/^lisans\s*:\s*/i, "")
            );
          }
        }
      }
      const cleanD = cleanCriterionDisplayValue(lbl.humanDepartment);
      if (cleanD !== "-") {
        for (const rawPart of cleanD.split("|")) {
          const part = rawPart.trim();
          if (!part) continue;
          if (/^ön\s*lisans\s*:/i.test(part)) {
            autoExtracted.c017 = cleanCriterionDisplayValue(
              part.replace(/^ön\s*lisans\s*:\s*/i, "")
            );
          } else if (/^(?:master|yüksek\s*lisans)\s*:/i.test(part)) {
            autoExtracted.c022 = cleanCriterionDisplayValue(
              part.replace(/^(?:master|yüksek\s*lisans)\s*:\s*/i, "")
            );
          } else if (/^(?:doktora|ph\.?d\.?)\s*:/i.test(part)) {
            autoExtracted.c027 = cleanCriterionDisplayValue(
              part.replace(/^(?:doktora|ph\.?d\.?)\s*:\s*/i, "")
            );
          } else {
            autoExtracted.c012 = cleanCriterionDisplayValue(
              part.replace(/^lisans\s*:\s*/i, "")
            );
          }
        }
      }
    }

    const savedForFile = cvValuesMap[currentItem.fileName] || {};
    const merged: Record<string, string> = { ...autoExtracted };
    for (const [k, v] of Object.entries(savedForFile)) {
      merged[k] = v;
    }
    return merged;
  }, [currentItem, cvValuesMap]);

  const handleUpdateFieldValue = (critId: string, val: string) => {
    if (!currentItem) return;
    setCvValuesMap((prev) => {
      const next = {
        ...prev,
        [currentItem.fileName]: {
          ...(prev[currentItem.fileName] || {}),
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

  const visibleCriteriaInRightPanel = useMemo(() => {
    return criteriaList.filter((c) => {
      if (fieldSearchQuery.trim() !== "") {
        const q = fieldSearchQuery.toLocaleLowerCase("tr-TR");
        return (
          c.label.toLocaleLowerCase("tr-TR").includes(q) ||
          c.shortDesc.toLocaleLowerCase("tr-TR").includes(q) ||
          c.code.includes(q) ||
          c.categoryLabel.toLocaleLowerCase("tr-TR").includes(q)
        );
      }
      if (fieldCategoryFilter === "core") {
        return CORE_FIELD_IDS.has(c.id);
      }
      if (fieldCategoryFilter === "all") {
        return true;
      }
      return c.categoryKey === fieldCategoryFilter;
    });
  }, [criteriaList, fieldCategoryFilter, fieldSearchQuery]);

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;
    const nextNum = criteriaList.length + 1;
    const code = String(nextNum).padStart(3, "0");
    const catObj =
      CRITERIA_CATEGORIES.find((c) => c.key === newFieldCategory) ||
      CRITERIA_CATEGORIES[3];

    const created: CriterionDefinition = {
      id: `c${code}_${Date.now().toString().slice(-3)}`,
      code,
      categoryKey: catObj.key,
      categoryLabel: catObj.label,
      label: newFieldLabel.trim(),
      shortDesc: "Varsa değerini yazın, yoksa -",
      tier: newFieldTier,
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
    setNewFieldLabel("");
    setIsAddFieldModalOpen(false);
    setFieldCategoryFilter("all");
  };

  const handleSaveAndNext = async (autoNext = true) => {
    if (!currentItem) return;
    setSaving(true);
    setSaveNote("");

    try {
      // Tüm 100 alanı normalize et: varsa değeri, yoksa '-'
      const normalizedForFile: Record<string, string> = {};
      for (const crit of criteriaList) {
        normalizedForFile[crit.id] = cleanCriterionDisplayValue(
          activeCvValues[crit.id]
        );
      }

      setCvValuesMap((prev) => {
        const next = {
          ...prev,
          [currentItem.fileName]: normalizedForFile,
        };
        try {
          localStorage.setItem(CV_100_LABELS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      const nameToSave =
        normalizedForFile.c001 !== "-"
          ? normalizedForFile.c001
          : currentItem.aiName;
      const genderToSave: "Kadın" | "Erkek" =
        normalizedForFile.c003 === "Kadın" ? "Kadın" : "Erkek";
      const ageRaw = normalizedForFile.c002;
      const parsedAge =
        ageRaw !== "-" && !Number.isNaN(Number(ageRaw))
          ? parseInt(ageRaw, 10)
          : null;

      // Üniversite & Bölüm birleştirme (varsa değeri, yoksa '-')
      const bscUni = normalizedForFile.c011;
      const bscDept = normalizedForFile.c012;
      const assocUni = normalizedForFile.c016;
      const assocDept = normalizedForFile.c017;
      const mscUni = normalizedForFile.c021;
      const mscDept = normalizedForFile.c022;
      const phdUni = normalizedForFile.c026;
      const phdDept = normalizedForFile.c027;

      const uniParts: string[] = [];
      const deptParts: string[] = [];
      const degParts: string[] = [];

      if (assocUni !== "-" || assocDept !== "-") {
        degParts.push("Ön Lisans (Associate)");
        if (assocUni !== "-") uniParts.push(`Ön Lisans: ${assocUni}`);
        if (assocDept !== "-") deptParts.push(`Ön Lisans: ${assocDept}`);
      }
      if (bscUni !== "-" || bscDept !== "-") {
        degParts.push("Lisans (Bachelor's)");
        if (bscUni !== "-") uniParts.push(bscUni);
        if (bscDept !== "-") deptParts.push(bscDept);
      }
      if (mscUni !== "-" || mscDept !== "-") {
        degParts.push("Yüksek Lisans (Master's)");
        if (mscUni !== "-") uniParts.push(`Master: ${mscUni}`);
        if (mscDept !== "-") deptParts.push(`Master: ${mscDept}`);
      }
      if (phdUni !== "-" || phdDept !== "-") {
        degParts.push("Doktora (Ph.D.)");
        if (phdUni !== "-") uniParts.push(`Doktora: ${phdUni}`);
        if (phdDept !== "-") deptParts.push(`Doktora: ${phdDept}`);
      }

      const uniToSave = uniParts.length > 0 ? uniParts.join(" | ") : "-";
      const deptToSave = deptParts.length > 0 ? deptParts.join(" | ") : "-";
      const degToSave = degParts.length > 0 ? degParts.join(" + ") : "-";

      const res = await fetch("/api/ground-truth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gizli-label-access": "internal-gizlilabel-v1",
        },
        body: JSON.stringify({
          fileName: currentItem.fileName,
          humanName: nameToSave,
          humanGender: genderToSave,
          humanAge: parsedAge,
          humanUniversity: uniToSave,
          humanDepartment: deptToSave,
          humanDegree: degToSave,
          rater: "ben",
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
        setSaveNote("✓ Kaydedildi");

        if (autoNext) {
          setTimeout(() => {
            setSaveNote("");
            if (filterMode === "all") {
              const nextUnlabeledAfter = updatedList.findIndex(
                (it, idx) => idx > currentIndex && !isRaterFullyDone(it)
              );
              if (nextUnlabeledAfter !== -1) {
                setCurrentIndex(nextUnlabeledAfter);
              } else {
                setCurrentIndex((prev) =>
                  Math.min(filteredItems.length - 1, prev + 1)
                );
              }
            } else {
              setCurrentIndex((prev) =>
                Math.min(filteredItems.length - 1, prev + 1)
              );
            }
          }, 150);
        }
      }
    } catch {
      setSaveNote("Kaydedilirken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const labeledCount = useMemo(
    () => items.filter((i) => isRaterFullyDone(i)).length,
    [items, isRaterFullyDone]
  );

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#182235] text-[#f0ece1] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-sm text-[#d2ccc0]">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // YETKİSİZ IP İSE DÜMDÜZ 404 GÖSTER
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#141c2b] text-[#f0ece1] flex flex-col items-center justify-center p-6 select-none">
        <div className="max-w-md w-full text-center space-y-4">
          <div
            onClick={() => setSecretClickCount((c) => c + 1)}
            className="text-6xl font-serif-academic font-bold text-[#93c5fd] cursor-default"
            title="404"
          >
            404
          </div>
          <h1 className="text-xl font-bold">
            Sayfa Bulunamadı / Page Not Found
          </h1>
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
                Eski IP&apos;leri sil, sadece şu anki IP&apos;me ({currentIp})
                kilitle
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
                Yeni IP&apos;mi Yetkilendir ve Aç
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#cbc4b4] text-[#141c2b] overflow-x-hidden">
      {/* ÜST BAR: SADE, KARMAŞADAN UZAK KOMUTA ÇUBUĞU */}
      <header className="bg-[#182235] border-b border-[#2c3a52] sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Sol: Ana Sayfa & Durum */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg border border-[#384966] bg-[#212f47] hover:bg-[#2a3b57] text-xs font-semibold flex items-center gap-1.5 text-[#f0ece1] transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#93c5fd]" />
              Ana Sayfa
            </Link>

            <div className="flex items-center bg-[#e2dcd0] text-[#182235] px-3 py-1.5 rounded-lg text-xs font-bold gap-1.5 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#182235]" />
              <span>
                Etiketlenen: {labeledCount} / {items.length} CV
              </span>
            </div>
          </div>

          {/* Sağ: Ayrı Sayfa Linkleri ve Sade Butonlar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/gizlilabel/basarilar"
              className="px-3 py-1.5 rounded-lg border border-[#384966] bg-[#212f47] hover:bg-[#2a3b57] text-xs font-semibold text-[#f0ece1] flex items-center gap-1.5 whitespace-nowrap"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#93c5fd]" />
              Başarılar
            </Link>

            <Link
              href={`/gizlilabel/kriterler?cv=${currentIndex}`}
              className="px-3 py-1.5 rounded-lg bg-[#eab308] hover:bg-[#fde047] text-[#182235] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sliders className="w-3.5 h-3.5" />
              Tam Ekran ({criteriaList.length} Alan)
            </Link>

            <button
              type="button"
              onClick={() => setIsIpModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-[#384966] bg-[#212f47] hover:bg-[#2a3b57] text-xs font-semibold text-[#f0ece1] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5 text-[#93c5fd]" />
              <span>Giriş Kayıtları ({accessLogs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsVaultModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-[#384966] bg-[#212f47] hover:bg-[#2a3b57] text-xs font-semibold text-[#f0ece1] cursor-pointer whitespace-nowrap"
            >
              CV Kasası ({vaultCvs.length}) & Talepler ({vaultLeads.length})
            </button>

            <button
              onClick={() => fetchAll(true)}
              title="Yenile"
              className="p-1.5 border border-[#33435e] rounded-lg hover:bg-[#2a3b57] text-[#d2ccc0] bg-[#212f47] cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  syncing ? "animate-spin text-[#93c5fd]" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-4 space-y-4">
        {autoRecoveredNote && (
          <div className="bg-emerald-950/90 border border-emerald-500/40 rounded-lg p-3 text-xs text-emerald-200 flex items-center justify-between">
            <span>✓ {autoRecoveredNote}</span>
            <button
              type="button"
              onClick={() => setAutoRecoveredNote("")}
              className="text-emerald-300 font-bold px-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-[#e2dcd0] border border-[#b8b0a0] rounded-xl p-12 text-center text-sm text-[#333d4f]">
            Özgeçmişler yükleniyor...
          </div>
        ) : !currentItem ? (
          <div className="bg-[#e2dcd0] border border-[#b8b0a0] rounded-xl p-12 text-center space-y-3">
            <p className="text-sm font-semibold">
              Bu filtrede gösterilecek CV kalmadı.
            </p>
            <button
              onClick={() => {
                setFilterMode("all");
                setCurrentIndex(0);
              }}
              className="px-4 py-2 bg-[#182235] text-[#f0ece1] rounded-md text-xs font-medium cursor-pointer"
            >
              Tümünü Göster ({items.length})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* SOL SÜTUN (7 Sütun): PDF VEYA METİN GÖRÜNTÜLEYİCİ */}
            <div className="lg:col-span-7 bg-[#e2dcd0] border border-[#b8b0a0] rounded-xl overflow-hidden shadow-xs">
              <div className="px-4 py-2.5 border-b border-[#c4bdb0] bg-[#d6cfc0] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#182235] text-[#f0ece1] text-xs font-mono-academic font-bold">
                    #{currentItem.index} / {items.length}
                  </span>
                  <span className="font-serif-academic font-bold text-xs sm:text-sm text-[#121926] truncate max-w-[260px] sm:max-w-[360px]">
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
                    className="px-2.5 py-1 rounded text-xs font-semibold bg-[#e2dcd0] border border-[#aba393] text-[#182235] hover:bg-[#ece7db]"
                  >
                    Tam Ekran PDF ↗
                  </a>
                  <button
                    onClick={() => setViewMode("pdf")}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                      viewMode === "pdf"
                        ? "bg-[#182235] text-[#f0ece1]"
                        : "bg-[#e2dcd0] border border-[#aba393] text-[#273142]"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    PDF
                  </button>
                  <button
                    onClick={() => setViewMode("text")}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                      viewMode === "text"
                        ? "bg-[#182235] text-[#f0ece1]"
                        : "bg-[#e2dcd0] border border-[#aba393] text-[#273142]"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Metin
                  </button>
                </div>
              </div>

              {viewMode === "pdf" ? (
                <iframe
                  key={currentItem.fileName}
                  src={`/api/ground-truth/pdf?file=${encodeURIComponent(
                    currentItem.fileName
                  )}`}
                  className="w-full h-[720px] border-0 bg-[#cfc8b8]"
                  title={currentItem.fileName}
                />
              ) : (
                <pre className="w-full h-[720px] overflow-y-auto p-4 bg-[#182235] text-[#e2dcd0] text-xs font-mono-academic whitespace-pre-wrap leading-relaxed">
                  {currentItem.rawText || "-"}
                </pre>
              )}
            </div>

            {/* SAĞ SÜTUN (5 Sütun): 100 ALANA ÖLÇEKLENEBİLİR SADE ETİKETLEME PANELİ */}
            <div className="lg:col-span-5 space-y-3">
              {/* 1. CV GEZİNME KUTUSU */}
              <div className="bg-[#e2dcd0] border border-[#b8b0a0] rounded-xl p-3 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between gap-1.5">
                  <button
                    disabled={currentIndex <= 0}
                    onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
                    className="px-2.5 py-1.5 rounded-md border border-[#aba393] bg-[#ece7db] hover:border-[#182235] disabled:opacity-40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Önceki
                  </button>

                  <select
                    value={currentIndex}
                    onChange={(e) => setCurrentIndex(Number(e.target.value))}
                    className="flex-1 border border-[#aba393] rounded-md px-2 py-1.5 text-xs font-medium bg-[#ece7db] truncate"
                  >
                    {filteredItems.map((it, idx) => {
                      const done = isRaterFullyDone(it);
                      return (
                        <option key={it.fileName} value={idx}>
                          {done ? "✓" : "•"} #{it.index} - {it.aiName} (
                          {it.fileName})
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
                    className="px-2.5 py-1.5 rounded-md border border-[#aba393] bg-[#ece7db] hover:border-[#182235] disabled:opacity-40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    Sonraki
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      setFilterMode("all");
                      setCurrentIndex(0);
                    }}
                    className={`py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      filterMode === "all"
                        ? "bg-[#182235] text-[#f0ece1]"
                        : "bg-[#d5cec0] text-[#273142]"
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
                        ? "bg-[#182235] text-[#f0ece1]"
                        : "bg-[#d5cec0] text-[#273142]"
                    }`}
                  >
                    Kalan ({items.length - labeledCount})
                  </button>
                </div>
              </div>

              {/* 2. 100 ALANA HAZIR SADE ETİKETLEME PANELİ (VARSA DEĞERİ, YOKSA '-') */}
              <div className="bg-[#e2dcd0] border-2 border-[#182235] rounded-xl p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#c4bdb0] pb-2">
                  <div>
                    <h2 className="font-serif-academic text-sm font-bold text-[#121926]">
                      CV Etiketleme Paneli ({criteriaList.length} Alan)
                    </h2>
                    <p className="text-[11px] text-[#3b4454]">
                      Varsa direkt değerini yazın, yoksa <strong>-</strong>{" "}
                      bırakın
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddFieldModalOpen(true)}
                    className="px-2.5 py-1 rounded-md bg-[#182235] hover:bg-[#22304a] text-[#eab308] text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3 h-3" />+ Alan Ekle
                  </button>
                </div>

                {/* Arama ve Kategori Sekmeleri (100 alanı tek panelde rahatça yönetmek için) */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#4a5363] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                      placeholder={`${criteriaList.length} alan içinde ara (yaş, okul, meslek, dil, yazılım...)`}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#ece7db] border border-[#aba393] text-xs text-[#121926] focus:outline-none focus:border-[#182235]"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setFieldCategoryFilter("core")}
                      className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                        fieldCategoryFilter === "core"
                          ? "bg-[#182235] text-[#f0ece1]"
                          : "bg-[#d6cfc0] text-[#273142]"
                      }`}
                    >
                      Temel Alanlar (16)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFieldCategoryFilter("all")}
                      className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                        fieldCategoryFilter === "all"
                          ? "bg-[#182235] text-[#f0ece1]"
                          : "bg-[#d6cfc0] text-[#273142]"
                      }`}
                    >
                      Tümü ({criteriaList.length})
                    </button>
                    {CRITERIA_CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setFieldCategoryFilter(cat.key)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                          fieldCategoryFilter === cat.key
                            ? "bg-[#182235] text-[#eab308] font-bold"
                            : "bg-[#d6cfc0] text-[#273142]"
                        }`}
                      >
                        {cat.label.replace(/^\d+\.\s*/, "")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2 Sütunlu Kaydırılabilir Alan Listesi (100 Alana Kadar Sade Görünüm) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[460px] overflow-y-auto pr-1">
                  {visibleCriteriaInRightPanel.map((crit) => {
                    const rawVal = activeCvValues[crit.id];
                    const val =
                      rawVal === undefined
                        ? "-"
                        : rawVal === "Var" ||
                          rawVal === "Yok" ||
                          rawVal === "Belirtilmemiş" ||
                          rawVal === "—"
                        ? "-"
                        : rawVal;
                    const hasRealVal =
                      val.trim() !== "" && val.trim() !== "-";

                    return (
                      <div
                        key={crit.id}
                        className="p-2 rounded-lg bg-[#ece7db] border border-[#b8b0a0] flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <label
                            className="text-[11px] font-bold text-[#121926] truncate"
                            title={crit.label}
                          >
                            <span className="font-mono-academic text-[10px] text-[#4a5363] mr-1">
                              #{crit.code}
                            </span>
                            {crit.label}
                          </label>
                        </div>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) =>
                            handleUpdateFieldValue(crit.id, e.target.value)
                          }
                          onBlur={(e) =>
                            handleUpdateFieldValue(
                              crit.id,
                              cleanCriterionDisplayValue(e.target.value)
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveAndNext(true);
                            }
                          }}
                          placeholder="-"
                          className={`w-full px-2 py-1 rounded border text-xs font-semibold focus:outline-none ${
                            hasRealVal
                              ? "bg-[#182235] text-[#f0ece1] border-[#182235]"
                              : "bg-[#f5f2ea] text-[#4a5363] border-[#c4bdb0]"
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Kaydet Butonu */}
                <div className="pt-1 space-y-1.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveAndNext(true)}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#182235] hover:bg-[#22304a] text-[#f0ece1] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-colors"
                  >
                    <Check className="w-4 h-4 text-[#93c5fd]" />
                    {saving ? "Kaydediliyor..." : "Kaydet ve Sonrakine Geç"}
                  </button>

                  {saveNote && (
                    <div className="text-xs font-semibold text-[#182235] text-center">
                      {saveNote}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* YENİ ALAN EKLEME MODALI */}
      {isAddFieldModalOpen && (
        <div
          onClick={() => setIsAddFieldModalOpen(false)}
          className="fixed inset-0 z-50 bg-[#141c2b]/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#e2dcd0] rounded-2xl border border-[#b8b0a0] max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#c4bdb0] pb-2.5">
              <h3 className="font-serif-academic font-bold text-base text-[#121926]">
                + Yeni Etiketleme Alanı Ekle (#{criteriaList.length + 1})
              </h3>
              <button
                type="button"
                onClick={() => setIsAddFieldModalOpen(false)}
                className="text-[#4a5363] hover:text-[#121926] text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddField} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#182235] mb-1">
                  Alan Adı *
                </label>
                <input
                  type="text"
                  required
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="Örn: Vardiya Uygunluğu, Referans Sayısı..."
                  className="w-full px-3 py-2 rounded-lg bg-[#ece7db] border border-[#a8a090] text-xs text-[#121926]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182235] mb-1">
                  Kategori
                </label>
                <select
                  value={newFieldCategory}
                  onChange={(e) => setNewFieldCategory(e.target.value)}
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
                  Durum
                </label>
                <select
                  value={newFieldTier}
                  onChange={(e) =>
                    setNewFieldTier(e.target.value as CriterionAccessTier)
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#ece7db] border border-[#a8a090] text-xs text-[#121926]"
                >
                  <option value="premium">Premium (Kilitli)</option>
                  <option value="default">Default (Açık)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddFieldModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#a8a090] bg-[#d6cfc0] text-xs font-semibold cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#182235] text-[#f0ece1] text-xs font-bold cursor-pointer"
                >
                  Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZİYARETÇİ CV KASASI VE PREMİUM TALEPLER MODALI */}
      {isVaultModalOpen && (
        <div
          onClick={() => setIsVaultModalOpen(false)}
          className="fixed inset-0 z-50 bg-[#141c2b]/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#e2dcd0] rounded-2xl border border-[#b8b0a0] max-w-6xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="bg-[#182235] text-[#f0ece1] px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#2c3a52]">
              <div>
                <h3 className="font-serif-academic font-bold text-lg text-[#f0ece1]">
                  CV Kasası ({vaultCvs.length}) & İletişim Talepleri (
                  {vaultLeads.length})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVaultTab("cvs")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    vaultTab === "cvs"
                      ? "bg-[#e2dcd0] text-[#182235]"
                      : "bg-[#212f47] text-[#d2ccc0] hover:text-white"
                  }`}
                >
                  Yüklenen CV&apos;ler ({vaultCvs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVaultTab("leads")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    vaultTab === "leads"
                      ? "bg-[#e2dcd0] text-[#182235]"
                      : "bg-[#212f47] text-[#d2ccc0] hover:text-white"
                  }`}
                >
                  İletişim Talepleri ({vaultLeads.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob(
                      [
                        JSON.stringify(
                          { cvs: vaultCvs, leads: vaultLeads },
                          null,
                          2
                        ),
                      ],
                      { type: "application/json;charset=utf-8" }
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `cv-vault-${new Date()
                      .toISOString()
                      .slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#eab308] text-[#182235] text-xs font-bold cursor-pointer hover:bg-[#fde047]"
                >
                  JSON İndir
                </button>
                <button
                  type="button"
                  onClick={() => setIsVaultModalOpen(false)}
                  className="text-[#b8b2a6] hover:text-white text-xl leading-none px-2 cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {vaultTab === "cvs" ? (
                vaultCvs.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[#4a5363]">
                    Henüz ziyaretçiler tarafından yüklenen yeni bir CV kaydı
                    bulunmuyor.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#b8b0a0] rounded-xl bg-[#ece7db]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#182235] text-[#f0ece1]">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Tarih</th>
                          <th className="py-2.5 px-3">Dosya / Ad Soyad</th>
                          <th className="py-2.5 px-3">Cinsiyet / Yaş</th>
                          <th className="py-2.5 px-3">Ön Lisans</th>
                          <th className="py-2.5 px-3">Lisans</th>
                          <th className="py-2.5 px-3">Yüksek Lisans</th>
                          <th className="py-2.5 px-3">Doktora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#c4bdb0]">
                        {vaultCvs.map((v, i) => (
                          <tr key={v.id || i} className="hover:bg-[#dfd9ca]">
                            <td className="py-2.5 px-3 font-mono-academic">
                              {i + 1}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-[#4a5363]">
                              {v.uploadedAt
                                ? new Date(v.uploadedAt).toLocaleString("tr-TR")
                                : "-"}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-[#121926]">
                                {v.fullName}
                              </div>
                              <div className="text-[11px] text-[#4a5363]">
                                {v.fileName}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-semibold text-[#182235]">
                                {v.gender}
                              </span>{" "}
                              • {v.age ?? "-"}
                            </td>
                            <td className="py-2.5 px-3">
                              {v.educationByDegree?.associate
                                ? `${v.educationByDegree.associate.university} — ${v.educationByDegree.associate.department}`
                                : "-"}
                            </td>
                            <td className="py-2.5 px-3">
                              {v.educationByDegree?.bachelor
                                ? `${v.educationByDegree.bachelor.university} — ${v.educationByDegree.bachelor.department}`
                                : cleanCriterionDisplayValue(v.university) !==
                                  "-"
                                ? `${cleanCriterionDisplayValue(
                                    v.university
                                  )} — ${cleanCriterionDisplayValue(
                                    v.department
                                  )}`
                                : "-"}
                            </td>
                            <td className="py-2.5 px-3">
                              {v.educationByDegree?.master
                                ? `${v.educationByDegree.master.university} — ${v.educationByDegree.master.department}`
                                : "-"}
                            </td>
                            <td className="py-2.5 px-3">
                              {v.educationByDegree?.phd
                                ? `${v.educationByDegree.phd.university} — ${v.educationByDegree.phd.department}`
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : vaultLeads.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#4a5363]">
                  Henüz gönderilmiş bir iletişim talebi bulunmuyor.
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#b8b0a0] rounded-xl bg-[#ece7db]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#182235] text-[#f0ece1]">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Tarih</th>
                        <th className="py-2.5 px-3">Ad Soyad</th>
                        <th className="py-2.5 px-3">Şirket / Kurum</th>
                        <th className="py-2.5 px-3">Telefon / E-Posta</th>
                        <th className="py-2.5 px-3">İstenen Alan</th>
                        <th className="py-2.5 px-3">Not</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c4bdb0]">
                      {vaultLeads.map((ld, i) => (
                        <tr key={ld.id || i} className="hover:bg-[#dfd9ca]">
                          <td className="py-2.5 px-3 font-mono-academic">
                            {i + 1}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-[#4a5363]">
                            {ld.createdAt
                              ? new Date(ld.createdAt).toLocaleString("tr-TR")
                              : "-"}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#121926]">
                            {ld.fullName}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#182235]">
                            {ld.companyName}
                          </td>
                          <td className="py-2.5 px-3 font-mono-academic font-bold text-[#7c470b]">
                            {ld.contactInfo}
                          </td>
                          <td className="py-2.5 px-3">{ld.requestedFeature}</td>
                          <td className="py-2.5 px-3">{ld.message || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SADE İSİMLİ GİRİŞ KAYITLARI MODALI */}
      {isIpModalOpen && (
        <div
          onClick={() => setIsIpModalOpen(false)}
          className="fixed inset-0 z-50 bg-[#141c2b]/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#e2dcd0] rounded-2xl border border-[#b8b0a0] max-w-5xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="bg-[#182235] text-[#f0ece1] px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#2c3a52]">
              <div>
                <h3 className="font-serif-academic font-bold text-lg text-[#f0ece1]">
                  Giriş Kayıtları & Erişim Ayarları ({accessLogs.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {accessLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAccessLogs}
                    className="px-3 py-1.5 rounded-lg bg-red-900/80 hover:bg-red-800 text-red-100 text-xs font-bold cursor-pointer"
                  >
                    Kayıtları Temizle
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsIpModalOpen(false)}
                  className="text-[#b8b2a6] hover:text-white text-xl leading-none px-2 cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs text-[#182235]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-xl bg-[#ece7db] border border-[#b8b0a0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#121926]">
                      Aktif IP Adresiniz:
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-[#182235] text-[#f0ece1] font-mono-academic font-bold">
                      {currentIp || "-"}
                    </span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="font-bold text-[#121926]">
                      İzinli IP Listesi:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {allowedIps.map((ip) => (
                        <span
                          key={ip}
                          className="px-2 py-0.5 rounded bg-[#182235] text-[#f0ece1] font-mono-academic font-bold text-[11px]"
                        >
                          ✓ {ip}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#d6cfc0] border border-[#b8b0a0] space-y-2">
                  <div className="font-bold text-[#121926]">IP Yönetimi</div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleLockToCurrentWifiIp}
                      className="px-3 py-1.5 rounded-lg bg-[#182235] hover:bg-[#22304a] text-[#f0ece1] font-bold text-[11px] cursor-pointer"
                    >
                      Sadece Şu Anki IP&apos;me ({currentIp}) Kilitle
                    </button>
                  </div>
                  <form
                    onSubmit={handleAddCustomIp}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      type="text"
                      value={customIpInput}
                      onChange={(e) => setCustomIpInput(e.target.value)}
                      placeholder="Yeni IP ekle"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#aba393] bg-[#ece7db] text-xs font-mono-academic focus:outline-none focus:border-[#182235]"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-[#eab308] text-[#182235] font-bold text-xs cursor-pointer hover:bg-[#fde047]"
                    >
                      + Ekle
                    </button>
                  </form>
                </div>
              </div>

              {ipActionMessage && (
                <div className="p-2.5 rounded-lg bg-emerald-900/15 border border-emerald-700/30 text-emerald-950 font-semibold text-xs">
                  ✓ {ipActionMessage}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <h4 className="font-serif-academic font-bold text-sm text-[#121926]">
                  Giriş Denemeleri ({accessLogs.length})
                </h4>

                {accessLogs.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-[#b8b0a0] bg-[#ece7db] text-[#4a5363]">
                    Kayıt bulunmuyor.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#b8b0a0] rounded-xl bg-[#ece7db] max-h-80 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#182235] text-[#f0ece1] sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Tarih / Saat</th>
                          <th className="py-2.5 px-3">IP Adresi</th>
                          <th className="py-2.5 px-3">Durum</th>
                          <th className="py-2.5 px-3">Sayfa</th>
                          <th className="py-2.5 px-3">Konum</th>
                          <th className="py-2.5 px-3">Cihaz</th>
                          <th className="py-2.5 px-3">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#c4bdb0]">
                        {accessLogs.map((log, idx) => {
                          const isBlocked =
                            log.status === "blocked" ||
                            log.status === "failed_key";
                          return (
                            <tr
                              key={log.id || idx}
                              className={
                                isBlocked
                                  ? "bg-red-950/10 hover:bg-red-950/20"
                                  : "hover:bg-[#dfd9ca]"
                              }
                            >
                              <td className="py-2 px-3 font-mono-academic">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap text-[11px] text-[#3b4454]">
                                {log.timestamp
                                  ? new Date(log.timestamp).toLocaleString(
                                      "tr-TR"
                                    )
                                  : "-"}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap font-mono-academic font-extrabold text-[#121926]">
                                {log.ip}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {log.status === "blocked" ? (
                                  <span className="px-2 py-0.5 rounded bg-red-700 text-white font-bold text-[10px]">
                                    Engellendi
                                  </span>
                                ) : log.status === "failed_key" ? (
                                  <span className="px-2 py-0.5 rounded bg-red-900 text-amber-200 font-bold text-[10px]">
                                    Hatalı Anahtar
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-emerald-800 text-white font-bold text-[10px]">
                                    Yetkili
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono-academic text-[11px]">
                                {log.targetPath || "/gizlilabel"}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap text-[11px] text-[#273142]">
                                {log.location || "-"}
                              </td>
                              <td
                                className="py-2 px-3 max-w-[220px] truncate text-[11px] text-[#4a5363]"
                                title={log.userAgent}
                              >
                                {log.userAgent}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {!allowedIps.includes(log.ip) ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const res = await fetch(
                                        "/api/admin-auth",
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            action: "add_custom_ip",
                                            customIp: log.ip,
                                          }),
                                        }
                                      );
                                      const d = await res.json();
                                      if (res.ok && d?.allowedIps) {
                                        setAllowedIps(d.allowedIps);
                                        setIpActionMessage(
                                          `${log.ip} izinli listeye eklendi.`
                                        );
                                      }
                                    }}
                                    className="px-2 py-1 rounded bg-[#182235] hover:bg-[#22304a] text-[#fde047] font-bold text-[10px] cursor-pointer"
                                  >
                                    + İzin Ver
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-emerald-800 font-bold">
                                    İzinli
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
