import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  officialScholarshipAggregator,
  AggregationSummary,
} from "./OfficialScholarshipAggregator";

export interface SyncSummary {
  fetched: number;
  upserted: number;
  sourceUrl: string;
  fetchedAt: string;
}

function inferEducationLevel(
  schemeType: string,
): "PRE_MATRIC" | "POST_MATRIC" | "HIGHER_EDUCATION" | "FELLOWSHIP" | "OVERSEAS" {
  switch (schemeType) {
    case "PRE_MATRIC":
      return "PRE_MATRIC";

    case "POST_MATRIC":
      return "POST_MATRIC";

    case "FELLOWSHIP":
      return "FELLOWSHIP";

    case "OVERSEAS":
      return "OVERSEAS";

    case "HIGHER_EDUCATION":
    default:
      return "HIGHER_EDUCATION";
  }
}

/**
 * Compatibility facade retained for callers that still import NspSyncService.
 */
export class NspSyncService {
  async sync(): Promise<SyncSummary> {
    const summary: AggregationSummary =
      await officialScholarshipAggregator.syncAll();

    const nsp = summary.sources.find(
      (source) => source.sourceId === "nsp",
    );

    return {
      fetched: nsp?.recordsFound || summary.uniqueRecords,
      upserted: summary.upserted,
      sourceUrl:
        nsp?.sourceUrl ||
        (process.env.NSP_SOURCE_URL ||
          "https://scholarships.gov.in/All-Scholarships"),
      fetchedAt: summary.fetchedAt,
    };
  }

  async cachedLive() {
    return prisma.scholarship.findMany({
      where: {
        sourceSystem: {
          in: ["OFFICIAL_AGGREGATED", "NSP"],
        },
      },
      orderBy: [
        {
          status: "asc",
        },
        {
          applicationEndDate: "asc",
        },
      ],
    });
  }

  async cachedSnapshot() {
    return prisma.scholarship.findMany({
      where: {
        sourceSystem: "NSP_SNAPSHOT",
      },
      orderBy: [
        {
          status: "asc",
        },
        {
          applicationEndDate: "asc",
        },
      ],
    });
  }

  /**
   * Loads the dated official NSP catalogue snapshot.
   *
   * Important:
   * This snapshot intentionally contains catalogue metadata only.
   * It must not invent benefits, eligibility criteria, documents,
   * income ceilings, or verification evidence.
   */
  async loadOfficialSnapshot() {
    const filePath = path.join(
      process.cwd(),
      "data",
      "nsp-official-snapshot-2026-09.json",
    );

    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Official snapshot not found: ${filePath}`,
      );
    }

    const snapshot = JSON.parse(
      fs.readFileSync(filePath, "utf8"),
    ) as {
      schema_version: number;
      academic_year: string;
      source: string;
      source_label?: string;
      snapshot_date: string;
      disclosure?: string;
      records: Array<Record<string, any>>;
    };

    let upserted = 0;

    for (const record of snapshot.records || []) {
      const schemeType =
        typeof record.scheme_type === "string"
          ? record.scheme_type
          : "HIGHER_EDUCATION";

      const educationLevel = inferEducationLevel(
        schemeType,
      );

      await prisma.scholarship.upsert({
        where: {
          scholarshipId: record.scholarship_id,
        },

        update: {
          schemeName: record.scheme_name,
          schemeCode: record.scheme_code,
          schemeType,
          educationLevel,
          academicYear:
            record.academic_year ||
            snapshot.academic_year.replace(
              /^(\d{4})-(\d{2})$/,
              "$1-20$2",
            ),
          status: record.status,
          jurisdiction: record.jurisdiction,

          applicationStartDate:
            record.application_start_date
              ? new Date(record.application_start_date)
              : null,

          applicationEndDate:
            record.application_end_date
              ? new Date(record.application_end_date)
              : null,

          /*
           * Snapshot disclosure explicitly says these fields are
           * intentionally not inferred.
           */
          requiredDocumentTypes: "[]",

          benefitSummary: JSON.stringify({
            maximum_amount: 0,
            source_disclosure:
              snapshot.disclosure ||
              "Catalogue metadata only. Verify current benefits on the official scheme specification.",
          }),

          applicationChannel: "ONLINE_PORTAL",

          /*
           * Preserve the fact that this is a catalogue snapshot,
           * not a live verified scheme record.
           */
          sourceSystem: "NSP_SNAPSHOT",
          sourceUrl: snapshot.source,

          sourceFetchedAt: new Date(
            snapshot.snapshot_date,
          ),

          eligibilityRuleVersion:
            "OFFICIAL_SNAPSHOT",

          targetGroup: "",
          description:
            "Catalogue metadata captured from the official National Scholarship Portal public catalogue. Verify current scheme details on the official scheme specification before applying.",
          eligibilitySummary:
            "Eligibility criteria are not included in this catalogue snapshot. Verify the current official scheme specification before applying.",
          sourceEvidence: JSON.stringify([]),
          incomeCeiling: null,
        },

        create: {
          scholarshipId: record.scholarship_id,
          schemeName: record.scheme_name,
          schemeCode: record.scheme_code,
          schemeType,
          educationLevel,
          academicYear:
            record.academic_year ||
            snapshot.academic_year.replace(
              /^(\d{4})-(\d{2})$/,
              "$1-20$2",
            ),
          status: record.status,
          jurisdiction: record.jurisdiction,

          eligibilityRuleVersion:
            "OFFICIAL_SNAPSHOT",

          applicationStartDate:
            record.application_start_date
              ? new Date(record.application_start_date)
              : null,

          applicationEndDate:
            record.application_end_date
              ? new Date(record.application_end_date)
              : null,

          requiredDocumentTypes: "[]",

          benefitSummary: JSON.stringify({
            maximum_amount: 0,
            source_disclosure:
              snapshot.disclosure ||
              "Catalogue metadata only. Verify current benefits on the official scheme specification.",
          }),

          applicationChannel: "ONLINE_PORTAL",

          sourceSystem: "NSP_SNAPSHOT",
          sourceUrl: snapshot.source,

          sourceFetchedAt: new Date(
            snapshot.snapshot_date,
          ),

          targetGroup: "",
          description:
            "Catalogue metadata captured from the official National Scholarship Portal public catalogue. Verify current scheme details on the official scheme specification before applying.",
          eligibilitySummary:
            "Eligibility criteria are not included in this catalogue snapshot. Verify the current official scheme specification before applying.",
          sourceEvidence: JSON.stringify([]),
          incomeCeiling: null,
        },
      });

      upserted++;
    }

    return {
      fetched: snapshot.records?.length || 0,
      upserted,
      sourceUrl: snapshot.source,
      fetchedAt: snapshot.snapshot_date,
    };
  }
}

export const nspSyncService = new NspSyncService();
