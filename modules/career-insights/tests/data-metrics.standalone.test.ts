import assert from "node:assert/strict";
import { test } from "node:test";
import type { PolicyEvidenceRefV1, RawCollectedJobV1 } from "../contracts/index.ts";
import {
  computeCareerMetrics,
  computeEntryLevelShare,
  computeExperienceDistribution,
  computeJobFamilyShareMetrics,
  computeObservedNewJobsMetric,
  computeSharedThemes,
  computeSkillDemandShareMetrics,
  computeSkillHitRate,
  computeStudentFriendlyShareMetric,
  EXPERIENCE_BUCKETS_V1,
  type DiagnosticJobInputV1,
  type MetricJobInputV1,
  type ObservationSnapshotV1,
} from "../data/metrics.ts";
import { normalizeRawJob, resolveExperience, resolveRoleFamily } from "../data/normalize.ts";

const AS_OF = "2026-11-16T12:00:00.000Z";

function job(overrides: Partial<MetricJobInputV1> = {}): MetricJobInputV1 {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000001",
    source_key: overrides.source_key ?? "alibaba-official-careers",
    job_key: overrides.job_key ?? "job-001",
    company_name: overrides.company_name ?? "示例公司",
    title: overrides.title ?? "AI 算法工程师",
    role_family: overrides.role_family ?? "ai_algorithm",
    locations: overrides.locations ?? ["北京"],
    degree: overrides.degree ?? "master",
    employment_type: overrides.employment_type ?? "experienced",
    student_friendly: overrides.student_friendly ?? "unknown",
    skills: overrides.skills ?? ["python", "large_language_models"],
    published_at: overrides.published_at ?? "2026-11-10T00:00:00.000Z",
    first_seen_at: overrides.first_seen_at ?? "2026-11-15T00:00:00.000Z",
    last_seen_at: overrides.last_seen_at ?? AS_OF,
    official_url: overrides.official_url ?? "https://careers.example/jobs/1",
  };
}

function policy(themeIds: string[]): PolicyEvidenceRefV1 {
  return {
    policy_item_id: `policy-${themeIds.join("-")}`,
    title: "人工智能相关政策",
    issuer: "国务院",
    published_at: "2026-08-26",
    official_url: "https://www.gov.cn/zhengce/example",
    source_tier: "national",
    theme_ids: themeIds,
    evidence_excerpt: "推动人工智能与实体经济深度融合。",
  };
}

const TWO_SNAPSHOTS: ObservationSnapshotV1[] = [
  { observed_at: "2026-11-15T00:00:00.000Z", job_ids: ["a"] },
  { observed_at: "2026-11-16T00:00:00.000Z", job_ids: ["a", "b"] },
];

test("空样本时占比指标全部 insufficient_data，不返回 0", () => {
  const familyMetrics = computeJobFamilyShareMetrics([], { as_of: AS_OF });
  assert.equal(familyMetrics.length, 5);
  for (const metric of familyMetrics) {
    assert.equal(metric.status, "insufficient_data");
    assert.equal(metric.value, null);
    assert.equal(metric.denominator_count, 0);
  }

  const skillMetrics = computeSkillDemandShareMetrics([], { as_of: AS_OF });
  assert.equal(skillMetrics.length, 1);
  assert.equal(skillMetrics[0]?.status, "insufficient_data");
  assert.equal(skillMetrics[0]?.value, null);

  const student = computeStudentFriendlyShareMetric([], { as_of: AS_OF });
  assert.equal(student.status, "insufficient_data");
  assert.equal(student.value, null);
});

test("职族占比保留 unknown 并单独披露未知数量", () => {
  const metrics = computeJobFamilyShareMetrics(
    [
      job({ id: "a", role_family: "ai_algorithm" }),
      job({ id: "b", role_family: "data" }),
      job({ id: "c", role_family: "unknown" }),
    ],
    { as_of: AS_OF },
  );

  const algorithm = metrics.find((metric) => metric.dimension.role_family === "ai_algorithm");
  assert.equal(algorithm?.value, 1 / 3);
  assert.equal(algorithm?.numerator_count, 1);
  assert.equal(algorithm?.denominator_count, 3);
  assert.equal(algorithm?.unknown_count, 1);
  assert.equal(algorithm?.unknown_ratio, 1 / 3);
  assert.equal(algorithm?.evidence.length, 1);
  assert.equal(algorithm?.evidence[0]?.kind, "job");
});

test("技能占比按技能独立计算，合计可以超过 100%", () => {
  const metrics = computeSkillDemandShareMetrics(
    [
      job({ id: "a", skills: ["python", "large_language_models"] }),
      job({ id: "b", skills: ["python"] }),
    ],
    { as_of: AS_OF },
  );

  const python = metrics.find((metric) => metric.dimension.skill_id === "python");
  const llm = metrics.find((metric) => metric.dimension.skill_id === "large_language_models");

  assert.equal(python?.value, 1);
  assert.equal(llm?.value, 0.5);
  assert.equal((python?.value ?? 0) + (llm?.value ?? 0), 1.5);
  assert.equal(python?.dictionary_version, "0.1");
  assert.equal(python?.unknown_count, 0);
});

test("学生友好占比把 unknown 计入分母并返回未知比例", () => {
  const metric = computeStudentFriendlyShareMetric(
    [
      job({ id: "a", student_friendly: "yes" }),
      job({ id: "b", student_friendly: "unknown" }),
      job({ id: "c", student_friendly: "no" }),
      job({ id: "d", student_friendly: "yes" }),
    ],
    { as_of: AS_OF },
  );

  assert.equal(metric.value, 0.5);
  assert.equal(metric.numerator_count, 2);
  assert.equal(metric.denominator_count, 4);
  assert.equal(metric.unknown_count, 1);
  assert.equal(metric.unknown_ratio, 0.25);
  assert.equal(metric.evidence.length, 2);
});

test("单快照时观测新增为 insufficient_data，不返回 0 或趋势", () => {
  const metric = computeObservedNewJobsMetric(
    [job({ id: "a" })],
    [{ observed_at: AS_OF, job_ids: ["a"] }],
    { as_of: AS_OF },
  );

  assert.equal(metric.status, "insufficient_data");
  assert.equal(metric.value, null);
  assert.equal(metric.denominator_count, null);
});

test("两个快照时观测新增按观察窗起点计算首次发现", () => {
  const metric = computeObservedNewJobsMetric(
    [
      job({ id: "a", first_seen_at: "2026-11-10T00:00:00.000Z" }),
      job({ id: "b", first_seen_at: "2026-11-16T00:00:00.000Z" }),
    ],
    TWO_SNAPSHOTS,
    { as_of: AS_OF },
  );

  assert.equal(metric.status, "ok");
  assert.equal(metric.value, 1);
  assert.equal(metric.numerator_count, 1);
  assert.equal(metric.denominator_count, null);
  assert.equal(metric.evidence[0]?.id, "b");
});

test("共享主题只返回政策与职位同时具备证据的方向", () => {
  const shared = computeSharedThemes(
    [policy(["artificial_intelligence", "data_infrastructure"])],
    [
      job({ id: "a", skills: ["large_language_models"], role_family: "ai_algorithm" }),
      job({ id: "b", skills: ["sql"], role_family: "data" }),
    ],
  );

  assert.deepEqual(
    shared.map((theme) => theme.theme_id).sort(),
    ["artificial_intelligence", "data_infrastructure"],
  );
  for (const theme of shared) {
    assert.ok(theme.policy_count > 0);
    assert.ok(theme.job_count > 0);
    assert.ok(theme.policies.length > 0);
    assert.ok(theme.jobs.length > 0);
  }
});

test("共享主题指标承载列表状态且不编码数值", () => {
  const shared = computeSharedThemes(
    [policy(["artificial_intelligence"])],
    [job({ id: "a", role_family: "ai_algorithm", skills: ["large_language_models"] })],
  );

  const result = computeCareerMetrics({
    jobs: [job({ id: "a", role_family: "ai_algorithm", skills: ["large_language_models"] })],
    snapshots: TWO_SNAPSHOTS,
    policies: [policy(["artificial_intelligence"])],
    options: { as_of: AS_OF },
  });

  const themeMetric = result.metrics.find(
    (metric) => metric.metric_id === "policy_job_shared_themes",
  );

  assert.equal(result.shared_themes.length, shared.length);
  assert.equal(themeMetric?.status, "ok");
  assert.equal(themeMetric?.value, null);
  assert.equal(themeMetric?.unit, "theme_list");
  assert.equal(themeMetric?.numerator_count, shared.length);
  assert.ok((themeMetric?.evidence.length ?? 0) >= 2);
});

test("computeCareerMetrics 返回五项指标且顺序固定", () => {
  const result = computeCareerMetrics({
    jobs: [job({ id: "a" })],
    snapshots: [],
    policies: [],
    options: { as_of: AS_OF },
  });

  const ids = result.metrics.map((metric) => metric.metric_id);
  assert.deepEqual(ids.slice(0, 5), [
    "job_family_share",
    "job_family_share",
    "job_family_share",
    "job_family_share",
    "job_family_share",
  ]);
  assert.ok(ids.includes("student_friendly_share"));
  assert.ok(ids.includes("observed_new_jobs"));
  assert.ok(ids.includes("policy_job_shared_themes"));
  assert.equal(ids.at(-1), "policy_job_shared_themes");
});
function tencentRaw(
  title: string,
  experienceRaw: string | null,
  skillTerms: string[] = [],
): RawCollectedJobV1 {
  return {
    schema_version: "1.0",
    source_key: "tencent-official-careers",
    source_job_id: title,
    company_name: "腾讯",
    title,
    official_url: "https://careers.tencent.com/jobdesc.html?postId=2095412225996140544",
    raw_text: "",
    published_at: "2026-11-18",
    fetched_at: "2026-11-18T00:00:00.000Z",
    collector_version: "test/1.0",
    hints: {
      role_family: "unknown",
      ...(experienceRaw === null ? {} : { experience_raw: experienceRaw }),
      skill_terms: skillTerms,
    },
  };
}

test("中文经验短语解析为年份，未写经验不回填 0 或经验不限", () => {
  assert.deepEqual(resolveExperience("两年以上工作经验", ""), {
    min: 2,
    max: null,
    raw: "两年以上工作经验",
  });
  assert.deepEqual(resolveExperience("五年以上", ""), { min: 5, max: null, raw: "五年以上" });
  assert.deepEqual(resolveExperience("三年以内", ""), { min: null, max: 3, raw: "三年以内" });
  assert.deepEqual(resolveExperience("一年以上工作经验", ""), {
    min: 1,
    max: null,
    raw: "一年以上工作经验",
  });
  assert.deepEqual(resolveExperience("十年以上", ""), { min: 10, max: null, raw: "十年以上" });
  assert.deepEqual(resolveExperience("0-1年", ""), { min: 0, max: 1, raw: "0-1年" });
  assert.deepEqual(resolveExperience("不限", ""), { min: null, max: null, raw: "不限" });
  assert.deepEqual(resolveExperience("", ""), { min: null, max: null, raw: null });
  assert.deepEqual(resolveExperience(null, ""), { min: null, max: null, raw: null });
});

test("unknown 职族提示按标题重算，已知提示不被覆盖", () => {
  assert.equal(resolveRoleFamily("unknown", "AI后端开发工程师"), "ai_application_development");
  assert.equal(
    resolveRoleFamily(undefined, "混元大语言模型后训练算法工程师-Memory方向"),
    "ai_algorithm",
  );
  assert.equal(resolveRoleFamily("data", "AI后端开发工程师"), "data");
  assert.equal(resolveRoleFamily("unknown", "客工部接待经理（J101012）"), "unknown");
});

test("真实腾讯样本 10 行按标题/经验得到有证据的职族与经验", () => {
  const rows: Array<{
    title: string;
    experienceRaw: string;
    minYears: number | null;
    roleFamily: ReturnType<typeof resolveRoleFamily>;
    studentFriendly: string;
  }> = [
    {
      title: "《三角洲行动》3D动作设计师-演绎方向",
      experienceRaw: "三年以上工作经验",
      minYears: 3,
      roleFamily: "unknown",
      studentFriendly: "no",
    },
    {
      title: "ima copilot-后台开发工程师",
      experienceRaw: "一年以上工作经验",
      minYears: 1,
      roleFamily: "ai_application_development",
      studentFriendly: "unknown",
    },
    {
      title: "K6合作部-游戏运营-社区及用户运营",
      experienceRaw: "三年以上工作经验",
      minYears: 3,
      roleFamily: "ai_product_operations",
      studentFriendly: "no",
    },
    {
      title: "WorkBuddy-桌面端技术专家-Electron（深圳/北京/上海）",
      experienceRaw: "五年以上工作经验",
      minYears: 5,
      roleFamily: "ai_application_development",
      studentFriendly: "no",
    },
    {
      title: "《异人之下》游戏系统策划",
      experienceRaw: "三年以上工作经验",
      minYears: 3,
      roleFamily: "unknown",
      studentFriendly: "no",
    },
    {
      title: "《异人之下》游戏数值策划",
      experienceRaw: "三年以上工作经验",
      minYears: 3,
      roleFamily: "unknown",
      studentFriendly: "no",
    },
    {
      title: "腾讯云-AgentRuntime高级技术产品经理(国际化方向)(深圳/北京)",
      experienceRaw: "三年以上工作经验",
      minYears: 3,
      roleFamily: "ai_product_operations",
      studentFriendly: "no",
    },
    {
      title: "在研小游戏-玩法策划",
      experienceRaw: "两年以上工作经验",
      minYears: 2,
      roleFamily: "unknown",
      studentFriendly: "no",
    },
    {
      title: "ima-高级产品经理（基础框架）",
      experienceRaw: "两年以上工作经验",
      minYears: 2,
      roleFamily: "ai_product_operations",
      studentFriendly: "no",
    },
    {
      title: "芯片设计工程师",
      experienceRaw: "三年以上工作经验",
      minYears: 3,
      roleFamily: "unknown",
      studentFriendly: "no",
    },
  ];

  for (const row of rows) {
    const job = normalizeRawJob(tencentRaw(row.title, row.experienceRaw));
    assert.equal(job.role_family, row.roleFamily, row.title);
    assert.equal(job.experience_min_years, row.minYears, row.title);
    assert.equal(job.experience_max_years, null, row.title);
    assert.equal(job.experience_raw, row.experienceRaw, row.title);
    assert.equal(job.student_friendly, row.studentFriendly, row.title);
  }
});

test("经验分布返回九桶且计数合计等于去重后的 live 样本量", () => {
  const jobs: DiagnosticJobInputV1[] = [
    diagnosticJob({ job_key: "a" }),
    diagnosticJob({ job_key: "b", experience_raw: "1-3年", experience_min_years: 1, experience_max_years: 3, skills: [] }),
    diagnosticJob({ job_key: "c", experience_raw: "三年以上", experience_min_years: 3, skills: ["unknown_skill"] }),
    diagnosticJob({ job_key: "d", experience_raw: "不限", skills: ["sql"] }),
    diagnosticJob({ job_key: "e", experience_raw: "面议", skills: [] }),
    diagnosticJob({ job_key: "f", experience_min_years: 0, experience_max_years: 0, skills: [] }),
    diagnosticJob({ job_key: "a" }),
    diagnosticJob({ job_key: "g", data_origin: "synthetic_fixture" }),
  ];

  const distribution = computeExperienceDistribution(jobs);

  assert.equal(distribution.sample_size, 6);
  assert.equal(distribution.input_count, 8);
  assert.equal(distribution.excluded_count, 1);
  assert.equal(distribution.duplicate_count, 1);
  assert.deepEqual(
    EXPERIENCE_BUCKETS_V1.map((bucket) => distribution.buckets[bucket].count),
    [1, 1, 1, 1, 0, 0, 0, 1, 1],
  );
  const shareSum = EXPERIENCE_BUCKETS_V1.reduce(
    (sum, bucket) => sum + (distribution.buckets[bucket].share ?? 0),
    0,
  );
  assert.ok(Math.abs(shareSum - 1) < 1e-12, `shares should sum to 1, got ${shareSum}`);

  const entry = computeEntryLevelShare(jobs);
  assert.equal(entry.status, "ok");
  assert.equal(entry.numerator_count, 3);
  assert.equal(entry.denominator_count, 6);
  assert.equal(entry.value, 0.5);

  const hitRate = computeSkillHitRate(jobs);
  assert.equal(hitRate.sample_size, 6);
  assert.equal(hitRate.with_skill_count, 2);
  assert.equal(hitRate.value, 1 / 3);
  assert.equal(hitRate.status, "ok");
  assert.equal(hitRate.unknown_count, 4);
  assert.equal(hitRate.unknown_ratio, 2 / 3);
  assert.equal(hitRate.dictionary_version, "0.1");
});

test("空样本时诊断指标为 insufficient_data，不返回 0 占比", () => {
  const distribution = computeExperienceDistribution([]);
  assert.equal(distribution.sample_size, 0);
  for (const bucket of EXPERIENCE_BUCKETS_V1) {
    assert.equal(distribution.buckets[bucket].count, 0);
    assert.equal(distribution.buckets[bucket].share, null);
  }

  const entry = computeEntryLevelShare([]);
  assert.equal(entry.status, "insufficient_data");
  assert.equal(entry.value, null);

  const hitRate = computeSkillHitRate([]);
  assert.equal(hitRate.status, "insufficient_data");
  assert.equal(hitRate.value, null);
});

function diagnosticJob(overrides: Partial<DiagnosticJobInputV1> = {}): DiagnosticJobInputV1 {
  return {
    source_key: "tencent-official-careers",
    job_key: overrides.job_key ?? "job-001",
    experience_raw: overrides.experience_raw ?? null,
    experience_min_years: overrides.experience_min_years ?? null,
    experience_max_years: overrides.experience_max_years ?? null,
    skills: overrides.skills ?? ["python"],
    ...(overrides.data_origin === undefined ? {} : { data_origin: overrides.data_origin }),
  };
}
