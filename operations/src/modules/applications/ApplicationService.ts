import { prisma } from "@/lib/prisma";
import { ApplicationContract, ApplicationStatus } from "@contracts/v1/types";
import { AppError } from "@/shared/errors/AppError";
import { ApplicationStateMachine } from "./ApplicationStateMachine";
import { auditService } from "@/modules/audit/AuditService";
import { notificationService } from "@/modules/notifications/NotificationService";
import { getVerificationClient } from "@/adapters/verification";
import { verificationDeficiencyTranslator } from "@/modules/deficiencies/VerificationDeficiencyTranslator";
import { reviewService } from "@/modules/reviews/ReviewService";
import { databaseStudentClient } from "@/adapters/student/DatabaseStudentClient";
import { getDocumentClient } from "@/adapters/document";
import { eligibilityEngine } from "@/modules/eligibility/EligibilityEngine";

export interface CreateApplicationParams {
  studentId: string;
  scholarshipId: string;
  academicYear: string;
  institutionId?: string;
}

async function grantVerificationConsent(studentId: string): Promise<string> {
  const baseUrl = (process.env.VERIFICATION_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.VERIFICATION_SERVICE_API_KEY) headers["X-SIH-API-Key"] = process.env.VERIFICATION_SERVICE_API_KEY;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/consents`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        student_id: studentId,
        purpose: "SCHOLARSHIP_VERIFICATION",
        source: "STUDENT_APPLICATION_SUBMISSION",
      }),
      cache: "no-store",
    });
  } catch (error) {
    throw new AppError(
      "VERIFICATION_SERVICE_UNAVAILABLE",
      `Verification consent service is unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
      503
    );
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    throw new AppError(
      "VERIFICATION_SERVICE_UNAVAILABLE",
      body?.message || body?.error?.message || `Verification consent service returned HTTP ${response.status}.`,
      503
    );
  }
  const record = body?.data || body;
  if (!record?.consent_id) {
    throw new AppError("VERIFICATION_SERVICE_UNAVAILABLE", "Verification consent service returned no consent ID.", 503);
  }
  return String(record.consent_id);
}

export class ApplicationService {
  private assertScholarshipApplicationOpen(scholarship: any): void {
    if (scholarship.status !== "ACTIVE") {
      const statusMessage = scholarship.status === "INFORMATION_ONLY"
        ? `Scholarship '${scholarship.schemeName}' is currently INFORMATION_ONLY because the official application window has not been published.`
        : `Scholarship '${scholarship.schemeName}' is currently ${scholarship.status}.`;
      throw new AppError("SCHOLARSHIP_NOT_ACTIVE", statusMessage, 422, {
        scholarshipId: scholarship.scholarshipId,
        status: scholarship.status,
        applicationStartDate: scholarship.applicationStartDate?.toISOString() || null,
        applicationEndDate: scholarship.applicationEndDate?.toISOString() || null,
      });
    }

    // Do not trust a stale ACTIVE flag on its own. The current application
    // window must also contain now whenever official dates are published.
    const now = new Date();
    if (scholarship.applicationStartDate && now < scholarship.applicationStartDate) {
      throw new AppError("SCHOLARSHIP_NOT_ACTIVE", `Applications for '${scholarship.schemeName}' are not open yet.`, 422, {
        scholarshipId: scholarship.scholarshipId,
        status: scholarship.status,
        applicationStartDate: scholarship.applicationStartDate.toISOString(),
      });
    }
    if (scholarship.applicationEndDate && now > scholarship.applicationEndDate) {
      throw new AppError("SCHOLARSHIP_NOT_ACTIVE", `Applications for '${scholarship.schemeName}' are closed.`, 422, {
        scholarshipId: scholarship.scholarshipId,
        status: scholarship.status,
        applicationEndDate: scholarship.applicationEndDate.toISOString(),
      });
    }
  }

  async createApplication(params: CreateApplicationParams): Promise<ApplicationContract> {
    const scholarship = await prisma.scholarship.findUnique({
      where: { scholarshipId: params.scholarshipId },
    });
    if (!scholarship) {
      throw AppError.notFound("Scholarship", params.scholarshipId);
    }
    this.assertScholarshipApplicationOpen(scholarship);

    const student = await databaseStudentClient.getStudentById(params.studentId);
    if (!student) {
      throw AppError.notFound("Student", params.studentId);
    }

    const applicationId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const app = await prisma.application.create({
      data: {
        applicationId,
        studentId: params.studentId,
        scholarshipId: params.scholarshipId,
        academicYear: params.academicYear,
        status: "DRAFT",
        currentStage: "STUDENT_ENTRY",
        institutionId: params.institutionId || student.institution_id || "inst_unknown",
        statusHistory: {
          create: {
            fromStatus: "NONE",
            toStatus: "DRAFT",
            actorType: "STUDENT",
            actorId: params.studentId,
            reason: "Application draft initiated.",
            correlationId: `corr_init_${applicationId}`,
          },
        },
      },
    });

    await auditService.log({
      actorType: "STUDENT",
      actorId: params.studentId,
      action: "APPLICATION_CREATED",
      entityType: "APPLICATION",
      entityId: applicationId,
      payload: { scholarshipId: params.scholarshipId, academicYear: params.academicYear },
    });

    return this.mapToContract(app);
  }

  async submitApplication(applicationId: string, studentId: string, consentGranted = false): Promise<ApplicationContract> {
    const app = await prisma.application.findUnique({
      where: { applicationId },
      include: { scholarship: true },
    });
    if (!app) {
      throw AppError.notFound("Application", applicationId);
    }
    if (app.studentId !== studentId) {
      throw new AppError("FORBIDDEN", "A student account may only submit its own application.", 403);
    }

    this.assertScholarshipApplicationOpen(app.scholarship);
    ApplicationStateMachine.validateTransition(app.status as ApplicationStatus, "SUBMITTED");
    if (!consentGranted) {
      throw AppError.invalidRequest("Consent to scholarship verification is required before submitting the application.");
    }

    const consentId = await grantVerificationConsent(studentId);

    const updated = await prisma.application.update({
      where: { applicationId },
      data: {
        status: "SUBMITTED",
        currentStage: "SUBMITTED_FOR_VERIFICATION",
        submittedAt: new Date(),
        statusHistory: {
          create: {
            fromStatus: app.status,
            toStatus: "SUBMITTED",
            actorType: "STUDENT",
            actorId: studentId,
            reason: "Student submitted application.",
            correlationId: `corr_sub_${Date.now()}`,
          },
        },
      },
    });

    await auditService.log({
      actorType: "STUDENT",
      actorId: studentId,
      action: "APPLICATION_SUBMITTED",
      entityType: "APPLICATION",
      entityId: applicationId,
      payload: { submittedAt: updated.submittedAt, verificationConsentId: consentId },
    });

    await notificationService.dispatch({
      studentId: app.studentId,
      applicationId: app.applicationId,
      type: "APPLICATION_SUBMITTED",
      title: "Application Successfully Submitted",
      message: `Your application for ${app.scholarship.schemeName} has been submitted and entered the automated verification queue.`,
      channel: "IN_APP",
    });

    // Run the real verification pipeline immediately when the service is available.
    // A temporary provider outage must not roll back a valid student submission.
    try {
      const verificationResult = await this.startVerification(applicationId, "MATCH");
      return verificationResult.application;
    } catch (error) {
      await auditService.log({
        actorType: "SYSTEM",
        actorId: "VERIFICATION_ENGINE",
        action: "VERIFICATION_DEFERRED",
        entityType: "APPLICATION",
        entityId: applicationId,
        reason: error instanceof Error ? error.message : "Verification could not be started immediately.",
      });
      await notificationService.dispatch({
        studentId: app.studentId,
        applicationId: app.applicationId,
        type: "VERIFICATION_UPDATED",
        title: "Verification Pending",
        message: "Your application is submitted, but one or more verification sources are temporarily unavailable. The submitted record remains safe and unchanged.",
        channel: "IN_APP",
      });
      return this.mapToContract(updated);
    }
  }

  async startVerification(
    applicationId: string,
    scenario: "MATCH" | "MISMATCH" | "SOURCE_UNAVAILABLE" | "PARTIAL_MATCH" = "MATCH"
  ): Promise<{ application: ApplicationContract; verificationsCount: number; requiresAction: boolean }> {
    const app = await prisma.application.findUnique({
      where: { applicationId },
      include: { scholarship: true },
    });
    if (!app) {
      throw AppError.notFound("Application", applicationId);
    }

    if (app.status !== "SUBMITTED" && app.status !== "UNDER_VERIFICATION" && app.status !== "ACTION_REQUIRED") {
      throw AppError.invalidRequest(`Cannot start verification from status '${app.status}'.`);
    }

    // Transition to UNDER_VERIFICATION if not already
    if (app.status === "SUBMITTED" || app.status === "ACTION_REQUIRED") {
      ApplicationStateMachine.validateTransition(app.status as ApplicationStatus, "UNDER_VERIFICATION");
      await prisma.application.update({
        where: { applicationId },
        data: {
          status: "UNDER_VERIFICATION",
          currentStage: "AUTOMATED_VERIFICATION",
          statusHistory: {
            create: {
              fromStatus: app.status,
              toStatus: "UNDER_VERIFICATION",
              actorType: "SYSTEM",
              actorId: "VERIFICATION_ENGINE",
              reason: "Automated verification checks triggered.",
              correlationId: `corr_verif_${Date.now()}`,
            },
          },
        },
      });
    }

    // Simulate/Call MockVerificationClient
    const verificationClient = getVerificationClient();
    const documentClient = getDocumentClient();

    // Evaluate eligibility with the same verified student/document context used by verification.
    const student = (await databaseStudentClient.getStudentById(app.studentId))!;
    const documents = await documentClient.getDocumentsByStudentId(app.studentId);
    const verifications = await verificationClient.simulateVerification(applicationId, scenario, { student, documents });
    const scholarshipContract = {
      scholarship_id: app.scholarship.scholarshipId,
      scheme_name: app.scholarship.schemeName,
      scheme_code: app.scholarship.schemeCode,
      scheme_type: app.scholarship.schemeType as any,
      academic_year: app.scholarship.academicYear,
      status: app.scholarship.status as any,
      jurisdiction: app.scholarship.jurisdiction,
      eligibility_rule_version: app.scholarship.eligibilityRuleVersion,
      application_start_date: app.scholarship.applicationStartDate ? app.scholarship.applicationStartDate.toISOString() : null,
      application_end_date: app.scholarship.applicationEndDate ? app.scholarship.applicationEndDate.toISOString() : null,
      required_document_types: JSON.parse(app.scholarship.requiredDocumentTypes),
      benefit_summary: JSON.parse(app.scholarship.benefitSummary),
      application_channel: app.scholarship.applicationChannel as any,
      created_at: app.scholarship.createdAt.toISOString(),
      updated_at: app.scholarship.updatedAt.toISOString(),
    };

    const evalResult = eligibilityEngine.evaluate(applicationId, {
      student,
      scholarship: scholarshipContract,
      documents,
      verifications,
    });

    // Save evaluation record to DB
    await prisma.eligibilityEvaluation.create({
      data: {
        evaluationId: evalResult.evaluationId,
        applicationId,
        scholarshipId: app.scholarshipId,
        ruleVersion: evalResult.ruleVersion,
        result: evalResult.result,
        confidence: evalResult.confidence,
        reasons: JSON.stringify(evalResult.reasons),
        failedRules: JSON.stringify(evalResult.failedRules),
        missingInformation: JSON.stringify(evalResult.missingInformation),
        verificationDependencies: JSON.stringify(evalResult.verificationDependencies),
        ruleResults: {
          create: evalResult.ruleResults.map((r) => ({
            ruleCode: r.ruleCode,
            status: r.status,
            passed: r.passed,
            reason: r.reason,
            evidenceRefs: JSON.stringify(r.evidenceRefs),
          })),
        },
      },
    });

    // Translate verification outcome to deficiencies or next workflow stage
    const translation = await verificationDeficiencyTranslator.processVerifications(
      applicationId,
      verifications
    );

    let nextStatus: ApplicationStatus = "UNDER_VERIFICATION";
    let nextStage = "AUTOMATED_VERIFICATION";

    if (translation.requiresAction) {
      nextStatus = "ACTION_REQUIRED";
      nextStage = "DEFICIENCY_RESOLUTION";
    } else if (translation.requiresManualReview || evalResult.result === "NEEDS_VERIFICATION") {
      nextStatus = "UNDER_REVIEW";
      nextStage = "DESK_OFFICER_REVIEW";
      await reviewService.createReviewCase({
        applicationId,
        reason: "Discrepancy or source dependency requires desk officer review.",
        severity: "MEDIUM",
      });
    } else if (evalResult.result === "ELIGIBLE") {
      nextStatus = "VERIFIED";
      nextStage = "VERIFIED_ELIGIBLE";
    } else if (evalResult.result === "NOT_ELIGIBLE") {
      nextStatus = "UNDER_REVIEW";
      nextStage = "DESK_OFFICER_REVIEW";
      await reviewService.createReviewCase({
        applicationId,
        reason: "Eligibility criteria failed. Escalated to manual review before final determination.",
        severity: "HIGH",
      });
    }

    const updatedApp = await prisma.application.update({
      where: { applicationId },
      data: {
        status: nextStatus,
        currentStage: nextStage,
        statusHistory: {
          create: {
            fromStatus: "UNDER_VERIFICATION",
            toStatus: nextStatus,
            actorType: "SYSTEM",
            actorId: "WORKFLOW_ROUTER",
            reason: `Workflow progressed to ${nextStatus} based on verification and eligibility evaluation.`,
            correlationId: `corr_route_${Date.now()}`,
          },
        },
      },
    });

    await auditService.log({
      actorType: "SYSTEM",
      actorId: "WORKFLOW_ROUTER",
      action: "VERIFICATION_PROCESSED",
      entityType: "APPLICATION",
      entityId: applicationId,
      payload: { nextStatus, verificationsCount: verifications.length },
    });

    return {
      application: this.mapToContract(updatedApp),
      verificationsCount: verifications.length,
      requiresAction: translation.requiresAction,
    };
  }

  async verifyApplication(applicationId: string, reviewerId: string, notes?: string): Promise<ApplicationContract> {
    const app = await prisma.application.findUnique({
      where: { applicationId },
    });
    if (!app) {
      throw AppError.notFound("Application", applicationId);
    }

    ApplicationStateMachine.validateTransition(app.status as ApplicationStatus, "VERIFIED");

    const updated = await prisma.application.update({
      where: { applicationId },
      data: {
        status: "VERIFIED",
        currentStage: "READY_FOR_SANCTION",
        statusHistory: {
          create: {
            fromStatus: app.status,
            toStatus: "VERIFIED",
            actorType: "REVIEWER",
            actorId: reviewerId,
            reason: notes || "Application verified and approved for sanction.",
            correlationId: `corr_ver_${Date.now()}`,
          },
        },
      },
    });

    await auditService.log({
      actorType: "REVIEWER",
      actorId: reviewerId,
      action: "APPLICATION_VERIFIED",
      entityType: "APPLICATION",
      entityId: applicationId,
      reason: notes,
    });

    return this.mapToContract(updated);
  }

  async rejectApplication(applicationId: string, reason: string, actorId: string): Promise<ApplicationContract> {
    const app = await prisma.application.findUnique({
      where: { applicationId },
    });
    if (!app) {
      throw AppError.notFound("Application", applicationId);
    }

    ApplicationStateMachine.validateTransition(app.status as ApplicationStatus, "REJECTED");

    const updated = await prisma.application.update({
      where: { applicationId },
      data: {
        status: "REJECTED",
        currentStage: "APPLICATION_REJECTED",
        statusHistory: {
          create: {
            fromStatus: app.status,
            toStatus: "REJECTED",
            actorType: "REVIEWER",
            actorId,
            reason,
            correlationId: `corr_rej_${Date.now()}`,
          },
        },
      },
    });

    await auditService.log({
      actorType: "REVIEWER",
      actorId,
      action: "APPLICATION_REJECTED",
      entityType: "APPLICATION",
      entityId: applicationId,
      reason,
    });

    await notificationService.dispatch({
      studentId: app.studentId,
      applicationId: app.applicationId,
      type: "APPLICATION_STATUS_CHANGED",
      title: "Application Status Update",
      message: `Your scholarship application was not approved. Reason: ${reason}`,
      priority: "HIGH",
      channel: "IN_APP",
    });

    return this.mapToContract(updated);
  }

  async getApplication(applicationId: string): Promise<ApplicationContract | null> {
    const app = await prisma.application.findUnique({
      where: { applicationId },
      include: { deficiencies: true, sanction: true, payment: true },
    });
    return app ? this.mapToContract(app) : null;
  }

  async listApplications(filters?: {
    status?: string;
    scholarshipId?: string;
    studentId?: string;
    academicYear?: string;
  }): Promise<ApplicationContract[]> {
    const list = await prisma.application.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.scholarshipId ? { scholarshipId: filters.scholarshipId } : {}),
        ...(filters?.studentId ? { studentId: filters.studentId } : {}),
        ...(filters?.academicYear ? { academicYear: filters.academicYear } : {}),
      },
      include: { deficiencies: true, sanction: true, payment: true },
      orderBy: { createdAt: "desc" },
    });

    return list.map((a) => this.mapToContract(a));
  }

  private mapToContract(record: any): ApplicationContract {
    return {
      application_id: record.applicationId,
      student_id: record.studentId,
      scholarship_id: record.scholarshipId,
      academic_year: record.academicYear,
      status: record.status as ApplicationStatus,
      current_stage: record.currentStage,
      submitted_at: record.submittedAt ? record.submittedAt.toISOString() : null,
      updated_at: record.updatedAt.toISOString(),
      institution_id: record.institutionId,
      deficiency_ids: record.deficiencies ? record.deficiencies.map((d: any) => d.deficiencyId) : [],
      verification_ids: [],
      sanction_id: record.sanction ? record.sanction.sanctionId : null,
      payment_id: record.payment ? record.payment.paymentId : null,
    };
  }
}

export const applicationService = new ApplicationService();
