"use client";

import React, {
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Bell,
  User,
  ShieldCheck,
} from "lucide-react";

import { LanguageToggle } from "./LanguageToggle";
import { useLanguage } from "../../lib/context/LanguageContext";
import { notificationApi } from "../../lib/api/notification";
import { isAuthenticated } from "../../lib/auth/session";

const NOTIFICATION_POLL_INTERVAL_MS =
  60_000;

const INITIAL_NOTIFICATION_DELAY_MS =
  4_000;

export function MobileHeader() {
  const { t } =
    useLanguage();

  const pathname =
    usePathname();

  const publicPage =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register";

  /*
   * Notifications are useful on the Dashboard and on the
   * Notifications page itself.
   *
   * They are deliberately NOT polled while the user is in
   * Documents, Applications, Profile, etc.
   *
   * This prevents a sleeping Operations service from being
   * repeatedly awakened by an optional background badge
   * while the user is performing another task such as uploading
   * documents.
   */
  const notificationPage =
    pathname === "/notifications";

  const dashboardPage =
    pathname === "/dashboard";

  const shouldPollNotifications =
    !publicPage &&
    (notificationPage ||
      dashboardPage);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    authenticated,
    setAuthenticated,
  ] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (publicPage) {
      setAuthenticated(false);
      setUnreadCount(0);

      return () => {
        mounted = false;
      };
    }

    const auth =
      isAuthenticated();

    setAuthenticated(auth);

    /*
     * Don't perform any Operations API request unless the
     * current page actually needs notifications.
     */
    if (
      !auth ||
      !shouldPollNotifications
    ) {
      setUnreadCount(0);

      return () => {
        mounted = false;
      };
    }

    /*
     * First request is intentionally delayed slightly.
     *
     * Login/dashboard requests get a chance to finish first,
     * so notification polling doesn't race the main application
     * startup.
     */
    let timer:
      | number
      | null = window.setTimeout(
          async () => {
            if (!mounted) return;

            try {
              const notifs =
                await notificationApi.getNotifications();

              if (!mounted) return;

              setUnreadCount(
                notifs.filter(
                  (notification) =>
                    !notification.read,
                ).length,
              );
            } catch {
              /*
               * Notifications are non-critical.
               *
               * Never display a backend/cold-start failure
               * as an application error.
               */
              if (mounted) {
                setUnreadCount(0);
              }
            }
          },
          INITIAL_NOTIFICATION_DELAY_MS,
        );

    /*
     * Poll only while the user is actually on Dashboard or
     * Notifications.
     */
    const interval =
      window.setInterval(
        async () => {
          if (!mounted) return;

          try {
            const notifs =
              await notificationApi.getNotifications();

            if (!mounted) return;

            setUnreadCount(
              notifs.filter(
                (notification) =>
                  !notification.read,
              ).length,
            );
          } catch {
            /*
             * Silent failure is intentional.
             *
             * A sleeping optional Operations service should
             * never disturb the rest of the application.
             */
          }
        },
        NOTIFICATION_POLL_INTERVAL_MS,
      );

    return () => {
      mounted = false;

      if (timer !== null) {
        window.clearTimeout(
          timer,
        );
      }

      window.clearInterval(
        interval,
      );
    };
  }, [
    publicPage,
    shouldPollNotifications,
  ]);

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
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5"
        >
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

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <LanguageToggle />

          {authenticated ? (
            <>
              <Link
                href="/notifications"
                className="relative p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />

                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-white bg-red-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Link>

              <Link
                href="/profile"
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                aria-label="Student Profile"
              >
                <User className="w-4 h-4" />
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="text-xs font-bold text-mota-700 border border-mota-200 rounded-lg px-2.5 py-1.5"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
