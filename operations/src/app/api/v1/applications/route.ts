import { NextRequest } from "next/server";
import { listStudentApplications } from "@/modules/applications/ApplicationReadService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticate } from "@/shared/auth/rbac";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Student list endpoint: intentionally lightweight. Do not import the full
 * ApplicationService here because its workflow/verification dependency graph
 * makes the first Next.js dev request unnecessarily expensive.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const scholarshipId = searchParams.get("scholarshipId") || undefined;
    const requestedStudentId = searchParams.get("studentId") || undefined;
    const user = authenticate(req);
    const studentId = user.role === "STUDENT" ? user.sub : requestedStudentId;
    const academicYear = searchParams.get("academicYear") || undefined;

    if (studentId) {
      const list = await listStudentApplications(studentId, { status, scholarshipId, academicYear });
      return handleApiSuccess(list, req);
    }

    // Admin/desk users without a student filter use the full workflow service.
    // It is dynamically imported so it cannot slow down the student GET path.
    const { applicationService } = await import("@/modules/applications/ApplicationService");
    const list = await applicationService.listApplications({ status, scholarshipId, studentId, academicYear });
    return handleApiSuccess(list, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = authenticate(req);
    const { applicationService } = await import("@/modules/applications/ApplicationService");
    const created = await applicationService.createApplication({
      ...body,
      studentId: user.role === "STUDENT" ? user.sub : body.studentId,
    });
    return handleApiSuccess(created, req, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}
