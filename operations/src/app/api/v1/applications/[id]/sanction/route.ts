import { NextRequest } from "next/server";
import { sanctionService } from "@/modules/sanctions/SanctionService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticateAndAuthorize } from "@/shared/auth/rbac";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const record = await sanctionService.getSanctionByApplication(params.id);
    return handleApiSuccess(record, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = authenticateAndAuthorize(req, ["FINANCE_OFFICER", "ADMIN", "SUPER_ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const amount = body.amount;
    const actorId = body.actorId || user.sub;
    const created = await sanctionService.issueSanction(params.id, amount, actorId);
    return handleApiSuccess(created, req, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}
