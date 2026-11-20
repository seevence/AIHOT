// 首页数据工作台：已有什么岗位、需求在怎么变、我该怎么准备。
// 每个区块独立降级——某一接口失败只让该区块显示「本区块暂时不可用」，其余照常渲染。
import type { ReactNode } from "react";
import { Link } from "react-router";
import type {
  CareerCatalogResponseV1,
  CareerDailyResponseV1,
  CareerDirectionV1,
  CareerSignalsResponseV1,
  JobListItemV1,
  JobListResponseV1,
  SummaryResponseV1,
} from "@aihot/career-insights/contracts";
import {
  ROLE_FAMILY_LABELS,
  STUDENT_FRIENDLY_LABELS,
  skillLabel,
} from "../../../../../modules/career-insights/web/labels.ts";
import { buildDirectionHref } from "../../../../../modules/career-insights/web/filters.ts";
import { UNKNOWN_RATIO_LABEL, formatRatioPercent } from "../../../../../modules/career-insights/web/feeds.ts";
import { CareerTime } from "../../../../../modules/career-insights/web/time.ts";
import { CareerSignals } from "../../../../../modules/career-insights/web/components/CareerSignals.ts";
import type { HomeBriefState } from "./contracts.ts";
import { HOME_LATEST_JOBS } from "./contracts.ts";
import {
  BLOCK_UNAVAILABLE,
  BLOCK_UNAVAILABLE_HINT,
  KEEP_OBSERVING,
  KEEP_OBSERVING_HINT,
  homeIndicators,
  prepareHints,
} from "./view.ts";

const SECTION_CLASS = "rounded-card border border-line bg-surface p-5";
const JOBS_CATALOG_HREF = "/career-insights/jobs";

const CONFIDENCE_LABELS = { low: "置信度低", medium: "置信度中", high: "置信度高" } as const;

/** 区块级降级：不整页失败，也不隐藏其它区块。 */
function Unavailable({ title }: { title: string }) {
  return (
    <div role="status" className="mt-3 rounded-card border border-line-soft bg-bg-sunk px-4 py-4">
      <p className="text-[13px] font-medium text-ink-2">{title}：{BLOCK_UNAVAILABLE}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-4 break-words">{BLOCK_UNAVAILABLE_HINT}</p>
    </div>
  );
}

function SectionHeader({ id, title, aside }: { id: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="text-[16px] font-semibold text-ink">{title}</h2>
      {aside}
    </div>
  );
}

function Overview({ summary, catalog }: { summary: SummaryResponseV1 | null; catalog: CareerCatalogResponseV1 | null }) {
  return (
    <section aria-labelledby="home-overview" className={SECTION_CLASS}>
      <SectionHeader
        id="home-overview"
        title="今日概览"
        aside={<span className="text-[12px] text-ink-4 break-words">{catalog ? `观察窗 ${catalog.window_days} 天` : "观察窗 —"}</span>}
      />
      {summary === null ? (
        <Unavailable title="今日概览" />
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-[12px] text-ink-4">有效岗位</dt>
              <dd className="num mt-1 text-[22px] font-semibold text-ink">{summary.sample_size}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-4">招聘企业</dt>
              <dd className="num mt-1 text-[22px] font-semibold text-ink">{summary.company_count}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-4">采集来源</dt>
              <dd className="num mt-1 text-[22px] font-semibold text-ink">{summary.source_count}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-4">数据截至</dt>
              <dd className="mt-1 text-[13px] font-medium text-ink-2"><CareerTime value={summary.as_of} /></dd>
            </div>
          </dl>
          {!summary.has_multiple_snapshots && (
            <p className="mt-3 text-[12px] leading-relaxed text-ink-4 break-words">
              当前只有一次观测；新增岗位与变化趋势的数据不足，不作趋势推断。
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Brief({ brief }: { brief: HomeBriefState }) {
  return (
    <section aria-labelledby="home-brief" className={SECTION_CLASS}>
      <SectionHeader
        id="home-brief"
        title="AI 就业研判"
        aside={brief.status === "ok" ? (
          <span className="rounded-full bg-bg-sunk px-2 py-0.5 text-[11px] text-ink-3">{CONFIDENCE_LABELS[brief.data.confidence]}</span>
        ) : undefined}
      />
      {brief.status === "failed" && <Unavailable title="AI 就业研判" />}
      {brief.status === "empty" && (
        <div role="status" className="mt-3 rounded-card border border-line-soft bg-bg-sunk px-4 py-4">
          <p className="text-[14px] font-medium text-ink-2">{KEEP_OBSERVING}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-4 break-words">{KEEP_OBSERVING_HINT}</p>
        </div>
      )}
      {brief.status === "ok" && (
        <>
          <dl className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <dt className="text-[12px] font-medium text-ink-4">已观测事实</dt>
              <dd>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-2">
                  {brief.data.facts.map((fact) => <li key={fact} className="break-words">{fact}</li>)}
                </ul>
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-medium text-ink-4">趋势推断</dt>
              <dd>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-2">
                  {brief.data.inferences.map((line) => <li key={line} className="break-words">{line}</li>)}
                </ul>
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-medium text-ink-4">可以做的事</dt>
              <dd>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-2">
                  {brief.data.actions.map((line) => <li key={line} className="break-words">{line}</li>)}
                </ul>
              </dd>
            </div>
          </dl>
          {brief.data.limitations.length > 0 && (
            <p className="mt-3 text-[12px] leading-relaxed text-ink-4 break-words">
              限制：{brief.data.limitations.join("；")}
            </p>
          )}
          <p className="mt-2 text-[11.5px] text-ink-4 break-words">
            离线生成于 <CareerTime value={brief.data.generated_at} /> · 基于样本 {brief.data.sample_size} 个岗位，读者打开页面不调用模型。
          </p>
        </>
      )}
    </section>
  );
}

function Indicators({ summary }: { summary: SummaryResponseV1 | null }) {
  return (
    <section aria-labelledby="home-indicators">
      <SectionHeader id="home-indicators" title="需求变化" />
      {summary === null ? (
        <div className="mt-3 rounded-card border border-line bg-surface px-5 py-4">
          <Unavailable title="需求变化" />
        </div>
      ) : (
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {homeIndicators(summary).map((indicator) => (
            <div key={indicator.label} className="rounded-card border border-line bg-surface px-5 py-4">
              <dt className="text-[12px] text-ink-4">{indicator.label}</dt>
              <dd className={`mt-1 font-semibold text-ink ${indicator.pending ? "text-[14px]" : "num text-[26px]"}`}>
                {indicator.value}
              </dd>
              <dd className="mt-1 text-[11.5px] leading-relaxed text-ink-4 break-words">{indicator.note}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function DirectionRow({ direction }: { direction: CareerDirectionV1 }) {
  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link to={buildDirectionHref(direction.role_family)} className="text-[15px] font-semibold text-ink break-words hover:text-accent">
          {ROLE_FAMILY_LABELS[direction.role_family]}
        </Link>
        <span className="num text-[13px] text-ink-2">{direction.job_count} 个岗位</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-4">
        <span className="num">观察窗新增 {direction.new_in_window}</span>
        <span className="num">应届友好 {direction.student_friendly_count}</span>
        <span className="num">{direction.company_count} 家公司</span>
      </div>
      {direction.top_skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {direction.top_skills.map((skill) => (
            <span key={skill.skill} className="rounded-full bg-bg-sunk px-2 py-0.5 text-[11.5px] text-ink-3">
              {skillLabel(skill.skill)} · {skill.count}
            </span>
          ))}
        </div>
      )}
      <Link to={buildDirectionHref(direction.role_family)} className="mt-2 inline-block text-[12px] font-medium text-accent hover:underline">
        查看证据
      </Link>
    </li>
  );
}

function TopDirections({ catalog }: { catalog: CareerCatalogResponseV1 | null }) {
  return (
    <section aria-labelledby="home-top-directions" className={SECTION_CLASS}>
      <SectionHeader
        id="home-top-directions"
        title="热门岗位 Top 6"
        aside={<Link to={JOBS_CATALOG_HREF} className="text-[12px] font-medium text-accent hover:underline">查看全部岗位 →</Link>}
      />
      <p className="mt-1 text-[12px] leading-relaxed text-ink-4 break-words">
        “热门”指当前有效岗位数量，不表示新闻热度、公司热度或未来增长。
      </p>
      {catalog === null ? (
        <Unavailable title="热门岗位" />
      ) : catalog.directions.length === 0 ? (
        <div role="status" className="mt-3 rounded-card border border-line-soft bg-bg-sunk px-4 py-5 text-center">
          <p className="text-[14px] font-medium text-ink-2">{KEEP_OBSERVING}</p>
          <p className="mt-1 text-[12px] text-ink-4">还没有可按方向聚合的岗位。</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-line-soft overflow-hidden rounded-card border border-line-soft">
          {catalog.directions.map((direction) => <DirectionRow key={direction.role_family} direction={direction} />)}
        </ul>
      )}
    </section>
  );
}

function MarketSignals({ signals }: { signals: CareerSignalsResponseV1 | null }) {
  if (signals === null) {
    return (
      <section aria-labelledby="home-signals" className={SECTION_CLASS}>
        <SectionHeader id="home-signals" title="市场信号" />
        <Unavailable title="市场信号" />
      </section>
    );
  }
  return <CareerSignals signals={signals.signals} skipped={signals.skipped} />;
}

function SkillsAndAdvice({ catalog }: { catalog: CareerCatalogResponseV1 | null }) {
  return (
    <section aria-labelledby="home-skills" className={SECTION_CLASS}>
      <SectionHeader id="home-skills" title="热门技能与准备建议" />
      {catalog === null ? (
        <Unavailable title="热门技能与准备建议" />
      ) : (
        <>
          {catalog.skills.length > 0 ? (
            <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {catalog.skills.slice(0, 6).map((skill) => (
                <li key={skill.skill} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-ink-2 break-words">{skillLabel(skill.skill)}</span>
                  <span className="num shrink-0 text-[12px] text-ink-4">
                    {skill.job_count} 个岗位 · {formatRatioPercent(skill.share)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-ink-3">{KEEP_OBSERVING}</p>
          )}
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-2">
            {prepareHints(catalog.skills).map((hint) => <li key={hint} className="break-words">{hint}</li>)}
          </ol>
          <p className="mt-2 text-[11.5px] text-ink-4">建议按当前样本的技能出现次数给出，样本变化时自动更新。</p>
        </>
      )}
    </section>
  );
}

function DailySummary({ daily }: { daily: CareerDailyResponseV1 | null }) {
  return (
    <section aria-labelledby="home-daily" className={SECTION_CLASS}>
      <SectionHeader
        id="home-daily"
        title="最新就业日报"
        aside={daily ? <Link to="/daily" className="text-[12px] font-medium text-accent hover:underline">查看今日日报 →</Link> : undefined}
      />
      {daily === null ? (
        <Unavailable title="最新就业日报" />
      ) : (
        <>
          {!daily.has_run && <p className="mt-2 text-[12px] text-ink-4">今日尚未采集，下列库表数字仍为当前值。</p>}
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-[12px] text-ink-4">今日新增岗位</dt>
              <dd className="num mt-1 text-[20px] font-semibold text-ink">{daily.new_jobs_today}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-4">今日新增政策</dt>
              <dd className="num mt-1 text-[20px] font-semibold text-ink">{daily.new_policies_today}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-4">职位库总量</dt>
              <dd className="num mt-1 text-[20px] font-semibold text-ink">{daily.jobs_total}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-4">{UNKNOWN_RATIO_LABEL}</dt>
              <dd className="num mt-1 text-[20px] font-semibold text-ink">{formatRatioPercent(daily.unknown_ratio)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] text-ink-4 break-words">
            <time dateTime={daily.date} className="num">{daily.date}</time> · 样本 {daily.sample_size} 个岗位
          </p>
        </>
      )}
    </section>
  );
}

function JobRow({ job }: { job: JobListItemV1 }) {
  return (
    <li className="px-4 py-3.5">
      <a
        href={job.official_url}
        target="_blank"
        rel="noreferrer noopener"
        className="text-[14px] font-semibold text-ink break-words hover:text-accent"
      >
        {job.title}
      </a>
      <div className="mt-1 text-[12px] text-ink-3 break-words">
        {job.company_name} · {job.locations.length > 0 ? job.locations.join("、") : "城市未知"}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-ink-4">
        <span>{ROLE_FAMILY_LABELS[job.role_family]}</span>
        <span>应届友好：{STUDENT_FRIENDLY_LABELS[job.student_friendly]}</span>
        <span>官方链接</span>
      </div>
    </li>
  );
}

function LatestJobs({ jobs }: { jobs: JobListResponseV1 | null }) {
  return (
    <section aria-labelledby="home-latest-jobs" className={SECTION_CLASS}>
      <SectionHeader
        id="home-latest-jobs"
        title="最新岗位"
        aside={<Link to={JOBS_CATALOG_HREF} className="text-[12px] font-medium text-accent hover:underline">查看全部 →</Link>}
      />
      {jobs === null ? (
        <Unavailable title="最新岗位" />
      ) : jobs.items.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-3">{KEEP_OBSERVING}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line-soft overflow-hidden rounded-card border border-line-soft">
          {jobs.items.slice(0, HOME_LATEST_JOBS).map((job) => <JobRow key={job.id} job={job} />)}
        </ul>
      )}
    </section>
  );
}

export function HomeWorkbench({ summary, catalog, signals, daily, latestJobs, brief }: {
  summary: SummaryResponseV1 | null;
  catalog: CareerCatalogResponseV1 | null;
  signals: CareerSignalsResponseV1 | null;
  daily: CareerDailyResponseV1 | null;
  latestJobs: JobListResponseV1 | null;
  brief: HomeBriefState;
}) {
  return (
    <div className="space-y-5 pb-10 pt-3">
      <header>
        <h1 data-page-title="" className="text-[24px] font-semibold text-ink">就业数据工作台</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3 break-words">
          已有什么岗位、需求在怎么变、我该怎么准备——同一屏看完，数据只来自已采集的公开岗位与政策。
        </p>
      </header>

      <Overview summary={summary} catalog={catalog} />
      <Brief brief={brief} />
      <Indicators summary={summary} />
      <TopDirections catalog={catalog} />
      <MarketSignals signals={signals} />
      <SkillsAndAdvice catalog={catalog} />
      <DailySummary daily={daily} />
      <LatestJobs jobs={latestJobs} />

      <p className="text-[12px] text-ink-4">
        <Link to="/all" className="font-medium text-accent hover:underline">浏览全部行业动态 →</Link>
      </p>
    </div>
  );
}