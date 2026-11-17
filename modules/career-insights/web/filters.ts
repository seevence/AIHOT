import type { EmploymentType, JobFiltersV1, RoleFamily, StudentFriendly } from "@aihot/career-insights/contracts";

export const JOB_PAGE_SIZES: readonly [20, 50] = [20, 50];

export type DashboardView = "overview" | "direction";

const ROLE_FAMILIES: readonly RoleFamily[] = ["ai_algorithm", "ai_application_development", "data", "ai_product_operations", "unknown"];
const EMPLOYMENT_TYPES: readonly EmploymentType[] = ["campus", "internship", "experienced", "other", "unknown"];
const STUDENT_FRIENDLY_VALUES: readonly StudentFriendly[] = ["yes", "no", "unknown"];

export function serializeJobFilters(filters: Partial<JobFiltersV1>): string {
  const params = new URLSearchParams();
  const keys = ["role_family", "company", "city", "employment_type", "student_friendly", "skill", "page", "page_size"] as const;
  for (const key of keys) {
    const value = filters[key];
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}

function pickEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (value === null) return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

const MAX_PAGE = 1_000_000;

function parsePage(raw: string | null): number {
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return 1;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= MAX_PAGE ? value : 1;
}

function parsePageSize(raw: string | null): number {
  const value = Number(raw);
  return (JOB_PAGE_SIZES as readonly number[]).includes(value) ? value : JOB_PAGE_SIZES[0];
}

export function parseDashboardFilters(search: URLSearchParams): JobFiltersV1 {
  const filters: JobFiltersV1 = {
    page: parsePage(search.get("page")),
    page_size: parsePageSize(search.get("page_size")),
  };

  const roleFamily = pickEnum(search.get("role_family"), ROLE_FAMILIES);
  if (roleFamily) filters.role_family = roleFamily;
  const employmentType = pickEnum(search.get("employment_type"), EMPLOYMENT_TYPES);
  if (employmentType) filters.employment_type = employmentType;
  const studentFriendly = pickEnum(search.get("student_friendly"), STUDENT_FRIENDLY_VALUES);
  if (studentFriendly) filters.student_friendly = studentFriendly;

  for (const key of ["company", "city", "skill"] as const) {
    const value = search.get(key)?.trim();
    if (value) filters[key] = value;
  }

  return filters;
}

export function buildJobsHref(filters: JobFiltersV1): string {
  return `/career-insights?${serializeJobFilters(filters)}`;
}

export function parseDirectionView(search: URLSearchParams): { view: DashboardView; roleFamily?: RoleFamily } {
  if (search.get("view") !== "direction") return { view: "overview" };
  const roleFamily = pickEnum(search.get("role_family"), ROLE_FAMILIES);
  return roleFamily ? { view: "direction", roleFamily } : { view: "direction" };
}

export function buildDirectionHref(roleFamily: RoleFamily): string {
  return `/career-insights?view=direction&role_family=${encodeURIComponent(roleFamily)}&page=1&page_size=${JOB_PAGE_SIZES[0]}`;
}

export function buildJobHref(jobId: string, back: string): string {
  return `/career-insights/jobs/${encodeURIComponent(jobId)}?back=${encodeURIComponent(back)}`;
}

export function safeBackHref(raw: string | null): string {
  if (raw === null) return "/career-insights";
  const isCareerPath = raw === "/career-insights" || raw.startsWith("/career-insights?");
  if (!isCareerPath || raw.includes("//") || raw.includes(":")) return "/career-insights";
  return raw;
}
