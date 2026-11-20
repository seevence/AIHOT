import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LLM_NORMALIZER_VERSION,
  downgradeNonAiOperations,
  isRerunAipoCandidate,
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

  async listRerunAipoCandidates(limit: number | null): Promise<CareerJobRow[]> {
    return this.jobs
      .filter((item) => isRerunAipoCandidate(item))
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
const aipoOutput = {
  role_family: "ai_product_operations",
  student_friendly: "unknown",
  skills: [],
  experience_min_years: null,
  experience_max_years: null,
};

/** 6 条已被抽检确认为误判的行：title 是传统领域岗，正文只把 AI 当工具。 */
const misjudgedFixtures = [
  {
    id: "014d2041-0000-0000-0000-000000000001",
    title: "拼好饭-区域品牌采购策略",
    raw_text:
      "1、制定拼好饭区域品牌采购业务的短中长期发展规划。\n4、协同产品团队将策略沉淀为一线作业机制与AI工具。" +
      "\n4、熟练使用大模型工具辅助分析作业，有将重复性工作沉淀为工具/Skill的实操经验。",
  },
  {
    id: "8a2655c0-0000-0000-0000-000000000002",
    title: "服务风险客服主管",
    raw_text:
      "1.负责15人左右的组维度管理工作，包括员工日常管理、辅导改善、答疑、复盘。" +
      "\n5.探索AI工具在客服场景的应用，推动智能客服、智能质检等AI能力落地，提升团队运营效率。",
  },
  {
    id: "dacf1a49-0000-0000-0000-000000000003",
    title: "魔方市场用户研究经理（射击线）",
    raw_text:
      "1.负责跟进工作室重点产品全生命周期研发运营过程，深度分析产品问题，建立评估体系。" +
      "\n2.2年以上游戏相关从业经历，市场用户研究/游戏应用与研究/游戏测评经验者优先。",
  },
  {
    id: "50b3a612-0000-0000-0000-000000000004",
    title: "HRSSC智能运营优化专家",
    raw_text:
      "负责统筹公司各项员工服务的一项或多项运营管理工作，以“AI+HR服务”为主线进行政策规则设计。" +
      "\n服务的AI自助化、人机协同（AI做预处理与辅助），让AI成为服务运营的强大生产力。",
  },
  {
    id: "9815e68c-0000-0000-0000-000000000005",
    title: "国际化HR系统实施专家",
    raw_text:
      "把 AI（大模型、Agent、工作流）有效应用到 HR 场景——员工入离职、组织及人员调整。" +
      "\n端到端负责需求分析、流程设计、Agent编排、运营迭代；3年以上toB产品或HRIS经验优先。",
  },
  {
    id: "96c67f5e-0000-0000-0000-000000000006",
    title: "美团会员-权益经营",
    raw_text:
      "1、目标跟踪与经营分析，协助拆解会员各方向的经营目标，输出经营分析报告。" +
      "\n1、3年以上业务运营、经营分析、项目管理或相关岗位经验。",
  },
];

test("--rerun-aipo：6 条已知误判（传统领域岗 + AI 仅作工具）回退 unknown", async () => {
  const store = new MemoryStore(
    misjudgedFixtures.map((fixture) =>
      job({ ...fixture, role_family: "ai_product_operations", normalizer_version: "normalizer/llm-0.1" }),
    ),
  );
  const llm = fakeLlm([aipoOutput]);

  const summary = await runBackfill({ apply: true, limit: null, rerunAipo: true, callLlm: llm.callLlm, store });

  assert.equal(summary.candidates, 6);
  assert.equal(summary.calls, 6);
  assert.equal(summary.changed, 6);
  assert.equal(summary.downgraded, 6);
  for (const fixture of misjudgedFixtures) {
    const row = store.jobs.find((item) => item.id === fixture.id)!;
    assert.equal(row.role_family, "unknown", `${fixture.title} 应回退 unknown`);
    assert.equal(row.normalizer_version, LLM_NORMALIZER_VERSION);
  }
  assert.equal(store.updates.length, 6);
  assert.deepEqual(
    store.updates.map((update) => update.fields.role_family),
    Array.from({ length: 6 }, () => "unknown"),
  );
});

test("真实的 AI 产品运营岗不被后置校验降级", async () => {
  const store = new MemoryStore([
    job({
      id: "a1f03c68-0000-0000-0000-000000000007",
      title: "AI产品运营岗",
      raw_text: "参与美团的各类运营岗位：用户运营、商家及供给运营、内容运营、工具系统运营。",
    }),
  ]);
  const llm = fakeLlm([aipoOutput]);

  const summary = await runBackfill({ apply: true, limit: null, callLlm: llm.callLlm, store });

  assert.equal(summary.downgraded, 0);
  assert.equal(store.jobs[0]!.role_family, "ai_product_operations");
  assert.equal(
    downgradeNonAiOperations(
      { title: "AI产品运营岗", raw_text: "参与美团的各类运营岗位。" },
      { role_family: "ai_product_operations" },
    ).downgraded,
    false,
  );
});

test("正文出现大模型/算法主体职责的传统运营标题不降级", async () => {
  const fixtures = [
    { title: "游戏运营专家", raw_text: "负责大模型产品的运营策略制定与迭代，跟进 Agent 应用落地效果。" },
    { title: "内容运营经理", raw_text: "负责推荐算法的策略运营、效果评估与迭代。" },
  ];
  for (const fixture of fixtures) {
    assert.equal(
      downgradeNonAiOperations({ ...fixture, raw_text: fixture.raw_text }, { role_family: "ai_product_operations" })
        .downgraded,
      false,
      `${fixture.title} 正文含 AI 主体职责，不应降级`,
    );
  }

  const store = new MemoryStore([
    job({ id: "77770000-0000-0000-0000-000000000001", ...fixtures[0]!, role_family: "ai_product_operations" }),
  ]);
  const llm = fakeLlm([aipoOutput]);
  const summary = await runBackfill({ apply: true, limit: null, callLlm: llm.callLlm, store });

  assert.equal(summary.downgraded, 0);
  assert.equal(store.jobs[0]!.role_family, "ai_product_operations");
});

test("--rerun-aipo 重判为 unknown 时撤销既有 aipo；默认回填仍保留既有职族", async () => {
  const row = job({
    id: "99990000-0000-0000-0000-000000000001",
    title: "美团会员-权益经营",
    raw_text: "目标跟踪与经营分析，输出经营分析报告；3年以上业务运营经验。",
    role_family: "ai_product_operations",
    normalizer_version: "normalizer/llm-0.1",
  });
  const store = new MemoryStore([row]);
  const llm = fakeLlm([{ ...aipoOutput, role_family: "unknown" }]);

  const rerun = await runBackfill({ apply: true, limit: null, rerunAipo: true, callLlm: llm.callLlm, store });

  assert.equal(rerun.candidates, 1);
  assert.equal(rerun.changed, 1);
  assert.equal(store.jobs[0]!.role_family, "unknown");

  const defaultStore = new MemoryStore([
    job({
      id: "99990000-0000-0000-0000-000000000002",
      role_family: "data",
      student_friendly: "unknown",
    }),
  ]);
  await runBackfill({ apply: true, limit: null, callLlm: llm.callLlm, store: defaultStore });
  assert.equal(defaultStore.jobs[0]!.role_family, "data");
});

test("--rerun-aipo 只选中嫌疑行，第二次为 0 变更且不再调用模型", async () => {
  const suspect = job({
    id: "88880000-0000-0000-0000-000000000001",
    title: "服务风险客服主管",
    raw_text: "负责客服团队管理；探索AI工具在客服场景的应用，推动智能客服落地。",
    role_family: "ai_product_operations",
    normalizer_version: "normalizer/llm-0.1",
  });
  const aiTitle = job({
    id: "88880000-0000-0000-0000-000000000002",
    title: "AI产品运营岗",
    role_family: "ai_product_operations",
    normalizer_version: "normalizer/llm-0.1",
  });
  const unknownRow = job({ id: "88880000-0000-0000-0000-000000000003", title: "数据分析师" });
  const store = new MemoryStore([suspect, aiTitle, unknownRow]);

  assert.equal(isRerunAipoCandidate(suspect), true);
  assert.equal(isRerunAipoCandidate(aiTitle), false);
  assert.equal(isRerunAipoCandidate(unknownRow), false);

  const llm = fakeLlm([aipoOutput]);
  const first = await runBackfill({ apply: true, limit: null, rerunAipo: true, callLlm: llm.callLlm, store });

  assert.equal(first.candidates, 1);
  assert.equal(first.changed, 1);
  assert.equal(first.downgraded, 1);
  assert.equal(store.updates.length, 1);
  assert.equal(store.updates[0]!.id, suspect.id);
  assert.equal(store.jobs.find((item) => item.id === aiTitle.id)!.role_family, "ai_product_operations");
  assert.equal(store.jobs.find((item) => item.id === unknownRow.id)!.role_family, "unknown");

  const second = await runBackfill({ apply: true, limit: null, rerunAipo: true, callLlm: llm.callLlm, store });
  assert.equal(second.candidates, 0);
  assert.equal(second.changed, 0);
  assert.equal(second.calls, 0);
  assert.equal(llm.calls(), 1);
  assert.equal(store.updates.length, 1);
});