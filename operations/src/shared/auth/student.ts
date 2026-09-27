import { NextRequest } from "next/server";
import { authenticate } from "./rbac";
import { AppError } from "@/shared/errors/AppError";

export function authenticateStudent(req: NextRequest): string {
  const user = authenticate(req);
  if (user.role !== "STUDENT") {
    throw new AppError("FORBIDDEN", "Student credentials are required for this resource.", 403);
  }
  return user.sub;
}

export function assertStudentMatch(req: NextRequest, requestedStudentId?: string | null): string {
  const studentId = authenticateStudent(req);
  if (requestedStudentId && requestedStudentId !== studentId) {
    throw new AppError("FORBIDDEN", "A student account may only access its own data.", 403);
  }
  return studentId;
}
