"use client";

import React, {
  Suspense,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/Card";

import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  LoaderCircle,
} from "lucide-react";

import { authApi } from "../../lib/api/auth";
import { clearSession } from "../../lib/auth/session";

function LoginContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const sessionExpired =
    searchParams.get(
      "reason",
    ) === "session_expired";

  const [
    identifier,
    setIdentifier,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    statusMessage,
    setStatusMessage,
  ] = useState("");

  React.useEffect(() => {
    clearSession();
  }, []);

  const handleSubmit =
    async (
      e: React.FormEvent,
    ) => {
      e.preventDefault();

      setError("");
      setStatusMessage("");

      if (
        !identifier.trim() ||
        password.length < 8
      ) {
        setError(
          "Enter your mobile number, Student ID, or email and your password.",
        );
        return;
      }

      setIsLoading(true);

      setStatusMessage(
        "Connecting to secure services…",
      );

      try {
        await authApi.login(
          identifier.trim(),
          password,
          {
            onStatus:
              setStatusMessage,
          },
        );

        router.replace(
          "/dashboard",
        );
      } catch (err) {
        setStatusMessage("");

        setError(
          err instanceof Error
            ? err.message
            : "Login failed.",
        );
      } finally {
        setIsLoading(false);
      }
    };

  return (
    <div className="p-5 max-w-sm mx-auto flex flex-col justify-center min-h-[calc(100vh-140px)]">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Home
      </Link>

      <Card className="border-slate-200/90 shadow-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-mota-900 text-amber-400 flex items-center justify-center mx-auto mb-2 shadow-sm">
            <ShieldCheck className="w-7 h-7" />
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
            <div className="text-xs font-bold text-blue-900 mb-1">
              Demo Testing Account
            </div>

            <p className="text-[11px] text-blue-800 leading-snug mb-2">
              Use this public demo account to explore the complete scholarship workflow.
            </p>

            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-blue-700">Mobile Number</span>
                <span className="font-mono font-semibold text-blue-950">
                  9000000001
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-blue-700">Password</span>
                <span className="font-mono font-semibold text-blue-950">
                  LocalTest@2026!
                </span>
              </div>
            </div>
          </div>
{sessionExpired && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              Your previous session expired. Please
              sign in again.
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <Input
              label="Mobile Number, Student ID or Email"
              placeholder="10-digit mobile / STU-... / email"
              value={identifier}
              onChange={(e) =>
                setIdentifier(
                  e.target.value,
                )
              }
              error={error}
              required
              disabled={isLoading}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value,
                )
              }
              required
              disabled={isLoading}
            />

            {isLoading &&
              statusMessage && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <LoaderCircle className="w-4 h-4 shrink-0 text-mota-700 animate-spin" />

                  <p className="text-xs text-slate-600 leading-snug">
                    {statusMessage}
                  </p>
                </div>
              )}

            <Button
              type="submit"
              className="w-full gap-1.5"
              isLoading={isLoading}
              disabled={isLoading}
            >
              <span>
                {isLoading
                  ? "Signing in…"
                  : "Sign In"}
              </span>

              {!isLoading && (
                <ArrowRight className="w-4 h-4" />
              )}
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
            <p className="text-sm font-bold text-slate-900">
              Loading login...
            </p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
