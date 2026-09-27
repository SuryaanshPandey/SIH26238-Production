"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, User, AlertCircle, ShieldCheck } from "lucide-react";
import { LanguageToggle } from "./LanguageToggle";
import { useLanguage } from "../../lib/context/LanguageContext";
import { notificationApi } from "../../lib/api/notification";
import { isAuthenticated } from "../../lib/auth/session";

export function MobileHeader() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const publicPage = pathname === "/" || pathname === "/login" || pathname === "/register";
  const [unreadCount, setUnreadCount] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (publicPage) {
      setAuthenticated(false);
      setUnreadCount(0);
      return () => { mounted = false; };
    }
    const auth = isAuthenticated();
    setAuthenticated(auth);
    if (!auth) return () => { mounted = false; };
    notificationApi.getNotifications().then((notifs) => {
      if (mounted) setUnreadCount(notifs.filter((n) => !n.read).length);
    }).catch(() => { if (mounted) setUnreadCount(0); });
    const timer = window.setInterval(() => {
      notificationApi.getNotifications().then((notifs) => {
        if (mounted) setUnreadCount(notifs.filter((n) => !n.read).length);
      }).catch(() => undefined);
    }, 30000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [publicPage]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* Tricolor Accent Bar */}
      <div className="h-1 w-full flex">
        <div className="h-full w-1/3 bg-[#FF9933]" />
        <div className="h-full w-1/3 bg-white" />
        <div className="h-full w-1/3 bg-[#138808]" />
      </div>

      <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Emblem & Portal Title */}
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-mota-900 flex items-center justify-center text-amber-400 font-bold text-base shadow-sm">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {t("app.title")}
              </span>
              <span className="text-[10px] bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono font-medium">
                MoTA
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-normal leading-tight">
              {t("app.subtitle")}
            </p>
          </div>
        </Link>

        {/* Right side controls: Language toggle, Notifications, Profile avatar */}
        <div className="flex items-center gap-2">
          <LanguageToggle />

          {authenticated ? (
            <>
              <Link href="/notifications" className="relative p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors" aria-label="Notifications">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-white bg-red-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/profile" className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200" aria-label="Student Profile">
                <User className="w-4 h-4" />
              </Link>
            </>
          ) : (
            <Link href="/login" className="text-xs font-bold text-mota-700 border border-mota-200 rounded-lg px-2.5 py-1.5">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
