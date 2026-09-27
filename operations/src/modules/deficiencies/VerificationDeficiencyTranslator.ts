import { DeficiencyType, RequiredAction, VerificationContract } from "@contracts/v1/types";
import { deficiencyService } from "./DeficiencyService";

export interface TranslationResult {
  hasDeficienciesCreated: boolean;
  requiresAction: boolean;
  requiresManualReview: boolean;
  createdDeficiencyIds: string[];
}

export class VerificationDeficiencyTranslator {
  async processVerifications(
    applicationId: string,
    verifications: VerificationContract[]
  ): Promise<TranslationResult> {
    const createdDeficiencyIds: string[] = [];
    let requiresAction = false;
    let requiresManualReview = false;

    for (const v of verifications) {
      if (v.status === "MISMATCH") {
        requiresAction = true;
        let title = `Discrepancy in ${v.attribute_name}`;
        let description = v.verification_notes || `Mismatch detected in ${v.attribute_name} verification.`;
        let reqAction: RequiredAction = "REUPLOAD_DOCUMENT";
        let type: DeficiencyType = "DATA_MISMATCH";

        if (v.attribute_name === "CASTE_ST") {
          title = "ST Caste Certificate Verification Discrepancy";
          type = "IDENTITY_MISMATCH";
          reqAction = "CLARIFICATION";
        } else if (v.attribute_name === "INCOME_THRESHOLD") {
          title = "Annual Income Verification Discrepancy";
          type = "DATA_MISMATCH";
          reqAction = "REUPLOAD_DOCUMENT";
        } else if (v.attribute_name === "INSTITUTION_ENROLLMENT") {
          title = "Institution Enrollment Unverified";
          type = "INSTITUTION_VERIFICATION_PENDING";
          reqAction = "CONTACT_INSTITUTION";
        }

        const def = await deficiencyService.createDeficiency({
          applicationId,
          type,
          title,
          description,
          severity: "HIGH",
          requiredAction: reqAction,
          dueDays: 15,
        });
        createdDeficiencyIds.push(def.deficiency_id);
      } else if (v.status === "SOURCE_UNAVAILABLE") {
        requiresManualReview = true;
        const def = await deficiencyService.createDeficiency({
          applicationId,
          type: "SOURCE_UNAVAILABLE",
          title: `Verification Source Temporarily Unavailable (${v.source_system})`,
          description: `Upstream service ${v.source_system} could not be reached. Desk verification or automatic retry scheduled.`,
          severity: "MEDIUM",
          requiredAction: "WAIT_FOR_VERIFICATION",
          dueDays: 7,
        });
        createdDeficiencyIds.push(def.deficiency_id);
      } else if (v.status === "PARTIAL_MATCH" || v.status === "PENDING_REVIEW") {
        requiresManualReview = true;
      }
    }

    return {
      hasDeficienciesCreated: createdDeficiencyIds.length > 0,
      requiresAction,
      requiresManualReview,
      createdDeficiencyIds,
    };
  }
}

export const verificationDeficiencyTranslator = new VerificationDeficiencyTranslator();
