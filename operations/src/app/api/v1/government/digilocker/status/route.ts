import { NextRequest } from "next/server";
import { digiLockerService } from "@/modules/government/DigiLockerService";
import { authenticate } from "@/shared/auth/rbac";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function GET(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (user.role !== "STUDENT") throw new Error("Only student sessions may read DigiLocker connection status.");
    return handleApiSuccess(await digiLockerService.connectionStatus(user.sub), req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
