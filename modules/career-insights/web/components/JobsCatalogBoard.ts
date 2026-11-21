// 岗位目录页（C-CATALOG@1 的展示侧）：方向榜、职位榜与岗位明细，筛选全部由 URL 参数驱动。
// 纯展示与纯函数，客户端组件不引入任何 .server 模块；收藏按钮（.tsx）由路由注入，见 JobRowStarProps。
import { createElement as h, type ComponentType, type ReactElement } from "react";
import { Link } from "react-router";
import type { JobFiltersV1, JobListResponseV1 } from "@aihot/career-insights/contracts";
import type { LocalStarredJob } from "../job-favorites.ts";
import type { CareerCatalogResponseV1, CareerDirectionV1, CareerTitleV1 } from "../../contracts/index.ts";
import { buildJobHref, serializeJobFilters, withJobsListAnchor } from "../filters.ts";
import { publishedAtText } from "../feeds.ts";
import { EMPLOYMENT_TYPE_LABELS, ROLE_FAMILY_LABELS, STUDENT_FRIENDLY_LABELS, skillLabel } from "../labels.ts";
import { CareerTime } from "../time.ts";

export const CATALOG_PATH = "/career-insights/jobs";
export const TITLE_RANKING_LIMIT = 20;
export const CITY_OPTION_LIMIT = 8;
export const CATALOG_LIMIT = 50;
export const CATALOG_WINDOW_DAYS = 30;
export const CATALOG_EMPTY_TEXT = "继续积累观测";

/**
 * 列表行收藏按钮的入参：由路由（jobs-catalog.tsx）把 JobStarButton 注入进来。这个 .ts 文件会被
 * standalone 测试用 Node 直接执行，不能 import .tsx；按钮组件因此由调用方传入。
 */
export type JobRowStarProps = Omit<LocalStarredJob, "savedAt"> & { compact: boolean };

const CARD_CLASS = "rounded-card border border-line bg-surface p-5";
const MUTED_CLASS = "text-[12px] leading-relaxed text-ink-4 break-words";
const CHIP_CLASS = "inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-medium";
const CHIP_IDLE_CLASS = `${CHIP_CLASS} border-line-strong text-ink-2`;
const CHIP_ACTIVE_CLASS = `${CHIP_CLASS} border-accent bg-accent text-accent-contrast`;

export function buildCatalogHref(filters: JobFiltersV1, patch: Partial<JobFiltersV1> = {}): string {
  return `${CATALOG_PATH}?${serializeJobFilters({ ...filters, ...patch })}`;
}

/** 城市候选来自职位榜的城市取值范围，按出现频次降序取前几个。 */
export function catalogCityOptions(titles: readonly CareerTitleV1[]): string[] {
  const counts = new Map<string, number>();
  for (const title of titles) {
    for (const city of title.cities) counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, CITY_OPTION_LIMIT)
    .map(([city]) => city);
}

/** 学生友好筛选只保留明确标注的职位；城市筛选按职位榜的城市取值范围匹配。 */
export function filterTitles(titles: readonly CareerTitleV1[], filters: JobFiltersV1): CareerTitleV1[] {
  const city = filters.city?.trim();
  const studentOnly = filters.student_friendly === "yes";
  return titles.filter(
    (title) => (city === undefined || city === "" || title.cities.includes(city)) && (!studentOnly || title.student_friendly_count > 0),
  );
}

export function directionRankCount(direction: CareerDirectionV1, filters: JobFiltersV1): number {
  return filters.student_friendly === "yes" ? direction.student_friendly_count : direction.job_count;
}

export function sortDirections(directions: readonly CareerDirectionV1[], filters: JobFiltersV1): CareerDirectionV1[] {
  return [...directions].sort(
    (a, b) => directionRankCount(b, filters) - directionRankCount(a, filters) || a.role_family.localeCompare(b.role_family),
  );
}

function hasFilters(filters: JobFiltersV1): boolean {
  return Boolean(filters.role_family || filters.city || filters.student_friendly || filters.skill || filters.company || filters.employment_type || filters.q);
}

/** 关键词搜索框保留的其它筛选（页码除外：换关键词从第一页看起）。 */
const SEARCH_KEPT_KEYS = ["role_family", "company", "city", "employment_type", "student_friendly", "skill", "page_size"] as const;
export const MAX_SEARCH_LENGTH = 100;

/**
 * 「筛选岗位」里的关键词搜索：普通 GET 表单提交回本页，无 JS 也能用；隐藏域带上当前其它筛选，
 * 提交后关键词与筛选同时生效，页码由浏览器按缺少 page 重置为 1。
 */
function SearchForm({ filters }: { filters: JobFiltersV1 }): ReactElement {
  const keyword = filters.q?.trim() ?? "";
  return h(
    "div",
    { className: "mt-3" },
    h(
      "form",
      { method: "get", action: CATALOG_PATH, role: "search", "data-job-search": "", className: "flex flex-wrap items-center gap-2" },
      ...SEARCH_KEPT_KEYS.flatMap((key) => {
        const value = filters[key];
        return value === undefined ? [] : [h("input", { key, type: "hidden", name: key, value: String(value) })];
      }),
      h("label", { htmlFor: "catalog-search-q", className: "sr-only" }, "按关键词搜索岗位"),
      // key 让关键词随导航重建输入框：defaultValue 只在挂载时生效，切换筛选后输入框必须显示当前 q。
      h("input", {
        key: keyword,
        id: "catalog-search-q",
        name: "q",
        type: "search",
        defaultValue: keyword,
        maxLength: MAX_SEARCH_LENGTH,
        placeholder: "搜索岗位 / 公司 / 技能，如：数据分析",
        enterKeyHint: "search",
        autoComplete: "off",
        "data-search-input": "",
        className: "h-10 min-w-0 flex-1 rounded-control border border-line-strong bg-bg px-3 text-[14px] text-ink outline-none placeholder:text-ink-4 focus:border-accent sm:max-w-md",
      }),
      // 单提交按钮：在输入框里按回车就是提交这个 GET 表单。
      h(
        "button",
        { type: "submit", "data-search-submit": "", className: "inline-flex h-10 shrink-0 items-center rounded-control bg-accent px-4 text-[13.5px] font-medium text-accent-contrast" },
        "搜索",
      ),
    ),
    keyword === ""
      ? h("p", { "data-search-hint": "", className: `mt-2 ${MUTED_CLASS}` }, "也可以点方向/职位榜进入对应筛选。")
      : h(
          "p",
          { "data-search-current": "", className: `mt-2 ${MUTED_CLASS}` },
          `当前搜索“${keyword}” · 也可以点方向/职位榜进入对应筛选。`,
        ),
  );
}

function filterChip(label: string, href: string, active: boolean, dataAttr: string, key: string): ReactElement {
  return h(
    "li",
    { key },
    // 筛选只改结果集，不应把读者弹回页面顶部（滚动位置留给 ScrollRestoration，不重置）。
  h(Link, { to: href, preventScrollReset: true, [dataAttr]: active ? "active" : "idle", "aria-current": active ? "true" : undefined, className: active ? CHIP_ACTIVE_CLASS : CHIP_IDLE_CLASS }, label),
  );
}

function FilterBar({ catalog, filters }: { catalog: CareerCatalogResponseV1; filters: JobFiltersV1 }): ReactElement {
  const studentOnly = filters.student_friendly === "yes";
  const city = filters.city?.trim() ?? "";
  const cities = catalogCityOptions(catalog.titles);

  return h(
    "section",
    { "aria-labelledby": "catalog-filters", className: CARD_CLASS },
    h("h2", { id: "catalog-filters", className: "text-[16px] font-semibold text-ink" }, "筛选岗位"),
    h(SearchForm, { filters }),
    h("h3", { className: "mt-4 text-[12px] text-ink-4" }, "学生友好"),
    h(
      "ul",
      { className: "mt-1.5 flex flex-wrap gap-2" },
      filterChip("全部", buildCatalogHref(filters, { student_friendly: undefined, page: 1 }), !studentOnly, "data-filter-student-friendly", "all"),
      filterChip("仅学生友好", buildCatalogHref(filters, { student_friendly: "yes", page: 1 }), studentOnly, "data-filter-student-friendly", "yes"),
    ),
    h("h3", { className: "mt-4 text-[12px] text-ink-4" }, "城市"),
    h(
      "ul",
      { className: "mt-1.5 flex flex-wrap gap-2" },
      filterChip("全部", buildCatalogHref(filters, { city: undefined, page: 1 }), city === "", "data-filter-city", "all"),
      ...cities.map((option) =>
        filterChip(option, buildCatalogHref(filters, { city: option, page: 1 }), city === option, "data-filter-city", option),
      ),
    ),
    hasFilters(filters)
      ? h(
          Link,
          Object.assign(
            { to: CATALOG_PATH, preventScrollReset: true, className: "mt-4 inline-flex h-8 items-center rounded-full border border-line-strong px-3 text-[12.5px] font-medium text-ink-2" },
            { "data-filter-clear": "" },
          ),
          "清除筛选",
        )
      : null,
  );
}

function DirectionRanking({ catalog, filters }: { catalog: CareerCatalogResponseV1; filters: JobFiltersV1 }): ReactElement {
  const ranked = sortDirections(catalog.directions, filters);
  return h(
    "section",
    { "aria-labelledby": "catalog-directions", "data-section": "direction-ranking", className: CARD_CLASS },
    h("h2", { id: "catalog-directions", className: "text-[16px] font-semibold text-ink" }, "方向榜"),
    h("p", { className: MUTED_CLASS }, `按职族聚合当前有效岗位；观察窗 ${catalog.window_days} 天。`),
    h("p", { "data-direction-scope": "", className: `mt-1 ${MUTED_CLASS}` }, "方向榜取全量岗位；选「仅学生友好」时按学生友好岗位数排序并按该口径计数，城市等筛选不影响本榜。"),
    ranked.length === 0
      ? h("p", { "data-directions-empty": "", role: "status", className: "mt-3 text-[14px] font-medium text-ink-2" }, CATALOG_EMPTY_TEXT)
      : h(
          "ul",
          { className: "mt-3 divide-y divide-line-soft" },
          ...ranked.map((direction) =>
            h(
              "li",
              { key: direction.role_family, "data-catalog-direction": direction.role_family, className: "py-3" },
              h(
                "div",
                { className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" },
                h("span", { className: "text-[14px] font-medium text-ink break-words" }, ROLE_FAMILY_LABELS[direction.role_family]),
                h(
                  "span",
                  { "data-rank-count": String(directionRankCount(direction, filters)), className: "num text-[14px] font-semibold text-ink whitespace-nowrap" },
                  filters.student_friendly === "yes" ? `${direction.student_friendly_count} 个学生友好岗位` : `${direction.job_count} 个岗位`,
                ),
              ),
              h(
                "p",
                { className: `mt-1 ${MUTED_CLASS}` },
                `公司 ${direction.company_count} 家 · 近 ${catalog.window_days} 天新增 ${direction.new_in_window} · 学生友好 ${direction.student_friendly_count}`,
              ),
              direction.top_skills.length > 0
                ? h(
                    "div",
                    { className: "mt-2 flex flex-wrap gap-1.5" },
                    ...direction.top_skills.map((entry) =>
                      h("span", { key: entry.skill, "data-direction-skill": entry.skill, className: "inline-flex h-6 items-center rounded-full border border-line-strong px-2.5 text-[11.5px] text-ink-2" }, `${skillLabel(entry.skill)} ${entry.count}`),
                    ),
                  )
                : null,
              h(
                Link,
                Object.assign(
                  { to: withJobsListAnchor(buildCatalogHref(filters, { role_family: direction.role_family, page: 1 })), className: "mt-2 inline-flex text-[12.5px] font-medium text-accent hover:underline" },
                  { "data-direction-evidence": direction.role_family },
                ),
                "查看该方向岗位",
              ),
            ),
          ),
        ),
  );
}

function TitleRanking({ catalog, filters }: { catalog: CareerCatalogResponseV1; filters: JobFiltersV1 }): ReactElement {
  const titles = filterTitles(catalog.titles, filters).slice(0, TITLE_RANKING_LIMIT);
  return h(
    "section",
    { "aria-labelledby": "catalog-titles", "data-section": "title-ranking", className: CARD_CLASS },
    h("h2", { id: "catalog-titles", className: "text-[16px] font-semibold text-ink" }, "职位榜"),
    h("p", { className: MUTED_CLASS }, "按标准化职位名聚合岗位数量，跨城市不重复累加同一职位；热门指当前有效岗位数量。"),
    titles.length === 0
      ? h("p", { "data-titles-empty": "", role: "status", className: "mt-3 text-[14px] font-medium text-ink-2" }, CATALOG_EMPTY_TEXT)
      : h(
          "ul",
          { className: "mt-3 divide-y divide-line-soft" },
          ...titles.map((title) =>
            h(
              "li",
              { key: title.title_key, "data-catalog-title": title.title_key, className: "py-3" },
              h(
                "div",
                { className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" },
                h("span", { className: "text-[14px] font-medium text-ink break-words" }, title.title_display),
                h("span", { "data-rank-count": String(title.job_count), className: "num text-[14px] font-semibold text-ink whitespace-nowrap" }, `${title.job_count} 个岗位`),
              ),
              h(
                "p",
                { className: `mt-1 ${MUTED_CLASS}` },
                `${title.company_count} 家公司 · ${title.cities.length > 0 ? title.cities.join("、") : "城市未知"} · 学生友好 ${title.student_friendly_count} · 最近发布 ${publishedAtText(title.latest_published_at)}`,
              ),
              title.top_skills.length > 0
                ? h(
                    "div",
                    { className: "mt-2 flex flex-wrap items-center gap-1.5" },
                    ...title.top_skills.map((entry) =>
                      h("span", { key: entry.skill, className: "inline-flex h-6 items-center rounded-full border border-line-strong px-2.5 text-[11.5px] text-ink-2" }, `${skillLabel(entry.skill)} ${entry.count}`),
                    ),
                    h(
                      Link,
                      Object.assign(
                        { to: withJobsListAnchor(buildCatalogHref(filters, { skill: title.top_skills[0]?.skill, page: 1 })), className: "text-[12.5px] font-medium text-accent hover:underline" },
                        { "data-title-evidence": title.title_key },
                      ),
                      "查看证据",
                    ),
                  )
                : null,
            ),
          ),
        ),
  );
}

function JobRow({ job, back, Star }: { job: JobListResponseV1["items"][number]; back: string; Star?: ComponentType<JobRowStarProps> }): ReactElement {
  return h(
    "li",
    { "data-catalog-job": job.id, className: "px-4 py-4" },
    h(
      "div",
      { className: "flex items-start justify-between gap-2" },
      h(Link, { to: buildJobHref(job.id, back), className: "min-w-0 text-[15px] font-semibold text-ink break-words hover:text-accent" }, job.title),
      Star
        ? h(Star, { id: job.id, title: job.title, company: job.company_name, roleFamily: job.role_family, locations: job.locations, compact: true })
        : null,
    ),
    h("div", { className: `mt-1 ${MUTED_CLASS}` }, `${job.company_name} · ${job.locations.length > 0 ? job.locations.join("、") : "地点未知"}`),
    h(
      "div",
      { className: "mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-4" },
      h("span", null, ROLE_FAMILY_LABELS[job.role_family]),
      h("span", null, EMPLOYMENT_TYPE_LABELS[job.employment_type]),
      h("span", { "data-job-student-friendly": job.student_friendly }, `学生友好：${STUDENT_FRIENDLY_LABELS[job.student_friendly]}`),
      h("a", { href: job.official_url, target: "_blank", rel: "noopener noreferrer", "data-job-evidence": "", className: "font-medium text-accent hover:underline" }, "官方原文"),
    ),
  );
}

function JobPager({ jobs, filters }: { jobs: JobListResponseV1; filters: JobFiltersV1 }): ReactElement | null {
  const totalPages = Math.max(1, Math.ceil(jobs.total / jobs.page_size));
  if (totalPages <= 1) return null;
  const current = Math.min(Math.max(1, jobs.page), totalPages);

  return h(
    "nav",
    { "aria-label": "岗位分页", className: "mt-4 flex flex-wrap items-center justify-between gap-3" },
    h("span", { className: "num whitespace-nowrap text-[12px] text-ink-4" }, `第 ${current} / ${totalPages} 页 · 共 ${jobs.total} 条`),
    h(
      "div",
      { className: "flex items-center gap-2" },
      current > 1
        ? h(Link, Object.assign({ to: withJobsListAnchor(buildCatalogHref(filters, { page: current - 1 })), preventScrollReset: true, className: "inline-flex h-8 items-center rounded-control border border-line px-3 text-[13px] text-ink-2" }, { "data-page": "prev" }), "上一页")
        : h("span", { "aria-disabled": "true", className: "inline-flex h-8 items-center rounded-control border border-line px-3 text-[13px] text-ink-4 opacity-60" }, "上一页"),
      current < totalPages
        ? h(Link, Object.assign({ to: withJobsListAnchor(buildCatalogHref(filters, { page: current + 1 })), preventScrollReset: true, className: "inline-flex h-8 items-center rounded-control border border-line px-3 text-[13px] text-ink-2" }, { "data-page": "next" }), "下一页")
        : h("span", { "aria-disabled": "true", className: "inline-flex h-8 items-center rounded-control border border-line px-3 text-[13px] text-ink-4 opacity-60" }, "下一页"),
    ),
  );
}

function JobListSection({ jobs, filters, Star }: { jobs: JobListResponseV1; filters: JobFiltersV1; Star?: ComponentType<JobRowStarProps> }): ReactElement {
  return h(
    "section",
    { id: "catalog-jobs", "aria-labelledby": "catalog-job-list", "data-section": "job-list", className: "" },
    h(
      "div",
      { className: "flex flex-wrap items-baseline justify-between gap-2 px-1" },
      h("h2", { id: "catalog-job-list", className: "text-[18px] font-semibold text-ink" }, "岗位明细"),
      h("span", { className: "num text-[12px] text-ink-4" }, `共 ${jobs.total} 条`),
    ),
    jobs.items.length === 0
      ? h("div", { className: "mt-3 rounded-card border border-line bg-surface px-5 py-8 text-center" },
          h(
            "p",
            { "data-jobs-empty": "", role: "status", className: "text-[14px] font-medium text-ink-2" },
            filters.q ? `没有找到与“${filters.q}”匹配的岗位` : jobs.total === 0 ? "当前筛选没有职位" : "当前页没有职位，可能已超出结果页数",
          ),
          filters.q
            ? h(
                "div",
                { className: "mt-2 flex flex-wrap items-center justify-center gap-3" },
                h(
                  Link,
                  Object.assign(
                    { to: buildCatalogHref(filters, { q: undefined, page: 1 }), preventScrollReset: true, className: "inline-flex text-[13px] font-medium text-accent hover:underline" },
                    { "data-job-search-empty-clear": "" },
                  ),
                  "清除搜索",
                ),
                h(
                  Link,
                  Object.assign(
                    { to: CATALOG_PATH, preventScrollReset: true, className: "inline-flex text-[13px] font-medium text-ink-3 hover:underline" },
                    { "data-job-search-empty-all": "" },
                  ),
                  "查看全部岗位",
                ),
              )
            : null,
        )
      : h(
          "ul",
          { className: "mt-3 divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface" },
          ...jobs.items.map((job) => h(JobRow, { key: job.id, job, back: buildCatalogHref(filters), Star })),
        ),
    h(JobPager, { jobs, filters }),
  );
}

export function JobsCatalogBoard({ catalog, jobs, filters, starButton }: {
  catalog: CareerCatalogResponseV1;
  jobs: JobListResponseV1;
  filters: JobFiltersV1;
  /** 列表行的收藏按钮组件，由路由注入（见本文件 JobRowStarProps）；不传则列表不带收藏按钮。 */
  starButton?: ComponentType<JobRowStarProps>;
}): ReactElement {
  return h(
    "div",
    { className: "space-y-6 pb-10 pt-3" },
    h(
      "header",
      null,
      h("h1", { "data-page-title": "", className: "text-[24px] font-semibold text-ink" }, "热门岗位"),
      filters.q
        ? h(
            "div",
            { "data-search-summary": "", className: "mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-relaxed text-ink-2" },
            h("span", null, `搜索“${filters.q}” · ${jobs.total} 个岗位`),
            h(
              Link,
              Object.assign(
                { to: buildCatalogHref(filters, { q: undefined, page: 1 }), preventScrollReset: true, className: "inline-flex text-[12.5px] font-medium text-accent hover:underline" },
                { "data-search-clear": "" },
              ),
              "清除搜索",
            ),
          )
        : null,
      h("p", { className: "mt-1 text-[13px] leading-relaxed text-ink-3" }, "方向榜与职位榜按当前有效岗位数量排序，不代表新闻热度、公司热度或未来增长。"),
      h(
        "p",
        { className: `mt-2 ${MUTED_CLASS}` },
        `数据截至 `, h(CareerTime, { value: catalog.as_of }), ` · 观察窗 ${catalog.window_days} 天 · 样本 ${catalog.sample_size} 个岗位`,
      ),
    ),
    catalog.sample_size === 0
      ? h("div", { role: "status", className: "rounded-card border border-line bg-surface px-5 py-8 text-center" },
          h("p", { "data-catalog-empty": "", className: "text-[15px] font-semibold text-ink-2" }, CATALOG_EMPTY_TEXT),
          h("p", { className: `mt-1 ${MUTED_CLASS}` }, "样本或观测日不足，先展示已有采集结果，不给出趋势判断。"),
        )
      : null,
    h(DirectionRanking, { catalog, filters }),
    h(FilterBar, { catalog, filters }),
    h(TitleRanking, { catalog, filters }),
    h(JobListSection, { jobs, filters, Star: starButton }),
  );
}