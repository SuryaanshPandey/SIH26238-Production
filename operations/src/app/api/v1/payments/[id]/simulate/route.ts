import { NextRequest } from "next/server";
import { paymentService } from "@/modules/payments/PaymentService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const status = body.status || "SUCCESS"; // PROCESSING, SUCCESS, FAILED, RETURNED
    const failureReason = body.failureReason;
    const result = await paymentService.simulatePayment(params.id, status, failureReason);
    return handleApiSuccess(result, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
