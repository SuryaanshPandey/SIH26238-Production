"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import { authApi } from "../../lib/api/auth";
import { clearSession } from "../../lib/auth/session";

export default function LoginPage() {
  React.useEffect(() => { clearSession(); }, []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session_expired";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || password.length < 8) {
      setError("Enter your mobile number, Student ID, or email and your password.");
      return;
    }
    setIsLoading(true);
    try {
      await authApi.login(identifier.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-5 max-w-sm mx-auto flex flex-col justify-center min-h-[calc(100vh-140px)]">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
      </Link>
      <Card className="border-slate-200/90 shadow-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-mota-900 text-amber-400 flex items-center justify-center mx-auto mb-2 shadow-sm">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <CardTitle className="text-lg">Student Login</CardTitle>
          <CardDescription>Sign in to your real student account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Mobile Number, Student ID or Email" placeholder="10-digit mobile / STU-... / email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} error={error} required />
            <Input label="Password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" className="w-full gap-1.5" isLoading={isLoading}>
              <span>Sign In</span><ArrowRight className="w-4 h-4" />
            </Button>
          </form>
          <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            <span>New student applicant? </span>
            <Link href="/register" className="font-bold text-mota-700 hover:underline">Register here</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
