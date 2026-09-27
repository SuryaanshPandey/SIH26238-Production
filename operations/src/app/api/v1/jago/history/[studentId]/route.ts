import { NextRequest } from "next/server";
import { jagoService } from "@/modules/jago/JagoService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticate } from "@/shared/auth/rbac";
import { AppError } from "@/shared/errors/AppError";

export async function GET(req: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const user = authenticate(req);
    if (user.role === "STUDENT" && user.sub !== params.studentId) {
      throw new AppError("FORBIDDEN", "A student account may only access its own JAGO history.", 403);
    }
    const history = await jagoService.getHistory(params.studentId, 20);
    return handleApiSuccess(history, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
