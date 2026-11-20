import { sql, type Db } from "@aihot/backend/db";
import type {
  CareerObservationBatchV1,
  IngestResultV1,
  JobDetailResponseV1,
  JobDetailV1,
  JobFiltersV1,
  JobListItemV1,
  JobListResponseV1,
  ObservationPublicV1,
  SummaryResponseV1,
} from "../contracts/api.ts";
import type { DataOrigin, DegreeLevel, EmploymentType, RoleFamily, StudentFriendly } from "../contracts/index.ts";
import type {
  CareerBriefV1,
  CareerCatalogResponseV1,
  CareerDailyResponseV1,
  CareerHotResponseV1,
  CareerSignalsResponseV1,
} from "../contracts/insights.ts";
import { loadCareerBrief } from "./brief.ts";
import { loadCareerDaily, loadCareerHot, type HotCompanyOptions } from "./career-analytics.ts";
import { loadCareerCatalog, type CareerCatalogOptions } from "./career-catalog.ts";
import { loadCareerSignals, type CareerSignalsOptions } from "./career-signals.ts";
import { DataUnavailableError } from "./errors.ts";
import { ingestBatch } from "./ingest.ts";
import { listPolicies, type PolicyFiltersV1, type PolicyListResponseV1 } from "./policy-read.ts";
import { resolveDataOrigin } from "./provenance.ts";
import type { CareerRepository } from "./repository.ts";
import { buildSummary } from "./summary.ts";

const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const OBSERVATION_LIMIT = 20;
const EXCERPT_LIMIT = 500;
const NOTICE = "当前状态以最近一次成功观测为准；单次未采集到不代表职位已下架。";

// pg connection-level failures: the data is unavailable rather than this request being wrong.
const CONNECTION_ERROR_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "57P03", "53300"]);

const LIST_COLUMNS = sql`
  id, company_name, title, role_family, locations, employment_type, student_friendly,
  skills, published_at, first_seen_at, last_seen_at, official_url`;

const DETAIL_COLUMNS = sql`
  ${LIST_COLUMNS}, source_key, job_key, degree, degree_raw, experience_min_years,
  experience_max_years, experience_raw, skill_evidence, collector_version, data_origin`;

interface JobRow {
  id: string;
  company_name: string;
  title: string;
  role_family: RoleFamily;
  locations: string[] | null;
  employment_type: EmploymentType;
  student_friendly: StudentFriendly;
  skills: string[] | null;
  published_at: string | null;
  first_seen_at: Date;
  last_seen_at: Date;
  official_url: string;
  source_key: string;
  job_key: string;
  degree: DegreeLevel;
  degree_raw: string | null;
  experience_min_years: number | null;
  experience_max_years: number | null;
  experience_raw: string | null;
  skill_evidence: Array<{ skill_id: string; evidence_text: string }> | null;
  collector_version: string;
  data_origin: DataOrigin;
}

interface ObservationRow {
  id: number;
  observed_at: Date;
  content_hash: string;
  collector_version: string;
  source_url: string;
  raw_excerpt: string;
}

function iso(value: Date | null | undefined): string {
  return value === null || value === undefined ? EPOCH_ISO : new Date(value).toISOString();
}

function toListItem(row: JobRow): JobListItemV1 {
  return {
    id: String(row.id),
    company_name: row.company_name,
    title: row.title,
    role_family: row.role_family,
    locations: row.locations ?? [],
    employment_type: row.employment_type,
    student_friendly: row.student_friendly,
    skills: row.skills ?? [],
    published_at: row.published_at,
    first_seen_at: new Date(row.first_seen_at).toISOString(),
    last_seen_at: new Date(row.last_seen_at).toISOString(),
    official_url: row.official_url,
  };
}

function toDetail(row: JobRow): JobDetailV1 {
  return {
    ...toListItem(row),
    source_key: row.source_key,
    job_key: row.job_key,
    degree: row.degree,
    degree_raw: row.degree_raw,
    experience_min_years: row.experience_min_years,
    experience_max_years: row.experience_max_years,
    experience_raw: row.experience_raw,
    skill_evidence: row.skill_evidence ?? [],
    collector_version: row.collector_version,
  };
}

function toObservation(row: ObservationRow): ObservationPublicV1 {
  return {
    id: String(row.id),
    observed_at: new Date(row.observed_at).toISOString(),
    content_hash: row.content_hash,
    collector_version: row.collector_version,
    source_url: row.source_url,
    evidence_excerpt: row.raw_excerpt.slice(0, EXCERPT_LIMIT),
  };
}

function jobFilterCondition(filters: JobFiltersV1): ReturnType<typeof sql> {
  return sql`
    ${filters.role_family === undefined ? sql`` : sql`AND role_family = ${filters.role_family}`}
    ${filters.company === undefined ? sql`` : sql`AND company_name = ${filters.company}`}
    ${filters.city === undefined ? sql`` : sql`AND locations @> to_jsonb(ARRAY[${filters.city}::text])`}
    ${filters.employment_type === undefined ? sql`` : sql`AND employment_type = ${filters.employment_type}`}
    ${filters.student_friendly === undefined ? sql`` : sql`AND student_friendly = ${filters.student_friendly}`}
    ${filters.skill === undefined ? sql`` : sql`AND skills @> to_jsonb(ARRAY[${filters.skill}::text])`}
  `;
}

export class SqlCareerRepository implements CareerRepository {
  private readonly db: Db;

  constructor(db: Db = sql) {
    this.db = db;
  }

  async summary(): Promise<SummaryResponseV1> {
    return this.run(() => buildSummary(this.db));
  }

  async listJobs(filters: JobFiltersV1): Promise<JobListResponseV1> {
    return this.run(async () => {
      const condition = jobFilterCondition(filters);
      const { page, page_size: pageSize } = filters;
      const [rows, totals, latest] = await Promise.all([
        this.db<JobRow[]>`
          SELECT ${LIST_COLUMNS}
          FROM career_jobs
          WHERE TRUE ${condition}
          ORDER BY last_seen_at DESC, id ASC
          LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        this.db<{
          total: number;
          live_count: number;
          import_count: number;
          synthetic_count: number;
        }[]>`
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE data_origin = 'live')::int AS live_count,
                 COUNT(*) FILTER (WHERE data_origin = 'verified_import')::int AS import_count,
                 COUNT(*) FILTER (WHERE data_origin = 'synthetic_fixture')::int AS synthetic_count
          FROM career_jobs
          WHERE TRUE ${condition}`,
        this.db<{ as_of: Date | null }[]>`
          SELECT MAX(last_seen_at) AS as_of
          FROM career_jobs`,
      ]);

      const total = totals[0];
      const dataOrigin = resolveDataOrigin({
        live: total?.live_count ?? 0,
        verified_import: total?.import_count ?? 0,
        synthetic_fixture: total?.synthetic_count ?? 0,
      });

      return {
        contract_version: "0.1",
        data_origin: dataOrigin,
        items: rows.map(toListItem),
        page,
        page_size: pageSize,
        total: total?.total ?? 0,
        as_of: iso(latest[0]?.as_of),
        filters,
      };
    });
  }

  async jobDetail(id: string): Promise<JobDetailResponseV1 | null> {
    return this.run(async () => {
      const rows = await this.db<JobRow[]>`
        SELECT ${DETAIL_COLUMNS}
        FROM career_jobs
        WHERE id = ${id}
        LIMIT 1`;
      const row = rows[0];
      if (row === undefined) return null;

      const observations = await this.db<ObservationRow[]>`
        SELECT id, observed_at, content_hash, collector_version, source_url, raw_excerpt
        FROM career_job_observations
        WHERE job_id = ${id}
        ORDER BY observed_at DESC, id DESC
        LIMIT ${OBSERVATION_LIMIT}`;

      const dataOrigin = resolveDataOrigin({
        live: row.data_origin === "live" ? 1 : 0,
        verified_import: row.data_origin === "verified_import" ? 1 : 0,
        synthetic_fixture: row.data_origin === "synthetic_fixture" ? 1 : 0,
      });

      return {
        contract_version: "0.1",
        data_origin: dataOrigin,
        job: toDetail(row),
        observations: observations.map(toObservation),
        notice: NOTICE,
      };
    });
  }

  async listPolicies(filters: PolicyFiltersV1): Promise<PolicyListResponseV1> {
    return this.run(() => listPolicies(this.db, filters));
  }

  async hotCompanies(options: HotCompanyOptions): Promise<CareerHotResponseV1> {
    return this.run(() => loadCareerHot(this.db, options));
  }

  async dailySummary(): Promise<CareerDailyResponseV1> {
    return this.run(() => loadCareerDaily(this.db));
  }

  async careerSignals(options: CareerSignalsOptions): Promise<CareerSignalsResponseV1> {
    return this.run(() => loadCareerSignals(this.db, options));
  }

  async careerCatalog(options: CareerCatalogOptions): Promise<CareerCatalogResponseV1> {
    return this.run(() => loadCareerCatalog(this.db, options));
  }

  async careerBrief(): Promise<CareerBriefV1 | null> {
    return this.run(() => loadCareerBrief(this.db));
  }

  async writeBatch(batch: CareerObservationBatchV1): Promise<IngestResultV1> {
    return this.run(() => ingestBatch(this.db, batch));
  }

  private async run<T>(read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (error) {
      const code = error instanceof Error ? (error as Error & { code?: unknown }).code : undefined;
      if (typeof code === "string" && CONNECTION_ERROR_CODES.has(code)) throw new DataUnavailableError();
      throw error;
    }
  }
}