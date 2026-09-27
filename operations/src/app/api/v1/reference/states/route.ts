import { NextRequest } from "next/server";
import { handleApiError, handleApiSuccess } from "@/shared/api/handler";
import { referenceDataService } from "@/modules/reference/ReferenceDataService";

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = new URL(req.url).searchParams.get("refresh") === "true";
    return handleApiSuccess(await referenceDataService.listStates(forceRefresh), req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
