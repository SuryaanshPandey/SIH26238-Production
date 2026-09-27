import { NextRequest } from "next/server";
import { reviewService } from "@/modules/reviews/ReviewService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const severity = searchParams.get("severity") || undefined;
    const reviewer = searchParams.get("reviewer") || undefined;

    const list = await reviewService.listReviews({ status, severity, reviewer });
    return handleApiSuccess(list, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
