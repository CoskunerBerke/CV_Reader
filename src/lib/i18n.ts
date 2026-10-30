export type AppLang = "tr" | "en";

export const LANG_STORAGE_KEY = "cv_app_lang";

export function translateGender(
  gender: string | null | undefined,
  lang: AppLang
): string {
  if (!gender) return lang === "en" ? "Unspecified" : "Belirsiz";
  if (lang === "tr") return gender;
  const g = gender.trim();
  if (g === "Kadın") return "Female";
  if (g === "Erkek") return "Male";
  if (g === "Belirsiz") return "Unspecified";
  if (g === "Farketmez") return "Any";
  return g;
}

export function translateAgeMethod(
  method: string | null | undefined,
  lang: AppLang
): string {
  if (!method) return lang === "en" ? "Unspecified" : "Bilinmiyor";
  if (lang === "tr") return method;
  const m = method.trim();
  if (m === "Doğrudan Yaş Beyanı") return "Explicit Age Statement";
  if (m === "Doğum Tarihi Hesabı") return "Date of Birth Calculation";
  if (m === "Eğitim Kronolojisi Tahmini") return "Academic Chronology Estimation";
  if (m === "İlk İş Deneyimi Tahmini") return "Career Start Estimation";
  if (m === "Bilinmiyor") return "Unspecified";
  if (m === "Yaş & Üni Tarihi Yok") return "No Age or Edu Date";
  return m;
}

export function translateAgeEvidence(
  evidence: string | null | undefined,
  lang: AppLang
): string {
  if (!evidence) return "";
  if (lang === "tr") return evidence;

  let s = evidence;

  s = s.replace(
    /Doğum tarihi yazmıyor;\s*(\d{4})\s*üniversite giriş yılı üzerinden\s*\((\d{4})\s*yılı bazlı\)\s*~?(\d+)\s*yaş hesaplandı\.?/gi,
    "Date of birth not stated; estimated ~$3 years old based on $1 university entry year ($2 reference)."
  );
  s = s.replace(
    /Doğum tarihi yazmıyor;\s*(\d{4})\s*üniversite mezuniyet yılı üzerinden\s*\((\d{4})\s*yılı bazlı\)\s*~?(\d+)\s*yaş hesaplandı\.?/gi,
    "Date of birth not stated; estimated ~$3 years old based on $1 university graduation year ($2 reference)."
  );
  s = s.replace(
    /Doğum tarihi yazmıyor;\s*(\d{4})\s*lise başlangıç yılı üzerinden\s*\((\d{4})\s*yılı bazlı\)\s*~?(\d+)\s*yaş hesaplandı\.?/gi,
    "Date of birth not stated; estimated ~$3 years old based on $1 high school entry year ($2 reference)."
  );
  s = s.replace(
    /Doğum tarihi yazmıyor;\s*(\d{4})\s*eğitim başlangıç yılı üzerinden\s*\((\d{4})\s*yılı bazlı\)\s*~?(\d+)\s*yaş hesaplandı\.?/gi,
    "Date of birth not stated; estimated ~$3 years old based on $1 education start year ($2 reference)."
  );
  s = s.replace(
    /CV kişisel bilgilerinde doğum tarihi\s*\(([^)]+)\)\s*tespit edildi\s*→\s*(\d+)\s*yaşında\.?/gi,
    "Date of birth ($1) detected in CV personal details → $2 years old."
  );
  s = s.replace(
    /CV'de doğum tarihi\s*\(([^)]+)\)\s*tespit edildi\s*→\s*(\d+)\s*yaşında\.?/gi,
    "Date of birth ($1) detected in CV → $2 years old."
  );
  s = s.replace(
    /CV'de doğum yılı\s*\((\d{4})\)\s*tespit edildi\s*→\s*(\d+)\s*yaşında\.?/gi,
    "Birth year ($1) detected in CV → $2 years old."
  );
  s = s.replace(
    /CV metninde doğrudan yaş ifadesi tespit edildi\s*\(([^)]+)\)\s*→\s*(\d+)\s*yaşında\.?/gi,
    "Explicit age statement ($1) detected in CV text → $2 years old."
  );
  s = s.replace(
    /CV metninde doğrudan yaş ifadesi tespit edildi\s*→\s*(\d+)\s*yaşında\.?/gi,
    "Explicit age statement detected in CV text → $1 years old."
  );
  s = s.replace(
    /Kullanıcı tarafından\s*'(\d+)\s*yaş'\s*olarak etiketlendi ve öğrenildi\.?/gi,
    "Verified and learned as '$1 years old' from user ground-truth label."
  );
  s = s.replace(
    /CV'de ne doğum tarihi ne de üniversite\/eğitim başlangıç yılı yer alıyor\s*\(Yaş & Üni Tarihi Yok\)\.?/gi,
    "Neither date of birth nor university/education start year is stated in the CV (No Age / Edu Date)."
  );
  s = s.replace(
    /CV'de açık doğum tarihi veya eğitim yılı bulunamadı\.?/gi,
    "No explicit date of birth or education year found in the CV."
  );
  s = s.replace(
    /İlk iş deneyimi başlangıç yılı\s*\((\d{4})\)\s*üzerinden\s*~?(\d+)\s*yaş tahmin edildi\.?/gi,
    "Estimated ~$2 years old based on first work experience start year ($1)."
  );

  // Additional fallback replacements
  s = s
    .replace(/Doğum tarihi yazmıyor;/g, "Date of birth not stated;")
    .replace(/üniversite giriş yılı üzerinden/g, "based on university entry year")
    .replace(/üniversite mezuniyet yılı üzerinden/g, "based on university graduation year")
    .replace(/yılı bazlı/g, "reference year")
    .replace(/yaş hesaplandı/g, "years old calculated")
    .replace(/yaşında/g, "years old");

  return s;
}

export function translateGenderSignal(
  signal: string | null | undefined,
  lang: AppLang
): string {
  if (!signal) return "";
  const cleaned = signal.replace(/%\d+(\.\d+)?\s*/g, "").trim();
  if (lang === "tr") return cleaned;

  let s = cleaned;
  s = s.replace(
    /'([^']+)'\s*isim veritabanında\s*Kadın\s*ismidir/gi,
    "'$1' is classified as a Female first name in the onomastic database"
  );
  s = s.replace(
    /'([^']+)'\s*isim veritabanında\s*Erkek\s*ismidir/gi,
    "'$1' is classified as a Male first name in the onomastic database"
  );
  s = s.replace(
    /Kullanıcı tarafından\s*'Kadın'\s*olarak doğrulandı ve öğrenildi/gi,
    "Verified and learned as 'Female' via user ground-truth label"
  );
  s = s.replace(
    /Kullanıcı tarafından\s*'Erkek'\s*olarak doğrulandı ve öğrenildi/gi,
    "Verified and learned as 'Male' via user ground-truth label"
  );
  s = s.replace(
    /Askerlik durumu ifadesi\s*\(([^)]+)\)\s*tespit edildi/gi,
    "Military service status ($1) detected in CV"
  );
  s = s.replace(
    /Askerlik durumu ifadesi tespit edildi/gi,
    "Military service status statement detected in CV"
  );
  s = s.replace(
    /CV'de doğrudan cinsiyet beyanı\s*\(([^)]+)\)\s*tespit edildi/gi,
    "Explicit gender declaration ($1) detected in CV"
  );
  s = s.replace(
    /CV'de doğrudan cinsiyet beyanı tespit edildi/gi,
    "Explicit gender declaration detected in CV"
  );
  s = s.replace(
    /İsim veritabanında kesin eşleşme bulunamadı/gi,
    "No definitive match found in given name database"
  );
  return s;
}

export function translateEduField(
  val: string | null | undefined,
  lang: AppLang
): string {
  if (!val) return lang === "en" ? "Not Specified" : "Belirtilmemiş";
  if (lang === "tr") return val;

  let s = val.trim();
  if (s === "Belirtilmemiş" || s === "Bilinmiyor") return "Not Specified";

  s = s
    .replace(/Ön Lisans \(Associate\)/g, "Associate Degree")
    .replace(/Lisans \(Bachelor's\)/g, "Bachelor's Degree")
    .replace(/Yüksek Lisans \(Master's\)/g, "Master's Degree")
    .replace(/Doktora \(Ph\.D\.\)/g, "Ph.D. / Doctorate")
    .replace(/\bÖn Lisans\s*:/g, "Associate:")
    .replace(/\bLisans\s*:/g, "Bachelor's:")
    .replace(/\bYüksek Lisans\s*:/g, "Master's:")
    .replace(/\bDoktora\s*:/g, "Ph.D.:")
    .replace(/\bBelirtilmemiş\b/g, "Not Specified");

  return s;
}

export function translateSkillLevel(level: string, lang: AppLang): string {
  if (lang === "tr") return level;
  if (level === "Uzman / Proje Kanıtlı") return "Advanced / Project-Verified";
  if (level === "Orta / CV'de Geçiyor") return "Intermediate / Mentioned in CV";
  if (level === "Deneyim Bulunamadı") return "Not Mentioned";
  return level;
}

export function translateParseStatus(status: string, lang: AppLang): string {
  if (!status || lang === "tr") return status;

  let s = status;
  s = s.replace(
    /^"([^"]+)" arşivi tarayıcıda açılıyor\.\.\.$/,
    'Extracting archive "$1" in browser...'
  );
  s = s.replace(
    /^⚠️ Dosya algılanamadı\..*$/,
    "⚠️ No file detected. If dragging from inside a WinRAR/ZIP window, please drag the .zip archive itself or extract the folder first."
  );
  s = s.replace(/^Dosyalar hazırlanıyor\.\.\.$/, "Preparing files...");
  s = s.replace(
    /^⚠️ Desteklenen bir CV dosyası.*bulunamadı\.$/,
    "⚠️ No supported CV files (.pdf, .docx, .html, .zip, .rar, .txt) found."
  );
  s = s.replace(
    /^Analiz ediliyor:\s*(\d+)\s*\/\s*(\d+)\s*dosya işlendi\.\.\.$/,
    "Analyzing: $1 / $2 files processed..."
  );
  s = s.replace(
    /^Analiz ediliyor:\s*(\d+)\s*\/\s*(\d+)\s*dosya\s*\((\d+)\s*CV eklendi\)\.\.\.$/,
    "Analyzing: $1 / $2 files ($3 CVs added)..."
  );
  s = s.replace(
    /^✓\s*"([^"]+)"\s*okundu\.\s*"Analiz Et ve Ekle"\s*butonuna basabilirsiniz\.$/,
    '✓ "$1" parsed. Click "Analyze & Add" to continue.'
  );
  s = s.replace(
    /^✓\s*Toplam\s*(\d+)\s*adet CV başarıyla yüklendi ve analiz edildi\.$/,
    "✓ A total of $1 CVs were successfully uploaded and parsed."
  );
  s = s.replace(
    /^⚠️ Seçilen dosyalardan CV metni çıkarılamadı\.$/,
    "⚠️ Could not extract CV text from the selected files."
  );
  s = s.replace(
    /^Dosya okunurken bir hata oluştu\.$/,
    "An error occurred while reading the file."
  );
  return s;
}
