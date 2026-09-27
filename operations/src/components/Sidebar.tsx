"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Users,
  CreditCard,
  Lightbulb,
  Bot,
  History,
  ShieldAlert,
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/scholarships", label: "Scholarship Master", icon: GraduationCap },
    { href: "/applications", label: "Applications", icon: FileText },
    { href: "/eligibility", label: "Eligibility Engine", icon: CheckCircle2 },
    { href: "/deficiencies", label: "Deficiencies", icon: AlertTriangle },
    { href: "/reviews", label: "Review Queue", icon: Users },
    { href: "/payments", label: "Sanction & Payments", icon: CreditCard },
    { href: "/beneficiaries", label: "Beneficiary Intelligence", icon: Lightbulb },
    { href: "/jago-console", label: "JAGO AI Console", icon: Bot },
    { href: "/audit", label: "Audit Timeline", icon: History },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">SIH26238 • RIJVAN</div>
        <div className="sidebar-subtitle">Scholarship Operations & Intelligence</div>
        <div style={{ marginTop: "8px", display: "inline-block", background: "rgba(217, 119, 6, 0.2)", color: "#fbbf24", padding: "2px 6px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: "600" }}>
          MINISTRY OF TRIBAL AFFAIRS
        </div>
      </div>

      <ul className="nav-links">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <li key={item.href} className={`nav-item ${isActive ? "active" : ""}`}>
              <Link href={item.href}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div style={{ padding: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.1)", fontSize: "0.75rem", color: "#94a3b8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <ShieldAlert size={14} color="#38bdf8" />
          <span>Common Contract: <strong>v1</strong></span>
        </div>
        <div style={{ marginTop: "4px" }}>Status: <strong>Integration Ready</strong></div>
      </div>
    </aside>
  );
};
