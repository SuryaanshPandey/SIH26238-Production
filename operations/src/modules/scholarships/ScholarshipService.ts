import { nspSyncService } from "./NspSyncService";
import { officialScholarshipAggregator } from "./OfficialScholarshipAggregator";
import { prisma } from "@/lib/prisma";
import { ScholarshipContract, SchemeType } from "@contracts/v1/types";
import { AppError } from "@/shared/errors/AppError";
import { auditService } from "@/modules/audit/AuditService";

export interface CreateScholarshipParams {
  scholarshipId: string;
  schemeName: string;
  schemeCode: string;
  schemeType: SchemeType;
  academicYear: string;
  jurisdiction?: string;
  eligibilityRuleVersion?: string;
  applicationStartDate: string;
  applicationEndDate: string;
  requiredDocumentTypes: string[];
  benefitSummary: Record<string, unknown>;
  applicationChannel?: "ONLINE_PORTAL" | "DIRECT_BENEFIT";
}

const SYNC_TTL_MS = Number(process.env.NSP_SYNC_TTL_MS || 15 * 60 * 1000);
const FAILURE_RETRY_MS = Number(process.env.NSP_FAILURE_RETRY_MS || 60 * 1000);

let lastSyncAt = 0;
let lastSyncAttemptAt = 0;
let syncPromise: Promise<void> | null = null;
let snapshotLoadPromise: Promise<void> | null = null;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export class ScholarshipService {
  async createScholarship(
    params: CreateScholarshipParams,
  ): Promise<ScholarshipContract> {
    const existing = await prisma.scholarship.findFirst({
      where: {
        OR: [
          { scholarshipId: params.scholarshipId },
          { schemeCode: params.schemeCode },
        ],
      },
    });

    if (existing) {
      throw AppError.duplicateOperation(
        `Scholarship with ID '${params.scholarshipId}' or Code '${params.schemeCode}' already exists.`,
      );
    }

    const record = await prisma.scholarship.create({
      data: {
        scholarshipId: params.scholarshipId,
        schemeName: params.schemeName,
        schemeCode: params.schemeCode,
        schemeType: params.schemeType,
        academicYear: params.academicYear,
        status: "ACTIVE",
        jurisdiction:
          params.jurisdiction ||
          "National - Ministry of Tribal Affairs",
        eligibilityRuleVersion:
          params.eligibilityRuleVersion || "v1.0",
        applicationStartDate: new Date(params.applicationStartDate),
        applicationEndDate: new Date(params.applicationEndDate),
        requiredDocumentTypes: JSON.stringify(
          params.requiredDocumentTypes,
        ),
        benefitSummary: JSON.stringify(params.benefitSummary),
        applicationChannel:
          params.applicationChannel || "ONLINE_PORTAL",
        sourceSystem: "LOCAL",
        ruleVersions: {
          create: {
            version: params.eligibilityRuleVersion || "v1.0",
            effectiveFrom: new Date(params.applicationStartDate),
            isActive: true,
            description: "Initial production baseline rules",
          },
        },
      },
    });

    await auditService.log({
      actorType: "ADMIN",
      actorId: "ADMIN_CONSOLE",
      action: "SCHOLARSHIP_CREATED",
      entityType: "SCHOLARSHIP",
      entityId: record.scholarshipId,
      reason: `Created scheme ${record.schemeName}`,
      payload: {
        schemeCode: record.schemeCode,
      },
    });

    return this.mapToContract(record);
  }

  private async startLiveSync(): Promise<Promise<void> | null> {
    // Do not hammer official sources after a recent failed attempt.
    if (Date.now() - lastSyncAttemptAt < FAILURE_RETRY_MS) {
      return syncPromise;
    }

    lastSyncAttemptAt = Date.now();

    if (!syncPromise) {
      syncPromise = (async () => {
        try {
          const summary =
            await officialScholarshipAggregator.syncAll();

          const successfulSources = summary.sources.filter(
            (source) =>
              source.status === "SUCCESS" &&
              source.recordsFound > 0,
          );

          if (
            successfulSources.length > 0 &&
            summary.uniqueRecords > 0
          ) {
            lastSyncAt = Date.now();
          } else {
            lastSyncAt = 0;

            console.warn(
              "[Scholarship Sources] Refresh completed without usable official records; retry window remains open.",
            );
          }
        } catch (error) {
          console.warn(
            "[Scholarship Sources] Live refresh failed; keeping the available official catalogue.",
            error instanceof Error ? error.message : error,
          );
        } finally {
          syncPromise = null;
        }
      })();
    }

    return syncPromise;
  }

  /**
   * Ensures that the production scholarship catalogue is available
   * without making the student-facing request wait on government
   * websites.
   *
   * Priority:
   *
   * 1. Existing live official catalogue
   * 2. Existing official snapshot
   * 3. Bundled official NSP snapshot
   * 4. Background live refresh
   */
  private async ensureRealCatalogue(): Promise<void> {
    if (process.env.REAL_DATA_MODE === "false") {
      return;
    }

    let live = await nspSyncService.cachedLive();
    let snapshot = await nspSyncService.cachedSnapshot();

    // Recover the last successful source refresh time after a process restart.
    if (lastSyncAt === 0) {
      lastSyncAt =
        await officialScholarshipAggregator.latestSuccessfulFetchedAt();
    }

    const liveIsFresh =
      live.length > 0 &&
      lastSyncAt > 0 &&
      Date.now() - lastSyncAt <= SYNC_TTL_MS;

    if (liveIsFresh) {
      return;
    }

    /*
     * IMPORTANT:
     * Never make the Student App wait for external government sites
     * when we already have usable catalogue data.
     *
     * Return immediately from the request and refresh official sources
     * in the background.
     */
    if (live.length > 0 || snapshot.length > 0) {
      void this.startLiveSync();
      return;
    }

    /*
     * Brand-new production database:
     *
     * There is no live catalogue and no snapshot in PostgreSQL yet.
     *
     * The repository already contains a dated official NSP catalogue
     * snapshot:
     *
     * operations/data/nsp-official-snapshot-2026-09.json
     *
     * Load that snapshot first so the very first /scholarships request
     * can return catalogue data immediately instead of waiting for
     * the multi-source government crawl.
     */
    if (!snapshotLoadPromise) {
      snapshotLoadPromise = nspSyncService
        .loadOfficialSnapshot()
        .then(() => undefined)
        .finally(() => {
          snapshotLoadPromise = null;
        });
    }

    try {
      await snapshotLoadPromise;
    } catch (error) {
      console.warn(
        "[Scholarship Sources] Official NSP snapshot fallback could not be loaded:",
        error instanceof Error ? error.message : error,
      );
    }

    /*
     * Re-read the snapshot after loading it.
     *
     * This is important because the initial cachedSnapshot() call happened
     * before the snapshot loader populated the database.
     */
    snapshot = await nspSyncService.cachedSnapshot();

    /*
     * Start the expensive live official-source crawl in the background.
     *
     * The API request does NOT wait for this crawl.
     */
    void this.startLiveSync();

    /*
     * If the snapshot is available, the caller can proceed immediately.
     * listScholarships() will select NSP_SNAPSHOT until live official
     * records are successfully populated.
     */
    if (snapshot.length > 0) {
      return;
    }

    /*
     * No snapshot could be loaded.
     *
     * At this point the background refresh is already running. Waiting
     * here would recreate the timeout problem we are explicitly trying
     * to eliminate, so return and allow listScholarships() to produce
     * the controlled 503 response if there are still no records.
     */
  }

  private async realSourceFilter(): Promise<Record<string, any>> {
    if (process.env.REAL_DATA_MODE === "false") {
      return {};
    }

    const aggregated = await prisma.scholarship.count({
      where: {
        sourceSystem: "OFFICIAL_AGGREGATED",
      },
    });

    if (aggregated > 0) {
      return {
        sourceSystem: "OFFICIAL_AGGREGATED",
      };
    }

    const liveNsp = await prisma.scholarship.count({
      where: {
        sourceSystem: "NSP",
      },
    });

    if (liveNsp > 0) {
      return {
        sourceSystem: "NSP",
      };
    }

    return {
      sourceSystem: "NSP_SNAPSHOT",
    };
  }

  async getScholarship(
    scholarshipId: string,
  ): Promise<ScholarshipContract | null> {
    await this.ensureRealCatalogue();

    // Preserve exact historical/offline IDs referenced by existing applications.
    const record = await prisma.scholarship.findUnique({
      where: {
        scholarshipId,
      },
    });

    return record ? this.mapToContract(record) : null;
  }

  async listScholarships(filters?: {
    status?: string;
    schemeType?: string;
    academicYear?: string;
  }): Promise<ScholarshipContract[]> {
    await this.ensureRealCatalogue();

    const aggregatedCount = await prisma.scholarship.count({
      where: {
        sourceSystem: "OFFICIAL_AGGREGATED",
      },
    });

    const nspCount = await prisma.scholarship.count({
      where: {
        sourceSystem: "NSP",
      },
    });

    const sourceSystems =
      aggregatedCount > 0 || nspCount > 0
        ? ["OFFICIAL_AGGREGATED", "NSP"]
        : ["NSP_SNAPSHOT"];

    const rows = await prisma.scholarship.findMany({
      where: {
        ...(filters?.status
          ? { status: filters.status }
          : {}),
        ...(filters?.schemeType
          ? { schemeType: filters.schemeType }
          : {}),
        ...(filters?.academicYear
          ? { academicYear: filters.academicYear }
          : {}),
        sourceSystem: {
          in: sourceSystems,
        },
      },
      orderBy: [
        {
          applicationEndDate: "asc",
        },
        {
          schemeName: "asc",
        },
      ],
    });

    const precedence = (source: string | null) =>
      source === "OFFICIAL_AGGREGATED"
        ? 0
        : source === "NSP"
          ? 1
          : 2;

    const contracts = rows
      .slice()
      .sort(
        (a, b) =>
          precedence(a.sourceSystem) -
          precedence(b.sourceSystem),
      )
      .map((record) => this.mapToContract(record));

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const seen = new Set<string>();
    const deduped: ScholarshipContract[] = [];

    for (const item of contracts) {
      const jurisdiction = item.jurisdiction.toLowerCase();

      const stateMatch = jurisdiction.match(
        /andhra pradesh|arunachal pradesh|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal pradesh|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal|delhi|jammu and kashmir|ladakh|puducherry|chandigarh/i,
      );

      const key = stateMatch
        ? `${normalize(item.scheme_name)}|${stateMatch[0]}`
        : normalize(item.scheme_name);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      deduped.push(item);
    }

    if (
      process.env.REAL_DATA_MODE !== "false" &&
      !deduped.length
    ) {
      throw new AppError(
        "INTERNAL_ERROR",
        "No official scholarship catalogue records are currently available.",
        503,
      );
    }

    return deduped;
  }

  async activateScholarship(
    scholarshipId: string,
  ): Promise<ScholarshipContract> {
    return this.mapToContract(
      await prisma.scholarship.update({
        where: {
          scholarshipId,
        },
        data: {
          status: "ACTIVE",
        },
      }),
    );
  }

  async deactivateScholarship(
    scholarshipId: string,
  ): Promise<ScholarshipContract> {
    return this.mapToContract(
      await prisma.scholarship.update({
        where: {
          scholarshipId,
        },
        data: {
          status: "INACTIVE",
        },
      }),
    );
  }

  private mapToContract(record: {
    scholarshipId: string;
    schemeName: string;
    schemeCode: string;
    schemeType: string;
    educationLevel?: string | null;
    academicYear: string;
    status: string;
    jurisdiction: string;
    eligibilityRuleVersion: string;
    applicationStartDate: Date | null;
    applicationEndDate: Date | null;
    requiredDocumentTypes: string;
    benefitSummary: string;
    applicationChannel: string;
    createdAt: Date;
    updatedAt: Date;
    sourceSystem?: string | null;
    sourceUrl?: string | null;
    sourceFetchedAt?: Date | null;
    sourceEvidence?: string | null;
    incomeCeiling?: number | null;
    targetGroup?: string | null;
    description?: string | null;
    eligibilitySummary?: string | null;
  }): ScholarshipContract {
    const sourceSystem = record.sourceSystem || "LOCAL";

    const evidence = parseJson<any[]>(
      record.sourceEvidence,
      [],
    );

    const benefits = parseJson<Record<string, unknown>>(
      record.benefitSummary,
      {
        maximum_amount: 0,
      },
    );

    return {
      scholarship_id: record.scholarshipId,
      scheme_name: record.schemeName,
      scheme_code: record.schemeCode,
      scheme_type: record.schemeType as SchemeType,
      education_level: (record.educationLevel ||
        "HIGHER_EDUCATION") as ScholarshipContract["education_level"],
      academic_year: record.academicYear,
      status: record.status as ScholarshipContract["status"],
      jurisdiction: record.jurisdiction,
      eligibility_rule_version:
        record.eligibilityRuleVersion,

      application_start_date:
        record.applicationStartDate
          ? record.applicationStartDate.toISOString()
          : null,

      application_end_date:
        record.applicationEndDate
          ? record.applicationEndDate.toISOString()
          : null,

      required_document_types: parseJson<string[]>(
        record.requiredDocumentTypes,
        [],
      ),

      benefit_summary: {
        maximum_amount: Number(
          benefits.maximum_amount ?? 0,
        ),
        maintenance_allowance_annual: Number(
          benefits.maintenance_allowance_annual ?? 0,
        ),
        tuition_fee_annual:
          benefits.tuition_fee_annual == null
            ? undefined
            : Number(benefits.tuition_fee_annual),
        book_grant_annual:
          benefits.book_grant_annual == null
            ? undefined
            : Number(benefits.book_grant_annual),
        contingency_annual:
          benefits.contingency_annual == null
            ? undefined
            : Number(benefits.contingency_annual),
      },

      application_channel:
        record.applicationChannel as any,

      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),

      source_system: sourceSystem,

      source_url: record.sourceUrl || null,

      source_fetched_at:
        record.sourceFetchedAt
          ? record.sourceFetchedAt.toISOString()
          : null,

      source_mode:
        sourceSystem === "NSP" ||
        sourceSystem === "OFFICIAL_AGGREGATED"
          ? "LIVE"
          : sourceSystem === "NSP_SNAPSHOT"
            ? "SNAPSHOT"
            : undefined,

      source_evidence: evidence,
      source_count: evidence.length,

      description:
        record.description || undefined,

      target_group:
        record.targetGroup || undefined,

      income_ceiling:
        record.incomeCeiling ?? null,

      eligibility_summary:
        record.eligibilitySummary || undefined,
    };
  }
}

export const scholarshipService = new ScholarshipService();
