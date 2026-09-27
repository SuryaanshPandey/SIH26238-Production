import { NextRequest } from "next/server";
import { jagoService } from "@/modules/jago/JagoService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { AppError } from "@/shared/errors/AppError";
import { authenticate } from "@/shared/auth/rbac";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = authenticate(req);
    const studentId = user.role === "STUDENT" ? user.sub : body.studentId;
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!studentId || !query) {
      throw AppError.invalidRequest("studentId and query are required in JAGO assistance payload.");
    }

    const response = await jagoService.processQuery({
      studentId,
      applicationId: typeof body.applicationId === "string" ? body.applicationId : undefined,
      query,
      language: body.language === "hi" ? "hi" : "en",
    });

    return handleApiSuccess(response, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
