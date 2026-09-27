import { NextRequest } from "next/server";
import { studentAuthService } from "@/modules/auth/StudentAuthService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await studentAuthService.register(body);
    return handleApiSuccess(result, req, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}
