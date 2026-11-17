import assert from "node:assert/strict";
import { test } from "node:test";
import type { PolicyEvidenceRefV1 } from "../contracts/index.ts";
import {
  computeCareerMetrics,
  computeJobFamilyShareMetrics,
  computeObservedNewJobsMetric,
  computeSharedThemes,
  computeSkillDemandShareMetrics,
  computeStudentFriendlyShareMetric,
  type MetricJobInputV1,
  type ObservationSnapshotV1,
} from "../data/metrics.ts";

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