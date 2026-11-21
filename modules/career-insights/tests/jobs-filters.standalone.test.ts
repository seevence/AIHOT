// 热门岗位页（/career-insights/jobs）的版面顺序、方向榜口径说明、筛选链接与分页锚点，
// standalone：不连数据库、不连 API。路由文件是 JSX，Node 不能直接执行；可测的渲染与筛选口径
// 都在 web/components/JobsCatalogBoard.ts 与 web/filters.ts，由路由与这里共用同一份实现。
import assert from "node:assert/strict";
import { test } from "node:test";
import * as cheerio from "cheerio";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import type { JobFiltersV1, JobListResponseV1 } from "@aihot/career-insights/contracts";
import type { CareerCatalogResponseV1 } from "../contracts/index.ts";
import { JobsCatalogBoard, buildCatalogHref, filterTitles } from "../web/components/JobsCatalogBoard.ts";
import { withJobsListAnchor } from "../web/filters.ts";

const AS_OF = "2026-11-20T00:00:00.000Z";

const CATALOG: CareerCatalogResponseV1 = {
  contract_version: "0.1",
  data_origin: "live",
  as_of: AS_OF,
  window_days: 30,
  sample_size: 9,
  directions: [
    {
      role_family: "ai_algorithm",
      job_count: 6,
      company_count: 2,
      new_in_window: 3,
      student_friendly_count: 4,
      top_skills: [{ skill: "python", count: 5 }],
    },
    {
      role_family: "data",
      job_count: 2,
      company_count: 1,
      new_in_window: 1,
      student_friendly_count: 0,
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
      latest_published_at: AS_OF,
    },
    {
      title_key: "数据工程师",
      title_display: "数据工程师",
      job_count: 2,
      company_count: 1,
      cities: ["北京"],
      top_skills: [{ skill: "sql", count: 2 }],
      student_friendly_count: 0,
      latest_published_at: null,
    },
    {
      title_key: "算法专家（社招）",
      title_display: "算法专家（社招）",
      job_count: 1,
      company_count: 1,
      cities: ["深圳"],
      top_skills: [{ skill: "python", count: 1 }],
      student_friendly_count: 1,
      latest_published_at: null,
    },
  ],
  skills: [{ skill: "python", job_count: 5, share: 0.5 }],
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
      published_at: AS_OF,
      first_seen_at: AS_OF,
      last_seen_at: AS_OF,
      official_url: "https://careers.example/jobs/1",
    },
  ],
  page: 1,
  page_size: 20,
  total: 45,
  as_of: AS_OF,
  filters: { page: 1, page_size: 20 },
};

const FILTERS: JobFiltersV1 = { page: 1, page_size: 20 };

function render(filters: JobFiltersV1, jobs: JobListResponseV1 = JOBS): cheerio.CheerioAPI {
  const page: ReactElement = createElement(JobsCatalogBoard, { catalog: CATALOG, jobs, filters });
  return cheerio.load(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/career-insights/jobs"] }, page)));
}

function sectionHeadings(html: cheerio.CheerioAPI): string[] {
  return html("section").map((_, element) => html(element).find("h2").first().text()).get();
}

test("the filter block sits between the direction ranking and the title ranking", () => {
  const html = render(FILTERS);
  const headings = sectionHeadings(html);
  const directionAt = headings.indexOf("方向榜");
  const filtersAt = headings.indexOf("筛选岗位");
  const titlesAt = headings.indexOf("职位榜");
  assert.ok(directionAt >= 0 && filtersAt > directionAt && titlesAt > filtersAt, `unexpected section order: ${headings.join(" > ")}`);
  assert.ok(headings.indexOf("岗位明细") > titlesAt, "the job list stays the last section");
});

test("the direction ranking says it is the full-catalog view and does not follow the filters below", () => {
  const html = render(FILTERS);
  const note = html("[data-section='direction-ranking'] [data-direction-scope]");
  assert.equal(note.length, 1);
  assert.match(note.text(), /全量口径/);
  assert.match(note.text(), /不随下方筛选变化/);
});

test("the filter chips link to the filtered catalog with page reset to one", () => {
  const html = render(FILTERS);
  const studentYes = html("[data-filter-student-friendly='idle']").filter((_, element) => html(element).text() === "仅学生友好");
  assert.equal(studentYes.length, 1);
  assert.equal(studentYes.attr("href"), "/career-insights/jobs?student_friendly=yes&page=1&page_size=20");

  const beijing = html("[data-filter-city]").filter((_, element) => html(element).text() === "北京");
  assert.equal(beijing.length, 1);
  assert.equal(beijing.attr("href"), "/career-insights/jobs?city=%E5%8C%97%E4%BA%AC&page=1&page_size=20");
});

test("the filters actually narrow the title ranking rows", () => {
  assert.deepEqual(
    filterTitles(CATALOG.titles, FILTERS).map((title) => title.title_key),
    ["算法工程师", "数据工程师", "算法专家（社招）"],
  );
  assert.deepEqual(
    filterTitles(CATALOG.titles, { ...FILTERS, student_friendly: "yes" }).map((title) => title.title_key),
    ["算法工程师", "算法专家（社招）"],
  );
  assert.deepEqual(
    filterTitles(CATALOG.titles, { ...FILTERS, city: "北京" }).map((title) => title.title_key),
    ["算法工程师", "数据工程师"],
  );

  assert.equal(render(FILTERS)("[data-catalog-title]").length, 3);
  assert.equal(render({ ...FILTERS, student_friendly: "yes" })("[data-catalog-title]").length, 2);
  assert.equal(render({ ...FILTERS, city: "北京" })("[data-catalog-title]").length, 2);
});

test("the job list has a stable anchor and every pager link keeps the scroll position", () => {
  const first = render(FILTERS);
  assert.equal(first("section#catalog-jobs").length, 1, "the job list section carries the anchor id");
  assert.equal(first("[data-page='prev']").length, 0);
  assert.equal(first("[data-page='next']").attr("href"), "/career-insights/jobs?page=2&page_size=20#catalog-jobs");

  const second = render({ ...FILTERS, page: 2 }, { ...JOBS, page: 2 });
  assert.equal(second("[data-page='prev']").attr("href"), "/career-insights/jobs?page=1&page_size=20#catalog-jobs");
  assert.equal(second("[data-page='next']").attr("href"), "/career-insights/jobs?page=3&page_size=20#catalog-jobs");

  const filtered = render({ ...FILTERS, city: "北京" });
  assert.equal(filtered("[data-page='next']").attr("href"), "/career-insights/jobs?city=%E5%8C%97%E4%BA%AC&page=2&page_size=20#catalog-jobs");

  // 筛选 chip 与「清除筛选」重置 page=1，不带明细锚点。
  for (const element of first("[data-filter-student-friendly], [data-filter-city], [data-filter-clear]").toArray()) {
    assert.doesNotMatch(first(element).attr("href") ?? "", /#catalog-jobs/);
  }
  // 锚点只加在分页链接上，目录链接本身不变。
  assert.equal(buildCatalogHref(FILTERS, { page: 2 }), "/career-insights/jobs?page=2&page_size=20");
  assert.equal(withJobsListAnchor("/career-insights?page=2&page_size=20"), "/career-insights?page=2&page_size=20#catalog-jobs");
});
