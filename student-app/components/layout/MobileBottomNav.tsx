"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, FileText, FolderLock, Bot, AlertTriangle } from "lucide-react";
import { useLanguage } from "../../lib/context/LanguageContext";
import { applicationApi } from "../../lib/api/application";
import { isAuthenticated } from "../../lib/auth/session";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [openDeficiencyCount, setOpenDeficiencyCount] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);

  const publicPage = pathname === "/" || pathname === "/login" || pathname === "/register";

  useEffect(() => {
    let mounted = true;
    if (publicPage) {
      setAuthenticated(false);
      setOpenDeficiencyCount(0);
      return () => { mounted = false; };
    }
    const auth = isAuthenticated();
    setAuthenticated(auth);
    if (!auth) return () => { mounted = false; };
    applicationApi.getDeficiencies().then((defs) => {
      if (mounted) setOpenDeficiencyCount(defs.filter((d) => d.current_status === "OPEN").length);
    }).catch(() => { if (mounted) setOpenDeficiencyCount(0); });
    return () => { mounted = false; };
  }, [publicPage]);

  // Hide nav on login and register pages
  if (!authenticated || pathname === "/login" || pathname === "/register" || pathname === "/") {
    return null;
  }

  const navItems = [
    {
      href: "/dashboard",
      icon: Home,
      label: t("nav.home"),
      badge: 0,
    },
    {
      href: "/scholarships",
      icon: Compass,
      label: t("nav.scholarships"),
      badge: 0,
    },
    {
      href: "/applications",
      icon: FileText,
      label: t("nav.applications"),
      badge: openDeficiencyCount, // Show badge on applications if action required
    },
    {
      href: "/documents",
      icon: FolderLock,
      label: t("nav.wallet"),
      badge: 0,
    },
    {
      href: "/jago",
      icon: Bot,
      label: t("nav.jago"),
      badge: 0,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200">
      <div className="max-w-md mx-auto px-2 py-1.5 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
                isActive
                  ? "text-mota-700 font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? "scale-110 text-mota-700" : ""
                  }`}
                />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white animate-pulse">
                    !
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-mota-700 mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
