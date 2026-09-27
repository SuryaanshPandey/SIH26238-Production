import { NextRequest } from "next/server";
import { digiLockerService } from "@/modules/government/DigiLockerService";
import { authenticate } from "@/shared/auth/rbac";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";

export async function POST(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (user.role !== "STUDENT") throw new Error("Only student sessions may disconnect DigiLocker.");
    await digiLockerService.disconnect(user.sub);
    return handleApiSuccess({ disconnected: true }, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
