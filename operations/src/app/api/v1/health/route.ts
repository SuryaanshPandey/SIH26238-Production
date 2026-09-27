import { NextRequest } from "next/server";
import { handleApiError, handleApiSuccess } from "@/shared/api/handler";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // Readiness must verify the local service/database only. It must not depend on
    // an external government source being reachable at the exact moment startup runs.
    await prisma.scholarship.count();

    return handleApiSuccess(
      {
        status: "ok",
        service: "operations",
        database: "ok",
        real_data_mode: process.env.REAL_DATA_MODE !== "false",
        external_sources: {
          nsp: "checked_on_demand",
          digilocker: "checked_on_demand",
        },
        checked_at: new Date().toISOString(),
      },
      req,
    );
  } catch (err) {
    return handleApiError(err, req);
  }
}
