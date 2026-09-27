"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Play, CheckCircle2, AlertCircle, Eye } from "lucide-react";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [runningVerifId, setRunningVerifId] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    fetch(`/api/v1/applications${selectedStatus ? `?status=${selectedStatus}` : ""}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success) setApplications(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus]);

  const handleTriggerVerification = async (applicationId: string, scenario: string) => {
    setRunningVerifId(applicationId);
    try {
      const res = await fetch(`/api/v1/applications/${applicationId}/start-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      }
    } finally {
      setRunningVerifId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    return <span className={`badge badge-${s}`}>{status}</span>;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f2744" }}>Scholarship Applications</h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
            Sole lifecycle state owner. Governs transitions from Draft to Verification, Review, Sanction, and DBT Payment.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto", paddingBottom: "4px" }}>
        {["", "SUBMITTED", "UNDER_VERIFICATION", "ACTION_REQUIRED", "UNDER_REVIEW", "VERIFIED", "SANCTIONED", "PAYMENT_PROCESSING", "PAID", "REJECTED"].map((status) => (
          <button
            key={status}
            className={`btn btn-sm ${selectedStatus === status ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSelectedStatus(status)}
          >
            {status || "All Statuses"}
          </button>
        ))}
      </div>

      {/* Applications Table */}
      <div className="data-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Application ID</th>
              <th>Student Ref</th>
              <th>Scholarship Scheme</th>
              <th>Academic Year</th>
              <th>Current Stage</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  Loading applications...
                </td>
              </tr>
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  No applications found for selected filter.
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
                    <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{app.student_id}</span>
                  </td>
                  <td>{app.scholarship_id}</td>
                  <td>{app.academic_year}</td>
                  <td style={{ fontSize: "0.75rem", color: "#64748b" }}>{app.current_stage}</td>
                  <td>{getStatusBadge(app.status)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <Link href={`/applications/${app.application_id}`} className="btn btn-secondary btn-sm">
                        <Eye size={14} /> View
                      </Link>

                      {(app.status === "SUBMITTED" || app.status === "ACTION_REQUIRED" || app.status === "UNDER_VERIFICATION") && (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={runningVerifId === app.application_id}
                          onClick={() => handleTriggerVerification(app.application_id, "MATCH")}
                        >
                          <Play size={14} /> {runningVerifId === app.application_id ? "Running..." : "Verify (Match)"}
                        </button>
                      )}
                    </div>
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
