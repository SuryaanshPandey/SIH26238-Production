import type {
  Metadata,
  Viewport,
} from "next";

import "./globals.css";

import {
  QueryProvider,
} from "../components/layout/QueryProvider";

import {
  LanguageProvider,
} from "../lib/context/LanguageContext";

import {
  MobileHeader,
} from "../components/layout/MobileHeader";

import {
  MobileBottomNav,
} from "../components/layout/MobileBottomNav";

import {
  JagoLauncher,
} from "../components/jago/JagoLauncher";

import {
  PullToRefresh,
} from "../components/layout/PullToRefresh";

export const metadata: Metadata =
  {
    title:
      "SIH26238 | Unified Scholarship App",

    description:
      "SIH26238 unified scholarship application for tribal students",
  };

export const viewport: Viewport =
  {
    width:
      "device-width",

    initialScale: 1,

    maximumScale: 1,

    userScalable: false,

    viewportFit:
      "cover",

    themeColor:
      "#f8fafc",
  };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-[100dvh] w-full overflow-hidden bg-slate-50 sm:bg-slate-100 flex justify-center">
        <LanguageProvider>
          <QueryProvider>
            <div className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-slate-50 sm:h-auto sm:min-h-[850px] sm:max-h-[920px] sm:rounded-[28px] sm:border sm:border-slate-200 sm:shadow-xl">
              <MobileHeader />

              <PullToRefresh className="flex-1">
                <main className="min-h-full pb-16">
                  {children}
                </main>
              </PullToRefresh>

              <JagoLauncher />

              <MobileBottomNav />
            </div>
          </QueryProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
