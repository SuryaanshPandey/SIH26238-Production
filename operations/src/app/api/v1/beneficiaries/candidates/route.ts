import { NextRequest } from "next/server";
import { beneficiaryService } from "@/modules/beneficiaries/BeneficiaryService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const candidates = await beneficiaryService.listCandidates({ status });
    return handleApiSuccess(candidates, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
