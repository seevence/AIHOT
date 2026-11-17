import { loadOr404 } from "@aihot/web/lib/api.server";

const CAREER_API_ROOT = "/api/site/career-insights";

export { JOB_PAGE_SIZES, buildJobsHref, parseDashboardFilters, serializeJobFilters } from "./filters";

export function careerApiPath(path: string): string {
  return `${CAREER_API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
}

export function loadCareerApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  return loadOr404<T>(path, { signal });
}