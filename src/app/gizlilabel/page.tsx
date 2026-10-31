"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  Brain,
  FileText,
  Eye,
  RotateCcw,
  ArrowLeft,
  RefreshCw,
  Globe,
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
import {
  AppLang,
  LANG_STORAGE_KEY,
  translateGender,
  translateEduField,
} from "@/lib/i18n";

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
  cardTitleTr: string;
  cardTitleEn: string;
  uniLabelTr: string;
  uniLabelEn: string;
  deptLabelTr: string;
  deptLabelEn: string;
  prefixLabel: string;
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
    prefixLabel: "Ön Lisans",
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
    prefixLabel: "Lisans",
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
    prefixLabel: "Master",
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

  // Dil Seçeneği (TR / EN)
  const [lang, setLang] = useState<AppLang>("tr");

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
      if (savedLang === "tr" || savedLang === "en") {
        setLang(savedLang);
        document.documentElement.lang = savedLang;
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
  const [saveMessageKey, setSaveMessageKey] = useState<
    "" | "agreed" | "conflict" | "saved" | "error"
  >("");

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

  const isRaterFullyDone = useCallback((it: BenchmarkCVItem, role: RaterId) => {
    const v = it.humanLabel?.votes?.[role];
    return !!(v && v.humanUniversity && v.humanDepartment && v.humanDegree);
  }, []);

  useEffect(() => {
    try {
      const savedRole = localStorage.getItem(RATER_STORAGE_KEY);
      if (savedRole === "ben" || savedRole === "arkadasim") {
        setActiveRater(savedRole);
      }
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

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setSyncing(true);
    try {
      const res = await fetch(`/api/ground-truth?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "x-gizli-label-access": "internal-gizlilabel-v1",
        },
      });
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
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
          const firstUnlabeledIdx = (
            data.items as BenchmarkCVItem[]
          ).findIndex((it) => {
            const v = it.humanLabel?.votes?.[role];
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
      if (!silent) setLoading(false);
      else setSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(false);
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
      return items.filter(
        (it) => it.humanLabel?.consensusStatus === "conflict"
      );
    }
    if (filterMode === "mismatched") {
      return items.filter((it) => {
        if (!it.humanLabel) return false;
        const genderMismatch = it.aiGender !== it.humanLabel.humanGender;
        const ageMismatch =
          it.humanLabel.humanAge !== null &&
          (it.aiAge === null ||
            Math.abs(it.aiAge - it.humanLabel.humanAge) > 1);
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
    setSaveMessageKey("");
  }, [currentItem?.fileName, activeRater]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const diff =
          it.aiAge !== null ? Math.abs(it.aiAge - lbl.humanAge) : 999;
        if (diff === 0) ageExactCorrect++;
        if (diff <= 1) {
          ageCloseCorrect++;
        } else {
          isAgeCloseOk = false;
        }
      } else {
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
        if (
          isSameUniversity(
            it.aiUniversity,
            lbl.humanUniversity,
            it.aiAllUniversities || []
          )
        ) {
          uniCorrect++;
        } else {
          isUniOk = false;
        }
      }

      let isDeptOk = true;
      if (lbl.humanDepartment && lbl.humanDepartment.trim().length > 0) {
        deptLabeledCount++;
        if (
          isSameDepartment(
            it.aiDepartment,
            lbl.humanDepartment,
            it.aiAllDepartments || []
          )
        ) {
          deptCorrect++;
        } else {
          isDeptOk = false;
        }
      }

      let isDegOk = true;
      if (lbl.humanDegree && lbl.humanDegree.trim().length > 0) {
        degLabeledCount++;
        if (
          isSameDegree(it.aiDegree, lbl.humanDegree, it.aiAllDegrees || [])
        ) {
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
        headers: {
          "Content-Type": "application/json",
          "x-gizli-label-access": "internal-gizlilabel-v1",
        },
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

        if (data.label.consensusStatus === "agreed") {
          setSaveMessageKey("agreed");
        } else if (data.label.consensusStatus === "conflict") {
          setSaveMessageKey("conflict");
        } else {
          setSaveMessageKey("saved");
        }

        if (autoNext) {
          setTimeout(() => {
            if (filterMode === "all") {
              const nextUnlabeledAfter = updatedList.findIndex(
                (it, idx) =>
                  idx > currentIndex && !isRaterFullyDone(it, activeRater)
              );
              const anyUnlabeled =
                nextUnlabeledAfter !== -1
                  ? nextUnlabeledAfter
                  : updatedList.findIndex(
                      (it) => !isRaterFullyDone(it, activeRater)
                    );
              if (anyUnlabeled !== -1) {
                setCurrentIndex(anyUnlabeled);
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
      setSaveMessageKey("error");
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

  const t = {
    backToApp: lang === "en" ? "Main Application" : "Ana Uygulama",
    labeledCount: (done: number, total: number) =>
      lang === "en"
        ? `Labeled: ${done} / ${total} CVs`
        : `Etiketlenen: ${done} / ${total} CV`,
    metricGender: lang === "en" ? "Gender" : "Cinsiyet",
    metricAge: lang === "en" ? "Age (Exact / ±1)" : "Yaş (Tam / ±1)",
    metricUni:
      lang === "en" ? "University Accuracy" : "Üniversite Başarısı",
    metricDept:
      lang === "en" ? "Department Accuracy" : "Bölüm Başarısı",
    metricDeg: lang === "en" ? "Degree Accuracy" : "Derece Başarısı",
    metricOverall:
      lang === "en" ? "Overall AI Accuracy" : "Genel AI Başarısı",
    refreshTooltip:
      lang === "en" ? "Refresh from Cloud Now" : "Canlı Buluttan Şimdi Yenile",
    jsonTooltip:
      lang === "en"
        ? "Download Ground-Truth Labels as JSON"
        : "Etiketleri JSON olarak indir",
    resetTooltip:
      lang === "en" ? "Reset all labels" : "Tüm etiketleri sıfırla",
    lowAccTitle: (acc: number) =>
      lang === "en"
        ? `Warning: Real AI Accuracy dropped to ${acc}% (below 90%)!`
        : `Uyarı: AI Gerçek Başarı Yüzdesi %${acc} seviyesine (%90 altına) düştü!`,
    lowAccSub:
      lang === "en"
        ? "Every ground-truth label saved to the cloud is learned by the system."
        : "Buluta kaydedilen her etiket sistem tarafından öğrenilmektedir.",
    loadingText:
      lang === "en"
        ? "Loading 53 CVs and cloud benchmark records..."
        : "53 CV ve bulut verileri yükleniyor...",
    emptyFilterText:
      lang === "en"
        ? "No CVs remaining in this filter."
        : "Bu filtrede gösterilecek CV kalmadı.",
    showAllBtn: (count: number) =>
      lang === "en" ? `Show All ${count} CVs` : `Tüm ${count} CV'yi Göster`,
    fullScreenPdf: lang === "en" ? "Full Screen PDF ↗" : "Tam Ekran PDF ↗",
    originalPdf: lang === "en" ? "Original PDF" : "Orijinal PDF",
    extractedText: lang === "en" ? "Extracted Text" : "Okunan Metin",
    textNotRead:
      lang === "en"
        ? "Text could not be extracted (may be a scanned image)."
        : "Metin okunamadı (Taranmış görüntü olabilir).",
    prevBtn: lang === "en" ? "Previous" : "Önceki",
    nextBtn: lang === "en" ? "Next" : "Sonraki",
    jumpUnlabeledBtn:
      lang === "en"
        ? "⏭️ Already Labeled — Jump to First Unlabeled CV"
        : "⏭️ Bu CV'yi Zaten Yaptın — Kaldığım Yere (İlk Yapmadığım CV'ye) Atla",
    tabAll: (count: number) =>
      lang === "en" ? `All (${count})` : `Tümü (${count})`,
    tabRemaining: (count: number) =>
      lang === "en" ? `Remaining (${count})` : `Kalan (${count})`,
    formTitle:
      lang === "en"
        ? "CV Ground-Truth Labeling & Verification"
        : "CV Etiketleme & Doğrulama",
    formSub:
      lang === "en"
        ? "Inspect the CV on the left to verify University, Department, Degree (TR/EN), Gender, and Age"
        : "Soldaki CV'ye bakarak Üniversite, Bölüm, Derece (TR/EN), Cinsiyet ve Yaşı onaylayın",
    badgeDone:
      lang === "en"
        ? "✓ Uni, Dept & Degree Complete"
        : "✓ Üni, Bölüm & Derece Tamam",
    extraCaseTitle:
      lang === "en"
        ? "📌 SPECIAL CASE: No Birth Date or University Entry Year in CV!"
        : "📌 EKSTRA CASE: CV'de Yaş ve Üniversite Giriş Tarihi Yok!",
    extraCaseSub:
      lang === "en"
        ? "This candidate stated neither a date of birth nor a university entry/graduation year in their CV."
        : "Bu aday CV'sinde ne doğum tarihini ne de üniversite giriş/mezuniyet yılını belirtmiş.",
    degSectionLabel:
      lang === "en" ? "Academic Degree" : "Eğitim Derecesi",
    degSectionHint:
      lang === "en"
        ? "Each selected degree opens its own card below"
        : "Seçilen her derece aşağıda ayrı açılır",
    trEnAccepted:
      lang === "en" ? "TR or EN accepted" : "TR / EN fark etmez",
    uniPlaceholder: (shortName: string) =>
      lang === "en"
        ? `e.g., ${shortName} University`
        : `Örn: ${shortName} Üniversitesi`,
    deptPlaceholder: (shortName: string) =>
      lang === "en"
        ? `e.g., ${shortName} Department`
        : `Örn: ${shortName} Bölümü`,
    candidateNameLabel:
      lang === "en" ? "Candidate Full Name" : "Aday Adı Soyadı",
    verifiedGenderLabel:
      lang === "en" ? "Verified Gender *" : "Gerçek Cinsiyet *",
    maleBtn: lang === "en" ? "Male" : "Erkek",
    femaleBtn: lang === "en" ? "Female" : "Kadın",
    verifiedAgeLabel:
      lang === "en"
        ? "Verified Age (2026 Reference Year) *"
        : "Gerçek Yaş (2026 Güncel Yıl Bazlı) *",
    noAgeSelectedBadge:
      lang === "en"
        ? "🚫 No Age / Edu Date Selected"
        : "🚫 Yaş & Üni Tarihi Yok Seçili",
    noAgePlaceholder:
      lang === "en"
        ? "🚫 No Age or Edu Date"
        : "🚫 Yaş & Üni Tarihi Yok",
    savingBtn:
      lang === "en" ? "Saving to Cloud..." : "Buluta Kaydediliyor...",
    saveAndNextBtn:
      lang === "en"
        ? "Save (Including Uni, Dept & Degree) & Next"
        : "Üni, Bölüm & Derece Dahil Kaydet ve Sonrakine Geç",
    saveMsgAgreed:
      lang === "en"
        ? "🔒 Consensus reached and locked in cloud!"
        : "🔒 Ortak karar kesinleşti ve buluta kaydedildi!",
    saveMsgConflict:
      lang === "en"
        ? "⚡ Saved to cloud!"
        : "⚡ Buluta kaydedildi!",
    saveMsgSaved:
      lang === "en"
        ? "✓ Ground-truth label saved to cloud."
        : "✓ Etiket ortak buluta kaydedildi.",
    saveMsgError:
      lang === "en"
        ? "⚠️ Connection error while saving."
        : "⚠️ Kaydedilirken bağlantı hatası oluştu.",
    liveTableTitle: (total: number, uniCount: number) =>
      lang === "en"
        ? `Live Ground-Truth Table (${total} CVs Labeled • ${uniCount} Uni/Dept/Degree Verified)`
        : `Canlı Etiketleme Tablosu (${total} CV Etiketlendi • ${uniCount} Üni/Bölüm/Derece Etiketlendi)`,
    liveTableSub:
      lang === "en"
        ? "All saved ground-truth labels are automatically synchronized via cloud"
        : "Kaydedilen tüm etiketler bulut üzerinden otomatik eşitlenir",
    thFileCandidate:
      lang === "en" ? "File / Candidate" : "Dosya / Aday",
    thSavedLabel:
      lang === "en"
        ? "Saved Ground-Truth (Gender / Age / Uni / Dept / Degree)"
        : "Kaydedilen Etiket (Cinsiyet / Yaş / Üni / Bölüm / Derece)",
    thAiPred:
      lang === "en"
        ? "AI Prediction (Uni / Dept / Degree / Age)"
        : "AI Tahmini (Üni / Bölüm / Derece / Yaş)",
    thAiResult: lang === "en" ? "AI Result" : "AI Sonucu",
    aiCorrectBadge: lang === "en" ? "✓ AI Correct" : "✓ AI Doğru",
    aiWrongBadge: lang === "en" ? "✗ AI Mismatch" : "✗ AI Yanıldı",
  };

  const renderedSaveMessage =
    saveMessageKey === "agreed"
      ? t.saveMsgAgreed
      : saveMessageKey === "conflict"
      ? t.saveMsgConflict
      : saveMessageKey === "saved"
      ? t.saveMsgSaved
      : saveMessageKey === "error"
      ? t.saveMsgError
      : "";

  return (
    <div className="relative min-h-screen bg-[#cbc4b4] text-[#141c2b] overflow-x-hidden">
      {/* ARKA PLAN DÖNGÜ VİDEOSU & GÖZ YORMAYAN KOYU KUMTAŞI / ARDUVAZ KATMAN */}
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
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-[#c4bdb0]/82 via-[#ccc5b7]/76 to-[#beb7a8]/85 backdrop-blur-[1.5px]" />
      </div>

      {/* ÜST BAR: CANLI SKOR TABLOSU VE TR/EN DİL SEÇİMİ (Koyu Oxford Arduvaz) */}
      <header className="bg-[#182235]/95 backdrop-blur-md border-b border-[#2c3a52] sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-md border border-[#384966] bg-[#212f47] hover:bg-[#2a3b57] text-xs font-semibold flex items-center gap-1.5 text-[#f0ece1] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#93c5fd]" />
              {t.backToApp}
            </Link>

            {/* TEKİL ETİKETLEME DURUM GÖSTERGESİ */}
            <div className="flex items-center bg-[#e2dcd0] text-[#182235] px-3 py-1.5 rounded-lg text-xs font-bold gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#182235]" />
              <span>
                {t.labeledCount(
                  items.filter((i) => isRaterFullyDone(i, "ben")).length,
                  items.length
                )}
              </span>
            </div>

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
          </div>

          {/* CANLI GERÇEK BAŞARI KARTLARI */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-2.5 py-1.5 rounded-lg border border-[#33435e] bg-[#212f47] text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#b8b2a6] font-semibold">
                {t.metricGender}
              </div>
              <div className="text-sm font-bold text-[#f0ece1]">
                {stats.totalLabeled === 0 ? "—" : `%${stats.genderAccuracy}`}
                <span className="text-[11px] text-[#b8b2a6] font-normal ml-1">
                  ({stats.genderCorrect}/{stats.totalLabeled})
                </span>
              </div>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg border border-[#33435e] bg-[#212f47] text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#b8b2a6] font-semibold">
                {t.metricAge}
              </div>
              <div className="text-sm font-bold text-[#f0ece1]">
                {stats.ageLabeledCount === 0
                  ? "—"
                  : `%${stats.ageExactAccuracy} / %${stats.ageCloseAccuracy}`}
                <span className="text-[11px] text-[#b8b2a6] font-normal ml-1">
                  ({stats.ageExactCorrect}/{stats.ageLabeledCount})
                </span>
              </div>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg border border-[#33435e] bg-[#212f47] text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#93c5fd] font-bold">
                {t.metricUni}
              </div>
              <div className="text-sm font-bold text-[#f0ece1]">
                {stats.uniLabeledCount === 0 ? "—" : `%${stats.uniAccuracy}`}
                <span className="text-[11px] text-[#b8b2a6] font-normal ml-1">
                  ({stats.uniCorrect}/{stats.uniLabeledCount})
                </span>
              </div>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg border border-[#33435e] bg-[#212f47] text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#93c5fd] font-bold">
                {t.metricDept}
              </div>
              <div className="text-sm font-bold text-[#f0ece1]">
                {stats.deptLabeledCount === 0 ? "—" : `%${stats.deptAccuracy}`}
                <span className="text-[11px] text-[#b8b2a6] font-normal ml-1">
                  ({stats.deptCorrect}/{stats.deptLabeledCount})
                </span>
              </div>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg border border-[#33435e] bg-[#212f47] text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#93c5fd] font-bold">
                {t.metricDeg}
              </div>
              <div className="text-sm font-bold text-[#f0ece1]">
                {stats.degLabeledCount === 0 ? "—" : `%${stats.degAccuracy}`}
                <span className="text-[11px] text-[#b8b2a6] font-normal ml-1">
                  ({stats.degCorrect}/{stats.degLabeledCount})
                </span>
              </div>
            </div>

            <div
              className={`px-3 py-1.5 rounded-lg border text-center ${
                stats.totalLabeled === 0
                  ? "border-[#33435e] bg-[#212f47] text-[#f0ece1]"
                  : stats.overallAccuracy >= 90
                  ? "border-[#e2dcd0] bg-[#e2dcd0] text-[#182235]"
                  : "border-red-400 bg-red-950 text-red-100"
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold">
                {t.metricOverall}
              </div>
              <div className="text-base font-extrabold">
                {stats.totalLabeled === 0
                  ? "0 / 53"
                  : `%${stats.overallAccuracy}`}
              </div>
            </div>

            <button
              onClick={() => fetchAll(true)}
              title={t.refreshTooltip}
              className="p-2 border border-[#33435e] rounded-lg hover:bg-[#2a3b57] text-[#d2ccc0] bg-[#212f47] cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  syncing ? "animate-spin text-[#93c5fd]" : ""
                }`}
              />
            </button>

            {stats.totalAnyLabeled > 0 && (
              <button
                onClick={handleExportLabelsJson}
                title={t.jsonTooltip}
                className="px-2.5 py-2 border border-[#33435e] rounded-lg hover:bg-[#2a3b57] text-xs font-semibold text-[#f0ece1] bg-[#212f47] cursor-pointer"
              >
                📥 JSON
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* %90 ALTI UYARI BANNER'I */}
        {stats.totalLabeled > 0 && stats.overallAccuracy < 90 && (
          <div className="bg-red-950/90 border border-red-400/50 rounded-lg p-3.5 flex items-center justify-between gap-3 text-xs text-red-100">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-300 shrink-0" />
              <div>
                <strong>{t.lowAccTitle(stats.overallAccuracy)}</strong>{" "}
                {t.lowAccSub}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-[#e2dcd0]/95 border border-[#b8b0a0] rounded-xl p-12 text-center text-sm text-[#333d4f]">
            {t.loadingText}
          </div>
        ) : !currentItem ? (
          <div className="bg-[#e2dcd0]/95 border border-[#b8b0a0] rounded-xl p-12 text-center space-y-3">
            <p className="text-sm font-semibold">{t.emptyFilterText}</p>
            <button
              onClick={() => {
                setFilterMode("all");
                setCurrentIndex(0);
              }}
              className="px-4 py-2 bg-[#182235] text-[#f0ece1] rounded-md text-xs font-medium cursor-pointer"
            >
              {t.showAllBtn(items.length)}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* SOL SÜTUN (7 Sütun): ORİJİNAL PDF GÖRÜNTÜLEYİCİ VEYA HAM METİN */}
            <div className="lg:col-span-7 bg-[#e2dcd0]/95 backdrop-blur-md border border-[#b8b0a0] rounded-xl overflow-hidden shadow-xs">
              <div className="px-4 py-3 border-b border-[#c4bdb0] bg-[#d6cfc0] flex flex-wrap items-center justify-between gap-2">
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
                    {t.fullScreenPdf}
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
                    {t.originalPdf}
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
                    {t.extractedText}
                  </button>
                </div>
              </div>

              {viewMode === "pdf" ? (
                <iframe
                  key={currentItem.fileName}
                  src={`/api/ground-truth/pdf?file=${encodeURIComponent(
                    currentItem.fileName
                  )}`}
                  className="w-full h-[680px] border-0 bg-[#cfc8b8]"
                  title={currentItem.fileName}
                />
              ) : (
                <pre className="w-full h-[680px] overflow-y-auto p-4 bg-[#182235] text-[#e2dcd0] text-xs font-mono-academic whitespace-pre-wrap leading-relaxed">
                  {currentItem.rawText || t.textNotRead}
                </pre>
              )}
            </div>

            {/* SAĞ SÜTUN (5 Sütun): TEKİL ETİKETLEME FORMU */}
            <div className="lg:col-span-5 space-y-4">
              {/* 1. GEZİNME VE FİLTRE KUTUSU */}
              <div className="bg-[#e2dcd0]/95 backdrop-blur-md border border-[#b8b0a0] rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <button
                    disabled={currentIndex <= 0}
                    onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
                    className="px-3 py-1.5 rounded-md border border-[#aba393] bg-[#ece7db] hover:border-[#182235] disabled:opacity-40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t.prevBtn}
                  </button>

                  <select
                    value={currentIndex}
                    onChange={(e) => setCurrentIndex(Number(e.target.value))}
                    className="flex-1 border border-[#aba393] rounded-md px-2.5 py-1.5 text-xs font-medium bg-[#ece7db] truncate"
                  >
                    {filteredItems.map((it, idx) => {
                      const iDidIt = isRaterFullyDone(it, "ben");
                      const icon = iDidIt ? "✅" : "⚪";
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
                    className="px-3 py-1.5 rounded-md border border-[#aba393] bg-[#ece7db] hover:border-[#182235] disabled:opacity-40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {t.nextBtn}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {isRaterFullyDone(currentItem, "ben") &&
                  stats.myLabeledCount < items.length && (
                    <button
                      type="button"
                      onClick={() => jumpToFirstUnlabeledForRole(items, "ben")}
                      className="w-full py-2 px-3 rounded-lg bg-[#182235] hover:bg-[#22304a] text-[#f0ece1] text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      {t.jumpUnlabeledBtn}
                    </button>
                  )}

                {/* Hızlı Filtre Sekmeleri */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      setFilterMode("all");
                      setCurrentIndex(0);
                    }}
                    className={`py-1.5 rounded text-[11px] font-semibold cursor-pointer ${
                      filterMode === "all"
                        ? "bg-[#182235] text-[#f0ece1]"
                        : "bg-[#d5cec0] text-[#273142] hover:bg-[#cbc3b3]"
                    }`}
                  >
                    {t.tabAll(items.length)}
                  </button>
                  <button
                    onClick={() => {
                      setFilterMode("my_unlabeled");
                      setCurrentIndex(0);
                    }}
                    className={`py-1.5 rounded text-[11px] font-semibold cursor-pointer ${
                      filterMode === "my_unlabeled"
                        ? "bg-[#182235] text-[#f0ece1]"
                        : "bg-[#d5cec0] text-[#273142] hover:bg-[#cbc3b3]"
                    }`}
                  >
                    {t.tabRemaining(items.length - stats.myLabeledCount)}
                  </button>
                </div>
              </div>

              {/* 2. GERÇEK ETİKET (GROUND TRUTH GİRİŞ FORMU) */}
              <div className="bg-[#e2dcd0]/95 backdrop-blur-md border-2 border-[#182235] rounded-xl p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#c4bdb0] pb-2.5">
                  <div>
                    <h2 className="font-serif-academic text-base font-bold text-[#121926]">
                      {t.formTitle}
                    </h2>
                    <p className="text-[11px] text-[#3b4454]">{t.formSub}</p>
                  </div>
                  {isRaterFullyDone(currentItem, "ben") && (
                    <span className="px-2 py-0.5 rounded bg-[#182235] text-[#f0ece1] text-[11px] font-bold">
                      {t.badgeDone}
                    </span>
                  )}
                </div>

                {/* EKSTRA CASE UYARI KUTUSU */}
                {activeComparison?.isExtraCaseNoDate && (
                  <div className="p-3 rounded-lg bg-[#e8dcc4] border border-amber-700/40 text-xs text-amber-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      {t.extraCaseTitle}
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-900">
                      {t.extraCaseSub}
                    </p>
                  </div>
                )}

                {/* HER EĞİTİM DERECESİ İÇİN AYRI ÜNİVERSİTE VE BÖLÜM KARTLARI */}
                <div className="p-3.5 rounded-xl bg-[#d6cfc0] border border-[#b8b0a0] space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-[#121926]">
                        {t.degSectionLabel}
                      </label>
                      <span className="text-[11px] text-[#3b4454]">
                        {t.degSectionHint}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {DEGREE_OPTIONS.map((deg) => {
                        const active = hasDegreeSelected(
                          inputDegree,
                          deg.value
                        );
                        const primaryLabel =
                          lang === "en" ? deg.shortEn : deg.shortTr;
                        const secondaryLabel =
                          lang === "en" ? deg.shortTr : deg.shortEn;
                        return (
                          <button
                            key={deg.value}
                            type="button"
                            onClick={() => handleToggleDegreeButton(deg.value)}
                            className={`px-2.5 py-2 rounded-lg text-center border transition-all cursor-pointer ${
                              active
                                ? "bg-[#182235] text-[#f0ece1] border-[#182235] shadow-2xs"
                                : "bg-[#ece7db] text-[#273142] border-[#aba393] hover:border-[#182235]"
                            }`}
                          >
                            <div className="text-xs font-bold leading-tight">
                              {active ? `✓ ${primaryLabel}` : primaryLabel}
                            </div>
                            <div
                              className={`text-[10px] leading-tight mt-0.5 ${
                                active ? "text-[#93c5fd]" : "text-[#525b6c]"
                              }`}
                            >
                              {secondaryLabel}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SEÇİLİ HER DERECE İÇİN AYRI ÜNİVERSİTE & BÖLÜM KUTUSU */}
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
                      const shortName =
                        lang === "en" ? deg.shortEn : deg.shortTr;
                      return (
                        <div
                          key={deg.key}
                          className="p-3 rounded-lg bg-[#e2dcd0] border border-[#b8b0a0] space-y-2.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between border-b border-[#c4bdb0] pb-1.5">
                            <span className="text-xs font-extrabold text-[#182235]">
                              🎓{" "}
                              {lang === "en" ? deg.cardTitleEn : deg.cardTitleTr}
                            </span>
                            <span className="text-[10px] text-[#4a5363] font-medium">
                              {t.trEnAccepted}
                            </span>
                          </div>

                          {/* Dereceye Özel Üniversite */}
                          <div>
                            <label className="block text-[11px] font-bold text-[#273142] mb-1">
                              {lang === "en" ? deg.uniLabelEn : deg.uniLabelTr}
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
                              placeholder={t.uniPlaceholder(shortName)}
                              className="w-full border border-[#aba393] bg-[#ece7db] rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-[#121926] focus:outline-none focus:border-[#182235]"
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
                                            ? "bg-[#182235] text-[#f0ece1] border-[#182235]"
                                            : "bg-[#d6cfc0] text-[#273142] border-[#aba393] hover:bg-[#cbc3b3]"
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
                            <label className="block text-[11px] font-bold text-[#273142] mb-1">
                              {lang === "en"
                                ? deg.deptLabelEn
                                : deg.deptLabelTr}
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
                              placeholder={t.deptPlaceholder(shortName)}
                              className="w-full border border-[#aba393] bg-[#ece7db] rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-[#121926] focus:outline-none focus:border-[#182235]"
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
                                            ? "bg-[#182235] text-[#f0ece1] border-[#182235]"
                                            : "bg-[#d6cfc0] text-[#273142] border-[#aba393] hover:bg-[#cbc3b3]"
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
                  <label className="block text-xs font-semibold text-[#273142] mb-1">
                    {t.candidateNameLabel}
                  </label>
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    className="w-full border border-[#aba393] bg-[#ece7db] rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-[#182235]"
                  />
                </div>

                {/* Gerçek Cinsiyet Seçimi */}
                <div>
                  <label className="block text-xs font-semibold text-[#273142] mb-1.5">
                    {t.verifiedGenderLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setInputGender("Erkek")}
                      className={`py-2 px-4 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        inputGender === "Erkek"
                          ? "bg-[#182235] border-[#182235] text-[#f0ece1] shadow-2xs"
                          : "bg-[#ece7db] border-[#aba393] text-[#273142] hover:border-[#182235]"
                      }`}
                    >
                      {t.maleBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputGender("Kadın")}
                      className={`py-2 px-4 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        inputGender === "Kadın"
                          ? "bg-[#182235] border-[#182235] text-[#f0ece1] shadow-2xs"
                          : "bg-[#ece7db] border-[#aba393] text-[#273142] hover:border-[#182235]"
                      }`}
                    >
                      {t.femaleBtn}
                    </button>
                  </div>
                </div>

                {/* Gerçek Yaş Girişi */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#273142]">
                      {t.verifiedAgeLabel}
                    </label>
                    {inputAge.trim() === "" && (
                      <span className="px-2 py-0.5 rounded bg-amber-900/15 text-amber-950 text-[11px] font-bold">
                        {t.noAgeSelectedBadge}
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
                      className="px-3 py-1.5 border border-[#aba393] rounded-lg bg-[#ece7db] hover:bg-[#d6cfc0] font-bold text-xs cursor-pointer"
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
                      placeholder={t.noAgePlaceholder}
                      className="flex-1 border border-[#aba393] bg-[#ece7db] rounded-lg px-3 py-1.5 text-center text-sm font-bold focus:outline-none focus:border-[#182235] placeholder:text-xs placeholder:font-semibold placeholder:text-amber-800"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setInputAge((prev) =>
                          String(Math.min(75, (parseInt(prev, 10) || 24) + 1))
                        )
                      }
                      className="px-3 py-1.5 border border-[#aba393] rounded-lg bg-[#ece7db] hover:bg-[#d6cfc0] font-bold text-xs cursor-pointer"
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
                    className="w-full py-2.5 px-4 rounded-lg bg-[#182235] hover:bg-[#22304a] text-[#f0ece1] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-colors"
                  >
                    <Check className="w-4 h-4 text-[#93c5fd]" />
                    {saving ? t.savingBtn : t.saveAndNextBtn}
                  </button>

                  {renderedSaveMessage && (
                    <div className="text-xs font-semibold text-[#182235] text-center">
                      {renderedSaveMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ALT TABLO: ETİKETLENEN TÜM CV'LER VE AI KARŞILAŞTIRMA ÖZETİ */}
        {stats.totalAnyLabeled > 0 && (
          <section className="bg-[#e2dcd0]/95 backdrop-blur-md border border-[#b8b0a0] rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-[#c4bdb0] bg-[#d6cfc0] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#182235]" />
                <h3 className="font-serif-academic text-sm font-bold text-[#121926]">
                  {t.liveTableTitle(
                    stats.totalAnyLabeled,
                    stats.uniLabeledCount
                  )}
                </h3>
              </div>
              <span className="text-xs text-[#3b4454]">{t.liveTableSub}</span>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#182235] text-[#f0ece1] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">#</th>
                    <th className="py-2.5 px-3 font-semibold">
                      {t.thFileCandidate}
                    </th>
                    <th className="py-2.5 px-3 font-semibold">
                      {t.thSavedLabel}
                    </th>
                    <th className="py-2.5 px-3 font-semibold">{t.thAiPred}</th>
                    <th className="py-2.5 px-3 font-semibold">
                      {t.thAiResult}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c4bdb0]">
                  {items
                    .filter((it) => it.humanLabel !== null)
                    .map((it) => {
                      const lbl = it.humanLabel!;
                      const vB = lbl.votes?.ben || lbl;
                      const gOk = it.aiGender === lbl.humanGender;
                      const aDiff =
                        lbl.humanAge !== null && it.aiAge !== null
                          ? Math.abs(it.aiAge - lbl.humanAge)
                          : 0;
                      const aOk = lbl.humanAge === null || aDiff <= 1;
                      const uOk =
                        !lbl.humanUniversity ||
                        isSameUniversity(
                          it.aiUniversity,
                          lbl.humanUniversity,
                          it.aiAllUniversities || []
                        );
                      const dOk =
                        !lbl.humanDepartment ||
                        isSameDepartment(
                          it.aiDepartment,
                          lbl.humanDepartment,
                          it.aiAllDepartments || []
                        );
                      const degOk =
                        !lbl.humanDegree ||
                        isSameDegree(
                          it.aiDegree,
                          lbl.humanDegree,
                          it.aiAllDegrees || []
                        );
                      return (
                        <tr
                          key={it.fileName}
                          onClick={() => {
                            setFilterMode("all");
                            setCurrentIndex(it.index - 1);
                          }}
                          className="hover:bg-[#d6cfc0] cursor-pointer"
                        >
                          <td className="py-2 px-3 font-mono-academic text-[#4a5363]">
                            #{it.index}
                          </td>
                          <td className="py-2 px-3 font-medium text-[#121926]">
                            {lbl.humanName || it.aiName}{" "}
                            <span className="text-[#4a5363] font-normal">
                              ({it.fileName})
                            </span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-[#121926]">
                            {vB
                              ? `${translateGender(vB.humanGender, lang)}, ${
                                  vB.humanAge ?? "—"
                                }${
                                  vB.humanUniversity
                                    ? ` • ${translateEduField(
                                        vB.humanUniversity,
                                        lang
                                      )} (${translateEduField(
                                        vB.humanDepartment || "—",
                                        lang
                                      )}${
                                        vB.humanDegree
                                          ? ` • ${translateEduField(
                                              vB.humanDegree,
                                              lang
                                            )}`
                                          : ""
                                      })`
                                    : ""
                                }`
                              : "—"}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-[#121926]">
                              {translateEduField(it.aiUniversity, lang)}
                            </span>{" "}
                            — {translateEduField(it.aiDepartment, lang)} •{" "}
                            <span className="text-[#182235] font-semibold">
                              {translateEduField(it.aiDegree, lang)}
                            </span>{" "}
                            ({translateGender(it.aiGender, lang)},{" "}
                            {it.aiAge ?? "—"})
                          </td>
                          <td className="py-2 px-3">
                            {gOk && aOk && uOk && dOk && degOk ? (
                              <span className="px-2 py-0.5 rounded bg-[#182235] text-[#f0ece1] font-bold">
                                {t.aiCorrectBadge}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-red-900/20 text-red-950 font-bold">
                                {t.aiWrongBadge}
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
