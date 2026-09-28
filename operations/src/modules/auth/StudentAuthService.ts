import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/shared/auth/jwt";
import { AppError } from "@/shared/errors/AppError";
import { referenceDataService } from "@/modules/reference/ReferenceDataService";

function normalizeMobile(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits.slice(2);
  return digits;
}

function normalizeEmail(input?: string | null): string | null {
  const value = input?.trim().toLowerCase();
  return value ? value : null;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

function studentId(): string {
  return `STU-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function currentAcademicYear(date = new Date()): string {
  const year = date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${year}-${year + 1}`;
}


function mapProfile(record: any) {
  const fullName = `${record.firstName} ${record.lastName}`.trim();
  return {
    student_id: record.studentId,
    full_name: fullName,
    dob: new Date(record.dateOfBirth).toISOString().slice(0, 10),
    gender: record.gender,
    category: record.category,
    sub_tribe: record.subTribe || undefined,
    contact: {
      phone_masked: `XXXXXX${record.mobileNumber.slice(-4)}`,
      email_masked: record.email ? record.email.replace(/^(.).+(@.*)$/, "$1***$2") : "NOT_PROVIDED",
    },
    location: {
      state: record.state,
      state_lgd_code: record.stateLgdCode || undefined,
      district: record.district,
      district_lgd_code: record.districtLgdCode || undefined,
      pincode: record.pincode,
      address_masked: `${record.district}, ${record.state}`,
    },
    education: {
      institution_id: record.institutionId,
      institution_name: record.institutionName,
      institution_source: record.institutionSourceSystem ? {
        system: record.institutionSourceSystem,
        reference: record.institutionSourceReference || undefined,
        url: record.institutionSourceUrl || undefined,
      } : undefined,
      stage: record.educationLevel,
      course: record.courseName,
      current_year_or_semester: "",
      academic_year: record.currentAcademicYear,
      roll_no_masked: "NOT_PROVIDED",
      aishe_code: (record.institutionSourceSystem === "AISHE" || record.institutionSourceSystem === "UBA") && /^([CUS]-\d+)$/i.test(record.institutionId || "")
        ? record.institutionId
        : undefined,
      is_hosteller: false,
    },
    identifier_refs: {
      apaar_token: record.apaarToken || "NOT_CONNECTED",
      digilocker_id_masked: record.digilockerIdMasked || "NOT_CONNECTED",
      masked_aadhaar_last4: record.maskedAadhaar ? record.maskedAadhaar.slice(-4) : "NOT_AVAILABLE",
    },
    profile_status: "PENDING_VERIFICATION" as const,
    annual_family_income: Number(record.annualFamilyIncome),
    has_active_scholarship: false,
  };
}

export class StudentAuthService {
  async register(input: any) {
    const mobile = normalizeMobile(input.mobileNumber);
    const email = normalizeEmail(input.email);
    if (!/^[6-9]\d{9}$/.test(mobile)) throw AppError.invalidRequest("Enter a valid 10-digit Indian mobile number.");
    if (!input.password || input.password.length < 8) throw AppError.invalidRequest("Password must be at least 8 characters long.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dob)) throw AppError.invalidRequest("Date of birth must be YYYY-MM-DD.");

    const state = String(input.state || "").trim();
    const district = String(input.district || "").trim();
    const pincode = String(input.pincode || "").trim();

    if (!state || !district) {
      throw AppError.invalidRequest("State and district are required.");
    }

    // The browser only offers directory-backed pincodes, but the API must
    // enforce the same rule because client validation can be bypassed.
    await referenceDataService.validatePincode(state, district, pincode);

    const mobileExists = await prisma.studentAccount.findUnique({ where: { mobileNumber: mobile } });
    if (mobileExists) throw AppError.conflict("A student account already exists for this mobile number.");
    if (email) {
      const emailExists = await prisma.studentAccount.findUnique({ where: { email } });
      if (emailExists) throw AppError.conflict("A student account already exists for this email address.");
    }

    const fullName = String(input.fullName).trim().replace(/\s+/g, " ");
    const parts = fullName.split(" ");
    const firstName = parts.shift() || fullName;
    const lastName = parts.join(" ");

    let record: any;
    try {
      record = await prisma.studentAccount.create({
        data: {
          studentId: studentId(),
          mobileNumber: mobile,
          email,
          passwordHash: hashPassword(input.password),
          firstName,
          lastName,
          dateOfBirth: new Date(`${input.dob}T00:00:00.000Z`),
          gender: input.gender,
          category: input.category,
          subTribe: input.subTribe || null,
          annualFamilyIncome: Number(input.annualIncome),
          state,
          stateLgdCode: input.stateCode || null,
          district,
          districtLgdCode: input.districtCode || null,
          pincode,
          institutionId: input.institutionId || "",
          institutionName: input.institutionName,
          institutionSourceSystem: input.institutionSourceSystem || null,
          institutionSourceReference: input.institutionSourceReference || null,
          institutionSourceUrl: input.institutionSourceUrl || null,
          educationLevel: input.stage,
          courseName: input.course,
          currentAcademicYear: input.currentAcademicYear || currentAcademicYear(),
        },
      });
    } catch (error) {
      // The pre-check above improves the normal path, while this handles the
      // race where another registration creates the same unique mobile/email
      // between the pre-check and INSERT. Never leak a Prisma 500 for a
      // duplicate registration.
      if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002") {
        const target = "meta" in error && Array.isArray((error as { meta?: { target?: unknown } }).meta?.target)
          ? ((error as { meta?: { target?: unknown[] } }).meta?.target || [])
          : [];
        const duplicateField = target.includes("email") ? "email address" : "mobile number";
        throw AppError.conflict(`A student account already exists for this ${duplicateField}.`);
      }
      throw error;
    }

    return this.issueSession(record);
  }

  async login(identifier: string, password: string) {
    const normalized = normalizeMobile(identifier);
    const email = normalizeEmail(identifier);
    const record = /^[6-9]\d{9}$/.test(normalized)
      ? await prisma.studentAccount.findUnique({ where: { mobileNumber: normalized } })
      : email
        ? await prisma.studentAccount.findFirst({ where: { email } })
        : await prisma.studentAccount.findUnique({ where: { studentId: identifier.trim() } });

    if (!record || !verifyPassword(password, record.passwordHash)) {
      throw AppError.unauthorized("Invalid student credentials.");
    }
    return this.issueSession(record);
  }

  async getProfile(studentId: string) {
    const record = await prisma.studentAccount.findUnique({ where: { studentId } });
    if (!record) throw AppError.notFound("Student", studentId);
    return mapProfile(record);
  }

  async updateProfile(studentId: string, input: any) {
    const existing = await prisma.studentAccount.findUnique({ where: { studentId } });
    if (!existing) throw AppError.notFound("Student", studentId);
    const record = await prisma.studentAccount.update({
      where: { studentId },
      data: {
        ...(input.phone ? { mobileNumber: normalizeMobile(input.phone) } : {}),
        ...(input.email ? { email: normalizeEmail(input.email) } : {}),
        ...(input.location?.state ? { state: input.location.state } : {}),
        ...(input.location?.district ? { district: input.location.district } : {}),
        ...(input.location?.pincode ? { pincode: input.location.pincode } : {}),
      },
    });
    return mapProfile(record);
  }

  private issueSession(record: any) {
    const token = signToken({
      sub: record.studentId,
      role: "STUDENT",
      email: record.email || "",
      name: `${record.firstName} ${record.lastName}`.trim(),
    }, 60 * 60 * 8);
    return { access_token: token, token_type: "Bearer", expires_in: 60 * 60 * 8, student: mapProfile(record) };
  }
}

export const studentAuthService = new StudentAuthService();
