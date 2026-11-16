import { Link } from "react-router";
import type { JobListResponseV1, MetricResultV1, SummaryResponseV1 } from "@aihot/career-insights/contracts";
import { CareerEmpty, FixtureNotice, SingleSnapshotNotice } from "./CareerStates";

function metricValue(metric: MetricResultV1): string {
  if (metric.status === "insufficient_data") return "数据不足";
  if (metric.status === "not_applicable") return "不适用";
  if (metric.value === null) return "数据不足";
  if (metric.unit === "ratio") return `${metric.value}（比例）`;
  if (metric.unit === "count") return `${metric.value} 个`;
  return String(metric.value);
}

export function CareerDashboard({ summary, jobs }: { summary: SummaryResponseV1; jobs: JobListResponseV1 }) {
  const fixture = summary.data_origin === "synthetic_fixture" || jobs.data_origin === "synthetic_fixture";
  return (
    <div className="space-y-6 pb-10 pt-3">
      <header>
        <h1 data-page-title="" className="text-[24px] font-semibold text-ink">职业洞察</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">职位样本、技能需求与政策共享主题；所有指标均来自 API。</p>
      </header>

      {fixture && <FixtureNotice />}
      {summary.sample_size > 0 && !summary.has_multiple_snapshots && <SingleSnapshotNotice />}
      {(summary.sample_size === 0 || jobs.items.length === 0) && <CareerEmpty />}

      <section aria-labelledby="career-sample" className="rounded-card border border-line bg-surface p-5">
        <h2 id="career-sample" className="text-[16px] font-semibold text-ink">样本概况</h2>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div><dt className="text-[12px] text-ink-4">职位样本</dt><dd className="num mt-1 text-[20px] font-semibold text-ink">{summary.sample_size}</dd></div>
          <div><dt className="text-[12px] text-ink-4">公司</dt><dd className="num mt-1 text-[20px] font-semibold text-ink">{summary.company_count}</dd></div>
          <div><dt className="text-[12px] text-ink-4">来源</dt><dd className="num mt-1 text-[20px] font-semibold text-ink">{summary.source_count}</dd></div>
        </dl>
        <p className="mt-4 text-[12px] text-ink-4">数据截至 <time dateTime={summary.as_of}>{summary.as_of}</time> · 词典 {summary.dictionary_version}</p>
      </section>

      {summary.warnings.length > 0 && (
        <section aria-label="数据提示" className="rounded-card border border-line bg-surface p-4">
          <ul className="space-y-1 text-[13px] text-ink-3">
            {summary.warnings.map((warning) => <li key={`${warning.code}:${warning.message}`}>{warning.message}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="career-metrics">
        <h2 id="career-metrics" className="text-[18px] font-semibold text-ink">指标结果</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {summary.metrics.map((metric) => (
            <article key={`${metric.metric_id}:${metric.dimension.role_family ?? metric.dimension.skill_id ?? metric.dimension.theme_id ?? "overall"}`} className="rounded-card border border-line bg-surface p-4">
              <h3 className="text-[14px] font-semibold text-ink">{metric.label}</h3>
              <div className="num mt-2 text-[22px] font-semibold text-ink">{metricValue(metric)}</div>
              <p className="mt-2 text-[12px] text-ink-4">样本 {metric.sample_size} · 截至 {metric.as_of}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-3">{metric.disclaimer}</p>
            </article>
          ))}
        </div>
      </section>

      {summary.shared_themes.length > 0 && (
        <section aria-labelledby="career-themes">
          <h2 id="career-themes" className="text-[18px] font-semibold text-ink">政策与岗位共享主题</h2>
          <ul className="mt-3 space-y-2">
            {summary.shared_themes.map((theme) => (
              <li key={theme.theme_id} className="rounded-card border border-line bg-surface px-4 py-3">
                <span className="text-[14px] font-medium text-ink">{theme.label}</span>
                <span className="ml-2 text-[12px] text-ink-4">政策 {theme.policy_count} · 岗位 {theme.job_count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="career-jobs">
        <div className="flex items-baseline justify-between">
          <h2 id="career-jobs" className="text-[18px] font-semibold text-ink">职位列表</h2>
          <span className="num text-[12px] text-ink-4">共 {jobs.total} 条</span>
        </div>
        {jobs.items.length > 0 && (
          <ul className="mt-3 divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface">
            {jobs.items.map((job) => (
              <li key={job.id}>
                <Link to={`/career-insights/jobs/${encodeURIComponent(job.id)}`} className="block px-4 py-4 transition-colors hover:bg-bg-sunk">
                  <div className="text-[15px] font-semibold text-ink">{job.title}</div>
                  <div className="mt-1 text-[13px] text-ink-3">{job.company_name} · {job.locations.length > 0 ? job.locations.join("、") : "地点未知"}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink-4">
                    <span>{job.role_family}</span>
                    <span>{job.employment_type}</span>
                    <span>学生友好：{job.student_friendly}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}