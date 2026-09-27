"use client";

import React from "react";
import { ShieldCheck, UserCheck } from "lucide-react";

export const Topbar: React.FC = () => {
  return (
    <header className="top-bar">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#334155" }}>
          Tribal Scholarship Decision & Workflow Administration
        </span>
        <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: "700" }}>
          DEMO ENVIRONMENT
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#059669", background: "#d1fae5", padding: "4px 10px", borderRadius: "20px" }}>
          <ShieldCheck size={16} />
          <span>Mock Adapters Active</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderLeft: "1px solid #e2e8f0", paddingLeft: "16px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#0f2744", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: "700" }}>
            RO
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: "600", lineHeight: "1.2" }}>Rijvan Operations</div>
            <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Desk Officer / Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
};
