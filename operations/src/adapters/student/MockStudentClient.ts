import { StudentClient } from "./StudentClient";
import { StudentContract } from "@contracts/v1/types";

export class MockStudentClient implements StudentClient {
  private students: Map<string, StudentContract> = new Map();

  constructor() {
    this.seedDefaultStudents();
  }

  private seedDefaultStudents() {
    const list: StudentContract[] = [
      {
        student_id: "STU-2026-JH-88391",
        first_name: "Asha",
        last_name: "Kumar",
        date_of_birth: "2005-07-14",
        gender: "FEMALE",
        category: "ST",
        sub_caste_tribe: "Santhal",
        annual_family_income: 180000,
        domicile_state: "Jharkhand",
        domicile_district: "Ranchi",
        masked_aadhaar: "XXXX-XXXX-8921",
        email: "asha.kumar@example.edu.in",
        mobile_masked: "XXXXXX2210",
        institution_id: "INST-JH-00412",
        institution_name: "Birsa Institute of Technology (BIT) Sindri",
        education_level: "UNDERGRADUATE",
        course_name: "B.Tech Computer Science",
        current_academic_year: "2026-2027",
        bank_account_masked: "XXXXXXXX4512",
        bank_ifsc: "SBIN0000412",
      },
      {
        student_id: "stu_demo_001",
        first_name: "Birsa",
        last_name: "Munda",
        date_of_birth: "2005-04-12",
        gender: "MALE",
        category: "ST",
        sub_caste_tribe: "Munda",
        annual_family_income: 180000,
        domicile_state: "Jharkhand",
        domicile_district: "Ranchi",
        masked_aadhaar: "XXXX-XXXX-8921",
        email: "birsa.munda@example.edu.in",
        mobile_masked: "XXXXXX4512",
        institution_id: "inst_ranchi_univ_01",
        institution_name: "Ranchi University Campus",
        education_level: "UNDERGRADUATE",
        course_name: "B.Sc Forestry & Sustainable Living",
        current_academic_year: "2026-2027",
        bank_account_masked: "XXXXXXXX9832",
        bank_ifsc: "SBIN0000123",
      },
      {
        student_id: "stu_demo_002",
        first_name: "Rani",
        last_name: "Gaidinliu",
        date_of_birth: "2007-02-14",
        gender: "FEMALE",
        category: "ST",
        sub_caste_tribe: "Rongmei",
        annual_family_income: 120000,
        domicile_state: "Manipur",
        domicile_district: "Tamenglong",
        masked_aadhaar: "XXXX-XXXX-7721",
        email: "rani.g@example.edu.in",
        mobile_masked: "XXXXXX8811",
        institution_id: "inst_manipur_high_02",
        institution_name: "Tamenglong Higher Secondary",
        education_level: "CLASS_10",
        course_name: "Matriculation (Secondary)",
        current_academic_year: "2026-2027",
        bank_account_masked: "XXXXXXXX4411",
        bank_ifsc: "SBIN0000456",
      },
      {
        student_id: "stu_demo_high_income",
        first_name: "Arjun",
        last_name: "Gond",
        date_of_birth: "2004-11-05",
        gender: "MALE",
        category: "ST",
        sub_caste_tribe: "Gond",
        annual_family_income: 650000, // Exceeds 2.5L threshold
        domicile_state: "Madhya Pradesh",
        domicile_district: "Mandla",
        masked_aadhaar: "XXXX-XXXX-1992",
        email: "arjun.gond@example.edu.in",
        mobile_masked: "XXXXXX9012",
        institution_id: "inst_bhopal_tech_01",
        institution_name: "MANIT Bhopal",
        education_level: "UNDERGRADUATE",
        course_name: "B.Tech Computer Science",
        current_academic_year: "2026-2027",
        bank_account_masked: "XXXXXXXX3399",
        bank_ifsc: "PUNB0001122",
      },
      {
        student_id: "stu_demo_non_st",
        first_name: "Rahul",
        last_name: "Sharma",
        date_of_birth: "2005-09-18",
        gender: "MALE",
        category: "GENERAL",
        sub_caste_tribe: null,
        annual_family_income: 150000,
        domicile_state: "Delhi",
        domicile_district: "North Delhi",
        masked_aadhaar: "XXXX-XXXX-4433",
        email: "rahul.sharma@example.edu.in",
        mobile_masked: "XXXXXX1122",
        institution_id: "inst_du_01",
        institution_name: "Delhi University",
        education_level: "UNDERGRADUATE",
        course_name: "B.Com Honours",
        current_academic_year: "2026-2027",
        bank_account_masked: "XXXXXXXX6677",
        bank_ifsc: "HDFC0000123",
      },
      {
        student_id: "stu_demo_incomplete",
        first_name: "Somra",
        last_name: "Oraon",
        date_of_birth: "2006-08-20",
        gender: "MALE",
        category: "ST",
        sub_caste_tribe: null,
        annual_family_income: 320000,
        domicile_state: "Odisha",
        domicile_district: null,
        masked_aadhaar: "XXXX-XXXX-3344",
        email: "somra.oraon@example.edu.in",
        mobile_masked: "XXXXXX9988",
        institution_id: "",
        institution_name: "",
        education_level: "CLASS_12",
        course_name: "",
        current_academic_year: "2026-2027",
        bank_account_masked: "XXXXXXXX1122",
        bank_ifsc: "PUNB0123400",
      },
    ];

    list.forEach((s) => this.students.set(s.student_id, s));
  }

  async getStudentById(studentId: string): Promise<StudentContract | null> {
    return this.students.get(studentId) || null;
  }

  async searchStudents(query?: { category?: string; state?: string; educationLevel?: string }): Promise<StudentContract[]> {
    let result = Array.from(this.students.values());
    if (query?.category) {
      result = result.filter((s) => s.category === query.category);
    }
    if (query?.state) {
      result = result.filter((s) => s.domicile_state === query.state);
    }
    if (query?.educationLevel) {
      result = result.filter((s) => s.education_level === query.educationLevel);
    }
    return result;
  }
}

export const mockStudentClient = new MockStudentClient();
