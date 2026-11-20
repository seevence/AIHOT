import { createElement as h, type ReactElement } from "react";
import { Link } from "react-router";
import type { CareerSignalSkippedV1, CareerSignalV1 } from "../../contracts/index.ts";
import { SIGNAL_EMPTY_HINT, SIGNAL_EMPTY_TITLE, SIGNAL_RULE_LABELS, careerJobHref, skippedSurgeNotice } from "../feeds.ts";

const CARD_CLASS = "rounded-card border border-line bg-surface p-5";
const BADGE_CLASS = "inline-flex h-5 shrink-0 items-center rounded-full bg-amber-soft px-2 text-[11px] font-medium leading-none text-amber-ink";

function SignalItem({ signal }: { signal: CareerSignalV1 }): ReactElement {
  return h(
    "li",
    { "data-signal-item": signal.rule, className: "px-4 py-3.5" },
    h(
      "div",
      { className: "flex flex-wrap items-center gap-x-2 gap-y-1" },
      h("span", { "data-signal-rule": signal.rule, className: BADGE_CLASS }, SIGNAL_RULE_LABELS[signal.rule]),
      h("span", { "data-signal-company": signal.company, className: "text-[12px] text-ink-4 break-words" }, signal.company),
    ),
    h(
      "h3",
      { className: "mt-1 text-[15px] font-semibold text-ink break-words" },
      h(Link, { to: careerJobHref(signal.job_id), className: "transition-colors hover:text-accent" }, h("span", { "data-signal-title": signal.job_title }, signal.job_title)),
    ),
    h("p", { "data-signal-reason": signal.rule, className: "mt-1 text-[13px] leading-relaxed text-ink-3 break-words" }, signal.reason_text),
  );
}

export function CareerSignals({ signals, skipped }: { signals: readonly CareerSignalV1[]; skipped: readonly CareerSignalSkippedV1[] }): ReactElement {
  const surgeSkipped = skipped.filter((entry) => entry.rule === "surge").length;
  return h(
    "section",
    { "aria-labelledby": "career-signals", className: CARD_CLASS },
    h("h2", { id: "career-signals", className: "text-[16px] font-semibold text-ink" }, "值得注意的信号"),
    signals.length === 0
      ? h(
          "div",
          { "data-signals-empty": "", role: "status", className: "mt-3 rounded-card border border-line-soft bg-bg-sunk px-4 py-5 text-center" },
          h("p", { className: "text-[14px] font-medium text-ink-2" }, SIGNAL_EMPTY_TITLE),
          h("p", { className: "mt-1 text-[12.5px] text-ink-4" }, SIGNAL_EMPTY_HINT),
        )
      : h(
          "ul",
          { className: "mt-3 divide-y divide-line-soft overflow-hidden rounded-card border border-line-soft" },
          ...signals.map((signal) => h(SignalItem, { key: `${signal.rule}:${signal.job_id}:${signal.company}`, signal })),
        ),
    surgeSkipped > 0
      ? h("p", { "data-signals-skipped": String(surgeSkipped), className: "mt-3 text-[12px] text-ink-4 break-words" }, skippedSurgeNotice(surgeSkipped))
      : null,
  );
}