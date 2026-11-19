import type { DataOrigin, PolicyEvidenceRefV1 } from "@aihot/career-insights/contracts";
import { POLICY_SOURCE_OPTIONS, THEME_LABELS } from "./labels.ts";

/** 政策列表按 API 的默认页大小取数。 */
export const POLICY_PAGE_SIZE = 20;
const MAX_PAGE = 10_000;

export interface PolicyPageFilters {
  source_key?: string;
  theme?: string;
  page: number;
  page_size: number;
}

export interface PolicyListResponse {
  contract_version: "0.1";
  data_origin: DataOrigin;
  as_of: string;
  items: PolicyEvidenceRefV1[];
  page: number;
  page_size: number;
  total: number;
  filters: PolicyPageFilters;
}

function parsePolicyPage(raw: string | null): number {
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return 1;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= MAX_PAGE ? value : 1;
}

export function parsePolicyFilters(search: URLSearchParams): PolicyPageFilters {
  const filters: PolicyPageFilters = { page: parsePolicyPage(search.get("page")), page_size: POLICY_PAGE_SIZE };
  const sourceKey = search.get("source_key");
  if (sourceKey !== null && POLICY_SOURCE_OPTIONS.some((option) => option.value === sourceKey)) filters.source_key = sourceKey;
  const theme = search.get("theme");
  if (theme !== null && theme in THEME_LABELS) filters.theme = theme;
  return filters;
}

export function serializePolicyFilters(filters: Partial<PolicyPageFilters>): string {
  const params = new URLSearchParams();
  const keys = ["source_key", "theme", "page", "page_size"] as const;
  for (const key of keys) {
    const value = filters[key];
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}

export function buildPoliciesHref(filters: Partial<PolicyPageFilters>): string {
  return `/career-insights/policies?${serializePolicyFilters(filters)}`;
}

/** loader 与测试共用的 API 地址。 */
export function policyApiPath(filters: PolicyPageFilters): string {
  return `/policies?${serializePolicyFilters(filters)}`;
}