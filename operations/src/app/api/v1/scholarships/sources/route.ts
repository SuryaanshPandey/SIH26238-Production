import { NextRequest } from "next/server";
import { officialScholarshipAggregator } from "@/modules/scholarships/OfficialScholarshipAggregator";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticateAndAuthorize } from "@/shared/auth/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sources = await officialScholarshipAggregator.sourceDefinitionsForHealth();
    return handleApiSuccess({
      fetched_at: new Date().toISOString(),
      academic_year: process.env.SCHOLARSHIP_ACADEMIC_YEAR || "2026-2027",
      sources,
    }, req);
  } catch (error) {
    return handleApiError(error, req);
  }
}

export async function POST(req: NextRequest) {
  try {
    authenticateAndAuthorize(req, ["ADMIN", "SUPER_ADMIN", "SCHOLARSHIP_OFFICER"]);
    const summary = await officialScholarshipAggregator.syncAll();
    return handleApiSuccess(summary, req, 200);
  } catch (error) {
    return handleApiError(error, req);
  }
}
