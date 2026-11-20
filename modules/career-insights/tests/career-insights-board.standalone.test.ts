// 职业洞察七段与岗位目录页的展示口径，standalone：不连数据库、不连 API。
// 路由文件是 JSX，Node 不能直接执行；可测的渲染与筛选口径都在 web/components/*.ts，由路由与这里共用。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as cheerio from "cheerio";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import type { JobFiltersV1, JobListResponseV1, SummaryResponseV1 } from "@aihot/career-insights/contracts";
import type { CareerCatalogResponseV1 } from "../contracts/index.ts";
import { CareerInsightsBoard, INSIGHT_SECTIONS, INSUFFICIENT_DATA_TEXT } from "../web/components/CareerInsightsBoard.ts";
import {
  CATALOG_EMPTY_TEXT,
  JobsCatalogBoard,
  buildCatalogHref,
  catalogCityOptions,
  filterTitles,
  sortDirections,
} from "../web/components/JobsCatalogBoard.ts";

const AS_OF = "2026-11-20T00:00:00.000Z";

const SUMMARY: SummaryResponseV1 = {
  contract_version: "0.1",
  data_origin: "live",
  as_of: AS_OF,
  sample_size: 12,
  company_count: 3,
  source_count: 2,
  first_observed_at: "2026-11-18T00:00:00.000Z",
  last_observed_at: AS_OF,
  has_multiple_snapshots: true,
  metrics: [
    {
      metric_id: "skill_demand_share",
      version: "1.0",
      label: "技能需求占比",
      unit: "ratio",
      status: "ok",
      value: 0.8,
      numerator_count: 8,
      denominator_count: 10,
      sample_size: 10,
      as_of: AS_OF,
      dimension: {},
      unknown_count: 2,
      unknown_ratio: 0.2,
      evidence: [],
      disclaimer: "基于公开样本。",
    },
    {
      metric_id: "job_family_share",
      version: "1.0",
      label: "职族占比",
      unit: "ratio",
      status: "ok",
      value: 0.1,
      numerator_count: 1,
      denominator_count: 12,
      sample_size: 12,
      as_of: AS_OF,
      dimension: { role_family: "unknown" },
      unknown_count: 1,
      unknown_ratio: 0.083,
      evidence: [],
      disclaimer: "基于公开样本。",
    },
  ],
  shared_themes: [
    {
      theme_id: "artificial_intelligence",
      label: "人工智能",
      policy_count: 2,
      job_count: 6,
      policies: [
        {
          policy_item_id: "policy-1",
          title: "关于加快人工智能人才培养的通知",
          issuer: "示例部门",
          published_at: "2026-11-01",
          official_url: "https://www.gov.cn/example",
          source_tier: "government_official",
          theme_ids: ["artificial_intelligence"],
          evidence_excerpt: "支持高校人工智能学科建设。",
        },
      ],
      jobs: [],
    },
  ],
  dictionary_version: "0.3",
  warnings: [],
};

const CATALOG: CareerCatalogResponseV1 = {
  contract_version: "0.1",
  data_origin: "live",
  as_of: AS_OF,
  window_days: 30,
  sample_size: 12,
  directions: [
    {
      role_family: "ai_algorithm",
      job_count: 6,
      company_count: 2,
      new_in_window: 3,
      student_friendly_count: 4,
      top_skills: [{ skill: "python", count: 5 }, { skill: "pytorch", count: 3 }],
    },
    {
      role_family: "data",
      job_count: 2,
      company_count: 1,
      new_in_window: 1,
      student_friendly_count: 1,
      top_skills: [{ skill: "sql", count: 2 }],
    },
  ],
  titles: [
    {
      title_key: "算法工程师",
      title_display: "算法工程师",
      job_count: 4,
      company_count: 2,
      cities: ["北京", "上海"],
      top_skills: [{ skill: "python", count: 4 }],
      student_friendly_count: 2,
      latest_published_at: "2026-11-19T00:00:00.000Z",
    },
    {
      title_key: "社招算法专家",
      title_display: "算法专家（社招）",
      job_count: 1,
      company_count: 1,
      cities: ["深圳"],
      top_skills: [{ skill: "pytorch", count: 1 }],
      student_friendly_count: 0,
      latest_published_at: null,
    },
  ],
  skills: [
    { skill: "python", job_count: 8, share: 0.8 },
    { skill: "sql", job_count: 2, share: 0.2 },
  ],
};

const BRIEF = {
  contract_version: "0.1" as const,
  generated_at: "2026-11-20T01:00:00.000Z",
  as_of: AS_OF,
  sample_size: 12,
  window_days: 30,
  facts: ["AI 算法岗位 6 个，占多数。"],
  inferences: ["近 30 天新增 3 个，低置信。"],
  actions: ["先补齐 Python 与 PyTorch 基础。"],
  evidence: [{ kind: "job" as const, id: "job-1", title: "算法工程师" }],
  limitations: ["样本仅来自公开渠道。"],
  confidence: "low" as const,
};

const SIGNALS = {
  contract_version: "0.1" as const,
  data_origin: "live" as const,
  window_days: 30,
  signals: [],
  skipped: [],
  generated_at: AS_OF,
};

const JOBS: JobListResponseV1 = {
  contract_version: "0.1",
  data_origin: "live",
  items: [
    {
      id: "job-1",
      company_name: "示例科技",
      title: "算法工程师（校招）",
      role_family: "ai_algorithm",
      locations: ["北京"],
      employment_type: "campus",
      student_friendly: "yes",
      skills: ["python"],
      published_at: "2026-11-19T00:00:00.000Z",
      first_seen_at: AS_OF,
      last_seen_at: AS_OF,
      official_url: "https://careers.example/jobs/1",
    },
  ],
  page: 1,
  page_size: 20,
  total: 1,
  as_of: AS_OF,
  filters: { page: 1, page_size: 20 },
};

const FILTERS: JobFiltersV1 = { page: 1, page_size: 20 };

function render(page: ReactElement): cheerio.CheerioAPI {
  return cheerio.load(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/career-insights"] }, page)));
}

function board(summary: SummaryResponseV1, catalog: CareerCatalogResponseV1 | null, brief: typeof BRIEF | null = BRIEF): cheerio.CheerioAPI {
  return render(createElement(CareerInsightsBoard, { summary, catalog, signals: SIGNALS, brief }));
}

function sectionIds(html: cheerio.CheerioAPI): Array<string | undefined> {
  return html("[data-insight-section]").map((_, element) => html(element).attr("data-insight-section")).get();
}

test("the dashboard renders the seven sections in contract order", () => {
  const html = board(SUMMARY, CATALOG);
  assert.deepEqual(sectionIds(html), INSIGHT_SECTIONS.map((section) => section.id));
  assert.deepEqual(sectionIds(html), [
    "career-brief",
    "career-job-trend",
    "career-skill-trend",
    "career-hot-jobs",
    "career-student-advice",
    "career-policy-jobs",
    "career-method",
  ]);
  assert.equal(html("#career-brief").text(), "AI 趋势研判");
  assert.equal(html("#career-method").text(), "数据范围与方法");
});

test("a missing offline brief shows 继续积累观测 instead of a hard prediction", () => {
  const html = board(SUMMARY, CATALOG, null);
  assert.match(html("[data-brief-empty]").text(), new RegExp(INSUFFICIENT_DATA_TEXT));
  assert.match(html("[data-advice-empty]").text(), new RegExp(INSUFFICIENT_DATA_TEXT));
  assert.equal(html("[data-brief-confidence]").length, 0);
});

test("policy linkage is hidden when there is no shared theme", () => {
  const withoutThemes: SummaryResponseV1 = { ...SUMMARY, shared_themes: [] };
  const hidden = board(withoutThemes, CATALOG);
  assert.equal(hidden("[data-insight-section='career-policy-jobs']").length, 0);
  assert.equal(sectionIds(hidden).length, 6);

  const shown = board(SUMMARY, CATALOG);
  assert.equal(shown("[data-insight-section='career-policy-jobs']").length, 1);
  assert.match(shown("[data-insight-section='career-policy-jobs']").text(), /人工智能/);
  assert.match(shown("[data-insight-section='career-policy-jobs']").text(), /不表示因果关系/);
});

test("an empty catalog asks to keep observing instead of inventing trends", () => {
  const empty: CareerCatalogResponseV1 = { ...CATALOG, sample_size: 0, directions: [], titles: [], skills: [] };
  const html = board(SUMMARY, empty);
  assert.match(html("[data-job-trend-empty]").text(), new RegExp(INSUFFICIENT_DATA_TEXT));
  assert.match(html("[data-hot-jobs-empty]").text(), new RegExp(INSUFFICIENT_DATA_TEXT));
  assert.match(board(SUMMARY, CATALOG)("[data-hot-definition]").text(), /热门指当前有效岗位数量/);
});

test("the catalog page ranks directions and titles and links evidence", () => {
  const html = render(createElement(JobsCatalogBoard, { catalog: CATALOG, jobs: JOBS, filters: FILTERS }));
  const directions = html("[data-catalog-direction]").map((_, element) => html(element).attr("data-catalog-direction")).get();
  assert.deepEqual(directions, ["ai_algorithm", "data"]);

  const titles = html("[data-catalog-title]").map((_, element) => html(element).attr("data-catalog-title")).get();
  assert.deepEqual(titles, ["算法工程师", "社招算法专家"]);

  assert.equal(html("[data-direction-evidence='ai_algorithm']").attr("href"), "/career-insights/jobs?role_family=ai_algorithm&page=1&page_size=20");
  assert.equal(html("[data-title-evidence='算法工程师']").attr("href"), "/career-insights/jobs?skill=python&page=1&page_size=20");
  assert.equal(html("[data-catalog-title='算法工程师'] [data-rank-count]").text(), "4 个岗位");
  assert.equal(html("[data-catalog-job='job-1'] [data-job-evidence]").attr("href"), "https://careers.example/jobs/1");
});

test("student-friendly and city filters drive ranking and links", () => {
  const studentFilters: JobFiltersV1 = { ...FILTERS, student_friendly: "yes" };
  const studentTitles = filterTitles(CATALOG.titles, studentFilters);
  assert.deepEqual(studentTitles.map((title) => title.title_key), ["算法工程师"]);
  assert.deepEqual(sortDirections(CATALOG.directions, studentFilters).map((direction) => direction.role_family), ["ai_algorithm", "data"]);

  const studentHtml = render(createElement(JobsCatalogBoard, { catalog: CATALOG, jobs: JOBS, filters: studentFilters }));
  assert.equal(studentHtml("[data-filter-student-friendly='active']").text(), "仅学生友好");
  assert.equal(studentHtml("[data-catalog-direction='ai_algorithm'] [data-rank-count]").text(), "4 个学生友好岗位");
  assert.equal(studentHtml("[data-filter-student-friendly='idle']").attr("href"), "/career-insights/jobs?page=1&page_size=20");

  const cityFilters: JobFiltersV1 = { ...FILTERS, city: "北京" };
  // 三个城市的计数相同，C-CATALOG@1 未定义同频时的先后；localeCompare 随环境的 ICU 排序规则而变，按集合比较。
  assert.deepEqual(new Set(catalogCityOptions(CATALOG.titles)), new Set(["北京", "上海", "深圳"]));
  assert.deepEqual(filterTitles(CATALOG.titles, cityFilters).map((title) => title.title_key), ["算法工程师"]);

  const cityHtml = render(createElement(JobsCatalogBoard, { catalog: CATALOG, jobs: JOBS, filters: cityFilters }));
  assert.equal(cityHtml("[data-filter-city='active']").text(), "北京");
  assert.equal(cityHtml("[data-filter-clear]").attr("href"), "/career-insights/jobs");
  assert.equal(buildCatalogHref(FILTERS, { city: "北京", page: 1 }), "/career-insights/jobs?city=%E5%8C%97%E4%BA%AC&page=1&page_size=20");
});

test("an empty catalog page says 继续积累观测", () => {
  const empty: CareerCatalogResponseV1 = { ...CATALOG, sample_size: 0, directions: [], titles: [], skills: [] };
  const html = render(createElement(JobsCatalogBoard, { catalog: empty, jobs: { ...JOBS, items: [], total: 0 }, filters: FILTERS }));
  assert.equal(html("[data-catalog-empty]").text(), CATALOG_EMPTY_TEXT);
  assert.equal(sectionIds(html).length, 0);
});

test("the jobs catalog route is registered by the module", () => {
  const source = readFileSync(new URL("../module.ts", import.meta.url), "utf8");
  assert.match(source, /path: "career-insights\/jobs", file: "web\/routes\/jobs-catalog\.tsx"/);
});