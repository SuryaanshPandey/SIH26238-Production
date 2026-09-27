import { NextRequest } from "next/server";
import { deficiencyService } from "@/modules/deficiencies/DeficiencyService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticate } from "@/shared/auth/rbac";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const user = authenticate(req);
    const note = body.note || "Deficiency resolved with updated document submission.";
    const actorId = user.sub;
    const updated = await deficiencyService.resolveDeficiency(
      params.id,
      note,
      actorId,
      user.role === "STUDENT" ? user.sub : undefined
    );
    return handleApiSuccess(updated, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
