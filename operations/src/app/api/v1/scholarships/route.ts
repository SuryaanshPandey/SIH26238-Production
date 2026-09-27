import { NextRequest } from "next/server";
import { scholarshipService } from "@/modules/scholarships/ScholarshipService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticateAndAuthorize } from "@/shared/auth/rbac";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const schemeType = searchParams.get("schemeType") || undefined;
    const academicYear = searchParams.get("academicYear") || undefined;

    const list = await scholarshipService.listScholarships({ status, schemeType, academicYear });
    return handleApiSuccess(list, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function POST(req: NextRequest) {
  try {
    authenticateAndAuthorize(req, ["ADMIN", "SUPER_ADMIN", "SCHOLARSHIP_OFFICER"]);
    const body = await req.json();
    const created = await scholarshipService.createScholarship(body);
    return handleApiSuccess(created, req, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}
