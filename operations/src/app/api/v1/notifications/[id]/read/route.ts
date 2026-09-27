import { NextRequest } from "next/server";
import { notificationService } from "@/modules/notifications/NotificationService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { authenticate } from "@/shared/auth/rbac";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = authenticate(req);
    // The notification service performs the final ownership check for students.
    await notificationService.markAsRead(params.id, user.role === "STUDENT" ? user.sub : undefined);
    return handleApiSuccess({ success: true, notificationId: params.id }, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
