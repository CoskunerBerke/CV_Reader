import type { Metadata } from "next";
import {
  Source_Serif_4,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title:
    "CV Reader AI — Academic & Corporate Curriculum Vitae Parsing System",
  description:
    "Structured academic degree (Associate, Bachelor's, Master's, Ph.D.), chronological age, and demographic extraction with instant Excel (.xlsx) reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${sourceSerif.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased selection:bg-[#1e3a8a] selection:text-white">
        {children}
      </body>
    </html>
  );
}
