import {
  CandidateCV,
  CompanyProfile,
  detectAgeFromCV,
  detectGenderFromCV,
} from "./cvEngine";

export const INITIAL_COMPANIES: CompanyProfile[] = [
  {
    id: "comp-novasoft",
    name: "NovaSoft Savunma & Yazılım A.Ş.",
    sector: "Yazılım & Savunma Sanayi",
    roleTitle: "Kıdemli C++ / Java Sistem Mühendisi",
    naturalLanguagePrompt:
      "Kadın olsun, 22 ile 32 yaş arasında olsun, C++ ve Java dillerini sadece sözde değil gerçek projelerde kullanmış olsun.",
    targetGender: "Kadın",
    minAge: 22,
    maxAge: 32,
    strictGender: true,
    strictAge: true,
    requiredSkills: ["C++", "Java"],
    preferredSkills: ["Linux", "SQL", "Git"],
    minExperienceYears: 2,
    learnedKeywordWeights: {
      "cmake": 8,
      "spring boot": 8,
      "multithreading": 7,
      "stl": 6,
      "sadece giriş dersi": -12,
    },
    learnedUniversityBonus: true,
    feedbackCount: 14,
    approvedCandidateIds: [],
    rejectedCandidateIds: [],
  },
  {
    id: "comp-alfa-makine",
    name: "Alfa Endüstriyel Makine & Otomasyon",
    sector: "Üretim & Makine Sanayi",
    roleTitle: "Ar-Ge Mekanik Tasarım Mühendisi",
    naturalLanguagePrompt:
      "24-38 yaş arası, SolidWorks ve AutoCAD bilen, CNC üretim süreçlerine hakim mühendis.",
    targetGender: "Farketmez",
    minAge: 24,
    maxAge: 38,
    strictGender: false,
    strictAge: true,
    requiredSkills: ["SolidWorks"],
    preferredSkills: ["SQL", "Python"],
    minExperienceYears: 3,
    learnedKeywordWeights: {
      "sac metal": 9,
      "kalıp tasarım": 8,
      "ansys": 7,
    },
    learnedUniversityBonus: false,
    feedbackCount: 6,
    approvedCandidateIds: [],
    rejectedCandidateIds: [],
  },
  {
    id: "comp-kapital-finans",
    name: "Kapital Kurumsal Denetim & Finans",
    sector: "Finans & Denetim",
    roleTitle: "Kıdemli Finansal Sistemler ve SAP Uzmanı",
    naturalLanguagePrompt:
      "Kadın aday, 23-30 yaş aralığında, SAP ve SQL raporlama süreçlerinde aktif deneyimli.",
    targetGender: "Kadın",
    minAge: 23,
    maxAge: 30,
    strictGender: true,
    strictAge: true,
    requiredSkills: ["SAP", "SQL"],
    preferredSkills: ["Python"],
    minExperienceYears: 2,
    learnedKeywordWeights: {
      "sap fi": 10,
      "ufrs": 9,
      "postgresql": 5,
    },
    learnedUniversityBonus: true,
    feedbackCount: 9,
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
  source = "Sistem Havuzu"
): CandidateCV {
  const genderRes = detectGenderFromCV(fullName, rawText);
  const ageRes = detectAgeFromCV(rawText);

  return {
    id,
    fullName,
    rawText,
    uploadedAt: "2026-10-25",
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

export const INITIAL_CANDIDATES: CandidateCV[] = [
  buildCandidateFromRaw(
    "cv-001",
    "Zeynep Kaya",
    `AD SOYAD: Zeynep Kaya
KİŞİSEL BİLGİLER: Doğum Tarihi: 14.05.1998 | Cinsiyet: Kadın | Şehir: Ankara
EĞİTİM: Orta Doğu Teknik Üniversitesi (ODTÜ) - Bilgisayar Mühendisliği (2016 - 2020)
İŞ DENEYİMİ (5 Yıl):
• Aselsan / Savunma Sistemleri — Kıdemli Yazılım Mühendisi (2022 - 2026):
  Gerçek zamanlı radar veri işleme modüllerini Modern C++ (C++17/C++20), STL, Boost ve CMake kullanarak geliştirdim. Multithreading ve düşük gecikmeli (low-latency) bellek yönetimi mimarisini tasarladım.
• Havelsan — Ar-Ge Yazılım Mühendisi (2020 - 2022):
  Kurumsal komuta kontrol arka uç servislerini Java, Spring Boot, Hibernate, JVM optimizasyonu ve Kafka mikroservis mimarisiyle geliştirdim. PostgreSQL ve Linux ortamında yüksek erişilebilirlikli sistemler yazdım.
TOPLULUKLAR: IEEE Women in Engineering (WIE) 멘토, WomenTechmakers Ankara konuşmacısı.
TEKNİK YETKİNLİKLER: C++, Java, Spring Boot, STL, Boost, CMake, Linux, SQL, Git, Multithreading.`,
    5,
    "Lisans",
    "Orta Doğu Teknik Üniversitesi (ODTÜ)",
    "Ankara",
    ["C++", "Java", "Spring Boot", "CMake", "STL", "Linux", "Multithreading"],
    "PDF Yükleme (zeynep_kaya_cv.pdf)"
  ),
  buildCandidateFromRaw(
    "cv-002",
    "Deniz Selin Arslan",
    `AD SOYAD: Deniz Selin Arslan
İLETİŞİM: İstanbul | deniz.arslan@email.com
EĞİTİM: İstanbul Teknik Üniversitesi (İTÜ) - Bilgisayar Mühendisliği Lisans (2018 - 2022)
ÖZET & DENEYİM (4 Yıl):
Not: CV'de doğum tarihi ve açık cinsiyet satırı yer almamaktadır.
• Borsa İstanbul Teknoloji — Sistem Yazılım Uzmanı (2023 - 2026):
  Yüksek frekanslı emir eşleştirme motorunun C++ (STL, CMake, Pointer ve RAII prensipleri) ile geliştirilmesi ve Linux çekirdek seviyesinde optimizasyonunda görev aldım.
• Garanti BBVA Teknoloji — Yazılım Mühendisi (2022 - 2023):
  Ödeme sistemleri mikroservislerini Java 17, Spring Boot, Maven, JPA ve REST API standartlarında geliştirdim. SQL sorgu optimizasyonu yaptım.
SOSYAL FAALİYETLER: İTÜ Kadın Mühendisler Kulübü ve SistersLab Yazılımda Kadın mentorluk programı üyesi.`,
    4,
    "Lisans",
    "İstanbul Teknik Üniversitesi (İTÜ)",
    "İstanbul",
    ["C++", "Java", "Spring Boot", "Linux", "SQL", "CMake"],
    "PDF Yükleme (deniz_arslan_cv.pdf)"
  ),
  buildCandidateFromRaw(
    "cv-003",
    "Büşra Demirci",
    `AD SOYAD: Büşra Demirci
DOĞUM TARİHİ: 22.09.1999 | Şehir: İzmir | Medeni Durum: Bekar (Bayan)
EĞİTİM: Ege Üniversitesi - Yazılım Mühendisliği (2017 - 2021)
DENEYİM (4 Yıl):
• Netcad Yazılım — C++ & Java Geliştirici (2021 - 2026):
  Coğrafi bilgi sistemi masaüstü çekirdek modüllerini C++, Qt ve OpenCV ile geliştirdim. Bulut senkronizasyon servislerini ise Java, Spring Boot, Tomcat ve PostgreSQL (SQL) kullanarak tasarladım. Git ve Docker süreçlerini yönettim.
DERNEKLER: Kız Kardeşim Projesi gönüllü eğitmeni.`,
    4,
    "Lisans",
    "Ege Üniversitesi",
    "İzmir",
    ["C++", "Java", "Qt", "Spring Boot", "SQL", "Git"],
    "DOCX Yükleme (busra_demirci.docx)"
  ),
  buildCandidateFromRaw(
    "cv-004",
    "Elif Yıldırım",
    `AD SOYAD: Elif Yıldırım
DOĞUM TARİHİ: 10.03.2001 | Cinsiyet: Kadın | Şehir: İstanbul
EĞİTİM: Marmara Üniversitesi - Görsel İletişim ve Medya (2019 - 2023)
DENEYİM (2 Yıl):
• Kreatif Ajans — UI/UX & İçerik Uzmanı (2024 - 2026):
  Sosyal medya görselleri ve kurumsal kimlik tasarımları hazırladım.
YETENEKLER LİSTESİ: Figma, Photoshop, C++, Java (Üniversitede seçmeli olarak C++ ve Java başlangıç seviyesi giriş dersi kursuna katıldım, aktif projede kullanmadım).`,
    2,
    "Lisans",
    "Marmara Üniversitesi",
    "İstanbul",
    ["Figma", "C++ (Yüzeysel)", "Java (Yüzeysel)"],
    "PDF Yükleme (elif_yildirim_cv.pdf)"
  ),
  buildCandidateFromRaw(
    "cv-005",
    "Burak Çelik",
    `AD SOYAD: Burak Çelik
DOĞUM TARİHİ: 05.11.1997 | Cinsiyet: Erkek | Askerlik Durumu: Tamamlandı (Yedek Subay)
EĞİTİM: Yıldız Teknik Üniversitesi - Bilgisayar Mühendisliği (2015 - 2019)
DENEYİM (6 Yıl):
• Siemens Türkiye — Kıdemli Gömülü C++ & Java Mühendisi:
  Endüstriyel otomasyon kontrolcülerini Modern C++, Boost, CMake ve Linux RTOS üzerinde geliştirdim. Arka plan izleme servislerini Java ve Spring Boot ile yazdım.`,
    6,
    "Lisans",
    "Yıldız Teknik Üniversitesi",
    "İstanbul",
    ["C++", "Java", "Boost", "Spring Boot", "Linux"],
    "PDF Yükleme (burak_celik.pdf)"
  ),
  buildCandidateFromRaw(
    "cv-006",
    "Selin Özkan",
    `AD SOYAD: Selin Özkan
KİŞİSEL: 1996 doğumlu. Kadın. Ankara.
EĞİTİM: Hacettepe Üniversitesi - Bilgisayar Mühendisliği (2014 - 2019)
DENEYİM (6 Yıl):
• STM Savunma — Kıdemli Yazılım Mimarı:
  Otonom İHA simülasyon yazılımlarını C++, STL, Multithreading ve CMake ile geliştirdim. Yer kontrol istasyonu veri katmanını Java, Spring Boot, Hibernate ve SQL ile kodladım.
ÜYELİKLER: TurkishWIN & Women in Tech Türkiye.`,
    6,
    "Yüksek Lisans",
    "Hacettepe Üniversitesi",
    "Ankara",
    ["C++", "Java", "STL", "Spring Boot", "SQL", "Multithreading"],
    "PDF Yükleme (selin_ozkan.pdf)"
  ),
  buildCandidateFromRaw(
    "cv-007",
    "Merve Aydın",
    `AD SOYAD: Merve Aydın
DOĞUM YILI: 1999 | Cinsiyet: Kadın | Şehir: İstanbul
EĞİTİM: İstanbul Üniversitesi - İşletme & Finans (2017 - 2021)
DENEYİM (4 Yıl):
• Deloitte / Finansal Danışmanlık — Kıdemli SAP FI & SQL Analisti:
  SAP FI, SAP CO ve UFRS finansal raporlama süreçlerini yönettim. SQL (PostgreSQL, Oracle) ve Python ile finansal veri doğrulama otomasyonları geliştirdim.`,
    4,
    "Lisans",
    "İstanbul Üniversitesi",
    "İstanbul",
    ["SAP", "SQL", "UFRS", "Python"],
    "PDF Yükleme (merve_aydin.pdf)"
  ),
  buildCandidateFromRaw(
    "cv-008",
    "Ayşe Gül Şahin",
    `AD SOYAD: Ayşe Gül Şahin
EĞİTİM: Boğaziçi Üniversitesi - Bilgisayar Mühendisliği (2019 - 2023)
DENEYİM (3 Yıl):
• Dream Games / Teknoloji — C++ & Java Backend Developer:
  Oyun motoru performans modüllerini C++17, STL ve CMake ile optimize ettim. Milyonlarca eşzamanlı oyuncuya hizmet veren sunucu mimarisini Java, Spring Boot, JVM ve Microservices yapısıyla geliştirdim. Linux ve Git ortamında çalıştım.`,
    3,
    "Lisans",
    "Boğaziçi Üniversitesi",
    "İstanbul",
    ["C++", "Java", "Spring Boot", "CMake", "Microservices", "Linux"],
    "PDF Yükleme (aysegul_sahin.pdf)"
  ),
  buildCandidateFromRaw(
    "cv-009",
    "Görkem İpek Koç",
    `AD SOYAD: Görkem İpek Koç
EĞİTİM: Bilkent Üniversitesi - Makine Mühendisliği (2016 - 2020)
DENEYİM (5 Yıl):
• TUSAŞ — Mekanik Tasarım Mühendisi:
  SolidWorks, CATIA ve AutoCAD kullanarak havacılık sac metal ve kalıp tasarım projelerini yürüttüm. ANSYS ile mukavemet analizi ve CNC üretim doğrulamalarını gerçekleştirdim. Python ve SQL ile parça takip scriptleri yazdım.`,
    5,
    "Lisans",
    "Bilkent Üniversitesi",
    "Ankara",
    ["SolidWorks", "AutoCAD", "CNC", "ANSYS", "Python"],
    "PDF Yükleme (gorkem_ipek_koc.pdf)"
  ),
  buildCandidateFromRaw(
    "cv-010",
    "Hande Karaca",
    `AD SOYAD: Hande Karaca
DOĞUM TARİHİ: 19.01.1988 | Cinsiyet: Kadın | Şehir: İzmir
EĞİTİM: Dokuz Eylül Üniversitesi - Bilgisayar Mühendisliği (2006 - 2010)
DENEYİM (15 Yıl):
• Kurumsal Yazılım A.Ş. — Yazılım Takım Lideri:
  C++ (STL, Boost, Qt) ve Java (Spring Boot, J2EE, Hibernate) projelerinde 15 yıl boyunca mimar olarak görev aldım. SQL ve Linux sistem yönetimi uzmanlığı.`,
    15,
    "Yüksek Lisans",
    "Dokuz Eylül Üniversitesi",
    "İzmir",
    ["C++", "Java", "Spring Boot", "Boost", "SQL"],
    "PDF Yükleme (hande_karaca.pdf)"
  ),
];

// ============================================================================
// 1.000 CV SİMÜLASYON HAVUZU ÜRETİCİSİ (HIZ & DOĞRULUK TESTİ İÇİN)
// ============================================================================
const SIM_FEMALE_FIRST = [
  "Zeynep", "Elif", "Ayşe", "Merve", "Büşra", "Selin", "Seda", "Gamze", "Gizem", "Tuğba",
  "Kübra", "Esra", "Betül", "Ceren", "Damla", "İrem", "Melis", "Pelin", "Dilara", "Aslı",
  "Burcu", "Hande", "Pınar", "Özge", "Sinem", "Yasemin", "Hilal", "Beyza", "Defne", "Ece",
  "Deniz Selin", "Görkem İpek", "Özgür Naz", "Bilge Nur"
];

const SIM_MALE_FIRST = [
  "Ahmet", "Mehmet", "Mustafa", "Emre", "Burak", "Furkan", "Enes", "Berke", "Mert", "Can",
  "Onur", "Kerem", "Kaan", "Tolga", "Serkan", "Gökhan", "Hakan", "Oğuzhan", "Batuhan", "Alper",
  "Barış", "Doruk", "Efe", "Erdem", "Eren", "Fatih", "Koray", "Levent", "Sinan", "Yiğit"
];

const SIM_LAST_NAMES = [
  "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir",
  "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek",
  "Polat", "Özcan", "Korkmaz", "Çakır", "Erdoğan", "Yavuz", "Can", "Acar", "Şen", "Aksoy"
];

const SIM_UNIVERSITIES = [
  "Orta Doğu Teknik Üniversitesi (ODTÜ)",
  "İstanbul Teknik Üniversitesi (İTÜ)",
  "Boğaziçi Üniversitesi",
  "Hacettepe Üniversitesi",
  "Yıldız Teknik Üniversitesi",
  "Ege Üniversitesi",
  "Bilkent Üniversitesi",
  "Gazi Üniversitesi",
  "Marmara Üniversitesi",
  "Dokuz Eylül Üniversitesi",
  "Sabancı Üniversitesi",
  "Koç Üniversitesi",
  "Ankara Üniversitesi",
  "İzmir Yüksek Teknoloji Enstitüsü (İYTE)"
];

const SIM_CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Kocaeli", "Eskişehir", "Antalya"];

export function generateBulkSimulationCVs(totalCount: number): CandidateCV[] {
  const results: CandidateCV[] = [...INITIAL_CANDIDATES];
  const needed = Math.max(0, totalCount - results.length);

  for (let i = 0; i < needed; i++) {
    const idx = i + 11;
    const isFemale = i % 2 === 0;
    const firstList = isFemale ? SIM_FEMALE_FIRST : SIM_MALE_FIRST;
    const firstName = firstList[i % firstList.length];
    const lastName = SIM_LAST_NAMES[(i * 7) % SIM_LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;

    const birthYear = 1986 + (i % 18); // Ages between 22 and 40
    const uniStart = birthYear + 18;
    const uniEnd = uniStart + 4;
    const expYears = Math.max(1, 2026 - uniEnd);
    const uni = SIM_UNIVERSITIES[i % SIM_UNIVERSITIES.length];
    const city = SIM_CITIES[i % SIM_CITIES.length];

    // Bazı CV'lerde doğum tarihi açık yazsın, bazılarında sadece mezuniyet yılından tahmin edilsin
    const hasExplicitBirthDate = i % 3 !== 0;
    const hasExplicitGenderLine = i % 4 === 0;

    const genderLine = hasExplicitGenderLine
      ? `Cinsiyet: ${isFemale ? "Kadın" : "Erkek"} | `
      : "";
    const militaryLine = !isFemale
      ? `Askerlik Durumu: ${i % 5 === 0 ? "Tecilli" : "Tamamlandı"} | `
      : "";
    const birthLine = hasExplicitBirthDate
      ? `Doğum Tarihi: 15.0${(i % 8) + 1}.${birthYear} | `
      : "";

    // Yetenek profili çeşitliliği
    const profileType = i % 6;
    let bodyText = "";
    let tags: string[] = [];

    if (profileType === 0) {
      // Güçlü C++ ve Java uzmanı
      bodyText = `DENEYİM (${expYears} Yıl):
• Kurumsal Teknoloji & Savunma A.Ş. — Kıdemli Yazılım Mühendisi:
  Yüksek performanslı gerçek zamanlı sistemleri Modern C++ (C++17, STL, Boost, CMake) ve Multithreading mimarisiyle geliştirdim.
  Dağıtık arka uç servislerini ise Java, Spring Boot, Hibernate, JVM ve Microservices altyapısında tasarladım. Linux ve SQL veritabanı optimizasyonu yaptım.`;
      tags = ["C++", "Java", "Spring Boot", "CMake", "STL", "Linux", "SQL"];
    } else if (profileType === 1) {
      // Sadece Java ve SQL uzmanı (C++ yok)
      bodyText = `DENEYİM (${expYears} Yıl):
• FinTech Yazılım — Backend Developer:
  Bankacılık mikroservislerini Java, Spring Boot, Maven, JPA ve PostgreSQL (SQL) kullanarak geliştirdim. Git ve Docker süreçlerinde aktif rol aldım.`;
      tags = ["Java", "Spring Boot", "SQL", "Git"];
    } else if (profileType === 2) {
      // C++ ve Java sadece yüzeysel listede geçiyor
      bodyText = `DENEYİM (${expYears} Yıl):
• Dijital Medya A.Ş. — Proje Destek Uzmanı:
  Müşteri operasyonları ve teknik dokümantasyon süreçlerini yönettim.
YETENEKLER: C++, Java (Üniversitede giriş dersi olarak aldım, başlangıç seviyesi aşinalık).`;
      tags = ["C++ (Yüzeysel)", "Java (Yüzeysel)"];
    } else if (profileType === 3) {
      // Makine / SolidWorks / CNC profili
      bodyText = `DENEYİM (${expYears} Yıl):
• Endüstriyel Kalıp & Otomasyon — Mekanik Tasarım Mühendisi:
  SolidWorks ve AutoCAD kullanarak 3D modelleme, sac metal ve kalıp tasarım projelerini geliştirdim. CNC üretim hattı doğrulamalarını yönettim.`;
      tags = ["SolidWorks", "AutoCAD", "CNC"];
    } else if (profileType === 4) {
      // SAP & Finans profili
      bodyText = `DENEYİM (${expYears} Yıl):
• Denetim & Danışmanlık — SAP FI & Veri Analisti:
  SAP FI, SAP CO ve UFRS raporlama modüllerini yönettim. SQL ve Python ile finansal analiz panelleri kurguladım.`;
      tags = ["SAP", "SQL", "UFRS", "Python"];
    } else {
      // C++, Java ve Python tam donanımlı Ar-Ge mühendisi
      bodyText = `DENEYİM (${expYears} Yıl):
• Ar-Ge Teknoloji Merkezi — Sistem & Algoritma Mühendisi:
  Gömülü görüntü işleme algoritmalarını C++, OpenCV, CMake ve Pointer optimizasyonuyla yazdım. Bulut entegrasyon katmanını Java, Spring Boot, REST API ve SQL ile geliştirdim.`;
      tags = ["C++", "Java", "Spring Boot", "CMake", "Python", "SQL"];
    }

    const communityLine =
      isFemale && i % 3 === 0
        ? "\nTOPLULUKLAR: Women in Tech Türkiye & IEEE WIE (Women in Engineering) aktif üyesi."
        : "";

    const rawText = `AD SOYAD: ${fullName}
KİŞİSEL BİLGİLER: ${birthLine}${genderLine}${militaryLine}Şehir: ${city}
EĞİTİM: ${uni} - Mühendislik Fakültesi Lisans (${uniStart} - ${uniEnd})
${bodyText}${communityLine}`;

    results.push(
      buildCandidateFromRaw(
        `cv-${String(idx).padStart(4, "0")}`,
        fullName,
        rawText,
        expYears,
        "Lisans",
        uni,
        city,
        tags,
        `Toplu Havuz #${idx}`
      )
    );
  }

  return results;
}
