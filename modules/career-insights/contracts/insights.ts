import type { DataOrigin, RoleFamily } from "./job.ts";

export interface CareerHotRoleFamilyCountV1 {
  role_family: RoleFamily;
  count: number;
}

export interface CareerHotEntryV1 {
  company: string;
  job_count: number;
  latest_published_at: string | null;
  role_families: CareerHotRoleFamilyCountV1[];
}

/**
 * 企业招聘热度榜：按 company_name 聚合最近 window_days 天内有观测的职位，
 * 排序为 job_count DESC、latest_published_at DESC（无效时间排后）、company ASC。
 */
export interface CareerHotResponseV1 {
  contract_version: "0.1";
  data_origin: DataOrigin;
  as_of: string;
  window_days: number;
  entries: CareerHotEntryV1[];
}

/** 当日某个采集来源的采集结果汇总；status 取当天该来源所有 run 的最差状态。 */
export interface CareerDailySourceV1 {
  source_key: string;
  collected: number;
  accepted: number;
  updated: number;
  duplicates: number;
  status: "ok" | "partial" | "failed";
}

/**
 * 今日就业日报（Asia/Shanghai 日）。当天没有任何 run 时 sources 为空且 has_run=false，
 * 其余计数仍按当前库表如实返回。
 */
export interface CareerDailyResponseV1 {
  contract_version: "0.1";
  data_origin: DataOrigin;
  date: string;
  sources: CareerDailySourceV1[];
  has_run: boolean;
  jobs_total: number;
  new_jobs_today: number;
  new_policies_today: number;
  policies_total: number;
  unknown_ratio: number | null;
  sample_size: number;
  generated_at: string;
}