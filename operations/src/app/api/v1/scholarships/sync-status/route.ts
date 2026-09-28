import { NextRequest } from "next/server";
import { officialScholarshipAggregator } from "@/modules/scholarships/OfficialScholarshipAggregator";
import { handleApiError, handleApiSuccess } from "@/shared/api/handler";

export async function GET(req: NextRequest) {
  try {
    return handleApiSuccess(officialScholarshipAggregator.getSyncProgress(), req);
  } catch (err) {
    return handleApiError(err, req);
  }
}