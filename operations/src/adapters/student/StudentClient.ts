import { StudentContract } from "@contracts/v1/types";

export interface StudentClient {
  getStudentById(studentId: string): Promise<StudentContract | null>;
  searchStudents(query?: { category?: string; state?: string; educationLevel?: string }): Promise<StudentContract[]>;
}
