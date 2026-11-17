import type {
  DegreeLevel,
  EmploymentType,
  NormalizedJobV1,
  RawCollectedJobV1,
  RoleFamily,
  StudentFriendly,
} from "../contracts/index.ts";
import {
  CITY_ALIASES,
  CITY_NAMES,
  DEGREE_KEYWORDS,
  EMPLOYMENT_TYPE_KEYWORDS,
  EXPERIENCE_UNLIMITED_PHRASES,
  ROLE_FAMILY_KEYWORDS,
  SKILL_ALIASES,
  STUDENT_FRIENDLY_NO_PHRASES,
  STUDENT_FRIENDLY_YES_PHRASES,
} from "./dictionaries.ts";
import { computeContentHash, computeJobKey } from "./dedupe.ts";
import { validateNormalizedJobV1, type ValidationIssueV1 } from "./validate.ts";

export const NORMALIZER_VERSION = "normalizer/0.1.0";

const ROLE_FAMILIES: readonly RoleFamily[] = [
  "ai_algorithm",
  "ai_application_development",
  "data",
  "ai_product_operations",
  "unknown",
];
const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  "campus",
  "internship",
  "experienced",
  "other",
  "unknown",
];

export interface NormalizeResultV1 {
  normalized: NormalizedJobV1[];
  rejected: Array<{ raw: RawCollectedJobV1; errors: ValidationIssueV1[] }>;
}

/**
 * RawCollectedJobV1 → NormalizedJobV1。
 * 未知字段保持 null / unknown / []；不得把未写经验解释成 0 年或“经验不限”。
 */
export function normalizeRawJob(raw: RawCollectedJobV1): NormalizedJobV1 {
  const hints = raw.hints ?? {};
  const title = cleanText(raw.title);
  const rawText = raw.raw_text;
  const text = `${title}\n${rawText}`;

  const degree = resolveDegree(hints.degree_raw, text);
  const experience = resolveExperience(hints.experience_raw, text);
  const employmentType = resolveEmploymentType(hints.employment_type, text);
  const skills = resolveSkills(hints.skill_terms ?? [], text);

  const normalized: NormalizedJobV1 = {
    schema_version: "1.0",
    source_key: raw.source_key,
    job_key: computeJobKey({ source_job_id: raw.source_job_id, official_url: raw.official_url }),
    company_name: cleanText(raw.company_name),
    title,
    official_url: raw.official_url,
    role_family: resolveRoleFamily(hints.role_family, title),
    locations: resolveLocations(hints.locations ?? [], text),
    degree: degree.level,
    degree_raw: degree.raw,
    experience_min_years: experience.min,
    experience_max_years: experience.max,
    experience_raw: experience.raw,
    employment_type: employmentType,
    student_friendly: resolveStudentFriendly(employmentType, experience, title, text),
    skills: skills.map((match) => match.skill_id),
    skill_evidence: skills.map((match) => ({
      skill_id: match.skill_id,
      evidence_text: match.evidence_text,
    })),
    published_at: normalizePublishedAt(raw.published_at),
    fetched_at: raw.fetched_at,
    collector_version: raw.collector_version,
    content_hash: "",
    raw_text: rawText,
    ...(raw.raw_payload === undefined ? {} : { raw_payload: raw.raw_payload }),
  };

  normalized.content_hash = computeContentHash(normalized);
  return normalized;
}

/** 逐条归一化并用 validateNormalizedJobV1 校验，非法样本进入 rejected。 */
export function normalizeRawJobs(raws: readonly RawCollectedJobV1[]): NormalizeResultV1 {
  const normalized: NormalizedJobV1[] = [];
  const rejected: NormalizeResultV1["rejected"] = [];
  for (const raw of raws) {
    const job = normalizeRawJob(raw);
    const result = validateNormalizedJobV1(job);
    if (result.ok) {
      normalized.push(result.value);
    } else {
      rejected.push({ raw, errors: result.errors });
    }
  }
  return { normalized, rejected };
}

export function resolveRoleFamily(hint: RoleFamily | undefined, title: string): RoleFamily {
  if (hint !== undefined && ROLE_FAMILIES.includes(hint)) return hint;
  const lower = title.toLowerCase();
  for (const [family, keywords] of Object.entries(ROLE_FAMILY_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword.toLowerCase()))) {
      return family as RoleFamily;
    }
  }
  return "unknown";
}

export function resolveLocations(hints: readonly string[], text: string): string[] {
  const locations = new Set<string>();
  for (const hint of hints) {
    const normalized = normalizeCity(hint);
    if (normalized !== null) locations.add(normalized);
  }
  for (const city of CITY_NAMES) {
    if (text.includes(city)) locations.add(city);
  }
  return [...locations];
}

export function resolveDegree(
  hintRaw: string | null | undefined,
  text: string,
): { level: DegreeLevel; raw: string | null } {
  const hint = hintRaw?.trim();
  const source = hint !== undefined && hint !== "" ? hint : findFirstKeywordPhrase(text, DEGREE_KEYWORDS);
  if (source === null) return { level: "unknown", raw: null };

  const lower = source.toLowerCase();
  for (const entry of DEGREE_KEYWORDS) {
    if (entry.keywords.some((keyword) => lower.includes(keyword.toLowerCase()))) {
      return { level: entry.level, raw: source };
    }
  }
  return { level: "other", raw: source };
}

export interface ExperienceRequirementV1 {
  min: number | null;
  max: number | null;
  raw: string | null;
}

export function resolveExperience(
  hintRaw: string | null | undefined,
  text: string,
): ExperienceRequirementV1 {
  const hint = hintRaw?.trim();
  const source = hint !== undefined && hint !== "" ? hint : null;
  const scanned = source ?? text;

  const range = scanned.match(/(\d{1,2})\s*(?:-|~|—|–|至|到)\s*(\d{1,2})\s*年(?:工作)?(?:经验)?/);
  if (range !== null && range[1] !== undefined && range[2] !== undefined) {
    return { min: Number(range[1]), max: Number(range[2]), raw: source ?? range[0] };
  }

  const above = scanned.match(/(\d{1,2})\s*年(?:以上|及以上|\+)(?:工作)?(?:经验)?/);
  if (above !== null && above[1] !== undefined) {
    return { min: Number(above[1]), max: null, raw: source ?? above[0] };
  }

  const below = scanned.match(/(\d{1,2})\s*年(?:以内|以下)(?:工作)?(?:经验)?/);
  if (below !== null && below[1] !== undefined) {
    return { min: null, max: Number(below[1]), raw: source ?? below[0] };
  }

  const single = scanned.match(/(\d{1,2})\s*年(?:工作)?经验/);
  if (single !== null && single[1] !== undefined) {
    return { min: Number(single[1]), max: null, raw: source ?? single[0] };
  }

  if (source !== null) {
    return { min: null, max: null, raw: source };
  }

  for (const phrase of EXPERIENCE_UNLIMITED_PHRASES) {
    if (text.includes(phrase)) return { min: null, max: null, raw: phrase };
  }

  if (text.includes("应届")) {
    const index = text.indexOf("应届");
    return { min: null, max: null, raw: excerpt(text, index, 2) };
  }

  return { min: null, max: null, raw: null };
}

export function resolveEmploymentType(
  hint: EmploymentType | undefined,
  text: string,
): EmploymentType {
  if (hint !== undefined && EMPLOYMENT_TYPES.includes(hint)) return hint;
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(EMPLOYMENT_TYPE_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword.toLowerCase()))) {
      return type as EmploymentType;
    }
  }
  return "unknown";
}

/**
 * 按开发契约 4.3 判定：
 * - yes：校招/实习，或明确接受应届/在校生/经验不限，或明确 0–1 年经验；
 * - no：明确不接受应届，或明确要求 2 年以上，或明确资深/专家且无学生入口；
 * - 其他一律 unknown。未写经验的初级岗位不能判为 yes。
 */
export function resolveStudentFriendly(
  employmentType: EmploymentType,
  experience: ExperienceRequirementV1,
  title: string,
  text: string,
): StudentFriendly {
  if (employmentType === "campus" || employmentType === "internship") return "yes";

  if (STUDENT_FRIENDLY_YES_PHRASES.some((phrase) => text.includes(phrase))) return "yes";

  if (experience.min === 0) return "yes";
  if (
    experience.min !== null &&
    experience.max !== null &&
    experience.min <= 1 &&
    experience.max <= 1
  ) {
    return "yes";
  }

  if (STUDENT_FRIENDLY_NO_PHRASES.some((phrase) => text.includes(phrase))) return "no";
  if (experience.min !== null && experience.min >= 2) return "no";
  if (/(资深|专家|高级)/.test(title)) return "no";

  return "unknown";
}

export interface SkillMatchV1 {
  skill_id: string;
  evidence_text: string;
  index: number;
}

export function resolveSkills(hints: readonly string[], text: string): SkillMatchV1[] {
  const matches = new Map<string, SkillMatchV1>();

  for (const term of hints) {
    const skillId = lookupSkillId(term);
    if (skillId === null || matches.has(skillId)) continue;
    matches.set(skillId, { skill_id: skillId, evidence_text: term, index: Number.MAX_SAFE_INTEGER });
  }

  for (const [skillId, match] of scanSkillIds(text)) {
    const existing = matches.get(skillId);
    if (existing === undefined || existing.index === Number.MAX_SAFE_INTEGER) {
      matches.set(skillId, match);
    }
  }

  return [...matches.values()].sort(
    (left, right) => left.index - right.index || left.skill_id.localeCompare(right.skill_id),
  );
}

function scanSkillIds(text: string): Map<string, SkillMatchV1> {
  const found = new Map<string, SkillMatchV1>();
  const aliases = Object.entries(SKILL_ALIASES).sort(
    (left, right) => right[0].length - left[0].length,
  );
  for (const [alias, skillId] of aliases) {
    const index = findAliasIndex(text, alias);
    if (index < 0) continue;
    const existing = found.get(skillId);
    if (existing === undefined || index < existing.index) {
      found.set(skillId, {
        skill_id: skillId,
        evidence_text: excerpt(text, index, alias.length),
        index,
      });
    }
  }
  return found;
}

function lookupSkillId(term: string): string | null {
  const key = term.trim().toLowerCase();
  if (key === "") return null;
  const direct = SKILL_ALIASES[key];
  if (direct !== undefined) return direct;
  const knownIds = new Set(Object.values(SKILL_ALIASES));
  return knownIds.has(key) ? key : null;
}

function findAliasIndex(text: string, alias: string): number {
  const lowerAlias = alias.toLowerCase();
  if (/^[a-z0-9]/.test(lowerAlias)) {
    const escaped = escapeRegExp(lowerAlias);
    const pattern = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
    const match = pattern.exec(text);
    return match === null ? -1 : match.index;
  }
  return text.toLowerCase().indexOf(lowerAlias);
}

function findFirstKeywordPhrase(
  text: string,
  groups: ReadonlyArray<{ keywords: readonly string[] }>,
): string | null {
  const lower = text.toLowerCase();
  let best: { index: number; phrase: string } | null = null;
  for (const group of groups) {
    for (const keyword of group.keywords) {
      const index = lower.indexOf(keyword.toLowerCase());
      if (index < 0) continue;
      if (best === null || index < best.index) best = { index, phrase: keyword };
    }
  }
  return best === null ? null : excerpt(text, best.index, best.phrase.length);
}

function normalizeCity(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const aliased = CITY_ALIASES[trimmed];
  if (aliased !== undefined) return aliased;
  return CITY_NAMES.includes(trimmed) ? trimmed : null;
}

function normalizePublishedAt(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function excerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + length + 20);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}