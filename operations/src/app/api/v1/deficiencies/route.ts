import { NextRequest } from "next/server";
import { deficiencyService } from "@/modules/deficiencies/DeficiencyService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { prisma } from "@/lib/prisma";
import { authenticate } from "@/shared/auth/rbac";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedStudentId = searchParams.get("studentId") || undefined;
    const user = authenticate(req);
    const studentId = user.role === "STUDENT" ? user.sub : requestedStudentId;
    if (!studentId) return handleApiSuccess(await deficiencyService.listDeficiencies(), req);

    const applications = await prisma.application.findMany({ where: { studentId }, select: { applicationId: true } });
    const lists = await Promise.all(applications.map(a => deficiencyService.listDeficiencies(a.applicationId)));
    return handleApiSuccess(lists.flat(), req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
