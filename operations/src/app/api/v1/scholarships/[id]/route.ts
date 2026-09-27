import { NextRequest } from "next/server";
import { scholarshipService } from "@/modules/scholarships/ScholarshipService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { AppError } from "@/shared/errors/AppError";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const scholarship = await scholarshipService.getScholarship(params.id);
    if (!scholarship) {
      throw AppError.notFound("Scholarship", params.id);
    }
    return handleApiSuccess(scholarship, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
