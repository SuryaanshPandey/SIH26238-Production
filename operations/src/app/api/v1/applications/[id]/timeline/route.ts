import { NextRequest } from "next/server";
import { auditService } from "@/modules/audit/AuditService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const timeline = await auditService.getTimelineByApplication(params.id);
    return handleApiSuccess(timeline, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
