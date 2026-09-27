import { NextRequest } from "next/server";
import { eligibilityEngine } from "@/modules/eligibility/EligibilityEngine";
import { databaseStudentClient } from "@/adapters/student/DatabaseStudentClient";
import { authenticate } from "@/shared/auth/rbac";
import { scholarshipService } from "@/modules/scholarships/ScholarshipService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { AppError } from "@/shared/errors/AppError";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = authenticate(req);
    const studentId = user.role === "STUDENT" ? user.sub : body.studentId;
    const { scholarshipId, applicationId = `eval_${Date.now()}` } = body;

    if (!studentId || !scholarshipId) {
      throw AppError.invalidRequest("Missing studentId or scholarshipId in evaluate payload.");
    }

    const student = await databaseStudentClient.getStudentById(studentId);
    if (!student) {
      throw AppError.notFound("Student", studentId);
    }

    const scholarship = await scholarshipService.getScholarship(scholarshipId);
    if (!scholarship) {
      throw AppError.notFound("Scholarship", scholarshipId);
    }

    // NSP catalogue/snapshot records intentionally do not contain the complete
    // machine-readable rule set. Evaluate the explicit metadata-only boundary
    // before touching verification/document providers so an eligibility screen
    // cannot time out waiting for unrelated upstream systems.
    if (
      process.env.REAL_DATA_MODE !== "false" &&
      ["NSP_SOURCE", "NSP_SNAPSHOT"].includes(scholarship.eligibilityRuleVersion)
    ) {
      const result = eligibilityEngine.evaluate(applicationId, { student, scholarship, documents: [], verifications: [] });
      return handleApiSuccess(result, req);
    }

    const { getDocumentClient } = await import("@/adapters/document");
    const { getVerificationClient } = await import("@/adapters/verification");
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    const studentContext = {
      ...student,
      category: answers.category || student.category,
      annual_family_income: answers.annualFamilyIncome ?? student.annual_family_income,
      education_level: answers.educationStage || student.education_level,
      course_name: answers.currentClassOrCourse || student.course_name,
      domicile_state: answers.institutionState || student.domicile_state,
    };

    const [documents, verifications] = await Promise.all([
      getDocumentClient().getDocumentsByStudentId(studentId),
      getVerificationClient().getVerificationByApplication(applicationId),
    ]);

    const result = eligibilityEngine.evaluate(applicationId, {
      student: studentContext,
      scholarship,
      documents,
      verifications,
    });

    return handleApiSuccess(result, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
