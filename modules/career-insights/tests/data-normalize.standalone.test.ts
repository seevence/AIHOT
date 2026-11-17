import assert from "node:assert/strict";
import { test } from "node:test";
import type { RawCollectedJobV1 } from "../contracts/index.ts";
import { normalizeRawJob, normalizeRawJobs } from "../data/normalize.ts";

function rawJob(overrides: Partial<RawCollectedJobV1> = {}): RawCollectedJobV1 {
  return {
    schema_version: "1.0",
    source_key: "alibaba-official-careers",
    source_job_id: "job-001",
    company_name: "示例公司",
    title: "AI 应用后端开发工程师",
    official_url: "https://careers.example/jobs/1",
    raw_text:
      "负责 AI 应用后端开发，熟悉 Python、Java、Docker 与 RAG。要求本科及以上学历，1-3 年经验。工作地点：深圳。",
    published_at: "2026-11-10",
    fetched_at: "2026-11-16T12:00:00.000Z",
    collector_version: "test/1.0",
    hints: {},
    ...overrides,
  };
}

test("归一化映射职族、地点、学历、经验与技能证据", () => {
  const job = normalizeRawJob(rawJob());

  assert.equal(job.schema_version, "1.0");
  assert.equal(job.role_family, "ai_application_development");
  assert.deepEqual(job.locations, ["深圳"]);
  assert.equal(job.degree, "bachelor");
  assert.match(job.degree_raw ?? "", /本科/);
  assert.equal(job.experience_min_years, 1);
  assert.equal(job.experience_max_years, 3);
  assert.equal(job.experience_raw, "1-3 年经验");
  assert.equal(job.published_at, "2026-11-10");

  assert.ok(job.skills.includes("python"));
  assert.ok(job.skills.includes("java"));
  assert.ok(job.skills.includes("docker"));
  assert.ok(job.skills.includes("retrieval_augmented_generation"));
  for (const evidence of job.skill_evidence) {
    assert.ok(job.skills.includes(evidence.skill_id));
    assert.ok(evidence.evidence_text.length > 0);
  }

  assert.equal(job.job_key, "job-001");
  assert.match(job.content_hash, /^[0-9a-f]{64}$/);
});

test("未写学历和经验时保持 unknown 与 null，不补成 0 年", () => {
  const job = normalizeRawJob(
    rawJob({
      title: "数据分析师",
      raw_text: "负责业务数据分析，熟悉 SQL 与 Python。工作地点：北京。",
    }),
  );

  assert.equal(job.degree, "unknown");
  assert.equal(job.degree_raw, null);
  assert.equal(job.experience_min_years, null);
  assert.equal(job.experience_max_years, null);
  assert.equal(job.experience_raw, null);
  assert.equal(job.student_friendly, "unknown");
  assert.notEqual(job.experience_min_years, 0);
});

test("学历不限是 any_explicit，未写学历才是 unknown", () => {
  assert.equal(
    normalizeRawJob(rawJob({ raw_text: "学历不限，欢迎投递。工作地点：杭州。" })).degree,
    "any_explicit",
  );
  assert.equal(
    normalizeRawJob(rawJob({ raw_text: "负责后端开发。工作地点：杭州。" })).degree,
    "unknown",
  );
});

test("学生友好只按明确证据判定", () => {
  const campus = normalizeRawJob(
    rawJob({
      title: "AI 应用开发工程师（校园招聘）",
      raw_text: "2027 届校园招聘，欢迎应届生投递。工作地点：深圳。",
    }),
  );
  assert.equal(campus.employment_type, "campus");
  assert.equal(campus.student_friendly, "yes");

  const internship = normalizeRawJob(
    rawJob({
      title: "算法实习生",
      raw_text: "日常实习，参与大模型应用开发。工作地点：北京。",
    }),
  );
  assert.equal(internship.employment_type, "internship");
  assert.equal(internship.student_friendly, "yes");

  const experienced = normalizeRawJob(
    rawJob({
      title: "资深算法工程师",
      raw_text: "要求 3 年以上相关经验，熟悉推荐算法。工作地点：上海。",
    }),
  );
  assert.equal(experienced.experience_min_years, 3);
  assert.equal(experienced.student_friendly, "no");

  const unknown = normalizeRawJob(
    rawJob({
      title: "数据分析师",
      raw_text: "负责业务数据分析。工作地点：北京。",
    }),
  );
  assert.equal(unknown.student_friendly, "unknown", "未写经验不能判为 yes");
});

test("经验不限保留原文但不转换为 0 年", () => {
  const job = normalizeRawJob(
    rawJob({
      title: "AI 产品经理",
      raw_text: "经验不限，欢迎应届生投递。工作地点：杭州。",
    }),
  );

  assert.equal(job.experience_min_years, null);
  assert.equal(job.experience_max_years, null);
  assert.equal(job.experience_raw, "经验不限");
  assert.equal(job.student_friendly, "yes");
});

test("批量归一化把非法样本放入 rejected，不阻断合法样本", () => {
  const result = normalizeRawJobs([
    rawJob(),
    rawJob({ source_job_id: "job-002", official_url: "ftp://careers.example/jobs/2" }),
    rawJob({ source_job_id: "job-003", fetched_at: "2026-11-16T12:00:00+08:00" }),
  ]);

  assert.equal(result.normalized.length, 1);
  assert.equal(result.rejected.length, 2);
  assert.equal(result.normalized[0]?.job_key, "job-001");
});