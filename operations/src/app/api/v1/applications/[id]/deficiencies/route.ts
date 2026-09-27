import { NextRequest } from "next/server";
import { deficiencyService } from "@/modules/deficiencies/DeficiencyService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const list = await deficiencyService.listDeficiencies(params.id);
    return handleApiSuccess(list, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const created = await deficiencyService.createDeficiency({
      applicationId: params.id,
      type: body.type,
      title: body.title,
      description: body.description,
      severity: body.severity || "MEDIUM",
      requiredAction: body.requiredAction || "REUPLOAD_DOCUMENT",
      dueDays: body.dueDays || 15,
      actorId: body.actorId,
    });
    return handleApiSuccess(created, req, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}
