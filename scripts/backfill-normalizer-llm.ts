// 一次性回填：对 career_jobs 中职族/学生友好度未知或技能为空的行，调用模型做归一化兜底。
// node scripts/backfill-normalizer-llm.ts                  默认 dry-run，会真实调用模型但不写库
// node scripts/backfill-normalizer-llm.ts --apply          逐行独立事务写入，失败行不影响其它行
// node scripts/backfill-normalizer-llm.ts --limit 5        限制本次处理的行数
// 只更新 role_family / student_friendly / skills / experience_min_years / experience_max_years /
// normalizer_version / updated_at；不写 career_job_observations，不动 last_seen_at / content_hash /
// created_at / raw_payload 等来源侧字段。日志只输出 job id 与 title，不输出 JD 正文或密钥。
//
// 数据安全：模型输出只做增量。skills 与既有值取并集，经验年限仅在模型给出非 null 时覆盖，
// role_family / student_friendly 仅在既有为 unknown 时才接受模型的 unknown。模型是低置信兜底，
// 用它抹掉已确认的结构化字段是净损失，因此宁可少改也不回退既有数据。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import postgres, { type JSONValue } from "postgres";
import { z } from "zod";
import type {
  RoleFamily,
  StudentFriendly,
} from "../modules/career-insights/contracts/index.ts";
import { SKILL_ALIASES, SKILL_LABELS } from "../modules/career-insights/data/dictionaries.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

export const LLM_NORMALIZER_VERSION = "normalizer/llm-0.1";
export const LLM_PURPOSE = "career-normalize";
export const LLM_PROMPT_VERSION = "career-normalize/1";
export const LLM_MODEL = "default";
export const LLM_MAX_TOKENS = 512;
export const LLM_TIMEOUT_MS = 60_000;
export const MAX_LLM_SKILLS = 8;
export const DESCRIPTION_LIMIT = 1500;
export const DEFAULT_CONCURRENCY = 3;

export const ROLE_FAMILY_VALUES = [
  "ai_algorithm",
  "ai_application_development",
  "data",
  "ai_product_operations",
  "unknown",
] as const;
export const STUDENT_FRIENDLY_VALUES = ["yes", "no", "unknown"] as const;

/** 模型输出必须整行通过校验；枚举越界、多出字段、min > max 都判该行失败，不猜。 */
export const llmNormalizationSchema = z
  .object({
    role_family: z.enum(ROLE_FAMILY_VALUES),
    student_friendly: z.enum(STUDENT_FRIENDLY_VALUES),
    skills: z.array(z.string()).max(MAX_LLM_SKILLS),
    experience_min_years: z.number().int().min(0).max(50).nullable(),
    experience_max_years: z.number().int().min(0).max(50).nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.experience_min_years !== null &&
      value.experience_max_years !== null &&
      value.experience_min_years > value.experience_max_years
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["experience_min_years"],
        message: "experience_min_years must not exceed experience_max_years",
      });
    }
  });

export type LlmNormalization = z.infer<typeof llmNormalizationSchema>;

/** 允许写入 career_jobs 的列（除 normalizer_version / updated_at 外的业务字段）。 */
export interface LlmNormalizedFields {
  role_family: RoleFamily;
  student_friendly: StudentFriendly;
  skills: string[];
  experience_min_years: number | null;
  experience_max_years: number | null;
}

export interface CareerJobRow {
  id: string;
  title: string;
  raw_text: string;
  degree_raw: string | null;
  experience_raw: string | null;
  skills: string[] | null;
  experience_min_years: number | null;
  experience_max_years: number | null;
  role_family: string;
  student_friendly: string;
  normalizer_version: string;
}

export interface LlmRequest {
  subject: string;
  system: string;
  user: string;
}

export interface LlmResponse {
  data: unknown;
  usage?: Record<string, unknown> | null;
}

export type LlmCaller = (request: LlmRequest) => Promise<LlmResponse>;

export interface CandidateStore {
  listCandidates(limit: number | null): Promise<CareerJobRow[]>;
  /** 单行独立事务；返回实际更新行数（0 表示该行已被别的进程改过）。 */
  updateLlmFields(id: string, fields: LlmNormalizedFields): Promise<number>;
}

export interface RunSummary {
  candidates: number;
  called: number;
  changed: number;
  unchanged: number;
  /** 最终失败（含 schema 非法），这些行不会被写入。 */
  failed: number;
  /** 最终失败中因 schema/枚举不合法的行数。 */
  schemaRejected: number;
  calls: number;
  retries: number;
  droppedSkillTerms: number;
  usage: { prompt_tokens: number; completion_tokens: number };
  /** 未返回 usage 的调用次数：这些调用的 token 未计入上面的 usage。 */
  usageMissingCalls: number;
}

export interface RunOptions {
  apply: boolean;
  limit: number | null;
  callLlm: LlmCaller;
  store: CandidateStore;
  concurrency?: number;
  log?: (line: string) => void;
}

interface RowOutcome {
  row: CareerJobRow;
  status: "ok" | "failed";
  fields?: LlmNormalizedFields;
  unchanged?: boolean;
  droppedSkillTerms?: number;
  usage?: { prompt_tokens: number; completion_tokens: number };
  failure?: string;
  schemaRejected?: boolean;
  usageMissingCalls?: number;
  calls: number;
  retries: number;
}

/** 与 SQL 选行条件保持一致，供内存实现与测试复用。 */
export function needsLlmNormalization(row: Pick<CareerJobRow, "role_family" | "student_friendly" | "skills">): boolean {
  return (
    row.role_family === "unknown" ||
    row.student_friendly === "unknown" ||
    row.skills === null ||
    row.skills.length === 0
  );
}

function skillVocabulary(): string {
  return Object.entries(SKILL_LABELS)
    .map(([id, label]) => `${id}（${label}）`)
    .join("、");
}

export const SYSTEM_PROMPT = [
  "你是招聘岗位信息归一化分类器。只依据给定文本做分类，不得编造文本中没有出现的信息；",
  "无法判断时输出 \"unknown\" 或 null，不要猜测。",
  "",
  "role_family 只能取以下 5 类之一：",
  "- ai_algorithm：算法/机器学习/深度学习/NLP/计算机视觉/推荐搜索算法",
  "- ai_application_development：前后端/服务端/客户端/全栈/测试开发/AI 应用工程",
  "- data：数据分析/数据开发/数据仓库/大数据/BI/数据科学",
  "- ai_product_operations：AI 产品/产品经理/产品运营/增长运营",
  "- unknown：文本不足以判断",
  "",
  "student_friendly 只能取 yes|no|unknown：",
  "- yes：校招/实习，或明确接受应届/在校生/经验不限，或明确 0-1 年经验",
  "- no：明确不接受应届，或明确要求 2 年以上，或资深/专家且无学生入口",
  "- unknown：其他；未写经验的初级岗位不能判为 yes",
  "",
  `skills 只能从下列技能 ID 中选择，最多 ${MAX_LLM_SKILLS} 个，只选文本明确出现或明确要求的技能：`,
  skillVocabulary(),
  "",
  "experience_min_years / experience_max_years：只填文本中明确写出的年限整数，未写则为 null；",
  "不得把“未写”当成 0 年，也不得把“经验不限”当成 0 年。",
  "",
  "只输出一个 JSON 对象，不要输出解释：",
  `{"role_family":"...","student_friendly":"...","skills":["..."],"experience_min_years":null,"experience_max_years":null}`,
].join("\n");

/** 输入只含 title、raw_text 前 1500 字、学历/经验原文与现有技能，不含 company/url 等无关字段。 */
export function buildUserPrompt(row: CareerJobRow): string {
  return JSON.stringify({
    title: row.title,
    description: row.raw_text.slice(0, DESCRIPTION_LIMIT),
    degree_raw: row.degree_raw,
    experience_raw: row.experience_raw,
    existing_skills: row.skills ?? [],
  });
}


/** 模型给的技能词按既有词表映射；映射不上的丢弃并返回，供汇总计数。 */
export function mapSkillsToKnown(terms: readonly string[]): { skills: string[]; dropped: string[] } {
  const knownIds = new Set(Object.keys(SKILL_LABELS));
  const skills: string[] = [];
  const dropped: string[] = [];
  for (const term of terms) {
    const key = term.trim().toLowerCase();
    if (key === "") {
      dropped.push(term);
      continue;
    }
    const id = knownIds.has(key) ? key : SKILL_ALIASES[key];
    if (id === undefined) {
      dropped.push(term);
      continue;
    }
    if (!skills.includes(id)) skills.push(id);
  }
  return { skills, dropped };
}

/** 既有技能只增不减：并集后按字典序稳定排序，保证同一输入两次运行结果一致。 */
export function mergeSkills(existing: readonly string[] | null, fromModel: readonly string[]): string[] {
  const merged = new Set<string>(existing ?? []);
  for (const id of fromModel) merged.add(id);
  return [...merged].sort();
}

/** 模型判不出（unknown）时不覆盖既有的已分类枚举值。 */
function preferKnownValue<T extends string>(existing: string, fromModel: T, values: readonly T[]): T {
  if (fromModel === "unknown" && existing !== "unknown") {
    const known = values.find((value) => value === existing);
    if (known !== undefined) return known;
  }
  return fromModel;
}

/**
 * 把模型输出并入既有行：skills 取并集，年限仅在模型给出非 null 时覆盖，
 * 枚举仅在既有为 unknown 时接受模型的 unknown。
 */
export function mergeNormalizedFields(
  row: CareerJobRow,
  parsed: LlmNormalization,
): { fields: LlmNormalizedFields; droppedSkillTerms: number } {
  const mapped = mapSkillsToKnown(parsed.skills);
  const min = parsed.experience_min_years ?? row.experience_min_years;
  const max = parsed.experience_max_years ?? row.experience_max_years;
  // 单边覆盖可能把既有的一对年限拼成 min > max；这种组合宁可保持既有整对。
  const inverted = min !== null && max !== null && min > max;
  const fields: LlmNormalizedFields = {
    role_family: preferKnownValue(row.role_family, parsed.role_family, ROLE_FAMILY_VALUES),
    student_friendly: preferKnownValue(row.student_friendly, parsed.student_friendly, STUDENT_FRIENDLY_VALUES),
    skills: mergeSkills(row.skills, mapped.skills),
    experience_min_years: inverted ? row.experience_min_years : min,
    experience_max_years: inverted ? row.experience_max_years : max,
  };
  return { fields, droppedSkillTerms: mapped.dropped.length };
}

function usageOf(usage: Record<string, unknown> | null | undefined): { prompt_tokens: number; completion_tokens: number } {
  const number = (key: string): number => {
    const value = usage?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  return { prompt_tokens: number("prompt_tokens"), completion_tokens: number("completion_tokens") };
}

/** 只暴露错误类别与 schema 字段路径，不把模型原文或 JD 写进日志。 */
export function describeFailure(error: unknown): string {
  if (error instanceof z.ZodError) {
    const issues = error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "(root)"}:${issue.code}`)
      .join(", ");
    return `schema 非法: ${issues}`;
  }
  if (error instanceof Error) {
    const name = error.name !== "Error" ? error.name : error.constructor.name;
    return `调用失败: ${name}`;
  }
  return "调用失败: unknown";
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!);
    }
  });
  await Promise.all(runners);
  return results;
}

/** 版本也要比较：内容相同但版本不同仍必须写库，否则下一轮还会被选为候选并重复付费。 */
function alreadyNormalized(row: CareerJobRow, fields: LlmNormalizedFields): boolean {
  const listKey = (values: readonly string[]): string => [...new Set(values)].sort().join("\u0000");
  return (
    row.normalizer_version === LLM_NORMALIZER_VERSION &&
    row.role_family === fields.role_family &&
    row.student_friendly === fields.student_friendly &&
    listKey(row.skills ?? []) === listKey(fields.skills) &&
    row.experience_min_years === fields.experience_min_years &&
    row.experience_max_years === fields.experience_max_years
  );
}

async function processRow(row: CareerJobRow, callLlm: LlmCaller, log: (line: string) => void): Promise<RowOutcome> {
  const system = SYSTEM_PROMPT;
  const user = buildUserPrompt(row);
  let calls = 0;
  let retries = 0;
  let lastFailure = "";
  let schemaRejected = false;
  let usageMissingCalls = 0;
  for (let attempt = 0; attempt <= 1; attempt += 1) {
    calls += 1;
    if (attempt > 0) retries += 1;
    let response: LlmResponse;
    try {
      response = await callLlm({ subject: row.id, system, user });
    } catch (error) {
      lastFailure = describeFailure(error);
      usageMissingCalls += 1;
      continue;
    }
    const parsed = llmNormalizationSchema.safeParse(response.data);
    if (!parsed.success) {
      schemaRejected = true;
      lastFailure = describeFailure(parsed.error);
      usageMissingCalls += 1;
      continue;
    }
    const merged = mergeNormalizedFields(row, parsed.data);
    const fields = merged.fields;
    log(
      `  ${row.id} | ${row.title} | role: ${row.role_family}→${fields.role_family} | ` +
        `student: ${row.student_friendly}→${fields.student_friendly} | skills: ${(row.skills ?? []).length}→${fields.skills.length} | ` +
        `exp: ${formatRange(row.experience_min_years, row.experience_max_years)}→${formatRange(fields.experience_min_years, fields.experience_max_years)}`,
    );
    return {
      row,
      status: "ok",
      fields,
      unchanged: alreadyNormalized(row, fields),
      droppedSkillTerms: merged.droppedSkillTerms,
      usage: usageOf(response.usage),
      schemaRejected: false,
      usageMissingCalls,
      calls,
      retries,
    };
  }
  log(`  ${row.id} | ${row.title} | ${lastFailure}`);
  return {
    row,
    status: "failed",
    failure: lastFailure,
    schemaRejected,
    usageMissingCalls,
    calls,
    retries,
    droppedSkillTerms: 0,
  };
}

function formatRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "null";
  return `${min === null ? "?" : min}-${max === null ? "?" : max}`;
}

/** 核心流程与 IO 解耦：模型与存储都由调用方注入，便于测试用 fake 覆盖。 */
export async function runBackfill(options: RunOptions): Promise<RunSummary> {
  const log = options.log ?? (() => {});
  const rows = await options.store.listCandidates(options.limit);
  log(`候选行: ${rows.length}`);
  log(`将调用模型行数: ${rows.length}`);

  const estimatedInput = rows.reduce((sum, row) => sum + Math.ceil((SYSTEM_PROMPT.length + buildUserPrompt(row).length) / 1.5), 0);
  log(`预计 token 上限: 输入 ≈${estimatedInput}，输出 ≤${rows.length * LLM_MAX_TOKENS}`);

  const outcomes = await mapWithConcurrency(rows, options.concurrency ?? DEFAULT_CONCURRENCY, (row): Promise<RowOutcome> =>
    processRow(row, options.callLlm, log).catch((error: unknown) => ({
      row,
      status: "failed" as const,
      failure: describeFailure(error),
      schemaRejected: false,
      usageMissingCalls: 0,
      calls: 0,
      retries: 0,
      droppedSkillTerms: 0,
    })),
  );

  const summary: RunSummary = {
    candidates: rows.length,
    called: rows.length,
    changed: 0,
    unchanged: 0,
    failed: 0,
    schemaRejected: 0,
    calls: 0,
    retries: 0,
    droppedSkillTerms: 0,
    usage: { prompt_tokens: 0, completion_tokens: 0 },
    usageMissingCalls: 0,
  };

  for (const outcome of outcomes) {
    summary.calls += outcome.calls;
    summary.retries += outcome.retries;
    summary.usageMissingCalls += outcome.usageMissingCalls ?? 0;
    summary.droppedSkillTerms += outcome.droppedSkillTerms ?? 0;
    summary.usage.prompt_tokens += outcome.usage?.prompt_tokens ?? 0;
    summary.usage.completion_tokens += outcome.usage?.completion_tokens ?? 0;
    if (outcome.status === "failed") {
      summary.failed += 1;
      if (outcome.schemaRejected === true) summary.schemaRejected += 1;
      continue;
    }
    if (outcome.unchanged === true) {
      summary.unchanged += 1;
      continue;
    }
    if (!options.apply) {
      summary.changed += 1;
      continue;
    }
    try {
      const updated = await options.store.updateLlmFields(outcome.row.id, outcome.fields!);
      if (updated > 0) summary.changed += 1;
      else summary.unchanged += 1;
    } catch (error) {
      summary.failed += 1;
      log(`  ${outcome.row.id} | ${outcome.row.title} | 写库失败: ${describeFailure(error)}`);
    }
  }
  return summary;
}

export function printSummary(summary: RunSummary, apply: boolean, log: (line: string) => void): void {
  log("");
  log(`汇总（${apply ? "apply" : "dry-run"}）:`);
  log(`  候选/调用行: ${summary.candidates}，模型调用: ${summary.calls} 次（重试 ${summary.retries} 次）`);
  log(`  ${apply ? "已更新" : "拟变更"}行: ${summary.changed}`);
  log(`  无变化行:   ${summary.unchanged}`);
  log(`  失败行:     ${summary.failed}（其中 schema 非法 ${summary.schemaRejected}）`);
  log(`  usage: prompt_tokens=${summary.usage.prompt_tokens}, completion_tokens=${summary.usage.completion_tokens}`);
  if (summary.usageMissingCalls > 0) {
    log(`  另有 ${summary.usageMissingCalls} 次失败调用未返回 usage（token 未计入上面的数字）`);
  }
  log(`  技能词表映射丢弃: ${summary.droppedSkillTerms} 个词`);
}

function loadDotEnvIfPresent(): void {
  const file = path.join(REPO_ROOT, ".env");
  if (!existsSync(file)) return;
  const parsed = parseEnv(readFileSync(file, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(DATABASE_URL 无法解析)";
  }
}

function printHelp(): void {
  console.log("用法: node scripts/backfill-normalizer-llm.ts [--apply] [--limit N]");
  console.log("  默认 dry-run：真实调用模型，打印候选行与逐行拟变更，但不写库。");
  console.log("  --apply：逐行独立事务写入 role_family / student_friendly / skills / 经验年限 / normalizer_version。");
  console.log("  --limit N：只处理前 N 行。");
  console.log("  需要 MODEL_CALLS_ENABLED=true，否则直接退出。");
}

class PostgresCareerJobStore implements CandidateStore {
  private readonly client: ReturnType<typeof postgres>;

  constructor(client: ReturnType<typeof postgres>) {
    this.client = client;
  }

  async listCandidates(limit: number | null): Promise<CareerJobRow[]> {
    const rows = limit === null
      ? await this.client<CareerJobRow[]>`
          SELECT id::text AS id, title, raw_text, degree_raw, experience_raw, skills,
                 experience_min_years, experience_max_years,
                 role_family, student_friendly, normalizer_version
          FROM career_jobs
          WHERE normalizer_version IS DISTINCT FROM ${LLM_NORMALIZER_VERSION}
            AND (role_family = 'unknown' OR student_friendly = 'unknown'
                 OR skills IS NULL OR skills = '[]'::jsonb)
          ORDER BY id`
      : await this.client<CareerJobRow[]>`
          SELECT id::text AS id, title, raw_text, degree_raw, experience_raw, skills,
                 experience_min_years, experience_max_years,
                 role_family, student_friendly, normalizer_version
          FROM career_jobs
          WHERE normalizer_version IS DISTINCT FROM ${LLM_NORMALIZER_VERSION}
            AND (role_family = 'unknown' OR student_friendly = 'unknown'
                 OR skills IS NULL OR skills = '[]'::jsonb)
          ORDER BY id
          LIMIT ${limit}`;
    return rows;
  }

  async updateLlmFields(id: string, fields: LlmNormalizedFields): Promise<number> {
    return this.client.begin(async (tx) => {
      const result = await tx`
        UPDATE career_jobs SET
          role_family = ${fields.role_family},
          student_friendly = ${fields.student_friendly},
          skills = ${tx.json(fields.skills as JSONValue)}::jsonb,
          experience_min_years = ${fields.experience_min_years},
          experience_max_years = ${fields.experience_max_years},
          normalizer_version = ${LLM_NORMALIZER_VERSION},
          updated_at = now()
        WHERE id = ${id}
          AND normalizer_version IS DISTINCT FROM ${LLM_NORMALIZER_VERSION}`;
      return result.count;
    });
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }
  const apply = process.argv.includes("--apply");
  const limitIndex = process.argv.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number.parseInt(process.argv[limitIndex + 1] ?? "", 10) : null;
  if (limitIndex >= 0 && (limit === null || !Number.isFinite(limit) || limit < 1)) {
    throw new Error("--limit 需要一个正整数");
  }

  loadDotEnvIfPresent();
  const { config } = await import("../packages/backend/src/config.ts");
  if (!config.modelCallsEnabled) {
    console.error("MODEL_CALLS_ENABLED 为 false。本脚本会真实调用模型；请设置 MODEL_CALLS_ENABLED=true 后再运行。");
    process.exitCode = 1;
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || config.databaseUrl;
  const sql = postgres(databaseUrl, { max: 2, connect_timeout: 10, onnotice: () => {} });
  console.log(`=== LLM normalizer backfill（${apply ? "apply" : "dry-run"}） ===`);
  console.log(`目标版本: ${LLM_NORMALIZER_VERSION}`);
  console.log(`数据库:   ${describeDatabase(databaseUrl)}`);

  try {
    const { chatJson } = await import("../packages/backend/src/providers/llm.ts");
    const callLlm: LlmCaller = async ({ subject, system, user }) => {
      const result = await chatJson({
        model: LLM_MODEL,
        purpose: LLM_PURPOSE,
        subject,
        promptVersion: LLM_PROMPT_VERSION,
        system,
        user,
        schema: llmNormalizationSchema,
        temperature: 0,
        maxTokens: LLM_MAX_TOKENS,
        timeoutMs: LLM_TIMEOUT_MS,
      });
      return { data: result.data, usage: result.usage };
    };

    const store = new PostgresCareerJobStore(sql);
    const summary = await runBackfill({
      apply,
      limit,
      callLlm,
      store,
      log: (line) => console.log(line),
    });
    printSummary(summary, apply, (line) => console.log(line));
    if (!apply) console.log("\n未传 --apply，未写库。");
    if (summary.failed > 0) process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
    const { closeDb } = await import("../packages/backend/src/db.ts");
    await closeDb();
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}