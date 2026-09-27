"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Users, CheckCircle, XCircle, AlertCircle, Play } from "lucide-react";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [decision, setDecision] = useState<string>("APPROVE");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetch("/api/v1/reviews")
      .then((res) => res.json())
      .then((res) => {
        if (res.success) setReviews(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDecisionSubmit = async () => {
    if (!reason.trim()) {
      alert("Please provide a documented reason for this review decision.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/reviews/${selectedCase.review_id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason, reviewerId: "OFFICER_DESK_01" }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedCase(null);
        setReason("");
        loadData();
      } else {
        alert(data.error?.message || "Decision error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f2744" }}>Manual Review Queue</h1>
        <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
          Desk officer examination workbench for escalated cases, source timeouts, and manual validation.
        </p>
      </div>

      <div className="data-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Review ID & Case Reason</th>
              <th>Application Ref</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Assigned Reviewer</th>
              <th>Decision</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  Loading review cases...
                </td>
              </tr>
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#059669" }}>
                  All manual desk review cases are currently cleared.
                </td>
              </tr>
            ) : (
              reviews.map((r) => (
                <tr key={r.review_id}>
                  <td>
                    <div style={{ fontWeight: "600", color: "#0f2744" }}>{r.review_id}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{r.reason}</div>
                  </td>
                  <td>
                    <Link href={`/applications/${r.application_id}`} style={{ fontWeight: "600", color: "#1a56db" }}>
                      {r.application_id}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge ${r.severity === "HIGH" || r.severity === "CRITICAL" ? "badge-action_required" : "badge-under_verification"}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${r.status === "DECIDED" ? "badge-verified" : "badge-under_review"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>{r.assigned_reviewer || "Unassigned"}</td>
                  <td>
                    {r.decision ? (
                      <span className={`badge ${r.decision === "APPROVE" ? "badge-verified" : "badge-rejected"}`}>
                        {r.decision}
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Pending</span>
                    )}
                  </td>
                  <td>
                    {r.status !== "DECIDED" && (
                      <button className="btn btn-primary btn-sm" onClick={() => setSelectedCase(r)}>
                        Examine & Decide
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Decision Modal */}
      {selectedCase && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div style={{ background: "#ffffff", borderRadius: "8px", width: "500px", padding: "24px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#0f2744" }}>
              Case Examination #{selectedCase.review_id}
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px" }}>
              Application: <strong>{selectedCase.application_id}</strong>
            </p>
            <p style={{ fontSize: "0.85rem", color: "#334155", marginTop: "8px", background: "#f8fafc", padding: "8px", borderRadius: "4px" }}>
              Escalation Reason: {selectedCase.reason}
            </p>

            <div style={{ marginTop: "16px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Officer Decision:
              </label>
              <select className="form-input" value={decision} onChange={(e) => setDecision(e.target.value)}>
                <option value="APPROVE">APPROVE (Verify Application)</option>
                <option value="REJECT">REJECT (Decline Scheme Benefit)</option>
                <option value="REQUEST_CORRECTION">REQUEST_CORRECTION (Ask Student for Update)</option>
                <option value="REQUEST_CLARIFICATION">REQUEST_CLARIFICATION</option>
                <option value="ESCALATE">ESCALATE (To Ministry Level)</option>
              </select>
            </div>

            <div style={{ marginTop: "14px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Documented Decision Justification (Required):
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Enter mandatory justification reason..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button className="btn btn-secondary" onClick={() => setSelectedCase(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleDecisionSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Decision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
