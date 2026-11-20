import { createElement as h, type ReactElement } from "react";
import type { CareerDailyResponseV1, CareerDailySourceV1 } from "../../contracts/index.ts";
import { DAILY_NO_RUN_TEXT, DAILY_SOURCE_STATUS_LABELS, UNKNOWN_RATIO_LABEL, formatRatioPercent } from "../feeds.ts";

function Figure({ label, value, note }: { label: string; value: string; note?: string }): ReactElement {
  return h(
    "div",
    { className: "text-center" },
    h("div", { className: "text-[12px] text-ink-4" }, label),
    h("div", { className: "num mt-1 text-[20px] font-semibold text-ink" }, value),
    note ? h("div", { className: "mt-1 text-[11.5px] text-ink-4" }, note) : null,
  );
}

function SourceRow({ source }: { source: CareerDailySourceV1 }): ReactElement {
  return h(
    "li",
    { "data-daily-source": source.source_key, className: "grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" },
    h(
      "div",
      { className: "min-w-0" },
      h("div", { className: "text-[14px] font-medium text-ink break-words" }, source.source_key),
      h(
        "div",
        { className: "mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-4" },
        h("span", null, "采集 ", h("span", { className: "num", "data-daily-collected": String(source.collected) }, String(source.collected))),
        h("span", null, "接受 ", h("span", { className: "num", "data-daily-accepted": String(source.accepted) }, String(source.accepted))),
        h("span", null, "更新 ", h("span", { className: "num", "data-daily-updated": String(source.updated) }, String(source.updated))),
        h("span", null, "重复 ", h("span", { className: "num", "data-daily-duplicates": String(source.duplicates) }, String(source.duplicates))),
      ),
    ),
    h(
      "span",
      { "data-daily-status": source.status, className: "text-[12px] text-ink-3" },
      DAILY_SOURCE_STATUS_LABELS[source.status],
    ),
  );
}

export function CareerDailyReport({ daily }: { daily: CareerDailyResponseV1 }): ReactElement {
  return h(
    "div",
    { "data-career-daily": "", className: "space-y-6 pb-10 pt-3" },
    h(
      "header",
      null,
      h("h1", { "data-page-title": "", className: "text-[24px] font-semibold text-ink" }, "就业日报"),
      h(
        "p",
        { className: "mt-1 text-[13px] leading-relaxed text-ink-3" },
        h("time", { dateTime: daily.date, "data-daily-date": daily.date, className: "num" }, daily.date),
        " · 采集来源、今日新增与库表概况",
      ),
    ),
    !daily.has_run
      ? h(
          "div",
          { "data-daily-no-run": "", role: "status", className: "rounded-card border border-line bg-bg-sunk px-4 py-3 text-[13px] font-medium text-ink-2" },
          DAILY_NO_RUN_TEXT,
        )
      : null,
    h(
      "section",
      { "aria-labelledby": "career-daily-sources" },
      h("div", { className: "mb-3 flex items-baseline justify-between px-1" },
        h("h2", { id: "career-daily-sources", className: "text-[16px] font-semibold text-ink" }, "各来源采集结果"),
        h("span", { className: "num text-[12px] text-ink-4" }, `共 ${daily.sources.length} 个来源`),
      ),
      daily.sources.length === 0
        ? h("div", { "data-daily-sources-empty": "", className: "rounded-card border border-line bg-surface px-5 py-6 text-center text-[13px] text-ink-4" }, "今天还没有任何来源的采集记录。")
        : h(
            "ul",
            { className: "divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface" },
            ...daily.sources.map((source) => h(SourceRow, { key: source.source_key, source })),
          ),
    ),
    h(
      "section",
      { "aria-labelledby": "career-daily-figures", className: "rounded-card border border-line bg-surface p-5" },
      h("h2", { id: "career-daily-figures", className: "text-[16px] font-semibold text-ink" }, "今日概况"),
      h(
        "dl",
        { className: "mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" },
        h(Figure, { label: "今日新增岗位", value: String(daily.new_jobs_today) }),
        h(Figure, { label: "今日新增政策", value: String(daily.new_policies_today) }),
        h(Figure, { label: "职位库总量", value: String(daily.jobs_total) }),
        h(Figure, { label: "政策库总量", value: String(daily.policies_total) }),
        h(Figure, {
          label: "空技能岗位",
          value: formatRatioPercent(daily.unknown_ratio),
          note: UNKNOWN_RATIO_LABEL,
        }),
      ),
      h("p", { className: "mt-4 text-[12px] text-ink-4" }, `空技能岗位占比按 ${daily.sample_size} 个职位样本计算。`),
    ),
  );
}