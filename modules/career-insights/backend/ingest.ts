import { sql as postgresSql, type Sql, type Tx, type Db } from "@aihot/backend/db";
import type { JSONValue, Parameter } from "postgres";
import type { CareerObservationBatchV1, IngestResultV1 } from "../contracts/api.ts";
import type { DataOrigin, NormalizedJobV1 } from "../contracts/index.ts";
import { validateNormalizedJobV1, type ValidationIssueV1 } from "../data/validate.ts";
import { InvalidParameterError } from "./errors.ts";

const MAX_BATCH_SIZE = 100;
const MAX_REPORTED_ISSUES = 3;
const EXCERPT_LIMIT = 500;

type JobOutcome = "accepted" | "updated" | "duplicates";

export interface IngestContext {
  data_origin?: DataOrigin;
  batch_id?: string | null;
}

const DEFAULT_ORIGIN: DataOrigin = "live";

function isTransaction(db: Db): db is Tx {
  return typeof (db as { savepoint?: unknown }).savepoint === "function";
}

async function inTransaction<T>(db: Db, run: (tx: Db) => Promise<T>): Promise<T> {
  if (isTransaction(db)) return run(db);
  const sqlDb = db as Sql;
  return sqlDb.begin(async (tx) => run(tx)) as unknown as Promise<T>;
}

function jsonColumn(value: unknown): Parameter | null {
  // sql.json marks the value as JSON: a pre-stringified value would make postgres.js encode the
  // string as a JSON scalar, storing a location or skill list as one string instead of an array.
  return value === undefined || value === null ? null : postgresSql.json(value as JSONValue);
}

function describeIssues(issues: readonly ValidationIssueV1[]): string {
  return issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((issue) => (issue.path === "" ? issue.message : `${issue.path}: ${issue.message}`))
    .join("; ");
}

async function writeJob(tx: Db, job: NormalizedJobV1, context: IngestContext): Promise<JobOutcome> {
  const dataOrigin = context.data_origin ?? DEFAULT_ORIGIN;
  const rows = await tx<{ id: string; content_hash: string }[]>`
    SELECT id, content_hash FROM career_jobs
    WHERE source_key = ${job.source_key} AND job_key = ${job.job_key}
    FOR UPDATE`;
  const existing = rows[0];

  let jobId: string;
  let outcome: JobOutcome;

  if (existing === undefined) {
    const inserted = await tx<{ id: string }[]>`
      INSERT INTO career_jobs (
        source_key, job_key, company_name, title, official_url, role_family, degree,
        employment_type, student_friendly, collector_version, content_hash, raw_text,
        degree_raw, experience_raw, published_at, experience_min_years, experience_max_years,
        locations, skills, skill_evidence, raw_payload, data_origin,
        fetched_at, first_seen_at, last_seen_at, created_at, updated_at
      ) VALUES (
        ${job.source_key}, ${job.job_key}, ${job.company_name}, ${job.title}, ${job.official_url},
        ${job.role_family}, ${job.degree}, ${job.employment_type}, ${job.student_friendly},
        ${job.collector_version}, ${job.content_hash}, ${job.raw_text},
        ${job.degree_raw}, ${job.experience_raw}, ${job.published_at},
        ${job.experience_min_years}, ${job.experience_max_years},
        ${jsonColumn(job.locations)}::jsonb, ${jsonColumn(job.skills)}::jsonb,
        ${jsonColumn(job.skill_evidence)}::jsonb, ${jsonColumn(job.raw_payload)}::jsonb,
        ${dataOrigin},
        ${job.fetched_at}::timestamptz, ${job.fetched_at}::timestamptz, ${job.fetched_at}::timestamptz,
        ${job.fetched_at}::timestamptz, ${job.fetched_at}::timestamptz
      )
      RETURNING id`;
    jobId = inserted[0]!.id;
    outcome = "accepted";
  } else if (existing.content_hash === job.content_hash) {
    await tx`
      UPDATE career_jobs
      SET last_seen_at = GREATEST(last_seen_at, ${job.fetched_at}::timestamptz), updated_at = now()
      WHERE id = ${existing.id}`;
    jobId = existing.id;
    outcome = "duplicates";
  } else {
    await tx`
      UPDATE career_jobs SET
        company_name = ${job.company_name},
        title = ${job.title},
        official_url = ${job.official_url},
        role_family = ${job.role_family},
        degree = ${job.degree},
        employment_type = ${job.employment_type},
        student_friendly = ${job.student_friendly},
        collector_version = ${job.collector_version},
        content_hash = ${job.content_hash},
        raw_text = ${job.raw_text},
        degree_raw = ${job.degree_raw},
        experience_raw = ${job.experience_raw},
        published_at = ${job.published_at},
        experience_min_years = ${job.experience_min_years},
        experience_max_years = ${job.experience_max_years},
        locations = ${jsonColumn(job.locations)}::jsonb,
        skills = ${jsonColumn(job.skills)}::jsonb,
        skill_evidence = ${jsonColumn(job.skill_evidence)}::jsonb,
        raw_payload = ${jsonColumn(job.raw_payload)}::jsonb,
        data_origin = ${dataOrigin},
        fetched_at = ${job.fetched_at}::timestamptz,
        last_seen_at = GREATEST(last_seen_at, ${job.fetched_at}::timestamptz),
        updated_at = now()
      WHERE id = ${existing.id}`;
    jobId = existing.id;
    outcome = "updated";
  }

  await tx`
    INSERT INTO career_job_observations (job_id, observed_at, content_hash, collector_version, source_url, raw_excerpt, batch_id)
    VALUES (
      ${jobId}, ${job.fetched_at}::timestamptz, ${job.content_hash}, ${job.collector_version},
      ${job.official_url}, ${job.raw_text.slice(0, EXCERPT_LIMIT)}, ${context.batch_id ?? null}
    )
    ON CONFLICT (job_id, observed_at, content_hash) DO NOTHING`;

  return outcome;
}

export async function ingestBatch(
  db: Db,
  batch: CareerObservationBatchV1,
  context: IngestContext = {},
): Promise<IngestResultV1> {
  if (batch.jobs.length > MAX_BATCH_SIZE) {
    throw new InvalidParameterError(`A batch may contain at most ${MAX_BATCH_SIZE} jobs.`, { parameter: "jobs" });
  }

  const valid: NormalizedJobV1[] = [];
  const errors: IngestResultV1["errors"] = [];
  let rejected = 0;

  batch.jobs.forEach((candidate, index) => {
    const result = validateNormalizedJobV1(candidate);
    if (result.ok) {
      valid.push(result.value);
      return;
    }
    rejected += 1;
    errors.push({ index, code: "validation_failed", message: describeIssues(result.errors) });
  });

  if (valid.length === 0) {
    return { accepted: 0, updated: 0, duplicates: 0, rejected, errors };
  }

  return inTransaction(db, async (tx) => {
    const counts = { accepted: 0, updated: 0, duplicates: 0 };
    for (const job of valid) {
      const outcome = await writeJob(tx, job, context);
      counts[outcome] += 1;
    }
    return { ...counts, rejected, errors };
  });
}