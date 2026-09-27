import { NextRequest } from "next/server";
import { beneficiaryService } from "@/modules/beneficiaries/BeneficiaryService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function POST(req: NextRequest) {
  try {
    const candidates = await beneficiaryService.generateCandidates();
    return handleApiSuccess(candidates, req, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}
