"use client";

import React, { useEffect, useState } from "react";
import { GraduationCap, CheckCircle, XCircle, Search } from "lucide-react";

export default function ScholarshipsPage() {
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");

  const loadData = () => {
    setLoading(true);
    fetch("/api/v1/scholarships")
      .then((res) => res.json())
      .then((res) => {
        if (res.success) setScholarships(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const endpoint = currentStatus === "ACTIVE" ? `/api/v1/scholarships/${id}/deactivate` : `/api/v1/scholarships/${id}/activate`;
    await fetch(endpoint, { method: "POST" });
    loadData();
  };

  const filtered = scholarships.filter((s) => {
    const matchSearch = s.scheme_name.toLowerCase().includes(searchTerm.toLowerCase()) || s.scheme_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = selectedType ? s.scheme_type === selectedType : true;
    return matchSearch && matchType;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f2744" }}>Scholarship Master Catalog</h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
            Configurable Ministry schemes, versioned eligibility criteria, document requirements, and benefit rules.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: "10px", top: "10px", color: "#94a3b8" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: "32px" }}
            placeholder="Search by scheme name or code (e.g. PMS-ST-2026)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="form-input"
          style={{ width: "200px" }}
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="">All Scheme Types</option>
          <option value="PRE_MATRIC">Pre-Matric</option>
          <option value="POST_MATRIC">Post-Matric</option>
          <option value="HIGHER_EDUCATION">Higher Education</option>
          <option value="FELLOWSHIP">Fellowship</option>
          <option value="OVERSEAS">Overseas</option>
        </select>
      </div>

      {/* Table */}
      <div className="data-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Scheme Name & Code</th>
              <th>Type</th>
              <th>Academic Year</th>
              <th>Rule Version</th>
              <th>Benefit Ceiling</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  Loading scholarship master catalog...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  No scholarship schemes found matching criteria.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.scholarship_id}>
                  <td>
                    <div style={{ fontWeight: "600", color: "#0f2744" }}>{s.scheme_name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Code: {s.scheme_code} • {s.jurisdiction}</div>
                  </td>
                  <td>
                    <span className="badge badge-submitted">{s.scheme_type}</span>
                  </td>
                  <td>{s.academic_year}</td>
                  <td>
                    <span style={{ fontFamily: "monospace", fontWeight: "600" }}>{s.eligibility_rule_version}</span>
                  </td>
                  <td>
                    <strong>₹{(s.benefit_summary?.maximum_amount || 0).toLocaleString("en-IN")}</strong>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Per eligible beneficiary</div>
                  </td>
                  <td>
                    <span className={`badge ${s.status === "ACTIVE" ? "badge-verified" : "badge-rejected"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${s.status === "ACTIVE" ? "btn-secondary" : "btn-primary"}`}
                      onClick={() => handleToggleStatus(s.scholarship_id, s.status)}
                    >
                      {s.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
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
