import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { officialScholarshipAggregator, AggregationSummary } from "./OfficialScholarshipAggregator";

export interface SyncSummary { fetched: number; upserted: number; sourceUrl: string; fetchedAt: string; }

/** Compatibility facade retained for callers that still import NspSyncService. */
export class NspSyncService {
  async sync(): Promise<SyncSummary> {
    const summary: AggregationSummary = await officialScholarshipAggregator.syncAll();
    const nsp = summary.sources.find((s) => s.sourceId === "nsp");
    return {
      fetched: nsp?.recordsFound || summary.uniqueRecords,
      upserted: summary.upserted,
      sourceUrl: nsp?.sourceUrl || (process.env.NSP_SOURCE_URL || "https://scholarships.gov.in/All-Scholarships"),
      fetchedAt: summary.fetchedAt,
    };
  }

  async cachedLive() {
    return prisma.scholarship.findMany({
      where: { sourceSystem: { in: ["OFFICIAL_AGGREGATED", "NSP"] } },
      orderBy: [{ status: "asc" }, { applicationEndDate: "asc" }],
    });
  }

  async cachedSnapshot() {
    return prisma.scholarship.findMany({
      where: { sourceSystem: "NSP_SNAPSHOT" },
      orderBy: [{ status: "asc" }, { applicationEndDate: "asc" }],
    });
  }

  /** Retained only as an emergency offline fallback for deployments without a live source. */
  async loadOfficialSnapshot() {
    const filePath = path.join(process.cwd(), "data", "nsp-official-snapshot-2026-09.json");
    if (!fs.existsSync(filePath)) throw new Error(`Official snapshot not found: ${filePath}`);
    const snapshot = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      source: string; snapshot_date: string; records: Array<Record<string, any>>;
    };
    let upserted = 0;
    for (const record of snapshot.records || []) {
      await prisma.scholarship.upsert({
        where: { scholarshipId: record.scholarship_id },
        update: {
          schemeName: record.scheme_name,
          schemeCode: record.scheme_code,
          schemeType: record.scheme_type,
          academicYear: record.academic_year,
          status: record.status,
          jurisdiction: record.jurisdiction,
          applicationStartDate: record.application_start_date ? new Date(record.application_start_date) : null,
          applicationEndDate: record.application_end_date ? new Date(record.application_end_date) : null,
          requiredDocumentTypes: "[]",
          benefitSummary: JSON.stringify({ maximum_amount: 0, source_disclosure: snapshot.source }),
          applicationChannel: "ONLINE_PORTAL",
          sourceSystem: "NSP_SNAPSHOT",
          sourceUrl: snapshot.source,
          sourceFetchedAt: new Date(snapshot.snapshot_date),
        },
        create: {
          scholarshipId: record.scholarship_id,
          schemeName: record.scheme_name,
          schemeCode: record.scheme_code,
          schemeType: record.scheme_type,
          academicYear: record.academic_year,
          status: record.status,
          jurisdiction: record.jurisdiction,
          eligibilityRuleVersion: "OFFICIAL_SNAPSHOT",
          applicationStartDate: record.application_start_date ? new Date(record.application_start_date) : null,
          applicationEndDate: record.application_end_date ? new Date(record.application_end_date) : null,
          requiredDocumentTypes: "[]",
          benefitSummary: JSON.stringify({ maximum_amount: 0, source_disclosure: snapshot.source }),
          applicationChannel: "ONLINE_PORTAL",
          sourceSystem: "NSP_SNAPSHOT",
          sourceUrl: snapshot.source,
          sourceFetchedAt: new Date(snapshot.snapshot_date),
        },
      });
      upserted++;
    }
    return { fetched: snapshot.records?.length || 0, upserted, sourceUrl: snapshot.source, fetchedAt: snapshot.snapshot_date };
  }
}

export const nspSyncService = new NspSyncService();
