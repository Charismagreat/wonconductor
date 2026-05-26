import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CEO DASHBOARD : 마이 스마트 데이터 베이스",
  description: "나만의 스마트한 데이터베이스 솔루션, CEO DASHBOARD",
};

export const viewport = {
  // [데스크톱 전용 강제 전환] 모바일 반응형 감지를 원천 차단하고 PC 규격의 시원한 1280px 가로폭으로 사이트 전체를 고정합니다.
  width: 1280,
  initialScale: 0.35, // 모바일 기기 접속 시 컴퓨터용 고해상도 화면 전체가 시원하게 한눈에 들어오도록 기본 축소 배율 적용
  minimumScale: 0.1,
  maximumScale: 5.0,  // 터치 기반 줌인/줌아웃(Pinch to Zoom)을 완전히 허용하여 상세 데이터를 자유롭게 볼 수 있게 튜닝
  userScalable: true,
};

import { SystemConfigService } from "@/lib/services/system-config-service";
import { BrandingProvider } from "@/components/providers/BrandingProvider";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await SystemConfigService.getSettings();

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased transition-colors duration-300`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <BrandingProvider settings={settings}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
