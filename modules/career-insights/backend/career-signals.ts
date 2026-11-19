import { sql, type Db } from "@aihot/backend/db";
import type {
  CareerSignalEvidenceV1,
  CareerSignalSkippedV1,
  CareerSignalV1,
  CareerSignalsResponseV1,
} from "../contracts/insights.ts";
import type { DataOrigin, RoleFamily } from "../contracts/job.ts";
import { InvalidParameterError } from "./errors.ts";
import { resolveDataOrigin } from "./provenance.ts";

export const DEFAULT_SIGNAL_LIMIT = 10;
export const MAX_SIGNAL_LIMIT = 50;
export const DEFAULT_SIGNAL_WINDOW_DAYS = 30;
export const MAX_SIGNAL_WINDOW_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;
const SURGE_WINDOW_MS = DAY_MS;
const SURGE_MIN_JOBS = 5;
const SURGE_MULTIPLIER = 3;
const MIN_HISTORY_DAYS = 2;
const CROSS_INDUSTRY_MIN_JOBS = 3;
const CROSS_INDUSTRY_MIN_AI_RATIO = 0.6;

/**
 * 跨界词的匹配面是 title 与 skills。裸「结构」「电子」会误伤「数据结构」「电子商务」，
 * 因此这里只收录能明确指向硬件/制造/土建等非软件领域的词形。
 */
export const CROSS_DOMAIN_TERMS: readonly string[] = [
  "机械",
  "结构设计",
  "结构工程",
  "电气",
  "电子工程",
  "电子设计",
  "工艺",
  "材料",
  "硬件",
  "制造",
  "供应链",
  "物流",
  "土木",
  "建筑",
  "化工",
  "化学",
  "模具",
  "机电",
  "热设计",
  "散热",
  "mechanical",
  "hardware",
  "electrical",
  "structural",
  "manufacturing",
  "supply_chain",
  "supply chain",
  "material",
  "chemical",
  "civil engineering",
  "mold",
  "mechatronic",
];

/** 只描述算法/大模型方向，用来给 skill_mismatch 判定「标题是算法岗」。 */
export const ALGORITHM_TITLE_TERMS: readonly string[] = [
  "算法",
  "大模型",
  "机器学习",
  "深度学习",
  "模型训练",
  "强化学习",
  "推理引擎",
  "自然语言处理",
  "计算机视觉",
  "machine learning",
  "deep learning",
  "llm",
  "nlp",
];

const AI_FAMILIES: ReadonlySet<RoleFamily> = new Set<RoleFamily>([
  "ai_algorithm",
  "ai_application_development",
  "data",
  "ai_product_operations",
]);

const FAMILY_LABELS: Record<RoleFamily, string> = {
  ai_algorithm: "算法",
  ai_application_development: "AI 应用开发",
  data: "数据",
  ai_product_operations: "AI 产品运营",
  unknown: "未分类",
};

export interface CareerSignalsOptions {
  limit: number;
  window_days: number;
}

interface SignalJobRow {
  id: string;
  company_name: string;
  title: string;
  role_family: RoleFamily;
  skills: string[] | null;
  source_key: string;
  official_url: string;
  first_seen_at: Date;
  data_origin: DataOrigin;
}

interface SignalDraft {
  signal: CareerSignalV1;
  family: string;
}

function iso(value: Date): string {
  return new Date(value).toISOString();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function matchedTerms(text: string, terms: readonly string[]): string[] {
  const haystack = text.toLowerCase();
  return terms.filter((term) => haystack.includes(term.toLowerCase()));
}

function jobText(row: SignalJobRow): string {
  return `${row.title} ${(row.skills ?? []).join(" ")}`;
}

function draft(
  rule: CareerSignalV1["rule"],
  row: SignalJobRow,
  evidence: CareerSignalEvidenceV1,
  reasonText: string,
  confidence: CareerSignalV1["confidence"],
  family: string = row.role_family,
): SignalDraft {
  return {
    family,
    signal: {
      rule,
      company: row.company_name,
      job_id: row.id,
      job_title: row.title,
      evidence,
      reason_text: reasonText,
      source_key: row.source_key,
      official_url: row.official_url,
      first_seen_at: iso(row.first_seen_at),
      confidence,
    },
  };
}

function byCompany(rows: SignalJobRow[]): Map<string, SignalJobRow[]> {
  const groups = new Map<string, SignalJobRow[]>();
  for (const row of rows) {
    const list = groups.get(row.company_name) ?? [];
    list.push(row);
    groups.set(row.company_name, list);
  }
  return groups;
}

/**
 * 算法/AI 族占多数的公司里出现机械/硬件等非 AI 岗位。
 * 例：某大模型公司其余岗位都是算法，却招聘「机械设计工程师」。
 */
function crossIndustry(
  company: string,
  jobs: SignalJobRow[],
): SignalDraft[] {
  if (jobs.length < CROSS_INDUSTRY_MIN_JOBS) return [];
  const aiCount = jobs.filter((job) => AI_FAMILIES.has(job.role_family)).length;
  const aiRatio = aiCount / jobs.length;
  if (aiRatio < CROSS_INDUSTRY_MIN_AI_RATIO) return [];

  const drafts: SignalDraft[] = [];
  for (const job of jobs) {
    if (AI_FAMILIES.has(job.role_family)) continue;
    const terms = matchedTerms(jobText(job), CROSS_DOMAIN_TERMS);
    if (terms.length === 0) continue;
    drafts.push(draft(
      "cross_industry",
      job,
      {
        company_job_count: jobs.length,
        ai_family_job_count: aiCount,
        ai_family_ratio: round2(aiRatio),
        matched_terms: terms,
      },
      `该公司 ${jobs.length} 个岗位中 ${aiCount} 个为算法/AI 族，本岗位要求 ${terms.join("、")}。`,
      "high",
    ));
  }
  return drafts;
}

/** 某公司在 window_days 内首次出现的职族：该族最早的 first_seen_at 落在窗口内，即此前没有该族。 */
function newFamilies(
  jobs: SignalJobRow[],
  windowStart: number,
  windowDays: number,
): SignalDraft[] {
  const groups = new Map<string, SignalJobRow[]>();
  for (const job of jobs) {
    if (job.role_family === "unknown") continue;
    const list = groups.get(job.role_family) ?? [];
    list.push(job);
    groups.set(job.role_family, list);
  }

  const drafts: SignalDraft[] = [];
  for (const [family, familyJobs] of groups) {
    const earliest = Math.min(...familyJobs.map((job) => new Date(job.first_seen_at).getTime()));
    if (earliest < windowStart) continue;
    const latest = familyJobs[0]!;
    drafts.push(draft(
      "new_family",
      latest,
      {
        role_family: family as RoleFamily,
        family_job_count: familyJobs.length,
        window_days: windowDays,
        earliest_first_seen_at: iso(new Date(earliest)),
      },
      `该公司近 ${windowDays} 天首次出现「${FAMILY_LABELS[family as RoleFamily]}」职族岗位，窗口内 ${familyJobs.length} 个，此前无该族招聘记录。`,
      familyJobs.length >= 2 ? "high" : "medium",
    ));
  }
  return drafts;
}

/**
 * 最近 24h 的 first_seen_at 数量是否 ≥5 且 ≥历史日均 3 倍。
 * 历史不足 2 天时日均没有意义，直接记为 insufficient_history 跳过该规则。
 */
function surges(
  company: string,
  jobs: SignalJobRow[],
  now: number,
): { drafts: SignalDraft[]; skipped: CareerSignalSkippedV1[] } {
  const recentStart = now - SURGE_WINDOW_MS;
  const recent = jobs.filter((job) => new Date(job.first_seen_at).getTime() >= recentStart);
  const history = jobs.filter((job) => new Date(job.first_seen_at).getTime() < recentStart);
  const historyStart = Math.min(...jobs.map((job) => new Date(job.first_seen_at).getTime()));
  const historyDays = (recentStart - historyStart) / DAY_MS;

  if (historyDays < MIN_HISTORY_DAYS) {
    return {
      drafts: [],
      skipped: [{
        rule: "surge",
        company,
        reason: "insufficient_history",
        history_days: round2(Math.max(historyDays, 0)),
      }],
    };
  }

  const dailyAverage = history.length / historyDays;
  const ratio = dailyAverage === 0 ? null : recent.length / dailyAverage;
  const surged = recent.length >= SURGE_MIN_JOBS && (ratio === null || ratio >= SURGE_MULTIPLIER);
  if (!surged) return { drafts: [], skipped: [] };

  const latest = recent[0]!;
  return {
    drafts: [draft(
      "surge",
      latest,
      {
        last_24h_jobs: recent.length,
        history_days: round2(historyDays),
        history_daily_average: round2(dailyAverage),
        surge_ratio: ratio === null ? null : round2(ratio),
      },
      ratio === null
        ? `该公司最近 24 小时新增 ${recent.length} 个岗位，历史 ${round2(historyDays)} 天内没有新增记录。`
        : `该公司最近 24 小时新增 ${recent.length} 个岗位，为历史日均（${round2(dailyAverage)} 个/天，${round2(historyDays)} 天）的 ${round2(ratio)} 倍。`,
      "high",
      "surge",
    )],
    skipped: [],
  };
}

/** 标题是算法/大模型岗，技能要求却落在机械/硬件等非软件领域。 */
function skillMismatches(jobs: SignalJobRow[]): SignalDraft[] {
  const drafts: SignalDraft[] = [];
  for (const job of jobs) {
    const titleTerms = matchedTerms(job.title, ALGORITHM_TITLE_TERMS);
    if (titleTerms.length === 0) continue;
    const skillTerms = matchedTerms((job.skills ?? []).join(" "), CROSS_DOMAIN_TERMS);
    if (skillTerms.length === 0) continue;
    drafts.push(draft(
      "skill_mismatch",
      job,
      {
        matched_title_terms: titleTerms,
        matched_skill_terms: skillTerms,
      },
      `岗位标题「${job.title}」属于算法/AI 类，但技能要求出现 ${skillTerms.join("、")}，疑似跨界错配。`,
      "high",
    ));
  }
  return drafts;
}

/** 同 company+rule+family 只保留最新一条；confidence 高者优先，其后按 first_seen_at 倒序。 */
function dedupeAndRank(drafts: SignalDraft[]): CareerSignalV1[] {
  const ordered = [...drafts].sort((left, right) => {
    const leftTime = Date.parse(left.signal.first_seen_at);
    const rightTime = Date.parse(right.signal.first_seen_at);
    return rightTime - leftTime
      || left.signal.company.localeCompare(right.signal.company)
      || left.signal.rule.localeCompare(right.signal.rule);
  });

  const seen = new Set<string>();
  const kept: CareerSignalV1[] = [];
  for (const item of ordered) {
    const key = `${item.signal.company}\u0000${item.signal.rule}\u0000${item.family}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(item.signal);
  }

  return kept.sort((left, right) => {
    if (left.confidence !== right.confidence) return left.confidence === "high" ? -1 : 1;
    return Date.parse(right.first_seen_at) - Date.parse(left.first_seen_at)
      || left.company.localeCompare(right.company)
      || left.rule.localeCompare(right.rule);
  });
}

export async function loadCareerSignals(db: Db, options: CareerSignalsOptions): Promise<CareerSignalsResponseV1> {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > MAX_SIGNAL_LIMIT) {
    throw new InvalidParameterError(`Query parameter must be between 1 and ${MAX_SIGNAL_LIMIT}: limit.`, {
      parameter: "limit",
    });
  }
  if (!Number.isSafeInteger(options.window_days) || options.window_days < 1 || options.window_days > MAX_SIGNAL_WINDOW_DAYS) {
    throw new InvalidParameterError(
      `Query parameter must be between 1 and ${MAX_SIGNAL_WINDOW_DAYS}: window_days.`,
      { parameter: "window_days" },
    );
  }

  const rows = await db<SignalJobRow[]>`
    SELECT id, company_name, title, role_family, skills, source_key, official_url, first_seen_at, data_origin
    FROM career_jobs
    ORDER BY first_seen_at DESC, id ASC`;

  const now = Date.now();
  const windowDays = options.window_days;
  const windowStart = now - windowDays * DAY_MS;

  const drafts: SignalDraft[] = [];
  const skipped: CareerSignalSkippedV1[] = [];
  for (const [company, jobs] of byCompany(rows)) {
    drafts.push(...crossIndustry(company, jobs));
    drafts.push(...newFamilies(jobs, windowStart, windowDays));
    const surge = surges(company, jobs, now);
    drafts.push(...surge.drafts);
    skipped.push(...surge.skipped);
  }
  drafts.push(...skillMismatches(rows));

  const signals = dedupeAndRank(drafts).slice(0, options.limit);
  const origins = { live: 0, verified_import: 0, synthetic_fixture: 0 };
  for (const row of rows) {
    origins[row.data_origin] += 1;
  }

  return {
    contract_version: "0.1",
    data_origin: resolveDataOrigin(origins),
    window_days: windowDays,
    signals,
    skipped: skipped.sort((left, right) => left.company.localeCompare(right.company)),
    generated_at: new Date(now).toISOString(),
  };
}