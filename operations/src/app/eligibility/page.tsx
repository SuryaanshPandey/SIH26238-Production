"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Play, Sparkles } from "lucide-react";

export default function EligibilityPage() {
  const [studentId, setStudentId] = useState("stu_demo_001");
  const [scholarshipId, setScholarshipId] = useState("sch_post_matric_st");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleEvaluate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/eligibility/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, scholarshipId }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f2744" }}>
          Deterministic Eligibility Engine Inspector
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
          Rule-driven, zero-hallucination evaluator testing Category, Income, Education Level, AISHE Enrollment, and Verification evidence.
        </p>
      </div>

      {/* Evaluator Controls */}
      <div className="data-card" style={{ padding: "20px", background: "#f8fafc" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "16px", alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>
              Student Profile Reference:
            </label>
            <select className="form-input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="stu_demo_001">stu_demo_001 (Birsa Munda - ST, ₹1.8L Income, UG Forestry)</option>
              <option value="stu_demo_002">stu_demo_002 (Rani Gaidinliu - ST, ₹1.2L Income, Class 10)</option>
              <option value="stu_demo_high_income">stu_demo_high_income (Arjun Gond - ST, ₹6.5L Income - Exceeds Limit)</option>
              <option value="stu_demo_non_st">stu_demo_non_st (Rahul Sharma - GENERAL Category - Ineligible)</option>
              <option value="stu_demo_incomplete">stu_demo_incomplete (Somra Oraon - Incomplete Academic Data)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>
              Target Scholarship Scheme:
            </label>
            <select className="form-input" value={scholarshipId} onChange={(e) => setScholarshipId(e.target.value)}>
              <option value="sch_post_matric_st">Post-Matric Scholarship for ST Students (PMS-ST-2026)</option>
              <option value="sch_pre_matric_st">Pre-Matric Scholarship for ST Students (PRE-ST-2026)</option>
              <option value="sch_higher_ed_st">National Higher Education ST Scholarship (NFST-HIGHER-2026)</option>
              <option value="sch_fellowship_st">National Fellowship for ST Students (NFST-RESEARCH-2026)</option>
              <option value="sch_overseas_st">National Overseas Scholarship (NOS-ST-2026)</option>
            </select>
          </div>

          <button className="btn btn-primary" onClick={handleEvaluate} disabled={loading}>
            <Play size={16} /> {loading ? "Evaluating..." : "Run Engine"}
          </button>
        </div>
      </div>

      {/* Evaluation Results */}
      {result && (
        <div className="data-card">
          <div className="card-header" style={{ background: result.result === "ELIGIBLE" ? "#f0fdf4" : result.result === "NOT_ELIGIBLE" ? "#fef2f2" : "#fefce8" }}>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: "600" }}>
                Overall Determination
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                <span
                  className={`badge ${result.result === "ELIGIBLE" ? "badge-verified" : result.result === "NOT_ELIGIBLE" ? "badge-rejected" : "badge-under_verification"}`}
                  style={{ fontSize: "1rem", padding: "6px 14px" }}
                >
                  {result.result}
                </span>
                <span style={{ fontSize: "0.85rem", color: "#334155" }}>
                  Confidence: <strong>{(result.confidence * 100).toFixed(0)}%</strong> • Rule Version: <strong>{result.ruleVersion}</strong>
                </span>
              </div>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Run ID: {result.evaluationId}
            </div>
          </div>

          <div style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "12px", color: "#0f2744" }}>
              Composable Rule Evaluation Matrix:
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {result.ruleResults?.map((r: any) => (
                <div
                  key={r.ruleCode}
                  style={{
                    padding: "14px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    background: r.status === "SATISFIED" ? "#f8fafc" : r.status === "FAILED" ? "#fff5f5" : "#fefce8",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge badge-submitted">{r.category}</span>
                      <strong style={{ fontSize: "0.9rem" }}>{r.ruleName}</strong>
                      <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#64748b" }}>({r.ruleCode})</span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#334155", marginTop: "6px" }}>
                      {r.reason}
                    </div>
                  </div>

                  <span
                    className={`badge ${r.status === "SATISFIED" ? "badge-verified" : r.status === "FAILED" ? "badge-rejected" : "badge-under_verification"}`}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
