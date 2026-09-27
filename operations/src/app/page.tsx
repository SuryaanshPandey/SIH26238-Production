"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  FileText,
  AlertTriangle,
  Users,
  CreditCard,
  Lightbulb,
  CheckCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/stats")
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setStats(res.data);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
        Loading operational KPIs from database...
      </div>
    );
  }

  const apps = stats?.applications || {};
  const ops = stats?.operations || {};
  const payments = stats?.payments || {};
  const schemes = stats?.scholarships || {};

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f2744" }}>
          Operations & Intelligence Command Center
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "4px" }}>
          Real-time state monitoring, eligibility decisions, deficiency queues, DBT disbursement, and tribal beneficiary outreach.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <GraduationCap size={16} color="#1a56db" />
            <span>Active Schemes</span>
          </div>
          <div className="kpi-value">{schemes.active} <span style={{ fontSize: "1rem", color: "#64748b", fontWeight: "normal" }}>/ {schemes.total}</span></div>
          <div className="kpi-subtext">Versioned Ministry Rules</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <FileText size={16} color="#0284c7" />
            <span>Total Applications</span>
          </div>
          <div className="kpi-value">{apps.total}</div>
          <div className="kpi-subtext">{apps.underVerification} Under Verification</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: "4px solid #dc2626" }}>
          <div className="kpi-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertTriangle size={16} color="#dc2626" />
            <span>Action Required</span>
          </div>
          <div className="kpi-value" style={{ color: "#dc2626" }}>{apps.actionRequired}</div>
          <div className="kpi-subtext">{ops.openDeficiencies} Open Deficiencies</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: "4px solid #d97706" }}>
          <div className="kpi-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Users size={16} color="#d97706" />
            <span>Pending Desk Reviews</span>
          </div>
          <div className="kpi-value" style={{ color: "#d97706" }}>{ops.pendingReviews}</div>
          <div className="kpi-subtext">Requires Officer Action</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <CheckCircle size={16} color="#059669" />
            <span>Verified & Sanctioned</span>
          </div>
          <div className="kpi-value">{apps.verified + apps.sanctioned}</div>
          <div className="kpi-subtext">{apps.sanctioned} Sanction Orders Issued</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: "4px solid #059669" }}>
          <div className="kpi-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <CreditCard size={16} color="#059669" />
            <span>DBT Disbursed (Paid)</span>
          </div>
          <div className="kpi-value" style={{ color: "#059669" }}>{apps.paid}</div>
          <div className="kpi-subtext">{payments.processing} In PFMS Pipeline</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: "4px solid #7c3aed" }}>
          <div className="kpi-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Lightbulb size={16} color="#7c3aed" />
            <span>Proactive Candidates</span>
          </div>
          <div className="kpi-value" style={{ color: "#7c3aed" }}>{ops.beneficiaryCandidates}</div>
          <div className="kpi-subtext">Unassisted Eligible Students</div>
        </div>
      </div>

      {/* Operational Workflow Status & Quick Links */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        {/* Recent Audit Timeline Stream */}
        <div className="data-card">
          <div className="card-header">
            <span className="card-title">Live Operational Audit Stream</span>
            <Link href="/audit" className="btn btn-secondary btn-sm">
              View All Audit Events <ArrowRight size={14} />
            </Link>
          </div>
          <div style={{ padding: "16px" }}>
            {stats?.recentAudit?.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: "0.875rem" }}>No audit events recorded yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {stats?.recentAudit?.map((event: any) => (
                  <div
                    key={event.audit_event_id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      padding: "10px",
                      background: "#f8fafc",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="badge badge-submitted">{event.actor_type}</span>
                        <strong style={{ fontSize: "0.85rem" }}>{event.action}</strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>({event.entity_type}: {event.entity_id})</span>
                      </div>
                      {event.reason && (
                        <div style={{ fontSize: "0.8rem", color: "#334155", marginTop: "4px" }}>
                          {event.reason}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Operations Actions */}
        <div className="data-card">
          <div className="card-header">
            <span className="card-title">Quick Actions</span>
          </div>
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link href="/applications" className="btn btn-primary" style={{ justifyContent: "center" }}>
              <FileText size={16} /> Manage Applications
            </Link>
            <Link href="/reviews" className="btn btn-secondary" style={{ justifyContent: "center" }}>
              <Users size={16} /> Review Pending Cases ({ops.pendingReviews})
            </Link>
            <Link href="/deficiencies" className="btn btn-secondary" style={{ justifyContent: "center" }}>
              <AlertTriangle size={16} /> Deficiencies Queue ({ops.openDeficiencies})
            </Link>
            <Link href="/payments" className="btn btn-secondary" style={{ justifyContent: "center" }}>
              <CreditCard size={16} /> Sanctions & DBT Payments
            </Link>
            <Link href="/beneficiaries" className="btn btn-secondary" style={{ justifyContent: "center" }}>
              <Lightbulb size={16} /> Beneficiary Intelligence
            </Link>
            <Link href="/jago-console" className="btn btn-secondary" style={{ justifyContent: "center" }}>
              Test Grounded JAGO AI Assistant
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
