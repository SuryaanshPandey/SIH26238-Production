import { NextRequest } from "next/server";
import { handleApiSuccess } from "@/shared/api/handler";

export async function GET(req: NextRequest) {
  return handleApiSuccess(
    {
      status: "ok",
      service: "operations",
      runtime: "ready",
      real_data_mode: process.env.REAL_DATA_MODE !== "false",
      checked_at: new Date().toISOString(),
    },
    req,
  );
}
