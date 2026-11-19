import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LLM_NORMALIZER_VERSION,
  llmNormalizationSchema,
  mapSkillsToKnown,
  needsLlmNormalization,
  runBackfill,
  type CandidateStore,
  type CareerJobRow,
  type LlmCaller,
  type LlmNormalizedFields,
} from "../../../scripts/backfill-normalizer-llm.ts";

interface JobRecord extends CareerJobRow {
  last_seen_at: string;
  content_hash: string;
  created_at: string;
  raw_payload: Record<string, unknown> | null;
}

function job(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: overrides.id ?? "11111111-1111-1111-1111-111111111111",
    title: "机器学习平台工程师",
    raw_text: "负责机器学习平台开发，熟悉 Python 与 SQL，要求 1-3 年经验。",
    degree_raw: "本科",
    experience_raw: "1-3 年经验",
    skills: [],
    experience_min_years: null,
    experience_max_years: null,
    role_family: "unknown",
    student_friendly: "unknown",
    normalizer_version: "normalizer/0.3.0",
    last_seen_at: "2026-11-01T00:00:00.000Z",
    content_hash: "a".repeat(64),
    created_at: "2026-10-01T00:00:00.000Z",
    raw_payload: { source: "fixture" },
    ...overrides,
  };
}

class MemoryStore implements CandidateStore {
  readonly jobs: JobRecord[];
  readonly updates: Array<{ id: string; fields: LlmNormalizedFields }> = [];

  constructor(jobs: readonly JobRecord[]) {
    this.jobs = jobs.map((item) => ({ ...item }));
  }

  async listCandidates(limit: number | null): Promise<CareerJobRow[]> {
    return this.jobs
      .filter((item) => needsLlmNormalization(item) && item.normalizer_version !== LLM_NORMALIZER_VERSION)
      .slice(0, limit ?? undefined)
      .map((item) => ({ ...item }));
  }

  async updateLlmFields(id: string, fields: LlmNormalizedFields): Promise<number> {
    const target = this.jobs.find((item) => item.id === id);
    if (target === undefined) return 0;
    this.updates.push({ id, fields });
    target.role_family = fields.role_family;
    target.student_friendly = fields.student_friendly;
    target.skills = fields.skills;
    target.experience_min_years = fields.experience_min_years;
    target.experience_max_years = fields.experience_max_years;
    target.normalizer_version = LLM_NORMALIZER_VERSION;
    return 1;
  }
}

function fakeLlm(outputs: readonly unknown[]): { callLlm: LlmCaller; calls: () => number; maxActive: () => number } {
  let index = 0;
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  return {
    callLlm: async () => {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const data = outputs[Math.min(index, outputs.length - 1)];
      index += 1;
      active -= 1;
      return { data, usage: { prompt_tokens: 120, completion_tokens: 30 } };
    },
    calls: () => calls,
    maxActive: () => maxActive,
  };
}

const validOutput = {
  role_family: "ai_algorithm",
  student_friendly: "yes",
  skills: ["python", "sql"],
  experience_min_years: 1,
  experience_max_years: 3,
};

test("schema 严格校验：枚举越界、额外字段与 min > max 均判失败", () => {
  assert.equal(llmNormalizationSchema.safeParse(validOutput).success, true);
  assert.equal(llmNormalizationSchema.safeParse({ ...validOutput, role_family: "sales" }).success, false);
  assert.equal(llmNormalizationSchema.safeParse({ ...validOutput, student_friendly: "maybe" }).success, false);
  assert.equal(llmNormalizationSchema.safeParse({ ...validOutput, extra: true }).success, false);
  assert.equal(
    llmNormalizationSchema.safeParse({ ...validOutput, experience_min_years: 5, experience_max_years: 2 }).success,
    false,
  );
});

test("schema 非法行重试一次后跳过，不写库", async () => {
  const store = new MemoryStore([job()]);
  const llm = fakeLlm([{ ...validOutput, role_family: "sales" }]);
  const summary = await runBackfill({ apply: true, limit: null, callLlm: llm.callLlm, store });

  assert.equal(summary.failed, 1);
  assert.equal(summary.schemaRejected, 1);
  assert.equal(summary.changed, 0);
  assert.equal(summary.calls, 2);
  assert.equal(summary.retries, 1);
  assert.equal(summary.usageMissingCalls, 2);
  assert.deepEqual(summary.usage, { prompt_tokens: 0, completion_tokens: 0 });
  assert.equal(store.updates.length, 0);
  assert.equal(store.jobs[0]!.normalizer_version, "normalizer/0.3.0");
  assert.equal(store.jobs[0]!.role_family, "unknown");
});

test("网络失败与 schema 非法分开计数，失败调用 token 标注未计入", async () => {
  const store = new MemoryStore([job()]);
  let calls = 0;
  const callLlm: LlmCaller = async () => {
    calls += 1;
    throw new Error("network down");
  };
  const summary = await runBackfill({ apply: true, limit: null, callLlm, store });

  assert.equal(calls, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.schemaRejected, 0);
  assert.equal(summary.usageMissingCalls, 2);
  assert.deepEqual(summary.usage, { prompt_tokens: 0, completion_tokens: 0 });
  assert.equal(store.updates.length, 0);
});

test("模型给不出结论时既有 skills / 年限 / 已分类枚举不被回退，第二次 0 变更", async () => {
  const store = new MemoryStore([
    job({
      skills: ["machine_learning"],
      experience_min_years: 1,
      experience_max_years: 3,
      role_family: "ai_product_operations",
      student_friendly: "unknown",
    }),
  ]);
  const llm = fakeLlm([
    {
      role_family: "unknown",
      student_friendly: "unknown",
      skills: [],
      experience_min_years: null,
      experience_max_years: null,
    },
  ]);

  const first = await runBackfill({ apply: true, limit: null, callLlm: llm.callLlm, store });

  assert.equal(first.changed, 1);
  const fields = store.updates[0]!.fields;
  assert.deepEqual(fields.skills, ["machine_learning"]);
  assert.equal(fields.role_family, "ai_product_operations");
  assert.equal(fields.experience_min_years, 1);
  assert.equal(fields.experience_max_years, 3);
  assert.equal(fields.student_friendly, "unknown");
  assert.deepEqual(store.jobs[0]!.skills, ["machine_learning"]);
  assert.equal(store.jobs[0]!.role_family, "ai_product_operations");
  assert.equal(store.jobs[0]!.experience_min_years, 1);
  assert.equal(store.jobs[0]!.experience_max_years, 3);

  const second = await runBackfill({ apply: true, limit: null, callLlm: llm.callLlm, store });
  assert.equal(second.candidates, 0);
  assert.equal(second.changed, 0);
  assert.equal(second.calls, 0);
  assert.equal(store.updates.length, 1);
});

test("模型给出的技能与既有 skills 取并集，不丢既有项", async () => {
  const store = new MemoryStore([
    job({ skills: ["machine_learning"], role_family: "ai_algorithm", student_friendly: "unknown" }),
  ]);
  const llm = fakeLlm([{ ...validOutput, skills: ["Python", "machine_learning"] }]);

  const summary = await runBackfill({ apply: true, limit: null, callLlm: llm.callLlm, store });

  assert.equal(summary.changed, 1);
  assert.deepEqual(store.updates[0]!.fields.skills, ["machine_learning", "python"]);
  assert.equal(store.updates[0]!.fields.role_family, "ai_algorithm");
});

test("词表外的技能被丢弃并计数，其余按词表映射", async () => {
  const store = new MemoryStore([job()]);
  const llm = fakeLlm([{ ...validOutput, skills: ["Python", "量子计算", "", "SQL"] }]);
  const summary = await runBackfill({ apply: true, limit: null, callLlm: llm.callLlm, store });

  assert.equal(summary.changed, 1);
  assert.equal(summary.droppedSkillTerms, 2);
  assert.deepEqual(store.updates[0]!.fields.skills, ["python", "sql"]);
  assert.deepEqual(mapSkillsToKnown(["python", "量子计算"]), { skills: ["python"], dropped: ["量子计算"] });
});

test("第二次 --apply 为 0 变更，且不再调用模型", async () => {
  const store = new MemoryStore([job()]);
  const llm = fakeLlm([validOutput]);

  const first = await runBackfill({ apply: true, limit: null, callLlm: llm.callLlm, store });
  assert.equal(first.candidates, 1);
  assert.equal(first.changed, 1);
  assert.equal(llm.calls(), 1);

  const second = await runBackfill({ apply: true, limit: null, callLlm: llm.callLlm, store });
  assert.equal(second.candidates, 0);
  assert.equal(second.changed, 0);
  assert.equal(second.calls, 0);
  assert.equal(llm.calls(), 1);
  assert.equal(store.updates.length, 1);
});

test("只写白名单字段，观测/时间/哈希保持前后一致", async () => {
  const store = new MemoryStore([job()]);
  const before = { ...store.jobs[0]! };
  const llm = fakeLlm([validOutput]);

  await runBackfill({ apply: true, limit: null, callLlm: llm.callLlm, store });

  const after = store.jobs[0]!;
  assert.deepEqual(Object.keys(store.updates[0]!.fields).sort(), [
    "experience_max_years",
    "experience_min_years",
    "role_family",
    "skills",
    "student_friendly",
  ]);
  assert.equal(after.last_seen_at, before.last_seen_at);
  assert.equal(after.content_hash, before.content_hash);
  assert.equal(after.created_at, before.created_at);
  assert.deepEqual(after.raw_payload, before.raw_payload);
  assert.equal(after.normalizer_version, LLM_NORMALIZER_VERSION);
});

test("dry-run 不写库但仍汇总 usage", async () => {
  const store = new MemoryStore([job(), job({ id: "22222222-2222-2222-2222-222222222222", title: "数据分析师" })]);
  const llm = fakeLlm([validOutput]);

  const summary = await runBackfill({ apply: false, limit: 1, callLlm: llm.callLlm, store });

  assert.equal(summary.candidates, 1);
  assert.equal(summary.called, 1);
  assert.equal(summary.changed, 1);
  assert.equal(summary.usage.prompt_tokens, 120);
  assert.equal(summary.usage.completion_tokens, 30);
  assert.equal(store.updates.length, 0);
});

test("并发上限为 3", async () => {
  const store = new MemoryStore(
    Array.from({ length: 7 }, (_, index) =>
      job({ id: `${index}0000000-0000-0000-0000-000000000000`, title: `岗位 ${index}` }),
    ),
  );
  const llm = fakeLlm([validOutput]);

  await runBackfill({ apply: false, limit: null, callLlm: llm.callLlm, store });

  assert.equal(llm.maxActive(), 3);
});