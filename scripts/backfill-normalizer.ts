// 一次性回填：把 career_jobs 中仍停留在旧 normalizer 版本的职位行按当前 normalizer 重算派生字段。
// node scripts/backfill-normalizer.ts          默认 dry-run，只统计不写库
// node scripts/backfill-normalizer.ts --apply  在单个事务内写库，失败整体回滚
// 只更新派生的分析字段与 normalizer_version；不写 career_job_observations，不动 last_seen_at /
// content_hash / created_at / degree_raw / experience_raw / locations / raw_text 等来源侧字段。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import postgres, { type JSONValue } from "postgres";
import type { RawCollectedJobV1 } from "../modules/career-insights/contracts/index.ts";
import {
  NORMALIZER_VERSION,
  normalizeRawJob,
} from "../modules/career-insights/data/normalize.ts";
import { validateNormalizedJobV1 } from "../modules/career-insights/data/validate.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

interface JobRow {
  id: string;
  source_key: string;
  company_name: string;
  title: string;
  official_url: string;
  normalizer_version: string;
  role_family: string;
  degree: string;
  employment_type: string;
  student_friendly: string;
  experience_min_years: number | null;
  experience_max_years: number | null;
  degree_raw: string | null;
  experience_raw: string | null;
  skills: string[] | null;
  skill_evidence: Array<{ skill_id: string; evidence_text: string }> | null;
  locations: string[] | null;
  raw_text: string;
  published_at: string | null;
  fetched_at: Date;
  collector_version: string;
}

interface DerivedFields {
  role_family: string;
  degree: string;
  employment_type: string;
  student_friendly: string;
  experience_min_years: number | null;
  experience_max_years: number | null;
  skills: string[];
  skill_evidence: Array<{ skill_id: string; evidence_text: string }>;
  normalizer_version: string;
}

interface PlannedRow {
  row: JobRow;
  before: DerivedFields;
  after: DerivedFields;
}

interface SkippedRow {
  row: JobRow;
  reason: string;
}

function loadDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  const envFile = path.join(REPO_ROOT, ".env");
  if (!existsSync(envFile)) {
    throw new Error(`未设置 DATABASE_URL，且找不到 ${envFile}；请在 .env 里配置 DATABASE_URL。`);
  }
  const parsed = parseEnv(readFileSync(envFile, "utf8"));
  const fromFile = parsed.DATABASE_URL?.trim();
  if (fromFile === undefined || fromFile === "") {
    throw new Error(`${envFile} 中没有 DATABASE_URL。`);
  }
  return fromFile;
}

/** 只用于输出，避免把密码打进日志。 */
function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(DATABASE_URL 无法解析)";
  }
}

/**
 * career_jobs 没有 source_job_id 列，也没有保存采集侧 hints 的原样副本：raw_payload 是来源原始载荷。
 * 因此 hints 只能部分回填——locations / degree_raw / experience_raw 取 DB 现有列，其余按默认值重建，
 * 让标题与正文扫描生效（尤其 role_family 必须重算，不能回灌旧值，否则 0.2.0 的字典修正永远不会生效）。
 */
function rebuildRaw(row: JobRow): RawCollectedJobV1 {
  return {
    schema_version: "1.0",
    source_key: row.source_key,
    source_job_id: null,
    company_name: row.company_name,
    title: row.title,
    official_url: row.official_url,
    raw_text: row.raw_text,
    published_at: row.published_at,
    fetched_at: row.fetched_at.toISOString(),
    collector_version: row.collector_version,
    hints: {
      locations: row.locations ?? [],
      degree_raw: row.degree_raw,
      experience_raw: row.experience_raw,
    },
  };
}

function derivedOf(row: JobRow): DerivedFields {
  return {
    role_family: row.role_family,
    degree: row.degree,
    employment_type: row.employment_type,
    student_friendly: row.student_friendly,
    experience_min_years: row.experience_min_years,
    experience_max_years: row.experience_max_years,
    skills: row.skills ?? [],
    skill_evidence: row.skill_evidence ?? [],
    normalizer_version: row.normalizer_version,
  };
}

function signature(fields: DerivedFields): string {
  return JSON.stringify({
    role_family: fields.role_family,
    degree: fields.degree,
    employment_type: fields.employment_type,
    student_friendly: fields.student_friendly,
    experience_min_years: fields.experience_min_years ?? null,
    experience_max_years: fields.experience_max_years ?? null,
    skills: listKey(fields.skills),
    skill_evidence: evidenceKey(fields.skill_evidence),
    normalizer_version: fields.normalizer_version,
  });
}

function listKey(values: readonly string[]): string {
  return [...new Set(values)].sort().join("\u0000");
}

function evidenceKey(values: ReadonlyArray<{ skill_id: string; evidence_text: string }>): string {
  return values
    .map((item) => `${item.skill_id}\u0000${item.evidence_text}`)
    .sort()
    .join("\n");
}

function countBy(
  rows: readonly PlannedRow[],
  pick: (fields: DerivedFields) => string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of rows) {
    const key = pick(item.after);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function printDistribution(title: string, before: Map<string, number>, after: Map<string, number>) {
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  console.log(`\n${title}（候选行 before → after）`);
  for (const key of keys) {
    console.log(
      `  ${key.padEnd(28)} ${String(before.get(key) ?? 0).padStart(4)} → ${String(after.get(key) ?? 0).padStart(4)}`,
    );
  }
}

function printTransitions(rows: readonly PlannedRow[], dimension: "role_family" | "student_friendly") {
  const moves = new Map<string, number>();
  for (const item of rows) {
    const from = item.before[dimension];
    const to = item.after[dimension];
    if (from === to) continue;
    const key = `${from} → ${to}`;
    moves.set(key, (moves.get(key) ?? 0) + 1);
  }
  console.log(`\n${dimension} 迁移（before → after）`);
  if (moves.size === 0) {
    console.log("  无变化");
    return;
  }
  for (const [key, count] of [...moves.entries()].sort()) {
    console.log(`  ${key}: ${count}`);
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("用法: node scripts/backfill-normalizer.ts [--apply]");
    console.log("  默认 dry-run：只统计将变更的行、分桶对比与跳过原因，不写库。");
    console.log("  --apply：在单个事务内更新派生字段与 normalizer_version，失败整体回滚。");
    return;
  }
  const apply = process.argv.includes("--apply");
  const databaseUrl = loadDatabaseUrl();
  const sql = postgres(databaseUrl, { max: 2, connect_timeout: 10, onnotice: () => {} });

  try {
    const rows = await sql<JobRow[]>`
      SELECT id, source_key, company_name, title, official_url, normalizer_version,
             role_family, degree, employment_type, student_friendly,
             experience_min_years, experience_max_years, degree_raw, experience_raw,
             skills, skill_evidence, locations, raw_text, published_at, fetched_at, collector_version
      FROM career_jobs
      WHERE normalizer_version IS DISTINCT FROM ${NORMALIZER_VERSION}
      ORDER BY source_key, title, id`;

    const planned: PlannedRow[] = [];
    const skipped: SkippedRow[] = [];
    let unchanged = 0;

    for (const row of rows) {
      let after: DerivedFields;
      try {
        const normalized = normalizeRawJob(rebuildRaw(row));
        const checked = validateNormalizedJobV1(normalized);
        if (!checked.ok) {
          const issues = checked.errors
            .slice(0, 3)
            .map((issue) => (issue.path === "" ? issue.message : `${issue.path}: ${issue.message}`))
            .join("; ");
          skipped.push({ row, reason: `校验失败: ${issues}` });
          continue;
        }
        after = {
          role_family: checked.value.role_family,
          degree: checked.value.degree,
          employment_type: checked.value.employment_type,
          student_friendly: checked.value.student_friendly,
          experience_min_years: checked.value.experience_min_years,
          experience_max_years: checked.value.experience_max_years,
          skills: checked.value.skills,
          skill_evidence: checked.value.skill_evidence,
          normalizer_version: checked.value.normalizer_version,
        };
      } catch (error) {
        skipped.push({ row, reason: `重算异常: ${(error as Error).message}` });
        continue;
      }

      const before = derivedOf(row);
      if (signature(before) === signature(after)) {
        unchanged += 1;
        continue;
      }
      planned.push({ row, before, after });
    }

    console.log(`=== normalizer backfill（${apply ? "apply" : "dry-run"}） ===`);
    console.log(`目标版本: ${NORMALIZER_VERSION}`);
    console.log(`数据库:   ${describeDatabase(databaseUrl)}`);
    console.log(`候选行（normalizer_version 与目标不同）: ${rows.length}`);
    console.log(`待变更行: ${planned.length}`);
    console.log(`无需变更行: ${unchanged}`);
    console.log(`跳过行:   ${skipped.length}`);

    const beforeRoleFamily = new Map<string, number>();
    for (const item of planned) {
      const key = item.before.role_family;
      beforeRoleFamily.set(key, (beforeRoleFamily.get(key) ?? 0) + 1);
    }
    const beforeStudentFriendly = new Map<string, number>();
    for (const item of planned) {
      const key = item.before.student_friendly;
      beforeStudentFriendly.set(key, (beforeStudentFriendly.get(key) ?? 0) + 1);
    }
    printDistribution("role_family 桶", beforeRoleFamily, countBy(planned, (f) => f.role_family));
    printDistribution(
      "student_friendly 桶",
      beforeStudentFriendly,
      countBy(planned, (f) => f.student_friendly),
    );
    printTransitions(planned, "role_family");
    printTransitions(planned, "student_friendly");

    if (skipped.length > 0) {
      console.log("\n跳过行及原因（这些行不会被写入）");
      for (const item of skipped) {
        console.log(
          `  ${item.row.source_key} | ${item.row.title} | ${item.row.id} | ${item.reason}`,
        );
      }
    }

    if (planned.length > 0 && planned.length <= 50) {
      console.log("\n待变更明细");
      for (const item of planned) {
        const changed: string[] = [];
        if (item.before.role_family !== item.after.role_family) changed.push("role_family");
        if (item.before.degree !== item.after.degree) changed.push("degree");
        if (item.before.employment_type !== item.after.employment_type) changed.push("employment_type");
        if (item.before.student_friendly !== item.after.student_friendly) changed.push("student_friendly");
        if (item.before.experience_min_years !== item.after.experience_min_years) changed.push("experience_min_years");
        if (item.before.experience_max_years !== item.after.experience_max_years) changed.push("experience_max_years");
        if (listKey(item.before.skills) !== listKey(item.after.skills)) changed.push("skills");
        if (evidenceKey(item.before.skill_evidence) !== evidenceKey(item.after.skill_evidence)) {
          changed.push("skill_evidence");
        }
        console.log(
          `  ${item.row.source_key} | ${item.row.title} | 变更: ${changed.length === 0 ? "仅 normalizer_version" : changed.join(", ")}`,
        );
      }
    }

    console.log("\n重建输入口径与已知限制");
    console.log("  来源字段取自 career_jobs 现有列: raw_text、title、company_name、official_url、published_at、fetched_at、collector_version。");
    console.log("  hints 只能部分回填: locations / degree_raw / experience_raw 使用 DB 现有列；");
    console.log("  career_jobs 未保存 source_job_id 与采集侧 hints 原样副本，raw_payload 是来源原始载荷（不含 hints），");
    console.log("  因此 role_family / employment_type / skill_terms 按默认值重建，由当前 normalizer 从标题与正文扫描；");
    console.log("  旧版本由采集侧 hints 决定的 role_family / employment_type 可能与本轮文本扫描结果不同。");
    console.log("  只写 role_family、degree、employment_type、student_friendly、experience_min/max_years、skills、skill_evidence、normalizer_version、updated_at；");
    console.log("  不写 career_job_observations，不改 last_seen_at、content_hash、created_at、degree_raw、experience_raw、locations、raw_text。");

    if (!apply) {
      console.log("\n未传 --apply，dry-run 结束，未写库。");
      return;
    }

    if (planned.length === 0) {
      console.log("\n没有需要变更的行。");
      return;
    }

    await sql.begin(async (tx) => {
      for (const item of planned) {
        await tx`
          UPDATE career_jobs SET
            role_family = ${item.after.role_family},
            degree = ${item.after.degree},
            employment_type = ${item.after.employment_type},
            student_friendly = ${item.after.student_friendly},
            experience_min_years = ${item.after.experience_min_years},
            experience_max_years = ${item.after.experience_max_years},
            skills = ${sql.json(item.after.skills as JSONValue)}::jsonb,
            skill_evidence = ${sql.json(item.after.skill_evidence as unknown as JSONValue)}::jsonb,
            normalizer_version = ${item.after.normalizer_version},
            updated_at = now()
          WHERE id = ${item.row.id}
            AND normalizer_version IS DISTINCT FROM ${NORMALIZER_VERSION}`;
      }
    });
    console.log(`\n已提交: 更新 ${planned.length} 行，跳过 ${skipped.length} 行。`);
  } catch (error) {
    console.error(`\n失败: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await main();