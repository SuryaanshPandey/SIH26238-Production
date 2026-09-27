import { prisma } from "@/lib/prisma";

/**
 * Lightweight read-only application query path used by the student list screen.
 *
 * Keep this module deliberately free of lifecycle/workflow/verification imports.
 * The previous route imported ApplicationService, which pulls in the entire
 * application workflow dependency graph and can make the first Next.js API
 * request spend longer compiling than the browser's request timeout.
 */
export async function listStudentApplications(studentId: string, filters?: {
  status?: string;
  scholarshipId?: string;
  academicYear?: string;
}) {
  const startedAt = Date.now();

  const rows = await prisma.application.findMany({
    where: {
      studentId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.scholarshipId ? { scholarshipId: filters.scholarshipId } : {}),
      ...(filters?.academicYear ? { academicYear: filters.academicYear } : {}),
    },
    select: {
      applicationId: true,
      studentId: true,
      scholarshipId: true,
      academicYear: true,
      status: true,
      currentStage: true,
      submittedAt: true,
      updatedAt: true,
      institutionId: true,
      scholarship: {
        select: {
          schemeName: true,
          schemeCode: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs > 2000) {
    console.warn(`[applications] student list query took ${elapsedMs}ms for ${rows.length} record(s)`);
  }

  return rows.map((row) => ({
    application_id: row.applicationId,
    student_id: row.studentId,
    scholarship_id: row.scholarshipId,
    scholarship_name: row.scholarship?.schemeName || row.scholarshipId,
    scheme_name: row.scholarship?.schemeName || row.scholarshipId,
    scheme_code: row.scholarship?.schemeCode || undefined,
    academic_year: row.academicYear,
    status: row.status,
    current_stage: row.currentStage || row.status,
    submitted_at: row.submittedAt ? row.submittedAt.toISOString() : null,
    updated_at: row.updatedAt.toISOString(),
    institution_id: row.institutionId,
    deficiency_ids: [],
    sanction_id: undefined,
    payment_id: undefined,
  }));
}
