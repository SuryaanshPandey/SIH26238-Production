"use client";

import React, { useEffect, useState } from "react";
import { Lightbulb, CheckCircle2, XCircle, AlertCircle, RefreshCw, UserCheck } from "lucide-react";

export default function BeneficiariesPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetch("/api/v1/beneficiaries/candidates")
      .then((res) => res.json())
      .then((res) => {
        if (res.success) setCandidates(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch("/api/v1/beneficiaries/candidates/generate", { method: "POST" });
      loadData();
    } finally {
      setGenerating(false);
    }
  };

  const handleReview = async (candidateId: string, action: string) => {
    await fetch(`/api/v1/beneficiaries/candidates/${candidateId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNotes: `Reviewed by tribal outreach desk: ${action}` }),
    });
    loadData();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f2744" }}>
            Beneficiary Proactive Outreach Intelligence
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
            Identifies unassisted eligible tribal students from institutional registers (AISHE, UDISE+, State Category DBs).
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
          <Lightbulb size={16} /> {generating ? "Scanning..." : "Scan & Discover Candidates"}
        </button>
      </div>

      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "12px 16px", borderRadius: "6px", marginBottom: "20px", fontSize: "0.8rem", color: "#1e40af" }}>
        <strong>Important Operational Principle:</strong> Proactive candidates are potential outreach targets identified by data matching. A candidate is <em>never</em> automatically an entitled beneficiary until full verification and human review are completed.
      </div>

      <div className="data-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Candidate ID & Student Ref</th>
              <th>Potential Scheme</th>
              <th>Matching Evidence & Reason</th>
              <th>Confidence Score</th>
              <th>Outreach Status</th>
              <th>Officer Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  Loading proactive candidates...
                </td>
              </tr>
            ) : candidates.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  No proactive candidates discovered yet. Click "Scan & Discover Candidates".
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c.candidate_id}>
                  <td>
                    <div style={{ fontWeight: "600", color: "#0f2744" }}>{c.candidate_id}</div>
                    <div style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#64748b" }}>{c.student_id}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: "600" }}>{c.scheme_name}</div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>ID: {c.potential_scholarship_id}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.85rem", color: "#334155" }}>{c.reason}</div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "4px" }}>
                      Evidence: {c.evidence_ids?.join(", ")}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "60px", height: "8px", borderRadius: "4px", background: "#e2e8f0", overflow: "hidden" }}>
                        <div style={{ width: `${c.confidence * 100}%`, height: "100%", background: c.confidence > 0.9 ? "#059669" : "#d97706" }} />
                      </div>
                      <span style={{ fontSize: "0.8rem", fontWeight: "700" }}>{(c.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${c.status === "CONFIRMED" ? "badge-verified" : c.status === "NOT_ELIGIBLE" ? "badge-rejected" : "badge-under_review"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    {c.status === "PENDING_REVIEW" ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="btn btn-success btn-sm" onClick={() => handleReview(c.candidate_id, "CONFIRM")}>
                          Confirm
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleReview(c.candidate_id, "MARK_NOT_ELIGIBLE")}>
                          Ineligible
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Reviewed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
