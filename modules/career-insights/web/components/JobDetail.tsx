import { Link } from "react-router";
import type { JobDetailResponseV1 } from "@aihot/career-insights/contracts";
import { FixtureNotice, SingleSnapshotNotice } from "./CareerStates";

export function JobDetail({ data }: { data: JobDetailResponseV1 }) {
  const { job, observations } = data;
  const experience = job.experience_raw ?? (
    job.experience_min_years !== null || job.experience_max_years !== null
      ? `${job.experience_min_years ?? "未知"}–${job.experience_max_years ?? "未知"} 年`
      : "未知"
  );

  return (
    <article className="space-y-6 pb-10 pt-3">
      <Link to="/career-insights" className="inline-flex text-[13px] text-ink-3 hover:text-ink">← 返回职业洞察</Link>
      {data.data_origin === "synthetic_fixture" && <FixtureNotice />}

      <header>
        <h1 data-page-title="" className="text-[26px] font-bold leading-snug text-ink">{job.title}</h1>
        <p className="mt-2 text-[15px] text-ink-3">{job.company_name} · {job.locations.length > 0 ? job.locations.join("、") : "地点未知"}</p>
        <a href={job.official_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-10 items-center rounded-full bg-accent px-5 text-[13px] font-medium text-accent-contrast">
          查看官方职位
        </a>
      </header>

      <p className="rounded-card border border-line bg-bg-sunk px-4 py-3 text-[13px] leading-relaxed text-ink-3">{data.notice}</p>

      <section aria-labelledby="job-facts" className="rounded-card border border-line bg-surface p-5">
        <h2 id="job-facts" className="text-[17px] font-semibold text-ink">职位信息</h2>
        <dl className="mt-4 grid gap-x-5 gap-y-3 text-[13px] sm:grid-cols-2">
          <div><dt className="text-ink-4">职位类别</dt><dd className="mt-1 text-ink-2">{job.role_family}</dd></div>
          <div><dt className="text-ink-4">用工类型</dt><dd className="mt-1 text-ink-2">{job.employment_type}</dd></div>
          <div><dt className="text-ink-4">学历</dt><dd className="mt-1 text-ink-2">{job.degree_raw ?? job.degree}</dd></div>
          <div><dt className="text-ink-4">经验</dt><dd className="mt-1 text-ink-2">{experience}</dd></div>
          <div><dt className="text-ink-4">学生友好</dt><dd className="mt-1 text-ink-2">{job.student_friendly}</dd></div>
          <div><dt className="text-ink-4">发布时间</dt><dd className="mt-1 text-ink-2">{job.published_at ?? "未知"}</dd></div>
          <div><dt className="text-ink-4">首次观测</dt><dd className="mt-1 text-ink-2">{job.first_seen_at}</dd></div>
          <div><dt className="text-ink-4">最近观测</dt><dd className="mt-1 text-ink-2">{job.last_seen_at}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="job-skills">
        <h2 id="job-skills" className="text-[17px] font-semibold text-ink">技能与证据</h2>
        {job.skill_evidence.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-3">暂无可确认的技能证据。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {job.skill_evidence.map((evidence) => (
              <li key={evidence.skill_id} className="rounded-card border border-line bg-surface p-4">
                <div className="text-[13px] font-semibold text-ink">{evidence.skill_id}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{evidence.evidence_text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="job-observations">
        <h2 id="job-observations" className="text-[17px] font-semibold text-ink">观测记录</h2>
        {observations.length === 1 && <div className="mt-3"><SingleSnapshotNotice /></div>}
        {observations.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-3">暂无观测记录。</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {observations.map((observation) => (
              <li key={observation.id} className="rounded-card border border-line bg-surface p-4">
                <time dateTime={observation.observed_at} className="text-[12px] text-ink-4">{observation.observed_at}</time>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{observation.evidence_excerpt}</p>
                <a href={observation.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-[12px] text-accent">查看观测来源</a>
                <div className="mono mt-2 break-all text-[11px] text-ink-4">{observation.content_hash} · {observation.collector_version}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}