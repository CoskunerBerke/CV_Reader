import {
  extractCandidateMetadataFromText,
  detectGenderFromCV,
  detectAgeFromCV,
  extractEducationFromCV,
} from "@/lib/cvEngine";

export type CriterionAccessTier = "default" | "premium" | "hidden";

export interface CriterionDefinition {
  id: string;
  code: string; // #001 .. #100
  categoryKey: string;
  categoryLabel: string;
  label: string;
  shortDesc: string;
  tier: CriterionAccessTier;
  inputType: "text" | "boolean" | "select" | "number";
  options?: string[];
}

export const CRITERIA_CATEGORIES: { key: string; label: string }[] = [
  { key: "demografi", label: "01. Kimlik & Demografi" },
  { key: "lisans_onlisans", label: "02. Lisans & Ön Lisans" },
  { key: "master_phd", label: "03. Yüksek Lisans & Doktora" },
  { key: "meslek_deneyim", label: "04. Ne İşi / Meslek & Deneyim" },
  { key: "yabanci_dil", label: "05. Yabancı Dil Yetkinliği" },
  { key: "teknik_yazilim", label: "06. Yazılım, Veri & Teknoloji" },
  { key: "sertifika_belge", label: "07. Sertifika & Mesleki Belge" },
  { key: "calisma_lojistik", label: "08. Askerlik, Ehliyet & Koşullar" },
  { key: "sektorel", label: "09. Sektörel Uzmanlık" },
  { key: "ek_degerlendirme", label: "10. Referans & Ek Seçenekler" },
];

export const INITIAL_100_CRITERIA: CriterionDefinition[] = [
  // 01. KİMLİK & DEMOGRAFİ (1-10)
  { id: "c001", code: "001", categoryKey: "demografi", categoryLabel: "01. Kimlik & Demografi", label: "Ad Soyad", shortDesc: "Adayın tam adı ve soyadı", tier: "default", inputType: "text" },
  { id: "c002", code: "002", categoryKey: "demografi", categoryLabel: "01. Kimlik & Demografi", label: "Yaş", shortDesc: "Kronolojik veya doğum yılından yaş", tier: "default", inputType: "number" },
  { id: "c003", code: "003", categoryKey: "demografi", categoryLabel: "01. Kimlik & Demografi", label: "Cinsiyet", shortDesc: "Kadın / Erkek / Belirsiz", tier: "default", inputType: "select", options: ["Kadın", "Erkek", "Belirsiz"] },
  { id: "c004", code: "004", categoryKey: "demografi", categoryLabel: "01. Kimlik & Demografi", label: "Doğum Yılı", shortDesc: "Adayın doğum yılı veya tahmini yıl", tier: "premium", inputType: "text" },
  { id: "c005", code: "005", categoryKey: "demografi", categoryLabel: "01. Kimlik & Demografi", label: "İkamet Şehri", shortDesc: "Yaşadığı il (İstanbul, Ankara vb.)", tier: "premium", inputType: "text" },
  { id: "c006", code: "006", categoryKey: "demografi", categoryLabel: "01. Kimlik & Demografi", label: "İkamet İlçesi", shortDesc: "Yaşadığı ilçe / bölge", tier: "premium", inputType: "text" },
  { id: "c007", code: "007", categoryKey: "demografi", categoryLabel: "01. Kimlik & Demografi", label: "Medeni Durum", shortDesc: "Evli / Bekar / Belirtilmemiş", tier: "premium", inputType: "select", options: ["Bekar", "Evli", "Belirtilmemiş"] },
  { id: "c008", code: "008", categoryKey: "demografi", categoryLabel: "01. Kimlik & Demografi", label: "Uyruk / Vatandaşlık", shortDesc: "T.C. / Çifte Vatandaş / Yabancı", tier: "premium", inputType: "text" },
  { id: "c009", code: "009", categoryKey: "demografi", categoryLabel: "01. Kimlik & Demografi", label: "E-Posta Adresi", shortDesc: "İletişim e-posta adresi", tier: "premium", inputType: "text" },
  { id: "c010", code: "010", categoryKey: "demografi", categoryLabel: "01. Kimlik & Demografi", label: "Telefon Numarası", shortDesc: "GSM / iletişim numarası", tier: "premium", inputType: "text" },

  // 02. LİSANS & ÖN LİSANS EĞİTİMİ (11-20)
  { id: "c011", code: "011", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lisans Diploması Var mı?", shortDesc: "4 yıllık lisans mezuniyet durumu", tier: "default", inputType: "select", options: ["Var", "Yok"] },
  { id: "c012", code: "012", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lisans Üniversitesi", shortDesc: "Mezun olduğu 4 yıllık üniversite", tier: "premium", inputType: "text" },
  { id: "c013", code: "013", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lisans Bölümü", shortDesc: "4 yıllık fakülte / bölüm adı", tier: "premium", inputType: "text" },
  { id: "c014", code: "014", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lisans Mezuniyet Yılı", shortDesc: "Lisans diploma yılı", tier: "premium", inputType: "text" },
  { id: "c015", code: "015", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lisans GPA / Not Ortalaması", shortDesc: "AGNO / 4.00 veya 100'lük ortalama", tier: "premium", inputType: "text" },
  { id: "c016", code: "016", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Ön Lisans Var mı?", shortDesc: "2 yıllık MYO mezuniyeti var mı?", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c017", code: "017", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Ön Lisans Üniversitesi", shortDesc: "2 yıllık MYO üniversitesi", tier: "premium", inputType: "text" },
  { id: "c018", code: "018", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Ön Lisans Bölümü", shortDesc: "2 yıllık ön lisans programı", tier: "premium", inputType: "text" },
  { id: "c019", code: "019", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Çift Anadal / Yandal", shortDesc: "ÇAP veya Yandal programı var mı?", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c020", code: "020", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lise Türü / Mezuniyeti", shortDesc: "Fen Lisesi / Anadolu / Meslek Lisesi", tier: "premium", inputType: "text" },

  // 03. YÜKSEK LİSANS & DOKTORA (21-30)
  { id: "c021", code: "021", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Yüksek Lisans (Master) Var mı?", shortDesc: "M.Sc. / M.A. / MBA derecesi durumu", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c022", code: "022", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Yüksek Lisans Üniversitesi", shortDesc: "Master yaptığı üniversite", tier: "premium", inputType: "text" },
  { id: "c023", code: "023", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Yüksek Lisans Bölümü", shortDesc: "Master anabilim dalı / programı", tier: "premium", inputType: "text" },
  { id: "c024", code: "024", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Tezli / Tezsiz Master", shortDesc: "Tezli mi tezsiz mi?", tier: "premium", inputType: "select", options: ["Tezli", "Tezsiz", "Belirtilmemiş"] },
  { id: "c025", code: "025", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "MBA (İşletme Yüksek Lisansı)", shortDesc: "Executive / MBA derecesi var mı?", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c026", code: "026", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Doktora (Ph.D.) Var mı?", shortDesc: "Doktora öğrencisi veya mezunu mu?", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c027", code: "027", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Doktora Üniversitesi", shortDesc: "Doktora yaptığı kurum", tier: "premium", inputType: "text" },
  { id: "c028", code: "028", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Doktora Bölümü", shortDesc: "Doktora uzmanlık alanı", tier: "premium", inputType: "text" },
  { id: "c029", code: "029", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Akademik Yayın / Makale", shortDesc: "SCI / Hakemli makale veya bildiri", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c030", code: "030", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Erasmus / Yurtdışı Eğitim", shortDesc: "Uluslararası değişim / üniversite", tier: "premium", inputType: "select", options: ["Var", "Yok"] },

  // 04. NE İŞİ / MESLEK, POZİSYON & İŞ DENEYİMİ (31-42)
  { id: "c031", code: "031", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Ne İşi Yapar? (Meslek / Unvan)", shortDesc: "Adayın ana mesleği ve uzmanlık alanı", tier: "premium", inputType: "text" },
  { id: "c032", code: "032", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Toplam İş Deneyimi (Yıl)", shortDesc: "Staj hariç toplam çalışma yılı", tier: "premium", inputType: "number" },
  { id: "c033", code: "033", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Mevcut Çalışma Durumu", shortDesc: "Aktif çalışıyor mu / İş arıyor mu?", tier: "premium", inputType: "select", options: ["Aktif Çalışıyor", "İş Arıyor / Boşta", "Yeni Mezun", "Belirsiz"] },
  { id: "c034", code: "034", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Son Çalıştığı Şirket", shortDesc: "En güncel işveren kurum", tier: "premium", inputType: "text" },
  { id: "c035", code: "035", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Son Pozisyonu / Görevi", shortDesc: "En son çalıştığı unvan", tier: "premium", inputType: "text" },
  { id: "c036", code: "036", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Kıdem Seviyesi (Seniority)", shortDesc: "Stajyer / Junior / Mid / Senior / Lead", tier: "premium", inputType: "select", options: ["Yeni Mezun / Junior", "Mid-Level (Orta)", "Senior (Kıdemli)", "Yönetici / Direktör"] },
  { id: "c037", code: "037", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Staj Deneyimi Var mı?", shortDesc: "Zorunlu veya gönüllü staj geçmişi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c038", code: "038", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Ekip Yönetimi / Liderlik", shortDesc: "Altında ekip yönetmiş mi?", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c039", code: "039", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Kurumsal / Global Firma Deneyimi", shortDesc: "Büyük ölçekli kurumsal şirket geçmişi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c040", code: "040", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Kamu / Devlet Kurumu Deneyimi", shortDesc: "Bakanlık, belediye veya kamu tecrübesi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c041", code: "041", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Proje Yönetimi Deneyimi", shortDesc: "Uçtan uca proje teslim tecrübesi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c042", code: "042", categoryKey: "meslek_deneyim", categoryLabel: "04. Ne İşi / Meslek & Deneyim", label: "Bütçe / P&L Sorumluluğu", shortDesc: "Bütçe veya satınalma yönetimi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },

  // 05. YABANCI DİL YETKİNLİĞİ (43-52)
  { id: "c043", code: "043", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Dil Yetkinliği", label: "İngilizce Seviyesi", shortDesc: "A1-C2 veya Başlangıç / Orta / İleri", tier: "premium", inputType: "select", options: ["İleri (C1/C2)", "Orta-Üst (B2)", "Temel/Orta (A2/B1)", "Yok / Belirtilmemiş"] },
  { id: "c044", code: "044", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Dil Yetkinliği", label: "Almanca Seviyesi", shortDesc: "Almanca dil bilgisi", tier: "premium", inputType: "select", options: ["İleri", "Orta", "Başlangıç", "Yok"] },
  { id: "c045", code: "045", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Dil Yetkinliği", label: "Fransızca Seviyesi", shortDesc: "Fransızca dil bilgisi", tier: "premium", inputType: "select", options: ["İleri", "Orta", "Başlangıç", "Yok"] },
  { id: "c046", code: "046", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Dil Yetkinliği", label: "İspanyolca Seviyesi", shortDesc: "İspanyolca dil bilgisi", tier: "premium", inputType: "select", options: ["İleri", "Orta", "Başlangıç", "Yok"] },
  { id: "c047", code: "047", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Dil Yetkinliği", label: "Rusça Seviyesi", shortDesc: "Rusça dil bilgisi", tier: "premium", inputType: "select", options: ["İleri", "Orta", "Başlangıç", "Yok"] },
  { id: "c048", code: "048", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Dil Yetkinliği", label: "Arapça Seviyesi", shortDesc: "Arapça dil bilgisi", tier: "premium", inputType: "select", options: ["İleri", "Orta", "Başlangıç", "Yok"] },
  { id: "c049", code: "049", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Dil Yetkinliği", label: "Çince / İtalyanca / Diğer Dil", shortDesc: "Ek yabancı diller", tier: "premium", inputType: "text" },
  { id: "c050", code: "050", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Dil Yetkinliği", label: "TOEFL / IELTS Skoru", shortDesc: "Uluslararası dil sınavı puanı", tier: "premium", inputType: "text" },
  { id: "c051", code: "051", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Dil Yetkinliği", label: "YDS / YÖKDİL Skoru", shortDesc: "ÖSYM dil sınavı puanı", tier: "premium", inputType: "text" },
  { id: "c052", code: "052", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Dil Yetkinliği", label: "İkinci Yabancı Dil Var mı?", shortDesc: "Birden fazla yabancı dil yetkinliği", tier: "premium", inputType: "select", options: ["Var", "Yok"] },

  // 06. YAZILIM, VERİ & TEKNOLOJİ (53-64)
  { id: "c053", code: "053", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "MS Office & İleri Excel", shortDesc: "Excel, Pivot, VBA, Word, PowerPoint", tier: "premium", inputType: "select", options: ["İleri / Uzman", "Orta / İyi", "Temel / Yok"] },
  { id: "c054", code: "054", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "SAP / ERP Sistemleri", shortDesc: "SAP, Oracle, Canias, Netsis, Logo", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c055", code: "055", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "Python / R / Veri Analizi", shortDesc: "Python, Pandas, R, MATLAB", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c056", code: "056", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "Java / C# / .NET / C++", shortDesc: "Nesne yönelimli arka uç dilleri", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c057", code: "057", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "JavaScript / React / Next.js", shortDesc: "Modern web ve arayüz geliştirme", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c058", code: "058", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "SQL & Veritabanı Yönetimi", shortDesc: "PostgreSQL, MSSQL, MySQL, Oracle DB", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c059", code: "059", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "Power BI / Tableau / Raporlama", shortDesc: "İş zekası ve veri görselleştirme", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c060", code: "060", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "AutoCAD / SolidWorks / CATIA", shortDesc: "Mühendislik ve teknik çizim araçları", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c061", code: "061", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "Yapay Zeka / Machine Learning", shortDesc: "LLM, Deep Learning, NLP, Computer Vision", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c062", code: "062", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "Bulut & DevOps (AWS/Docker/Linux)", shortDesc: "Bulut mimarisi ve CI/CD araçları", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c063", code: "063", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "Tasarım (Figma / Photoshop / Adobe)", shortDesc: "Grafik ve UI/UX tasarım araçları", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c064", code: "064", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım, Veri & Teknoloji", label: "CRM (Salesforce / HubSpot / Zoho)", shortDesc: "Müşteri ilişkileri yönetim yazılımları", tier: "premium", inputType: "select", options: ["Var", "Yok"] },

  // 07. SERTİFİKA & MESLEKİ BELGE (65-74)
  { id: "c065", code: "065", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Mesleki Belge", label: "Toplam Sertifika Sayısı", shortDesc: "CV'de yer alan sertifika ve kurs adedi", tier: "premium", inputType: "number" },
  { id: "c066", code: "066", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Mesleki Belge", label: "PMP / Agile / Scrum Sertifikası", shortDesc: "Proje yönetimi sertifikasyonu", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c067", code: "067", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Mesleki Belge", label: "SMMM / SPK / Bağımsız Denetim", shortDesc: "Mali müşavirlik veya sermaye piyasası", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c068", code: "068", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Mesleki Belge", label: "İSG (İş Güvenliği) Sertifikası", shortDesc: "A/B/C sınıfı İSG veya eğitim belgesi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c069", code: "069", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Mesleki Belge", label: "ISO 9001 / Kalite Belgeleri", shortDesc: "Kalite yönetim sistemi sertifikaları", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c070", code: "070", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Mesleki Belge", label: "MYK Mesleki Yeterlilik Belgesi", shortDesc: "Resmi mesleki yeterlilik sertifikası", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c071", code: "071", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Mesleki Belge", label: "Dijital Pazarlama / Google Ads", shortDesc: "SEO, Meta, Google Analytics sertifikası", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c072", code: "072", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Mesleki Belge", label: "İK / Bordro & Özlük Sertifikası", shortDesc: "İş hukuku ve bordrolama eğitimi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c073", code: "073", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Mesleki Belge", label: "İlk Yardım / Hijyen Sertifikası", shortDesc: "Sağlık ve saha operasyon belgeleri", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c074", code: "074", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Mesleki Belge", label: "Dış Ticaret / Gümrük Sertifikası", shortDesc: "İhracat ve ithalat mevzuatı eğitimi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },

  // 08. ASKERLİK, EHLİYET & ÇALIŞMA KOŞULLARI (75-84)
  { id: "c075", code: "075", categoryKey: "calisma_lojistik", categoryLabel: "08. Askerlik, Ehliyet & Koşullar", label: "Askerlik Durumu", shortDesc: "Yapıldı / Muaf / Tecilli / Kadın Aday", tier: "premium", inputType: "select", options: ["Tamamlandı / Yapıldı", "Muaf", "Tecilli", "Kadın Aday (Muaf)", "Belirtilmemiş"] },
  { id: "c076", code: "076", categoryKey: "calisma_lojistik", categoryLabel: "08. Askerlik, Ehliyet & Koşullar", label: "Sürücü Belgesi (Ehliyet)", shortDesc: "B Sınıfı / A2 / E / D / Yok", tier: "premium", inputType: "select", options: ["Var (B Sınıfı)", "Var (Ağır Vasıta C/D/E)", "Yok / Belirtilmemiş"] },
  { id: "c077", code: "077", categoryKey: "calisma_lojistik", categoryLabel: "08. Askerlik, Ehliyet & Koşullar", label: "SRC / Psikoteknik Belgesi", shortDesc: "Ticari araç kullanım belgeleri", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c078", code: "078", categoryKey: "calisma_lojistik", categoryLabel: "08. Askerlik, Ehliyet & Koşullar", label: "Seyahat Engeli Yok mu?", shortDesc: "Yurtiçi / yurtdışı seyahat uygunluğu", tier: "premium", inputType: "select", options: ["Seyahat Engeli Yok", "Belirtilmemiş"] },
  { id: "c079", code: "079", categoryKey: "calisma_lojistik", categoryLabel: "08. Askerlik, Ehliyet & Koşullar", label: "Vardiyalı Çalışmaya Uygunluk", shortDesc: "Esnek ve vardiyalı mesai uyumu", tier: "premium", inputType: "select", options: ["Uygun", "Belirtilmemiş"] },
  { id: "c080", code: "080", categoryKey: "calisma_lojistik", categoryLabel: "08. Askerlik, Ehliyet & Koşullar", label: "Uzaktan / Hibrit Çalışma", shortDesc: "Remote veya hibrit çalışma deneyimi", tier: "premium", inputType: "select", options: ["Var", "Belirtilmemiş"] },
  { id: "c081", code: "081", categoryKey: "calisma_lojistik", categoryLabel: "08. Askerlik, Ehliyet & Koşullar", label: "Taşınma / Relokasyon Uygunluğu", shortDesc: "Farklı şehirde çalışabilir mi?", tier: "premium", inputType: "select", options: ["Uygun", "Belirtilmemiş"] },
  { id: "c082", code: "082", categoryKey: "calisma_lojistik", categoryLabel: "08. Askerlik, Ehliyet & Koşullar", label: "Hemen İşe Başlayabilir mi?", shortDesc: "İhbar süresi / müsaitlik durumu", tier: "premium", inputType: "select", options: ["Hemen Başlayabilir", "İhbar Süresi Var", "Belirsiz"] },
  { id: "c083", code: "083", categoryKey: "calisma_lojistik", categoryLabel: "08. Askerlik, Ehliyet & Koşullar", label: "Pasaport / Vize Durumu", shortDesc: "Aktif pasaport veya Schengen/ABD vizesi", tier: "premium", inputType: "select", options: ["Var", "Belirtilmemiş"] },
  { id: "c084", code: "084", categoryKey: "calisma_lojistik", categoryLabel: "08. Askerlik, Ehliyet & Koşullar", label: "Sigara Kullanımı Beyanı", shortDesc: "CV'de sigara kullanmadığı belirtilmiş mi?", tier: "premium", inputType: "select", options: ["Kullanmıyor", "Belirtilmemiş"] },

  // 09. SEKTÖREL UZMANLIK ALANLARI (85-92)
  { id: "c085", code: "085", categoryKey: "sektorel", categoryLabel: "09. Sektörel Uzmanlık", label: "Üretim / Sanayi / Fabrika", shortDesc: "İmalat, üretim hattı ve fabrika deneyimi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c086", code: "086", categoryKey: "sektorel", categoryLabel: "09. Sektörel Uzmanlık", label: "Finans / Bankacılık / Muhasebe", shortDesc: "Finansal raporlama, banka veya muhasebe", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c087", code: "087", categoryKey: "sektorel", categoryLabel: "09. Sektörel Uzmanlık", label: "Satış / B2B / İş Geliştirme", shortDesc: "Saha satış, kurumsal satış veya müşteri yönetimi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c088", code: "088", categoryKey: "sektorel", categoryLabel: "09. Sektörel Uzmanlık", label: "Lojistik / Tedarik Zinciri / Depo", shortDesc: "Satınalma, planlama, sevkiyat ve gümrük", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c089", code: "089", categoryKey: "sektorel", categoryLabel: "09. Sektörel Uzmanlık", label: "İnşaat / Şantiye / Mimarlık", shortDesc: "Saha mühendisliği, hakediş veya mimari proje", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c090", code: "090", categoryKey: "sektorel", categoryLabel: "09. Sektörel Uzmanlık", label: "Sağlık / Medikal / İlaç / Klinik", shortDesc: "Hastane, klinik veya medikal sektör geçmişi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c091", code: "091", categoryKey: "sektorel", categoryLabel: "09. Sektörel Uzmanlık", label: "Hukuk / Mevzuat / Uyum (Compliance)", shortDesc: "Avukatlık, KVKK, sözleşme ve dava takibi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c092", code: "092", categoryKey: "sektorel", categoryLabel: "09. Sektörel Uzmanlık", label: "Eğitim / Akademi / Öğretmenlik", shortDesc: "Eğitmenlik, akademisyenlik veya pedagojik formasyon", tier: "premium", inputType: "select", options: ["Var", "Yok"] },

  // 10. REFERANS & EK SEÇENEKLER (93-100)
  { id: "c093", code: "093", categoryKey: "ek_degerlendirme", categoryLabel: "10. Referans & Ek Seçenekler", label: "Referans Bilgisi Var mı?", shortDesc: "CV'de açık referans kişi/kurum yazıyor mu?", tier: "premium", inputType: "select", options: ["Var", "İstenildiğinde Verilecek / Yok"] },
  { id: "c094", code: "094", categoryKey: "ek_degerlendirme", categoryLabel: "10. Referans & Ek Seçenekler", label: "LinkedIn / GitHub / Portfolyo", shortDesc: "Profesyonel profil veya portfolyo bağlantısı", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c095", code: "095", categoryKey: "ek_degerlendirme", categoryLabel: "10. Referans & Ek Seçenekler", label: "Ödül / Burs / Başarı Derecesi", shortDesc: "Onur/Yüksek Onur öğrencisi veya yarışma ödülü", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c096", code: "096", categoryKey: "ek_degerlendirme", categoryLabel: "10. Referans & Ek Seçenekler", label: "Kulüp / STK / Gönüllülük", shortDesc: "Öğrenci topluluğu veya sosyal sorumluluk", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c097", code: "097", categoryKey: "ek_degerlendirme", categoryLabel: "10. Referans & Ek Seçenekler", label: "TÜBİTAK / Ar-Ge / Patent Projesi", shortDesc: "Bilimsel veya Ar-Ge proje deneyimi", tier: "premium", inputType: "select", options: ["Var", "Yok"] },
  { id: "c098", code: "098", categoryKey: "ek_degerlendirme", categoryLabel: "10. Referans & Ek Seçenekler", label: "Maaş Beklentisi Beyanı", shortDesc: "CV içinde ücret beklentisi belirtilmiş mi?", tier: "premium", inputType: "text" },
  { id: "c099", code: "099", categoryKey: "ek_degerlendirme", categoryLabel: "10. Referans & Ek Seçenekler", label: "Engellilik / Özel Kadro Durumu", shortDesc: "Engelli kadrosu beyanı", tier: "premium", inputType: "select", options: ["Belirtilmiş", "Belirtilmemiş"] },
  { id: "c100", code: "100", categoryKey: "ek_degerlendirme", categoryLabel: "10. Referans & Ek Seçenekler", label: "CV Doluluk & Yapı Kalitesi", shortDesc: "Özgeçmişin genel detay seviyesi", tier: "premium", inputType: "select", options: ["Yüksek / Detaylı", "Orta", "Kısa / Özet"] },
];

export function extractAll100ValuesFromCV(
  rawText: string,
  fileName: string
): Record<string, string> {
  const text = rawText || "";
  const lower = text.toLocaleLowerCase("tr-TR");
  const meta = extractCandidateMetadataFromText(text, fileName);
  const g = detectGenderFromCV(meta.fullName, text);
  const a = detectAgeFromCV(text);
  const edu = extractEducationFromCV(text);

  const byDeg = edu.educationByDegree || {};
  const hasBsc = Boolean(
    byDeg.bachelor ||
      edu.allDegrees.some((d) => /lisans\s*\(bachelor/i.test(d)) ||
      /lisans\s*\(bachelor/i.test(edu.degree)
  );
  const hasAssoc = Boolean(
    byDeg.associate ||
      edu.allDegrees.some((d) => /ön\s*lisans/i.test(d))
  );
  const hasMsc = Boolean(
    byDeg.master ||
      edu.allDegrees.some((d) => /yüksek\s*lisans|master/i.test(d))
  );
  const hasPhd = Boolean(
    byDeg.phd || edu.allDegrees.some((d) => /doktora|ph\.?d/i.test(d))
  );

  const emailMatch = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  const phoneMatch = text.match(
    /(?:\+90|0)?\s*\(?5\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/
  );
  const gpaMatch = text.match(
    /(?:gpa|agno|gano|ortalama|not\s*ortalaması)\s*[:=-]?\s*([23]\.\d{1,2}|[6789]\d(?:\.\d+)?)/i
  );

  // Meslek / Ne İşi Yapar tespiti
  const detectProfession = (): string => {
    const rolePatterns: [RegExp, string][] = [
      [/yazılım\s*mühendis|software\s*engineer|full\s*stack|frontend|backend\s*developer/i, "Yazılım Mühendisi / Geliştirici"],
      [/veri\s*bilim|data\s*scien|veri\s*analist|data\s*analyst/i, "Veri Analisti / Veri Bilimci"],
      [/endüstri\s*mühendis|industrial\s*engineer/i, "Endüstri Mühendisi"],
      [/makine\s*mühendis|mechanical\s*engineer/i, "Makine Mühendisi"],
      [/elektrik\s*elektronik\s*mühendis|electrical\s*engineer/i, "Elektrik-Elektronik Mühendisi"],
      [/inşaat\s*mühendis|civil\s*engineer|şantiye\s*şefi/i, "İnşaat Mühendisi"],
      [/mimar|architect/i, "Mimar / İç Mimar"],
      [/avukat|hukuk\s*müşavir|legal\s*counsel|stajyer\s*avukat/i, "Avukat / Hukukçu"],
      [/insan\s*kaynakları|ik\s*uzman|human\s*resources|talent\s*acquisition/i, "İnsan Kaynakları Uzmanı"],
      [/muhasebe|mali\s*müşavir|finans\s*uzman|financial\s*analyst|denetçi|auditor/i, "Finans & Muhasebe Uzmanı"],
      [/satış\s*uzman|satış\s*temsilci|iş\s*geliştirme|business\s*development|account\s*manager/i, "Satış & İş Geliştirme Uzmanı"],
      [/pazarlama|dijital\s*pazarlama|marketing\s*specialist|sosyal\s*medya/i, "Pazarlama & İletişim Uzmanı"],
      [/lojistik|tedarik\s*zinciri|satın\s*alma|supply\s*chain|procurement|dış\s*ticaret/i, "Tedarik Zinciri / Lojistik / Satınalma"],
      [/öğretmen|eğitmen|akademisyen|araştırma\s*görevlisi|lecturer/i, "Eğitmen / Akademisyen"],
      [/psikolog|klinik\s*psikolog|rehberlik/i, "Psikolog / Danışman"],
      [/hemşire|doktor|eczacı|diş\s*hekimi|fizyoterapist|diyetisyen/i, "Sağlık Profesyoneli"],
      [/grafik\s*tasarım|ui\/ux|art\s*director|tasarımcı/i, "Tasarımcı (UI/UX & Grafik)"],
      [/idari\s*işler|ofis\s*yönetici|yönetici\s*asistan|sekreter/i, "İdari İşler / Yönetici Asistanı"],
      [/tekniker|teknisyen|operatör|bakım\s*onarım/i, "Tekniker / Teknisyen"],
    ];
    for (const [rx, label] of rolePatterns) {
      if (rx.test(text)) return label;
    }
    if (edu.department && edu.department !== "Belirtilmemiş") {
      return `${edu.department} Alanı / Mezunu`;
    }
    return "Genel Başvuru / Uzman Adayı";
  };

  const hasKeyword = (rx: RegExp) => (rx.test(lower) ? "Var" : "Yok");

  const values: Record<string, string> = {
    c001: meta.fullName,
    c002: a.age !== null ? String(a.age) : "Belirsiz",
    c003: g.gender,
    c004: a.age !== null ? String(2026 - a.age) : "Belirtilmemiş",
    c005: meta.city || "Belirtilmemiş",
    c006: "Belirtilmemiş",
    c007: /\bevli\b/i.test(lower)
      ? "Evli"
      : /\bbekar\b/i.test(lower)
      ? "Bekar"
      : "Belirtilmemiş",
    c008: "T.C.",
    c009: emailMatch ? emailMatch[0] : "Belirtilmemiş",
    c010: phoneMatch ? phoneMatch[0].trim() : "Belirtilmemiş",

    c011: hasBsc ? "Var" : "Yok",
    c012: byDeg.bachelor?.university || (hasBsc ? edu.university : "—"),
    c013: byDeg.bachelor?.department || (hasBsc ? edu.department : "—"),
    c014: "Belirtilmemiş",
    c015: gpaMatch ? gpaMatch[1] : "Belirtilmemiş",
    c016: hasAssoc ? "Var" : "Yok",
    c017: byDeg.associate?.university || "—",
    c018: byDeg.associate?.department || "—",
    c019: /çift\s*anadal|çap|yandal|minor|double\s*major/i.test(lower) ? "Var" : "Yok",
    c020: /fen\s*lisesi|anadolu\s*lisesi|kolej|meslek\s*lisesi|imam\s*hatip/i.exec(text)?.[0] || "Belirtilmemiş",

    c021: hasMsc ? "Var" : "Yok",
    c022: byDeg.master?.university || "—",
    c023: byDeg.master?.department || "—",
    c024: /tezli/i.test(lower) ? "Tezli" : /tezsiz/i.test(lower) ? "Tezsiz" : "Belirtilmemiş",
    c025: /\bmba\b/i.test(lower) ? "Var" : "Yok",
    c026: hasPhd ? "Var" : "Yok",
    c027: byDeg.phd?.university || "—",
    c028: byDeg.phd?.department || "—",
    c029: /makale|yayın|publication|journal|bildiri|konferans/i.test(lower) ? "Var" : "Yok",
    c030: /erasmus|exchange|değişim\s*programı/i.test(lower) ? "Var" : "Yok",

    c031: detectProfession(),
    c032: String(meta.experienceYears ?? 0),
    c033: /halen|devam\s*ediyor|present|current|aktif/i.test(lower) ? "Aktif Çalışıyor" : "İş Arıyor / Boşta",
    c034: "CV Metninde Mevcut",
    c035: detectProfession(),
    c036:
      (meta.experienceYears || 0) >= 6
        ? "Senior (Kıdemli)"
        : (meta.experienceYears || 0) >= 2
        ? "Mid-Level (Orta)"
        : "Yeni Mezun / Junior",
    c037: /staj|stajyer|intern/i.test(lower) ? "Var" : "Yok",
    c038: /ekip\s*yönet|takım\s*lider|müdür|yönetici|team\s*lead|manager|direktör/i.test(lower) ? "Var" : "Yok",
    c039: /holding|a\.ş\.|bank|global|international|kurumsal/i.test(lower) ? "Var" : "Yok",
    c040: /bakanlık|belediye|kamu|müsteşarlık|kurumu|devlet/i.test(lower) ? "Var" : "Yok",
    c041: /proje\s*yönet|project\s*manage|pmp|koordinatör/i.test(lower) ? "Var" : "Yok",
    c042: /bütçe|satın\s*alma|p&l|ihale|maliyet/i.test(lower) ? "Var" : "Yok",

    c043: /c1|c2|advanced|upper[\s-]*intermediate|fluent|iyi\s*derecede\s*ingilizce|ileri\s*seviye\s*ingilizce/i.test(lower)
      ? "İleri (C1/C2)"
      : /ingilizce|english|b1|b2|intermediate/i.test(lower)
      ? "Orta-Üst (B2)"
      : "Yok / Belirtilmemiş",
    c044: /almanca|german|deutsch/i.test(lower) ? "Orta" : "Yok",
    c045: /fransızca|french/i.test(lower) ? "Orta" : "Yok",
    c046: /ispanyolca|spanish/i.test(lower) ? "Orta" : "Yok",
    c047: /rusça|russian/i.test(lower) ? "Orta" : "Yok",
    c048: /arapça|arabic/i.test(lower) ? "Orta" : "Yok",
    c049: /italyanca|çince|japonca|korece|felemenkçe/i.exec(text)?.[0] || "Yok",
    c050: /toefl|ielts/i.test(lower) ? "Var" : "Belirtilmemiş",
    c051: /yds|yökdil/i.test(lower) ? "Var" : "Belirtilmemiş",
    c052: /(?:ingilizce|english)[\s\S]{0,120}(?:almanca|fransızca|ispanyolca|rusça|arapça|italyanca)/i.test(lower) ? "Var" : "Yok",

    c053: /ileri\s*excel|vba|makro|pivot/i.test(lower)
      ? "İleri / Uzman"
      : /excel|ms\s*office|office\s*program/i.test(lower)
      ? "Orta / İyi"
      : "Temel / Yok",
    c054: hasKeyword(/\bsap\b|erp|canias|netsis|logo\s*tiger|oracle\s*erp/i),
    c055: hasKeyword(/python|pandas|numpy|\bmatlab\b/i),
    c056: hasKeyword(/\bjava\b|c#|c\+\+|\.net|spring\s*boot/i),
    c057: hasKeyword(/javascript|typescript|react|next\.js|vue|angular|node\.js/i),
    c058: hasKeyword(/\bsql\b|postgresql|mysql|mssql|mongodb|veritabanı/i),
    c059: hasKeyword(/power\s*bi|tableau|veri\s*görselleştirme|dashboard/i),
    c060: hasKeyword(/autocad|solidworks|catia|ansys|revit|netcad/i),
    c061: hasKeyword(/yapay\s*zeka|machine\s*learning|deep\s*learning|ai\b|llm|veri\s*bilimi/i),
    c062: hasKeyword(/aws|docker|kubernetes|linux|azure|devops|git\b/i),
    c063: hasKeyword(/figma|photoshop|illustrator|indesign|premiere|ui\/ux/i),
    c064: hasKeyword(/crm|salesforce|hubspot|zoho/i),

    c065: String((text.match(/sertifika|certificate|eğitimi|kurs/gi) || []).length),
    c066: hasKeyword(/\bpmp\b|scrum|agile|prince2/i),
    c067: hasKeyword(/smmm|spk|bağımsız\s*denetim|ymm/i),
    c068: hasKeyword(/\bisg\b|iş\s*sağlığı\s*ve\s*güvenliği|iş\s*güvenliği\s*uzman/i),
    c069: hasKeyword(/iso\s*9001|iso\s*14001|iso\s*27001|kalite\s*yönetim/i),
    c070: hasKeyword(/mesleki\s*yeterlilik|myk\b|kalfalık|ustalık/i),
    c071: hasKeyword(/google\s*ads|google\s*analytics|seo|dijital\s*pazarlama/i),
    c072: hasKeyword(/bordro|özlük|iş\s*hukuku|sgk\s*mevzuat/i),
    c073: hasKeyword(/ilk\s*yardım|hijyen\s*belgesi/i),
    c074: hasKeyword(/dış\s*ticaret|gümrük|ithalat|ihracat/i),

    c075:
      g.gender === "Kadın"
        ? "Kadın Aday (Muaf)"
        : /askerlik\s*[:=-]?\s*(?:yapıldı|tamamlandı|terhis|bedelli)/i.test(lower)
        ? "Tamamlandı / Yapıldı"
        : /muaf/i.test(lower)
        ? "Muaf"
        : /tecil/i.test(lower)
        ? "Tecilli"
        : "Belirtilmemiş",
    c076: /ehliyet|sürücü\s*belgesi|\bb\s*sınıfı\b/i.test(lower) ? "Var (B Sınıfı)" : "Yok / Belirtilmemiş",
    c077: hasKeyword(/\bsrc\b|psikoteknik/i),
    c078: /seyahat\s*engeli\s*yok/i.test(lower) ? "Seyahat Engeli Yok" : "Belirtilmemiş",
    c079: /vardiya|esnek\s*çalışma/i.test(lower) ? "Uygun" : "Belirtilmemiş",
    c080: /remote|uzaktan\s*çalışma|hibrit|hybrid/i.test(lower) ? "Var" : "Belirtilmemiş",
    c081: "Belirtilmemiş",
    c082: "Hemen Başlayabilir",
    c083: /pasaport|schengen|vize/i.test(lower) ? "Var" : "Belirtilmemiş",
    c084: /sigara\s*kullanm/i.test(lower) ? "Kullanmıyor" : "Belirtilmemiş",

    c085: hasKeyword(/üretim|fabrika|imalat|vardiya\s*mühendis|kalite\s*kontrol/i),
    c086: hasKeyword(/finans|banka|muhasebe|denetim|bütçe|vergi/i),
    c087: hasKeyword(/satış|pazarlama|b2b|müşteri\s*temsilci|iş\s*geliştirme/i),
    c088: hasKeyword(/lojistik|tedarik|depo|sevkiyat|satın\s*alma|operasyon/i),
    c089: hasKeyword(/şantiye|inşaat|mimar|hakediş|keşif|metraj/i),
    c090: hasKeyword(/hastane|klinik|medikal|ilaç|sağlık|hasta/i),
    c091: hasKeyword(/hukuk|avukat|dava|icra|sözleşme|kvkk/i),
    c092: hasKeyword(/öğretmen|eğitim|akademi|fakülte|ders|öğrenci/i),

    c093: /referans/i.test(lower) ? "Var" : "İstenildiğinde Verilecek / Yok",
    c094: hasKeyword(/linkedin\.com|github\.com|behance\.net|portfolyo|portfolio/i),
    c095: hasKeyword(/onur\s*öğrencisi|yüksek\s*onur|burs|ödül|derece|birincilik/i),
    c096: hasKeyword(/kulüp|topluluk|gönüllü|dernek|vakıf|ieee|aieste/i),
    c097: hasKeyword(/tübitak|teknofest|ar-ge|patent|hibe/i),
    c098: "Belirtilmemiş",
    c099: "Belirtilmemiş",
    c100: text.length > 1800 ? "Yüksek / Detaylı" : text.length > 700 ? "Orta" : "Kısa / Özet",
  };

  return values;
}
