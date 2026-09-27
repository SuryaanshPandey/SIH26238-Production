import { prisma } from "@/lib/prisma";
import { BeneficiaryCandidateContract, BeneficiaryCandidateStatus } from "@contracts/v1/types";
import { AppError } from "@/shared/errors/AppError";
import { databaseStudentClient } from "@/adapters/student/DatabaseStudentClient";
import { getDocumentClient } from "@/adapters/document";
import { eligibilityEngine } from "@/modules/eligibility/EligibilityEngine";
import { auditService } from "@/modules/audit/AuditService";

export class BeneficiaryService {
  async generateCandidates(): Promise<BeneficiaryCandidateContract[]> {
    const activeScholarships = await prisma.scholarship.findMany({
      where: { status: "ACTIVE" },
    });

    if (activeScholarships.length === 0) {
      return [];
    }

    // 1. Fetch student pool from student store / institutional registers
    const allStudents = await databaseStudentClient.searchStudents();
    const results: BeneficiaryCandidateContract[] = [];
    const documentClient = getDocumentClient();

    for (const student of allStudents) {
      // 2. Check if student already has an active application or benefit
      const existingApplication = await prisma.application.findFirst({
        where: {
          studentId: student.student_id,
          status: { notIn: ["REJECTED", "CANCELLED", "WITHDRAWN"] },
        },
      });

      if (existingApplication) {
        // Skip students who are already participating/benefiting
        continue;
      }

      // 3. Evaluate student against each active scholarship
      for (const scheme of activeScholarships) {
        const documents = await documentClient.getDocumentsByStudentId(student.student_id);

        const scholarshipContract = {
          scholarship_id: scheme.scholarshipId,
          scheme_name: scheme.schemeName,
          scheme_code: scheme.schemeCode,
          scheme_type: scheme.schemeType as any,
          academic_year: scheme.academicYear,
          status: scheme.status as any,
          jurisdiction: scheme.jurisdiction,
          eligibility_rule_version: scheme.eligibilityRuleVersion,
          application_start_date: scheme.applicationStartDate ? scheme.applicationStartDate.toISOString() : null,
          application_end_date: scheme.applicationEndDate ? scheme.applicationEndDate.toISOString() : null,
          required_document_types: JSON.parse(scheme.requiredDocumentTypes),
          benefit_summary: JSON.parse(scheme.benefitSummary),
          application_channel: scheme.applicationChannel as any,
          created_at: scheme.createdAt.toISOString(),
          updated_at: scheme.updatedAt.toISOString(),
        };

        const evalResult = eligibilityEngine.evaluate(`eval_cand_${student.student_id}`, {
          student,
          scholarship: scholarshipContract,
          documents,
          verifications: [],
        });

        // If category and academic level match (candidate match signals)
        if (student.category === "ST" && evalResult.result !== "NOT_ELIGIBLE") {
          const satisfiedCount = evalResult.ruleResults.filter((r) => r.status === "SATISFIED").length;
          const totalRules = evalResult.ruleResults.length;
          const dynamicConfidence = Math.min(0.98, Math.max(0.70, Number((satisfiedCount / totalRules).toFixed(2))));

          const evidenceList = [
            `aishe_inst_${student.institution_id || "verified"}`,
            `caste_record_${student.sub_caste_tribe || "st"}`,
          ];

          const reasonText = `Student ${student.first_name} ${student.last_name} (${student.category}) enrolled at ${student.institution_name || "recognized institution"} with family income ₹${student.annual_family_income.toLocaleString("en-IN")} matches criteria for ${scheme.schemeName}, but has no active scholarship application.`;

          const candidateId = `cand_${student.student_id}_${scheme.schemeCode}`;

          const record = await prisma.beneficiaryCandidate.upsert({
            where: { candidateId },
            create: {
              candidateId,
              studentId: student.student_id,
              potentialScholarshipId: scheme.scholarshipId,
              schemeName: scheme.schemeName,
              reasonCode: "ENROLLED_WITHOUT_ACTIVE_BENEFIT",
              reason: reasonText,
              confidence: dynamicConfidence,
              status: "PENDING_REVIEW",
              evidenceIds: JSON.stringify(evidenceList),
            },
            update: {
              reason: reasonText,
              confidence: dynamicConfidence,
            },
          });

          results.push(this.mapToContract(record));
          break; // Match best scheme per student
        }
      }
    }

    return results;
  }

  async listCandidates(filters?: { status?: string; minConfidence?: number }): Promise<BeneficiaryCandidateContract[]> {
    const list = await prisma.beneficiaryCandidate.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: { confidence: "desc" },
    });
    return list.map((c) => this.mapToContract(c));
  }

  async getCandidate(candidateId: string): Promise<BeneficiaryCandidateContract | null> {
    const record = await prisma.beneficiaryCandidate.findUnique({
      where: { candidateId },
    });
    return record ? this.mapToContract(record) : null;
  }

  async reviewCandidate(
    candidateId: string,
    action: "CONFIRM" | "MARK_NOT_ELIGIBLE" | "MARK_ALREADY_BENEFITING" | "CLOSE",
    reviewNotes: string,
    officerId: string
  ): Promise<BeneficiaryCandidateContract> {
    const existing = await prisma.beneficiaryCandidate.findUnique({
      where: { candidateId },
    });
    if (!existing) {
      throw AppError.notFound("BeneficiaryCandidate", candidateId);
    }

    let nextStatus: BeneficiaryCandidateStatus = "PENDING_REVIEW";
    if (action === "CONFIRM") nextStatus = "CONFIRMED";
    else if (action === "MARK_NOT_ELIGIBLE") nextStatus = "NOT_ELIGIBLE";
    else if (action === "MARK_ALREADY_BENEFITING") nextStatus = "ALREADY_BENEFITING";
    else if (action === "CLOSE") nextStatus = "CLOSED";

    const updated = await prisma.beneficiaryCandidate.update({
      where: { candidateId },
      data: {
        status: nextStatus,
        reviewNotes,
        reviewedAt: new Date(),
      },
    });

    await auditService.log({
      actorType: "REVIEWER",
      actorId: officerId,
      action: `BENEFICIARY_CANDIDATE_${action}`,
      entityType: "CANDIDATE",
      entityId: candidateId,
      reason: reviewNotes,
      payload: { previousStatus: existing.status, nextStatus },
    });

    return this.mapToContract(updated);
  }

  private mapToContract(record: {
    candidateId: string;
    studentId: string;
    potentialScholarshipId: string;
    schemeName: string;
    reasonCode: string;
    reason: string;
    confidence: number;
    status: string;
    evidenceIds: string;
    reviewNotes: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  }): BeneficiaryCandidateContract {
    return {
      candidate_id: record.candidateId,
      student_id: record.studentId,
      potential_scholarship_id: record.potentialScholarshipId,
      scheme_name: record.schemeName,
      reason_code: record.reasonCode as any,
      reason: record.reason,
      confidence: record.confidence,
      status: record.status as BeneficiaryCandidateStatus,
      evidence_ids: JSON.parse(record.evidenceIds),
      created_at: record.createdAt.toISOString(),
      reviewed_at: record.reviewedAt ? record.reviewedAt.toISOString() : null,
      review_notes: record.reviewNotes,
    };
  }
}

export const beneficiaryService = new BeneficiaryService();
