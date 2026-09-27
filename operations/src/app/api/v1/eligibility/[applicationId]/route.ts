import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { AppError } from "@/shared/errors/AppError";

export async function GET(req: NextRequest, { params }: { params: { applicationId: string } }) {
  try {
    const evaluation = await prisma.eligibilityEvaluation.findFirst({
      where: { applicationId: params.applicationId },
      include: { ruleResults: true },
      orderBy: { evaluatedAt: "desc" },
    });

    if (!evaluation) {
      throw AppError.notFound("Eligibility evaluation for application", params.applicationId);
    }

    const data = {
      evaluation_id: evaluation.evaluationId,
      application_id: evaluation.applicationId,
      scholarship_id: evaluation.scholarshipId,
      rule_version: evaluation.ruleVersion,
      result: evaluation.result,
      confidence: evaluation.confidence,
      reasons: JSON.parse(evaluation.reasons),
      failed_rules: JSON.parse(evaluation.failedRules),
      missing_information: JSON.parse(evaluation.missingInformation),
      verification_dependencies: JSON.parse(evaluation.verificationDependencies),
      rule_results: evaluation.ruleResults.map((r) => ({
        rule_code: r.ruleCode,
        status: r.status,
        passed: r.passed,
        reason: r.reason,
        evidence_refs: JSON.parse(r.evidenceRefs),
      })),
      evaluated_at: evaluation.evaluatedAt.toISOString(),
    };

    return handleApiSuccess(data, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
