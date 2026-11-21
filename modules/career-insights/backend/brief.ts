// 离线研判：脚本读聚合指标 → 调模型 → 按 (as_of, prompt_version) upsert 到 career_briefs；
// 读者只经 loadCareerBrief 读缓存，不触碰模型。模型输入只有聚合数字、时间窗、样本量和可引用 id，
// 输出里的任何数字都必须已在输入中出现。
import type { Db } from "@aihot/backend/db";
import { BEIJING_TIMEZONE } from "@aihot/contracts/time";
import type { CareerBriefV1 } from "../contracts/insights.ts";
import type { RoleFamily } from "../contracts/job.ts";
import { loadCareerCatalog, type CareerCatalogOptions } from "./career-catalog.ts";

export const CAREER_BRIEF_PROMPT_VERSION = "career-brief/1";
export const CAREER_BRIEF_PURPOSE = "career-brief";
export const CAREER_BRIEF_CONTRACT_VERSION = "0.1" as const;

const MAX_FACT_CHARS = 60;
const JOB_EVIDENCE_LIMIT = 10;
const POLICY_EVIDENCE_LIMIT = 5;
const MIN_OBSERVATION_DAYS = 2;
const MAX_TOKENS_HINT = "不超过 60 个字";

const EARLY_LIMITATION = "观测日不足两个，只反映当前已观测到的岗位，不构成走势判断。";
const EARLY_INFERENCE = "当前观测日不足两个，只陈述现状，暂不判断走势。";
const WINDOW_WORDS = ["观察窗", "观测窗", "观测日", "置信度"] as const;
const TREND_TERMS = [
  "增长", "下降", "走势", "上升", "下滑", "上涨", "下跌", "回落", "攀升", "走低", "走高",
  "减少", "增加", "提升", "降低", "扩大", "收窄", "trend", "growth", "decline", "increase",
  "decrease", "rise", "fall",
] as const;
const CONFIDENCE_VALUES = ["low", "medium", "high"] as const;
const NUMBER_TOKEN = /(\d[\d,]*(?:\.\d+)?)(%?)/g;
const DATE_TOKEN = /\d{1,4}/g;
const CONTEXT_CHARS = 80;
const CONTEXT_PADDING = 24;
const RELATIVE_TOLERANCE = 1e-6;
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

const SYSTEM_PROMPT = [
  "你是学生就业数据研判助手。输入是一份 JSON 聚合统计：岗位方向、职位、技能、观察窗、样本量、观测日数，以及可引用的岗位与政策 id。",
  "只输出一个 JSON 对象，字段为 facts、inferences、actions、limitations、confidence、evidence，不要输出 JSON 之外的文字。",
  "facts：只陈述输入中已有的事实，每条尽量简短；inferences：趋势推断，必须写明观察窗或置信度措辞；actions：给学生可执行的准备建议；limitations：数据与方法的限制。",
  `只能使用输入中已经出现的数字，禁止编造或自行推算新数字（facts 每条${MAX_TOKENS_HINT}）。`,
  "evidence：只能引用输入 evidence_candidates 中已有的 id，kind 取 job 或 policy，title 原样返回；没有可引用项时给空数组。",
  "confidence：low、medium、high 之一。观测日不足两个时不要写增长、下降、走势一类判断。",
].join("\n");

export type CareerBriefEvidenceV1 = CareerBriefV1["evidence"][number];

export type CareerBriefEvidenceCandidateV1 = CareerBriefEvidenceV1 & { role_family?: RoleFamily };

/** 模型可见的全部输入：没有公司名、URL 或原文，只有聚合结果与可引用 id。 */
export interface CareerBriefInputV1 {
  as_of: string;
  window_days: number;
  sample_size: number;
  observation_days: number;
  directions: CareerCatalogResponseDirectionsV1;
  titles: CareerCatalogResponseTitlesV1;
  skills: CareerCatalogResponseSkillsV1;
  evidence_candidates: CareerBriefEvidenceCandidateV1[];
}

type CareerCatalogResponseDirectionsV1 = Awaited<ReturnType<typeof loadCareerCatalog>>["directions"];
type CareerCatalogResponseTitlesV1 = Awaited<ReturnType<typeof loadCareerCatalog>>["titles"];
type CareerCatalogResponseSkillsV1 = Awaited<ReturnType<typeof loadCareerCatalog>>["skills"];

export interface CareerBriefDraftV1 {
  facts: string[];
  inferences: string[];
  actions: string[];
  limitations: string[];
  confidence: string;
  evidence: CareerBriefEvidenceV1[];
}

export interface CareerBriefRecordV1 extends CareerBriefV1 {
  observation_days: number;
  prompt_version: string;
  receipt_id: number | null;
  model: string | null;
}

export class CareerBriefValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CareerBriefValidationError";
  }
}

export interface CareerBriefInputOptions {
  limit: number;
  window_days: number;
}

interface ObservationDaysRow {
  days: number;
}

interface JobEvidenceRow {
  id: string;
  title: string;
  role_family: RoleFamily;
}

interface PolicyEvidenceRow {
  id: string;
  title: string;
}

export async function buildCareerBriefInput(db: Db, options: CareerBriefInputOptions): Promise<CareerBriefInputV1> {
  const catalogOptions: CareerCatalogOptions = { limit: options.limit, window_days: options.window_days };
  const [catalog, observationDays, jobEvidence, policyEvidence] = await Promise.all([
    loadCareerCatalog(db, catalogOptions),
    db<ObservationDaysRow[]>`
      SELECT COUNT(DISTINCT (observed_at AT TIME ZONE ${BEIJING_TIMEZONE})::date)::int AS days
      FROM career_job_observations`,
    db<JobEvidenceRow[]>`
      SELECT id::text AS id, title, role_family
      FROM career_jobs
      ORDER BY last_seen_at DESC, id ASC
      LIMIT ${JOB_EVIDENCE_LIMIT}`,
    db<PolicyEvidenceRow[]>`
      SELECT id::text AS id, title
      FROM career_policies
      ORDER BY last_seen_at DESC, id ASC
      LIMIT ${POLICY_EVIDENCE_LIMIT}`,
  ]);

  return {
    as_of: catalog.as_of,
    window_days: catalog.window_days,
    sample_size: catalog.sample_size,
    observation_days: observationDays[0]?.days ?? 0,
    directions: catalog.directions,
    titles: catalog.titles,
    skills: catalog.skills,
    evidence_candidates: [
      ...jobEvidence.map((row) => ({ kind: "job" as const, id: row.id, title: row.title, role_family: row.role_family })),
      ...policyEvidence.map((row) => ({ kind: "policy" as const, id: row.id, title: row.title })),
    ],
  };
}

export function buildCareerBriefPrompt(input: CareerBriefInputV1): { system: string; user: string } {
  return { system: SYSTEM_PROMPT, user: JSON.stringify(input) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textItems(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new CareerBriefValidationError(`Model output field ${field} must be an array of strings.`);
  return value.map((item) => {
    if (typeof item !== "string" || item.trim() === "") {
      throw new CareerBriefValidationError(`Model output field ${field} must contain non-empty strings.`);
    }
    return item.trim();
  });
}

function clampFact(text: string): string {
  const characters = [...text];
  return characters.length <= MAX_FACT_CHARS ? text : characters.slice(0, MAX_FACT_CHARS).join("");
}

interface NumberToken {
  raw: string;
  value: number;
  percent: boolean;
  digits: number;
  index: number;
}

/** 聚合输入里的数字可能嵌在对象与数组内（如 skills[].share），全部收集为可引用值。 */
function collectNumbers(value: unknown, out: number[]): void {
  if (typeof value === "number") {
    if (Number.isFinite(value)) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, out);
    return;
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) collectNumbers(item, out);
  }
}

/**
 * 输入里所有字符串值中的连续数字片段（证据标题的职位号如 J107214、方向/技能 id、UUID 等）。
 * 这些字符串本身就是模型输入的一部分，模型引用其中的数字是 grounded 的，不能判成编造。
 * 但只在 token 与片段精确相等时放行，输入里没有的数字（如 999）仍然会被拒绝。
 */
function collectStringNumberFragments(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    for (const fragment of value.match(/\d+/gu) ?? []) out.add(fragment);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringNumberFragments(item, out);
    return;
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) collectStringNumberFragments(item, out);
  }
}

/** token 的纯数字文本（去掉千分位逗号与百分号），用于与输入字符串里的数字片段精确匹配。 */
function tokenDigitText(token: NumberToken): string {
  return token.raw.replaceAll(",", "").replace(/%$/u, "");
}

function decimalDigits(raw: string): number {
  const dot = raw.indexOf(".");
  return dot < 0 ? 0 : raw.length - dot - 1;
}

function numberTokens(text: string): NumberToken[] {
  const tokens: NumberToken[] = [];
  for (const match of text.matchAll(NUMBER_TOKEN)) {
    const digitsPart = match[1]!.replaceAll(",", "");
    const value = Number(digitsPart);
    if (!Number.isFinite(value)) continue;
    tokens.push({
      raw: match[0],
      value,
      percent: match[2] === "%",
      digits: decimalDigits(digitsPart),
      index: match.index ?? 0,
    });
  }
  return tokens;
}

function nearEquals(value: number, target: number): boolean {
  return Math.abs(value - target) <= Math.max(RELATIVE_TOLERANCE, Math.abs(target) * RELATIVE_TOLERANCE);
}

function equalAt(value: number, target: number, digits: number): boolean {
  const factor = 10 ** digits;
  return Math.round(value * factor) === Math.round(target * factor);
}

/** 日期文本（as_of、日报的数据日期）里的年、月、日片段可以原样引用，不算编造。 */
function dateTokens(dateTexts: readonly string[]): Set<number> {
  const tokens = new Set<number>();
  for (const text of dateTexts) {
    for (const match of text.matchAll(DATE_TOKEN)) tokens.add(Number(match[0]));
  }
  return tokens;
}

function isDateToken(token: NumberToken, dates: ReadonlySet<number>): boolean {
  if (!Number.isInteger(token.value)) return false;
  return dates.has(token.value) || (token.value >= YEAR_MIN && token.value <= YEAR_MAX);
}

/**
 * 引用判定：token 与输入字符串里的数字片段精确相等、等于某个数值、日期片段，
 * 或按输出自身精度舍入后相等。
 * 0.426573… 可被引成 0.4266（4 位）、0.43、42.7%、42.66%；
 * 整数（0 位小数）只认精确相等，因此 43%（把 42.65% 粗舍）会被拒绝。
 */
function matchesKnownNumber(
  token: NumberToken,
  known: readonly number[],
  dates: ReadonlySet<number>,
  stringFragments: ReadonlySet<string>,
): boolean {
  if (stringFragments.has(tokenDigitText(token))) return true;
  if (isDateToken(token, dates)) return true;
  return known.some((value) => {
    if (!Number.isFinite(value)) return false;
    if (nearEquals(token.value, value)) return true;
    if (nearEquals(token.value / 100, value)) return true;
    if (token.digits === 0) return false;
    if (equalAt(token.percent ? value * 100 : value, token.value, token.digits)) return true;
    return token.percent ? false : equalAt(value * 100, token.value, token.digits);
  });
}

function numberContext(text: string, token: NumberToken): string {
  const start = Math.max(0, token.index - CONTEXT_PADDING);
  const end = Math.min(text.length, token.index + token.raw.length + CONTEXT_PADDING);
  const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  const characters = [...snippet];
  return characters.length <= CONTEXT_CHARS ? snippet : characters.slice(0, CONTEXT_CHARS).join("");
}

/**
 * 数字白名单校验（就业研判与日报 AI 评论共用）：values 里所有数值、以及所有字符串值里的连续数字片段
 * 都可以被引用；dateTexts 里的年/月/日片段同样放行。引用判定的精度规则见 matchesKnownNumber。
 */
export function assertKnownNumbers(values: unknown, dateTexts: readonly string[], texts: readonly string[]): void {
  const known: number[] = [];
  collectNumbers(values, known);
  const stringFragments = new Set<string>();
  collectStringNumberFragments(values, stringFragments);
  const dates = dateTokens(dateTexts);
  for (const text of texts) {
    for (const token of numberTokens(text)) {
      if (matchesKnownNumber(token, known, dates, stringFragments)) continue;
      throw new CareerBriefValidationError(
        `Model output contains a number absent from the aggregate input: ${token.raw} (context: ${numberContext(text, token)}).`,
      );
    }
  }
}

function assertOnlyKnownNumbers(input: CareerBriefInputV1, texts: readonly string[]): void {
  assertKnownNumbers(input, [input.as_of], texts);
}

function parseConfidence(value: unknown): CareerBriefV1["confidence"] {
  if (typeof value === "string" && (CONFIDENCE_VALUES as readonly string[]).includes(value)) {
    return value as CareerBriefV1["confidence"];
  }
  throw new CareerBriefValidationError(`Model output confidence must be one of ${CONFIDENCE_VALUES.join(", ")}.`);
}

function knownEvidence(input: CareerBriefInputV1, value: unknown): CareerBriefEvidenceV1[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new CareerBriefValidationError("Model output field evidence must be an array.");
  const candidates = new Map(input.evidence_candidates.map((candidate) => [`${candidate.kind}:${candidate.id}`, candidate]));
  const evidence: CareerBriefEvidenceV1[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    if (item.kind !== "job" && item.kind !== "policy") continue;
    const key = `${item.kind}:${item.id}`;
    const candidate = candidates.get(key);
    // 模型只能引用输入里的 id；title 以库内为准，不采信模型回写的标题。
    if (candidate === undefined || seen.has(key)) continue;
    seen.add(key);
    evidence.push({ kind: candidate.kind, id: candidate.id, title: candidate.title });
  }
  return evidence;
}

export interface ComposeCareerBriefOptions {
  generated_at: string;
  prompt_version?: string;
  receipt_id?: number | null;
  model?: string | null;
}

/**
 * 把模型草稿变成可缓存的记录：截断 facts、丢弃输入外的证据、校验数字来源，
 * 观测日不足两个时强制 low 置信度并移除走势断言。
 */
export function composeCareerBrief(
  input: CareerBriefInputV1,
  rawDraft: unknown,
  options: ComposeCareerBriefOptions,
): CareerBriefRecordV1 {
  if (!isRecord(rawDraft)) throw new CareerBriefValidationError("Model output must be a JSON object.");
  const rawFacts = textItems(rawDraft.facts, "facts");
  let inferences = textItems(rawDraft.inferences, "inferences");
  let limitations = textItems(rawDraft.limitations, "limitations");
  const actions = textItems(rawDraft.actions, "actions");
  const evidence = knownEvidence(input, rawDraft.evidence);
  assertOnlyKnownNumbers(input, [...rawFacts, ...inferences, ...actions, ...limitations]);
  const facts = rawFacts.map(clampFact);

  const earlyObservation = input.observation_days < MIN_OBSERVATION_DAYS;
  const confidence = earlyObservation ? "low" : parseConfidence(rawDraft.confidence);
  if (earlyObservation) {
    inferences = inferences.filter((item) => !TREND_TERMS.some((term) => item.toLowerCase().includes(term)));
    if (inferences.length === 0) inferences = [EARLY_INFERENCE];
    if (!limitations.includes(EARLY_LIMITATION)) limitations = [...limitations, EARLY_LIMITATION];
  }
  if (!inferences.some((item) => WINDOW_WORDS.some((word) => item.includes(word)))) {
    inferences.push(`以上基于 ${input.window_days} 天观察窗，置信度 ${confidence}。`);
  }

  return {
    contract_version: CAREER_BRIEF_CONTRACT_VERSION,
    generated_at: options.generated_at,
    as_of: input.as_of,
    sample_size: input.sample_size,
    window_days: input.window_days,
    facts,
    inferences,
    actions,
    evidence,
    limitations,
    confidence,
    observation_days: input.observation_days,
    prompt_version: options.prompt_version ?? CAREER_BRIEF_PROMPT_VERSION,
    receipt_id: options.receipt_id ?? null,
    model: options.model ?? null,
  };
}

interface CareerBriefRow {
  as_of: Date;
  generated_at: Date;
  sample_size: number;
  window_days: number;
  confidence: string;
  facts: string[];
  inferences: string[];
  actions: string[];
  evidence: CareerBriefEvidenceV1[];
  limitations: string[];
}

export async function loadCareerBrief(db: Db): Promise<CareerBriefV1 | null> {
  const rows = await db<CareerBriefRow[]>`
    SELECT as_of, generated_at, sample_size, window_days, confidence, facts, inferences, actions, evidence, limitations
    FROM career_briefs
    ORDER BY generated_at DESC, as_of DESC, prompt_version DESC
    LIMIT 1`;
  const row = rows[0];
  if (row === undefined) return null;
  return {
    contract_version: CAREER_BRIEF_CONTRACT_VERSION,
    generated_at: new Date(row.generated_at).toISOString(),
    as_of: new Date(row.as_of).toISOString(),
    sample_size: row.sample_size,
    window_days: row.window_days,
    facts: row.facts,
    inferences: row.inferences,
    actions: row.actions,
    evidence: row.evidence,
    limitations: row.limitations,
    confidence: row.confidence as CareerBriefV1["confidence"],
  };
}

export async function saveCareerBrief(db: Db, record: CareerBriefRecordV1): Promise<void> {
  await db`
    INSERT INTO career_briefs (
      contract_version, as_of, generated_at, sample_size, window_days, observation_days, prompt_version,
      confidence, facts, inferences, actions, evidence, limitations, receipt_id, model
    ) VALUES (
      ${record.contract_version}, ${record.as_of}, ${record.generated_at}, ${record.sample_size},
      ${record.window_days}, ${record.observation_days}, ${record.prompt_version}, ${record.confidence},
      ${db.json(record.facts)}::jsonb, ${db.json(record.inferences)}::jsonb, ${db.json(record.actions)}::jsonb,
      ${db.json(record.evidence)}::jsonb, ${db.json(record.limitations)}::jsonb, ${record.receipt_id}, ${record.model}
    )
    ON CONFLICT (as_of, prompt_version) DO UPDATE SET
      contract_version = EXCLUDED.contract_version,
      generated_at = EXCLUDED.generated_at,
      sample_size = EXCLUDED.sample_size,
      window_days = EXCLUDED.window_days,
      observation_days = EXCLUDED.observation_days,
      confidence = EXCLUDED.confidence,
      facts = EXCLUDED.facts,
      inferences = EXCLUDED.inferences,
      actions = EXCLUDED.actions,
      evidence = EXCLUDED.evidence,
      limitations = EXCLUDED.limitations,
      receipt_id = EXCLUDED.receipt_id,
      model = EXCLUDED.model,
      updated_at = now()`;
}

export interface CareerBriefModelResultV1 {
  draft: unknown;
  receipt_id?: number | null;
  model?: string | null;
}

export type CareerBriefLlmCaller = (
  input: CareerBriefInputV1,
  prompt: { system: string; user: string },
) => Promise<CareerBriefModelResultV1>;

export interface GenerateCareerBriefOptions {
  limit: number;
  window_days: number;
  prompt_version?: string;
  dry_run?: boolean;
  now?: () => Date;
}

/** 无样本时不调用模型也不写库，返回 null。 */
export async function generateCareerBrief(
  db: Db,
  callLlm: CareerBriefLlmCaller,
  options: GenerateCareerBriefOptions,
): Promise<CareerBriefRecordV1 | null> {
  const input = await buildCareerBriefInput(db, { limit: options.limit, window_days: options.window_days });
  if (input.sample_size === 0) return null;
  const result = await callLlm(input, buildCareerBriefPrompt(input));
  const record = composeCareerBrief(input, result.draft, {
    generated_at: (options.now ?? (() => new Date()))().toISOString(),
    ...(options.prompt_version === undefined ? {} : { prompt_version: options.prompt_version }),
    receipt_id: result.receipt_id ?? null,
    model: result.model ?? null,
  });
  if (options.dry_run !== true) await saveCareerBrief(db, record);
  return record;
}