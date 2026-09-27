import { NextRequest } from "next/server";
import { handleApiError, handleApiSuccess } from "@/shared/api/handler";
import { referenceDataService } from "@/modules/reference/ReferenceDataService";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";
    const state = url.searchParams.get("state") || undefined;
    const district = url.searchParams.get("district") || undefined;
    const limit = Number(url.searchParams.get("limit") || "10");
    const rows = await referenceDataService.searchInstitutions(query, state, district, Number.isFinite(limit) ? limit : 10);
    return handleApiSuccess(rows, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
