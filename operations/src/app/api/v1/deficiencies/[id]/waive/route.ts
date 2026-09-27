import { NextRequest } from "next/server";
import { deficiencyService } from "@/modules/deficiencies/DeficiencyService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || "Discretionary officer waiver applied under state hardship rule.";
    const reviewerId = body.reviewerId || "REVIEW_DESK_OFFICER";
    const updated = await deficiencyService.waiveDeficiency(params.id, reason, reviewerId);
    return handleApiSuccess(updated, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
