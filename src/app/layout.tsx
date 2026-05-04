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
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
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
