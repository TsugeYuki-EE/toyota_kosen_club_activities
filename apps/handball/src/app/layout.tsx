import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { NavigationLoadingOverlay } from "@/components/navigation-loading-overlay";
import { SiteCredit } from "@/components/site-credit";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Toyota Handball Notes",
  description: "ハンドボール部の出席・体重・試合スコア管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Suspense fallback={null}>
          <NavigationLoadingOverlay />
        </Suspense>
        <header className="globalBrand" aria-label="共通ヘッダー">
          <Link href="/" className="globalBrandTitle" aria-label="メインページへ戻る">
            TOYOTA_KOSEN HANDBALL NOTES
          </Link>
          <Link href="/help" className="globalReleaseLink">
            ヘルプ
          </Link>
        </header>
        <div className="appContent">{children}</div>
        <footer className="globalFooter" aria-label="クレジット表記">
          <SiteCredit />
        </footer>
      </body>
    </html>
  );
}
