import { NextRequest } from "next/server";
import { studentAuthService } from "@/modules/auth/StudentAuthService";
import { assertStudentMatch } from "@/shared/auth/student";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function PATCH(req: NextRequest) {
  try {
    const studentId = assertStudentMatch(req);
    const body = await req.json();
    return handleApiSuccess(await studentAuthService.updateProfile(studentId, body), req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
