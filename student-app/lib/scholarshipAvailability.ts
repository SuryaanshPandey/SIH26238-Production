import { Scholarship } from "./contracts/types";

export type ScholarshipApplicationAvailability = {
  canApply: boolean;
  reason:
    | "OPEN"
    | "UPCOMING"
    | "CLOSED"
    | "INFORMATION_ONLY"
    | "NO_CURRENT_WINDOW";
  message: string;
};

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/**
 * Application CTA policy for the student app.
 * We never infer an application window from a generic catalogue record.
 * A scheme is actionable only when the backend explicitly reports OPEN and
 * the published dates, when present, still contain the current moment.
 */
export function getScholarshipApplicationAvailability(
  scheme: Scholarship | null,
  now = Date.now(),
): ScholarshipApplicationAvailability {
  if (scheme.status === "INFORMATION_ONLY") {
    return {
      canApply: false,
      reason: "INFORMATION_ONLY",
      message:
        "The official catalogue record does not currently publish an application window. JAGO will not start an application until the official window is published.",
    };
  }

  const start = parseDate(scheme.start_date);
  const deadline = parseDate(scheme.deadline);

  if (scheme.status === "UPCOMING" || (start !== null && now < start)) {
    return {
      canApply: false,
      reason: "UPCOMING",
      message: scheme.start_date
        ? `Applications open on ${new Date(scheme.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}.`
        : "The application window has not opened yet.",
    };
  }

  if (scheme.status === "CLOSED" || (deadline !== null && now > deadline)) {
    return {
      canApply: false,
      reason: "CLOSED",
      message: scheme.deadline
        ? `The application window closed on ${new Date(scheme.deadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}.`
        : "The application window is currently closed.",
    };
  }

  if (scheme.status !== "OPEN") {
    return {
      canApply: false,
      reason: "NO_CURRENT_WINDOW",
      message: "Applications are not currently available for this scheme.",
    };
  }

  return {
    canApply: true,
    reason: "OPEN",
    message: deadline
      ? `Applications are open until ${new Date(deadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}.`
      : "Applications are currently open.",
  };
}
