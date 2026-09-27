import { NextRequest } from "next/server";
import { reviewService } from "@/modules/reviews/ReviewService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const reviewerId = body.reviewerId;
    const updated = await reviewService.startReview(params.id, reviewerId);
    return handleApiSuccess(updated, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
