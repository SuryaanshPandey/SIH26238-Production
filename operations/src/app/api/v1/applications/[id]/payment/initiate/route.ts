import { NextRequest } from "next/server";
import { paymentService } from "@/modules/payments/PaymentService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticateAndAuthorize } from "@/shared/auth/rbac";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = authenticateAndAuthorize(req, ["FINANCE_OFFICER", "ADMIN", "SUPER_ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const actorId = body.actorId || user.sub;
    const record = await paymentService.initiatePayment({
      applicationId: params.id,
      actorId,
    });
    return handleApiSuccess(record, req, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}
