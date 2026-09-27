"use client";

import React, { useEffect, useState } from "react";
import { History, ShieldCheck, RefreshCw } from "lucide-react";

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    fetch("/api/v1/stats")
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data.recentAudit) {
          setEvents(res.data.recentAudit);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f2744" }}>Operational Audit Trail</h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
            Immutable, tamper-evident log of all application transitions, eligibility runs, review decisions, and payments.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadData}>
          <RefreshCw size={14} /> Refresh Audit Log
        </button>
      </div>

      <div className="data-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp (UTC)</th>
              <th>Actor Type & ID</th>
              <th>Domain Action</th>
              <th>Entity Type & Ref</th>
              <th>Documented Reason / Payload</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  Loading audit trail...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  No audit events recorded.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.audit_event_id}>
                  <td style={{ fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}>
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <span className="badge badge-submitted">{e.actor_type}</span>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>{e.actor_id}</div>
                  </td>
                  <td>
                    <strong style={{ fontSize: "0.85rem", color: "#0f2744" }}>{e.action}</strong>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.8rem", fontWeight: "600" }}>{e.entity_type}</span>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{e.entity_id}</div>
                  </td>
                  <td style={{ fontSize: "0.85rem", color: "#334155" }}>
                    {e.reason || "—"}
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
