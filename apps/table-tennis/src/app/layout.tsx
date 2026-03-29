import type { Metadata } from "next";
import Image from "next/image";
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
  title: "Toyota Table Tennis Notes",
  description: "卓球部の出席・管理アプリ",
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
            <Image src="/table-tennis-logo.svg" alt="卓球部ロゴ" width={28} height={28} className="globalBrandLogo" priority />
            TOYOTA_KOSEN TABLE TENNIS NOTES
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

