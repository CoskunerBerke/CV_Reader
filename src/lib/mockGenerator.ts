import {
  CandidateCV,
  CompanyProfile,
  detectAgeFromCV,
  detectGenderFromCV,
  extractEducationFromCV,
} from "./cvEngine";

export const INITIAL_COMPANIES: CompanyProfile[] = [
  {
    id: "comp-default",
    name: "Şirket Profilim",
    sector: "Kurumsal",
    roleTitle: "Genel Değerlendirme",
    naturalLanguagePrompt: "",
    targetGender: "Farketmez",
    minAge: 18,
    maxAge: 45,
    strictGender: false,
    strictAge: false,
    requiredSkills: [],
    preferredSkills: [],
    minExperienceYears: 0,
    learnedKeywordWeights: {},
    learnedUniversityBonus: false,
    feedbackCount: 0,
    approvedCandidateIds: [],
    rejectedCandidateIds: [],
  },
];

export function buildCandidateFromRaw(
  id: string,
  fullName: string,
  rawText: string,
  experienceYears: number,
  educationLevel: string,
  university: string,
  city: string,
  extractedTags: string[],
  source = "Yüklenen CV"
): CandidateCV {
  const genderRes = detectGenderFromCV(fullName, rawText);
  const ageRes = detectAgeFromCV(rawText);
  const eduRes = extractEducationFromCV(rawText);

  const finalUni =
    university && university !== "Belirtilmemiş"
      ? university
      : eduRes.university;
  const finalDeg =
    eduRes.degree && eduRes.degree !== "Belirtilmemiş"
      ? eduRes.degree
      : educationLevel || "Lisans (Bachelor's)";

  return {
    id,
    fullName,
    rawText,
    uploadedAt: new Date().toISOString().slice(0, 10),
    source,
    detectedGender: genderRes.gender,
    genderConfidence: genderRes.confidence,
    genderEvidence: genderRes.evidence,
    detectedAge: ageRes.age,
    ageMethod: ageRes.method,
    ageConfidence: ageRes.confidence,
    ageEvidence: ageRes.evidence,
    experienceYears,
    educationLevel: finalDeg,
    university: finalUni,
    department: eduRes.department,
    allUniversities: eduRes.allUniversities,
    allDepartments: eduRes.allDepartments,
    allDegrees: eduRes.allDegrees,
    educationByDegree: eduRes.educationByDegree,
    educationSummary: eduRes.educationSummary,
    city,
    extractedTags,
    feedbackStatus: {},
  };
}

export const INITIAL_CANDIDATES: CandidateCV[] = [];
