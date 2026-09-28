import { SanctionDetails, PaymentRecord } from "../contracts/types";
import { RIJVAN_API_URL } from "../config";
import { apiFetch } from "./http";

/**
 * Payment & Sanction API Service
 * Separates Sanction and PFMS DBT Payment tracking from Application status.
 */
export const paymentApi = {
  /**
   * Get sanction details for an application.
   */
  async getSanctionByAppId(applicationId: string): Promise<SanctionDetails | null> {
    try {
      const s: any = await apiFetch<any | null>(`${RIJVAN_API_URL}/applications/${encodeURIComponent(applicationId)}/sanction`);
      if (!s) return null;
      return { sanction_id: s.sanction_id, application_id: s.application_id, sanction_order_no: s.reference, sanction_date: (s.sanctioned_at || s.created_at).slice(0,10), approved_tuition_fee: 0, approved_maintenance_allowance: 0, total_sanctioned_amount: Number(s.amount || 0), sanctioning_authority: s.sanctioning_authority || "Not provided by source" };
    } catch (e) { if (e instanceof Error && /not found/i.test(e.message)) return null; throw e; }
  },

  /**
   * Get PFMS DBT payment record for an application.
   */
  async getPaymentByAppId(applicationId: string): Promise<PaymentRecord | null> {
    try {
      const p: any = await apiFetch<any | null>(`${RIJVAN_API_URL}/applications/${encodeURIComponent(applicationId)}/payment`);
      if (!p) return null;
      const state = p.status === "SUCCESS" ? "SUCCESS" : p.status === "FAILED" ? "FAILED" : p.status === "RETURNED" ? "FAILED" : p.status === "INITIATED" ? "INITIATED" : p.status === "NOT_INITIATED" ? "NOT_INITIATED" : "PROCESSING";
      return { sanction_id: "", application_id: p.application_id, payment_id: p.payment_id, sanction_amount: Number(p.amount || 0), disbursed_amount: state === "SUCCESS" ? Number(p.amount || 0) : 0, dbt_state: state, pfms_transaction_ref: p.payment_reference, beneficiary_name_masked: p.beneficiary_name_masked || "Not provided", bank_name: p.bank_name || "Not provided", bank_account_masked: p.bank_account_masked || "Not provided", ifsc_masked: p.ifsc_masked || "Not provided", disbursement_date: p.completed_at || undefined, failure_or_pending_reason: p.failure_reason || undefined, last_updated_at: p.completed_at || p.initiated_at || new Date().toISOString(), steps: [{ name: "Payment initiated", state: p.initiated_at ? "COMPLETED" : "PENDING", timestamp: p.initiated_at }, { name: "PFMS processing", state: state === "PROCESSING" ? "CURRENT" : state === "SUCCESS" || state === "FAILED" ? "COMPLETED" : "PENDING", timestamp: p.completed_at || undefined }] };
    } catch (e) { if (e instanceof Error && /not found/i.test(e.message)) return null; throw e; }
  },
};
