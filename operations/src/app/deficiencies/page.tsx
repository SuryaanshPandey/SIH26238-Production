"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ShieldCheck, Eye } from "lucide-react";

export default function DeficienciesPage() {
  const [deficiencies, setDeficiencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    // Fetch all applications' deficiencies
    fetch("/api/v1/applications")
      .then((res) => res.json())
      .then(async (res) => {
        if (res.success) {
          const allDefs: any[] = [];
          for (const app of res.data) {
            const defRes = await fetch(`/api/v1/applications/${app.application_id}/deficiencies`).then((r) => r.json());
            if (defRes.success && defRes.data.length > 0) {
              allDefs.push(...defRes.data);
            }
          }
          setDeficiencies(allDefs);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResolve = async (deficiencyId: string) => {
    await fetch(`/api/v1/deficiencies/${deficiencyId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Desk officer verified updated documents." }),
    });
    loadData();
  };

  const handleWaive = async (deficiencyId: string) => {
    await fetch(`/api/v1/deficiencies/${deficiencyId}/waive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Discretionary hardship exemption approved by Ministry desk." }),
    });
    loadData();
  };

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f2744" }}>Deficiency & Discrepancy Operations</h1>
        <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
          Active discrepancies generated from Suryaansh verification results or document validation errors.
        </p>
      </div>

      <div className="data-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Deficiency ID & Title</th>
              <th>Application</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Required Action</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  Loading deficiencies queue...
                </td>
              </tr>
            ) : deficiencies.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#059669" }}>
                  <CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: "6px" }} />
                  Zero open deficiencies across all active applications.
                </td>
              </tr>
            ) : (
              deficiencies.map((d) => (
                <tr key={d.deficiency_id}>
                  <td>
                    <div style={{ fontWeight: "600", color: "#0f2744" }}>{d.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{d.description}</div>
                  </td>
                  <td>
                    <Link href={`/applications/${d.application_id}`} style={{ fontWeight: "600", color: "#1a56db" }}>
                      {d.application_id}
                    </Link>
                  </td>
                  <td>
                    <span className="badge badge-submitted">{d.type}</span>
                  </td>
                  <td>
                    <span className={`badge ${d.severity === "HIGH" || d.severity === "CRITICAL" ? "badge-action_required" : "badge-under_verification"}`}>
                      {d.severity}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.8rem", fontWeight: "600" }}>{d.required_action}</td>
                  <td>
                    <span className={`badge ${d.status === "RESOLVED" || d.status === "WAIVED" ? "badge-verified" : "badge-action_required"}`}>
                      {d.status}
                    </span>
                  </td>
                  <td>
                    {d.status === "OPEN" ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="btn btn-success btn-sm" onClick={() => handleResolve(d.deficiency_id)}>
                          Resolve
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleWaive(d.deficiency_id)}>
                          Waive
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "#059669" }}>Closed</span>
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
