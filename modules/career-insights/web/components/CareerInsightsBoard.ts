// 职业洞察页的七段板块（C-INSIGHTS@1）。纯展示：只读 loader 给出的契约数据，
// 不发起请求、不做统计加工，所以 SSR 与 standalone 断言共用同一份渲染。
import { createElement as h, type ReactElement } from "react";
import { Link } from "react-router";
import type { MetricResultV1, SummaryResponseV1 } from "@aihot/career-insights/contracts";
import type { CareerBriefV1, CareerCatalogResponseV1, CareerSignalsResponseV1 } from "../../contracts/index.ts";
import { formatRatioPercent, publishedAtText } from "../feeds.ts";
import { ROLE_FAMILY_LABELS, skillLabel } from "../labels.ts";
import { CareerTime } from "../time.ts";
import { CareerSignals } from "./CareerSignals.ts";

export const INSUFFICIENT_DATA_TEXT = "继续积累观测";
export const INSUFFICIENT_DATA_HINT = "观测日不足 2 天或样本过少，只展示已有观测，不给出趋势预测。";
export const BLOCK_UNAVAILABLE_TEXT = "本区块暂时不可用";
export const HOT_DEFINITION = "热门指当前有效岗位数量，不表示新闻热度、公司热度或未来增长。";

const CARD_CLASS = "rounded-card border border-line bg-surface p-5";
const SUBTITLE_CLASS = "mt-4 text-[14px] font-semibold text-ink";
const MUTED_CLASS = "text-[12px] leading-relaxed text-ink-4 break-words";
const CHIP_CLASS = "inline-flex h-6 items-center rounded-full border border-line-strong px-2.5 text-[11.5px] text-ink-2";

const CONFIDENCE_LABELS: Record<CareerBriefV1["confidence"], string> = {
  low: "低置信",
  medium: "中置信",
  high: "高置信",
};

export interface InsightSectionV1 {
  id: string;
  title: string;
}

/** 页面板块顺序即渲染顺序；政策联动的整块隐藏由数据决定，不改变其余段的相对顺序。 */
export const INSIGHT_SECTIONS: readonly InsightSectionV1[] = [
  { id: "career-brief", title: "AI 趋势研判" },
  { id: "career-job-trend", title: "岗位趋势" },
  { id: "career-skill-trend", title: "技能趋势" },
  { id: "career-hot-jobs", title: "热门岗位" },
  { id: "career-student-advice", title: "学生就业建议" },
  { id: "career-policy-jobs", title: "政策与岗位联动" },
  { id: "career-method", title: "数据范围与方法" },
];

function section(id: string, title: string, children: ReadonlyArray<ReactElement | null>): ReactElement {
  return h(
    "section",
    { key: id, "aria-labelledby": id, "data-insight-section": id, className: CARD_CLASS },
    h("h2", { id, className: "text-[17px] font-semibold text-ink" }, title),
    ...children.filter((child): child is ReactElement => child !== null),
  );
}

function note(text: string, dataAttr: string): ReactElement {
  return h(
    "div",
    { [dataAttr]: "", role: "status", className: "mt-3 rounded-card border border-line-soft bg-bg-sunk px-4 py-4" },
    h("p", { className: "text-[14px] font-medium text-ink-2" }, text),
    h("p", { className: "mt-1 text-[12.5px] leading-relaxed text-ink-4 break-words" }, INSUFFICIENT_DATA_HINT),
  );
}

function bullets(items: readonly string[], dataAttr: string): ReactElement {
  return h(
    "ul",
    { className: "mt-2 space-y-1.5" },
    ...items.map((item, index) =>
      h("li", { key: `${dataAttr}:${index}`, [dataAttr]: "", className: "text-[13px] leading-relaxed text-ink-2 break-words" }, item),
    ),
  );
}

function skillChips(skills: readonly { skill: string; count: number }[]): ReactElement | null {
  if (skills.length === 0) return null;
  return h(
    "div",
    { className: "mt-2 flex flex-wrap gap-1.5" },
    ...skills.map((entry) =>
      h("span", { key: entry.skill, "data-skill-chip": entry.skill, className: CHIP_CLASS }, `${skillLabel(entry.skill)} ${entry.count}`),
    ),
  );
}

/** 技能未识别口径取自 summary 的全局 skill_demand_share 指标；维度指标不是全局口径。 */
export function unknownSkillMetric(summary: SummaryResponseV1 | null): MetricResultV1 | undefined {
  return summary?.metrics.find(
    (metric) =>
      metric.metric_id === "skill_demand_share" &&
      metric.dimension.skill_id === undefined &&
      metric.dimension.role_family === undefined &&
      metric.dimension.theme_id === undefined,
  );
}

/** 未分类职位的口径来自 job_family_share 的 unknown 维度。 */
export function unknownFamilyMetric(summary: SummaryResponseV1 | null): MetricResultV1 | undefined {
  return summary?.metrics.find((metric) => metric.metric_id === "job_family_share" && metric.dimension.role_family === "unknown");
}

function briefEvidence(evidence: CareerBriefV1["evidence"]): ReactElement {
  return h(
    "ul",
    { className: "mt-2 space-y-1.5" },
    ...evidence.map((item) =>
      h(
        "li",
        { key: `${item.kind}:${item.id}`, "data-brief-evidence": item.kind, className: "text-[13px] break-words" },
        item.kind === "job"
          ? h(Link, { to: `/career-insights/jobs/${encodeURIComponent(item.id)}`, className: "text-accent hover:underline" }, item.title)
          : h(Link, { to: "/career-insights/policies", className: "text-accent hover:underline" }, item.title),
      ),
    ),
  );
}

function BriefSection({ brief }: { brief: CareerBriefV1 | null }): ReactElement {
  if (!brief) return section("career-brief", "AI 趋势研判", [note(INSUFFICIENT_DATA_TEXT, "data-brief-empty")]);

  return section("career-brief", "AI 趋势研判", [
    h(
      "div",
      { className: "mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1" },
      h(
        "span",
        { "data-brief-confidence": brief.confidence, className: "inline-flex h-5 items-center rounded-full border border-line-strong px-2 text-[11px] text-ink-2" },
        CONFIDENCE_LABELS[brief.confidence],
      ),
      h("span", { className: MUTED_CLASS }, "离线生成于 "),
      h(CareerTime, { value: brief.generated_at, className: MUTED_CLASS }),
      h("span", { className: MUTED_CLASS }, "数据截至 "),
      h(CareerTime, { value: brief.as_of, className: MUTED_CLASS }),
      h("span", { "data-brief-sample": String(brief.sample_size), className: MUTED_CLASS }, `样本 ${brief.sample_size} 个岗位`),
    ),
    brief.facts.length > 0 ? h("h3", { className: SUBTITLE_CLASS }, "数据事实") : null,
    brief.facts.length > 0 ? bullets(brief.facts, "data-brief-fact") : null,
    brief.inferences.length > 0 ? h("h3", { className: SUBTITLE_CLASS }, "趋势推断") : null,
    brief.inferences.length > 0 ? bullets(brief.inferences, "data-brief-inference") : null,
    brief.evidence.length > 0 ? h("h3", { className: SUBTITLE_CLASS }, "可核查证据") : null,
    brief.evidence.length > 0 ? briefEvidence(brief.evidence) : null,
  ]);
}

function jobTrendRows(catalog: CareerCatalogResponseV1): ReactElement {
  return h(
    "ul",
    { className: "mt-3 divide-y divide-line-soft" },
    ...catalog.directions.map((direction) =>
      h(
        "li",
        { key: direction.role_family, "data-direction-row": direction.role_family, className: "py-3" },
        h(
          "div",
          { className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" },
          h("span", { className: "text-[14px] font-medium text-ink break-words" }, ROLE_FAMILY_LABELS[direction.role_family]),
          h(
            "span",
            { "data-direction-jobs": String(direction.job_count), className: "num text-[14px] font-semibold text-ink whitespace-nowrap" },
            `${direction.job_count} 个岗位`,
          ),
        ),
        h(
          "p",
          { className: `mt-1 ${MUTED_CLASS}` },
          `公司 ${direction.company_count} 家 · 近 ${catalog.window_days} 天新增 ${direction.new_in_window} · 学生友好 ${direction.student_friendly_count}`,
        ),
        skillChips(direction.top_skills),
      ),
    ),
  );
}

function JobTrendSection({ catalog }: { catalog: CareerCatalogResponseV1 | null }): ReactElement {
  if (!catalog) return section("career-job-trend", "岗位趋势", [note(BLOCK_UNAVAILABLE_TEXT, "data-section-unavailable")]);
  if (catalog.directions.length === 0 || catalog.sample_size === 0) {
    return section("career-job-trend", "岗位趋势", [note(INSUFFICIENT_DATA_TEXT, "data-job-trend-empty")]);
  }
  return section("career-job-trend", "岗位趋势", [
    h(
      "p",
      { className: "mt-2 text-[13px] leading-relaxed text-ink-3 break-words" },
      `按职族聚合当前有效岗位；观察窗 ${catalog.window_days} 天，样本 ${catalog.sample_size} 个岗位。`,
    ),
    jobTrendRows(catalog),
  ]);
}

function SkillTrendSection({ summary, catalog }: { summary: SummaryResponseV1 | null; catalog: CareerCatalogResponseV1 | null }): ReactElement {
  if (!catalog && !summary) return section("career-skill-trend", "技能趋势", [note(BLOCK_UNAVAILABLE_TEXT, "data-section-unavailable")]);

  const skills = catalog?.skills ?? [];
  const unknownSkill = unknownSkillMetric(summary);
  const unknownText = unknownSkill
    ? `未识别技能岗位 ${unknownSkill.unknown_count ?? 0} 个${unknownSkill.unknown_ratio !== undefined && unknownSkill.unknown_ratio !== null ? ` · 占比 ${formatRatioPercent(unknownSkill.unknown_ratio)}` : ""}`
    : "未识别技能比例暂无数据";
  const groups = (catalog?.directions ?? []).filter((direction) => direction.top_skills.length > 0);

  if (skills.length === 0) return section("career-skill-trend", "技能趋势", [note(INSUFFICIENT_DATA_TEXT, "data-skill-trend-empty")]);

  return section("career-skill-trend", "技能趋势", [
    h("p", { "data-skill-unknown": "", className: "mt-2 text-[13px] leading-relaxed text-ink-3 break-words" }, unknownText),
    h("h3", { className: SUBTITLE_CLASS }, "高频技能"),
    h(
      "ul",
      { className: "mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" },
      ...skills.map((entry) =>
        h(
          "li",
          { key: entry.skill, "data-skill-row": entry.skill, className: "rounded-card border border-line bg-bg-sunk px-3 py-2" },
          h("div", { className: "flex flex-wrap items-baseline justify-between gap-x-2" },
            h("span", { className: "text-[13px] font-medium text-ink break-words" }, skillLabel(entry.skill)),
            h("span", { className: "num text-[12px] text-ink-3 whitespace-nowrap" }, `${entry.job_count} 个岗位 · ${formatRatioPercent(entry.share)}`),
          ),
        ),
      ),
    ),
    groups.length > 0 ? h("h3", { className: SUBTITLE_CLASS }, "方向内高频技能组合") : null,
    groups.length > 0
      ? h("p", { className: MUTED_CLASS }, "按方向统计的高频技能清单，不是同一职位的共现统计。")
      : null,
    groups.length > 0
      ? h(
          "ul",
          { className: "mt-2 space-y-2" },
          ...groups.map((direction) =>
            h(
              "li",
              { key: direction.role_family, className: "rounded-card border border-line bg-bg-sunk px-3 py-2" },
              h("div", { className: "text-[13px] font-medium text-ink break-words" }, ROLE_FAMILY_LABELS[direction.role_family]),
              skillChips(direction.top_skills),
            ),
          ),
        )
      : null,
  ]);
}

function HotJobsSection({ catalog, signals }: { catalog: CareerCatalogResponseV1 | null; signals: CareerSignalsResponseV1 | null }): ReactElement {
  if (!catalog || catalog.sample_size === 0) {
    return section("career-hot-jobs", "热门岗位", [note(catalog ? INSUFFICIENT_DATA_TEXT : BLOCK_UNAVAILABLE_TEXT, "data-hot-jobs-empty")]);
  }

  return section("career-hot-jobs", "热门岗位", [
    h("p", { "data-hot-definition": "", className: "mt-2 text-[13px] leading-relaxed text-ink-3 break-words" }, HOT_DEFINITION),
    h("h3", { className: SUBTITLE_CLASS }, "方向榜"),
    h(
      "ul",
      { className: "mt-2 divide-y divide-line-soft" },
      ...catalog.directions.map((direction) =>
        h(
          "li",
          { key: direction.role_family, "data-rank-direction": direction.role_family, className: "py-2.5" },
          h("div", { className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" },
            h("span", { className: "text-[14px] font-medium text-ink break-words" }, ROLE_FAMILY_LABELS[direction.role_family]),
            h("span", { className: "num text-[13px] text-ink-3 whitespace-nowrap" }, `${direction.job_count} 个岗位`),
          ),
          skillChips(direction.top_skills),
        ),
      ),
    ),
    h("h3", { className: SUBTITLE_CLASS }, "职位榜"),
    h(
      "ul",
      { className: "mt-2 divide-y divide-line-soft" },
      ...catalog.titles.map((title) =>
        h(
          "li",
          { key: title.title_key, "data-rank-title": title.title_key, className: "py-2.5" },
          h("div", { className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" },
            h("span", { className: "text-[14px] font-medium text-ink break-words" }, title.title_display),
            h("span", { className: "num text-[13px] text-ink-3 whitespace-nowrap" }, `${title.job_count} 个岗位`),
          ),
          h(
            "p",
            { className: `mt-1 ${MUTED_CLASS}` },
            `${title.cities.length > 0 ? title.cities.join("、") : "城市未知"} · 学生友好 ${title.student_friendly_count} · 最近发布 ${publishedAtText(title.latest_published_at)}`,
          ),
        ),
      ),
    ),
    h(
      Link,
      Object.assign(
        { to: "/career-insights/jobs", className: "mt-4 inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-[13px] font-medium text-ink-2" },
        { "data-hot-all": "" },
      ),
      "查看全部岗位",
    ),
    h("h3", { className: SUBTITLE_CLASS }, "市场信号"),
    signals
      ? h(CareerSignals, { signals: signals.signals, skipped: signals.skipped })
      : h("p", { "data-signals-unavailable": "", className: MUTED_CLASS }, BLOCK_UNAVAILABLE_TEXT),
  ]);
}

function StudentAdviceSection({ brief }: { brief: CareerBriefV1 | null }): ReactElement {
  if (!brief || brief.actions.length === 0) {
    return section("career-student-advice", "学生就业建议", [note(INSUFFICIENT_DATA_TEXT, "data-advice-empty")]);
  }
  return section("career-student-advice", "学生就业建议", [
    h("p", { className: MUTED_CLASS }, "来自离线研判的行动建议；用于准备方向，不构成录用保证。"),
    bullets(brief.actions, "data-advice-item"),
  ]);
}

function PolicyJobsSection({ summary }: { summary: SummaryResponseV1 | null }): ReactElement | null {
  if (!summary) return section("career-policy-jobs", "政策与岗位联动", [note(BLOCK_UNAVAILABLE_TEXT, "data-section-unavailable")]);
  // 政策与岗位没有共同主题时整块隐藏，不留空卡片。
  if (summary.shared_themes.length === 0) return null;

  return section("career-policy-jobs", "政策与岗位联动", [
    h("p", { className: MUTED_CLASS }, "只表示政策方向与招聘需求的呼应，不表示因果关系。"),
    h(
      "ul",
      { className: "mt-3 space-y-3" },
      ...summary.shared_themes.map((theme) =>
        h(
          "li",
          { key: theme.theme_id, "data-shared-theme": theme.theme_id, className: "rounded-card border border-line bg-bg-sunk p-4" },
          h(
            "div",
            { className: "flex flex-wrap items-baseline gap-x-3 gap-y-1" },
            h("h3", { className: "text-[15px] font-semibold text-ink break-words" }, theme.label),
            h("span", { className: MUTED_CLASS }, `政策 ${theme.policy_count} 条`),
            h("span", { className: MUTED_CLASS }, `岗位 ${theme.job_count} 个`),
          ),
          theme.policies.length > 0
            ? h(
                "ul",
                { className: "mt-2 space-y-1.5" },
                ...theme.policies.map((policy) =>
                  h(
                    "li",
                    { key: policy.policy_item_id, className: "text-[13px] break-words" },
                    h(
                      "a",
                      { href: policy.official_url, target: "_blank", rel: "noopener noreferrer", className: "text-accent hover:underline" },
                      policy.title,
                    ),
                  ),
                ),
              )
            : null,
        ),
      ),
    ),
  ]);
}

function MethodSection({ summary, catalog, brief }: {
  summary: SummaryResponseV1 | null;
  catalog: CareerCatalogResponseV1 | null;
  brief: CareerBriefV1 | null;
}): ReactElement {
  if (!summary) return section("career-method", "数据范围与方法", [note(BLOCK_UNAVAILABLE_TEXT, "data-section-unavailable")]);

  const unknownFamily = unknownFamilyMetric(summary);
  const unknownSkill = unknownSkillMetric(summary);
  const unknownLines = [
    unknownFamily
      ? `未分类职位 ${unknownFamily.unknown_count ?? 0} 个${unknownFamily.unknown_ratio !== undefined && unknownFamily.unknown_ratio !== null ? ` · 占比 ${formatRatioPercent(unknownFamily.unknown_ratio)}` : ""}`
      : undefined,
    unknownSkill
      ? `未识别技能岗位 ${unknownSkill.unknown_count ?? 0} 个${unknownSkill.unknown_ratio !== undefined && unknownSkill.unknown_ratio !== null ? ` · 占比 ${formatRatioPercent(unknownSkill.unknown_ratio)}` : ""}`
      : undefined,
    ...summary.warnings.filter((warning) => warning.code === "unknown_fields").map((warning) => warning.message),
  ].filter((line): line is string => line !== undefined);
  const limitations = brief && brief.limitations.length > 0
    ? brief.limitations
    : ["口径基于公开岗位与公开政策样本，未覆盖未公开招聘；热点会随采集窗口变化。"];

  return section("career-method", "数据范围与方法", [
    h(
      "dl",
      { className: "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" },
      h("div", null, h("dt", { className: MUTED_CLASS }, "采集来源"), h("dd", { "data-method-source": String(summary.source_count), className: "text-[13px] text-ink-2" }, `${summary.source_count} 个来源`)),
      h("div", null, h("dt", { className: MUTED_CLASS }, "样本量"), h("dd", { "data-method-sample": String(catalog?.sample_size ?? summary.sample_size), className: "text-[13px] text-ink-2" }, `${catalog?.sample_size ?? summary.sample_size} 个有效岗位 · ${summary.company_count} 家公司`)),
      h("div", null, h("dt", { className: MUTED_CLASS }, "观测时间"), h("dd", { className: "text-[13px] text-ink-2" }, h(CareerTime, { value: summary.as_of }))),
      h("div", null, h("dt", { className: MUTED_CLASS }, "观察窗"), h("dd", { className: "text-[13px] text-ink-2" }, `${catalog?.window_days ?? 30} 天`)),
      h("div", null, h("dt", { className: MUTED_CLASS }, "观测日"), h("dd", { "data-method-observed-days": summary.has_multiple_snapshots ? "multi" : "single", className: "text-[13px] text-ink-2" }, summary.has_multiple_snapshots ? "≥2 个观测日" : "仅 1 个快照")),
      h("div", null, h("dt", { className: MUTED_CLASS }, "词典版本"), h("dd", { className: "text-[13px] text-ink-2" }, `v${summary.dictionary_version}`)),
    ),
    unknownLines.length > 0 ? h("h3", { className: SUBTITLE_CLASS }, "未知字段") : null,
    unknownLines.length > 0 ? bullets(unknownLines, "data-method-unknown") : null,
    h("h3", { className: SUBTITLE_CLASS }, "局限"),
    bullets([...limitations, HOT_DEFINITION], "data-method-limitation"),
  ]);
}

export function CareerInsightsBoard({ summary, catalog, signals, brief }: {
  summary: SummaryResponseV1 | null;
  catalog: CareerCatalogResponseV1 | null;
  signals: CareerSignalsResponseV1 | null;
  brief: CareerBriefV1 | null;
}): ReactElement {
  const fixture = summary?.data_origin === "synthetic_fixture" || catalog?.data_origin === "synthetic_fixture";
  const singleSnapshot = summary !== null && summary.sample_size > 0 && !summary.has_multiple_snapshots;

  return h(
    "div",
    { className: "space-y-6 pb-10 pt-3" },
    h(
      "header",
      null,
      h("h1", { "data-page-title": "", className: "text-[24px] font-semibold text-ink" }, "职业洞察"),
      h("p", { className: "mt-1 text-[13px] leading-relaxed text-ink-3" }, "AI 趋势研判、岗位与技能变化、政策联动；所有指标来自 API。"),
    ),
    fixture
      ? h("div", { role: "note", className: "rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-900 break-words" }, "联调样例（非真实数据）")
      : null,
    singleSnapshot
      ? h("div", { role: "note", className: "rounded-card border border-line bg-bg-sunk px-4 py-3 text-[13px] leading-relaxed text-ink-3 break-words" }, "当前仅有单快照，新增岗位与变化趋势数据不足，不作趋势推断。")
      : null,
    h(BriefSection, { brief }),
    h(JobTrendSection, { catalog }),
    h(SkillTrendSection, { summary, catalog }),
    h(HotJobsSection, { catalog, signals }),
    h(StudentAdviceSection, { brief }),
    h(PolicyJobsSection, { summary }),
    h(MethodSection, { summary, catalog, brief }),
  );
}