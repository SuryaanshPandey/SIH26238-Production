import { NextRequest } from "next/server";
import { studentAuthService } from "@/modules/auth/StudentAuthService";
import { assertStudentMatch } from "@/shared/auth/student";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function GET(req: NextRequest) {
  try {
    const studentId = assertStudentMatch(req);
    return handleApiSuccess(await studentAuthService.getProfile(studentId), req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
