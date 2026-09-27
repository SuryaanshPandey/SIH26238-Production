import { NextRequest } from "next/server";
import { applicationService } from "@/modules/applications/ApplicationService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || "Application does not meet mandatory scheme guidelines.";
    const actorId = body.actorId || "DESK_OFFICER";
    const updated = await applicationService.rejectApplication(params.id, reason, actorId);
    return handleApiSuccess(updated, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
