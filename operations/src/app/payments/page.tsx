"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function PaymentsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    fetch("/api/v1/applications")
      .then((res) => res.json())
      .then(async (res) => {
        if (res.success) {
          const list: any[] = [];
          for (const app of res.data) {
            const [sancRes, payRes] = await Promise.all([
              fetch(`/api/v1/applications/${app.application_id}/sanction`).then((r) => r.json()).catch(() => null),
              fetch(`/api/v1/applications/${app.application_id}/payment`).then((r) => r.json()).catch(() => null),
            ]);
            list.push({
              ...app,
              sanction: sancRes?.success ? sancRes.data : null,
              payment: payRes?.success ? payRes.data : null,
            });
          }
          setApplications(list);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f2744" }}>Sanctions & Payment Disbursement</h1>
        <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
          Decoupled domain operations: sanction authorization and payment-provider processing. Provider status is shown only when a provider record or callback exists.
        </p>
      </div>

      <div className="data-card">
        <div className="card-header">
          <span className="card-title">Disbursement Pipeline</span>
          <button className="btn btn-secondary btn-sm" onClick={loadData}>
            <RefreshCw size={14} /> Refresh Records
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Application</th>
              <th>Application Status</th>
              <th>Sanction Order Ref</th>
              <th>Sanctioned Amount</th>
              <th>Payment Provider Status</th>
              <th>Payment Provider Reference</th>
              <th>Provider Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  Loading payment pipeline...
                </td>
              </tr>
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  No payment records found.
                </td>
              </tr>
            ) : (
              applications.map((app) => (
                <tr key={app.application_id}>
                  <td>
                    <Link href={`/applications/${app.application_id}`} style={{ fontWeight: "600", color: "#1a56db" }}>
                      {app.application_id}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge badge-${app.status.toLowerCase()}`}>{app.status}</span>
                  </td>
                  <td>
                    {app.sanction ? (
                      <div>
                        <strong>{app.sanction.reference}</strong>
                        <div style={{ fontSize: "0.72rem", color: "#059669" }}>Order Status: {app.sanction.status}</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Not Sanctioned</span>
                    )}
                  </td>
                  <td>
                    {app.sanction ? (
                      <strong>₹{app.sanction.amount.toLocaleString("en-IN")}</strong>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  <td>
                    {app.payment ? (
                      <span
                        className={`badge ${app.payment.status === "SUCCESS" ? "badge-paid" : app.payment.status === "PROCESSING" ? "badge-payment_processing" : "badge-rejected"}`}
                      >
                        {app.payment.status}
                      </span>
                    ) : (
                      <span className="badge badge-draft">NOT_INITIATED</span>
                    )}
                  </td>
                  <td>
                    {app.payment ? (
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{app.payment.payment_reference}</span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  <td>
                    {app.payment?.status === "PROCESSING" && (
                      <span style={{ fontSize: "0.75rem", color: "#475569" }}>Awaiting authorized provider callback</span>
                    )}
                    {app.payment?.status === "SUCCESS" && (
                      <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: "600" }}>✓ Provider reported success</span>
                    )}
                    {app.payment && ["FAILED", "RETURNED"].includes(app.payment.status) && (
                      <span style={{ fontSize: "0.75rem", color: "#b91c1c" }}>Provider reported {app.payment.status.toLowerCase()}</span>
                    )}
                    {!app.payment && (
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>No provider record</span>
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
