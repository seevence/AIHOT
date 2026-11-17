import { Link } from "react-router";
import type { JobFiltersV1, JobListResponseV1, RoleFamily, SummaryResponseV1 } from "@aihot/career-insights/contracts";
import { buildJobHref, buildJobsHref } from "../filters";
import { ROLE_FAMILY_LABELS } from "../labels";
import { MetricList } from "./MetricList";
import { SharedThemeList } from "./SharedThemeList";

const TOP_JOB_LIMIT = 5;

const DISCLAIMER = "以上组合基于本次公开样本与 0.1 版词典，不代表完整就业市场或录用概率。";

export function DirectionView({
  roleFamily,
  summary,
  jobs,
  studentFriendlyTotal,
  filters,
}: {
  roleFamily: RoleFamily;
  summary: SummaryResponseV1;
  jobs: JobListResponseV1;
  studentFriendlyTotal: number;
  filters: JobFiltersV1;
}) {
  const metrics = summary.metrics.filter(
    (metric) => metric.metric_id === "skill_demand_share" || metric.metric_id === "student_friendly_share",
  );
  const back = buildJobsHref(filters);

  return (
    <section aria-labelledby="direction-title" className="space-y-6">
      <div>
        <h2 id="direction-title" className="text-[18px] font-semibold text-ink">目标岗位方向：{ROLE_FAMILY_LABELS[roleFamily]}</h2>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3">
          <span className="num">该方向职位 {jobs.total}</span>
          <span className="num">其中学生友好 {studentFriendlyTotal}</span>
        </div>
      </div>

      <MetricList metrics={metrics} />

      <SharedThemeList themes={summary.shared_themes} />

      <div>
        <h3 className="text-[16px] font-semibold text-ink">该方向职位</h3>
        {jobs.items.length === 0 ? (
          <p className="mt-3 rounded-card border border-line bg-surface p-6 text-center text-[14px] text-ink-3">
            该方向暂无符合条件的职位。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface">
            {jobs.items.slice(0, TOP_JOB_LIMIT).map((job) => (
              <li key={job.id}>
                <Link to={buildJobHref(job.id, back)} className="block px-4 py-3 transition-colors hover:bg-bg-sunk">
                  <div className="text-[15px] font-semibold text-ink">{job.title}</div>
                  <div className="mt-1 text-[13px] text-ink-3">
                    {job.company_name} · {job.locations.length > 0 ? job.locations.join("、") : "地点未知"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/career-insights"
          className="mt-3 inline-flex h-9 items-center rounded-full border border-line-strong px-5 text-[13px] font-medium text-ink-2"
        >
          查看全部职位
        </Link>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-4">{DISCLAIMER}</p>
      </div>
    </section>
  );
}