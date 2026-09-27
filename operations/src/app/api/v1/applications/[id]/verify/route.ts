import { NextRequest } from "next/server";
import { applicationService } from "@/modules/applications/ApplicationService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const reviewerId = body.reviewerId || "REVIEW_DESK_OFFICER";
    const notes = body.notes || "Approved by review desk";
    const updated = await applicationService.verifyApplication(params.id, reviewerId, notes);
    return handleApiSuccess(updated, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
