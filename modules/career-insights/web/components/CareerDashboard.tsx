import { Link } from "react-router";
import type { JobFiltersV1, JobListItemV1, JobListResponseV1, RoleFamily, SummaryResponseV1 } from "@aihot/career-insights/contracts";
import { buildDirectionHref, buildJobHref, buildJobsHref } from "../filters";
import { EMPLOYMENT_TYPE_LABELS, ROLE_FAMILY_LABELS, STUDENT_FRIENDLY_LABELS } from "../labels";
import { CareerEmpty, FixtureNotice, SingleSnapshotNotice } from "./CareerStates";
import { CareerFilters } from "./CareerFilters";
import { DirectionView } from "./DirectionView";
import { FilterEmpty } from "./FilterEmpty";
import { MetricList } from "./MetricList";
import { Pagination } from "./Pagination";
import { SharedThemeList } from "./SharedThemeList";

const DIRECTION_VALUES: readonly RoleFamily[] = ["ai_algorithm", "ai_application_development", "data", "ai_product_operations"];

export type DirectionTarget = { roleFamily: RoleFamily; studentFriendlyTotal: number };

function hasActiveFilters(filters: JobFiltersV1): boolean {
  return Boolean(
    filters.role_family ||
    filters.company ||
    filters.city ||
    filters.employment_type ||
    filters.student_friendly ||
    filters.skill,
  );
}

function JobRow({ job, back }: { job: JobListItemV1; back: string }) {
  return (
    <li>
      <Link to={buildJobHref(job.id, back)} className="block px-4 py-4 transition-colors hover:bg-bg-sunk">
        <div className="text-[15px] font-semibold text-ink">{job.title}</div>
        <div className="mt-1 text-[13px] text-ink-3">{job.company_name} · {job.locations.length > 0 ? job.locations.join("、") : "地点未知"}</div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink-4">
          <span>{ROLE_FAMILY_LABELS[job.role_family]}</span>
          <span>{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</span>
          <span>学生友好：{STUDENT_FRIENDLY_LABELS[job.student_friendly]}</span>
        </div>
      </Link>
    </li>
  );
}

function DirectionLinks() {
  return (
    <section aria-labelledby="career-directions" className="rounded-card border border-line bg-surface p-4">
      <h2 id="career-directions" className="text-[16px] font-semibold text-ink">按目标方向查看</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {DIRECTION_VALUES.map((value) => (
          <Link key={value} to={buildDirectionHref(value)} className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-[13px] font-medium text-ink-2">
            {ROLE_FAMILY_LABELS[value]}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function CareerDashboard({ summary, jobs, filters, direction }: {
  summary: SummaryResponseV1;
  jobs: JobListResponseV1;
  filters: JobFiltersV1;
  direction?: DirectionTarget;
}) {
  const fixture = summary.data_origin === "synthetic_fixture" || jobs.data_origin === "synthetic_fixture";
  const noJobs = summary.sample_size === 0 || jobs.items.length === 0;
  const outOfRange = jobs.items.length === 0 && jobs.total > 0;

  return (
    <div className="space-y-6 pb-10 pt-3">
      <header>
        <h1 data-page-title="" className="text-[24px] font-semibold text-ink">职业洞察</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">职位样本、技能需求与政策共享主题；所有指标均来自 API。</p>
      </header>

      {fixture && <FixtureNotice />}
      {summary.sample_size > 0 && !summary.has_multiple_snapshots && <SingleSnapshotNotice />}

      <CareerFilters filters={filters} />

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

      {direction ? (
        <DirectionView
          roleFamily={direction.roleFamily}
          summary={summary}
          jobs={jobs}
          studentFriendlyTotal={direction.studentFriendlyTotal}
          filters={filters}
        />
      ) : (
        <>
          <DirectionLinks />

          <MetricList metrics={summary.metrics} />

          <SharedThemeList themes={summary.shared_themes} />

          <section aria-labelledby="career-jobs">
            <div className="flex items-baseline justify-between">
              <h2 id="career-jobs" className="text-[18px] font-semibold text-ink">职位列表</h2>
              <span className="num text-[12px] text-ink-4">共 {jobs.total} 条</span>
            </div>

            {noJobs ? (
              outOfRange ? (
                <div className="mt-3 rounded-card border border-line bg-surface p-6 text-center">
                  <p className="text-[14px] text-ink-2">当前页没有职位，可能已超出结果页数。</p>
                  <Link to={buildJobsHref({ ...filters, page: 1 })} className="mt-3 inline-flex h-9 items-center rounded-full border border-line-strong px-5 text-[13px] font-medium text-ink-2">
                    回到第 1 页
                  </Link>
                </div>
              ) : jobs.total === 0 && hasActiveFilters(filters) ? <div className="mt-3"><FilterEmpty /></div> : <div className="mt-3"><CareerEmpty /></div>
            ) : (
              <>
                <ul className="mt-3 divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface">
                  {jobs.items.map((job) => <JobRow key={job.id} job={job} back={buildJobsHref(filters)} />)}
                </ul>
                <Pagination page={jobs.page} pageSize={jobs.page_size} total={jobs.total} />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}