import { NextRequest } from "next/server";
import { digiLockerService } from "@/modules/government/DigiLockerService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { AppError } from "@/shared/errors/AppError";

export async function POST(req: NextRequest) {
  try {
    const configuredKey = process.env.GOVERNMENT_BRIDGE_API_KEY || "";
    if (!configuredKey || req.headers.get("x-sih-api-key") !== configuredKey) {
      throw new AppError("UNAUTHORIZED", "Government source bridge authorization is required.", 401);
    }
    const body = await req.json();
    const studentId = String(body.student_id || "").trim();
    if (!studentId) throw new AppError("VALIDATION_ERROR", "student_id is required.", 400);
    const result = await digiLockerService.getSourceRecord(studentId, { consentId: body.consent_id });
    return handleApiSuccess(result, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
