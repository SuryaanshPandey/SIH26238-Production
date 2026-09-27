"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  CreditCard,
  Play,
  Check,
  X,
  History,
  ShieldAlert,
} from "lucide-react";

export default function ApplicationDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;

  const [application, setApplication] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [deficiencies, setDeficiencies] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [appRes, defRes, timeRes, eligRes] = await Promise.all([
        fetch(`/api/v1/applications/${applicationId}`).then((r) => r.json()),
        fetch(`/api/v1/applications/${applicationId}/deficiencies`).then((r) => r.json()),
        fetch(`/api/v1/applications/${applicationId}/timeline`).then((r) => r.json()),
        fetch(`/api/v1/eligibility/${applicationId}`).then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (appRes.success) setApplication(appRes.data);
      if (defRes.success) setDeficiencies(defRes.data);
      if (timeRes.success) setTimeline(timeRes.data);
      if (eligRes?.success) setEligibility(eligRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [applicationId]);

  const handleAction = async (actionUrl: string, body = {}) => {
    setActionLoading(true);
    try {
      const res = await fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await res.json();
      await loadAll();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "40px", color: "#64748b" }}>Loading application details...</div>;
  }

  if (!application) {
    return (
      <div style={{ padding: "40px" }}>
        <h2>Application Not Found</h2>
        <Link href="/applications" className="btn btn-secondary" style={{ marginTop: "12px" }}>
          <ArrowLeft size={16} /> Back to Applications
        </Link>
      </div>
    );
  }

  const stages = ["DRAFT", "SUBMITTED", "UNDER_VERIFICATION", "VERIFIED", "SANCTIONED", "PAYMENT_PROCESSING", "PAID"];
  const currentIdx = stages.indexOf(application.status);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/applications" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Back
          </Link>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: "700", color: "#0f2744" }}>
              Application #{application.application_id}
            </h1>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Student: <strong>{application.student_id}</strong> • Scheme: <strong>{application.scholarship_id}</strong>
            </div>
          </div>
        </div>

        <div>
          <span className={`badge badge-${application.status.toLowerCase()}`} style={{ fontSize: "0.9rem", padding: "6px 12px" }}>
            {application.status}
          </span>
        </div>
      </div>

      {/* Lifecycle Stage Progress Bar */}
      <div className="data-card" style={{ padding: "20px" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "#475569", marginBottom: "12px", textTransform: "uppercase" }}>
          Lifecycle State Progression
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          {stages.map((stage, idx) => {
            const isCompleted = currentIdx >= idx;
            const isCurrent = currentIdx === idx;
            return (
              <div key={stage} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2 }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: isCurrent ? "#1a56db" : isCompleted ? "#059669" : "#e2e8f0",
                    color: isCompleted || isCurrent ? "#ffffff" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: "700",
                  }}
                >
                  {isCompleted && !isCurrent ? <Check size={14} /> : idx + 1}
                </div>
                <span style={{ fontSize: "0.7rem", marginTop: "6px", fontWeight: isCurrent ? "700" : "500", color: isCurrent ? "#1a56db" : "#64748b" }}>
                  {stage}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="data-card" style={{ padding: "16px", background: "#f8fafc" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "#334155", marginBottom: "10px" }}>
          Operational Actions (State Dependent):
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {application.status === "DRAFT" && (
            <button
              className="btn btn-primary btn-sm"
              disabled={actionLoading}
              onClick={() => handleAction(`/api/v1/applications/${applicationId}/submit`)}
            >
              Submit Application
            </button>
          )}

          {(application.status === "SUBMITTED" || application.status === "ACTION_REQUIRED" || application.status === "UNDER_VERIFICATION") && (
            <>
              <button
                className="btn btn-primary btn-sm"
                disabled={actionLoading}
                onClick={() => handleAction(`/api/v1/applications/${applicationId}/start-verification`, { scenario: "MATCH" })}
              >
                <Play size={14} /> Run Verification (MATCH)
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={actionLoading}
                onClick={() => handleAction(`/api/v1/applications/${applicationId}/start-verification`, { scenario: "MISMATCH" })}
              >
                Simulate MISMATCH (Action Required)
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={actionLoading}
                onClick={() => handleAction(`/api/v1/applications/${applicationId}/start-verification`, { scenario: "SOURCE_UNAVAILABLE" })}
              >
                Simulate SOURCE_UNAVAILABLE
              </button>
            </>
          )}

          {application.status === "UNDER_REVIEW" && (
            <button
              className="btn btn-success btn-sm"
              disabled={actionLoading}
              onClick={() => handleAction(`/api/v1/applications/${applicationId}/verify`, { reviewerId: "OFFICER_DESK_01" })}
            >
              <Check size={14} /> Desk Approve (Verify)
            </button>
          )}

          {application.status === "VERIFIED" && (
            <button
              className="btn btn-success btn-sm"
              disabled={actionLoading}
              onClick={() => handleAction(`/api/v1/applications/${applicationId}/sanction`, { amount: 52400 })}
            >
              <FileCheck size={14} /> Issue Official Sanction Order
            </button>
          )}

          {application.status === "SANCTIONED" && (
            <button
              className="btn btn-primary btn-sm"
              disabled={actionLoading}
              onClick={() => handleAction(`/api/v1/applications/${applicationId}/payment/initiate`)}
            >
              <CreditCard size={14} /> Dispatch DBT Payment (PFMS)
            </button>
          )}

          {application.status === "PAYMENT_PROCESSING" && application.payment_id && (
            <button
              className="btn btn-success btn-sm"
              disabled={actionLoading}
              onClick={() => handleAction(`/api/v1/payments/${application.payment_id}/simulate`, { status: "SUCCESS" })}
            >
              Simulate PFMS Credit Success
            </button>
          )}

          {application.status !== "PAID" && application.status !== "REJECTED" && (
            <button
              className="btn btn-danger btn-sm"
              disabled={actionLoading}
              onClick={() => handleAction(`/api/v1/applications/${applicationId}/reject`, { reason: "Officer determination of scheme ineligibility" })}
            >
              <X size={14} /> Reject Application
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Eligibility Rule-by-Rule Breakdown */}
        <div className="data-card">
          <div className="card-header">
            <span className="card-title">Eligibility Decision Breakdown</span>
            {eligibility && (
              <span className={`badge ${eligibility.result === "ELIGIBLE" ? "badge-verified" : eligibility.result === "NOT_ELIGIBLE" ? "badge-rejected" : "badge-under_verification"}`}>
                {eligibility.result} ({(eligibility.confidence * 100).toFixed(0)}%)
              </span>
            )}
          </div>
          <div style={{ padding: "16px" }}>
            {!eligibility ? (
              <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
                No eligibility evaluation recorded yet. Run verification to trigger rule engine.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {eligibility.rule_results?.map((r: any) => (
                  <div
                    key={r.rule_code}
                    style={{
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                      background: r.status === "SATISFIED" ? "#f0fdf4" : r.status === "FAILED" ? "#fef2f2" : "#fefce8",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.85rem" }}>{r.rule_code}</strong>
                      <span className={`badge ${r.status === "SATISFIED" ? "badge-verified" : r.status === "FAILED" ? "badge-rejected" : "badge-under_verification"}`}>
                        {r.status}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#334155", marginTop: "4px" }}>
                      {r.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Deficiencies Tracker */}
        <div className="data-card">
          <div className="card-header">
            <span className="card-title">Deficiencies ({deficiencies.length})</span>
          </div>
          <div style={{ padding: "16px" }}>
            {deficiencies.length === 0 ? (
              <div style={{ color: "#059669", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={16} /> No open discrepancies or document deficiencies.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {deficiencies.map((d: any) => (
                  <div
                    key={d.deficiency_id}
                    style={{
                      padding: "12px",
                      borderRadius: "6px",
                      border: "1px solid #fee2e2",
                      background: "#fff5f5",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.85rem", color: "#991b1b" }}>{d.title}</strong>
                      <span className={`badge ${d.status === "RESOLVED" ? "badge-verified" : "badge-action_required"}`}>
                        {d.status}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: "4px" }}>
                      {d.description}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>
                      Required Action: <strong>{d.required_action}</strong>
                    </div>

                    {d.status === "OPEN" && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleAction(`/api/v1/deficiencies/${d.deficiency_id}/resolve`, { note: "Student submitted corrected certificate." })}
                        >
                          Resolve Deficiency
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleAction(`/api/v1/deficiencies/${d.deficiency_id}/waive`, { reason: "Discretionary desk waiver applied." })}
                        >
                          Waive Deficiency
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="data-card" style={{ marginTop: "20px" }}>
        <div className="card-header">
          <span className="card-title">Application Audit Timeline</span>
        </div>
        <div style={{ padding: "16px" }}>
          {timeline.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>No audit records.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {timeline.map((event: any) => (
                <div
                  key={event.audit_event_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge badge-submitted">{event.actor_type}</span>
                      <strong style={{ fontSize: "0.85rem" }}>{event.action}</strong>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Actor: {event.actor_id}</span>
                    </div>
                    {event.reason && (
                      <div style={{ fontSize: "0.8rem", color: "#334155", marginTop: "3px" }}>
                        {event.reason}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
