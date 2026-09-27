import React from "react";
import "@/styles/globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export const metadata = {
  title: "SIH26238 - Rijvan Module | Scholarship Operations & Intelligence",
  description: "Unified Scholarship Mobile Application for Tribal Students - Ministry of Tribal Affairs (SIH 2026)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <Sidebar />
          <div className="main-content">
            <Topbar />
            <main className="page-body">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
