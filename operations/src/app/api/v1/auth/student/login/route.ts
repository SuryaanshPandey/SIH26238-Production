import { NextRequest } from "next/server";
import { studentAuthService } from "@/modules/auth/StudentAuthService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await studentAuthService.login(String(body.identifier || ""), String(body.password || ""));
    return handleApiSuccess(result, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
