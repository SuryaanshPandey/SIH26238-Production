"use client";

import React, {
  Suspense,
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/Card";

import {
  Input,
} from "../../components/ui/Input";

import {
  Button,
} from "../../components/ui/Button";

import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Wifi,
  ServerCog,
} from "lucide-react";

import {
  authApi,
} from "../../lib/api/auth";

import {
  clearSession,
} from "../../lib/auth/session";

type LoginPhase =
  | "idle"
  | "connecting"
  | "verifying"
  | "success"
  | "error";

function getPhaseFromStatus(
  message: string,
): LoginPhase {
  const value =
    message.toLowerCase();

  if (
    value.includes(
      "successful",
    ) ||
    value.includes(
      "dashboard",
    )
  ) {
    return "success";
  }

  if (
    value.includes(
      "verifying",
    ) ||
    value.includes(
      "completing",
    )
  ) {
    return "verifying";
  }

  return "connecting";
}

function LoginContent() {
  const searchParams =
    useSearchParams();

  const sessionExpired =
    searchParams.get(
      "reason",
    ) === "session_expired";

  const [identifier, setIdentifier] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [statusMessage, setStatusMessage] =
    useState("");

  const [phase, setPhase] =
    useState<LoginPhase>(
      "idle",
    );

  useEffect(() => {
    /*
     * Clear a previous session only when the login page is first mounted.
     *
     * This must NOT run after successful authentication because the dashboard
     * navigation depends on the session created by authApi.login().
     */
    clearSession();
  }, []);

  const setStatus = (
    message: string,
  ) => {
    setStatusMessage(
      message,
    );

    setPhase(
      getPhaseFromStatus(
        message,
      ),
    );
  };

  const fillDemoAccount = () => {
    setIdentifier(
      "9000000001",
    );

    setPassword(
      "LocalTest@2026!",
    );

    setError("");

    setStatusMessage(
      "Demo account loaded. Ready to sign in.",
    );

    setPhase(
      "idle",
    );
  };

  const handleSubmit =
    async (
      event: React.FormEvent,
    ) => {
      event.preventDefault();

      if (
        isLoading
      ) {
        return;
      }

      setError("");
      setStatusMessage("");

      const cleanIdentifier =
        identifier.trim();

      if (
        !cleanIdentifier
      ) {
        setError(
          "Enter your mobile number, Student ID, or email.",
        );

        setPhase(
          "error",
        );

        return;
      }

      if (
        password.length <
        8
      ) {
        setError(
          "Password must be at least 8 characters long.",
        );

        setPhase(
          "error",
        );

        return;
      }

      setIsLoading(
        true,
      );

      setPhase(
        "connecting",
      );

      setStatusMessage(
        "Connecting to the secure scholarship service…",
      );

      try {
        /*
         * Real production authentication.
         *
         * authApi.login() stores:
         * - access token
         * - student ID
         * - session cookie
         */
        await authApi.login(
          cleanIdentifier,
          password,
          {
            onStatus:
              setStatus,
          },
        );

        /*
         * Authentication is now definitely successful.
         *
         * Do NOT use router.replace() here.
         *
         * In the Android WebView, Next.js client-side navigation can remain
         * on the current document when middleware/server navigation is
         * involved. A real navigation guarantees that the newly-created
         * sih26238_session cookie is sent to Next.js middleware.
         */
        setPhase(
          "success",
        );

        setStatusMessage(
          "Login successful. Opening your scholarship dashboard…",
        );

        /*
         * Give the success state enough time to render visibly, then perform
         * a full document navigation.
         */
        await new Promise<void>(
          (resolve) =>
            window.setTimeout(
              resolve,
              500,
            ),
        );

        /*
         * Use an absolute same-origin path. This keeps the user inside the
         * hosted Student App while forcing a complete request.
         */
        window.location.replace(
          "/dashboard",
        );

      } catch (
        err
      ) {
        setPhase(
          "error",
        );

        setStatusMessage(
          "",
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to sign in right now. Please try again.",
        );

      } finally {
        /*
         * Normally the page navigates after successful login.
         * Setting this to false here keeps the UI consistent if navigation
         * is delayed or interrupted.
         */
        setIsLoading(
          false,
        );
      }
    };

  const phaseTitle =
    phase === "connecting"
      ? "Connecting securely"
      : phase === "verifying"
        ? "Verifying your account"
        : phase === "success"
          ? "You're signed in"
          : phase === "error"
            ? "Sign-in needs attention"
            : "Ready to sign in";

  return (
    <div className="p-5 max-w-sm mx-auto flex flex-col justify-center min-h-[calc(100vh-140px)]">

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Home
      </Link>

      <Card className="border-slate-200/90 shadow-md overflow-hidden">

        <CardHeader className="text-center">

          <div
            className={[
              "relative w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm transition-all duration-500",
              phase ===
              "success"
                ? "bg-emerald-50 text-emerald-600 scale-105"
                : phase ===
                    "error"
                  ? "bg-red-50 text-red-600"
                  : "bg-mota-900 text-amber-400",
            ].join(" ")}
          >
            {phase ===
            "success" ? (
              <CheckCircle2 className="w-8 h-8 animate-in zoom-in duration-300" />
            ) : phase ===
              "error" ? (
              <AlertCircle className="w-8 h-8" />
            ) : isLoading ? (
              <>
                <div className="absolute inset-0 rounded-2xl border-2 border-current/20 animate-ping" />
                <LoaderCircle className="w-8 h-8 animate-spin" />
              </>
            ) : (
              <ShieldCheck className="w-8 h-8" />
            )}
          </div>

          <CardTitle className="text-lg">
            Student Login
          </CardTitle>

          <CardDescription>
            Sign in to your real student account.
          </CardDescription>

        </CardHeader>

        <CardContent>

          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3">

            <div className="flex items-center justify-between gap-2 mb-1">

              <div className="text-xs font-bold text-blue-900">
                Demo Testing Account
              </div>

              <button
                type="button"
                onClick={
                  fillDemoAccount
                }
                disabled={
                  isLoading
                }
                className="text-[10px] font-bold text-blue-700 hover:text-blue-950 hover:underline disabled:opacity-50"
              >
                Use demo
              </button>

            </div>

            <p className="text-[11px] text-blue-800 leading-snug mb-2">
              Use this public demo account to explore the complete scholarship workflow.
            </p>

            <div className="space-y-1 text-[11px]">

              <div className="flex items-center justify-between gap-3">
                <span className="text-blue-700">
                  Mobile Number
                </span>

                <span className="font-mono font-semibold text-blue-950">
                  9000000001
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-blue-700">
                  Password
                </span>

                <span className="font-mono font-semibold text-blue-950">
                  LocalTest@2026!
                </span>
              </div>

            </div>
          </div>

          {sessionExpired && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              Your previous session expired. Please sign in again.
            </div>
          )}

          {isLoading && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 animate-in fade-in slide-in-from-top-2 duration-300">

              <div className="flex items-center gap-3">

                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200">

                  {phase ===
                  "verifying" ? (
                    <ShieldCheck className="w-4 h-4 text-mota-700" />
                  ) : (
                    <Wifi className="w-4 h-4 text-mota-700 animate-pulse" />
                  )}

                  <span className="absolute inset-0 rounded-xl border border-mota-700/10 animate-ping" />

                </div>

                <div className="min-w-0 flex-1">

                  <div className="flex items-center justify-between gap-2 mb-1">

                    <p className="text-xs font-bold text-slate-800">
                      {phaseTitle}
                    </p>

                    <span className="text-[10px] text-slate-400">
                      Secure
                    </span>

                  </div>

                  <p className="text-[11px] text-slate-500 leading-snug">
                    {statusMessage ||
                      "Please keep this screen open…"}
                  </p>

                </div>

              </div>

              <div className="mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden">

                <div
                  className={[
                    "h-full rounded-full transition-all duration-700",
                    phase ===
                    "verifying"
                      ? "w-3/4 bg-mota-700"
                      : "w-1/2 bg-mota-700 animate-pulse",
                  ].join(" ")}
                />

              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">

                <span className="flex items-center gap-1">

                  <ServerCog className="w-3 h-3" />

                  Scholarship service

                </span>

                <span>
                  Attempting secure connection
                </span>

              </div>

            </div>
          )}

          {phase ===
            "success" &&
            !isLoading && (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 animate-in fade-in zoom-in-95 duration-300">

                <div className="flex items-center gap-2.5">

                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">

                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />

                  </div>

                  <div>

                    <p className="text-xs font-bold text-emerald-900">
                      Sign-in successful
                    </p>

                    <p className="text-[11px] text-emerald-700">
                      Opening your dashboard…
                    </p>

                  </div>

                </div>

              </div>
            )}

          {phase ===
            "error" &&
            error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 animate-in fade-in slide-in-from-top-2 duration-300">

                <div className="flex items-start gap-2.5">

                  <div className="mt-0.5 w-8 h-8 shrink-0 rounded-full bg-red-100 flex items-center justify-center">

                    <AlertCircle className="w-4 h-4 text-red-700" />

                  </div>

                  <div className="min-w-0 flex-1">

                    <p className="text-xs font-bold text-red-900 mb-1">
                      Sign-in could not be completed
                    </p>

                    <p className="text-[11px] text-red-700 leading-snug">
                      {error}
                    </p>

                  </div>

                </div>

              </div>
            )}

          <form
            onSubmit={
              handleSubmit
            }
            className="space-y-4"
          >

            <Input
              label="Mobile Number, Student ID or Email"
              placeholder="10-digit mobile / STU-... / email"
              value={
                identifier
              }
              onChange={(
                event,
              ) =>
                setIdentifier(
                  event.target.value,
                )
              }
              required
              disabled={
                isLoading
              }
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={
                password
              }
              onChange={(
                event,
              ) =>
                setPassword(
                  event.target.value,
                )
              }
              required
              disabled={
                isLoading
              }
            />

            <Button
              type="submit"
              className="w-full gap-1.5"
              isLoading={
                isLoading
              }
              disabled={
                isLoading
              }
            >

              <span>
                {phase ===
                  "error" &&
                !isLoading
                  ? "Try Again"
                  : "Sign In"}
              </span>

              {phase ===
                "error" &&
              !isLoading ? (
                <RefreshCw className="w-4 h-4" />
              ) : !isLoading ? (
                <ArrowRight className="w-4 h-4" />
              ) : null}

            </Button>

          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">

            <span>
              New student applicant?{" "}
            </span>

            <Link
              href="/register"
              className="font-bold text-mota-700 hover:underline"
            >
              Register here
            </Link>

          </div>

        </CardContent>

      </Card>

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="p-5 max-w-sm mx-auto flex flex-col justify-center min-h-[calc(100vh-140px)]">

          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">

            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-mota-900 text-amber-400 flex items-center justify-center">

              <LoaderCircle className="w-5 h-5 animate-spin" />

            </div>

            <p className="text-sm font-bold text-slate-900">
              Loading login…
            </p>

            <p className="text-xs text-slate-500 mt-1">
              Preparing secure authentication.
            </p>

          </div>

        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
