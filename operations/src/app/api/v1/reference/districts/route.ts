import { NextRequest } from "next/server";
import { handleApiError, handleApiSuccess } from "@/shared/api/handler";
import { referenceDataService } from "@/modules/reference/ReferenceDataService";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const stateCode = url.searchParams.get("stateCode") || "";
    const forceRefresh = url.searchParams.get("refresh") === "true";
    return handleApiSuccess(await referenceDataService.listDistricts(stateCode, forceRefresh), req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
