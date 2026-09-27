import { NextRequest } from "next/server";
import { notificationService } from "@/modules/notifications/NotificationService";
import { handleApiSuccess, handleApiError } from "@/shared/api/handler";
import { assertStudentMatch } from "@/shared/auth/student";

export async function GET(req: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const studentId = assertStudentMatch(req, params.studentId);
    const list = await notificationService.getNotificationsByStudent(studentId);
    return handleApiSuccess(list, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
