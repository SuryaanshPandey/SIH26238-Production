import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "../components/layout/QueryProvider";
import { LanguageProvider } from "../lib/context/LanguageContext";
import { MobileHeader } from "../components/layout/MobileHeader";
import { MobileBottomNav } from "../components/layout/MobileBottomNav";
import { JagoLauncher } from "../components/jago/JagoLauncher";

export const metadata: Metadata = {
  title: "SIH26238 | Unified Scholarship App",
  description:
    "SIH26238 unified scholarship application for tribal students",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 sm:py-4 flex justify-center items-start">
        <LanguageProvider>
          <QueryProvider>
            {/* Mobile shell container */}
            <div className="w-full max-w-md min-h-screen sm:min-h-[850px] sm:max-h-[920px] bg-slate-50 flex flex-col shadow-2xl sm:rounded-[36px] sm:border-4 sm:border-slate-800 overflow-hidden relative pb-16">
              <MobileHeader />
              <main className="flex-1 overflow-y-auto">{children}</main>
              <JagoLauncher />
              <MobileBottomNav />
            </div>
          </QueryProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
