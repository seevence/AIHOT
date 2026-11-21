// 岗位详情与职业洞察/政策页在搜索结果里的元数据：标题、描述、canonical，以及岗位详情的
// JobPosting 结构化数据。页面（web/routes/*.tsx）的 meta 只把 loader 数据交给这里，测试也断言这里，
// 文案与构造只写一份。站点名后缀、og:*、robots 由 @aihot/web/lib/seo 的 pageMeta 统一加。
import type { MetaDescriptor } from "react-router";
import { pageMeta, siteUrl } from "@aihot/web/lib/seo";
import type { DataOrigin, EmploymentType } from "../contracts/index.ts";
import type { JobDetailResponseV1, JobDetailV1 } from "../contracts/api.ts";
import { EMPLOYMENT_TYPE_LABELS, ROLE_FAMILY_LABELS, STUDENT_FRIENDLY_LABELS, skillLabel } from "./labels.ts";

/** 岗位详情页地址；canonical 与 JobPosting 的 @id 都用它，查询参数（如 back）不进地址。 */
export function jobDetailPath(id: string): string {
  return `/career-insights/jobs/${encodeURIComponent(id)}`;
}

/** 职业洞察页在搜索结果里的地址。 */
export const DASHBOARD_PATH = "/career-insights";
/** 政策文件页在搜索结果里的地址；来源/主题筛选是浏览视图，canonical 始终回到这一页。 */
export const POLICIES_PATH = "/career-insights/policies";

/** 观测摘录是抓取到的原文片段：去掉标签、还原几个常见实体、压掉换行，只留纯文本。 */
function plainText(value: string, limit: number): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

/** 岗位已知字段拼成的事实短语：只写库里有的值，缺的、unknown 的不编。 */
function jobFacts(job: JobDetailV1): string[] {
  const facts: string[] = [];
  if (job.locations.length > 0) facts.push(`城市：${job.locations.join("、")}`);
  if (job.role_family !== "unknown") facts.push(`职位类别：${ROLE_FAMILY_LABELS[job.role_family]}`);
  if (job.employment_type !== "unknown") facts.push(`用工类型：${EMPLOYMENT_TYPE_LABELS[job.employment_type]}`);
  if (job.student_friendly !== "unknown") facts.push(`学生友好：${STUDENT_FRIENDLY_LABELS[job.student_friendly]}`);
  if (job.degree_raw) facts.push(`学历：${job.degree_raw}`);
  if (job.experience_raw) facts.push(`经验：${job.experience_raw}`);
  const skills = job.skills.slice(0, 6).map(skillLabel);
  if (skills.length > 0) facts.push(`技能：${skills.join("、")}`);
  return facts;
}

/** 搜索结果的描述：公司与职位名加上库里的城市/职族/用工类型/学生友好等事实，不写没有依据的判断。 */
export function jobDescription(job: JobDetailV1): string {
  const facts = jobFacts(job);
  return `${job.company_name}招聘「${job.title}」${facts.length > 0 ? `：${facts.join("；")}` : ""}。岗位信息来自 ${job.source_key} 官方招聘页的公开观测，以原文为准。`;
}

/** schema.org 的用工类型：只知道笼统方向的不猜。 */
function schemaEmploymentType(type: EmploymentType): string | null {
  return ({ campus: "FULL_TIME", internship: "INTERN", experienced: "FULL_TIME", other: "OTHER", unknown: null })[type] ?? null;
}

/** 工作地点：国家固定 CN；有城市时各地一个 Place，多个城市给数组。 */
function jobLocation(locations: string[]) {
  const place = (city?: string) => ({
    "@type": "Place",
    address: { "@type": "PostalAddress", addressCountry: "CN", ...(city ? { addressLocality: city } : {}) },
  });
  return locations.length > 1 ? locations.map((city) => place(city)) : place(locations[0]);
}

/**
 * JobPosting 的 description：结构化字段一句，加上最近一条观测摘录（与页面展示的是同一段，raw_text 前
 * EXCERPT_LIMIT 字符）；契约不公开完整 raw_text，不另编内容。截到 800 字，去 HTML 后只留纯文本。
 */
export function jobPostingDescription(detail: JobDetailResponseV1): string {
  const job = detail.job;
  const facts = jobFacts(job);
  const heading = `招聘岗位：${job.title}；公司：${job.company_name}${facts.length > 0 ? `；${facts.join("；")}` : ""}`;
  const excerpt = detail.observations[0]?.evidence_excerpt;
  return plainText(`${heading}\n\n${excerpt ?? ""}`, 800);
}

/**
 * 岗位详情页的 JobPosting 结构化数据；联调样例（synthetic_fixture）是虚构职位，返回 null 不输出。
 * 不写 validThrough：岗位是否仍在招以最近一次观测为准，写一个过期日会误导搜索引擎与读者。
 */
export function jobPostingLd(detail: JobDetailResponseV1): Record<string, unknown> | null {
  if (detail.data_origin === "synthetic_fixture") return null;
  const job = detail.job;
  const employmentType = schemaEmploymentType(job.employment_type);
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "@id": `${siteUrl()}${jobDetailPath(job.id)}#jobposting`,
    title: job.title,
    datePosted: job.first_seen_at,
    hiringOrganization: { "@type": "Organization", name: job.company_name },
    jobLocation: jobLocation(job.locations),
    ...(employmentType ? { employmentType } : {}),
    description: jobPostingDescription(detail),
    directApply: false,
  };
}

/** 职位详情页的 meta：标题是职位名（pageMeta 会自动接「 · 站名」），canonical 带 id。 */
export function jobMeta(detail: JobDetailResponseV1): MetaDescriptor[] {
  return pageMeta({
    title: detail.job.title,
    description: jobDescription(detail.job),
    path: jobDetailPath(detail.job.id),
    type: "article",
    noindex: detail.data_origin === "synthetic_fixture",
    jsonLd: jobPostingLd(detail) ?? undefined,
  });
}

/** 职业洞察页的 meta；联调样例不索引。 */
export function careerDashboardMeta(dataOrigin?: DataOrigin): MetaDescriptor[] {
  return pageMeta({
    title: "职业洞察：岗位职族、技能需求与政策动向",
    description: "岗位与政策的结构化洞察：职族占比、技能需求、学生友好职位与政策共享主题，数据来自官方招聘与政府公开来源，随每日观测更新。",
    path: DASHBOARD_PATH,
    noindex: dataOrigin === "synthetic_fixture",
  });
}

/** 政策文件页的 meta；联调样例不索引。 */
export function careerPoliciesMeta(dataOrigin?: DataOrigin): MetaDescriptor[] {
  return pageMeta({
    title: "政策文件：就业与人才培养政策原文汇总",
    description: "汇总政府官网发布的就业、人才培养与数字经济相关政策文件，按来源与主题筛选，附原文链接。",
    path: POLICIES_PATH,
    noindex: dataOrigin === "synthetic_fixture",
  });
}
