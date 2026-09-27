import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  ApplicationStage,
  DocumentStatus,
  VerificationMatchState,
  DbtPaymentState,
  DeficiencyStatus,
} from "./contracts/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr?: string): string {
  if (!dateStr || dateStr === "Pending") return "Pending";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr || dateStr === "Pending") return "Pending";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function getApplicationStageBadge(stage: ApplicationStage) {
  switch (stage) {
    case "DRAFT":
      return {
        label: "Draft",
        color: "bg-slate-100 text-slate-700 border-slate-300",
        hindi: "प्रारूप",
      };
    case "SUBMITTED":
      return {
        label: "Submitted",
        color: "bg-blue-50 text-blue-700 border-blue-300",
        hindi: "जमा किया गया",
      };
    case "UNDER_VERIFICATION":
      return {
        label: "Under Verification",
        color: "bg-amber-50 text-amber-800 border-amber-300",
        hindi: "सत्यापन अधीन",
      };
    case "UNDER_REVIEW":
      return {
        label: "Under Official Review",
        color: "bg-purple-50 text-purple-700 border-purple-300",
        hindi: "समीक्षाधीन",
      };
    case "VERIFIED":
      return {
        label: "Verified",
        color: "bg-emerald-50 text-emerald-700 border-emerald-300",
        hindi: "सत्यापित",
      };
    case "SANCTIONED":
      return {
        label: "Sanctioned",
        color: "bg-teal-50 text-teal-800 border-teal-300 font-semibold",
        hindi: "स्वीकृत",
      };
    case "PAYMENT_PROCESSING":
      return {
        label: "Payment Processing",
        color: "bg-indigo-50 text-indigo-700 border-indigo-300",
        hindi: "भुगतान प्रक्रियाधीन",
      };
    case "PAID":
      return {
        label: "Paid / Disbursed",
        color: "bg-green-100 text-green-800 border-green-400 font-bold",
        hindi: "भुगतान पूर्ण",
      };
    case "ACTION_REQUIRED":
      return {
        label: "Action Required",
        color: "bg-red-50 text-red-700 border-red-300 animate-pulse font-medium",
        hindi: "कार्रवाई आवश्यक",
      };
    case "REJECTED":
      return {
        label: "Rejected",
        color: "bg-gray-100 text-gray-700 border-gray-300",
        hindi: "अस्वीकृत",
      };
    case "WITHDRAWN":
      return {
        label: "Withdrawn",
        color: "bg-neutral-100 text-neutral-600 border-neutral-300",
        hindi: "वापस लिया गया",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        color: "bg-neutral-100 text-neutral-600 border-neutral-300",
        hindi: "रद्द किया गया",
      };
    default:
      return {
        label: stage,
        color: "bg-slate-100 text-slate-700 border-slate-300",
        hindi: stage,
      };
  }
}

export function getDocumentStatusBadge(status: DocumentStatus) {
  switch (status) {
    case "VERIFIED":
      return { label: "Verified", color: "bg-emerald-50 text-emerald-700 border-emerald-300" };
    case "AVAILABLE":
      return { label: "Available", color: "bg-blue-50 text-blue-700 border-blue-300" };
    case "UPLOADED":
      return { label: "Uploaded", color: "bg-sky-50 text-sky-700 border-sky-300" };
    case "PROCESSING":
      return { label: "Processing", color: "bg-amber-50 text-amber-700 border-amber-300" };
    case "MISMATCH":
      return { label: "Mismatch Flagged", color: "bg-red-50 text-red-700 border-red-300" };
    case "EXPIRED":
      return { label: "Expired", color: "bg-gray-100 text-gray-600 border-gray-300" };
    case "REPLACED":
      return { label: "Replaced", color: "bg-purple-50 text-purple-700 border-purple-300" };
    case "REJECTED":
      return { label: "Rejected", color: "bg-rose-50 text-rose-700 border-rose-300" };
    case "REQUESTED":
      return { label: "Requested", color: "bg-orange-50 text-orange-700 border-orange-300" };
    case "SOURCE_UNAVAILABLE":
      return { label: "Source Unavailable", color: "bg-neutral-100 text-neutral-600 border-neutral-300" };
    default:
      return { label: status, color: "bg-slate-50 text-slate-700 border-slate-300" };
  }
}

export function getVerificationMatchBadge(match: VerificationMatchState) {
  switch (match) {
    case "MATCH":
      return { label: "Matched ✓", color: "bg-emerald-50 text-emerald-800 border-emerald-300" };
    case "PARTIAL_MATCH":
      return { label: "Partial Match", color: "bg-yellow-50 text-yellow-800 border-yellow-300" };
    case "MISMATCH":
      return { label: "Mismatch (Review)", color: "bg-rose-50 text-rose-800 border-rose-300" };
    case "PENDING_REVIEW":
      return { label: "Pending Review", color: "bg-amber-50 text-amber-800 border-amber-300" };
    case "SOURCE_UNAVAILABLE":
      return { label: "Source Unavailable", color: "bg-neutral-100 text-neutral-700 border-neutral-300" };
    case "NOT_VERIFIABLE":
      return { label: "Not Verifiable", color: "bg-stone-100 text-stone-700 border-stone-300" };
    case "INSUFFICIENT_EVIDENCE":
      return { label: "Needs Evidence", color: "bg-orange-50 text-orange-800 border-orange-300" };
    default:
      return { label: match, color: "bg-slate-50 text-slate-700 border-slate-300" };
  }
}

export function getDbtPaymentBadge(state: DbtPaymentState) {
  switch (state) {
    case "SUCCESS":
      return { label: "DBT Credited ✓", color: "bg-emerald-100 text-emerald-800 border-emerald-400 font-bold" };
    case "PROCESSING":
      return { label: "PFMS Processing", color: "bg-blue-50 text-blue-800 border-blue-300 font-semibold" };
    case "INITIATED":
      return { label: "DBT Initiated", color: "bg-sky-50 text-sky-800 border-sky-300" };
    case "PENDED":
      return { label: "Batch Pended", color: "bg-amber-50 text-amber-800 border-amber-300" };
    case "FAILED":
      return { label: "DBT Failed", color: "bg-red-50 text-red-800 border-red-300" };
    case "NOT_INITIATED":
      return { label: "Not Initiated", color: "bg-slate-100 text-slate-600 border-slate-200" };
    default:
      return { label: state, color: "bg-slate-50 text-slate-700 border-slate-300" };
  }
}

export function getDeficiencyBadge(status: DeficiencyStatus) {
  switch (status) {
    case "OPEN":
      return { label: "Open Action", color: "bg-red-100 text-red-800 border-red-300 font-semibold" };
    case "RESOLVED":
      return { label: "Resolved ✓", color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    case "UNDER_REVIEW":
      return { label: "Under Official Review", color: "bg-purple-100 text-purple-800 border-purple-300" };
    case "WAIVED":
      return { label: "Waived", color: "bg-slate-100 text-slate-700 border-slate-300" };
  }
}
