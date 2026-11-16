import { loadOr404 } from "@aihot/web/lib/api.server";
import type { JobFiltersV1 } from "@aihot/career-insights/contracts";

const CAREER_API_ROOT = "/api/site/career-insights";

export function careerApiPath(path: string): string {
  return `${CAREER_API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
}

export function serializeJobFilters(filters: Partial<JobFiltersV1>): string {
  const params = new URLSearchParams();
  const keys = ["role_family", "company", "city", "employment_type", "student_friendly", "skill", "page", "page_size"] as const;
  for (const key of keys) {
    const value = filters[key];
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}

export function loadCareerApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  return loadOr404<T>(path, { signal });
}