import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KADRO // AI — Kurumsal CV İstihbarat, Cinsiyet/Yaş Doğrulama ve Öğrenen Eşleştirme Sistemi",
  description:
    "Şirket bazlı özelleştirilebilir, 5 katmanlı cinsiyet/yaş doğrulama ve derin teknik yetkinlik (C++, Java vb.) analizi yapan öğrenen İK platformu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased selection:bg-zinc-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
