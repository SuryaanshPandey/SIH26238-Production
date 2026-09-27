import { NextRequest } from "next/server";
import { paymentService } from "@/modules/payments/PaymentService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { AppError } from "@/shared/errors/AppError";

export async function POST(req: NextRequest) {
  try {
    if (process.env.REAL_DATA_MODE !== "false") {
      return handleApiError(new AppError("PAYMENT_PROVIDER_UNAVAILABLE", "Mock payment webhook is disabled in real-data mode.", 503), req);
    }
    const body = await req.json();
    const result = await paymentService.handleWebhook(body);
    return handleApiSuccess(result, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
