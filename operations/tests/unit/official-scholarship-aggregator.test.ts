import { describe, expect, it } from "vitest";
import { officialScholarshipTestHelpers } from "@/modules/scholarships/OfficialScholarshipAggregator";

describe("official scholarship parsing", () => {
  it("extracts application dates, income, documents and target group from an official detail page", () => {
    const html = `
      <html><body>
        <h1>Example Post Matric Scholarship Scheme</h1>
        <h2>Details</h2><p>Financial assistance for eligible students.</p>
        <h2>Benefits</h2><p>Up to INR 25,000 per year.</p>
        <h2>Eligibility</h2><p>Scheduled Tribe students. Family income does not exceed ₹2,50,000 per year.</p>
        <h2>Documents Required</h2><p>Aadhaar, Income Certificate, Caste Certificate, Marksheet, Bank Account.</p>
        <h2>Application Process</h2><p>Scheme Open from: 01-07-2026. Student Application Open till: 31-10-2026.</p>
      </body></html>`;
    const def = { id: "test", name: "Test Official", url: "https://example.gov.in/scholarship", kind: "GENERIC" as const, priority: 50, enabled: true };
    const record = officialScholarshipTestHelpers.parseDetailPage(def, def.url, html, "2026-09-27T00:00:00.000Z", "");
    expect(record?.schemeName).toContain("Example Post Matric");
    expect(record?.incomeCeiling).toBe(250000);
    expect(record?.applicationStartDate?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(record?.applicationEndDate?.toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(record?.eligibilitySummary).toMatch(/Scheduled Tribe/i);
    expect(record?.requiredDocumentTypes).toEqual(expect.arrayContaining(["AADHAAR", "INCOME_CERTIFICATE", "CASTE_CERTIFICATE", "MARKSHEET", "BANK_ACCOUNT"]));
    expect(record?.targetGroup).toMatch(/Scheduled Tribe/i);
    expect(record?.benefitSummary.benefit_text).toMatch(/25,000/i);
  });

  it("cleans html entities and classifies fellowship names", () => {
    expect(officialScholarshipTestHelpers.cleanHtml("A&amp;B &nbsp; Scholarship")).toBe("A&B Scholarship");
    expect(officialScholarshipTestHelpers.inferType("National Research Fellowship for PhD Students")).toBe("FELLOWSHIP");
  });

  it("rejects institutional/history pages that are not scholarship schemes", () => {
    const html = `
      <html><head><title>History - The Beginning of Technical Education in India</title></head>
      <body><h1>History - The Beginning of Technical Education in India</h1>
      <p>About the history and development of technical education in India.</p></body></html>`;
    const def = { id: "aicte", name: "All India Council for Technical Education (AICTE)", url: "https://www.aicte-india.org/schemes", kind: "GENERIC" as const, priority: 88, enabled: true };
    expect(officialScholarshipTestHelpers.parseDetailPage(def, "https://www.aicte-india.org/about/history", html, "2026-09-27T00:00:00.000Z", "")).toBeNull();
  });
});


describe("myScheme index parsing", () => {
  it("discovers scheme links from HTML and embedded Next/RSC routes", () => {
    const html = `<a href="/schemes/example-scholarship">Example Scholarship for Students</a>\n      \"/schemes/embedded-fellowship\"`;
    const def = { id: "myscheme", name: "myScheme — Government of India", url: "https://www.myscheme.gov.in/search", kind: "MYSCHEME" as const, priority: 80, enabled: true };
    const parsed = officialScholarshipTestHelpers.parseMySchemeIndex(def, html, "2026-09-27T00:00:00.000Z");
    expect(parsed.links).toContain("https://www.myscheme.gov.in/schemes/example-scholarship");
    expect(parsed.links).toContain("https://www.myscheme.gov.in/schemes/embedded-fellowship");
  });
});


describe("NSP catalogue parsing", () => {
  it("extracts live scheme cards and their specification links", () => {
    const html = `
      <h5>AICTE - Pragati Scholarship Scheme For Girl Students (Technical Degree)</h5>
      <div>Scheme Open from : 01-06-2026 Student Application Open till : 31-10-2026</div>
      <a href="/scheme-details/pragati">Specifications</a>
      <a href="/faq">FAQ</a>`;
    const def = { id: "nsp", name: "National Scholarship Portal (NSP)", url: "https://scholarships.gov.in/All-Scholarships", kind: "NSP" as const, priority: 100, enabled: true };
    const parsed = officialScholarshipTestHelpers.parseNsp(def, html, "2026-09-27T00:00:00.000Z");
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]?.schemeName).toMatch(/Pragati/i);
    expect(parsed.records[0]?.applicationEndDate?.toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(parsed.links).toContain("https://scholarships.gov.in/scheme-details/pragati");
  });
});
