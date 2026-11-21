// 职业洞察八段与岗位目录页的展示口径，standalone：不连数据库、不连 API。
// 路由文件是 JSX，Node 不能直接执行；可测的渲染与筛选口径都在 web/components/*.ts，由路由与这里共用。
// 这里用 react-dom/server 的 renderToStaticMarkup + cheerio 渲染 SSR HTML，断言八段顺序与关键词。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as cheerio from "cheerio";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import type { JobFiltersV1, JobListResponseV1, SummaryResponseV1 } from "@aihot/career-insights/contracts";
import type { CareerCatalogResponseV1, CareerSignalsResponseV1 } from "../contracts/index.ts";
import {
  BLOCK_UNAVAILABLE_TEXT,
  BRIEF_EMPTY_TEXT,
  CareerInsightsBoard,
  COLLECTOR_CITATION,
  HOT_DEFINITION,
  INSIGHT_SECTIONS,
  INSUFFICIENT_DATA_TEXT,
  SKILL_DEFINITION,
} from "../web/components/CareerInsightsBoard.ts";
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

const SIGNALS: CareerSignalsResponseV1 = {
  contract_version: "0.1",
  data_origin: "live",
  window_days: 30,
  signals: [],
  skipped: [],
  generated_at: AS_OF,
};

const SIGNALS_WITH: CareerSignalsResponseV1 = {
  ...SIGNALS,
  signals: [
    {
      rule: "cross_industry",
      company: "示例科技",
      job_id: "job-2",
      job_title: "机械设计工程师",
      evidence: { company_job_count: 6, ai_family_job_count: 5, ai_family_ratio: 0.83, matched_terms: ["机械"] },
      reason_text: "该公司 6 个岗位中 5 个为算法/AI 族，本岗位要求 机械。",
      source_key: "tencent-official-careers",
      official_url: "https://careers.example/jobs/2",
      first_seen_at: AS_OF,
      confidence: "high",
    },
    {
      rule: "surge",
      company: "示例科技",
      job_id: "job-3",
      job_title: "算法工程师",
      evidence: { last_24h_jobs: 6, history_days: 3, history_daily_average: 1.5, surge_ratio: 4 },
      reason_text: "该公司最近 24 小时新增 6 个岗位，为历史日均（1.5 个/天，3 天）的 4 倍。",
      source_key: "tencent-official-careers",
      official_url: "https://careers.example/jobs/3",
      first_seen_at: AS_OF,
      confidence: "high",
    },
  ],
  skipped: [{ rule: "surge", company: "示例科技", reason: "insufficient_history", history_days: 1.5 }],
};

const EXPECTED_SECTIONS = [
  "career-brief",
  "career-signals",
  "career-job-trend",
  "career-skill-trend",
  "career-hot-jobs",
  "career-student-advice",
  "career-policy-jobs",
  "career-method",
];

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

function board(
  summary: SummaryResponseV1 | null,
  catalog: CareerCatalogResponseV1 | null,
  options: { brief?: typeof BRIEF | null; signals?: CareerSignalsResponseV1 | null } = {},
): cheerio.CheerioAPI {
  const { brief = BRIEF, signals = SIGNALS } = options;
  return render(createElement(CareerInsightsBoard, { summary, catalog, signals, brief }));
}

function sectionIds(html: cheerio.CheerioAPI): Array<string | undefined> {
  return html("[data-insight-section]").map((_, element) => html(element).attr("data-insight-section")).get();
}

function unavailableSections(html: cheerio.CheerioAPI): string[] {
  return html("[data-insight-section]")
    .filter((_, element) => html(element).find("[data-section-unavailable]").length > 0)
    .map((_, element) => html(element).attr("data-insight-section"))
    .get();
}

test("the dashboard renders the eight sections in contract order", () => {
  const html = board(SUMMARY, CATALOG);
  assert.deepEqual(sectionIds(html), EXPECTED_SECTIONS);
  assert.deepEqual(sectionIds(html), INSIGHT_SECTIONS.map((section) => section.id));
  for (const id of EXPECTED_SECTIONS) {
    const section = html(`[data-insight-section='${id}']`);
    assert.equal(section.length, 1, `missing section ${id}`);
    assert.equal(section.attr("aria-labelledby"), id, `aria-labelledby mismatch on ${id}`);
    assert.equal(section.find("h2").attr("id"), id, `h2 id mismatch on ${id}`);
  }
  assert.equal(html("#career-brief").text(), "AI 趋势研判");
  assert.equal(html("#career-signals").text(), "不同寻常的信号");
  assert.equal(html("#career-method").text(), "数据范围与方法");
});

test("the complete brief renders facts, inferences, actions, limitations and evidence with metadata", () => {
  const html = board(SUMMARY, CATALOG);
  const brief = html("[data-insight-section='career-brief']");
  assert.equal(brief.find("[data-brief-fact]").text(), BRIEF.facts[0]);
  assert.equal(brief.find("[data-brief-inference]").text(), BRIEF.inferences[0]);
  assert.equal(brief.find("[data-brief-action]").text(), BRIEF.actions[0]);
  assert.equal(brief.find("[data-brief-limitation]").text(), BRIEF.limitations[0]);
  assert.equal(brief.find("[data-brief-evidence]").first().text(), "算法工程师");
  assert.equal(brief.find("[data-brief-confidence]").attr("data-brief-confidence"), "low");
  assert.equal(brief.find("[data-brief-sample]").attr("data-brief-sample"), "12");
  assert.equal(brief.find("[data-brief-as-of]").attr("data-brief-as-of"), AS_OF);
  assert.match(brief.text(), /数据截至/);
  assert.match(brief.text(), /样本 12 个岗位/);
  assert.match(brief.text(), /低置信/);
  // 行动建议只完整出现在第 1 段，后面不重复。
  assert.equal(html("[data-insight-section='career-student-advice'] [data-brief-action]").length, 0);
});

test("a missing offline brief shows 暂无研判 without breaking the other sections", () => {
  const html = board(SUMMARY, CATALOG, { brief: null });
  assert.match(html("[data-brief-empty]").text(), new RegExp(BRIEF_EMPTY_TEXT));
  assert.equal(html("[data-brief-confidence]").length, 0);
  assert.equal(sectionIds(html).length, 8);
});

test("unusual signals show numeric evidence and source links, with skipped notice only when non-empty", () => {
  const html = board(SUMMARY, CATALOG, { signals: SIGNALS_WITH });
  const section = html("[data-insight-section='career-signals']");
  const items = section.find("[data-signal-item]");
  assert.equal(items.length, 2);

  const crossIndustry = items.first();
  assert.equal(crossIndustry.find("[data-signal-rule]").text(), "跨界组合");
  assert.match(crossIndustry.find("[data-signal-evidence]").text(), /公司岗位 6 个 · AI 族 5 个 · 占比 83.0%/);
  assert.equal(crossIndustry.find("[data-signal-title]").parent().attr("href"), "/career-insights/jobs/job-2");
  assert.equal(crossIndustry.find("[data-signal-source]").attr("href"), "https://careers.example/jobs/2");
  assert.equal(items.last().find("[data-signal-evidence]").text().includes("24 小时新增 6 个"), true);
  assert.match(section.find("[data-signals-skipped]").text(), /历史不足 2 天/);

  const emptySkips = board(SUMMARY, CATALOG, { signals: { ...SIGNALS_WITH, skipped: [] } });
  assert.equal(emptySkips("[data-signals-skipped]").length, 0);

  const noSignals = board(SUMMARY, CATALOG, { signals: { ...SIGNALS_WITH, signals: [] } });
  assert.equal(noSignals("[data-insight-section='career-signals'] [data-signals-empty]").length, 1);
  assert.equal(noSignals("[data-signals-skipped]").length, 1);
});

test("each block degrades on its own when one API result is missing", () => {
  const noSignals = board(SUMMARY, CATALOG, { signals: null });
  assert.deepEqual(unavailableSections(noSignals), ["career-signals"]);
  assert.equal(noSignals("[data-insight-section='career-signals'] [data-section-unavailable]").text().includes(BLOCK_UNAVAILABLE_TEXT), true);

  const noBrief = board(SUMMARY, CATALOG, { brief: null });
  assert.deepEqual(unavailableSections(noBrief), []);

  const noCatalog = board(SUMMARY, null);
  assert.deepEqual(unavailableSections(noCatalog), ["career-job-trend", "career-skill-trend", "career-hot-jobs", "career-student-advice"]);
  assert.equal(noCatalog("[data-insight-section='career-skill-trend'] [data-section-unavailable]").length, 1);

  const noSummary = board(null, CATALOG);
  assert.deepEqual(unavailableSections(noSummary), ["career-policy-jobs", "career-method"]);
  assert.equal(noSummary("[data-insight-section='career-job-trend'] [data-direction-row]").length, 2);

  const allNull = board(null, null, { brief: null, signals: null });
  assert.deepEqual(sectionIds(allNull), EXPECTED_SECTIONS);
  assert.equal(allNull("[data-brief-empty]").length, 1);
  assert.equal(allNull("[data-section-unavailable]").length, 7);
});

test("job trend lists families with window adds and keeps unknown on its own line", () => {
  const html = board(SUMMARY, CATALOG);
  const section = html("[data-insight-section='career-job-trend']");
  assert.deepEqual(
    section.find("[data-direction-row]").map((_, element) => section.find(element).attr("data-direction-row")).get(),
    ["ai_algorithm", "data"],
  );
  assert.equal(section.find("[data-direction-row='ai_algorithm'] [data-direction-jobs]").text(), "6 个岗位");
  assert.match(section.text(), /近 30 天新增 3/);
  assert.match(section.find("[data-job-trend-unknown]").text(), /未分类职位 1 个 · 占比 8.3%/);
  assert.match(section.find("[data-job-trend-unknown]").text(), /不进入方向结构/);
});

test("skill trend states the counting rule and keeps the unknown share visible", () => {
  const html = board(SUMMARY, CATALOG);
  const section = html("[data-insight-section='career-skill-trend']");
  assert.equal(section.find("[data-skill-definition]").text(), SKILL_DEFINITION);
  assert.match(section.find("[data-skill-definition]").text(), /岗位提及次数/);
  assert.match(section.find("[data-skill-definition]").text(), /不等于岗位需求概率/);
  assert.match(section.find("[data-skill-unknown]").text(), /未识别技能岗位 2 个 · 占比 20.0%/);
  assert.deepEqual(
    section.find("[data-skill-row]").map((_, element) => section.find(element).attr("data-skill-row")).get(),
    ["python", "sql"],
  );
  assert.match(section.text(), /方向内高频技能组合/);
});

test("hot jobs keeps only summary cards and one link into the full catalog", () => {
  const html = board(SUMMARY, CATALOG);
  const section = html("[data-insight-section='career-hot-jobs']");
  const directions = section.find("[data-hot-direction]");
  const titles = section.find("[data-hot-title]");
  assert.ok(directions.length > 0 && directions.length <= 6);
  assert.ok(titles.length > 0 && titles.length <= 6);
  assert.equal(section.find("[data-hot-all]").text(), "查看全部岗位");
  assert.equal(section.find("[data-hot-all]").attr("href"), "/career-insights/jobs");
  // 完整方向榜 / 职位榜 / 筛选 / 分页 / 明细都不在本段。
  assert.equal(section.find("[data-rank-direction]").length, 0);
  assert.equal(section.find("[data-rank-title]").length, 0);
  assert.equal(section.find("[data-filter-student-friendly]").length, 0);
  assert.equal(section.find("[data-page]").length, 0);
  assert.equal(section.find("[data-catalog-job]").length, 0);
  assert.doesNotMatch(section.text(), /方向榜|职位榜/);
});

test("student advice lists directions, skills and job evidence links into the jobs page", () => {
  const html = board(SUMMARY, CATALOG);
  const section = html("[data-insight-section='career-student-advice']");
  assert.equal(section.find("[data-advice-direction]").length, 2);
  assert.equal(section.find("[data-advice-direction='ai_algorithm'] a").attr("href"), "/career-insights/jobs?role_family=ai_algorithm&page=1&page_size=20");
  assert.equal(section.find("[data-advice-skill='python']").attr("href"), "/career-insights/jobs?skill=python&page=1&page_size=20");
  assert.equal(section.find("[data-advice-evidence] a").first().attr("href"), "/career-insights/jobs?student_friendly=yes&page=1&page_size=20");
  assert.match(section.text(), /需补技能/);
  assert.match(section.text(), /岗位证据/);
});

test("policy linkage is hidden when there is no shared theme", () => {
  const withoutThemes: SummaryResponseV1 = { ...SUMMARY, shared_themes: [] };
  const hidden = board(withoutThemes, CATALOG);
  assert.equal(hidden("[data-insight-section='career-policy-jobs']").length, 0);
  assert.equal(sectionIds(hidden).length, 7);
  assert.deepEqual(sectionIds(hidden), EXPECTED_SECTIONS.filter((id) => id !== "career-policy-jobs"));

  const shown = board(SUMMARY, CATALOG);
  assert.equal(shown("[data-insight-section='career-policy-jobs']").length, 1);
  assert.match(shown("[data-insight-section='career-policy-jobs']").text(), /人工智能/);
  assert.match(shown("[data-insight-section='career-policy-jobs']").text(), /不表示因果关系/);
});

test("the method section discloses sources, window, sample, unknown semantics and the citation rule", () => {
  const html = board(SUMMARY, CATALOG);
  const section = html("[data-insight-section='career-method']");
  assert.equal(section.find("[data-method-source]").text(), "2 个来源");
  assert.equal(section.find("[data-method-sample]").text(), "12 个有效岗位 · 3 家公司");
  assert.equal(section.find("[data-method-observed-days]").attr("data-method-observed-days"), "multi");
  assert.match(section.text(), /采集窗口/);
  assert.match(section.text(), /30 天/);
  assert.equal(section.find("[data-method-unknown-policy]").length, 1);
  assert.equal(section.find("[data-method-citation]").text(), COLLECTOR_CITATION);
  assert.match(section.text(), /必须随数字一起引用/);
  assert.match(section.text(), /unknown 单列/);
  assert.match(section.find("[data-method-limitation]").first().text() ?? "", /热门指当前有效岗位数量/);
});

test("an empty catalog asks to keep observing instead of inventing trends", () => {
  const empty: CareerCatalogResponseV1 = { ...CATALOG, sample_size: 0, directions: [], titles: [], skills: [] };
  const html = board(SUMMARY, empty);
  assert.match(html("[data-job-trend-empty]").text(), new RegExp(INSUFFICIENT_DATA_TEXT));
  assert.match(html("[data-hot-jobs-empty]").text(), new RegExp(INSUFFICIENT_DATA_TEXT));
  assert.match(html("[data-advice-empty]").text(), new RegExp(INSUFFICIENT_DATA_TEXT));
  assert.match(html("[data-skill-trend-empty]").text(), new RegExp(INSUFFICIENT_DATA_TEXT));
  assert.match(board(SUMMARY, CATALOG)("[data-hot-definition]").text(), new RegExp(HOT_DEFINITION));
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
