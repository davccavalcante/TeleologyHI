import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-app-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-app-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TeleologyHI Arena — raw vs governed",
  description:
    "A/B comparison playground: a raw Gemini response vs the same model under TeleologyHI governance (MAIC + HIM + NHE, EU lawful profile).",
  applicationName: "TeleologyHI Arena",
  authors: [{ name: "David C. Cavalcante" }],
  creator: "David C. Cavalcante",
  publisher: "TeleologyHI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
