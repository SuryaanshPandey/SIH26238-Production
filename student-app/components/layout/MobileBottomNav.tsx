"use client";

import React, {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  Home,
  Compass,
  FileText,
  FolderLock,
  Bot,
} from "lucide-react";

import {
  useLanguage,
} from "../../lib/context/LanguageContext";

import {
  applicationApi,
} from "../../lib/api/application";

import {
  isAuthenticated,
} from "../../lib/auth/session";

export function MobileBottomNav() {
  const pathname =
    usePathname();

  const { t } =
    useLanguage();

  const [
    openDeficiencyCount,
    setOpenDeficiencyCount,
  ] = useState(0);

  const [
    authenticated,
    setAuthenticated,
  ] = useState(false);

  const publicPage =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register";

  useEffect(() => {
    let mounted = true;

    if (
      publicPage
    ) {
      setAuthenticated(
        false,
      );

      setOpenDeficiencyCount(
        0,
      );

      return () => {
        mounted = false;
      };
    }

    const auth =
      isAuthenticated();

    setAuthenticated(
      auth,
    );

    if (!auth) {
      return () => {
        mounted = false;
      };
    }

    /*
     * This badge is non-critical.
     * Failure must never disturb the current screen.
     */
    applicationApi
      .getDeficiencies()
      .then(
        (
          deficiencies,
        ) => {
          if (!mounted) {
            return;
          }

          setOpenDeficiencyCount(
            deficiencies.filter(
              (
                deficiency,
              ) =>
                deficiency.current_status ===
                "OPEN",
            ).length,
          );
        },
      )
      .catch(() => {
        if (!mounted) {
          return;
        }

        setOpenDeficiencyCount(
          0,
        );
      });

    return () => {
      mounted = false;
    };
  }, [
    publicPage,
  ]);

  if (
    !authenticated ||
    publicPage
  ) {
    return null;
  }

  const navItems = [
    {
      href: "/dashboard",
      icon: Home,
      label: t(
        "nav.home",
      ),
      badge: 0,
    },
    {
      href: "/scholarships",
      icon: Compass,
      label: t(
        "nav.scholarships",
      ),
      badge: 0,
    },
    {
      href: "/applications",
      icon: FileText,
      label: t(
        "nav.applications",
      ),
      badge:
        openDeficiencyCount,
    },
    {
      href: "/documents",
      icon: FolderLock,
      label: t(
        "nav.wallet",
      ),
      badge: 0,
    },
    {
      href: "/jago",
      icon: Bot,
      label: t(
        "nav.jago",
      ),
      badge: 0,
    },
  ];

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-md items-center justify-around px-2 py-1.5">
        {navItems.map(
          (
            item,
          ) => {
            const isActive =
              pathname ===
                item.href ||
              (
                item.href !==
                  "/dashboard" &&
                pathname.startsWith(
                  item.href,
                )
              );

            const Icon =
              item.icon;

            return (
              <Link
                key={
                  item.href
                }
                href={
                  item.href
                }
                className={`relative flex flex-col items-center justify-center rounded-xl px-2.5 py-1 transition-all ${
                  isActive
                    ? "font-semibold text-mota-700"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`h-5 w-5 transition-transform ${
                      isActive
                        ? "scale-110 text-mota-700"
                        : ""
                    }`}
                  />

                  {item.badge >
                    0 && (
                    <span className="absolute -right-2 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">
                      !
                    </span>
                  )}
                </div>

                <span className="mt-0.5 text-[11px] tracking-tight">
                  {
                    item.label
                  }
                </span>

                {isActive && (
                  <div className="mt-0.5 h-1 w-1 rounded-full bg-mota-700" />
                )}
              </Link>
            );
          },
        )}
      </div>
    </nav>
  );
}
