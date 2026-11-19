import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { HttpTransport } from "../fetch/http-transport.ts";
import { createCareerAdapters } from "../registry.ts";
import { runEnabledPolicySources, runEnabledSources } from "../orchestration/runner.ts";
import { normalizeRawJobs } from "../../data/index.ts";
import { ingestWithRun } from "../../backend/run-ingest.ts";
import {
  POLICY_SOURCE_TIERS,
  writePolicyBatch,
  type PolicySourceTier,
} from "../../backend/policy-repository.ts";
import { sql } from "../../../../packages/backend/src/db.ts";

interface JobRoundRecord {
  readonly source: string;
  readonly phase: "jobs";
  readonly status: string;
  readonly run_id: string;
  readonly collected: number;
  readonly normalized: number;
  readonly rejected: number;
  readonly accepted: number;
  readonly updated: number;
  readonly duplicates: number;
  readonly elapsed_ms: number;
}

interface PolicyRoundRecord {
  readonly source: string;
  readonly phase: "policies";
  readonly status: string;
  readonly collected: number;
  readonly accepted: number;
  readonly updated: number;
  readonly duplicates: number;
  readonly rejected: number;
  readonly elapsed_ms: number;
}

async function ingestJobSources(): Promise<JobRoundRecord[]> {
  const { jobs: adapters } = createCareerAdapters(new HttpTransport());
  const records: JobRoundRecord[] = [];
  for (const adapter of adapters) {
    const started = Date.now();
    const [result] = await runEnabledSources([adapter], { collectEnabled: true });
    if (result === undefined) {
      continue;
    }
    const normalized = normalizeRawJobs(result.jobs);
    if (normalized.normalized.length === 0) {
      records.push({
        source: result.source_key,
        phase: "jobs",
        status: "failed",
        run_id: "",
        collected: result.counts.collected,
        normalized: 0,
        rejected: normalized.rejected.length,
        accepted: 0,
        updated: 0,
        duplicates: 0,
        elapsed_ms: Date.now() - started,
      });
      continue;
    }
    const first = result.jobs[0];
    const ingested = await ingestWithRun(
      sql,
      {
        schema_version: "1.0",
        source_key: result.source_key,
        fetched_at: first?.fetched_at ?? result.attempted_at,
        collector_version: first?.collector_version ?? "collector/0.1.0",
        jobs: normalized.normalized,
      },
      "live",
    );
    records.push({
      source: result.source_key,
      phase: "jobs",
      status: ingested.status,
      run_id: ingested.run_id,
      collected: result.counts.collected,
      normalized: normalized.normalized.length,
      rejected: normalized.rejected.length + ingested.rejected,
      accepted: ingested.accepted,
      updated: ingested.updated,
      duplicates: ingested.duplicates,
      elapsed_ms: Date.now() - started,
    });
  }
  return records;
}

function toPolicySourceTier(value: string, sourceKey: string): PolicySourceTier {
  const tier = POLICY_SOURCE_TIERS.find((candidate) => candidate === value);
  if (tier === undefined) {
    throw new Error(`来源 ${sourceKey} 的 source_tier 不被 backend 支持：${value}`);
  }
  return tier;
}

async function ingestPolicySources(): Promise<PolicyRoundRecord[]> {
  const { policies: adapters } = createCareerAdapters(new HttpTransport());
  const results = await runEnabledPolicySources(adapters, { collectEnabled: true });
  const records: PolicyRoundRecord[] = [];
  for (const result of results) {
    const started = Date.now();
    if (result.policies.length === 0) {
      records.push({
        source: result.source_key,
        phase: "policies",
        status: result.status,
        collected: 0,
        accepted: 0,
        updated: 0,
        duplicates: 0,
        rejected: 0,
        elapsed_ms: Date.now() - started,
      });
      continue;
    }
    const fetchedAt = result.attempted_at;
    const written = await writePolicyBatch(sql, {
      source_key: result.source_key,
      fetched_at: fetchedAt,
      collector_version: "collector/0.1.0",
      data_origin: "live",
      policies: result.policies.map((policy) => ({
        policy_item_id: policy.policy_item_id,
        source_key: result.source_key,
        source_tier: toPolicySourceTier(policy.source_tier, result.source_key),
        title: policy.title,
        issuer: policy.issuer,
        published_at: policy.published_at,
        official_url: policy.official_url,
        theme_ids: [...policy.theme_ids],
        evidence_excerpt: policy.evidence_excerpt,
        content_hash: createHash("sha256")
          .update(`${policy.official_url}\n${policy.evidence_excerpt}`)
          .digest("hex"),
        collector_version: "collector/0.1.0",
        fetched_at: fetchedAt,
      })),
    });
    records.push({
      source: result.source_key,
      phase: "policies",
      status: result.status,
      collected: result.policies.length,
      accepted: written.accepted,
      updated: written.updated,
      duplicates: written.duplicates,
      rejected: written.rejected,
      elapsed_ms: Date.now() - started,
    });
  }
  return records;
}

async function snapshotCounts(): Promise<Record<string, number>> {
  const rows = await sql<{ jobs: number; observations: number; policies: number; runs: number }[]>`
    select
      (select count(*)::int from career_jobs) as jobs,
      (select count(*)::int from career_job_observations) as observations,
      (select count(*)::int from career_policies) as policies,
      (select count(*)::int from career_ingest_runs) as runs
  `;
  return { ...(rows[0] ?? { jobs: 0, observations: 0, policies: 0, runs: 0 }) };
}

async function main(): Promise<void> {
  if (!process.argv.includes("--live")) {
    console.error("默认不入库。确认要采集公开招聘/政策页面并写入 live 数据时，显式加 --live。");
    process.exit(2);
  }
  const startedAt = new Date().toISOString();
  try {
    const jobs = await ingestJobSources();
    const policies = await ingestPolicySources();
    const counts = await snapshotCounts();
    const report = {
      schema_version: "1.0",
      kind: "career-ingest",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      data_origin: "live",
      jobs,
      policies,
      counts,
    };
    const body = `${JSON.stringify(report, null, 2)}\n`;
    const outIndex = process.argv.indexOf("--out");
    const target = outIndex === -1 ? undefined : process.argv[outIndex + 1];
    if (target === undefined) {
      process.stdout.write(body);
    } else {
      writeFileSync(target, body, "utf8");
      process.stdout.write(`evidence written to ${target}\n`);
    }
    const rejected = [...jobs, ...policies].reduce((sum, item) => sum + item.rejected, 0);
    process.exitCode = rejected === 0 ? 0 : 3;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main();