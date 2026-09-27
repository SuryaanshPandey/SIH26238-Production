import { prisma } from "@/lib/prisma";
import { JagoAssistanceContract, JagoIntent, JagoAction, StudentContract } from "@contracts/v1/types";
import { databaseStudentClient } from "@/adapters/student/DatabaseStudentClient";

export interface JagoQueryParams {
  studentId: string;
  applicationId?: string;
  query: string;
  language?: "en" | "hi";
}

interface JagoHistoryContext {
  applicationId: string | null;
  intent: JagoIntent | null;
  query: string | null;
}

interface JagoContext {
  student: StudentContract | null;
  applications: any[];
  application: any | null;
  requestedApplicationDenied: boolean;
  studentAvailable: boolean;
  applicationsAvailable: boolean;
  previous: JagoHistoryContext | null;
}

const STATUS_CANONICAL: Record<string, string> = {
  draft: "DRAFT",
  submitted: "SUBMITTED",
  "under verification": "UNDER_VERIFICATION",
  verification: "UNDER_VERIFICATION",
  "under review": "UNDER_REVIEW",
  verified: "VERIFIED",
  sanctioned: "SANCTIONED",
  "payment processing": "PAYMENT_PROCESSING",
  paid: "PAID",
  "action required": "ACTION_REQUIRED",
  rejected: "REJECTED",
  withdrawn: "WITHDRAWN",
  cancelled: "CANCELLED",
};

const OUT_OF_SCOPE_PATTERNS = [
  "weather",
  "cricket",
  "football",
  "instagram",
  "youtube",
  "netflix",
  "recipe",
  "bitcoin",
  "stock market",
  "javascript",
  "python code",
  "train ticket",
  "flight booking",
  "movie recommendation",
  "delete account",
  "close my account",
  "reset password",
  "upi transfer",
  "shopping",
];

const PORTAL_SCOPE_PATTERNS = [
  "scholarship",
  "scholarships",
  "application",
  "applications",
  "document",
  "documents",
  "certificate",
  "upload",
  "verification",
  "verify",
  "eligibility",
  "eligible",
  "payment",
  "paisa",
  "paise",
  "pfms",
  "dbt",
  "sanction",
  "deficiency",
  "action required",
  "notification",
  "profile",
  "student id",
  "jago",
  "portal",
  "dashboard",
  "wallet",
  "छात्रवृत्ति",
  "आवेदन",
  "दस्तावेज",
  "प्रमाणपत्र",
  "अपलोड",
  "भुगतान",
  "सत्यापन",
  "पात्रता",
  "प्रोफ़ाइल",
];

const VAGUE_FOLLOWUP_PATTERNS = [
  "what about that",
  "what about this",
  "and this",
  "that one",
  "this one",
  "same one",
  "what now",
  "what next",
  "then what",
  "what should i do now",
  "what should i do next",
  "ab kya",
  "ab kya karu",
  "phir kya",
  "uska kya",
  "उसका क्या",
  "अब क्या",
  "अब क्या करूं",
  "फिर क्या",
];

function normalizeQuery(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(query: string, terms: string[]): boolean {
  return terms.some((term) => query.includes(normalizeQuery(term)));
}

function hasAll(query: string, terms: string[]): boolean {
  return terms.every((term) => query.includes(normalizeQuery(term)));
}

function isGreeting(query: string): boolean {
  return /^(hi|hello|hey|namaste|namaskar|good morning|good afternoon|good evening|hola|नमस्ते|नमस्कार)(?:\b|[!. ]|$)/i.test(query);
}

function isThankYou(query: string): boolean {
  return hasAny(query, ["thank you", "thanks", "thx", "धन्यवाद", "शुक्रिया"]);
}

function isVagueFollowup(query: string): boolean {
  return hasAny(query, VAGUE_FOLLOWUP_PATTERNS);
}

function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "₹—";
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

function humanizeStatus(status: string | null | undefined, hi = false): string {
  const value = String(status || "UNKNOWN");
  const mapEn: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    UNDER_VERIFICATION: "Under verification",
    UNDER_REVIEW: "Under review",
    VERIFIED: "Verified",
    SANCTIONED: "Sanctioned",
    PAYMENT_PROCESSING: "Payment processing",
    PAID: "Paid",
    ACTION_REQUIRED: "Action required",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
    CANCELLED: "Cancelled",
  };
  const mapHi: Record<string, string> = {
    DRAFT: "ड्राफ्ट",
    SUBMITTED: "जमा किया गया",
    UNDER_VERIFICATION: "सत्यापन में",
    UNDER_REVIEW: "समीक्षा में",
    VERIFIED: "सत्यापित",
    SANCTIONED: "सैंक्शन जारी",
    PAYMENT_PROCESSING: "भुगतान प्रक्रियाधीन",
    PAID: "भुगतान हो चुका है",
    ACTION_REQUIRED: "कार्रवाई आवश्यक",
    REJECTED: "अस्वीकृत",
    WITHDRAWN: "वापस लिया गया",
    CANCELLED: "रद्द",
  };
  return (hi ? mapHi : mapEn)[value] || value.replaceAll("_", " ");
}

function humanizePayment(status: string, hi = false): string {
  if (hi) {
    const map: Record<string, string> = {
      NOT_APPLICABLE: "लागू नहीं",
      NOT_INITIATED: "अभी शुरू नहीं हुआ",
      INITIATED: "आरंभ",
      PROCESSING: "प्रोसेसिंग में",
      SUCCESS: "सफल",
      FAILED: "विफल",
      RETURNED: "वापस लौटा",
      UNKNOWN: "अज्ञात",
    };
    return map[status] || status;
  }
  const map: Record<string, string> = {
    NOT_APPLICABLE: "not applicable",
    NOT_INITIATED: "not initiated",
    INITIATED: "initiated",
    PROCESSING: "processing",
    SUCCESS: "successful",
    FAILED: "failed",
    RETURNED: "returned",
    UNKNOWN: "unknown",
  };
  return map[status] || status.toLowerCase();
}

function documentTypeLabel(type: string, hi: boolean): string {
  if (!hi) {
    return String(type).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const map: Record<string, string> = {
    INCOME_CERTIFICATE: "आय प्रमाणपत्र",
    CASTE_CERTIFICATE: "जाति/जनजाति प्रमाणपत्र",
    DOMICILE_CERTIFICATE: "निवास प्रमाणपत्र",
    MARKSHEET: "मार्कशीट",
    FEE_RECEIPT: "फीस रसीद",
    BANK_PASSBOOK: "बैंक पासबुक",
    BONAFIDE_CERTIFICATE: "बोनाफाइड प्रमाणपत्र",
    ADMISSION_PROOF: "प्रवेश/नामांकन प्रमाण",
    HOSTEL_CERTIFICATE: "छात्रावास प्रमाणपत्र",
    SCHOOL_ID: "स्कूल आईडी",
    PHD_REGISTRATION: "पीएचडी पंजीकरण",
    UGC_NET_CERTIFICATE: "UGC-NET प्रमाणपत्र",
    SYNOPSIS: "सिनॉप्सिस",
    TOP_INSTITUTION_ADMISSION: "शीर्ष संस्थान प्रवेश प्रमाण",
    FOREIGN_UNIVERSITY_OFFER: "विदेशी विश्वविद्यालय ऑफर",
    PASSPORT: "पासपोर्ट",
  };
  return map[type] || String(type).replaceAll("_", " ");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function safeDate(value: unknown): number {
  if (!value) return 0;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * Keep JAGO responsive when an optional/slow local database operation is
 * blocked. The underlying Prisma promise may finish later, but the user-facing
 * request never waits indefinitely for it.
 */
const JAGO_UNAVAILABLE = Symbol("JAGO_UNAVAILABLE");

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch(() => {
      clearTimeout(timer);
      resolve(fallback);
    });
  });
}

function isOpenDeficiency(def: any): boolean {
  return ["OPEN", "ACTION_REQUIRED", "IN_REVIEW", "UNDER_REVIEW"].includes(String(def?.status || ""));
}

export class JagoService {
  async processQuery(params: JagoQueryParams): Promise<JagoAssistanceContract> {
    const query = params.query.trim();
    const lang = params.language || (/[\u0900-\u097F]/.test(query) ? "hi" : "en");
    const queryLower = normalizeQuery(query);

    // Conversation history is helpful, but it is never allowed to hold up the
    // primary JAGO request. The frontend already sends the active application
    // id on follow-up messages, so history is only a secondary context source.
    const previous = await withTimeout(
      this.getPreviousConversationContext(params.studentId),
      Number(process.env.JAGO_HISTORY_TIMEOUT_MS || 350),
      null,
    );

    const intent = this.classifyIntent(queryLower, previous);
    const effectiveApplicationId =
      params.applicationId || (isVagueFollowup(queryLower) ? previous?.applicationId || undefined : undefined);

    const context = await this.loadContext(
      params.studentId,
      effectiveApplicationId,
      queryLower,
      intent,
      previous,
    );

    const generated = await withTimeout(
      this.generateResponse(intent, query, queryLower, context, lang),
      Number(process.env.JAGO_RESPONSE_TIMEOUT_MS || 7000),
      {
        responseText: lang === "hi"
          ? "JAGO अभी आपके अनुरोध का रिकॉर्ड-आधारित जवाब पूरा नहीं कर पाया। मैंने कोई अनुमान नहीं लगाया है। कृपया फिर प्रयास करें या नीचे संबंधित स्क्रीन खोलें।"
          : "JAGO could not complete the record-backed answer within the response window. I did not guess. Please retry or use the relevant screen below.",
        sourceRefs: [],
        actions: [{ type: "NAVIGATE", label: lang === "hi" ? "JAGO सहायता" : "Open JAGO help", href: "/jago" }],
        followups: [lang === "hi" ? "मेरे सभी आवेदन दिखाओ" : "Show all my applications"],
      },
    );
    const assistanceId = `assist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // History is useful but operationally optional. Never make a student wait
    // for a SQLite write/lock before receiving a response.
    void prisma.jagoAssistance.create({
      data: {
        assistanceId,
        studentId: params.studentId,
        applicationId: context.application?.applicationId || effectiveApplicationId || null,
        query,
        intent,
        response: generated.responseText,
        language: lang,
        sourceRefs: JSON.stringify(generated.sourceRefs),
      },
    }).catch(() => {
      // Best-effort history persistence only.
    });

    return {
      assistance_id: assistanceId,
      student_id: params.studentId,
      application_id: context.application?.applicationId || effectiveApplicationId || null,
      query,
      intent,
      response: generated.responseText,
      language: lang,
      source_refs: generated.sourceRefs,
      generated_at: new Date().toISOString(),
      suggested_actions: generated.actions,
      suggested_followups: generated.followups,
    };
  }

  async getHistory(studentId: string, limit = 20): Promise<JagoAssistanceContract[]> {
    const records = await prisma.jagoAssistance.findMany({
      where: { studentId },
      orderBy: { generatedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 50),
    });

    return records.reverse().map((record) => ({
      assistance_id: record.assistanceId,
      student_id: record.studentId,
      application_id: record.applicationId,
      query: record.query,
      intent: this.safeIntent(record.intent),
      response: record.response,
      language: record.language === "hi" ? "hi" : "en",
      source_refs: this.parseSourceRefs(record.sourceRefs),
      generated_at: record.generatedAt.toISOString(),
    }));
  }

  private async getPreviousConversationContext(studentId: string): Promise<JagoHistoryContext | null> {
    if (!studentId) return null;
    try {
      const record = await prisma.jagoAssistance.findFirst({
        where: { studentId },
        orderBy: { generatedAt: "desc" },
        select: { applicationId: true, intent: true, query: true },
      });
      if (!record) return null;
      return {
        applicationId: record.applicationId,
        intent: this.safeIntentOrNull(record.intent),
        query: record.query,
      };
    } catch {
      return null;
    }
  }

  private safeIntent(value: string): JagoIntent {
    return this.safeIntentOrNull(value) || "GENERAL_ASSISTANCE";
  }

  private safeIntentOrNull(value: string | null | undefined): JagoIntent | null {
    const valid: JagoIntent[] = [
      "SCHOLARSHIP_DISCOVERY",
      "ELIGIBILITY",
      "APPLICATION_STATUS",
      "DOCUMENT_HELP",
      "DEFICIENCY",
      "VERIFICATION",
      "SANCTION",
      "PAYMENT",
      "PROFILE",
      "GENERAL_ASSISTANCE",
    ];
    return valid.includes(value as JagoIntent) ? (value as JagoIntent) : null;
  }

  private parseSourceRefs(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  private async loadContext(
    studentId: string,
    requestedApplicationId: string | undefined,
    query: string,
    intent: JagoIntent,
    previous: JagoHistoryContext | null,
  ): Promise<JagoContext> {
    const needsStudent = intent === "PROFILE" || intent === "ELIGIBILITY" || intent === "SCHOLARSHIP_DISCOVERY";
    const needsApplications =
      intent === "APPLICATION_STATUS" ||
      intent === "PAYMENT" ||
      intent === "SANCTION" ||
      intent === "DEFICIENCY" ||
      intent === "VERIFICATION" ||
      intent === "DOCUMENT_HELP" ||
      intent === "ELIGIBILITY" ||
      (intent === "SCHOLARSHIP_DISCOVERY" && hasAny(query, ["apply", "start application", "apply now", "आवेदन करें", "अप्लाई"]));

    const needsDeficiencies = ["APPLICATION_STATUS", "DEFICIENCY", "VERIFICATION", "DOCUMENT_HELP"].includes(intent);
    const needsPayment = intent === "PAYMENT";
    const needsSanction = intent === "SANCTION";
    const needsEvaluation = ["VERIFICATION", "ELIGIBILITY"].includes(intent);
    const needsHistory = intent === "APPLICATION_STATUS" && hasAny(query, ["why", "reason", "because", "क्यों", "कारण"]);

    const scholarshipSelect = {
      scholarshipId: true,
      schemeName: true,
      schemeCode: true,
      educationLevel: true,
      academicYear: true,
      status: true,
      requiredDocumentTypes: true,
      incomeCeiling: true,
      targetGroup: true,
      description: true,
      eligibilitySummary: true,
      applicationEndDate: true,
    };

    const applicationSelect: any = {
      applicationId: true,
      studentId: true,
      scholarshipId: true,
      academicYear: true,
      status: true,
      currentStage: true,
      submittedAt: true,
      updatedAt: true,
      createdAt: true,
      scholarship: { select: scholarshipSelect },
      ...(needsDeficiencies
        ? { deficiencies: { orderBy: { createdAt: "desc" }, take: 20 } }
        : {}),
      ...(needsPayment ? { payment: true } : {}),
      ...(needsSanction ? { sanction: true } : {}),
      ...(needsEvaluation
        ? { evaluations: { orderBy: { evaluatedAt: "desc" }, take: 1 } }
        : {}),
      ...(needsHistory
        ? { statusHistory: { orderBy: { createdAt: "desc" }, take: 10 } }
        : {}),
    };

    const studentPromise = needsStudent
      ? databaseStudentClient.getStudentById(studentId)
      : Promise.resolve(null);

    let applicationsPromise: Promise<any[]> = Promise.resolve([]);
    if (needsApplications || requestedApplicationId) {
      if (requestedApplicationId) {
        applicationsPromise = prisma.application
          .findFirst({
            where: { studentId, applicationId: requestedApplicationId },
            select: applicationSelect,
          })
          .then((row) => row ? [row] : []);
      } else {
        applicationsPromise = prisma.application.findMany({
          where: { studentId },
          select: applicationSelect,
          orderBy: [
            { submittedAt: "desc" },
            { updatedAt: "desc" },
            { createdAt: "desc" },
          ],
          take: 50,
        });
      }
    }

    const contextTimeout = Number(process.env.JAGO_CONTEXT_TIMEOUT_MS || 3500);
    const [studentResult, applicationsResult] = await Promise.all([
      withTimeout<StudentContract | null | typeof JAGO_UNAVAILABLE>(studentPromise, contextTimeout, JAGO_UNAVAILABLE),
      withTimeout<any[] | typeof JAGO_UNAVAILABLE>(applicationsPromise, contextTimeout, JAGO_UNAVAILABLE),
    ]);

    const studentAvailable = studentResult !== JAGO_UNAVAILABLE && Boolean(studentResult);
    const applicationsAvailable = applicationsResult !== JAGO_UNAVAILABLE;
    const student = studentResult === JAGO_UNAVAILABLE ? null : studentResult;
    const applications = applicationsResult === JAGO_UNAVAILABLE ? [] : applicationsResult;

    let application: any | null = null;
    let requestedApplicationDenied = false;

    if (requestedApplicationId) {
      application = applications[0] || null;
      // A timed-out lookup is not evidence that the application does not exist.
      requestedApplicationDenied = applicationsAvailable && !application;
    } else {
      application = this.selectRelevantApplication(applications, query, intent, previous);
    }

    return {
      student,
      applications,
      application,
      requestedApplicationDenied,
      studentAvailable,
      applicationsAvailable: requestedApplicationId ? applicationsAvailable : needsApplications ? applicationsAvailable : true,
      previous,
    };
  }

  private selectRelevantApplication(
    applications: any[],
    query: string,
    intent: JagoIntent,
    previous: JagoHistoryContext | null,
  ): any | null {
    if (!applications.length) return null;

    const explicit = applications.find((app) => query.includes(String(app.applicationId).toLowerCase()));
    if (explicit) return explicit;

    if (previous?.applicationId && isVagueFollowup(query)) {
      const contextual = applications.find((app) => app.applicationId === previous.applicationId);
      if (contextual) return contextual;
    }

    const schemeMatch = applications.find((app) => {
      const name = normalizeQuery(String(app.scholarship?.schemeName || ""));
      const code = normalizeQuery(String(app.scholarship?.schemeCode || ""));
      return (name && query.includes(name)) || (code && query.includes(code));
    });
    if (schemeMatch) return schemeMatch;

    const requestedStatus = Object.entries(STATUS_CANONICAL).find(([label]) => query.includes(label))?.[1];
    if (requestedStatus) {
      const matched = applications.find((app) => app.status === requestedStatus);
      if (matched) return matched;
    }

    if (intent === "DEFICIENCY") {
      const matched = applications.find((app) => (app.deficiencies || []).some(isOpenDeficiency));
      if (matched) return matched;
    }

    if (intent === "PAYMENT") {
      const withPayment = applications.filter((app) => app.payment);
      if (hasAny(query, ["paid", "credited", "jama", "received", "credited to bank"])) {
        const success = withPayment.find((app) => app.payment?.status === "SUCCESS");
        if (success) return success;
      }
      const processing = withPayment.find((app) => ["PROCESSING", "INITIATED"].includes(app.payment?.status));
      if (processing) return processing;
    }

    if (intent === "SANCTION") {
      const sanctioned = applications.find((app) => app.sanction);
      if (sanctioned) return sanctioned;
    }

    if (intent === "VERIFICATION") {
      const verification = applications.find((app) =>
        ["UNDER_VERIFICATION", "UNDER_REVIEW", "ACTION_REQUIRED"].includes(app.status) ||
        (app.evaluations || []).length > 0 ||
        (app.deficiencies || []).length > 0,
      );
      if (verification) return verification;
    }

    if (intent === "APPLICATION_STATUS" || intent === "ELIGIBILITY") {
      // For a singular ambiguous question, use the most recent application that
      // has not reached a terminal outcome. JAGO explicitly tells the user
      // which one it selected rather than silently implying certainty.
      const preferred = applications.find((app) =>
        ["ACTION_REQUIRED", "PAYMENT_PROCESSING", "UNDER_VERIFICATION", "UNDER_REVIEW", "SUBMITTED", "DRAFT", "VERIFIED", "SANCTIONED"].includes(app.status),
      );
      if (preferred) return preferred;
    }

    return applications.length === 1 ? applications[0] : null;
  }

  private classifyIntent(query: string, previous: JagoHistoryContext | null): JagoIntent {
    if (isGreeting(query) || isThankYou(query)) return "GENERAL_ASSISTANCE";

    const portalScope = hasAny(query, PORTAL_SCOPE_PATTERNS);
    const outOfScope = hasAny(query, OUT_OF_SCOPE_PATTERNS);
    if (outOfScope && !portalScope) return "GENERAL_ASSISTANCE";

    // Action words and explicit document questions have precedence over profile
    // questions. This prevents "which documents do I need?" or "caste certificate"
    // from being misread as "what is my caste?".
    if (hasAny(query, [
      "upload", "re-upload", "replace document", "replace my", "attach", "file upload", "dastavez upload", "दस्तावेज अपलोड", "अपलोड",
      "which documents", "what documents", "documents required", "required documents", "document required",
      "what certificate", "which certificate", "certificate required", "document list",
      "कौन से दस्तावेज", "कौनसे दस्तावेज", "कौन सा प्रमाणपत्र", "कौनसे प्रमाणपत्र", "जरूरी दस्तावेज", "आवश्यक दस्तावेज",
    ])) {
      return "DOCUMENT_HELP";
    }

    if (hasAny(query, [
      "payment", "pay", "money", "disburs", "credited", "credit", "paisa", "paise", "bhugtan", "dbt", "pfms", "jama", "भुगतान", "राशि",
    ])) {
      return "PAYMENT";
    }

    if (hasAny(query, [
      "sanction", "sanction order", "approval letter", "approved amount", "manjoor", "स्वीकृति", "सैंक्शन",
    ])) {
      return "SANCTION";
    }

    if (hasAny(query, [
      "deficien", "missing", "mismatch", "discrep", "problem with my application", "issue with my application", "error in my application", "rejected", "reject", "action required", "kami", "truti", "galti", "अंतर", "कमी", "त्रुटि",
    ])) {
      return "DEFICIENCY";
    }

    if (hasAny(query, [
      "verify", "verification", "verified", "source record", "digilocker verification", "caste mismatch", "income mismatch", "pramanit", "सत्यापन", "सत्यापित",
    ])) {
      return "VERIFICATION";
    }

    if (hasAny(query, [
      "eligib", "eligible", "qualify", "criteria", "who can apply", "can i get", "am i eligible", "can i apply", "should i apply", "income limit", "age limit", "yogyata", "patrata", "पात्र", "पात्रता",
    ])) {
      return "ELIGIBILITY";
    }

    if (hasAny(query, [
      "what is my caste", "my caste", "what caste am i", "my tribe", "what is my tribe", "my category", "what category am i",
      "my annual income", "what is my income", "family income", "my date of birth", "my dob", "where do i live", "my state", "my district",
      "my college", "my institution", "my course", "what do i study", "my student id", "who am i", "my profile", "my details", "personal details",
      "मेरी जाति", "मेरी जनजाति", "मेरी श्रेणी", "मेरी आय", "मेरा जन्म", "मेरा राज्य", "मेरा जिला", "मेरा कॉलेज", "मेरा कोर्स", "मेरी प्रोफ़ाइल", "मेरी जानकारी",
    ])) {
      return "PROFILE";
    }

    if (hasAny(query, [
      "status", "pending", "track", "tracking", "where is my application", "show my application", "show all my applications", "my applications", "application list",
      "application update", "any update", "latest update", "no update", "stuck", "stuck at", "not moving", "no progress", "what happened to my application", "what happened with my application",
      "is my application approved", "has my application been approved", "approved application", "kya hua", "kaha tak", "stithi", "स्थिति", "आवेदन कहाँ", "मेरे आवेदन", "सभी आवेदन", "pending application",
      "next step", "what should i do", "what do i do next", "what needs to be done", "अब क्या", "अगला कदम", "कोई अपडेट", "क्या अपडेट", "अटक",
    ])) {
      return "APPLICATION_STATUS";
    }

    if (hasAny(query, [
      "scholarship", "scholarships", "scheme", "yojana", "discover", "explore", "which scholarships", "what can i apply", "find scholarships", "available scholarships", "apply for scholarship",
      "how do i apply", "how to apply", "application process", "where can i apply", "start an application", "apply now", "apply",
      "छात्रवृत्ति", "योजना", "आवेदन कैसे", "आवेदन प्रक्रिया", "अप्लाई",
    ])) {
      return "SCHOLARSHIP_DISCOVERY";
    }

    // Conversation carry-over: concise follow-up messages should continue the
    // previous subject instead of resetting to a generic help message.
    if (isVagueFollowup(query) && previous?.intent && previous.intent !== "GENERAL_ASSISTANCE") {
      return previous.intent;
    }

    return "GENERAL_ASSISTANCE";
  }

  private async generateResponse(
    intent: JagoIntent,
    rawQuery: string,
    query: string,
    context: JagoContext,
    lang: "en" | "hi",
  ): Promise<{ responseText: string; sourceRefs: string[]; actions: JagoAction[]; followups: string[] }> {
    const sourceRefs = unique(context.application ? [context.application.applicationId] : []);
    const actions: JagoAction[] = [];
    const followups: string[] = [];
    const application = context.application;
    const applications = context.applications;
    const hi = lang === "hi";

    const addAction = (label: string, href: string) => {
      if (!actions.some((item) => item.href === href)) actions.push({ type: "NAVIGATE", label, href });
    };
    const addFollowup = (text: string) => {
      if (!followups.includes(text)) followups.push(text);
    };

    if (context.requestedApplicationDenied) {
      return {
        responseText: hi
          ? "मैं केवल आपके खाते से जुड़े आवेदन रिकॉर्ड दिखा सकता हूँ। यह application ID आपके खाते में उपलब्ध नहीं है, इसलिए मैं किसी दूसरे छात्र का रिकॉर्ड नहीं दिखाऊँगा।"
          : "I can only show application records belonging to your account. That application ID is not available in your account, so I won't expose another student's record.",
        sourceRefs: [],
        actions: [{ type: "NAVIGATE", label: hi ? "मेरे आवेदन खोलें" : "Open my applications", href: "/applications" }],
        followups: [hi ? "मेरे सभी आवेदन दिखाओ" : "Show all my applications"],
      };
    }

    if (isGreeting(query) || isThankYou(query)) {
      addAction(hi ? "मेरे आवेदन" : "My applications", "/applications");
      addAction(hi ? "छात्रवृत्तियाँ खोजें" : "Explore scholarships", "/scholarships");
      addAction(hi ? "दस्तावेज़ वॉलेट" : "Document wallet", "/documents");
      return {
        responseText: hi
          ? "नमस्ते! मैं JAGO हूँ। आप मुझे इस ऐप में कुछ ढूँढने, खोलने, समझने या करने के लिए बोल सकते हैं—जैसे आवेदन ट्रैक करना, छात्रवृत्ति खोजना, पात्रता समझना, दस्तावेज़ अपलोड शुरू करना या भुगतान देखना।"
          : "Namaste! I’m JAGO. Tell me what you want to find, open, understand, or do inside this app—track an application, discover a scholarship, check eligibility, start a document upload, or inspect a payment.",
        sourceRefs: [],
        actions,
        followups: [
          hi ? "मेरे सभी आवेदन दिखाओ" : "Show all my applications",
          hi ? "आय प्रमाणपत्र अपलोड करना है" : "I want to upload my income certificate",
          hi ? "मेरी छात्रवृत्ति पेमेंट कहाँ है?" : "Where is my scholarship payment?",
        ],
      };
    }

    if (this.isOutOfScope(query)) {
      return {
        responseText: hi
          ? "यह अनुरोध JAGO के छात्रवृत्ति ऐप के दायरे से बाहर है। मैं आपके आवेदन, छात्रवृत्तियाँ, पात्रता, दस्तावेज़, सत्यापन, सैंक्शन, भुगतान और ऐप के अंदर के workflows में मदद कर सकता हूँ। संबंधित काम हो तो सीधे बताइए कि क्या करना है।"
          : "That request is outside JAGO’s scholarship-app scope. I can help with your applications, scholarships, eligibility, documents, verification, sanctions, payments, and the workflows available inside this app. For anything else, I’ll tell you clearly instead of inventing an answer.",
        sourceRefs: [],
        actions: [{ type: "NAVIGATE", label: hi ? "JAGO सहायता" : "See JAGO help", href: "/jago" }],
        followups: [hi ? "मेरे आवेदन दिखाओ" : "Show my applications"],
      };
    }

    // Capability and global navigation questions can be answered without
    // personal data, which makes them resilient even during profile outages.
    if (this.isCapabilityQuestion(query)) {
      addAction(hi ? "डैशबोर्ड" : "Dashboard", "/dashboard");
      addAction(hi ? "मेरे आवेदन" : "My applications", "/applications");
      addAction(hi ? "दस्तावेज़" : "Documents", "/documents");
      addAction(hi ? "छात्रवृत्तियाँ" : "Scholarships", "/scholarships");
      addAction(hi ? "एक्शन सेंटर" : "Action Centre", "/actions");
      addAction(hi ? "सूचनाएँ" : "Notifications", "/notifications");
      addAction(hi ? "प्रोफ़ाइल" : "Profile", "/profile");
      return {
        responseText: hi
          ? "JAGO इस ऐप का conversational control layer है। आप बोलकर स्क्रीन खोल सकते हैं, अपनी छात्रवृत्तियाँ खोज सकते हैं, आवेदन/पेमेंट ट्रैक कर सकते हैं, पात्रता समझ सकते हैं, कमियाँ देख सकते हैं, दस्तावेज़ अपलोड शुरू कर सकते हैं और अपनी प्रोफ़ाइल/सूचनाएँ खोल सकते हैं। मैं संवेदनशील काम बिना आपके स्पष्ट कदम के submit, delete या बदलता नहीं हूँ।"
          : "JAGO acts as the app’s conversational control layer. You can ask it to open screens, find scholarships, track applications or payments, explain eligibility, inspect deficiencies, start document uploads, and open profile/notifications. I won’t silently submit, delete, or change sensitive data on your behalf.",
        sourceRefs: [],
        actions,
        followups: [
          hi ? "मेरी सभी छात्रवृत्ति अर्जी दिखाओ" : "Show all my scholarship applications",
          hi ? "जो दस्तावेज़ मांगा गया है उसे अपलोड करना है" : "I need to upload the document they asked for",
        ],
      };
    }

    switch (intent) {
      case "PROFILE": {
        addAction(hi ? "प्रोफ़ाइल खोलें" : "Open profile", "/profile");
        if (!context.studentAvailable || !context.student) {
          return {
            responseText: hi
              ? "आपकी प्रोफ़ाइल जानकारी अभी JAGO के student-record source से उपलब्ध नहीं है। मैं अनुमान नहीं लगाऊँगा। प्रोफ़ाइल स्क्रीन खोलकर उपलब्ध रिकॉर्ड देख सकते हैं।"
              : "Your profile information is not currently available to JAGO from the student-record source. I won’t guess. You can open Profile to inspect the available record.",
            sourceRefs: [],
            actions,
            followups: [hi ? "मेरे आवेदन दिखाओ" : "Show my applications"],
          };
        }

        const student = context.student;
        const fieldParts: string[] = [];
        const asks = {
          caste: hasAny(query, ["caste", "tribe", "जाति", "जनजाति"]),
          income: hasAny(query, ["income", "आय"]),
          education: hasAny(query, ["college", "institution", "course", "study", "कॉलेज", "संस्थान", "कोर्स"]),
          location: hasAny(query, ["state", "district", "live", "राज्य", "जिला"]),
          identity: hasAny(query, ["student id", "who am i", "मेरी जानकारी"]),
          dob: hasAny(query, ["date of birth", "dob", "जन्म"]),
        };

        if (asks.identity) fieldParts.push(`${student.first_name} ${student.last_name}`.trim(), `Student ID: ${student.student_id}`);
        if (asks.caste) fieldParts.push(`Category: ${student.category}${student.sub_caste_tribe ? ` · Tribe: ${student.sub_caste_tribe}` : ""}`);
        if (asks.income) fieldParts.push(`Annual family income: ${formatINR(student.annual_family_income)}`);
        if (asks.education) fieldParts.push(`Education: ${student.education_level}${student.course_name ? ` · ${student.course_name}` : ""}${student.institution_name ? ` · ${student.institution_name}` : ""}`);
        if (asks.location) fieldParts.push(`Location: ${student.domicile_district ? `${student.domicile_district}, ` : ""}${student.domicile_state}`);
        if (asks.dob) fieldParts.push(`Date of birth: ${student.date_of_birth}`);

        if (!fieldParts.length) {
          fieldParts.push(
            `${student.first_name} ${student.last_name}`.trim(),
            `Category: ${student.category}${student.sub_caste_tribe ? ` · Tribe: ${student.sub_caste_tribe}` : ""}`,
            `Annual family income: ${formatINR(student.annual_family_income)}`,
            `Education: ${student.education_level}${student.course_name ? ` · ${student.course_name}` : ""}`,
          );
        }

        return {
          responseText: hi
            ? `आपके रिकॉर्ड में:\n${fieldParts.map((part) => `• ${part}`).join("\n")}`
            : `Here’s what your student record says:\n${fieldParts.map((part) => `• ${part}`).join("\n")}`,
          sourceRefs: [`student:${student.student_id}`],
          actions,
          followups: [
            hi ? "मेरे लिए कौन सी छात्रवृत्तियाँ देखनी चाहिए?" : "Which scholarships should I explore from my profile?",
            hi ? "मेरी पात्रता समझाओ" : "Explain my eligibility",
          ],
        };
      }

      case "APPLICATION_STATUS": {
        addAction(hi ? "सभी आवेदन खोलें" : "Open all applications", "/applications");

        if (!context.applicationsAvailable) {
          return {
            responseText: hi
              ? "आवेदन रिकॉर्ड सेवा अभी उपलब्ध नहीं है। मैं अनुमान से कोई स्थिति नहीं बताऊँगा। कृपया कुछ देर बाद फिर प्रयास करें।"
              : "The application-record service is currently unavailable. I won’t guess your status. Please retry once the application service is available.",
            sourceRefs: [],
            actions,
            followups: [hi ? "दस्तावेज़ वॉलेट खोलो" : "Open my document wallet"],
          };
        }

        if (!applications.length) {
          addAction(hi ? "छात्रवृत्तियाँ खोजें" : "Explore scholarships", "/scholarships");
          return {
            responseText: hi
              ? "आपके खाते में अभी कोई scholarship application रिकॉर्ड नहीं मिला। नई योजना खोजकर आवेदन शुरू किया जा सकता है।"
              : "I don’t see any scholarship application records in your account yet. You can explore a scheme and start a new application.",
            sourceRefs: [],
            actions,
            followups: [hi ? "मेरे लिए छात्रवृत्तियाँ खोजो" : "Find scholarships for me"],
          };
        }

        const isOverview = hasAny(query, [
          "all applications", "my applications", "show applications", "application list", "applications", "sabhi", "meri sabhi", "मेरे आवेदन", "सभी आवेदन", "list",
        ]) && !hasAny(query, ["why", "which one", "specific", "that application", "this application"]);

        if (isOverview) {
          const summary = applications
            .slice(0, 10)
            .map((app) => {
              const scheme = app.scholarship?.schemeName || app.scholarshipId;
              const pending = (app.deficiencies || []).filter(isOpenDeficiency).length;
              return `${scheme} — ${humanizeStatus(app.status, hi)}${pending ? ` · ${pending} action${pending === 1 ? "" : "s"}` : ""}\n  ID: ${app.applicationId}`;
            })
            .join("\n");
          const openAction = applications.find((app) => app.status === "ACTION_REQUIRED" || (app.deficiencies || []).some(isOpenDeficiency));
          if (openAction) addAction(hi ? "Action Centre खोलें" : "Open Action Centre", "/actions");

          return {
            responseText: hi
              ? `आपके ${applications.length} आवेदन रिकॉर्ड मिले:\n${summary}\n\nकिसी खास आवेदन का ID या योजना का नाम लिखें, तो मैं उसी पर फोकस करूँगा।`
              : `I found ${applications.length} application records:\n${summary}\n\nGive me an application ID or scheme name and I’ll focus on that application.`,
            sourceRefs: unique(applications.slice(0, 10).map((app) => app.applicationId)),
            actions,
            followups: [
              hi ? "जिस आवेदन पर कार्रवाई चाहिए वह दिखाओ" : "Show the application that needs action",
              hi ? "मेरी payment वाला आवेदन दिखाओ" : "Show my payment application",
            ],
          };
        }

        if (!application) {
          return {
            responseText: hi
              ? "एक से अधिक आवेदन हैं और मैं इस संदेश से यह तय नहीं कर सकता कि आप किसकी बात कर रहे हैं। सही application ID या योजना का नाम लिखें; मैं अनुमान नहीं लगाऊँगा।"
              : "You have multiple applications and I can’t safely tell which one you mean from this message. Give me the application ID or scheme name and I’ll use the correct record instead of guessing.",
            sourceRefs: [],
            actions,
            followups: [hi ? "मेरे सभी आवेदन दिखाओ" : "Show all my applications"],
          };
        }

        addAction(hi ? "आवेदन खोलें" : "Open application", `/applications/${encodeURIComponent(application.applicationId)}`);
        if (application.status === "ACTION_REQUIRED" || (application.deficiencies || []).some(isOpenDeficiency)) {
          addAction(hi ? "Action Centre खोलें" : "Open Action Centre", "/actions");
        }

        const openDefs = (application.deficiencies || []).filter(isOpenDeficiency);
        const scheme = application.scholarship?.schemeName || application.scholarshipId;
        const latestReason = application.statusHistory?.find((event: any) => event.toStatus === application.status && event.reason)?.reason;
        const isContextual = context.previous?.applicationId === application.applicationId && isVagueFollowup(query);
        const extra = openDefs.length
          ? hi
            ? ` ${openDefs.length} लंबित action item${openDefs.length === 1 ? "" : "s"} भी हैं।`
            : ` There ${openDefs.length === 1 ? "is" : "are"} ${openDefs.length} open action item${openDefs.length === 1 ? "" : "s"}.`
          : "";
        const nextStep = this.nextStepForApplication(application, hi);
        const reasonText = latestReason && hasAny(query, ["why", "reason", "because", "क्यों", "कारण"])
          ? (hi ? `\nReason/note: ${latestReason}` : `\nReason/note: ${latestReason}`)
          : "";
        const contextualNote = isContextual
          ? (hi ? "\nमैं उसी application को संदर्भ मानकर जवाब दे रहा हूँ जिसे आपने अभी पूछा था।" : "\nI’m continuing with the same application from your previous message.")
          : "";

        return {
          responseText: hi
            ? `आपकी ${scheme} application अभी ${humanizeStatus(application.status, true)} है। Current stage: ${application.currentStage || "—"}.${extra}\nअगला कदम: ${nextStep}${reasonText}${contextualNote}`
            : `Your ${scheme} application is currently ${humanizeStatus(application.status)}. Current stage: ${application.currentStage || "—"}.${extra}\nNext step: ${nextStep}${reasonText}${contextualNote}`,
          sourceRefs: unique([
            application.applicationId,
            application.scholarshipId,
            ...openDefs.map((d: any) => d.deficiencyId),
          ]),
          actions,
          followups: [
            hi ? "इस application के documents दिखाओ" : "Show the documents linked to this application",
            hi ? "इसमें कोई कमी है क्या?" : "Does this application have any deficiencies?",
          ],
        };
      }

      case "PAYMENT": {
        addAction(hi ? "सभी आवेदन खोलें" : "Open applications", "/applications");
        const paymentApps = applications.filter((app) => app.payment);
        if (!context.applicationsAvailable) {
          return {
            responseText: hi
              ? "मैं अभी payment records तक नहीं पहुँच पा रहा हूँ, इसलिए कोई राशि या status अनुमान से नहीं बताऊँगा।"
              : "I can’t access the payment records right now, so I won’t guess a payment amount or status.",
            sourceRefs: [],
            actions,
            followups: [hi ? "मेरे आवेदन दिखाओ" : "Show my applications"],
          };
        }
        if (!paymentApps.length) {
          return {
            responseText: hi
              ? "आपके किसी application के साथ अभी payment record जुड़ा नहीं है। Payment आमतौर पर verification और sanction workflow के बाद शुरू होता है।"
              : "I don’t see a payment record attached to any of your applications yet. Payment generally follows the required verification and sanction workflow.",
            sourceRefs: unique(applications.map((app) => app.applicationId)),
            actions,
            followups: [hi ? "मेरी application की स्थिति बताओ" : "Show my application status"],
          };
        }

        const summary = paymentApps.slice(0, 8).map((app) => {
          const payment = app.payment;
          const scheme = app.scholarship?.schemeName || app.scholarshipId;
          const amount = formatINR(payment.amount);
          const ref = payment.paymentReference ? ` · Ref ${payment.paymentReference}` : "";
          return `${scheme} — ${humanizePayment(payment.status, hi)} · ${amount}${ref}`;
        }).join("\n");

        const activePaymentApp =
          (application?.payment ? application : null) ||
          paymentApps.find((app) => ["PROCESSING", "INITIATED"].includes(app.payment?.status)) ||
          paymentApps.find((app) => app.payment?.status === "SUCCESS") ||
          paymentApps[0];

        if (activePaymentApp) addAction(hi ? "Payment वाली application खोलें" : "Open payment application", `/applications/${encodeURIComponent(activePaymentApp.applicationId)}`);

        const pending = paymentApps.filter((app) => ["INITIATED", "PROCESSING"].includes(app.payment?.status));
        const success = paymentApps.filter((app) => app.payment?.status === "SUCCESS");

        let lead: string;
        if (pending.length) {
          const p = pending[0].payment;
          lead = hi
            ? `आपका सबसे प्रासंगिक pending payment ${humanizePayment(p.status, true)} है: ${formatINR(p.amount)}${p.paymentReference ? `, PFMS/DBT ref ${p.paymentReference}` : ""}. यह record अभी successful credit नहीं दिखाता।`
            : `Your most relevant pending payment is ${humanizePayment(p.status)}: ${formatINR(p.amount)}${p.paymentReference ? `, PFMS/DBT ref ${p.paymentReference}` : ""}. This record does not yet show a successful credit.`;
        } else if (success.length) {
          const p = success[0].payment;
          lead = hi
            ? `एक successful payment record मिला: ${formatINR(p.amount)} PFMS/DBT flow में दर्ज है${p.paymentReference ? ` (ref ${p.paymentReference})` : ""}.`
            : `I found a successful payment record: ${formatINR(p.amount)} is recorded through the PFMS/DBT flow${p.paymentReference ? ` (ref ${p.paymentReference})` : ""}.`;
        } else {
          lead = hi ? "Payment records मिले, लेकिन कोई successful credit या active processing state नहीं दिखी।" : "Payment records exist, but I don’t see a successful credit or an actively processing payment state.";
        }

        sourceRefs.push(...paymentApps.map((app) => app.payment.paymentId));
        return {
          responseText: `${lead}\n\n${hi ? "आपके payment-linked records:" : "Your payment-linked records:"}\n${summary}`,
          sourceRefs: unique(sourceRefs),
          actions,
          followups: [
            hi ? "PFMS payment का exact reference दिखाओ" : "Show the exact PFMS payment reference",
            hi ? "मेरी payment वाली application की पूरी timeline दिखाओ" : "Show the full timeline of my payment application",
          ],
        };
      }

      case "SANCTION": {
        if (!application) {
          addAction(hi ? "आवेदन खोलें" : "Open applications", "/applications");
          return {
            responseText: hi
              ? "किस application का sanction पूछ रहे हैं, यह स्पष्ट नहीं है। Application ID या योजना का नाम लिखें।"
              : "I can’t tell which application’s sanction you mean. Give me the application ID or scheme name and I’ll use that record.",
            sourceRefs: [],
            actions,
            followups: [hi ? "मेरे सभी आवेदन दिखाओ" : "Show all my applications"],
          };
        }
        addAction(hi ? "आवेदन खोलें" : "Open application", `/applications/${encodeURIComponent(application.applicationId)}`);
        if (application.sanction) {
          sourceRefs.push(application.sanction.sanctionId);
          return {
            responseText: hi
              ? `Sanction record उपलब्ध है: ${formatINR(application.sanction.amount)}, reference ${application.sanction.reference}, status ${application.sanction.status}.`
              : `A sanction record is available: ${formatINR(application.sanction.amount)}, reference ${application.sanction.reference}, status ${application.sanction.status}.`,
            sourceRefs,
            actions,
            followups: [hi ? "इसका payment कहाँ तक पहुँचा?" : "Where is the payment for this sanction?"],
          };
        }
        return {
          responseText: hi
            ? `यह application अभी ${humanizeStatus(application.status, true)} है और इससे कोई sanction record जुड़ा नहीं है।`
            : `This application is ${humanizeStatus(application.status)} and it does not have an attached sanction record yet.`,
          sourceRefs,
          actions,
          followups: [hi ? "Application की अगली स्थिति क्या है?" : "What is the next stage for this application?"],
        };
      }

      case "DEFICIENCY": {
        addAction(hi ? "Action Centre खोलें" : "Open Action Centre", "/actions");
        if (!applications.length && context.applicationsAvailable) {
          return {
            responseText: hi ? "आपके खाते में कोई application record नहीं मिला, इसलिए कोई deficiency भी नहीं मिली।" : "I don’t see any application records in your account, so there is no deficiency record for me to inspect.",
            sourceRefs: [],
            actions,
            followups: [hi ? "छात्रवृत्तियाँ खोजो" : "Find scholarships"],
          };
        }
        if (!application) {
          return {
            responseText: hi
              ? "मैं किसी एक application की deficiency सुरक्षित रूप से पहचान नहीं पाया। Action Centre खोलकर सभी उपलब्ध action items देखें, या application ID/योजना का नाम लिखें।"
              : "I couldn’t safely identify one application’s deficiency. Open the Action Centre to see available action items, or give me an application ID or scheme name.",
            sourceRefs: [],
            actions,
            followups: [hi ? "जिस application पर action चाहिए वह दिखाओ" : "Show the application that needs action"],
          };
        }

        const defs = application.deficiencies || [];
        const openDefs = defs.filter(isOpenDeficiency);
        sourceRefs.push(...defs.map((d: any) => d.deficiencyId));
        if (!defs.length) {
          return {
            responseText: hi
              ? `इस application (${application.scholarship?.schemeName || application.applicationId}) पर कोई deficiency record नहीं है।`
              : `There are no recorded deficiency items for ${application.scholarship?.schemeName || application.applicationId}.`,
            sourceRefs,
            actions,
            followups: [hi ? "इस application की स्थिति बताओ" : "Show this application's status"],
          };
        }

        const lines = defs.slice(0, 8).map((d: any) => `• ${d.title || d.type} — ${d.status}${d.description ? `: ${d.description}` : ""}`).join("\n");
        const actionable = openDefs[0];
        if (actionable) addAction(hi ? "मांगा गया document upload करें" : "Upload the requested document", this.documentUploadHref(application, actionable));

        return {
          responseText: hi
            ? `${openDefs.length} open action item${openDefs.length === 1 ? "" : "s"} और ${defs.length} कुल deficiency record मिले:\n${lines}\n\nDeficiency अपने-आप rejection नहीं है। ऊपर दिए गए requested action को पूरा करें।`
            : `${openDefs.length} open action item${openDefs.length === 1 ? "" : "s"} and ${defs.length} total deficiency record${defs.length === 1 ? "" : "s"} found:\n${lines}\n\nA deficiency is not automatically a rejection. Follow the requested action shown in the portal.`,
          sourceRefs: unique(sourceRefs),
          actions,
          followups: [
            hi ? "जो document मांगा है वही upload करना है" : "Start the upload for the document they requested",
            hi ? "इस deficiency को कैसे resolve करूँ?" : "How do I resolve this deficiency?",
          ],
        };
      }

      case "DOCUMENT_HELP": {
        addAction(hi ? "दस्तावेज़ वॉलेट खोलें" : "Open document wallet", "/documents");
        const requestedType = this.detectDocumentType(query);
        const uploadRequested = hasAny(query, ["upload", "re-upload", "replace", "attach", "अपलोड"]);
        const contextDeficiency = (application?.deficiencies || []).find(isOpenDeficiency);

        if (uploadRequested) {
          const contextualType = requestedType === "UNKNOWN" && contextDeficiency
            ? this.detectDocumentType(`${contextDeficiency.type || ""} ${contextDeficiency.title || ""} ${contextDeficiency.description || ""}`)
            : requestedType;
          const applicationQuery = application ? `&applicationId=${encodeURIComponent(application.applicationId)}` : "";
          const typeQuery = contextualType !== "UNKNOWN" ? `&type=${encodeURIComponent(contextualType)}` : "";
          const href = `/documents?jagoAction=upload${typeQuery}${applicationQuery}`;
          const label = contextualType !== "UNKNOWN"
            ? (hi ? `${documentTypeLabel(contextualType, true)} अपलोड करें` : `Upload ${documentTypeLabel(contextualType, false)}`)
            : (hi ? "Requested document upload करें" : "Upload requested document");
          addAction(label, href);
          return {
            responseText: hi
              ? (contextualType !== "UNKNOWN"
                ? `ठीक है। ${documentTypeLabel(contextualType, true)} upload flow तैयार है। फ़ाइल आपको स्वयं चुननी होगी; browser JAGO को आपकी local file अपने-आप चुनने की अनुमति नहीं देता।`
                : "ठीक है। मैंने document upload workflow खोलने के लिए action तैयार किया है। Exact document type स्पष्ट नहीं है, इसलिए मैं कोई गलत type preselect नहीं कर रहा।")
              : (contextualType !== "UNKNOWN"
                ? `Okay. I’ve prepared the ${documentTypeLabel(contextualType, false)} upload flow. You still choose the local file yourself; the browser does not allow JAGO to silently choose a local file for you.`
                : "Okay. I’ve prepared the document upload workflow. The exact document type is not clear, so I’m not preselecting a potentially wrong type."),
            sourceRefs: unique([...(application ? [application.applicationId] : []), ...(contextDeficiency ? [contextDeficiency.deficiencyId] : [])]),
            actions,
            followups: [hi ? "मेरे document wallet दिखाओ" : "Show my document wallet"],
          };
        }

        if (hasAny(query, ["required documents", "which documents", "documents needed", "what documents", "kya documents", "कौन से दस्तावेज", "आवश्यक दस्तावेज"])) {
          const scheme = await this.findRelevantScheme(context, query);
          const required = parseJsonArray(application?.scholarship?.requiredDocumentTypes || scheme?.requiredDocumentTypes);
          const names = required.length ? required : [];
          if (application) sourceRefs.push(application.scholarshipId);
          if (scheme) sourceRefs.push(scheme.scholarshipId);
          return {
            responseText: names.length
              ? (hi
                ? `इस application/scheme record में ये required document types हैं: ${names.map((n) => documentTypeLabel(n, true)).join(", ")}.`
                : `The current application/scheme record lists these required document types: ${names.map((n) => documentTypeLabel(n, false)).join(", ")}.`)
              : (hi
                ? "इस message से किसी specific application/scheme की required-document list नहीं मिली। Application ID या योजना का नाम दें, या document wallet खोलें।"
                : "I don’t have a specific application/scheme required-document list from this message. Give me the application ID or scheme name, or open the document wallet."),
            sourceRefs: unique(sourceRefs),
            actions,
            followups: [hi ? "जो document मांगा है उसे upload करना है" : "Upload the document they asked for"],
          };
        }

        if (hasAny(query, ["document wallet", "my documents", "mere documents", "document list", "wallet", "मेरे दस्तावेज", "वॉलेट"])) {
          return {
            responseText: hi
              ? "आपका document wallet खोल सकता हूँ। वहाँ saved documents, verification state और upload/replace workflows उपलब्ध हैं।"
              : "I can open your document wallet. It contains your saved documents plus their verification state and upload/replace workflows.",
            sourceRefs,
            actions,
            followups: [hi ? "आय प्रमाणपत्र अपलोड करना है" : "Upload my income certificate", hi ? "इस application के लिए कौन से documents चाहिए?" : "Which documents are required for this application?"],
          };
        }

        return {
          responseText: hi
            ? "मैं document wallet खोल सकता हूँ, required documents समझा सकता हूँ और सही document का upload/re-upload शुरू कर सकता हूँ।"
            : "I can open your document wallet, explain required documents, and start the correct upload or re-upload workflow.",
          sourceRefs,
          actions,
          followups: [hi ? "आय प्रमाणपत्र upload करो" : "Upload my income certificate", hi ? "मेरे documents दिखाओ" : "Show my document wallet"],
        };
      }

      case "VERIFICATION": {
        addAction(hi ? "Application खोलें" : "Open application", application ? `/applications/${encodeURIComponent(application.applicationId)}` : "/applications");
        if (!application) {
          return {
            responseText: hi
              ? "मैं verification से जुड़ी specific application पहचान नहीं पाया। Application ID या योजना का नाम लिखें।"
              : "I couldn’t identify a specific application with verification information. Give me the application ID or scheme name.",
            sourceRefs: [],
            actions,
            followups: [hi ? "मेरे सभी applications दिखाओ" : "Show all applications"],
          };
        }
        const review = application.evaluations?.[0];
        const defs = (application.deficiencies || []).filter(isOpenDeficiency);
        if (review) sourceRefs.push(review.evaluationId);
        sourceRefs.push(...defs.map((d: any) => d.deficiencyId));
        const evaluationResult = review?.result;
        const reasons = parseJsonArray(review?.reasons);
        const detail = reasons.length ? reasons.join("; ") : (review?.reasons ? String(review.reasons) : application.currentStage || "No detailed verification note is available.");
        return {
          responseText: hi
            ? `Application status: ${humanizeStatus(application.status, true)}।${evaluationResult ? ` Latest rule evaluation: ${evaluationResult}.` : ""}${detail ? ` Verification/review note: ${detail}.` : ""}${defs.length ? ` ${defs.length} related action item${defs.length === 1 ? "" : "s"} भी open हैं।` : ""}`
            : `Application status: ${humanizeStatus(application.status)}.${evaluationResult ? ` Latest rule evaluation: ${evaluationResult}.` : ""}${detail ? ` Verification/review note: ${detail}.` : ""}${defs.length ? ` ${defs.length} related action item${defs.length === 1 ? " is" : "s are"} still open.` : ""}`,
          sourceRefs: unique(sourceRefs),
          actions,
          followups: [hi ? "Verification में क्या match हुआ?" : "What was matched during verification?"],
        };
      }

      case "ELIGIBILITY": {
        addAction(hi ? "पात्रता checker खोलें" : "Open eligibility checker", "/eligibility");
        if (!context.studentAvailable || !context.student) {
          return {
            responseText: hi
              ? "Eligibility समझाने के लिए आपका student profile record चाहिए, लेकिन वह अभी उपलब्ध नहीं है। मैं बिना profile data के कोई eligibility conclusion नहीं दूँगा।"
              : "I need your student profile record to explain eligibility, but it is not currently available. I won’t make an eligibility conclusion without the required profile data.",
            sourceRefs: [],
            actions,
            followups: [hi ? "मेरी प्रोफ़ाइल खोलो" : "Open my profile"],
          };
        }

        const student = context.student;
        const income = Number(student.annual_family_income || 0);
        const category = student.category || "UNKNOWN";
        const education = student.education_level || "UNKNOWN";

        if (application?.evaluations?.[0]) {
          const evaluation = application.evaluations[0];
          sourceRefs.push(evaluation.evaluationId, application.scholarshipId);
          return {
            responseText: hi
              ? `इस application के latest stored rule evaluation में result ${evaluation.result} है। Profile inputs: category ${category}, annual family income ${formatINR(income)}, education ${education}. यह stored evaluation है; नया अंतिम decision नहीं।`
              : `The latest stored rule evaluation for this application is ${evaluation.result}. Profile inputs: category ${category}, annual family income ${formatINR(income)}, education ${education}. This is the stored evaluation, not a newly issued final decision.`,
            sourceRefs: unique(sourceRefs),
            actions,
            followups: [hi ? "इस scheme के required documents बताओ" : "Show the required documents for this scheme"],
          };
        }

        const scheme = await this.findRelevantScheme(context, query);
        if (scheme) {
          sourceRefs.push(scheme.scholarshipId);
          const checks: string[] = [];
          if (scheme.incomeCeiling !== null && scheme.incomeCeiling !== undefined) {
            checks.push(`income ${income <= Number(scheme.incomeCeiling) ? "within" : "above"} recorded ceiling ${formatINR(scheme.incomeCeiling)}`);
          }
          if (scheme.targetGroup) {
            checks.push(`target group: ${scheme.targetGroup}`);
          }
          if (scheme.educationLevel) {
            checks.push(`education level: ${scheme.educationLevel}`);
          }
          return {
            responseText: hi
              ? `${scheme.schemeName} के लिए आपके profile inputs के आधार पर stored scheme attributes ये हैं: ${checks.length ? checks.join("; ") : "कोई machine-readable eligibility attribute उपलब्ध नहीं है"}. इसे संभावित fit समझें, final eligibility decision नहीं।`
              : `For ${scheme.schemeName}, the stored scheme attributes relevant to your profile are: ${checks.length ? checks.join("; ") : "no machine-readable eligibility attributes available"}. Treat this as a potential-fit explanation, not a final eligibility decision.`,
            sourceRefs,
            actions,
            followups: [hi ? "मेरे लिए matching scholarships खोजो" : "Find scholarships that fit my profile"],
          };
        }

        return {
          responseText: hi
            ? `आपके profile में category ${category}, annual family income ${formatINR(income)} और education level ${education} दर्ज है। Final eligibility संबंधित scheme के official rules और verification पर निर्भर करती है।`
            : `Your profile records category ${category}, annual family income ${formatINR(income)}, and education level ${education}. Final eligibility depends on the selected scheme’s official rules and verification.`,
          sourceRefs,
          actions,
          followups: [hi ? "मेरे लिए scholarships खोजो" : "Find scholarships for me"],
        };
      }

      case "SCHOLARSHIP_DISCOVERY": {
        const schemes = await prisma.scholarship.findMany({
          where: { status: { in: ["ACTIVE", "UPCOMING"] } },
          orderBy: [{ status: "asc" }, { applicationEndDate: "asc" }],
          take: 100,
        });
        const relevant = this.rankScholarships(schemes, context.student, query).slice(0, 8);
        addAction(hi ? "सभी छात्रवृत्तियाँ देखें" : "Explore all scholarships", "/scholarships");
        for (const scheme of relevant.slice(0, 3)) {
          addAction(hi ? `${scheme.schemeName} देखें` : `View ${scheme.schemeName}`, `/scholarships/${encodeURIComponent(scheme.scholarshipId)}`);
        }

        const isApplyRequest = hasAny(query, ["apply", "start application", "apply now", "आवेदन करें", "अप्लाई"]);
        // For an explicit scheme-name + apply request, inspect the exact stored
        // scheme even when its status is INFORMATION_ONLY. Otherwise JAGO can
        // accidentally recommend an unrelated open scheme.
        const exactRequestedScheme = isApplyRequest ? await this.findRelevantScheme(context, query) : null;
        if (exactRequestedScheme && isApplyRequest) {
          addAction(hi ? "योजना का विवरण खोलें" : "View scheme details", `/scholarships/${encodeURIComponent(exactRequestedScheme.scholarshipId)}`);

          if (exactRequestedScheme.status === "INFORMATION_ONLY") {
            return {
              responseText: hi
                ? `इस योजना के लिए अभी application शुरू नहीं की जा सकती। Official record में status INFORMATION_ONLY है, यानी application window प्रकाशित नहीं हुई है। मैं अनुमान से कोई deadline या apply link नहीं बनाऊँगा।`
                : `You can’t start an application for this scheme yet. Its official record is INFORMATION_ONLY, which means the application window has not been published. I won’t invent a deadline or application link.`,
              sourceRefs: [exactRequestedScheme.scholarshipId],
              actions,
              followups: [hi ? "इस योजना की details खोलो" : "Open this scheme's details", hi ? "Open scholarships" : "Explore open scholarships"],
            };
          }

          if (exactRequestedScheme.status === "UPCOMING") {
            const start = exactRequestedScheme.applicationStartDate
              ? new Date(exactRequestedScheme.applicationStartDate).toISOString().slice(0, 10)
              : null;
            return {
              responseText: hi
                ? `यह योजना अभी खुली नहीं है${start ? `। आवेदन ${start} से शुरू होगा` : ""}।`
                : `This scheme is not open yet${start ? `; applications are scheduled to start on ${start}` : ""}.`,
              sourceRefs: [exactRequestedScheme.scholarshipId],
              actions,
              followups: [hi ? "सभी open scholarships दिखाओ" : "Show open scholarships"],
            };
          }

          const existing = applications.find((app) => app.scholarshipId === exactRequestedScheme.scholarshipId);
          if (existing) {
            addAction(hi ? "मौजूदा application खोलें" : "Open existing application", `/applications/${encodeURIComponent(existing.applicationId)}`);
          } else if (exactRequestedScheme.status === "ACTIVE") {
            addAction(hi ? `${exactRequestedScheme.schemeName} के लिए application शुरू करें` : `Start ${exactRequestedScheme.schemeName} application`, `/applications/new?scheme=${encodeURIComponent(exactRequestedScheme.scholarshipId)}`);
          }
        }

        if (!relevant.length) {
          return {
            responseText: hi
              ? "अभी active या upcoming scholarship records नहीं मिले। मैं अनुमान से कोई scheme नहीं बनाऊँगा।"
              : "I couldn’t find active or upcoming scholarship records right now. I won’t invent a scheme or deadline.",
            sourceRefs: [],
            actions,
            followups: [hi ? "सभी scholarships page खोलो" : "Open all scholarships"],
          };
        }

        const lines = relevant.map((s) => {
          const deadline = s.applicationEndDate ? new Date(s.applicationEndDate).toISOString().slice(0, 10) : null;
          const fit = context.student ? this.scholarshipFitSummary(s, context.student) : "scheme record";
          return `${s.schemeName} — ${s.status}${deadline ? ` · deadline ${deadline}` : ""}${fit ? ` · ${fit}` : ""}`;
        }).join("\n");

        return {
          responseText: hi
            ? `${context.student ? "आपके profile के आधार पर" : "अभी उपलब्ध records में"} ये relevant scholarship records मिले:\n${lines}\n\nEligibility/deadline के लिए scheme details और official source देखें; JAGO stored attributes के आधार पर result समझा रहा है।`
            : `${context.student ? "Based on your profile" : "From the currently available records"}, these scholarship records are relevant:\n${lines}\n\nCheck the scheme details and official source for final eligibility/deadline information; JAGO is using stored attributes rather than inventing a decision.`,
          sourceRefs: relevant.map((s) => s.scholarshipId),
          actions,
          followups: [
            hi ? "इस scholarship की eligibility समझाओ" : "Explain eligibility for this scholarship",
            relevant.some((scheme) => scheme.status === "ACTIVE")
              ? (hi ? "इस scholarship के लिए application शुरू करो" : "Start an application for this scholarship")
              : (hi ? "Open scholarships" : "Show open scholarships"),
          ],
        };
      }

      case "GENERAL_ASSISTANCE":
      default: {
        const navigation = this.navigationActions(query, hi);
        navigation.forEach((a) => actions.push(a));
        if (actions.length) {
          return {
            responseText: hi
              ? "ठीक है—मैं आपको app के सही हिस्से तक ले जाता हूँ। नीचे action दबाएँ।"
              : "Sure — I can take you to the right part of the app. Use the action below.",
            sourceRefs: [],
            actions,
            followups: [hi ? "मेरे applications दिखाओ" : "Show my applications"],
          };
        }

        if (isVagueFollowup(query) && context.application) {
          const next = this.nextStepForApplication(context.application, hi);
          addAction(hi ? "Application खोलें" : "Open application", `/applications/${encodeURIComponent(context.application.applicationId)}`);
          return {
            responseText: hi
              ? `आपकी पिछली application के संदर्भ में: ${next}`
              : `Continuing from your previous application: ${next}`,
            sourceRefs: [context.application.applicationId],
            actions,
            followups: [hi ? "पूरी application status दिखाओ" : "Show the full application status"],
          };
        }

        addAction(hi ? "डैशबोर्ड" : "Dashboard", "/dashboard");
        addAction(hi ? "मेरे आवेदन" : "My applications", "/applications");
        addAction(hi ? "दस्तावेज़" : "Documents", "/documents");
        addAction(hi ? "छात्रवृत्तियाँ" : "Scholarships", "/scholarships");
        return {
          responseText: hi
            ? "मैं JAGO हूँ। इस ऐप में आपको जो करना है उसे सीधे बताइए—जैसे ‘मेरी applications दिखाओ’, ‘income certificate upload करो’, ‘मेरी payment कहाँ है?’ या ‘मेरी caste क्या है?’. मैं सही workflow तक ले जाऊँगा या record से जवाब दूँगा।"
            : "I’m JAGO. Tell me the outcome you want inside this app—for example, “show my applications”, “upload my income certificate”, “where is my scholarship payment?”, or “what is my caste?”. I’ll use the relevant record or route you to the right workflow.",
          sourceRefs: [],
          actions,
          followups: [
            hi ? "मेरी applications दिखाओ" : "Show my applications",
            hi ? "मेरा payment track करो" : "Track my scholarship payment",
            hi ? "आय प्रमाणपत्र upload करो" : "Upload my income certificate",
          ],
        };
      }
    }
  }

  private isCapabilityQuestion(query: string): boolean {
    return hasAny(query, [
      "what can you do",
      "what do you do",
      "what can jago do",
      "what all can you do",
      "how can jago help",
      "what can you help me with",
      "what services do you provide",
      "tum kya kar sakte",
      "aap kya kar sakte",
      "आप क्या कर सकते",
      "क्या कर सकते हो",
      "jago kya kar sakta",
    ]);
  }

  private isOutOfScope(query: string): boolean {
    return hasAny(query, OUT_OF_SCOPE_PATTERNS) && !hasAny(query, PORTAL_SCOPE_PATTERNS);
  }

  private navigationActions(query: string, hi: boolean): JagoAction[] {
    const actions: JagoAction[] = [];
    const add = (label: string, href: string) => {
      if (!actions.some((a) => a.href === href)) actions.push({ type: "NAVIGATE", label, href });
    };
    if (hasAny(query, ["dashboard", "home", "होम", "डैशबोर्ड"])) add(hi ? "डैशबोर्ड खोलें" : "Open dashboard", "/dashboard");
    if (hasAny(query, ["profile", "account", "personal details", "personal information", "my details", "प्रोफ़ाइल", "अकाउंट", "व्यक्तिगत जानकारी"])) add(hi ? "प्रोफ़ाइल खोलें" : "Open profile", "/profile");
    if (hasAny(query, ["notification", "alerts", "bell", "सूचना", "नोटिफ़िकेशन"])) add(hi ? "नोटिफ़िकेशन खोलें" : "Open notifications", "/notifications");
    if (hasAny(query, ["action centre", "action center", "actions", "कार्रवाई केंद्र", "एक्शन सेंटर"])) add(hi ? "Action Centre खोलें" : "Open Action Centre", "/actions");
    if (hasAny(query, ["new application", "start application", "apply now", "नई अर्जी", "नया आवेदन"])) add(hi ? "नई application शुरू करें" : "Start new application", "/applications/new");
    if (hasAny(query, ["scholarships page", "open scholarships", "browse scholarships", "scholarships", "छात्रवृत्ति"])) add(hi ? "छात्रवृत्तियाँ खोलें" : "Open scholarships", "/scholarships");
    if (hasAny(query, ["documents", "document wallet", "wallet", "दस्तावेज", "वॉलेट"])) add(hi ? "दस्तावेज़ वॉलेट खोलें" : "Open document wallet", "/documents");
    if (hasAny(query, ["applications page", "open applications", "my applications", "मेरे applications", "मेरे आवेदन"])) add(hi ? "मेरे applications खोलें" : "Open my applications", "/applications");
    return actions;
  }

  private detectDocumentType(query: string): string {
    const q = normalizeQuery(query);
    if (hasAny(q, ["income certificate", "income proof", "aay certificate", "आय प्रमाणपत्र", "आय प्रमाण", "income" ])) return "INCOME_CERTIFICATE";
    if (hasAny(q, ["caste certificate", "tribe certificate", "community certificate", "jati certificate", "जाति प्रमाणपत्र", "जनजाति प्रमाणपत्र", "caste", "tribe"])) return "CASTE_CERTIFICATE";
    if (hasAny(q, ["domicile", "residence certificate", "resident proof", "address proof", "निवास प्रमाणपत्र", "डोमिसाइल"])) return "DOMICILE_CERTIFICATE";
    if (hasAny(q, ["marksheet", "mark sheet", "grade card", "अंकपत्र", "मार्कशीट"])) return "MARKSHEET";
    if (hasAny(q, ["fee receipt", "fee", "fees", "फीस रसीद"])) return "FEE_RECEIPT";
    if (hasAny(q, ["passbook", "bank statement", "bank account proof", "bank account", "पासबुक"])) return "BANK_PASSBOOK";
    if (hasAny(q, ["bonafide", "enrollment certificate", "bonafide certificate"])) return "BONAFIDE_CERTIFICATE";
    if (hasAny(q, ["admission proof", "admission letter", "admission", "प्रवेश प्रमाण", "नामांकन"])) return "ADMISSION_PROOF";
    if (hasAny(q, ["hostel", "hostel certificate", "छात्रावास"])) return "HOSTEL_CERTIFICATE";
    // These records can appear in scholarship requirements but the current
    // student upload UI does not support them as preselectable types. Do not
    // lie by preselecting a different document type.
    return "UNKNOWN";
  }

  private documentUploadHref(application: any, deficiency?: any): string {
    const source = deficiency
      ? `${deficiency.type || ""} ${deficiency.title || ""} ${deficiency.description || ""} ${deficiency.requiredAction || ""}`
      : (application.deficiencies || []).map((d: any) => `${d.type || ""} ${d.title || ""} ${d.description || ""} ${d.requiredAction || ""}`).join(" ");
    const detected = this.detectDocumentType(source);
    const typeQuery = detected !== "UNKNOWN" ? `&type=${encodeURIComponent(detected)}` : "";
    return `/documents?jagoAction=upload${typeQuery}&applicationId=${encodeURIComponent(application.applicationId)}`;
  }

  private async findRelevantScheme(context: JagoContext, query: string): Promise<any | null> {
    const normalized = normalizeQuery(query);
    const candidates: any[] = [];
    if (context.application?.scholarship) candidates.push(context.application.scholarship);

    try {
      const stored = await prisma.scholarship.findMany({
        where: { status: { in: ["ACTIVE", "UPCOMING", "INFORMATION_ONLY"] } },
        orderBy: [{ status: "asc" }, { applicationEndDate: "asc" }],
        take: 100,
      });
      candidates.push(...stored);
    } catch {
      // A specific application scheme can still be explained if the catalog is unavailable.
    }

    const uniqueCandidates = Array.from(new Map(candidates.map((scheme) => [scheme.scholarshipId, scheme])).values());
    const explicit = uniqueCandidates.find((scheme) => {
      const name = normalizeQuery(String(scheme.schemeName || ""));
      const code = normalizeQuery(String(scheme.schemeCode || ""));
      if (name && normalized.includes(name)) return true;
      if (code && normalized.includes(code)) return true;
      const tokens = name.split(/[^a-z0-9]+/).filter((token: string) => token.length >= 4 && !["scholarship", "students", "student", "national", "ministry", "scheme"].includes(token));
      const hits = tokens.filter((token: string) => normalized.includes(token));
      return hits.length >= 2 || (tokens.length === 1 && hits.length === 1);
    });
    if (explicit) return explicit;

    if (context.application && hasAny(normalized, ["this scholarship", "this scheme", "this application", "इस योजना", "इस scholarship", "इस आवेदन"])) {
      return context.application.scholarship || null;
    }

    return null;
  }

  private rankScholarships(schemes: any[], student: StudentContract | null, query: string): any[] {
    const normalized = normalizeQuery(query);
    return [...schemes].sort((a, b) => this.scholarshipScore(b, student, normalized) - this.scholarshipScore(a, student, normalized));
  }

  private scholarshipScore(scheme: any, student: StudentContract | null, query: string): number {
    let score = 0;
    const name = normalizeQuery(String(scheme.schemeName || ""));
    const target = normalizeQuery(String(scheme.targetGroup || ""));
    const education = normalizeQuery(String(scheme.educationLevel || ""));
    const description = normalizeQuery(`${scheme.description || ""} ${scheme.eligibilitySummary || ""}`);

    if (query && (query.includes(name) || query.includes(normalizeQuery(String(scheme.schemeCode || ""))))) score += 100;
    if (!student) return score;

    if (student.category === "ST" && (/(^|\s)st(\s|$)/.test(target) || target.includes("scheduled tribe") || target.includes("tribal") || name.includes("tribal") || name.includes("st students") || description.includes("scheduled tribe"))) score += 30;
    if (student.education_level && education.includes(normalizeQuery(student.education_level))) score += 20;
    if (scheme.incomeCeiling !== null && scheme.incomeCeiling !== undefined && Number(student.annual_family_income) <= Number(scheme.incomeCeiling)) score += 20;
    if (scheme.status === "ACTIVE") score += 10;

    // Prefer records with an upcoming deadline when the user is exploring what
    // they can still act on right now.
    if (scheme.applicationEndDate && safeDate(scheme.applicationEndDate) >= Date.now()) score += 5;
    return score;
  }

  private scholarshipFitSummary(scheme: any, student: StudentContract): string {
    const parts: string[] = [];
    if (scheme.incomeCeiling !== null && scheme.incomeCeiling !== undefined) {
      parts.push(Number(student.annual_family_income) <= Number(scheme.incomeCeiling) ? "income within recorded ceiling" : "income above recorded ceiling");
    }
    if (scheme.targetGroup && (/(^|\s)st(\s|$)/.test(normalizeQuery(String(scheme.targetGroup))) || normalizeQuery(String(scheme.targetGroup)).includes("scheduled tribe") || normalizeQuery(String(scheme.targetGroup)).includes("tribal"))) parts.push("ST-targeted record");
    return parts.join(", ");
  }

  private nextStepForApplication(application: any, hi: boolean): string {
    const openDefs = (application.deficiencies || []).filter(isOpenDeficiency);
    if (openDefs.length) {
      const first = openDefs[0];
      if (first.requiredAction === "REUPLOAD_DOCUMENT" || first.requiredAction === "RE_UPLOAD_DOCUMENT" || first.type === "DOCUMENT_MISSING" || first.type === "DOCUMENT_INVALID" || first.type === "DOCUMENT_MISMATCH") {
        const docType = this.detectDocumentType(`${first.type || ""} ${first.title || ""} ${first.description || ""}`);
        return hi ? `${documentTypeLabel(docType === "UNKNOWN" ? "DOCUMENT" : docType, true)} का requested upload/re-upload करें।` : `Upload/re-upload the requested document${docType !== "UNKNOWN" ? ` (${documentTypeLabel(docType, false)})` : ""}.`;
      }
      return hi ? `Action Centre में ${first.title || "requested action"} पूरा करें।` : `Complete the requested action in the Action Centre: ${first.title || "requested action"}.`;
    }
    switch (application.status) {
      case "DRAFT": return hi ? "Application पूरा करें और आवश्यक documents के साथ submit करें।" : "Complete the application and submit it with the required documents.";
      case "SUBMITTED": return hi ? "Verification का इंतज़ार करें; अभी student action record नहीं है।" : "Wait for the verification stage unless the portal raises a new action item.";
      case "UNDER_VERIFICATION": return hi ? "Verification complete होने का इंतज़ार करें।" : "Wait for verification to complete.";
      case "UNDER_REVIEW": return hi ? "Review decision का इंतज़ार करें।" : "Wait for the review decision.";
      case "VERIFIED": return hi ? "Application sanction के लिए अगले workflow stage में है।" : "The application is verified and moving toward the sanction stage.";
      case "SANCTIONED": return hi ? "Sanction जारी है; payment processing देखें।" : "The sanction is issued; check the payment stage next.";
      case "PAYMENT_PROCESSING": return hi ? "PFMS/DBT payment processing पूरी होने का इंतज़ार करें।" : "Wait for the PFMS/DBT payment processing to complete.";
      case "PAID": return hi ? "Payment record सफल है; disbursement details देखें।" : "The payment record is successful; review the disbursement details.";
      case "REJECTED": return hi ? "Rejection reason/decision note portal में देखें।" : "Review the rejection reason/decision note in the portal.";
      case "WITHDRAWN": return hi ? "Application वापस लिया गया है; नई application की जरूरत हो तो scholarships देखें।" : "The application was withdrawn; explore scholarships if you need to start a new application.";
      case "CANCELLED": return hi ? "Application cancelled है; संबंधित notice देखें।" : "The application is cancelled; review the related notice.";
      default: return hi ? "Application detail खोलकर current stage देखें।" : "Open the application detail to inspect the current stage.";
    }
  }
}

export const jagoService = new JagoService();
