import { NextRequest } from "next/server";
import { applicationService } from "@/modules/applications/ApplicationService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const scenario = body.scenario || "MATCH";
    const result = await applicationService.startVerification(params.id, scenario);
    return handleApiSuccess(result, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
