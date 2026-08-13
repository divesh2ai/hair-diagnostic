import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Fraunces,
  Noto_Sans_Devanagari,
  Plus_Jakarta_Sans,
  Inter,
} from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { AssistantCompanionProvider } from "@/components/assistant/AssistantCompanion";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial display serif for the immersive patient-education narrative.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Devanagari coverage for the Hindi patient assessment. None of the fonts above
// ship Devanagari glyphs, so without this the browser silently falls back to a
// system face (Nirmala UI / Noto) with different metrics and inconsistent
// matra rendering. Appended *after* the Latin faces in every stack (see
// globals.css) so Latin text keeps its existing typography and only Devanagari
// codepoints fall through to this face.
const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HairOS — AI Hair & Scalp Healthcare",
  description: "Clinical assessment, AI orchestration, and personalized recovery reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${jakarta.variable} ${inter.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AssistantCompanionProvider>
          {children}
          <Toaster />
        </AssistantCompanionProvider>
      </body>
    </html>
  );
}
