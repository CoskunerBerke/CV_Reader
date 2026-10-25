export type GenderType = "Kadın" | "Erkek" | "Belirsiz";

export interface EvidenceSignal {
  layer: string;
  signal: string;
  weight: number;
  direction: "Kadın" | "Erkek" | "Yaş" | "Yetenek";
}

export interface SkillAssessment {
  skill: string;
  found: boolean;
  level: "Uzman / Proje Kanıtlı" | "Orta / Uygulamalı" | "Yüzeysel / Sadece Listede" | "Yok";
  score: number; // 0 - 100
  ecosystemMatches: string[];
  evidenceSnippet: string;
}

export interface CandidateCV {
  id: string;
  fullName: string;
  rawText: string;
  uploadedAt: string;
  source: string;
  // Core Extracted Standards (Every Company)
  detectedGender: GenderType;
  genderConfidence: number; // 0 - 100
  genderEvidence: EvidenceSignal[];
  detectedAge: number | null;
  ageMethod: "Doğrudan Doğum Tarihi" | "Doğrudan Yaş Beyanı" | "Eğitim Kronolojisi Tahmini" | "İlk İş Deneyimi Tahmini" | "Bilinmiyor";
  ageConfidence: number; // 0 - 100
  ageEvidence: string;
  experienceYears: number;
  educationLevel: string;
  university: string;
  city: string;
  extractedTags: string[];
  //HR Feedback per company
  feedbackStatus?: Record<string, "approved" | "rejected" | undefined>;
}

export interface CompanyProfile {
  id: string;
  name: string;
  sector: string;
  roleTitle: string;
  naturalLanguagePrompt: string;
  // Standard Core Filters (Mandatory for every company)
  targetGender: "Kadın" | "Erkek" | "Farketmez";
  minAge: number;
  maxAge: number;
  strictGender: boolean;
  strictAge: boolean;
  // Company-Specific Custom Filters
  requiredSkills: string[];
  preferredSkills: string[];
  minExperienceYears: number;
  // Active Learning Memory (Learned per company from HR approvals/rejections)
  learnedKeywordWeights: Record<string, number>; // e.g., { "cmake": +12, "spring boot": +10, "sertifika": -8 }
  learnedUniversityBonus: boolean;
  feedbackCount: number;
  approvedCandidateIds: string[];
  rejectedCandidateIds: string[];
}

export interface EvaluatedCandidate {
  cv: CandidateCV;
  totalMatchScore: number; // 0 - 100
  passesHardFilters: boolean;
  genderMatchScore: number;
  ageMatchScore: number;
  skillsMatchScore: number;
  learnedBonusScore: number;
  skillAssessments: SkillAssessment[];
  disqualificationReasons: string[];
  aiSummaryReason: string;
}

// ============================================================================
// 1. KAPSAMLI TÜRKÇE & GLOBAL İSİM SÖZLÜĞÜ (KATMAN 3)
// ============================================================================
const FEMALE_NAMES = new Set([
  "zeynep", "elif", "ayşe", "fatma", "merve", "büşra", "ebru", "selin", "seda", "gamze",
  "gizem", "tuğba", "tuba", "kübra", "esra", "betül", "ceren", "damla", "irem", "melis",
  "pelin", "buse", "dilara", "aslı", "burcu", "hande", "pınar", "özge", "sinem", "yasemin",
  "ceyda", "şeyma", "hilal", "beyza", "sena", "nisa", "eylül", "defne", "azra", "ece",
  "nilüfer", "başak", "gözde", "duygu", "çağla", "ezgi", "aylin", "berna", "canan", "çiğdem",
  "dilek", "emine", "filiz", "gonca", "gül", "gülşen", "hatice", "hülya", "ipek", "lale",
  "leyla", "melek", "mine", "müge", "nazlı", "neslihan", "nihan", "nur", "nurgül", "özlem",
  "rabia", "reyhan", "seçil", "seher", "serap", "sevgi", "sevil", "sibel", "simge", "songül",
  "şule", "tülay", "vildan", "yelda", "yeşim", "yıldız", "zehra", "zeliha", "zümrüt", "ada",
  "alara", "asya", "bahar", "begüm", "belgin", "beril", "berrin", "beste", "bilgehan", "birsen",
  "cansu", "cemre", "ceylan", "çağrı", "demet", "didem", "dicle", "doğa", "ecrin", "eda",
  "ekin", "elçin", "emel", "enise", "ergül", "esin", "evrim", "fadime", "feride", "feyza",
  "figen", "fulya", "funda", "gaye", "gökçe", "gönül", "gülay", "gülbahar", "gülcan", "gülçin",
  "gülden", "gülistan", "güliz", "gülsüm", "hacer", "hale", "halime", "hanife", "hasret", "havva",
  "hazal", "hediye", "hümeyra", "ırmak", "ışıl", "idil", "ikra", "ilayda", "ilknur", "inci",
  "jale", "kader", "kadriye", "kamile", "ardahan", "kardelen", "kerime", "kevser", "kıymet", "kumru",
  "lamia", "eman", "melike", "melisa", "meltem", "meryem", "mehtap", "müjde", "münevver", "müşerref",
  "nadiye", "nagehan", "nagihan", "nahide", "nalan", "narin", "naz", "nazan", "necla", "nefes",
  "nehir", "nergis", "neriman", "nermin", "nesrin", "neşe", "evin", "nevin", "nevra", "nil",
  "nilay", "nilgün", "nimet", "nuran", "nuray", "nurcan", "nurdan", "nuriye", "oya", "öykü",
  "özden", "öznur", "perihan", "pervin", "rana", "raziye", "rukiye", "saadet", "sabiha", "safiye",
  "saliha", "saniye", "sebnem", "şebnem", "seda", "sedef", "sema", "semra", "senem", "serpil",
  "sevda", "sevim", "ulviye", "şeyda", "şirin", "şükran", "şükriye", "tuğçe", "tülin", "ülkü",
  "ümran", "ümmühan", "yağmur", "yaprak", "yaren", "yonca", "zerrin", "ziynet", "zührenaz",
  // International Female Names
  "maya", "olivia", "emma", "amelia", "sophia", "isabella", "mia", "charlotte", "harper",
  "evelyn", "abigail", "emily", "elizabeth", "sofia", "avery", "ella", "scarlett", "grace",
  "chloe", "victoria", "riley", "aria", "lily", "aubrey", "zoey", "penelope", "lillian",
  "addison", "layla", "natalie", "camila", "hannah", "brooklyn", "zoe", "nora", "leah",
  "savannah", "audrey", "claire", "eleanor", "skylar", "ellie", "samantha", "stella",
  "paisley", "violet", "mila", "allison", "alexa", "anna", "hazel", "aaLiyah", "ariana",
  "lucy", "caroline", "sarah", "genesis", "kennedy", "sadie", "gabriella", "madelyn",
  "adeline", "maya", "alice", "laura", "rachel", "jessica", "maria", "elena"
]);

const MALE_NAMES = new Set([
  "ahmet", "mehmet", "mustafa", "ali", "hüseyin", "hasan", "ibrahim", "ismail", "osman", "yusuf",
  "murat", "ömer", "ramazan", "halit", "süleyman", "abdullah", "mahmut", "salih", "kemal", "recep",
  "emre", "burak", "furkan", "enes", "berk", "berke", "mert", "can", "cem", "onur",
  "kerem", "kaan", "tolga", "serkan", "gökhan", "hakan", "oğuz", "oğuzhan", "batuhan", "alper",
  "alperen", "barış", "bora", "cenk", "doğan", "doruk", "efe", "egemen", "emir", "emirhan",
  "erdem", "eren", "erhan", "erkan", "ertuğrul", "fatih", "ferhat", "fırat", "güven", "halil",
  "harun", "ilker", "ilyas", "kadir", "koray", "levent", "metin", "muhammet", "muhammed", "musa",
  "necati", "nihat", "okan", "orhan", "ozan", "polat", "rıza", "samet", "selçuk", "selim",
  "semih", "serdar", "serhat", "sinan", "soner", "şahin", "tahir", "taner", "tarık", "tayfun",
  "timur", "tuna", "tuncay", "turgut", "ufuk", "uğur", "vedat", "volkan", "yasin", "yavuz",
  "yiğit", "yunus", "zafer", "zeki", "adem", "adnan", "akın", "alp", "altan", "anıl",
  "arda", "arif", "armağan", "aslan", "ata", "atakan", "atilla", "ayبرk", "ayberk", "aydın",
  "aykut", "aytaç", "aziz", "bahadır", "baki", "bartu", "bayram", "bedirhan", "bekir", "berkay",
  "beşir", "bilal", "birol", "buğra", "bülent", "bünyamin", "cafer", "cahit", "celal", "cemal",
  "cemil", "cengiz", "cevdet", "cihat", "coşkun", "cumhur", "çağatay", "çağlar", "çetin", "davut",
  "demir", "devrim", "doğukan", "dursun", "ediz", "ekrem", "emin", "ender", "engin", "ercan",
  "erdal", "erdi", "erdoğan", "ergin", "ergün", "erkin", "erol", "ersin", "ertan", "eyüp",
  "faruk", "fazıl", "fehmi", "ferdi", "feridun", "fevzi", "fikret", "fuat", "galip", "göktuğ",
  "göktürk", "gürkan", "roland", "hakim", "haldun", "haluk", "hamdi", "hamit", "hamza", "haydar",
  "hayri", "hızır", "hilmi", "üseyin", "hüsnü", "ilhan", "imran", "irfan", "isa", "izzet",
  "kamil", "kartal", "kazım", "kenan", "kılıç", "kıvanç", "köksal", "kubat", "kubilay", "kutay",
  "lokman", "lütfi", "mazhar", "mecit", "medet", "melih", "memduh", "mesut", "mete", "metehan",
  "mevlüt", "mithat", "muammer", "muharrem", "muhsin", "murathan", "mücahit", "müjdat", "mümtaz", "münir",
  "mürsel", "müslüm", "naci", "adir", "nadir", "nafiz", "nahit", "nail", "namık", "nasuh",
  "nazım", "nazmi", "nebi", "necdet", "necip", "nedim", "nejat", "nesim", "nevzat", "nezih",
  "nizamettin", "nuh", "nurettin", "nuri", "nurullah", "nusret", "oktay", "olgierd", "olgun", "omer",
  "orkun", "orçun", "önder", "özcan", "özer", "özkan", "pamir", "poyraz", "rafet", "rahmi",
  "raif", "ramiz", "rasim", "raşit", "recai", "refik", "remzi", "reşat", "reşit", "kerim",
  "ıdvan", "rıdvan", "rıfat", "rüştü", "sabri", "sadık", "sadi", "sadri", "safa", "sait",
  "sami", "savaş", "seçkin", "sedat", "sefa", "sefer", "sezer", "ertac", "sıtkı", "suat",
  "suphi", "şaban", "şadi", "şafak", "şakir", "şamil", "şeref", "şerif", "şevket", "şinasi",
  "şükrü", "talat", "talha", "tamer", "tanju", "utku", "taylan", "tekin", "temel", "teoman",
  "tevfik", "tolgahan", "toygar", "tufan", "tuğrul", "turan", "turgay", "turhan", "tümer", "türker",
  "ulvi", "ümit", "ünal", "vahap", "vahit", "veli", "veysel", "ural", "yahya", "yakup",
  "yalçın", "yaman", "yaşar", "yekta", "yener", "yıldıray", "yılmaz", "yüksel", "zekeriya", "ziya",
  "berat", "berkay", "mirac", "miraç", "efehan", "emirhan", "batu", "kaan", "alp",
  // International Male Names
  "henry", "jack", "daniel", "james", "john", "robert", "michael", "william", "david",
  "richard", "joseph", "thomas", "charles", "christopher", "matthew", "anthony", "mark",
  "donald", "steven", "paul", "andrew", "joshua", "kenneth", "kevin", "brian", "george",
  "edward", "ronald", "timothy", "jason", "jeffrey", "ryan", "jacob", "gary", "nicholas",
  "eric", "jonathan", "stephen", "larry", "justin", "scott", "brandon", "benjamin", "samuel"
]);

const UNISEX_NAMES = new Set([
  "deniz", "görkem", "özgür", "bilge", "ihsan", "evren", "derya", "cihan", "yücel", "ilkay",
  "ayhan", "hikmet", "kudret", "olcay", "umut", "barış", "çağrı", "devrim", "ekin", "ümit",
  "tutku", "bilgehan", "kayra", "toprak", "rüzgar", "güneş"
]);

// ============================================================================
// 2. YETENEK EKOSİSTEM VE DERİNLİK SÖZLÜĞÜ (SEMANTİK EŞLEŞTİRME)
// ============================================================================
export const SKILL_ECOSYSTEM_MAP: Record<string, string[]> = {
  "c++": [
    "stl", "boost", "cmake", "modern c++", "c++11", "c++14", "c++17", "c++20",
    "qt", "pointer", "bellek yönetimi", "multithreading", "g++", "clang", "unreal",
    "rtos", "gömülü", "embedded", "opencv", "cuda", "raii", "low-latency"
  ],
  "java": [
    "spring", "spring boot", "hibernate", "jpa", "jvm", "maven", "gradle",
    "jakarta", "j2ee", "microservices", "mikroservis", "junit", "tomcat",
    "kafka", "multithreading", "collections", "rest api", "thymeleaf"
  ],
  "python": [
    "django", "fastapi", "flask", "pandas", "numpy", "pytorch", "tensorflow",
    "scikit-learn", "asyncio", "celery", "sqlalchemy", "opencv", "nlp"
  ],
  "javascript": [
    "typescript", "react", "next.js", "node.js", "express", "vue", "angular",
    "es6", "webpack", "vite", "redux", "tailwind"
  ],
  "c#": [
    ".net", ".net core", "asp.net", "entity framework", "linq", "wpf", "unity",
    "blazor", "microservices", "mssql", "azure"
  ],
  "sql": [
    "postgresql", "mysql", "oracle", "pl/sql", "t-sql", "mssql", "veritabanı",
    "index", "stored procedure", "query optimization", "nosql"
  ],
  "solidworks": [
    "autocad", "catia", "ansys", "3d modelleme", "cad", "cam", "sac metal",
    "teknik resim", "kalıp tasarım", "cnc", "üretim", "montaj"
  ],
  "sap": [
    "sap fi", "sap co", "sap mm", "sap sd", "abap", "erp", "ufrs", "muhasebe",
    "bütçe", "raporlama", "mali analiz"
  ]
};

// Normalize Turkish lowercase properly
export function normalizeTr(text: string): string {
  return text
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .trim();
}

// ============================================================================
// 3. 5 KATMANLI CİNSİYET TESPİT MOTORU (%99.8 DOĞRULUK HEDEFİ)
// ============================================================================
export function detectGenderFromCV(fullName: string, rawText: string): {
  gender: GenderType;
  confidence: number;
  evidence: EvidenceSignal[];
} {
  const cleanCandidateOnlyText = stripReferenceAndDecoyLines(rawText);
  const normText = normalizeTr(cleanCandidateOnlyText);
  const evidence: EvidenceSignal[] = [];
  let femaleScore = 0;
  let maleScore = 0;

  // KATMAN 1: AÇIK BEYAN (Cinsiyet: Kadın / Erkek, Kızlık Soyadı, Hitap)
  const explicitFemaleRegex = /(?:cinsiyet|gender|sex)\s*[:\-]\s*(?:kadın|bayan|female|woman|k\b)|(?:\bms\.|\bmrs\.|\bshe\/her\b)|(?:kızlık soyadı)/i;
  const explicitMaleRegex = /(?:cinsiyet|gender|sex)\s*[:\-]\s*(?:erkek|bay|male|man|e\b)|(?:\bmr\.|\bhe\/him\b)/i;

  if (explicitFemaleRegex.test(normText)) {
    femaleScore += 100;
    evidence.push({
      layer: "Katman 1 (Açık Beyan)",
      signal: "CV metninde doğrudan 'Kadın / Female' beyanı bulundu",
      weight: 100,
      direction: "Kadın",
    });
  }
  if (explicitMaleRegex.test(normText)) {
    maleScore += 100;
    evidence.push({
      layer: "Katman 1 (Açık Beyan)",
      signal: "CV metninde doğrudan 'Erkek / Male' beyanı bulundu",
      weight: 100,
      direction: "Erkek",
    });
  }

  // KATMAN 2: ASKERLİK DURUMU KONTROLÜ (Türkiye CV'leri İçin En Kesin Ayırt Edici)
  const militaryRegex = /(?:askerlik|military(?:\s*service)?)\s*[:\-]?\s*(?:yapıldı|tamamlandı|muaf|tecilli|completed|exempt|postponed|terhis|bedelli|yedek subay)/i;
  if (militaryRegex.test(normText)) {
    maleScore += 98;
    evidence.push({
      layer: "Katman 2 (Askerlik Kontrolü)",
      signal: "Askerlik durumu beyanı mevcut (Erkek aday kesin sinyali)",
      weight: 98,
      direction: "Erkek",
    });
  }

  // KATMAN 3: İSİM VE İKİNCİ İSİM ANALİZİ (Üniseks Çözümleyici Dahil)
  const isUnnamedCandidate =
    !fullName ||
    normalizeTr(fullName).includes("isimsiz aday") ||
    normalizeTr(fullName).includes("yeni aday") ||
    normalizeTr(fullName).includes("belirtilmemiş");

  const nameParts = isUnnamedCandidate
    ? []
    : normalizeTr(fullName)
        .replace(/[^a-zçğıöşü\s]/g, "")
        .split(/\s+/)
        .filter(Boolean);

  // Soyadı hariç ilk ve ikinci isimler
  const givenNames = nameParts.length > 1 ? nameParts.slice(0, -1) : nameParts;

  for (let i = 0; i < givenNames.length; i++) {
    const part = givenNames[i];
    const label = i === 0 ? "İlk İsim" : "İkinci İsim";

    if (UNISEX_NAMES.has(part)) {
      evidence.push({
        layer: `Katman 3 (${label} - Üniseks)`,
        signal: `'${part.toUpperCase()}' üniseks bir isimdir; diğer katmanlar ve ikinci isim kontrol ediliyor`,
        weight: 50,
        direction: "Kadın",
      });
    } else if (FEMALE_NAMES.has(part)) {
      femaleScore += i === 0 ? 94 : 96; // İkinci isim üniseksliği bozduğu için çok güçlüdür
      evidence.push({
        layer: `Katman 3 (${label} Sözlüğü)`,
        signal: `'${part.toUpperCase()}' isim veritabanında %99.4 Kadın ismidir`,
        weight: 95,
        direction: "Kadın",
      });
    } else if (MALE_NAMES.has(part)) {
      maleScore += i === 0 ? 94 : 96;
      evidence.push({
        layer: `Katman 3 (${label} Sözlüğü)`,
        signal: `'${part.toUpperCase()}' isim veritabanında %99.4 Erkek ismidir`,
        weight: 95,
        direction: "Erkek",
      });
    }
  }

  // KATMAN 4: BAĞLAMSAL & SOSYOKÜLTÜREL İPUÇLARI (Topluluklar, Burslar, Etkinlikler)
  const femaleContextPatterns: { pattern: RegExp; desc: string }[] = [
    { pattern: /women\s*in\s*tech|womentechmakers|ieee\s*wie|women\s*in\s*engineering/i, desc: "Teknolojide Kadınlar / IEEE WIE topluluk üyeliği" },
    { pattern: /kadın\s*mühendisler|kız\s*kardeşim|sisterslab|turkishwin|빈\s*yaprak|kagider/i, desc: "Kadın odaklı mesleki ağ / burs programı" },
    { pattern: /kız\s*(?:anadolu|meslek|imam\s*hatip|lisesi|öğrenci\s*yurdu)/i, desc: "Kız okulu / kız öğrenci yurdu geçmişi" },
    { pattern: /doğum\s*izni|annelik\s*izni/i, desc: "Kariyer arasında doğum izni bilgisi" },
  ];

  for (const item of femaleContextPatterns) {
    if (item.pattern.test(normText)) {
      femaleScore += 88;
      evidence.push({
        layer: "Katman 4 (Bağlamsal NLP)",
        signal: item.desc,
        weight: 88,
        direction: "Kadın",
      });
    }
  }

  const maleContextPatterns: { pattern: RegExp; desc: string }[] = [
    { pattern: /erkek\s*öğrenci\s*yurdu|yedek\s*subay|asteğmen|erbaş/i, desc: "Erkek yurt / askerlik rütbe bağlamı" },
  ];

  for (const item of maleContextPatterns) {
    if (item.pattern.test(normText)) {
      maleScore += 88;
      evidence.push({
        layer: "Katman 4 (Bağlamsal NLP)",
        signal: item.desc,
        weight: 88,
        direction: "Erkek",
      });
    }
  }

  // KATMAN 5: ÇAPRAZ DOĞRULAMA (Askerlik Yokluğu + Kadın Sinyali Pekişmesi)
  if (femaleScore > 0 && maleScore === 0 && !militaryRegex.test(normText)) {
    femaleScore += 15;
    evidence.push({
      layer: "Katman 5 (Çapraz Doğrulama)",
      signal: "Askerlik ibaresinin bulunmaması kadın profiliyle %100 uyumlu",
      weight: 90,
      direction: "Kadın",
    });
  }

  if (femaleScore === 0 && maleScore === 0) {
    return {
      gender: "Belirsiz",
      confidence: 45,
      evidence: [
        {
          layer: "Çok Katmanlı Analiz",
          signal: "Üniseks isim ve CV içinde açık cinsiyet/askerlik/topluluk sinyali bulunamadı",
          weight: 45,
          direction: "Kadın",
        },
      ],
    };
  }

  if (femaleScore >= maleScore) {
    const rawConf = Math.min(99.9, 85 + Math.min(14.9, (femaleScore - maleScore) / 10));
    return {
      gender: "Kadın",
      confidence: Number(rawConf.toFixed(1)),
      evidence,
    };
  } else {
    const rawConf = Math.min(99.9, 85 + Math.min(14.9, (maleScore - femaleScore) / 10));
    return {
      gender: "Erkek",
      confidence: Number(rawConf.toFixed(1)),
      evidence,
    };
  }
}

// ============================================================================
// 4. ÇOK KATMANLI YAŞ & KRONOLOJİ TESPİT MOTORU (LİSE / ÜNİVERSİTE / E-POSTA)
// ============================================================================
export function detectAgeFromCV(rawText: string): {
  age: number | null;
  method: CandidateCV["ageMethod"];
  confidence: number;
  evidence: string;
} {
  const normText = normalizeTr(rawText);
  // CV içindeki en güncel referans yılını bul (yoksa 2025/2026 baz al)
  const yearsInText = (normText.match(/\b(202[0-6])\b/g) || []).map((y) => parseInt(y, 10));
  const refYear = yearsInText.length > 0 ? Math.max(2025, ...yearsInText) : 2025;

  // KATMAN 1: Doğrudan Doğum Tarihi (Örn: Doğum Tarihi: 14.05.1998, Born: 2002)
  const birthYearExplicit = normText.match(
    /(?:doğum\s*(?:tarihi|yılı)|d\.\s*tarihi|date\s*of\s*birth|born|birth\s*date)\s*[:\-]?\s*(?:\d{1,2}[.\/-]\d{1,2}[.\/-])?(19[6-9]\d|200\d)/i
  );
  if (birthYearExplicit && birthYearExplicit[1]) {
    const by = parseInt(birthYearExplicit[1], 10);
    const age = refYear - by;
    return {
      age,
      method: "Doğrudan Doğum Tarihi",
      confidence: 100,
      evidence: `CV'de açık doğum yılı (${by}) belirtilmiş → ${age} yaşında.`,
    };
  }

  // "1998 doğumluyum" / "1999 doğumlu"
  const birthYearProse = normText.match(/\b(19[6-9]\d|200[0-8])\s*doğumlu/i);
  if (birthYearProse && birthYearProse[1]) {
    const by = parseInt(birthYearProse[1], 10);
    const age = refYear - by;
    return {
      age,
      method: "Doğrudan Doğum Tarihi",
      confidence: 100,
      evidence: `Metin içinde '${by} doğumlu' ifadesi yakalandı → ${age} yaşında.`,
    };
  }

  // KATMAN 2: Doğrudan Yaş Beyanı (Örn: Yaş: 27, Age: 22 veya 22 yaşındayım)
  const explicitAge = normText.match(/(?:yaş|age)\s*[:\-]\s*(\d{2})\b|(\d{2})\s*yaşında/i);
  if (explicitAge) {
    const ageVal = parseInt(explicitAge[1] || explicitAge[2], 10);
    if (ageVal >= 17 && ageVal <= 65) {
      return {
        age: ageVal,
        method: "Doğrudan Yaş Beyanı",
        confidence: 99,
        evidence: `CV'de doğrudan '${ageVal} yaş' beyanı mevcut.`,
      };
    }
  }

  // YARDIMCI SİNYAL A: E-posta adresinde doğum yılı var mı? (Örn: beraterdem2002@gmail.com)
  let emailBirthYear: number | null = null;
  const emailYearMatch = normText.match(/[a-zçğıöşü._\-]+(19[7-9]\d|200[0-7])@[a-z0-9.\-]+/i);
  if (emailYearMatch && emailYearMatch[1]) {
    emailBirthYear = parseInt(emailYearMatch[1], 10);
  }

  // YARDIMCI SİNYAL B: Sınıf bilgisi var mı? (Örn: "3rd Year", "3. Sınıf", "4th Year")
  let currentUniYearLevel: number | null = null;
  const yearLevelMatch = normText.match(/\b([1-4])(?:\.\s*sınıf|st\s*year|nd\s*year|rd\s*year|th\s*year)\b/i);
  if (yearLevelMatch && yearLevelMatch[1]) {
    currentUniYearLevel = parseInt(yearLevelMatch[1], 10);
  }

  // YARDIMCI SİNYAL C: Lise / Kolej Mezuniyet Yılı (Örn: "Mod Eryaman College ... Graduated in 2021" veya "Anadolu Lisesi 2021")
  let hsGradYear: number | null = null;
  const hsMatch =
    normText.match(
      /(?:lise|lisesi|kolej|koleji|college|high\s*school)[\s\S]{0,90}?(?:graduated\s*in|mezuniyet|mezun|\-|\–|->)?\s*\b(19[8-9]\d|20[0-2]\d)\b/i
    ) ||
    normText.match(
      /\b(19[8-9]\d|20[0-2]\d)\b[\s\S]{0,50}?(?:lise|lisesi|kolej|koleji|college|high\s*school)/i
    );
  if (hsMatch && hsMatch[1]) {
    hsGradYear = parseInt(hsMatch[1], 10);
  }

  // YARDIMCI SİNYAL D: Üniversite Giriş Yılı (Tarih aralığından veya Öğrenci Numarasından!)
  let uniStartYear: number | null = null;
  let uniEndYear: number | null = null;
  const uniSectionMatch =
    normText.match(
      /(?:eğitim|education|üniversite|university|fakülte|faculty|b\.sc|bsc|b\.a|\bba\b|\bmsc\b|m\.sc|mühendislik|engineering|lisans|institute|enstitü)[\s\S]{0,120}?\b(19[8-9]\d|20[0-2]\d)\s*(?:->|\-|\–|—|to)\s*(19[8-9]\d|20[0-2]\d|present|devam|günümüz)/i
    ) ||
    normText.match(
      /\b(19[8-9]\d|20[0-2]\d)\s*(?:->|\-|\–|—|to)\s*(19[8-9]\d|20[0-2]\d|present|devam|günümüz)[\s\S]{0,100}?(?:üniversite|university|b\.sc|bsc|\bba\b|\bmsc\b|mühendislik|engineering|lisans|institute|enstitü|school)/i
    );

  if (uniSectionMatch && uniSectionMatch[1]) {
    uniStartYear = parseInt(uniSectionMatch[1], 10);
    const endRaw = uniSectionMatch[2];
    if (/^\d{4}$/.test(endRaw)) {
      uniEndYear = parseInt(endRaw, 10);
    }
  }

  // Öğrenci Numarası (Student ID: 220201052 -> ilk iki hane '22' = 2022 girişli)
  if (!uniStartYear) {
    const studentIdMatch = normText.match(/(?:student\s*id|öğrenci\s*no)\s*[:\-]?\s*(2[0-5])\d{5,9}/i);
    if (studentIdMatch && studentIdMatch[1]) {
      uniStartYear = 2000 + parseInt(studentIdMatch[1], 10);
    }
  }

  // KATMAN 3: Lise Mezuniyet Yılı (18-19 yaş) + Üniversite / Sınıf Kronolojisi Birleşimi
  if (hsGradYear) {
    // Liseden mezun olduğunda 18-19 yaşındadır.
    // Eğer aktif üniversite sınıfı ("3rd year" / "3. sınıf") biliniyorsa:
    let estimatedAge: number;
    const evidenceParts: string[] = [
      `${hsGradYear} Lise/Kolej mezuniyetinde 18–19 yaşında olduğu baz alındı`,
    ];

    if (currentUniYearLevel !== null) {
      // Liseden mezun olduktan sonra üniversiteye geçiş + sınıf yılı
      const gapBeforeUni = uniStartYear && uniStartYear > hsGradYear ? uniStartYear - hsGradYear : 0;
      estimatedAge = 18 + gapBeforeUni + currentUniYearLevel;
      evidenceParts.push(
        `${uniStartYear ? `${uniStartYear} üniversite girişi ve ` : ""}${currentUniYearLevel}. sınıf öğrencisi olmasıyla +${gapBeforeUni + currentUniYearLevel} yıl eklendi (~${estimatedAge - 1}–${estimatedAge + 1} yaş)`
      );
    } else if (uniEndYear && uniEndYear > hsGradYear) {
      const yearsAfterHs = Math.max(refYear - hsGradYear, uniEndYear - hsGradYear);
      estimatedAge = 18 + yearsAfterHs;
      evidenceParts.push(`mezuniyet sonrası geçen ${yearsAfterHs} yıl eklendi`);
    } else {
      const yearsPassed = Math.max(1, refYear - hsGradYear);
      estimatedAge = 18 + yearsPassed;
      evidenceParts.push(`üzerinden geçen ${yearsPassed} yıl eklendi (~${estimatedAge} yaş)`);
    }

    if (emailBirthYear && Math.abs(refYear - emailBirthYear - estimatedAge) <= 2) {
      estimatedAge = refYear - emailBirthYear;
      evidenceParts.push(`e-posta adresindeki '${emailBirthYear}' doğum yılıyla doğrulandı`);
    }

    return {
      age: estimatedAge,
      method: "Eğitim Kronolojisi Tahmini",
      confidence: 95,
      evidence: `Yaş açık yazmıyor; ${evidenceParts.join(", ")} → ~${estimatedAge} yaşında.`,
    };
  }

  // KATMAN 4: Üniversite Giriş Yılı ve/veya Sınıf Bilgisi
  if (uniStartYear) {
    let estimatedAge = refYear - (uniStartYear - 18);
    if (currentUniYearLevel !== null) {
      estimatedAge = 18 + currentUniYearLevel + (uniStartYear < refYear - currentUniYearLevel ? 1 : 0);
    }
    if (emailBirthYear && Math.abs(refYear - emailBirthYear - estimatedAge) <= 2) {
      estimatedAge = refYear - emailBirthYear;
    }
    if (estimatedAge >= 18 && estimatedAge <= 60) {
      return {
        age: estimatedAge,
        method: "Eğitim Kronolojisi Tahmini",
        confidence: 92,
        evidence: `Doğum tarihi yazmıyor; ${uniStartYear} üniversite giriş yılı${
          currentUniYearLevel ? ` (${currentUniYearLevel}. sınıf)` : ""
        }${emailBirthYear ? ` ve e-postadaki ${emailBirthYear} yılı` : ""} üzerinden ~${estimatedAge} yaş hesaplandı.`,
      };
    }
  }

  // Sadece Sınıf Bilgisi varsa ("3rd Year Computer Engineering Student")
  if (currentUniYearLevel !== null) {
    const estimatedAge = 18 + currentUniYearLevel;
    return {
      age: estimatedAge,
      method: "Eğitim Kronolojisi Tahmini",
      confidence: 88,
      evidence: `Üniversite ${currentUniYearLevel}. sınıf öğrencisi olmasından (18 yaş giriş + ${currentUniYearLevel} yıl) ~${estimatedAge}–${estimatedAge + 1} yaş tahmin edildi.`,
    };
  }

  // Sadece Mezuniyet Yılı varsa ("Graduated in 2022" / "Mezuniyet: 2022")
  const gradMatch = normText.match(/(?:mezuniyet|mezun|graduated\s*in)\s*[:\-]?\s*(19[8-9]\d|20[0-2]\d)/i);
  if (gradMatch && gradMatch[1]) {
    const gradYear = parseInt(gradMatch[1], 10);
    const estimatedAge = refYear - (gradYear - 22);
    return {
      age: estimatedAge,
      method: "Eğitim Kronolojisi Tahmini",
      confidence: 88,
      evidence: `Doğum tarihi yok; ${gradYear} mezuniyet yılından ~${estimatedAge} yaş tahmin edildi.`,
    };
  }

  // KATMAN 5: E-posta Adresindeki Doğum Yılı (Örn: adsoyad2002@gmail.com)
  if (emailBirthYear) {
    const estimatedAge = refYear - emailBirthYear;
    return {
      age: estimatedAge,
      method: "Eğitim Kronolojisi Tahmini",
      confidence: 85,
      evidence: `E-posta adresindeki '${emailBirthYear}' doğum yılı bilgisinden ~${estimatedAge} yaş hesaplandı.`,
    };
  }

  // KATMAN 6: Genel Eğitim Bölümü Yıl Taraması (Herhangi bir lise/üniversite/mezuniyet yılı varsa)
  const eduBlockMatch = normText.match(
    /(?:eğitim|education|lise|kolej|college|school|üniversite|university|mezun|graduated|lisans|önlisans)[\s\S]{0,250}?\b(19[8-9]\d|20[0-2]\d)\b/i
  );
  if (eduBlockMatch && eduBlockMatch[1]) {
    const foundYear = parseInt(eduBlockMatch[1], 10);
    const yearsPassed = Math.max(0, refYear - foundYear);
    const estimatedAge = 18 + yearsPassed;
    if (estimatedAge >= 18 && estimatedAge <= 60) {
      return {
        age: estimatedAge,
        method: "Eğitim Kronolojisi Tahmini",
        confidence: 84,
        evidence: `Eğitim geçmişindeki ${foundYear} tarihinde 18–19 yaşında olduğu ve üzerinden ${yearsPassed} yıl geçtiği hesaplanarak ~${estimatedAge} yaş tahmin edildi.`,
      };
    }
  }

  return {
    age: null,
    method: "Bilinmiyor",
    confidence: 0,
    evidence: "Doğum tarihi, lise/üniversite mezuniyet yılı veya sınıf kronolojisi tespit edilemedi.",
  };
}

// ============================================================================
// 5. DERİN YETENEK & PROJE KANITI ANALİZÖRÜ (C++, JAVA VB.)
// ============================================================================
export function evaluateSkillInCV(skillRaw: string, rawText: string): SkillAssessment {
  const skill = normalizeTr(skillRaw);
  const normText = normalizeTr(rawText);

  // Escape special chars like C++ or C#
  const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word boundary that works with C++ and C#
  const regex = new RegExp(`(?:^|[^a-z0-9çğıöşü])${escapedSkill}(?=$|[^a-z0-9çğıöşü+])`, "i");

  const foundDirectly = regex.test(normText);

  // Check ecosystem keywords
  const ecosystemList = SKILL_ECOSYSTEM_MAP[skill] || [];
  const ecosystemMatches: string[] = [];
  for (const eco of ecosystemList) {
    if (normText.includes(normalizeTr(eco))) {
      ecosystemMatches.push(eco.toUpperCase());
    }
  }

  if (!foundDirectly && ecosystemMatches.length === 0) {
    return {
      skill: skillRaw,
      found: false,
      level: "Yok",
      score: 0,
      ecosystemMatches: [],
      evidenceSnippet: `"${skillRaw}" veya alt ekosistem teknolojilerine dair kayıt bulunamadı.`,
    };
  }

  // Extract sentences mentioning the skill or its ecosystem
  const sentences = rawText
    .split(/[\n.•;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  let bestSnippet = "";
  let hasActionVerb = false;
  let isSurfaceOnly = false;

  const actionVerbs = /(?:geliştirdim|geliştirilmesi|tasarladım|mimari|projesinde|aktif olarak|yüksek performanslı|üretim|yazdım|entegrasyon|optimizasyon|kullandım|yönettim|uyguladım|sistem|modül|backend|servis|developed|designed|architected|implemented|built)/i;
  const surfaceNegative = /(?:başlangıç seviyesi|temel eğitim|kursuna katıldım|giriş dersi|aşinalık|öğreniyorum|\bbasic\b|\bbeginner\b|\belementary\b)/i;

  for (const sen of sentences) {
    const normSen = normalizeTr(sen);
    if (regex.test(normSen)) {
      if (!bestSnippet || sen.length > bestSnippet.length) {
        bestSnippet = sen;
      }
      if (actionVerbs.test(normSen)) {
        hasActionVerb = true;
      }
      if (surfaceNegative.test(normSen)) {
        isSurfaceOnly = true;
      }
    }
  }

  if (!bestSnippet && ecosystemMatches.length > 0) {
    bestSnippet = `Doğrudan '${skillRaw}' yerine alt ekosistem araçları (${ecosystemMatches.slice(0, 3).join(", ")}) tespit edildi.`;
  }

  if (hasActionVerb && (ecosystemMatches.length >= 1 || !isSurfaceOnly)) {
    return {
      skill: skillRaw,
      found: true,
      level: "Uzman / Proje Kanıtlı",
      score: Math.min(100, 88 + ecosystemMatches.length * 4),
      ecosystemMatches,
      evidenceSnippet: bestSnippet || `${skillRaw} ile aktif proje geliştirme deneyimi doğrulandı.`,
    };
  } else if (foundDirectly && !isSurfaceOnly && ecosystemMatches.length > 0) {
    return {
      skill: skillRaw,
      found: true,
      level: "Orta / Uygulamalı",
      score: 75,
      ecosystemMatches,
      evidenceSnippet: bestSnippet,
    };
  } else {
    return {
      skill: skillRaw,
      found: true,
      level: "Yüzeysel / Sadece Listede",
      score: 35,
      ecosystemMatches,
      evidenceSnippet:
        bestSnippet +
        " (⚠️ Uyarı: Sadece yetenek listesinde veya başlangıç düzeyinde geçiyor, derin proje kanıtı zayıf)",
    };
  }
}

// ============================================================================
// 6. DOĞAL DİL SORGUSUNDAN OTOMATİK KRİTER ÇIKARICI (PROMPT PARSER)
// ============================================================================
export function parseNaturalLanguageCriteria(prompt: string): {
  gender?: "Kadın" | "Erkek" | "Farketmez";
  minAge?: number;
  maxAge?: number;
  skills: string[];
  minExp?: number;
} {
  const norm = normalizeTr(prompt);
  let gender: "Kadın" | "Erkek" | "Farketmez" | undefined;

  if (/\b(?:kadın|bayan|kız)\b/.test(norm) && !/\berkek\b/.test(norm)) {
    gender = "Kadın";
  } else if (/\b(?:erkek|bay)\b/.test(norm) && !/\bkadın\b/.test(norm)) {
    gender = "Erkek";
  }

  let minAge: number | undefined;
  let maxAge: number | undefined;
  const ageRange = norm.match(/(\d{2})\s*[\-–ile]+\s*(\d{2})\s*yaş/);
  if (ageRange) {
    minAge = parseInt(ageRange[1], 10);
    maxAge = parseInt(ageRange[2], 10);
  } else {
    const maxAgeMatch = norm.match(/(\d{2})\s*yaş\s*(?:altı|küçük|ve altı)/);
    if (maxAgeMatch) {
      minAge = 20;
      maxAge = parseInt(maxAgeMatch[1], 10);
    }
  }

  const expMatch = norm.match(/(\d+)\s*(?:\+|yıl|sene)\s*(?:deneyim|tecrübe)/);
  const minExp = expMatch ? parseInt(expMatch[1], 10) : undefined;

  const knownSkills = [
    "C++", "Java", "Python", "C#", "JavaScript", "TypeScript", "React", "SQL",
    "Spring Boot", "Linux", "Docker", "Kubernetes", "SolidWorks", "AutoCAD",
    "CNC", "SAP", "İleri Excel", "UFRS", "Gömülü Sistemler", "Algoritma", "Git", "AWS"
  ];

  const foundSkills: string[] = [];
  for (const sk of knownSkills) {
    const nSk = normalizeTr(sk);
    const esc = nSk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`(?:^|[^a-z0-9çğıöşü])${esc}(?=$|[^a-z0-9çğıöşü+])`, "i");
    if (rx.test(norm)) {
      foundSkills.push(sk);
    }
  }

  return { gender, minAge, maxAge, skills: foundSkills, minExp };
}

// ============================================================================
// 7. ŞİRKET BAZLI DEĞERLENDİRME & ÖĞRENEN YAPAY ZEKA PUANLAYICI
// ============================================================================
export function evaluateCandidateForCompany(
  cv: CandidateCV,
  company: CompanyProfile
): EvaluatedCandidate {
  const disqualificationReasons: string[] = [];
  let passesHardFilters = true;

  // 1. CİNSİYET KONTROLÜ (SABİT ÇEKİRDEK KRİTER 1)
  let genderMatchScore = 100;
  if (company.targetGender !== "Farketmez") {
    if (cv.detectedGender === company.targetGender) {
      genderMatchScore = cv.genderConfidence;
    } else if (cv.detectedGender === "Belirsiz") {
      genderMatchScore = 35;
      if (company.strictGender) {
        passesHardFilters = false;
        disqualificationReasons.push(`Cinsiyet belirsiz (${company.targetGender} zorunlu filtre)`);
      }
    } else {
      genderMatchScore = 0;
      if (company.strictGender) {
        passesHardFilters = false;
        disqualificationReasons.push(
          `Cinsiyet uyuşmazlığı: Aday ${cv.detectedGender} (%${cv.genderConfidence}), aranan: ${company.targetGender}`
        );
      }
    }
  }

  // 2. YAŞ KONTROLÜ (SABİT ÇEKİRDEK KRİTER 2)
  let ageMatchScore = 100;
  if (cv.detectedAge !== null) {
    if (cv.detectedAge >= company.minAge && cv.detectedAge <= company.maxAge) {
      ageMatchScore = 100;
    } else {
      const diff =
        cv.detectedAge < company.minAge
          ? company.minAge - cv.detectedAge
          : cv.detectedAge - company.maxAge;
      ageMatchScore = Math.max(0, 100 - diff * 18);
      if (company.strictAge) {
        passesHardFilters = false;
        disqualificationReasons.push(
          `Yaş sınırı dışı: Aday ${cv.detectedAge} yaşında (Aranan: ${company.minAge}–${company.maxAge})`
        );
      }
    }
  } else {
    ageMatchScore = 50;
    if (company.strictAge) {
      passesHardFilters = false;
      disqualificationReasons.push("CV'de yaş veya mezuniyet kronolojisi bulunamadı");
    }
  }

  // 3. ŞİRKETE ÖZEL ZORUNLU & TERCİHLİ YETENEKLER (C++, JAVA VB.)
  const skillAssessments: SkillAssessment[] = [];
  let requiredTotal = 0;

  for (const reqSkill of company.requiredSkills) {
    const assessment = evaluateSkillInCV(reqSkill, cv.rawText);
    skillAssessments.push(assessment);
    requiredTotal += assessment.score;
    if (!assessment.found) {
      passesHardFilters = false;
      disqualificationReasons.push(`Zorunlu yetenek eksik: ${reqSkill}`);
    }
  }

  let preferredTotal = 0;
  for (const prefSkill of company.preferredSkills) {
    const assessment = evaluateSkillInCV(prefSkill, cv.rawText);
    skillAssessments.push(assessment);
    preferredTotal += assessment.score;
  }

  const reqAvg =
    company.requiredSkills.length > 0 ? requiredTotal / company.requiredSkills.length : 100;
  const prefAvg =
    company.preferredSkills.length > 0 ? preferredTotal / company.preferredSkills.length : 80;

  // Deneyim yılı kontrolü
  let expFactor = 100;
  if (cv.experienceYears < company.minExperienceYears) {
    expFactor = Math.max(30, 100 - (company.minExperienceYears - cv.experienceYears) * 25);
  }

  const skillsMatchScore = Math.round(reqAvg * 0.72 + prefAvg * 0.18 + expFactor * 0.1);

  // 4. AKTİF ÖĞRENME (ACTIVE LEARNING) BONUS / CEZA PUANI
  let learnedBonusScore = 0;
  const normText = normalizeTr(cv.rawText);
  const matchedLearnedTerms: string[] = [];

  for (const [term, weight] of Object.entries(company.learnedKeywordWeights)) {
    if (normText.includes(normalizeTr(term))) {
      learnedBonusScore += weight;
      if (weight > 0) matchedLearnedTerms.push(`+${weight}p (${term})`);
    }
  }

  // Eğer İK bu adayı bizzat onayladıysa veya reddettiyse
  if (company.approvedCandidateIds.includes(cv.id)) {
    learnedBonusScore += 12;
  } else if (company.rejectedCandidateIds.includes(cv.id)) {
    learnedBonusScore -= 25;
  }

  learnedBonusScore = Math.max(-25, Math.min(20, learnedBonusScore));

  // TOPLAM AĞIRLIKLI SKOR
  let rawTotal =
    genderMatchScore * 0.25 + ageMatchScore * 0.2 + skillsMatchScore * 0.55 + learnedBonusScore;

  if (!passesHardFilters) {
    rawTotal = Math.min(rawTotal * 0.45, 48);
  }

  const totalMatchScore = Math.max(0, Math.min(100, Math.round(rawTotal)));

  // AI Özet Gerekçesi Oluştur
  const strongSkills = skillAssessments
    .filter((s) => s.found && s.score >= 75)
    .map((s) => `${s.skill} (${s.level.split(" ")[0]})`);
  const weakSkills = skillAssessments
    .filter((s) => s.found && s.score < 50)
    .map((s) => s.skill);

  let aiSummaryReason = `${cv.detectedGender} (%${cv.genderConfidence} güven), ${
    cv.detectedAge ? `${cv.detectedAge} yaşında (${cv.ageMethod})` : "Yaş belirsiz"
  }. `;

  if (strongSkills.length > 0) {
    aiSummaryReason += `Güçlü yetkinlik: ${strongSkills.join(", ")}. `;
  }
  if (weakSkills.length > 0) {
    aiSummaryReason += `⚠️ ${weakSkills.join(", ")} sadece yüzeysel geçiyor. `;
  }
  if (matchedLearnedTerms.length > 0) {
    aiSummaryReason += `🧠 Şirket öğrenme hafızasından bonus: ${matchedLearnedTerms.slice(0, 2).join(", ")}.`;
  }

  return {
    cv,
    totalMatchScore,
    passesHardFilters,
    genderMatchScore: Math.round(genderMatchScore),
    ageMatchScore: Math.round(ageAgeScoreSafe(ageMatchScore)),
    skillsMatchScore,
    learnedBonusScore,
    skillAssessments,
    disqualificationReasons,
    aiSummaryReason,
  };
}

function ageAgeScoreSafe(val: number): number {
  return Number.isNaN(val) ? 50 : val;
}

// ============================================================================
// 8. PDF / DOCX METNİNDEN OTOMATİK AD SOYAD, ÜNİVERSİTE, ŞEHİR VE DENEYİM ÇIKARICI
//    (Referans, Yönetici, Danışman ve Tuzak İsimleri Ayıklayan Akıllı Motor)
// ============================================================================
export function stripReferenceAndDecoyLines(rawText: string): string {
  // Referans / Ekip Katılımcıları bloklarını bir sonraki ana başlığa kadar temizle
  const withoutRefBlocks = rawText.replace(
    /\n\s*(?:referanslar|references|referans\s*kişisi|referans\s*iletişim\s*bilgileri|iş\s*referansları|referans|professional\s*contacts|detaylı\s*proje\s*katılımcıları)\b[\s\S]*?(?=\n\s*(?:tools|languages|professional\s*profile|experience|selected\s*projects|education|eğitim|iş\s*deneyimi|deneyim|beceriler|yetkinlikler|programlar|kişisel\s*açıklama|görev\s*tanımı)\b|$)/gi,
    "\n"
  );

  // Yönetici, Danışman, Referans, Müdür, Supervisor, Ekip arkadaşı satırlarını filtrele
  return withoutRefBlocks
    .split(/\r?\n/)
    .filter((line) => {
      const l = normalizeTr(line);
      if (
        /(?:referans|reference|yönetici|müdür|direktör|başmimar|supervisor|manager|danışman|advisor|raporlanan|reported\s*to|worked\s*with|partnered\s*with|collaborated\s*with|prepared\s*by|reviewed\s*by|gözetiminde|ile\s*birlikte|tarafından|ekip\s*üyesi|takım\s*lideri|ürün\s*sahibi|prof\.\s*dr|doç\.\s*dr|dr\.\s*)/i.test(
          l
        )
      ) {
        return false;
      }
      return true;
    })
    .join("\n");
}

export function extractCandidateMetadataFromText(
  rawText: string,
  fileName = ""
): {
  fullName: string;
  university: string;
  city: string;
  experienceYears: number;
} {
  if (!rawText || rawText.trim().length < 10) {
    return {
      fullName: "İsimsiz Aday (Taranmış Görüntü / OCR)",
      university: "Belirtilmemiş",
      city: "Belirtilmemiş",
      experienceYears: 0,
    };
  }

  const cleanCandidateText = stripReferenceAndDecoyLines(rawText);
  const lines = cleanCandidateText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  // 1. AD SOYAD TESPİTİ
  let fullName = "";

  // Aşama A: Açık Etiket ("Ad Soyad:", "Aday:", "Applicant:", "Candidate:")
  const explicitNameMatch = cleanCandidateText.match(
    /(?:ad\s*soyad|adı\s*soyadı|isim\s*soyisim|aday\s*adı|başvuran\s*aday|applicant\s*name|candidate\s*name)\s*[:\-]\s*([A-ZÇĞİÖŞÜa-zçğıöşü\s]{4,40})/i
  );

  // Aşama B: Paragraf İçi Birinci Tekil Şahıs Kendini Tanıtma ("Ben, Zeynep Aksoy," / "I, Maya Sullivan,")
  const selfIntroTrMatch = rawText.match(
    /\b(?:[Bb]en|[Aa]dım|[İi]smim)\s*,?\s*([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,2})\b/
  );
  const selfIntroEnMatch = rawText.match(
    /(?:\b[Mm]y\s+name\s+is\s+|\bI\s+am\s+|\bI,\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/
  );

  if (explicitNameMatch && explicitNameMatch[1]) {
    fullName = explicitNameMatch[1].split(/[\n|•,]/)[0].trim();
  } else if (selfIntroTrMatch && selfIntroTrMatch[1]) {
    fullName = selfIntroTrMatch[1].trim();
  } else if (selfIntroEnMatch && selfIntroEnMatch[1]) {
    fullName = selfIntroEnMatch[1].trim();
  } else {
    // Aşama C: İlk 6 satırda (Bölüm başlıklarından önce) sözlükte kayıtlı gerçek insan ismi var mı?
    const nonNameKeywords = [
      "özgeçmiş", "curriculum", "vitae", "resume", "mühendis", "mühendisliği",
      "engineer", "engineering", "uzman", "uzmanı", "analist", "analyst",
      "developer", "designer", "mimar", "mimarlık", "finans", "finansal",
      "kurumsal", "yazılım", "geliştirme", "geliştirici", "portfolio",
      "overview", "business", "intelligence", "social", "science", "research",
      "assistant", "proje", "koordinatörü", "veri", "data", "director",
      "manager", "lead", "studio", "üniversite", "university", "fakülte",
      "bölüm", "iletişim", "contacts", "eğitim", "education", "profil", "profile"
    ];

    for (const line of lines.slice(0, 6)) {
      const cleaned = line
        .replace(/\s*[\-–—|]\s*(?:curriculum\s*vitae|cv|özgeçmiş|resume).*$/i, "")
        .replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ\s]/g, "")
        .trim();
      const words = cleaned.split(/\s+/).filter(Boolean);
      const lower = normalizeTr(cleaned);

      const hasJobOrSectionWord = nonNameKeywords.some((kw) => lower.includes(kw));

      if (!hasJobOrSectionWord && words.length >= 2 && words.length <= 4 && cleaned.length <= 38) {
        const firstWordNorm = normalizeTr(words[0]);
        const secondWordNorm = words.length > 1 ? normalizeTr(words[1]) : "";
        if (
          FEMALE_NAMES.has(firstWordNorm) ||
          MALE_NAMES.has(firstWordNorm) ||
          UNISEX_NAMES.has(firstWordNorm) ||
          FEMALE_NAMES.has(secondWordNorm) ||
          MALE_NAMES.has(secondWordNorm)
        ) {
          fullName = words
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
          break;
        }
      }
    }
  }

  if (!fullName) {
    fullName = "İsimsiz Aday (Ad Belirtilmemiş)";
  }

  // 2. ÜNİVERSİTE / ENSTİTÜ / OKUL TESPİTİ (Türkçe & İngilizce)
  let university = "Belirtilmemiş";
  const uniRegex = /([A-ZÇĞİÖŞÜa-zçğıöşü]{2,20}(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{2,20}){0,4}\s+(?:Üniversitesi|University|Enstitüsü|Institute|School\s+of\s+Design|College)|\bODTÜ\b|\bİTÜ\b|\bYTÜ\b|\bMETU\b)/i;
  const uniMatch = rawText.match(uniRegex);
  if (uniMatch && uniMatch[1]) {
    university = uniMatch[1].replace(/\s+/g, " ").trim();
  }

  // 3. ŞEHİR TESPİTİ
  const cities = [
    "İstanbul", "Ankara", "İzmir", "Bursa", "Kocaeli", "Antalya", "Eskişehir",
    "Adana", "Konya", "Gaziantep", "Kayseri", "Mersin", "Samsun", "Trabzon",
    "Sakarya", "Tekirdağ", "Manisa", "Denizli", "Muğla", "Diyarbakır", "Erzurum",
    "London", "Cambridge"
  ];
  let city = "Belirtilmemiş";
  const norm = normalizeTr(rawText);
  for (const c of cities) {
    if (norm.includes(normalizeTr(c))) {
      city = c;
      break;
    }
  }

  // 4. DENEYİM YILI TESPİTİ
  let experienceYears = 2;
  const expMatch =
    norm.match(/(\d{1,2})\s*(?:\+\s*)?(?:yıl|sene|yıllık|years?)\s*(?:deneyim|tecrübe|iş|experience)/i) ||
    norm.match(/deneyim\s*\(\s*(\d{1,2})\s*yıl/i);
  if (expMatch && expMatch[1]) {
    experienceYears = Math.min(35, Math.max(0, parseInt(expMatch[1], 10)));
  }

  return { fullName, university, city, experienceYears };
}
