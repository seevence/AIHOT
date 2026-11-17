import type { MetricResultV1 } from "@aihot/career-insights/contracts";
import { EvidenceList } from "./EvidenceList";

function formatValue(metric: MetricResultV1): string {
  if (metric.status === "insufficient_data") return "数据不足";
  if (metric.status === "not_applicable") return "不适用";
  if (metric.value === null) return "数据不足";
  if (metric.unit === "ratio") return `${(metric.value * 100).toFixed(1)}%`;
  if (metric.unit === "count") return `${metric.value} 个`;
  return String(metric.value);
}

function MetricCard({ metric }: { metric: MetricResultV1 }) {
  const expandable = metric.status === "ok" && metric.evidence.length > 0;

  return (
    <article data-metric-id={metric.metric_id} className="rounded-card border border-line bg-surface p-5">
      <h3 className="text-[13px] font-medium text-ink-3">{metric.label}</h3>
      <p className="mt-2 text-[26px] font-bold leading-none text-ink">{formatValue(metric)}</p>

      <dl className="mt-4 space-y-1 text-[12px] text-ink-4">
        <div className="flex gap-2">
          <dt>样本</dt>
          <dd className="text-ink-2">{metric.sample_size}</dd>
        </div>
        <div className="flex gap-2">
          <dt>统计时间</dt>
          <dd className="mono text-ink-2">{metric.as_of}</dd>
        </div>
        {metric.unknown_count !== undefined && (
          <div className="flex gap-2">
            <dt>未识别</dt>
            <dd className="text-ink-2">未识别 {metric.unknown_count} 个</dd>
          </div>
        )}
        {metric.unknown_ratio !== undefined && metric.unknown_ratio !== null && (
          <div className="flex gap-2">
            <dt>未识别占比</dt>
            <dd className="text-ink-2">未识别占比 {(metric.unknown_ratio * 100).toFixed(1)}%</dd>
          </div>
        )}
        {metric.dictionary_version !== undefined && (
          <div className="flex gap-2">
            <dt>词典</dt>
            <dd className="mono text-ink-2">词典 v{metric.dictionary_version}</dd>
          </div>
        )}
      </dl>

      <p className="mt-4 text-[12px] leading-relaxed text-ink-3">{metric.disclaimer}</p>

      {expandable && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-[13px] font-medium text-ink-2">证据（{metric.evidence.length}）</summary>
          <EvidenceList evidence={metric.evidence} />
        </details>
      )}
    </article>
  );
}

export function MetricList({ metrics }: { metrics: MetricResultV1[] }) {
  if (metrics.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {metrics.map((metric) => (
        <MetricCard key={metric.metric_id} metric={metric} />
      ))}
    </div>
  );
}