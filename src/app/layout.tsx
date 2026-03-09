import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MultiCoin Mining Pool - KAS, RVN, ZEPH, ALPH",
  description: "Professional multi-cryptocurrency mining pool supporting Kaspa, Ravencoin, Zephyr Protocol, and Alephium with real-time statistics and transparent payouts.",
  keywords: ["mining pool", "cryptocurrency", "Kaspa", "KAS", "Ravencoin", "RVN", "Zephyr", "ZEPH", "Alephium", "ALPH", "kHeavyHash", "KawPoW", "RandomX", "Blake3"],
  authors: [{ name: "MultiCoin Pool Team" }],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
