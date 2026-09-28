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

const SYNC_TTL_MS = Number(
  process.env.NSP_SYNC_TTL_MS || 15 * 60 * 1000,
);

const FAILURE_RETRY_MS = Number(
  process.env.NSP_FAILURE_RETRY_MS || 60 * 1000,
);

/*
 * Background crawling of official sources is opt-in. On small hosts
 * (e.g. Render free tier) it can starve the event loop and make
 * health checks time out. Enable with SCHOLARSHIP_AUTO_SYNC=true.
 */
const AUTO_SYNC_ENABLED =
  process.env.SCHOLARSHIP_AUTO_SYNC !== "false";

let lastSyncAt = 0;
let lastSyncAttemptAt = 0;

let syncPromise: Promise<void> | null = null;
let snapshotLoadPromise: Promise<unknown> | null = null;

/*
 * Prevent repeatedly reloading the bundled snapshot on every request.
 *
 * This is intentionally process-local.
 *
 * Whenever Render restarts/redeploys the service, this becomes false again,
 * causing the current official snapshot loader to re-hydrate the database.
 *
 * This fixes existing NSP_SNAPSHOT rows that were originally created before
 * newer snapshot-mapping logic was added, for example education_level.
 */
let snapshotHydrated = false;

function parseJson<T>(
  value: string | null | undefined,
  fallback: T,
): T {
  try {
    return value
      ? (JSON.parse(value) as T)
      : fallback;
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
          {
            scholarshipId: params.scholarshipId,
          },
          {
            schemeCode: params.schemeCode,
          },
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

        applicationStartDate:
          new Date(params.applicationStartDate),

        applicationEndDate:
          new Date(params.applicationEndDate),

        requiredDocumentTypes:
          JSON.stringify(
            params.requiredDocumentTypes,
          ),

        benefitSummary:
          JSON.stringify(
            params.benefitSummary,
          ),

        applicationChannel:
          params.applicationChannel ||
          "ONLINE_PORTAL",

        sourceSystem: "LOCAL",

        ruleVersions: {
          create: {
            version:
              params.eligibilityRuleVersion ||
              "v1.0",

            effectiveFrom:
              new Date(
                params.applicationStartDate,
              ),

            isActive: true,

            description:
              "Initial production baseline rules",
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

  private async startLiveSync(): Promise<
    Promise<void> | null
  > {
    /*
     * Do not hammer official sources after a recent
     * failed attempt.
     */
    if (
      Date.now() - lastSyncAttemptAt <
      FAILURE_RETRY_MS
    ) {
      return syncPromise;
    }

    lastSyncAttemptAt = Date.now();

    if (!syncPromise) {
      syncPromise = (async () => {
        try {
          const summary =
            await officialScholarshipAggregator.syncAll();

          const successfulSources =
            summary.sources.filter(
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
          /*
           * Live government-source crawling must never make
           * the student-facing scholarship endpoint fail when
           * an existing snapshot is available.
           */
          console.warn(
            "[Scholarship Sources] Live refresh failed; keeping the available official catalogue.",
            error instanceof Error
              ? error.message
              : error,
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
   *
   * The bundled snapshot is also re-hydrated once per process so that
   * changes in snapshot mapping logic are applied to existing rows.
   */
  private async ensureRealCatalogue(): Promise<void> {
    if (process.env.REAL_DATA_MODE === "false") {
      return;
    }

    let live =
      await nspSyncService.cachedLive();

    let snapshot =
      await nspSyncService.cachedSnapshot();

    /*
     * Recover the last successful source refresh time
     * after a process restart.
     */
    if (lastSyncAt === 0) {
      lastSyncAt =
        await officialScholarshipAggregator
          .latestSuccessfulFetchedAt();
    }

    /*
     * IMPORTANT:
     *
     * Always perform the bundled snapshot hydration once
     * per running process.
     *
     * This matters even when snapshot rows already exist.
     *
     * Earlier deployments created NSP_SNAPSHOT rows using
     * the previous mapping logic, where education_level could
     * remain HIGHER_EDUCATION because Prisma's default applied.
     *
     * NspSyncService.loadOfficialSnapshot() now explicitly
     * calculates educationLevel from schemeType.
     *
     * Running it once after every Render process start ensures
     * existing snapshot rows are repaired.
     */
    if (!snapshotHydrated) {
      if (!snapshotLoadPromise) {
        snapshotLoadPromise = nspSyncService
          .loadOfficialSnapshot()
          .then(() => {
            snapshotHydrated = true;
          })
          .finally(() => {
            snapshotLoadPromise = null;
          });
      }

      try {
        /*
         * Only the first concurrent request waits for the
         * snapshot hydration.
         *
         * The snapshot loader itself should be quick because
         * it reads the bundled JSON file and performs database
         * upserts.
         */
        await snapshotLoadPromise;
      } catch (error) {
        /*
         * Keep the flag false if loading failed.
         *
         * A later request can retry the hydration.
         */
        snapshotHydrated = false;

        console.warn(
          "[Scholarship Sources] Official NSP snapshot hydration failed:",
          error instanceof Error
            ? error.message
            : error,
        );
      }

      /*
       * Re-read both datasets after hydration because the
       * previous cachedSnapshot() happened before the upserts.
       */
      live =
        await nspSyncService.cachedLive();

      snapshot =
        await nspSyncService.cachedSnapshot();
    }

    const liveIsFresh =
      live.length > 0 &&
      lastSyncAt > 0 &&
      Date.now() - lastSyncAt <= SYNC_TTL_MS;

    /*
     * Fresh live official data is already available.
     */
    if (liveIsFresh) {
      return;
    }

    /*
     * Existing live/snapshot records are usable.
     *
     * Start expensive official-source crawling in the
     * background instead of making the API request wait.
     */
    if (
      live.length > 0 ||
      snapshot.length > 0
    ) {
      if (AUTO_SYNC_ENABLED) {
        void this.startLiveSync();
      }
      return;
    }

    /*
     * No usable records exist.
     *
     * We already attempted snapshot hydration above.
     *
     * Start live refresh in the background.
     * Never block the student-facing request on external
     * government websites.
     */
    if (AUTO_SYNC_ENABLED) {
      void this.startLiveSync();
    }

    /*
     * If no snapshot could be loaded and live data does not
     * exist yet, listScholarships() will return the controlled
     * 503 response instead of causing an upstream timeout.
     */
  }

  private async realSourceFilter(): Promise<
    Record<string, any>
  > {
    if (process.env.REAL_DATA_MODE === "false") {
      return {};
    }

    const aggregated =
      await prisma.scholarship.count({
        where: {
          sourceSystem:
            "OFFICIAL_AGGREGATED",
        },
      });

    if (aggregated > 0) {
      return {
        sourceSystem:
          "OFFICIAL_AGGREGATED",
      };
    }

    const liveNsp =
      await prisma.scholarship.count({
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
      sourceSystem:
        "NSP_SNAPSHOT",
    };
  }

  async getScholarship(
    scholarshipId: string,
  ): Promise<ScholarshipContract | null> {
    await this.ensureRealCatalogue();

    /*
     * Preserve exact historical/offline IDs referenced
     * by existing applications.
     */
    const record =
      await prisma.scholarship.findUnique({
        where: {
          scholarshipId,
        },
      });

    return record
      ? this.mapToContract(record)
      : null;
  }

  async listScholarships(
    filters?: {
      status?: string;
      schemeType?: string;
      academicYear?: string;
    },
  ): Promise<ScholarshipContract[]> {
    await this.ensureRealCatalogue();

    const aggregatedCount =
      await prisma.scholarship.count({
        where: {
          sourceSystem:
            "OFFICIAL_AGGREGATED",
        },
      });

    const nspCount =
      await prisma.scholarship.count({
        where: {
          sourceSystem: "NSP",
        },
      });

    /*
     * Live official sources take precedence over the bundled
     * snapshot whenever they are available.
     *
     * Otherwise use the official NSP snapshot.
     */
    const sourceSystems =
      process.env.REAL_DATA_MODE === "false"
        ? ["LOCAL"]
        : aggregatedCount > 0 ||
            nspCount > 0
          ? [
              "OFFICIAL_AGGREGATED",
              "NSP",
            ]
          : ["NSP_SNAPSHOT"];

    const rows =
      await prisma.scholarship.findMany({
        where: {
          ...(filters?.status
            ? {
                status:
                  filters.status,
              }
            : {}),

          ...(filters?.schemeType
            ? {
                schemeType:
                  filters.schemeType,
              }
            : {}),

          ...(filters?.academicYear
            ? {
                academicYear:
                  filters.academicYear,
              }
            : {}),

          sourceSystem: {
            in: sourceSystems,
          },
        },

        orderBy: [
          {
            applicationEndDate:
              "asc",
          },
          {
            schemeName:
              "asc",
          },
        ],
      });

    const precedence = (
      source: string | null,
    ) =>
      source ===
      "OFFICIAL_AGGREGATED"
        ? 0
        : source === "NSP"
          ? 1
          : 2;

    const contracts =
      rows
        .slice()
        .sort(
          (a, b) =>
            precedence(
              a.sourceSystem,
            ) -
            precedence(
              b.sourceSystem,
            ),
        )
        .map((record) =>
          this.mapToContract(
            record,
          ),
        );

    const normalize = (
      value: string,
    ) =>
      value
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          " ",
        )
        .trim();

    const seen =
      new Set<string>();

    const deduped:
      ScholarshipContract[] = [];

    for (
      const item of contracts
    ) {
      const jurisdiction =
        item.jurisdiction.toLowerCase();

      const stateMatch =
        jurisdiction.match(
          /andhra pradesh|arunachal pradesh|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal pradesh|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal|delhi|jammu and kashmir|ladakh|puducherry|chandigarh/i,
        );

      const key =
        stateMatch
          ? `${normalize(
              item.scheme_name,
            )}|${stateMatch[0]}`
          : normalize(
              item.scheme_name,
            );

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      deduped.push(item);
    }

    if (
      process.env.REAL_DATA_MODE !==
        "false" &&
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

  private mapToContract(
    record: {
      scholarshipId: string;
      schemeName: string;
      schemeCode: string;
      schemeType: string;
      educationLevel?:
        | string
        | null;
      academicYear: string;
      status: string;
      jurisdiction: string;
      eligibilityRuleVersion: string;
      applicationStartDate:
        | Date
        | null;
      applicationEndDate:
        | Date
        | null;
      requiredDocumentTypes: string;
      benefitSummary: string;
      applicationChannel: string;
      createdAt: Date;
      updatedAt: Date;

      sourceSystem?:
        | string
        | null;

      sourceUrl?:
        | string
        | null;

      sourceFetchedAt?:
        | Date
        | null;

      sourceEvidence?:
        | string
        | null;

      incomeCeiling?:
        | number
        | null;

      targetGroup?:
        | string
        | null;

      description?:
        | string
        | null;

      eligibilitySummary?:
        | string
        | null;
    },
  ): ScholarshipContract {
    const sourceSystem =
      record.sourceSystem ||
      "LOCAL";

    const evidence =
      parseJson<any[]>(
        record.sourceEvidence,
        [],
      );

    const benefits =
      parseJson<
        Record<string, unknown>
      >(
        record.benefitSummary,
        {
          maximum_amount: 0,
        },
      );

    return {
      scholarship_id:
        record.scholarshipId,

      scheme_name:
        record.schemeName,

      scheme_code:
        record.schemeCode,

      scheme_type:
        record.schemeType as SchemeType,

      education_level:
        (
          record.educationLevel ||
          "HIGHER_EDUCATION"
        ) as ScholarshipContract[
          "education_level"
        ],

      academic_year:
        record.academicYear,

      status:
        record.status as ScholarshipContract[
          "status"
        ],

      jurisdiction:
        record.jurisdiction,

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

      required_document_types:
        parseJson<string[]>(
          record.requiredDocumentTypes,
          [],
        ),

      benefit_summary: {
        maximum_amount:
          Number(
            benefits.maximum_amount ??
              0,
          ),

        maintenance_allowance_annual:
          Number(
            benefits.maintenance_allowance_annual ??
              0,
          ),

        tuition_fee_annual:
          benefits.tuition_fee_annual ==
          null
            ? undefined
            : Number(
                benefits.tuition_fee_annual,
              ),

        book_grant_annual:
          benefits.book_grant_annual ==
          null
            ? undefined
            : Number(
                benefits.book_grant_annual,
              ),

        contingency_annual:
          benefits.contingency_annual ==
          null
            ? undefined
            : Number(
                benefits.contingency_annual,
              ),
      },

      application_channel:
        record.applicationChannel as any,

      created_at:
        record.createdAt.toISOString(),

      updated_at:
        record.updatedAt.toISOString(),

      source_system:
        sourceSystem,

      source_url:
        record.sourceUrl || null,

      source_fetched_at:
        record.sourceFetchedAt
          ? record.sourceFetchedAt.toISOString()
          : null,

      source_mode:
        sourceSystem === "NSP" ||
        sourceSystem ===
          "OFFICIAL_AGGREGATED"
          ? "LIVE"
          : sourceSystem ===
              "NSP_SNAPSHOT"
            ? "SNAPSHOT"
            : undefined,

      source_evidence:
        evidence,

      source_count:
        evidence.length,

      description:
        record.description ||
        undefined,

      target_group:
        record.targetGroup ||
        undefined,

      income_ceiling:
        record.incomeCeiling ??
        null,

      eligibility_summary:
        record.eligibilitySummary ||
        undefined,
    };
  }
}

export const scholarshipService =
  new ScholarshipService();
