import { NextRequest } from "next/server";
import { paymentService } from "@/modules/payments/PaymentService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const record = await paymentService.getPaymentByApplication(params.id);
    return handleApiSuccess(record, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
