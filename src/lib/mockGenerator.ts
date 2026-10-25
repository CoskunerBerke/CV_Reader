import {
  CandidateCV,
  CompanyProfile,
  detectAgeFromCV,
  detectGenderFromCV,
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
    educationLevel,
    university,
    city,
    extractedTags,
    feedbackStatus: {},
  };
}

export const INITIAL_CANDIDATES: CandidateCV[] = [];
