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
import {
  isSameUniversity,
  isSameDepartment,
  isSameDegree,
  hasDegreeSelected,
  toggleDegreeInSelection,
  hasUniversitySelected,
  toggleUniversityInSelection,
  hasDepartmentSelected,
  toggleDepartmentInSelection,
  DegreeKey,
  DegreeEducationEntry,
  EducationByDegreeMap,
} from "@/lib/cvEngine";

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

const DEGREE_OPTIONS: {
  key: DegreeKey;
  value: string;
  shortTr: string;
  shortEn: string;
  cardTitle: string;
  uniLabel: string;
  deptLabel: string;
  prefixLabel: string;
}[] = [
  {
    key: "associate",
    value: "Ön Lisans (Associate)",
    shortTr: "Ön Lisans",
    shortEn: "Associate",
    cardTitle: "Ön Lisans Eğitimi (Associate)",
    uniLabel: "Ön Lisans Üniversitesi",
    deptLabel: "Ön Lisans Bölümü",
    prefixLabel: "Ön Lisans",
  },
  {
    key: "bachelor",
    value: "Lisans (Bachelor's)",
    shortTr: "Lisans",
    shortEn: "Bachelor's",
    cardTitle: "Lisans Eğitimi (Bachelor's)",
    uniLabel: "Lisans Üniversitesi",
    deptLabel: "Lisans Bölümü",
    prefixLabel: "Lisans",
  },
  {
    key: "master",
    value: "Yüksek Lisans (Master's)",
    shortTr: "Yüksek Lisans",
    shortEn: "Master's",
    cardTitle: "Yüksek Lisans / Master Eğitimi (Master's)",
    uniLabel: "Master Üniversitesi",
    deptLabel: "Master Bölümü",
    prefixLabel: "Master",
  },
  {
    key: "phd",
    value: "Doktora (Ph.D.)",
    shortTr: "Doktora",
    shortEn: "Ph.D.",
    cardTitle: "Doktora Eğitimi (Ph.D.)",
    uniLabel: "Doktora Üniversitesi",
    deptLabel: "Doktora Bölümü",
    prefixLabel: "Doktora",
  },
];

function computeCombinedUniDeptFromMap(
  degStr: string,
  map: Record<DegreeKey, DegreeEducationEntry>
): { uni: string; dept: string } {
  const activeOpts = DEGREE_OPTIONS.filter((d) =>
    hasDegreeSelected(degStr, d.value)
  );
  const effectiveOpts =
    activeOpts.length > 0 ? activeOpts : [DEGREE_OPTIONS[1]];

  if (effectiveOpts.length === 1) {
    const k = effectiveOpts[0].key;
    return {
      uni: (map[k]?.university || "").trim(),
      dept: (map[k]?.department || "").trim(),
    };
  }

  const uniParts = effectiveOpts
    .map((d) => {
      const val = (map[d.key]?.university || "").trim();
      return val ? `${d.prefixLabel}: ${val}` : "";
    })
    .filter(Boolean);

  const deptParts = effectiveOpts
    .map((d) => {
      const val = (map[d.key]?.department || "").trim();
      return val ? `${d.prefixLabel}: ${val}` : "";
    })
    .filter(Boolean);

  return {
    uni: uniParts.join(" | "),
    dept: deptParts.join(" | "),
  };
}

function buildInitialDegreeMap(
  item: BenchmarkCVItem,
  savedUni?: string | null,
  savedDept?: string | null,
  savedDeg?: string | null
): Record<DegreeKey, DegreeEducationEntry> {
  const aiMap = item.aiEducationByDegree || {};
  const fallbackUni =
    item.aiUniversity && item.aiUniversity !== "Belirtilmemiş"
      ? item.aiUniversity
      : "";
  const fallbackDept =
    item.aiDepartment && item.aiDepartment !== "Belirtilmemiş"
      ? item.aiDepartment
      : "";

  const base: Record<DegreeKey, DegreeEducationEntry> = {
    associate: {
      university: aiMap.associate?.university || fallbackUni,
      department: aiMap.associate?.department || fallbackDept,
    },
    bachelor: {
      university: aiMap.bachelor?.university || fallbackUni,
      department: aiMap.bachelor?.department || fallbackDept,
    },
    master: {
      university:
        aiMap.master?.university || aiMap.bachelor?.university || fallbackUni,
      department:
        aiMap.master?.department || aiMap.bachelor?.department || fallbackDept,
    },
    phd: {
      university:
        aiMap.phd?.university ||
        aiMap.master?.university ||
        aiMap.bachelor?.university ||
        fallbackUni,
      department:
        aiMap.phd?.department ||
        aiMap.master?.department ||
        aiMap.bachelor?.department ||
        fallbackDept,
    },
  };

  if (savedDeg && (savedUni || savedDept)) {
    const parsePrefixMap = (raw: string | null | undefined) => {
      const out: Partial<Record<DegreeKey, string>> = {};
      if (!raw) return out;
      const chunks = raw.split(/\s*\|\s*/);
      for (const ch of chunks) {
        const m = ch.match(
          /^\s*(ön\s*lisans|associate|lisans|bachelor|yüksek\s*lisans|master|doktora|ph\.?d\.?)\s*:\s*(.+)$/i
        );
        if (m) {
          const p = m[1].toLowerCase();
          const v = m[2].trim();
          if (p.includes("ön") || p.includes("assoc")) out.associate = v;
          else if (p.includes("yüksek") || p.includes("master")) out.master = v;
          else if (p.includes("doktora") || p.includes("ph")) out.phd = v;
          else out.bachelor = v;
        }
      }
      return out;
    };

    const uMap = parsePrefixMap(savedUni);
    const dMap = parsePrefixMap(savedDept);
    const hasPrefixed =
      Object.keys(uMap).length > 0 || Object.keys(dMap).length > 0;

    if (hasPrefixed) {
      for (const k of ["associate", "bachelor", "master", "phd"] as DegreeKey[]) {
        if (uMap[k]) base[k].university = uMap[k]!;
        if (dMap[k]) base[k].department = dMap[k]!;
      }
    } else {
      // Tek derece kaydedilmişse ilgili dereceye ata
      const activeOpts = DEGREE_OPTIONS.filter((d) =>
        hasDegreeSelected(savedDeg, d.value)
      );
      if (activeOpts.length === 1) {
        const k = activeOpts[0].key;
        if (savedUni) base[k].university = savedUni;
        if (savedDept) base[k].department = savedDept;
      }
    }
  }

  return base;
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
  const [inputUniversity, setInputUniversity] = useState<string>("");
  const [inputDepartment, setInputDepartment] = useState<string>("");
  const [inputDegree, setInputDegree] = useState<string>("Lisans (Bachelor's)");
  const [degreeInputs, setDegreeInputs] = useState<
    Record<DegreeKey, DegreeEducationEntry>
  >({
    associate: { university: "", department: "" },
    bachelor: { university: "", department: "" },
    master: { university: "", department: "" },
    phd: { university: "", department: "" },
  });
  const [saveMessage, setSaveMessage] = useState<string>("");

  const handleToggleDegreeButton = (degVal: string) => {
    const nextDeg = toggleDegreeInSelection(inputDegree, degVal);
    setInputDegree(nextDeg);
    const { uni, dept } = computeCombinedUniDeptFromMap(nextDeg, degreeInputs);
    setInputUniversity(uni);
    setInputDepartment(dept);
  };

  const handleUpdateDegreeField = (
    key: DegreeKey,
    field: "university" | "department",
    value: string
  ) => {
    setDegreeInputs((prev) => {
      const nextMap = {
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value,
        },
      };
      const { uni, dept } = computeCombinedUniDeptFromMap(inputDegree, nextMap);
      setInputUniversity(uni);
      setInputDepartment(dept);
      return nextMap;
    });
  };

  // Bir CV'nin bu kullanıcı tarafından tamamen (Üni, Bölüm ve Derece dahil) etiketlenip etiketlenmediğini kontrol et
  const isRaterFullyDone = useCallback((it: BenchmarkCVItem, role: RaterId) => {
    const v = it.humanLabel?.votes?.[role];
    return !!(v && v.humanUniversity && v.humanDepartment && v.humanDegree);
  }, []);

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
        (it) => !isRaterFullyDone(it, role)
      );
      if (firstUnlabeledIdx !== -1) {
        setFilterMode("all");
        setCurrentIndex(firstUnlabeledIdx);
      }
    },
    [isRaterFullyDone]
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
          // İlk açılışta (sayfa yenilendiğinde veya kapatıp açıldığında) doğrudan kullanıcının kaldığı (henüz Üni, Bölüm & Derece etiketlemediği ilk) CV'ye atla!
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
              (it) => {
                const v = it.humanLabel?.votes?.[role];
                return !(
                  v &&
                  v.humanUniversity &&
                  v.humanDepartment &&
                  v.humanDegree
                );
              }
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
      return items.filter((it) => !isRaterFullyDone(it, activeRater));
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
        const uniMismatch =
          !!it.humanLabel.humanUniversity &&
          !isSameUniversity(it.aiUniversity, it.humanLabel.humanUniversity);
        const deptMismatch =
          !!it.humanLabel.humanDepartment &&
          !isSameDepartment(it.aiDepartment, it.humanLabel.humanDepartment);
        const degMismatch =
          !!it.humanLabel.humanDegree &&
          !isSameDegree(
            it.aiDegree,
            it.humanLabel.humanDegree,
            it.aiAllDegrees || []
          );
        return (
          genderMismatch ||
          ageMismatch ||
          uniMismatch ||
          deptMismatch ||
          degMismatch
        );
      });
    }
    return items;
  }, [items, filterMode, activeRater, isRaterFullyDone]);

  const currentItem = filteredItems[currentIndex] || filteredItems[0] || null;

  // Aktif CV veya aktif kişi ("ben" / "arkadasim") değiştiğinde form alanlarını doldur
  useEffect(() => {
    if (!currentItem) return;
    const myVote = currentItem.humanLabel?.votes?.[activeRater];
    const defaultDeg =
      currentItem.aiAllDegrees && currentItem.aiAllDegrees.length > 0
        ? currentItem.aiAllDegrees.join(" + ")
        : currentItem.aiDegree || "Lisans (Bachelor's)";

    if (myVote) {
      setInputGender(myVote.humanGender === "Kadın" ? "Kadın" : "Erkek");
      setInputAge(myVote.humanAge !== null ? String(myVote.humanAge) : "");
      setInputName(myVote.humanName || currentItem.aiName);
      const degToUse =
        myVote.humanDegree ||
        currentItem.humanLabel?.humanDegree ||
        defaultDeg;
      setInputDegree(degToUse);
      const map = buildInitialDegreeMap(
        currentItem,
        myVote.humanDegree ? myVote.humanUniversity : null,
        myVote.humanDegree ? myVote.humanDepartment : null,
        degToUse
      );
      setDegreeInputs(map);
      const { uni, dept } = computeCombinedUniDeptFromMap(degToUse, map);
      setInputUniversity(uni);
      setInputDepartment(dept);
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
      const degToUse = currentItem.humanLabel.humanDegree || defaultDeg;
      setInputDegree(degToUse);
      const map = buildInitialDegreeMap(
        currentItem,
        currentItem.humanLabel.humanDegree
          ? currentItem.humanLabel.humanUniversity
          : null,
        currentItem.humanLabel.humanDegree
          ? currentItem.humanLabel.humanDepartment
          : null,
        degToUse
      );
      setDegreeInputs(map);
      const { uni, dept } = computeCombinedUniDeptFromMap(degToUse, map);
      setInputUniversity(uni);
      setInputDepartment(dept);
    } else {
      setInputGender(currentItem.aiGender === "Kadın" ? "Kadın" : "Erkek");
      const isNoBirthOrEduDate =
        currentItem.aiAge === null ||
        currentItem.aiAgeMethod === "İlk İş Deneyimi Tahmini" ||
        currentItem.aiAgeMethod === "Bilinmiyor";
      setInputAge(isNoBirthOrEduDate ? "" : String(currentItem.aiAge));
      setInputName(currentItem.aiName);
      setInputDegree(defaultDeg);
      const map = buildInitialDegreeMap(currentItem, null, null, defaultDeg);
      setDegreeInputs(map);
      const { uni, dept } = computeCombinedUniDeptFromMap(defaultDeg, map);
      setInputUniversity(uni);
      setInputDepartment(dept);
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
    const myLabeledCount = items.filter((it) =>
      isRaterFullyDone(it, activeRater)
    ).length;
    const friendLabeledCount = items.filter((it) =>
      isRaterFullyDone(it, activeRater === "ben" ? "arkadasim" : "ben")
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
        mismatches: [] as BenchmarkCVItem[],
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

      let isUniOk = true;
      if (lbl.humanUniversity && lbl.humanUniversity.trim().length > 0) {
        uniLabeledCount++;
        if (isSameUniversity(it.aiUniversity, lbl.humanUniversity, it.aiAllUniversities || [])) {
          uniCorrect++;
        } else {
          isUniOk = false;
        }
      }

      let isDeptOk = true;
      if (lbl.humanDepartment && lbl.humanDepartment.trim().length > 0) {
        deptLabeledCount++;
        if (isSameDepartment(it.aiDepartment, lbl.humanDepartment, it.aiAllDepartments || [])) {
          deptCorrect++;
        } else {
          isDeptOk = false;
        }
      }

      let isDegOk = true;
      if (lbl.humanDegree && lbl.humanDegree.trim().length > 0) {
        degLabeledCount++;
        if (isSameDegree(it.aiDegree, lbl.humanDegree, it.aiAllDegrees || [])) {
          degCorrect++;
        } else {
          isDegOk = false;
        }
      }

      if (!isGenderOk || !isAgeCloseOk || !isUniOk || !isDeptOk || !isDegOk) {
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
      mismatches,
    };
  }, [items, activeRater, isRaterFullyDone]);

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
    const uniToSave =
      inputUniversity.trim() ||
      (currentItem.aiUniversity !== "Belirtilmemiş"
        ? currentItem.aiUniversity
        : "Belirtilmemiş");
    const deptToSave =
      inputDepartment.trim() ||
      (currentItem.aiDepartment !== "Belirtilmemiş"
        ? currentItem.aiDepartment
        : "Belirtilmemiş");
    const degToSave =
      inputDegree.trim() ||
      currentItem.aiDegree ||
      "Lisans / Bachelor's Degree (B.Sc.)";

    try {
      const res = await fetch("/api/ground-truth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: currentItem.fileName,
          humanName: inputName.trim() || currentItem.aiName,
          humanGender: gToSave,
          humanAge: parsedAge,
          humanUniversity: uniToSave,
          humanDepartment: deptToSave,
          humanDegree: degToSave,
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
              // Doğrudan kullanıcının henüz Üni, Bölüm & Derece etiketlemediği bir sonraki CV'ye atla!
              const nextUnlabeledAfter = updatedList.findIndex(
                (it, idx) => idx > currentIndex && !isRaterFullyDone(it, activeRater)
              );
              const anyUnlabeled =
                nextUnlabeledAfter !== -1
                  ? nextUnlabeledAfter
                  : updatedList.findIndex((it) => !isRaterFullyDone(it, activeRater));
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
    const compareUni =
      inputUniversity.trim() ||
      currentItem.humanLabel?.humanUniversity ||
      currentItem.aiUniversity;
    const compareDept =
      inputDepartment.trim() ||
      currentItem.humanLabel?.humanDepartment ||
      currentItem.aiDepartment;
    const compareDeg =
      inputDegree.trim() ||
      currentItem.humanLabel?.humanDegree ||
      currentItem.aiDegree ||
      "Lisans / Bachelor's Degree (B.Sc.)";

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

    const uniMatch = isSameUniversity(
      currentItem.aiUniversity,
      compareUni,
      currentItem.aiAllUniversities || []
    );
    const deptMatch = isSameDepartment(
      currentItem.aiDepartment,
      compareDept,
      currentItem.aiAllDepartments || []
    );
    const degMatch = isSameDegree(
      currentItem.aiDegree,
      compareDeg,
      currentItem.aiAllDegrees || []
    );

    return {
      compareGender,
      compareAge,
      compareUni,
      compareDept,
      compareDeg,
      genderMatch,
      ageDiff,
      uniMatch,
      deptMatch,
      degMatch,
      isExtraCaseNoDate,
    };
  }, [
    currentItem,
    inputGender,
    inputAge,
    inputUniversity,
    inputDepartment,
    inputDegree,
  ]);

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
                📱 Ben ({items.filter((i) => isRaterFullyDone(i, "ben")).length}/
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
                {items.filter((i) => isRaterFullyDone(i, "arkadasim")).length}/
                {items.length})
              </button>
            </div>
          </div>

          {/* CANLI GERÇEK BAŞARI KARTLARI */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-2.5 py-1.5 rounded-lg border border-teal-200 bg-teal-50/60 text-center">
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

            <div className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-center">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Cinsiyet
              </div>
              <div className="text-sm font-bold text-zinc-950">
                {stats.totalLabeled === 0 ? "—" : `%${stats.genderAccuracy}`}
                <span className="text-[11px] text-zinc-500 font-normal ml-1">
                  ({stats.genderCorrect}/{stats.totalLabeled})
                </span>
              </div>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-center">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Yaş (Tam / ±1)
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

            <div className="px-2.5 py-1.5 rounded-lg border border-teal-300 bg-teal-50/50 text-center">
              <div className="text-[10px] uppercase tracking-wider text-teal-800 font-bold">
                Üniversite Başarısı
              </div>
              <div className="text-sm font-bold text-zinc-950">
                {stats.uniLabeledCount === 0 ? "—" : `%${stats.uniAccuracy}`}
                <span className="text-[11px] text-zinc-500 font-normal ml-1">
                  ({stats.uniCorrect}/{stats.uniLabeledCount})
                </span>
              </div>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg border border-teal-300 bg-teal-50/50 text-center">
              <div className="text-[10px] uppercase tracking-wider text-teal-800 font-bold">
                Bölüm Başarısı
              </div>
              <div className="text-sm font-bold text-zinc-950">
                {stats.deptLabeledCount === 0 ? "—" : `%${stats.deptAccuracy}`}
                <span className="text-[11px] text-zinc-500 font-normal ml-1">
                  ({stats.deptCorrect}/{stats.deptLabeledCount})
                </span>
              </div>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg border border-teal-300 bg-teal-50/50 text-center">
              <div className="text-[10px] uppercase tracking-wider text-teal-800 font-bold">
                Derece Başarısı
              </div>
              <div className="text-sm font-bold text-zinc-950">
                {stats.degLabeledCount === 0 ? "—" : `%${stats.degAccuracy}`}
                <span className="text-[11px] text-zinc-500 font-normal ml-1">
                  ({stats.degCorrect}/{stats.degLabeledCount})
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
                      const iDidIt = isRaterFullyDone(it, activeRater);
                      const icon = cStatus === "agreed" && iDidIt
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
                {isRaterFullyDone(currentItem, activeRater) &&
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
                    {benVote?.humanUniversity && (
                      <div className="text-[11px] opacity-85 mt-1 truncate">
                        🎓 {benVote.humanUniversity} — {benVote.humanDepartment || "—"}
                        {benVote.humanDegree ? ` (${benVote.humanDegree})` : ""}
                      </div>
                    )}
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
                    {arkVote?.humanUniversity && (
                      <div className="text-[11px] opacity-85 mt-1 truncate">
                        🎓 {arkVote.humanUniversity} — {arkVote.humanDepartment || "—"}
                        {arkVote.humanDegree ? ` (${arkVote.humanDegree})` : ""}
                      </div>
                    )}
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
                      Soldaki CV&apos;ye bakarak Üniversite, Bölüm, Derece (TR/EN), Cinsiyet ve Yaşı onaylayın
                    </p>
                  </div>
                  {isRaterFullyDone(currentItem, activeRater) && (
                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[11px] font-bold">
                      ✓ Üni, Bölüm &amp; Derece Tamam
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
                      Bu aday CV&apos;sinde ne doğum tarihini ne de üniversite giriş/mezuniyet yılını belirtmiş.
                    </p>
                  </div>
                )}

                {/* YENİ: HER EĞİTİM DERECESİ İÇİN AYRI ÜNİVERSİTE VE BÖLÜM KARTLARI */}
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
                  {/* 1. EĞİTİM DERECESİ (4 SADE BUTON - ÇOKLU SEÇİM) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-zinc-900">
                        Eğitim Derecesi
                      </label>
                      <span className="text-[11px] text-zinc-500">
                        Seçilen her derece aşağıda ayrı açılır
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {DEGREE_OPTIONS.map((deg) => {
                        const active = hasDegreeSelected(inputDegree, deg.value);
                        return (
                          <button
                            key={deg.value}
                            type="button"
                            onClick={() => handleToggleDegreeButton(deg.value)}
                            className={`px-2.5 py-2 rounded-lg text-center border transition-all cursor-pointer ${
                              active
                                ? "bg-teal-700 text-white border-teal-700 shadow-xs"
                                : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                            }`}
                          >
                            <div className="text-xs font-bold leading-tight">
                              {active ? `✓ ${deg.shortTr}` : deg.shortTr}
                            </div>
                            <div
                              className={`text-[10px] leading-tight mt-0.5 ${
                                active ? "text-teal-100" : "text-zinc-400"
                              }`}
                            >
                              {deg.shortEn}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. SEÇİLİ HER DERECE İÇİN AYRI ÜNİVERSİTE & BÖLÜM KUTUSU */}
                  <div className="space-y-2.5">
                    {(
                      DEGREE_OPTIONS.filter((d) =>
                        hasDegreeSelected(inputDegree, d.value)
                      ).length > 0
                        ? DEGREE_OPTIONS.filter((d) =>
                            hasDegreeSelected(inputDegree, d.value)
                          )
                        : [DEGREE_OPTIONS[1]]
                    ).map((deg) => {
                      const entry = degreeInputs[deg.key] || {
                        university: "",
                        department: "",
                      };
                      return (
                        <div
                          key={deg.key}
                          className="p-3 rounded-lg bg-white border border-zinc-200 space-y-2.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
                            <span className="text-xs font-extrabold text-teal-800">
                              🎓 {deg.cardTitle}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-medium">
                              TR / EN fark etmez
                            </span>
                          </div>

                          {/* Dereceye Özel Üniversite */}
                          <div>
                            <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                              {deg.uniLabel}
                            </label>
                            <input
                              type="text"
                              value={entry.university}
                              onChange={(e) =>
                                handleUpdateDegreeField(
                                  deg.key,
                                  "university",
                                  e.target.value
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveLabel();
                                }
                              }}
                              placeholder={`Örn: ${deg.shortTr} Üniversitesi`}
                              className="w-full border border-zinc-300 bg-white rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-900 focus:outline-none focus:border-teal-600"
                            />
                            {currentItem.aiAllUniversities &&
                              currentItem.aiAllUniversities.length > 1 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {currentItem.aiAllUniversities.map((uni) => {
                                    const active = hasUniversitySelected(
                                      entry.university,
                                      uni
                                    );
                                    return (
                                      <button
                                        key={uni}
                                        type="button"
                                        onClick={() =>
                                          handleUpdateDegreeField(
                                            deg.key,
                                            "university",
                                            entry.university
                                              ? toggleUniversityInSelection(
                                                  entry.university,
                                                  uni
                                                )
                                              : uni
                                          )
                                        }
                                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                                          active
                                            ? "bg-zinc-900 text-white border-zinc-900"
                                            : "bg-zinc-50 text-zinc-700 border-zinc-300 hover:bg-zinc-100"
                                        }`}
                                      >
                                        {active ? `✓ ${uni}` : uni}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                          </div>

                          {/* Dereceye Özel Bölüm */}
                          <div>
                            <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                              {deg.deptLabel}
                            </label>
                            <input
                              type="text"
                              value={entry.department}
                              onChange={(e) =>
                                handleUpdateDegreeField(
                                  deg.key,
                                  "department",
                                  e.target.value
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveLabel();
                                }
                              }}
                              placeholder={`Örn: ${deg.shortTr} Bölümü`}
                              className="w-full border border-zinc-300 bg-white rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-900 focus:outline-none focus:border-teal-600"
                            />
                            {currentItem.aiAllDepartments &&
                              currentItem.aiAllDepartments.length > 1 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {currentItem.aiAllDepartments.map((dept) => {
                                    const active = hasDepartmentSelected(
                                      entry.department,
                                      dept
                                    );
                                    return (
                                      <button
                                        key={dept}
                                        type="button"
                                        onClick={() =>
                                          handleUpdateDegreeField(
                                            deg.key,
                                            "department",
                                            entry.department
                                              ? toggleDepartmentInSelection(
                                                  entry.department,
                                                  dept
                                                )
                                              : dept
                                          )
                                        }
                                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                                          active
                                            ? "bg-zinc-900 text-white border-zinc-900"
                                            : "bg-zinc-50 text-zinc-700 border-zinc-300 hover:bg-zinc-100"
                                        }`}
                                      >
                                        {active ? `✓ ${dept}` : dept}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

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
                      className={`py-2 px-4 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
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
                      className={`py-2 px-4 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
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
                      className="px-3 py-1.5 border border-zinc-300 rounded-lg bg-zinc-50 hover:bg-zinc-100 font-bold text-xs cursor-pointer"
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
                      className="flex-1 border border-zinc-300 rounded-lg px-3 py-1.5 text-center text-sm font-bold focus:outline-none focus:border-teal-600 placeholder:text-xs placeholder:font-semibold placeholder:text-amber-700"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setInputAge((prev) =>
                          String(Math.min(75, (parseInt(prev, 10) || 24) + 1))
                        )
                      }
                      className="px-3 py-1.5 border border-zinc-300 rounded-lg bg-zinc-50 hover:bg-zinc-100 font-bold text-xs cursor-pointer"
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
                    {saving
                      ? "Ortak Buluta Kaydediliyor..."
                      : `Üni, Bölüm & Derece Dahil Kaydet (${
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
              <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2.5 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  2. Bu CV İçin AI Cevabı vs. Sizin Cevabınız
                </h3>

                {/* Eğitim Derecesi (Ön Lisans / Lisans / Master / Doktora) Karşılaştırma Satırı */}
                <div
                  className={`p-3 rounded-lg border ${
                    activeComparison?.degMatch
                      ? "bg-teal-50/60 border-teal-200"
                      : "bg-red-50/70 border-red-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold">
                    <span>
                      AI Derece:{" "}
                      <strong className="underline">
                        {currentItem.aiDegree}
                      </strong>
                    </span>
                    <span>
                      Sizin Kararınız:{" "}
                      <strong className="underline">
                        {activeComparison?.compareDeg}
                      </strong>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600">
                      Tespit edilen tüm dereceler:{" "}
                      {(currentItem.aiAllDegrees || []).join(" + ") || "—"}
                    </span>
                    {activeComparison?.degMatch ? (
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

                {/* Üniversite Karşılaştırma Satırı */}
                <div
                  className={`p-3 rounded-lg border ${
                    activeComparison?.uniMatch
                      ? "bg-teal-50/60 border-teal-200"
                      : "bg-red-50/70 border-red-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold">
                    <span>
                      AI Üniversite:{" "}
                      <strong className="underline">
                        {currentItem.aiUniversity}
                      </strong>
                    </span>
                    <span>
                      Sizin Kararınız:{" "}
                      <strong className="underline">
                        {activeComparison?.compareUni}
                      </strong>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600">
                      {currentItem.aiEducationSummary}
                    </span>
                    {activeComparison?.uniMatch ? (
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

                {/* Bölüm Karşılaştırma Satırı */}
                <div
                  className={`p-3 rounded-lg border ${
                    activeComparison?.deptMatch
                      ? "bg-teal-50/60 border-teal-200"
                      : "bg-red-50/70 border-red-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold">
                    <span>
                      AI Bölüm:{" "}
                      <strong className="underline">
                        {currentItem.aiDepartment}
                      </strong>
                    </span>
                    <span>
                      Sizin Kararınız:{" "}
                      <strong className="underline">
                        {activeComparison?.compareDept}
                      </strong>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600">
                      Tespit edilen bölümler:{" "}
                      {(currentItem.aiAllDepartments || []).join(", ") || "—"}
                    </span>
                    {activeComparison?.deptMatch ? (
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
                  {stats.uniLabeledCount} Üni/Bölüm/Derece Etiketlendi)
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
                    <th className="py-2.5 px-3 font-semibold">📱 Ben (Cinsiyet/Yaş/Üni/Bölüm/Derece)</th>
                    <th className="py-2.5 px-3 font-semibold">💻 Arkadaşım</th>
                    <th className="py-2.5 px-3 font-semibold">AI Tahmini (Üni / Bölüm / Derece / Yaş)</th>
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
                      const uOk =
                        !lbl.humanUniversity ||
                        isSameUniversity(it.aiUniversity, lbl.humanUniversity);
                      const dOk =
                        !lbl.humanDepartment ||
                        isSameDepartment(it.aiDepartment, lbl.humanDepartment);
                      const degOk =
                        !lbl.humanDegree ||
                        isSameDegree(lbl.humanDegree, it.aiDegree) ||
                        (it.aiAllDegrees || []).some((d) =>
                          isSameDegree(lbl.humanDegree || "", d)
                        );
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
                              ? `${vB.humanGender}, ${vB.humanAge ?? "—"}${
                                  vB.humanUniversity
                                    ? ` • ${vB.humanUniversity} (${vB.humanDepartment || "—"}${
                                        vB.humanDegree ? ` • ${vB.humanDegree}` : ""
                                      })`
                                    : ""
                                }`
                              : "—"}
                          </td>
                          <td className="py-2 px-3 font-semibold text-teal-800">
                            {vA
                              ? `${vA.humanGender}, ${vA.humanAge ?? "—"}${
                                  vA.humanUniversity
                                    ? ` • ${vA.humanUniversity} (${vA.humanDepartment || "—"}${
                                        vA.humanDegree ? ` • ${vA.humanDegree}` : ""
                                      })`
                                    : ""
                                }`
                              : "—"}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-zinc-900">
                              {it.aiUniversity}
                            </span>{" "}
                            — {it.aiDepartment} •{" "}
                            <span className="text-teal-800 font-semibold">
                              {it.aiDegree}
                            </span>{" "}
                            ({it.aiGender}, {it.aiAge ?? "—"})
                          </td>
                          <td className="py-2 px-3">
                            {lbl.consensusStatus === "conflict" ? (
                              <span className="text-amber-700 font-semibold">
                                Uzlaşma Bekleniyor
                              </span>
                            ) : gOk && aOk && uOk && dOk && degOk ? (
                              <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                                ✓ AI Doğru
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
