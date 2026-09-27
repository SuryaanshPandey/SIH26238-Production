import { NextRequest } from "next/server";
import { applicationService } from "@/modules/applications/ApplicationService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { AppError } from "@/shared/errors/AppError";
import { authenticate } from "@/shared/auth/rbac";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const app = await applicationService.getApplication(params.id);
    const user = authenticate(req);
    if (user.role === "STUDENT" && app && app.student_id !== user.sub) {
      throw new AppError("FORBIDDEN", "A student account may only access its own application.", 403);
    }
    if (!app) {
      throw AppError.notFound("Application", params.id);
    }
    return handleApiSuccess(app, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
