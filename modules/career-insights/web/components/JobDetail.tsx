import { Link } from "react-router";
import type { JobDetailV1 } from "@aihot/career-insights/contracts";
import {
  EMPLOYMENT_TYPE_LABELS,
  ROLE_FAMILY_LABELS,
  STUDENT_FRIENDLY_LABELS,
  skillLabel,
} from "../labels";

type Fact = { label: string; value: string; dateTime?: boolean };

const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCareerDateTime(value: string): string | null {
  if (!ISO_UTC_PATTERN.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateTimeFormatter.format(date);
}

export function CareerTime({ value, className }: { value: string; className?: string }) {
  const formatted = formatCareerDateTime(value);
  if (formatted === null) return <span className={className}>{value}</span>;
  return <time dateTime={value} className={className}>{formatted}</time>;
}

export function JobDetail({ job, backHref }: { job: JobDetailV1; backHref: string }) {
  const experience =
    job.experience_raw ??
    (job.experience_min_years !== null || job.experience_max_years !== null
      ? `${job.experience_min_years ?? "未知"}–${job.experience_max_years ?? "未知"} 年`
      : null);

  const facts: Fact[] = [];
  const addFact = (label: string, value: string | null | undefined, dateTime = false) => {
    if (value) facts.push({ label, value, dateTime });
  };
  addFact("职位类别", ROLE_FAMILY_LABELS[job.role_family] ?? job.role_family);
  addFact("用工类型", EMPLOYMENT_TYPE_LABELS[job.employment_type] ?? job.employment_type);
  addFact("学生友好", STUDENT_FRIENDLY_LABELS[job.student_friendly] ?? job.student_friendly);
  addFact("学历", job.degree_raw ?? job.degree);
  addFact("经验", experience);
  addFact("公司", job.company_name);
  addFact("城市", job.locations.join("、"));
  addFact("来源", job.source_key);
  addFact("发布时间", job.published_at, true);
  addFact("首次观测", job.first_seen_at, true);
  addFact("最近观测", job.last_seen_at, true);

  return (
    <>
      <Link to={backHref} className="inline-flex text-[13px] text-ink-3 hover:text-ink">← 返回职位列表</Link>

      <header>
        <h1 data-page-title="" className="text-[26px] font-bold leading-snug text-ink break-words">{job.title}</h1>
        <p className="mt-2 text-[15px] text-ink-3 break-words">
          {[job.company_name, job.locations.join("、")].filter(Boolean).join(" · ")}
        </p>
        <a href={job.official_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-10 max-w-full items-center rounded-full bg-accent px-5 text-[13px] font-medium text-accent-contrast">
          查看官方职位
        </a>
      </header>

      <section aria-labelledby="job-facts" className="rounded-card border border-line bg-surface p-5">
        <h2 id="job-facts" className="text-[17px] font-semibold text-ink">职位信息</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 text-[13px] sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-ink-4">{fact.label}</dt>
              <dd className="mt-1 text-ink-2 break-words">
                {fact.dateTime ? <CareerTime value={fact.value} /> : fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {job.skills.length > 0 && (
        <section aria-labelledby="job-skills">
          <h2 id="job-skills" className="text-[17px] font-semibold text-ink">技能要求</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {job.skills.map((skillId) => (
              <li key={skillId} className="max-w-full rounded-full border border-line bg-bg-sunk px-3 py-1 text-[12px] text-ink-2 break-words">
                {skillLabel(skillId)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="job-skill-evidence">
        <h2 id="job-skill-evidence" className="text-[17px] font-semibold text-ink">技能与证据</h2>
        {job.skill_evidence.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-3">暂无可确认的技能证据。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {job.skill_evidence.map((evidence) => (
              <li key={evidence.skill_id} className="rounded-card border border-line bg-surface p-4">
                <div className="text-[13px] font-semibold text-ink break-words">{skillLabel(evidence.skill_id)}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-3 break-words">{evidence.evidence_text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
