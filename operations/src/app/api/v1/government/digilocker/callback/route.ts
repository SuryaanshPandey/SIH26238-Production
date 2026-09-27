import { NextRequest, NextResponse } from "next/server";
import { digiLockerService } from "@/modules/government/DigiLockerService";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const studentOrigin = process.env.STUDENT_APP_ORIGIN || "http://localhost:3000";
  const destination = new URL("/profile", studentOrigin);
  try {
    const error = url.searchParams.get("error");
    if (error) throw new Error(url.searchParams.get("error_description") || error);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) throw new Error("DigiLocker did not return a valid authorization code.");
    await digiLockerService.callback(code, state);
    destination.searchParams.set("digilocker", "connected");
  } catch (error) {
    destination.searchParams.set("digilocker", "error");
    destination.searchParams.set("message", error instanceof Error ? error.message : "DigiLocker connection failed.");
  }
  return NextResponse.redirect(destination);
}
