import { NextRequest, NextResponse } from "next/server";
import { notificationService } from "@/modules/notifications/NotificationService";
import {
  handleApiSuccess,
  handleApiError,
} from "@/shared/api/handler";
import { assertStudentMatch } from "@/shared/auth/student";
import {
  addCorsHeaders,
  createCorsPreflightResponse,
} from "@/shared/api/cors";

export async function OPTIONS(
  req: NextRequest,
) {
  return createCorsPreflightResponse(
    req,
  );
}

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: {
      studentId: string;
    };
  },
) {
  try {
    const studentId =
      assertStudentMatch(
        req,
        params.studentId,
      );

    const list =
      await notificationService.getNotificationsByStudent(
        studentId,
      );

    const response =
      handleApiSuccess(
        list,
        req,
      );

    return addCorsHeaders(
      req,
      response,
    );
  } catch (err) {
    const response =
      handleApiError(
        err,
        req,
      );

    return addCorsHeaders(
      req,
      response,
    );
  }
}
