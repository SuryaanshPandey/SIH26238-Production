import { NextRequest } from "next/server";
import { beneficiaryService } from "@/modules/beneficiaries/BeneficiaryService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticateAndAuthorize } from "@/shared/auth/rbac";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = authenticateAndAuthorize(req, ["REVIEWER", "SCHOLARSHIP_OFFICER", "ADMIN", "SUPER_ADMIN"]);
    const body = await req.json();
    const action = body.action || "CONFIRM";
    const reviewNotes = body.reviewNotes || "Reviewed by tribal outreach officer.";
    const officerId = body.officerId || user.sub;

    const updated = await beneficiaryService.reviewCandidate(params.id, action, reviewNotes, officerId);
    return handleApiSuccess(updated, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
