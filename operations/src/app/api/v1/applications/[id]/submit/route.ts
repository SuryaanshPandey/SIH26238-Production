import { NextRequest } from "next/server";
import { applicationService } from "@/modules/applications/ApplicationService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticate } from "@/shared/auth/rbac";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const user = authenticate(req);
    const studentId = user.role === "STUDENT" ? user.sub : body.studentId;
    if (!studentId) throw new Error("studentId is required");
    const consentGranted = body.consentGranted === true;
    const updated = await applicationService.submitApplication(params.id, studentId, consentGranted);
    return handleApiSuccess(updated, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
