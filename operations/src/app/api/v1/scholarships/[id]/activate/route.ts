import { NextRequest } from "next/server";
import { scholarshipService } from "@/modules/scholarships/ScholarshipService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticateAndAuthorize } from "@/shared/auth/rbac";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    authenticateAndAuthorize(req, ["ADMIN", "SUPER_ADMIN", "SCHOLARSHIP_OFFICER"]);
    const updated = await scholarshipService.activateScholarship(params.id);
    return handleApiSuccess(updated, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
