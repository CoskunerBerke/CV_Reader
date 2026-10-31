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
  inputType: "text" | "number" | "select";
  options?: string[];
}

export const CRITERIA_CATEGORIES: { key: string; label: string }[] = [
  { key: "demografi", label: "01. Kimlik & İletişim" },
  { key: "lisans_onlisans", label: "02. Lisans & Ön Lisans" },
  { key: "master_phd", label: "03. Yüksek Lisans & Doktora" },
  { key: "meslek_deneyim", label: "04. Meslek & İş Deneyimi" },
  { key: "yabanci_dil", label: "05. Yabancı Diller" },
  { key: "teknik_yazilim", label: "06. Yazılım & Programlar" },
  { key: "sertifika_belge", label: "07. Sertifika & Belgeler" },
  { key: "calisma_lojistik", label: "08. Ehliyet, Askerlik & Koşullar" },
  { key: "sektorel", label: "09. Sektörel Deneyim" },
  { key: "ek_degerlendirme", label: "10. Proje, Başarı & Ek Alanlar" },
];

// Tüm alanlar doğrudan değer yazar; CV'de yoksa "-" yazar ("Var / Yok / Belirtilmemiş" kullanılmaz)
export const INITIAL_100_CRITERIA: CriterionDefinition[] = [
  // 01. KİMLİK & İLETİŞİM (001-010)
  { id: "c001", code: "001", categoryKey: "demografi", categoryLabel: "01. Kimlik & İletişim", label: "Ad Soyad", shortDesc: "Adayın tam adı ve soyadı", tier: "default", inputType: "text" },
  { id: "c002", code: "002", categoryKey: "demografi", categoryLabel: "01. Kimlik & İletişim", label: "Yaş", shortDesc: "Adayın yaşı (yoksa -)", tier: "default", inputType: "text" },
  { id: "c003", code: "003", categoryKey: "demografi", categoryLabel: "01. Kimlik & İletişim", label: "Cinsiyet", shortDesc: "Kadın / Erkek / -", tier: "default", inputType: "text" },
  { id: "c004", code: "004", categoryKey: "demografi", categoryLabel: "01. Kimlik & İletişim", label: "Doğum Yılı", shortDesc: "Doğum yılı (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c005", code: "005", categoryKey: "demografi", categoryLabel: "01. Kimlik & İletişim", label: "İkamet Şehri", shortDesc: "Yaşadığı il (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c006", code: "006", categoryKey: "demografi", categoryLabel: "01. Kimlik & İletişim", label: "İkamet İlçesi", shortDesc: "Yaşadığı ilçe (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c007", code: "007", categoryKey: "demografi", categoryLabel: "01. Kimlik & İletişim", label: "Medeni Durum", shortDesc: "Evli / Bekar (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c008", code: "008", categoryKey: "demografi", categoryLabel: "01. Kimlik & İletişim", label: "Uyruk / Vatandaşlık", shortDesc: "Ülke / Vatandaşlık (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c009", code: "009", categoryKey: "demografi", categoryLabel: "01. Kimlik & İletişim", label: "E-Posta Adresi", shortDesc: "E-posta adresi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c010", code: "010", categoryKey: "demografi", categoryLabel: "01. Kimlik & İletişim", label: "Telefon Numarası", shortDesc: "Telefon numarası (yoksa -)", tier: "premium", inputType: "text" },

  // 02. LİSANS & ÖN LİSANS (011-020)
  { id: "c011", code: "011", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lisans Üniversitesi", shortDesc: "Mezun olduğu lisans üniversitesi (yoksa -)", tier: "default", inputType: "text" },
  { id: "c012", code: "012", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lisans Bölümü", shortDesc: "Lisans fakülte / bölümü (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c013", code: "013", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lisans Mezuniyet Yılı", shortDesc: "Lisans bitiş yılı (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c014", code: "014", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lisans Not Ortalaması (GPA)", shortDesc: "AGNO / GPA ortalaması (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c015", code: "015", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lisans Eğitim Dili / Oranı", shortDesc: "%100 İngilizce, %30 İngilizce vb. (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c016", code: "016", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Ön Lisans Üniversitesi", shortDesc: "2 yıllık MYO üniversitesi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c017", code: "017", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Ön Lisans Bölümü", shortDesc: "2 yıllık ön lisans bölümü (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c018", code: "018", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Ön Lisans Mezuniyet Yılı", shortDesc: "Ön lisans bitiş yılı (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c019", code: "019", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Çift Anadal / Yandal Bölümü", shortDesc: "ÇAP / Yandal alanı (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c020", code: "020", categoryKey: "lisans_onlisans", categoryLabel: "02. Lisans & Ön Lisans", label: "Lise Okul Adı / Türü", shortDesc: "Mezun olduğu lise (yoksa -)", tier: "premium", inputType: "text" },

  // 03. YÜKSEK LİSANS & DOKTORA (021-030)
  { id: "c021", code: "021", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Yüksek Lisans Üniversitesi", shortDesc: "Master yaptığı üniversite (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c022", code: "022", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Yüksek Lisans Bölümü", shortDesc: "Master programı / bölümü (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c023", code: "023", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Yüksek Lisans Mezuniyet Yılı", shortDesc: "Master bitiş yılı (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c024", code: "024", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Master Program Türü (Tezli/Tezsiz)", shortDesc: "Tezli / Tezsiz / MBA (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c025", code: "025", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "MBA Programı / Okulu", shortDesc: "MBA bilgisi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c026", code: "026", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Doktora (Ph.D.) Üniversitesi", shortDesc: "Doktora yaptığı üniversite (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c027", code: "027", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Doktora (Ph.D.) Bölümü", shortDesc: "Doktora uzmanlık bölümü (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c028", code: "028", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Bitirme Projesi / Tez Konusu", shortDesc: "Tez veya bitirme projesi başlığı (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c029", code: "029", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Akademik Yayın & Makaleler", shortDesc: "Yayınlanan makale/bildiri (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c030", code: "030", categoryKey: "master_phd", categoryLabel: "03. Yüksek Lisans & Doktora", label: "Erasmus / Yurtdışı Eğitim", shortDesc: "Değişim programı üniversitesi (yoksa -)", tier: "premium", inputType: "text" },

  // 04. MESLEK & İŞ DENEYİMİ (031-042)
  { id: "c031", code: "031", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Meslek / Uzmanlık Unvanı", shortDesc: "Adayın ne iş yaptığı (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c032", code: "032", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Toplam İş Deneyimi (Yıl)", shortDesc: "Toplam çalışma süresi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c033", code: "033", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Mevcut Çalışma Durumu", shortDesc: "Aktif Çalışıyor / Yeni Mezun vb. (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c034", code: "034", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Son Çalıştığı Şirket", shortDesc: "En son çalıştığı kurum adı (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c035", code: "035", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Son Pozisyonu / Görevi", shortDesc: "En son görev unvanı (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c036", code: "036", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Kıdem Seviyesi", shortDesc: "Junior / Mid / Senior / Lead (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c037", code: "037", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Staj Deneyimi", shortDesc: "Staj yaptığı kurum/alan (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c038", code: "038", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Yönetim & Liderlik Rolü", shortDesc: "Takım liderliği / yöneticilik (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c039", code: "039", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Kurumsal / Global Şirket Geçmişi", shortDesc: "Holding / global firma adı (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c040", code: "040", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Kamu Kurumu Deneyimi", shortDesc: "Kamu / bakanlık / belediye (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c041", code: "041", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Proje Yönetimi Metodolojisi", shortDesc: "Agile, Scrum, Kanban, PMP (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c042", code: "042", categoryKey: "meslek_deneyim", categoryLabel: "04. Meslek & İş Deneyimi", label: "Bütçe & Satınalma Yönetimi", shortDesc: "Bütçe/ihale sorumluluğu (yoksa -)", tier: "premium", inputType: "text" },

  // 05. YABANCI DİLLER (043-052)
  { id: "c043", code: "043", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Diller", label: "İngilizce Seviyesi", shortDesc: "C1, B2, İleri, Orta vb. (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c044", code: "044", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Diller", label: "Almanca Seviyesi", shortDesc: "Almanca seviyesi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c045", code: "045", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Diller", label: "Fransızca Seviyesi", shortDesc: "Fransızca seviyesi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c046", code: "046", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Diller", label: "İspanyolca Seviyesi", shortDesc: "İspanyolca seviyesi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c047", code: "047", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Diller", label: "Rusça Seviyesi", shortDesc: "Rusça seviyesi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c048", code: "048", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Diller", label: "Arapça Seviyesi", shortDesc: "Arapça seviyesi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c049", code: "049", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Diller", label: "Diğer Yabancı Diller", shortDesc: "İtalyanca, Çince, Japonca vb. (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c050", code: "050", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Diller", label: "TOEFL / IELTS Puanı", shortDesc: "Sınav skoru (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c051", code: "051", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Diller", label: "YDS / YÖKDİL Puanı", shortDesc: "Sınav skoru (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c052", code: "052", categoryKey: "yabanci_dil", categoryLabel: "05. Yabancı Diller", label: "Tüm Bildiği Yabancı Diller", shortDesc: "Bildiği dillerin özeti (yoksa -)", tier: "premium", inputType: "text" },

  // 06. YAZILIM & PROGRAMLAR (053-064)
  { id: "c053", code: "053", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "MS Office & Excel Yetkinliği", shortDesc: "Excel, Word, PowerPoint, VBA (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c054", code: "054", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "SAP & ERP Programları", shortDesc: "SAP, Logo, Netsis, Canias, Oracle (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c055", code: "055", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "Python & Veri Bilimi Araçları", shortDesc: "Python, Pandas, NumPy, MATLAB, R (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c056", code: "056", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "Backend & Sistem Dilleri", shortDesc: "Java, C#, .NET, C++, Go (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c057", code: "057", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "Web & Frontend Teknolojileri", shortDesc: "JavaScript, TypeScript, React, Next.js (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c058", code: "058", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "Veritabanı & SQL Sistemleri", shortDesc: "MySQL, PostgreSQL, MSSQL, MongoDB (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c059", code: "059", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "İş Zekası & Raporlama Araçları", shortDesc: "Power BI, Tableau, Looker (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c060", code: "060", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "Mühendislik & CAD Yazılımları", shortDesc: "AutoCAD, SolidWorks, CATIA, ANSYS (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c061", code: "061", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "Yapay Zeka & Derin Öğrenme", shortDesc: "PyTorch, TensorFlow, YOLO, OpenCV, LLM (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c062", code: "062", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "Bulut, DevOps & Test Araçları", shortDesc: "AWS, Docker, Linux, Git, Postman (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c063", code: "063", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "Tasarım & UI/UX Programları", shortDesc: "Figma, Photoshop, Illustrator (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c064", code: "064", categoryKey: "teknik_yazilim", categoryLabel: "06. Yazılım & Programlar", label: "CRM & İş Takip Yazılımları", shortDesc: "Salesforce, Jira, HubSpot, Trello (yoksa -)", tier: "premium", inputType: "text" },

  // 07. SERTİFİKA & BELGELER (065-074)
  { id: "c065", code: "065", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Belgeler", label: "Sertifika & Kurs Sayısı", shortDesc: "Tespit edilen sertifika adedi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c066", code: "066", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Belgeler", label: "Proje Yönetimi Sertifikaları", shortDesc: "PMP, Scrum Master, Agile (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c067", code: "067", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Belgeler", label: "Finans & Denetim Ruhsatları", shortDesc: "SMMM, SPK, YMM (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c068", code: "068", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Belgeler", label: "İş Sağlığı ve Güvenliği (İSG)", shortDesc: "İSG A/B/C Sınıfı Belgesi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c069", code: "069", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Belgeler", label: "Kalite & ISO Sertifikaları", shortDesc: "ISO 9001, ISO 27001, IATF (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c070", code: "070", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Belgeler", label: "Mesleki Yeterlilik (MYK) Belgesi", shortDesc: "MYK / Ustalık / Kalfalık (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c071", code: "071", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Belgeler", label: "Dijital Pazarlama Sertifikaları", shortDesc: "Google Ads, Analytics, SEO (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c072", code: "072", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Belgeler", label: "İK & İş Hukuku Sertifikaları", shortDesc: "Bordro, Özlük, SGK Eğitimi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c073", code: "073", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Belgeler", label: "İlk Yardım & Hijyen Belgeleri", shortDesc: "İlk yardım / hijyen sertifikası (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c074", code: "074", categoryKey: "sertifika_belge", categoryLabel: "07. Sertifika & Belgeler", label: "Dış Ticaret & Gümrük Sertifikası", shortDesc: "İhracat / ithalat eğitimi (yoksa -)", tier: "premium", inputType: "text" },

  // 08. EHLİYET, ASKERLİK & KOŞULLAR (075-084)
  { id: "c075", code: "075", categoryKey: "calisma_lojistik", categoryLabel: "08. Ehliyet, Askerlik & Koşullar", label: "Askerlik Durumu", shortDesc: "Yapıldı / Muaf / Tecilli (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c076", code: "076", categoryKey: "calisma_lojistik", categoryLabel: "08. Ehliyet, Askerlik & Koşullar", label: "Sürücü Belgesi (Ehliyet)", shortDesc: "B Sınıfı, A2, E vb. (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c077", code: "077", categoryKey: "calisma_lojistik", categoryLabel: "08. Ehliyet, Askerlik & Koşullar", label: "SRC & Psikoteknik Belgesi", shortDesc: "SRC 1/2/3/4, Psikoteknik (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c078", code: "078", categoryKey: "calisma_lojistik", categoryLabel: "08. Ehliyet, Askerlik & Koşullar", label: "Seyahat Uygunluğu", shortDesc: "Yurtiçi / yurtdışı seyahat durumu (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c079", code: "079", categoryKey: "calisma_lojistik", categoryLabel: "08. Ehliyet, Askerlik & Koşullar", label: "Vardiyalı & Esnek Çalışma", shortDesc: "Vardiya uygunluğu (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c080", code: "080", categoryKey: "calisma_lojistik", categoryLabel: "08. Ehliyet, Askerlik & Koşullar", label: "Uzaktan / Hibrit Çalışma", shortDesc: "Remote / Hibrit (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c081", code: "081", categoryKey: "calisma_lojistik", categoryLabel: "08. Ehliyet, Askerlik & Koşullar", label: "Şehir Değişikliği (Relokasyon)", shortDesc: "Taşınma uygunluğu (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c082", code: "082", categoryKey: "calisma_lojistik", categoryLabel: "08. Ehliyet, Askerlik & Koşullar", label: "İşe Başlama / İhbar Süresi", shortDesc: "Hemen / İhbar süresi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c083", code: "083", categoryKey: "calisma_lojistik", categoryLabel: "08. Ehliyet, Askerlik & Koşullar", label: "Pasaport & Vize Bilgisi", shortDesc: "Pasaport / Schengen / ABD vizesi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c084", code: "084", categoryKey: "calisma_lojistik", categoryLabel: "08. Ehliyet, Askerlik & Koşullar", label: "Sigara Kullanımı Beyanı", shortDesc: "Sigara beyanı (yoksa -)", tier: "premium", inputType: "text" },

  // 09. SEKTÖREL DENEYİM (085-092)
  { id: "c085", code: "085", categoryKey: "sektorel", categoryLabel: "09. Sektörel Deneyim", label: "Üretim & Sanayi Deneyimi", shortDesc: "Fabrika, imalat, kalite kontrol (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c086", code: "086", categoryKey: "sektorel", categoryLabel: "09. Sektörel Deneyim", label: "Finans, Banka & Muhasebe", shortDesc: "Banka, finans, muhasebe alanı (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c087", code: "087", categoryKey: "sektorel", categoryLabel: "09. Sektörel Deneyim", label: "Satış, B2B & İş Geliştirme", shortDesc: "Satış ve müşteri yönetimi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c088", code: "088", categoryKey: "sektorel", categoryLabel: "09. Sektörel Deneyim", label: "Lojistik & Tedarik Zinciri", shortDesc: "Planlama, depo, satınalma (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c089", code: "089", categoryKey: "sektorel", categoryLabel: "09. Sektörel Deneyim", label: "İnşaat, Şantiye & Mimarlık", shortDesc: "Saha, hakediş, mimari proje (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c090", code: "090", categoryKey: "sektorel", categoryLabel: "09. Sektörel Deneyim", label: "Sağlık, Medikal & İlaç", shortDesc: "Hastane, klinik, medikal (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c091", code: "091", categoryKey: "sektorel", categoryLabel: "09. Sektörel Deneyim", label: "Hukuk & Mevzuat Uzmanlığı", shortDesc: "Avukatlık, sözleşme, KVKK (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c092", code: "092", categoryKey: "sektorel", categoryLabel: "09. Sektörel Deneyim", label: "Eğitim & Akademik Kurum", shortDesc: "Öğretmenlik, akademi, eğitmenlik (yoksa -)", tier: "premium", inputType: "text" },

  // 10. PROJE, BAŞARI & EK ALANLAR (093-100)
  { id: "c093", code: "093", categoryKey: "ek_degerlendirme", categoryLabel: "10. Proje, Başarı & Ek Alanlar", label: "Referans Kişi / Kurumlar", shortDesc: "Belirtilen referans bilgisi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c094", code: "094", categoryKey: "ek_degerlendirme", categoryLabel: "10. Proje, Başarı & Ek Alanlar", label: "LinkedIn & GitHub Profilleri", shortDesc: "Profesyonel bağlantılar (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c095", code: "095", categoryKey: "ek_degerlendirme", categoryLabel: "10. Proje, Başarı & Ek Alanlar", label: "Ödül, Burs & Dereceler", shortDesc: "Onur derecesi, burs, ödül (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c096", code: "096", categoryKey: "ek_degerlendirme", categoryLabel: "10. Proje, Başarı & Ek Alanlar", label: "Kulüp, Topluluk & Gönüllülük", shortDesc: "Üye olunan topluluklar (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c097", code: "097", categoryKey: "ek_degerlendirme", categoryLabel: "10. Proje, Başarı & Ek Alanlar", label: "Ar-Ge, TÜBİTAK & Teknofest", shortDesc: "Ar-Ge veya yarışma projeleri (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c098", code: "098", categoryKey: "ek_degerlendirme", categoryLabel: "10. Proje, Başarı & Ek Alanlar", label: "Maaş Beklentisi", shortDesc: "Belirtilen ücret beklentisi (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c099", code: "099", categoryKey: "ek_degerlendirme", categoryLabel: "10. Proje, Başarı & Ek Alanlar", label: "Özel Kadro / Engellilik Beyanı", shortDesc: "Varsa özel kadro durumu (yoksa -)", tier: "premium", inputType: "text" },
  { id: "c100", code: "100", categoryKey: "ek_degerlendirme", categoryLabel: "10. Proje, Başarı & Ek Alanlar", label: "Özgeçmiş Dili (TR / EN)", shortDesc: "CV'nin yazıldığı dil (Türkçe / İngilizce)", tier: "premium", inputType: "text" },
];

export function cleanCriterionDisplayValue(
  raw: string | null | undefined
): string {
  if (!raw) return "-";
  const trimmed = String(raw).trim();
  if (
    !trimmed ||
    trimmed === "—" ||
    trimmed === "Yok" ||
    trimmed === "Var" ||
    trimmed === "Belirtilmemiş" ||
    trimmed === "Belirsiz" ||
    trimmed === "Yok / Belirtilmemiş" ||
    trimmed === "Temel / Yok" ||
    trimmed === "İstenildiğinde Verilecek / Yok"
  ) {
    return "-";
  }
  return trimmed;
}

function matchListFromText(text: string, items: [RegExp, string][]): string {
  const found: string[] = [];
  for (const [rx, label] of items) {
    if (rx.test(text) && !found.includes(label)) {
      found.push(label);
    }
  }
  return found.length > 0 ? found.join(", ") : "-";
}

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

  const emailMatch = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  const phoneMatch = text.match(
    /(?:\+90|0)?\s*\(?5\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/
  );
  const gpaMatch = text.match(
    /(?:gpa|agno|gano|ortalama|not\s*ortalaması)\s*[:=-]?\s*([23]\.\d{1,2}\s*(?:\/\s*4(?:\.00?)?)?|[6789]\d(?:\.\d+)?\s*(?:\/\s*100)?)/i
  );

  // İlçe tespiti
  const districtMatch = text.match(
    /\b(Ümraniye|Kadıköy|Beşiktaş|Şişli|Ataşehir|Maltepe|Kartal|Pendik|Tuzla|Üsküdar|Bakırköy|Bahçelievler|Küçükçekmece|Başakşehir|Beylikdüzü|Avcılar|Sarıyer|Kağıthane|Fatih|Zeytinburnu|Eyüpsultan|Çankaya|Yenimahalle|Keçiören|Mamak|Etimesgut|Sincan|Gölbaşı|Konak|Karşıyaka|Bornova|Buca|Çiğli|Gaziemir|Nilüfer|Osmangazi|Yıldırım|Tepebaşı|Odunpazarı|Muratpaşa|Konyaaltı|Kepez|Seyhan|Çukurova|Şahinbey|Şehitkamil|Selçuklu|Kocasinan|Melikgazi|İzmit|Gebze|Çorlu|İlkadım|Atakum|Ortahisar|Haliliye|Karaköprü|Yenişehir|Akdeniz|Toroslar|Mezitli|Pamukkale|Merkezefendi|Yunusemre|Şehzadeler|Efeler|Bandırma|Edremit|Bodrum|Fethiye|Marmaris|Alanya|Manavgat)\b/i
  );

  // Lisans mezuniyet yılı
  const gradYearMatch = text.match(
    /(?:20[012]\d)\s*[-–/]\s*(20[12]\d|devam|present|halen)/i
  );

  // Eğitim dili (%30 İngilizce, %100 İngilizce vb.)
  const eduLangMatch = text.match(
    /(%\s*(?:100|30)\s*(?:İngilizce|English)|Full\s*English|İngilizce\s*Eğitim)/i
  );

  // Tez / Bitirme projesi
  const thesisMatch = text.match(
    /(?:thesis(?:\s*work)?|bitirme\s*projesi|tez\s*konusu)\s*[:=-]\s*([^\n\r]{5,110})/i
  );

  // Meslek / Ne İşi Yapar tespiti
  const detectProfession = (): string => {
    const rolePatterns: [RegExp, string][] = [
      [/yazılım\s*mühendis|software\s*(?:development\s*)?engineer|full\s*stack|frontend|backend\s*developer/i, "Yazılım Mühendisi"],
      [/veri\s*bilim|data\s*scien|veri\s*analist|data\s*analyst/i, "Veri Bilimci / Veri Analisti"],
      [/yapay\s*zeka\s*mühendis|ai\s*engineer|machine\s*learning\s*engineer/i, "Yapay Zeka Mühendisi"],
      [/endüstri\s*mühendis|industrial\s*engineer/i, "Endüstri Mühendisi"],
      [/makine\s*mühendis|mechanical\s*engineer/i, "Makine Mühendisi"],
      [/elektrik[\s-]*elektronik\s*mühendis|electrical\s*(?:&\s*electronics\s*)?engineer/i, "Elektrik-Elektronik Mühendisi"],
      [/mekatronik\s*mühendis|mechatronics\s*engineer/i, "Mekatronik Mühendisi"],
      [/bilgisayar\s*mühendis|computer\s*engineer/i, "Bilgisayar Mühendisi"],
      [/inşaat\s*mühendis|civil\s*engineer|şantiye\s*şefi/i, "İnşaat Mühendisi"],
      [/mimar|architect/i, "Mimar"],
      [/avukat|hukuk\s*müşavir|legal\s*counsel|stajyer\s*avukat/i, "Avukat / Hukukçu"],
      [/insan\s*kaynakları|ik\s*uzman|human\s*resources|talent\s*acquisition/i, "İnsan Kaynakları Uzmanı"],
      [/muhasebe|mali\s*müşavir|finans\s*uzman|financial\s*analyst|denetçi|auditor/i, "Finans & Muhasebe Uzmanı"],
      [/satış\s*uzman|satış\s*temsilci|iş\s*geliştirme|business\s*development|account\s*manager/i, "Satış & İş Geliştirme Uzmanı"],
      [/pazarlama|dijital\s*pazarlama|marketing\s*specialist|sosyal\s*medya/i, "Pazarlama Uzmanı"],
      [/lojistik|tedarik\s*zinciri|satın\s*alma|supply\s*chain|procurement|dış\s*ticaret/i, "Tedarik Zinciri & Lojistik Uzmanı"],
      [/öğretmen|eğitmen|akademisyen|araştırma\s*görevlisi|lecturer/i, "Eğitmen / Akademisyen"],
      [/psikolog|klinik\s*psikolog|rehberlik/i, "Psikolog"],
      [/hemşire|doktor|eczacı|diş\s*hekimi|fizyoterapist|diyetisyen/i, "Sağlık Profesyoneli"],
      [/grafik\s*tasarım|ui\/ux|art\s*director|tasarımcı/i, "Tasarımcı (UI/UX & Grafik)"],
      [/idari\s*işler|ofis\s*yönetici|yönetici\s*asistan|sekreter/i, "İdari İşler / Yönetici Asistanı"],
      [/tekniker|teknisyen|operatör|bakım\s*onarım/i, "Tekniker / Teknisyen"],
    ];
    for (const [rx, label] of rolePatterns) {
      if (rx.test(text)) return label;
    }
    if (edu.department && edu.department !== "Belirtilmemiş") {
      return `${edu.department} Mezunu`;
    }
    return "-";
  };

  const bscUni = cleanCriterionDisplayValue(
    byDeg.bachelor?.university || (hasBsc ? edu.university : "-")
  );
  const bscDept = cleanCriterionDisplayValue(
    byDeg.bachelor?.department || (hasBsc ? edu.department : "-")
  );
  const assocUni = cleanCriterionDisplayValue(byDeg.associate?.university);
  const assocDept = cleanCriterionDisplayValue(byDeg.associate?.department);
  const masterUni = cleanCriterionDisplayValue(byDeg.master?.university);
  const masterDept = cleanCriterionDisplayValue(byDeg.master?.department);
  const phdUni = cleanCriterionDisplayValue(byDeg.phd?.university);
  const phdDept = cleanCriterionDisplayValue(byDeg.phd?.department);

  const certCount = (text.match(/sertifika|certificate|certification/gi) || [])
    .length;

  const englishLevel = /c1|c2|advanced|fluent|ileri\s*seviye\s*ingilizce|iyi\s*derecede\s*ingilizce/i.test(
    lower
  )
    ? "İleri (C1/C2)"
    : /upper[\s-]*intermediate|b2/i.test(lower)
    ? "Orta-Üst (B2)"
    : /b1|intermediate|orta\s*seviye\s*ingilizce/i.test(lower)
    ? "Orta (B1)"
    : /ingilizce|english|%\s*30\s*english|%\s*100\s*english/i.test(lower)
    ? "İngilizce"
    : "-";

  const allLangs: string[] = [];
  if (englishLevel !== "-") allLangs.push(`İngilizce (${englishLevel})`);
  if (/almanca|german|deutsch/i.test(lower)) allLangs.push("Almanca");
  if (/fransızca|french/i.test(lower)) allLangs.push("Fransızca");
  if (/ispanyolca|spanish/i.test(lower)) allLangs.push("İspanyolca");
  if (/rusça|russian/i.test(lower)) allLangs.push("Rusça");
  if (/arapça|arabic/i.test(lower)) allLangs.push("Arapça");

  const socialLinks: string[] = [];
  if (/linkedin/i.test(lower)) socialLinks.push("LinkedIn");
  if (/github/i.test(lower)) socialLinks.push("GitHub");
  if (/behance|dribbble|portfolyo|portfolio/i.test(lower))
    socialLinks.push("Portfolyo");

  const values: Record<string, string> = {
    c001: cleanCriterionDisplayValue(meta.fullName),
    c002: a.age !== null ? String(a.age) : "-",
    c003: g.gender === "Belirsiz" ? "-" : g.gender,
    c004: a.age !== null ? String(2026 - a.age) : "-",
    c005: cleanCriterionDisplayValue(meta.city),
    c006: districtMatch ? districtMatch[1] : "-",
    c007: /\bevli\b/i.test(lower)
      ? "Evli"
      : /\bbekar\b/i.test(lower)
      ? "Bekar"
      : "-",
    c008: /t\.c\.|türkiye\s*cumhuriyeti|turkish/i.test(lower) ? "T.C." : "-",
    c009: emailMatch ? emailMatch[0] : "-",
    c010: phoneMatch ? phoneMatch[0].trim() : "-",

    // 02. Lisans & Ön Lisans
    c011: bscUni,
    c012: bscDept,
    c013: gradYearMatch ? gradYearMatch[1] : "-",
    c014: gpaMatch ? gpaMatch[1].trim() : "-",
    c015: eduLangMatch ? eduLangMatch[1].trim() : "-",
    c016: assocUni,
    c017: assocDept,
    c018: "-",
    c019: /çift\s*anadal|çap|yandal|minor|double\s*major/i.exec(text)?.[0] || "-",
    c020:
      /[^\n\r,;•]*(?:fen\s*lisesi|anadolu\s*lisesi|koleji|meslek\s*lisesi|high\s*school)[^\n\r,;•]*/i
        .exec(text)?.[0]
        ?.trim() || "-",

    // 03. Yüksek Lisans & Doktora
    c021: masterUni,
    c022: masterDept,
    c023: "-",
    c024: /tezli/i.test(lower)
      ? "Tezli Yüksek Lisans"
      : /tezsiz/i.test(lower)
      ? "Tezsiz Yüksek Lisans"
      : masterUni !== "-"
      ? "Yüksek Lisans (M.Sc. / M.A.)"
      : "-",
    c025: /\bmba\b/i.test(lower) ? "MBA" : "-",
    c026: phdUni,
    c027: phdDept,
    c028: thesisMatch ? thesisMatch[1].trim() : "-",
    c029: /makale|yayın|publication|journal|ieee\s*paper|bildiri/i.exec(text)?.[0] || "-",
    c030: /erasmus|exchange\s*program/i.exec(text)?.[0] || "-",

    // 04. Meslek & Deneyim
    c031: detectProfession(),
    c032:
      meta.experienceYears && meta.experienceYears > 0
        ? `${meta.experienceYears} Yıl`
        : /new\s*grad|yeni\s*mezun/i.test(lower)
        ? "Yeni Mezun"
        : "-",
    c033: /halen|devam\s*ediyor|present|current/i.test(lower)
      ? "Aktif Çalışıyor"
      : /new\s*grad|yeni\s*mezun/i.test(lower)
      ? "Yeni Mezun"
      : "-",
    c034:
      /(?:Huawei|Aselsan|Tusaş|Roketsan|Havelsan|Turkcell|Vodafone|Türk\s*Telekom|Garanti|Akbank|İş\s*Bankası|Yapı\s*Kredi|QNB|Ziraat|Vakıfbank|Halkbank|Koç|Sabancı|Arçelik|Beko|Vestel|Ford\s*Otosan|Tofaş|Mercedes|Bosch|Siemens|THY|Turkish\s*Airlines|Pegasus|Trendyol|Hepsiburada|Getir|Migros|Şişecam|Eczacıbaşı|Ülker|Eti|Deloitte|PwC|EY|KPMG|baykar)[^\n\r,|•]*/i
        .exec(text)?.[0]
        ?.trim() || "-",
    c035: detectProfession(),
    c036:
      (meta.experienceYears || 0) >= 5
        ? "Senior (Kıdemli)"
        : (meta.experienceYears || 0) >= 2
        ? "Mid-Level"
        : "Junior / Yeni Mezun",
    c037: /stajyer|staj|intern|internship/i.test(lower)
      ? "Staj Deneyimi Mevcut"
      : "-",
    c038: /takım\s*lideri|team\s*lead|müdür|manager|direktör|yönetici|şef/i.exec(text)?.[0] || "-",
    c039: /holding|a\.ş\.|r&d\s*center|global|uluslararası/i.exec(text)?.[0] || "-",
    c040: /bakanlığı|belediyesi|müdürlüğü|kurumu|üniversitesi/i.exec(text)?.[0] || "-",
    c041: matchListFromText(text, [
      [/\bagile\b/i, "Agile"],
      [/\bscrum\b/i, "Scrum"],
      [/\bkanban\b/i, "Kanban"],
      [/\bpmp\b/i, "PMP"],
    ]),
    c042: /bütçe|satın\s*alma|ihale|maliyet\s*analiz|procurement/i.exec(text)?.[0] || "-",

    // 05. Yabancı Diller
    c043: englishLevel,
    c044: /almanca|german|deutsch/i.test(lower) ? "Almanca" : "-",
    c045: /fransızca|french/i.test(lower) ? "Fransızca" : "-",
    c046: /ispanyolca|spanish/i.test(lower) ? "İspanyolca" : "-",
    c047: /rusça|russian/i.test(lower) ? "Rusça" : "-",
    c048: /arapça|arabic/i.test(lower) ? "Arapça" : "-",
    c049: /italyanca|çince|japonca|korece|felemenkçe/i.exec(text)?.[0] || "-",
    c050: /(?:toefl|ielts)\s*[:=-]?\s*\d+(?:\.\d+)?/i.exec(text)?.[0] || "-",
    c051: /(?:yds|yökdil)\s*[:=-]?\s*\d+(?:\.\d+)?/i.exec(text)?.[0] || "-",
    c052: allLangs.length > 0 ? allLangs.join(", ") : "-",

    // 06. Yazılım & Programlar
    c053: matchListFromText(text, [
      [/ileri\s*excel|advanced\s*excel/i, "İleri Excel"],
      [/\bexcel\b/i, "Excel"],
      [/\bword\b/i, "Word"],
      [/powerpoint/i, "PowerPoint"],
      [/ms\s*office|microsoft\s*office/i, "MS Office"],
      [/\bvba\b/i, "VBA"],
    ]),
    c054: matchListFromText(text, [
      [/\bsap\b/i, "SAP"],
      [/\berp\b/i, "ERP"],
      [/logo\s*tiger|\blogo\b/i, "Logo"],
      [/netsis/i, "Netsis"],
      [/canias/i, "Canias"],
      [/oracle\s*erp/i, "Oracle ERP"],
    ]),
    c055: matchListFromText(text, [
      [/\bpython\b/i, "Python"],
      [/\bpandas\b/i, "Pandas"],
      [/\bnumpy\b/i, "NumPy"],
      [/\bmatlab\b/i, "MATLAB"],
      [/\bscipy\b|scikit[\s-]*learn/i, "Scikit-Learn"],
    ]),
    c056: matchListFromText(text, [
      [/\bjava\b/i, "Java"],
      [/\bc#\b/i, "C#"],
      [/\.net/i, ".NET"],
      [/\bc\+\+/i, "C++"],
      [/\bspring\s*boot\b/i, "Spring Boot"],
      [/\bgolang\b|\bgo\b/i, "Go"],
    ]),
    c057: matchListFromText(text, [
      [/javascript/i, "JavaScript"],
      [/typescript/i, "TypeScript"],
      [/\breact\b/i, "React"],
      [/next\.js/i, "Next.js"],
      [/\bvue\b/i, "Vue.js"],
      [/\bangular\b/i, "Angular"],
      [/node\.js/i, "Node.js"],
      [/\bhtml\b/i, "HTML/CSS"],
    ]),
    c058: matchListFromText(text, [
      [/mysql/i, "MySQL"],
      [/postgresql|postgres/i, "PostgreSQL"],
      [/mssql|sql\s*server/i, "MS SQL"],
      [/oracle\s*db|pl\/sql/i, "Oracle SQL"],
      [/mongodb/i, "MongoDB"],
      [/dbeaver/i, "DBeaver"],
      [/\bsql\b/i, "SQL"],
    ]),
    c059: matchListFromText(text, [
      [/power\s*bi/i, "Power BI"],
      [/tableau/i, "Tableau"],
      [/spss/i, "SPSS"],
    ]),
    c060: matchListFromText(text, [
      [/autocad/i, "AutoCAD"],
      [/solidworks/i, "SolidWorks"],
      [/catia/i, "CATIA"],
      [/ansys/i, "ANSYS"],
      [/revit/i, "Revit"],
      [/netcad/i, "NetCAD"],
      [/proteus|altium/i, "Altium/Proteus"],
    ]),
    c061: matchListFromText(text, [
      [/pytorch/i, "PyTorch"],
      [/tensorflow/i, "TensorFlow"],
      [/\byolo\b/i, "YOLO"],
      [/faster[\s-]*rcnn/i, "Faster-RCNN"],
      [/roboflow/i, "Roboflow"],
      [/opencv/i, "OpenCV"],
      [/google\s*colab/i, "Google Colab"],
      [/machine\s*learning|makine\s*öğrenmesi/i, "Machine Learning"],
      [/deep\s*learning|derin\s*öğrenme/i, "Deep Learning"],
    ]),
    c062: matchListFromText(text, [
      [/\bdocker\b/i, "Docker"],
      [/kubernetes/i, "Kubernetes"],
      [/\baws\b/i, "AWS"],
      [/\bazure\b/i, "Azure"],
      [/\blinux\b/i, "Linux"],
      [/devops/i, "DevOps"],
      [/postman/i, "Postman"],
      [/mobaxterm/i, "MobaXterm"],
      [/cloud\s*services|huawei\s*cloud/i, "Cloud Services"],
      [/\bgit\b/i, "Git"],
    ]),
    c063: matchListFromText(text, [
      [/figma/i, "Figma"],
      [/photoshop/i, "Photoshop"],
      [/illustrator/i, "Illustrator"],
      [/indesign/i, "InDesign"],
      [/premiere|after\s*effects/i, "Premiere/AE"],
    ]),
    c064: matchListFromText(text, [
      [/salesforce/i, "Salesforce"],
      [/\bjira\b/i, "Jira"],
      [/hubspot/i, "HubSpot"],
      [/trello/i, "Trello"],
    ]),

    // 07. Sertifika & Belgeler
    c065: certCount > 0 ? `${certCount} Adet` : "-",
    c066: matchListFromText(text, [
      [/\bpmp\b/i, "PMP"],
      [/scrum\s*master|psm/i, "Scrum"],
      [/prince2/i, "PRINCE2"],
    ]),
    c067: matchListFromText(text, [
      [/\bsmmm\b/i, "SMMM"],
      [/\bspk\b/i, "SPK Lisansı"],
      [/bağımsız\s*denetim/i, "Bağımsız Denetim"],
    ]),
    c068: /\bisg\b|iş\s*sağlığı\s*ve\s*güvenliği/i.exec(text)?.[0] || "-",
    c069: /iso\s*(?:9001|14001|27001|45001)/i.exec(text)?.[0] || "-",
    c070: /myk\b|mesleki\s*yeterlilik\s*belgesi|ustalık\s*belgesi/i.exec(text)?.[0] || "-",
    c071: matchListFromText(text, [
      [/google\s*ads/i, "Google Ads"],
      [/google\s*analytics/i, "Google Analytics"],
      [/\bseo\b/i, "SEO"],
    ]),
    c072: /bordro|özlük\s*işleri|iş\s*hukuku/i.exec(text)?.[0] || "-",
    c073: /ilk\s*yardım|hijyen\s*belgesi/i.exec(text)?.[0] || "-",
    c074: /dış\s*ticaret|gümrük\s*mevzuat/i.exec(text)?.[0] || "-",

    // 08. Ehliyet, Askerlik & Koşullar
    c075: /askerlik\s*[:=-]?\s*(?:yapıldı|tamamlandı|terhis|bedelli)/i.test(lower)
      ? "Tamamlandı"
      : /\bmuaf\b/i.test(lower)
      ? "Muaf"
      : /\btecilli\b|\btecil\b/i.test(lower)
      ? "Tecilli"
      : "-",
    c076: /\bb\s*sınıfı\b|driving\s*licen[cs]e\s*[:=-]?\s*b\b/i.test(lower)
      ? "B Sınıfı"
      : /ehliyet|sürücü\s*belgesi|driver'?s?\s*licen[cs]e/i.test(lower)
      ? "Sürücü Belgesi Mevcut"
      : "-",
    c077: matchListFromText(text, [
      [/\bsrc\s*[1234]?\b/i, "SRC"],
      [/psikoteknik/i, "Psikoteknik"],
    ]),
    c078: /seyahat\s*engeli\s*yok/i.test(lower) ? "Seyahat Engeli Yok" : "-",
    c079: /vardiya|esnek\s*çalışma/i.exec(text)?.[0] || "-",
    c080: /remote|uzaktan\s*çalışma|hibrit|hybrid/i.exec(text)?.[0] || "-",
    c081: /relocation|taşınma/i.exec(text)?.[0] || "-",
    c082: /ihbar\s*süresi|notice\s*period/i.exec(text)?.[0] || "-",
    c083: /pasaport|schengen|vize/i.exec(text)?.[0] || "-",
    c084: /sigara\s*kullanm\w*/i.exec(text)?.[0] || "-",

    // 09. Sektörel Deneyim
    c085: matchListFromText(text, [
      [/üretim/i, "Üretim"],
      [/fabrika/i, "Fabrika"],
      [/imalat/i, "İmalat"],
      [/kalite\s*kontrol/i, "Kalite Kontrol"],
    ]),
    c086: matchListFromText(text, [
      [/finans/i, "Finans"],
      [/banka/i, "Bankacılık"],
      [/muhasebe/i, "Muhasebe"],
      [/denetim/i, "Denetim"],
    ]),
    c087: matchListFromText(text, [
      [/satış/i, "Satış"],
      [/\bb2b\b/i, "B2B"],
      [/iş\s*geliştirme|business\s*development/i, "İş Geliştirme"],
      [/pazarlama|marketing/i, "Pazarlama"],
    ]),
    c088: matchListFromText(text, [
      [/lojistik|logistics/i, "Lojistik"],
      [/tedarik\s*zinciri|supply\s*chain/i, "Tedarik Zinciri"],
      [/satın\s*alma|procurement/i, "Satınalma"],
    ]),
    c089: matchListFromText(text, [
      [/inşaat/i, "İnşaat"],
      [/şantiye/i, "Şantiye"],
      [/mimar/i, "Mimarlık"],
      [/hakediş/i, "Hakediş"],
    ]),
    c090: matchListFromText(text, [
      [/hastane/i, "Hastane"],
      [/klinik/i, "Klinik"],
      [/medikal/i, "Medikal"],
      [/ilaç/i, "İlaç Sektörü"],
    ]),
    c091: matchListFromText(text, [
      [/hukuk/i, "Hukuk"],
      [/avukat/i, "Avukatlık"],
      [/sözleşme/i, "Sözleşme Yönetimi"],
      [/\bkvkk\b/i, "KVKK"],
    ]),
    c092: matchListFromText(text, [
      [/öğretmen/i, "Öğretmenlik"],
      [/akademisyen|araştırma\s*görevlisi/i, "Akademi"],
      [/eğitmen/i, "Eğitmenlik"],
    ]),

    // 10. Proje, Başarı & Ek Alanlar
    c093: /referans/i.test(lower) ? "Referans Belirtilmiş" : "-",
    c094: socialLinks.length > 0 ? socialLinks.join(", ") : "-",
    c095: matchListFromText(text, [
      [/yüksek\s*onur|high\s*honor/i, "Yüksek Onur Derecesi"],
      [/onur\s*öğrencisi|honor\s*student/i, "Onur Derecesi"],
      [/\bburs\b|scholarship/i, "Burslu"],
      [/birincilik|ödül|award/i, "Ödül / Derece"],
    ]),
    c096: matchListFromText(text, [
      [/\bieee\b/i, "IEEE"],
      [/kulübü|topluluğu|student\s*club/i, "Öğrenci Topluluğu"],
      [/gönüllü|volunteer/i, "Gönüllülük"],
    ]),
    c097: matchListFromText(text, [
      [/tübitak/i, "TÜBİTAK"],
      [/teknofest/i, "TEKNOFEST"],
      [/ar-ge|r&d/i, "Ar-Ge Projesi"],
      [/patent/i, "Patent"],
    ]),
    c098: "-",
    c099: "-",
    c100: /\b(education|experience|skills|projects|summary)\b/i.test(text)
      ? "İngilizce CV"
      : "Türkçe CV",
  };

  return values;
}
