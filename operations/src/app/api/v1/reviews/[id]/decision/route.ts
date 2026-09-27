import { NextRequest } from "next/server";
import { reviewService } from "@/modules/reviews/ReviewService";
import { applicationService } from "@/modules/applications/ApplicationService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticateAndAuthorize } from "@/shared/auth/rbac";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = authenticateAndAuthorize(req, ["REVIEWER", "ADMIN", "SUPER_ADMIN"]);
    const body = await req.json();
    const decision = body.decision; // APPROVE, REJECT, REQUEST_CORRECTION, REQUEST_CLARIFICATION, ESCALATE
    const reason = body.reason || "Review decision confirmed.";
    const reviewerId = body.reviewerId || user.sub;

    const updatedReview = await reviewService.makeDecision(params.id, decision, reason, reviewerId);

    // Apply workflow consequence to application
    if (decision === "APPROVE") {
      await applicationService.verifyApplication(updatedReview.application_id, reviewerId, reason);
    } else if (decision === "REJECT") {
      await applicationService.rejectApplication(updatedReview.application_id, reason, reviewerId);
    }

    return handleApiSuccess(updatedReview, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
