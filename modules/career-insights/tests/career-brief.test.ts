// 离线研判：输入只含聚合指标，输出禁止输入外的数字，观测日不足两个时降为 low 并去掉走势断言；
// 缓存的 upsert 幂等与 /brief 路由（无缓存 204）用真库和假模型验证，不访问任何外部服务。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, beforeEach, test } from "node:test";
import Fastify from "fastify";
import { closeDb, sql } from "@aihot/backend/db";
import type { NormalizedJobV1 } from "../contracts/index.ts";
import type { CareerBriefV1 } from "../contracts/insights.ts";
import {
  CareerBriefValidationError,
  composeCareerBrief,
  generateCareerBrief,
  loadCareerBrief,
  type CareerBriefInputV1,
  type CareerBriefLlmCaller,
} from "../backend/brief.ts";
import { registerCareerHttp } from "../backend/http.ts";
import { ingestBatch } from "../backend/ingest.ts";
import type { CareerRepository } from "../backend/repository.ts";
import { NORMALIZER_VERSION } from "../data/normalize.ts";

const JOB_ID = "11111111-1111-1111-1111-111111111111";
const digest = (seed: string) => createHash("sha256").update(seed).digest("hex");

function input(overrides: Partial<CareerBriefInputV1> = {}): CareerBriefInputV1 {
  return {
    as_of: "2026-11-20T00:00:00.000Z",
    window_days: 30,
    sample_size: 12,
    observation_days: 3,
    directions: [],
    titles: [],
    skills: [],
    evidence_candidates: [{ kind: "job", id: JOB_ID, title: "算法工程师" }],
    ...overrides,
  };
}

function draft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    facts: ["当前样本量为 12 个岗位"],
    inferences: ["观察窗 30 天内方向结构保持稳定"],
    actions: ["先补齐常用技能的项目经历"],
    limitations: ["只覆盖已采集的官方岗位"],
    confidence: "medium",
    evidence: [{ kind: "job", id: JOB_ID, title: "模型自己写的标题" }],
    ...overrides,
  };
}

function job(fetchedAt: string): NormalizedJobV1 {
  return {
    schema_version: "1.0",
    normalizer_version: NORMALIZER_VERSION,
    source_key: "career-brief-test",
    job_key: "brief-job-1",
    company_name: "测试科技有限公司",
    title: "算法工程师",
    official_url: "https://careers.example/jobs/brief-job-1",
    role_family: "ai_algorithm",
    locations: ["北京"],
    degree: "bachelor",
    degree_raw: "本科",
    experience_min_years: 0,
    experience_max_years: 3,
    experience_raw: "1-3 年",
    employment_type: "experienced",
    student_friendly: "yes",
    skills: ["python", "大模型"],
    skill_evidence: [
      { skill_id: "python", evidence_text: "熟悉 python" },
      { skill_id: "大模型", evidence_text: "了解大模型" },
    ],
    published_at: null,
    fetched_at: fetchedAt,
    collector_version: "test-collector-1",
    content_hash: digest("brief-job-1"),
    raw_text: "岗位文本",
    raw_payload: { id: "brief-job-1" },
  };
}

async function seedDay(fetchedAt: string): Promise<void> {
  await ingestBatch(sql, {
    schema_version: "1.0",
    source_key: "career-brief-test",
    fetched_at: fetchedAt,
    collector_version: "test-collector-1",
    jobs: [job(fetchedAt)],
  });
}

function fakeRepository(read: () => Promise<CareerBriefV1 | null>): CareerRepository {
  const notUsed = async (): Promise<never> => {
    throw new Error("not used");
  };
  return {
    summary: notUsed,
    listJobs: notUsed,
    jobDetail: notUsed,
    listPolicies: notUsed,
    hotCompanies: notUsed,
    dailySummary: notUsed,
    careerSignals: notUsed,
    careerCatalog: notUsed,
    careerBrief: read,
    writeBatch: notUsed,
  };
}

async function build(repository: CareerRepository) {
  const app = Fastify();
  registerCareerHttp(app, repository);
  await app.ready();
  return app;
}

beforeEach(async () => {
  await sql`TRUNCATE career_briefs, career_job_observations, career_jobs, career_policies, career_ingest_runs RESTART IDENTITY`;
});

after(async () => {
  await closeDb();
});

test("the composed brief keeps the contract shape and rewrites evidence titles from the database", () => {
  const record = composeCareerBrief(input(), draft(), { generated_at: "2026-11-20T01:00:00.000Z" });

  assert.equal(record.contract_version, "0.1");
  assert.equal(record.as_of, "2026-11-20T00:00:00.000Z");
  assert.equal(record.sample_size, 12);
  assert.equal(record.window_days, 30);
  assert.equal(record.confidence, "medium");
  assert.deepEqual(record.evidence, [{ kind: "job", id: JOB_ID, title: "算法工程师" }]);
});

test("facts are cut to 60 characters", () => {
  const record = composeCareerBrief(input(), draft({ facts: ["数".repeat(80)] }), {
    generated_at: "2026-11-20T01:00:00.000Z",
  });

  assert.equal([...record.facts[0]!].length, 60);
});

test("a number absent from the aggregate input rejects the draft", () => {
  assert.throws(
    () => composeCareerBrief(input(), draft({ facts: ["本月新增 999 个岗位"] }), { generated_at: "2026-11-20T01:00:00.000Z" }),
    CareerBriefValidationError,
  );
});

test("evidence ids outside the input candidates are dropped silently", () => {
  const record = composeCareerBrief(
    input(),
    draft({
      evidence: [
        { kind: "job", id: "22222222-2222-2222-2222-222222222222", title: "编造的岗位" },
        { kind: "policy", id: JOB_ID, title: "编造的政策" },
      ],
    }),
    { generated_at: "2026-11-20T01:00:00.000Z" },
  );

  assert.deepEqual(record.evidence, []);
});

test("a single observation day forces low confidence and removes trend claims", () => {
  const record = composeCareerBrief(
    input({ observation_days: 1 }),
    draft({ confidence: "high", inferences: ["需求持续增长", "岗位覆盖三个方向"] }),
    { generated_at: "2026-11-20T01:00:00.000Z" },
  );

  assert.equal(record.confidence, "low");
  assert.equal(record.inferences.some((line) => line.includes("增长")), false);
  assert.equal(record.limitations.some((line) => line.includes("观测日不足")), true);
  assert.equal(record.inferences.some((line) => line.includes("观察窗") || line.includes("置信度")), true);
});

test("stored briefs are read back in contract shape and upserted per (as_of, prompt_version)", async () => {
  await seedDay("2026-11-19T10:00:00.000Z");
  await seedDay("2026-11-20T10:00:00.000Z");

  const seen: CareerBriefInputV1[] = [];
  const callLlm: CareerBriefLlmCaller = async (modelInput) => {
    seen.push(modelInput);
    const candidate = modelInput.evidence_candidates[0]!;
    return {
      draft: draft({
        facts: ["当前样本量为 1 个岗位"],
        evidence: [{ kind: candidate.kind, id: candidate.id, title: "模型自己写的标题" }],
      }),
      receipt_id: 7,
      model: "fake-model",
    };
  };

  assert.equal(await loadCareerBrief(sql), null);

  const first = await generateCareerBrief(sql, callLlm, {
    limit: 6,
    window_days: 30,
    now: () => new Date("2026-11-20T12:00:00.000Z"),
  });
  assert.ok(first !== null);
  assert.equal(seen[0]!.sample_size, 1);
  assert.equal(seen[0]!.observation_days, 2);
  assert.equal(JSON.stringify(seen[0]).includes("测试科技有限公司"), false);

  await generateCareerBrief(sql, callLlm, {
    limit: 6,
    window_days: 30,
    now: () => new Date("2026-11-20T13:00:00.000Z"),
  });

  const counts = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM career_briefs`;
  assert.equal(counts[0]!.count, 1);

  const loaded = await loadCareerBrief(sql);
  assert.ok(loaded !== null);
  assert.equal(loaded.generated_at, "2026-11-20T13:00:00.000Z");
  assert.deepEqual(loaded.evidence, [{ kind: "job", id: seen[0]!.evidence_candidates[0]!.id, title: "算法工程师" }]);
});

test("an empty catalog skips the model and writes nothing", async () => {
  let calls = 0;
  const record = await generateCareerBrief(
    sql,
    async () => {
      calls += 1;
      return { draft: draft() };
    },
    { limit: 6, window_days: 30 },
  );

  assert.equal(record, null);
  assert.equal(calls, 0);
  const counts = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM career_briefs`;
  assert.equal(counts[0]!.count, 0);
});

test("the brief route answers 204 without a cache and 200 with no-store when cached", async () => {
  const cached: CareerBriefV1 = {
    contract_version: "0.1",
    generated_at: "2026-11-20T01:00:00.000Z",
    as_of: "2026-11-20T00:00:00.000Z",
    sample_size: 12,
    window_days: 30,
    facts: ["当前样本量为 12 个岗位"],
    inferences: ["观察窗 30 天内方向结构保持稳定"],
    actions: ["先补齐常用技能的项目经历"],
    evidence: [{ kind: "job", id: JOB_ID, title: "算法工程师" }],
    limitations: ["只覆盖已采集的官方岗位"],
    confidence: "medium",
  };

  const emptyApp = await build(fakeRepository(async () => null));
  const empty = await emptyApp.inject({ method: "GET", url: "/api/site/career-insights/brief" });
  assert.equal(empty.statusCode, 204);
  assert.equal(empty.headers["cache-control"], "no-store");
  assert.equal(empty.body, "");
  await emptyApp.close();

  const cachedApp = await build(fakeRepository(async () => cached));
  const served = await cachedApp.inject({ method: "GET", url: "/api/site/career-insights/brief" });
  assert.equal(served.statusCode, 200);
  assert.equal(served.headers["cache-control"], "no-store");
  assert.deepEqual(served.json(), cached);
  await cachedApp.close();
});

test("the brief route rejects query parameters", async () => {
  const app = await build(fakeRepository(async () => null));
  const response = await app.inject({ method: "GET", url: "/api/site/career-insights/brief?window_days=7" });
  assert.equal(response.statusCode, 400);
  await app.close();
});