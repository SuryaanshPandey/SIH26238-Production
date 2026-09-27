"use client";

import React, { useState } from "react";
import { Bot, Send, ShieldCheck, Sparkles, HelpCircle } from "lucide-react";

export default function JagoConsolePage() {
  const [studentId, setStudentId] = useState("stu_demo_001");
  const [query, setQuery] = useState("Why is my application pending?");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const sampleQueries = [
    { label: "Check Status (English)", text: "Why is my application pending?", lang: "en" },
    { label: "Check Status (Hindi)", text: "मेरी छात्रवृत्ति अर्जी की क्या स्थिति है?", lang: "hi" },
    { label: "Check DBT Payment", text: "Has my scholarship money been disbursed to my bank account?", lang: "en" },
    { label: "Check Deficiencies", text: "Are there any document issues or discrepancies in my application?", lang: "en" },
    { label: "Discover Scholarships", text: "Which scholarship schemes can tribal students apply for?", lang: "en" },
  ];

  const handleQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/jago/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, query, language }),
      });
      const data = await res.json();
      if (data.success) {
        setResponse(data.data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f2744" }}>
          JAGO Grounded Operational AI Testing Console
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
          Autonomous, zero-hallucination assistant backend answering from verified application state and database ground truth.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Query Input Panel */}
        <div className="data-card">
          <div className="card-header">
            <span className="card-title">Simulate Student Query</span>
          </div>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Active Student Identity Ref:
              </label>
              <select className="form-input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="stu_demo_001">stu_demo_001 (Birsa Munda - Active Application)</option>
                <option value="stu_demo_002">stu_demo_002 (Rani Gaidinliu - Pre-Matric)</option>
                <option value="stu_demo_non_st">stu_demo_non_st (Rahul Sharma - General Category)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Language:
              </label>
              <div style={{ display: "flex", gap: "12px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", cursor: "pointer" }}>
                  <input type="radio" checked={language === "en"} onChange={() => setLanguage("en")} /> English (en)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", cursor: "pointer" }}>
                  <input type="radio" checked={language === "hi"} onChange={() => setLanguage("hi")} /> हिन्दी (Hindi)
                </label>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Quick Preset Questions:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {sampleQueries.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setQuery(s.text);
                      setLanguage(s.lang as any);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Student Query Text:
              </label>
              <textarea
                className="form-input"
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask any question about application status, deficiencies, payment..."
              />
            </div>

            <button className="btn btn-primary" onClick={handleQuery} disabled={loading} style={{ justifyContent: "center" }}>
              <Send size={16} /> {loading ? "Querying JAGO Backend..." : "Submit Query to JAGO"}
            </button>
          </div>
        </div>

        {/* JAGO Grounded Response Panel */}
        <div className="data-card">
          <div className="card-header">
            <span className="card-title">JAGO Grounded Output</span>
            {response && (
              <span className="badge badge-verified">
                Intent: {response.intent}
              </span>
            )}
          </div>
          <div style={{ padding: "20px" }}>
            {!response ? (
              <div style={{ color: "#64748b", textAlign: "center", padding: "40px" }}>
                <Bot size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.5 }} />
                Submit a student query to inspect the grounded answer and source citations.
              </div>
            ) : (
              <div>
                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "6px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#1a56db", textTransform: "uppercase", marginBottom: "6px" }}>
                    Assistant Response:
                  </div>
                  <div style={{ fontSize: "1rem", color: "#0f2744", lineHeight: "1.6" }}>
                    {response.response}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>
                    <span style={{ color: "#64748b" }}>Assistance ID:</span>
                    <span style={{ fontFamily: "monospace", fontWeight: "600" }}>{response.assistance_id}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>
                    <span style={{ color: "#64748b" }}>Classified Intent:</span>
                    <strong>{response.intent}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>
                    <span style={{ color: "#64748b" }}>Language Output:</span>
                    <span>{response.language === "hi" ? "हिन्दी (Hindi)" : "English (en)"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Authoritative Citations:</span>
                    <span>{response.source_refs?.join(", ") || "None"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
