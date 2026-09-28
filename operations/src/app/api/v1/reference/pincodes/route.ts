import { NextRequest } from "next/server";
import { handleApiError, handleApiSuccess } from "@/shared/api/handler";
import { AppError } from "@/shared/errors/AppError";
import { referenceDataService } from "@/modules/reference/ReferenceDataService";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const state = url.searchParams.get("state")?.trim() || "";
    const district = url.searchParams.get("district")?.trim() || "";
    const forceRefresh = url.searchParams.get("refresh") === "true";

    if (!state || !district) {
      return handleApiError(
        new AppError("INVALID_REQUEST", "state and district are required.", 400),
        req
      );
    }

    const rows = await referenceDataService.listPincodes(
      state,
      district,
      forceRefresh
    );

    return handleApiSuccess(rows, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}