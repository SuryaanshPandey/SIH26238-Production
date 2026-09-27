import { prisma } from "@/lib/prisma";
import { StudentContract } from "@contracts/v1/types";
import { StudentClient } from "./StudentClient";

function maskMobile(value: string): string {
  return value.length >= 4 ? `XXXXXX${value.slice(-4)}` : "XXXXXX";
}

function mapStudent(record: any): StudentContract {
  return {
    student_id: record.studentId,
    first_name: record.firstName,
    last_name: record.lastName,
    date_of_birth: new Date(record.dateOfBirth).toISOString().slice(0, 10),
    gender: record.gender,
    category: record.category,
    sub_caste_tribe: record.subTribe,
    annual_family_income: Number(record.annualFamilyIncome),
    domicile_state: record.state,
    domicile_district: record.district,
    masked_aadhaar: record.maskedAadhaar || "NOT_AVAILABLE",
    email: record.email || "",
    mobile_masked: maskMobile(record.mobileNumber),
    institution_id: record.institutionId || "",
    institution_name: record.institutionName || "",
    education_level: record.educationLevel,
    course_name: record.courseName,
    current_academic_year: record.currentAcademicYear,
    bank_account_masked: record.bankAccountMasked || "NOT_AVAILABLE",
    bank_ifsc: record.bankIfsc || "",
  };
}

export class DatabaseStudentClient implements StudentClient {
  async getStudentById(studentId: string): Promise<StudentContract | null> {
    const record = await prisma.studentAccount.findUnique({ where: { studentId } });
    return record ? mapStudent(record) : null;
  }

  async searchStudents(query?: { category?: string; state?: string; educationLevel?: string }): Promise<StudentContract[]> {
    const records = await prisma.studentAccount.findMany({
      where: {
        ...(query?.category ? { category: query.category } : {}),
        ...(query?.state ? { state: query.state } : {}),
        ...(query?.educationLevel ? { educationLevel: query.educationLevel } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    return records.map(mapStudent);
  }
}

export const databaseStudentClient = new DatabaseStudentClient();
