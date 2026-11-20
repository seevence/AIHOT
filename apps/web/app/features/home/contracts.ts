import type { CareerBriefV1 } from "@aihot/career-insights/contracts";

// 首页一次取的方向数（catalog 的 limit，1..50）。
export const HOME_CATALOG_LIMIT = 6;
// 首页市场信号条数（signals 的 limit）。
export const HOME_SIGNALS_LIMIT = 5;
// 首页最新岗位条数；接口按 last_seen_at 倒序返回，取前几条展示。
export const HOME_LATEST_JOBS = 6;

/**
 * 研判区块的三种状态：读到缓存、接口明确没有缓存（204）、请求失败。
 * 只有前两种是正常结果，失败只降级本区块。
 */
export type HomeBriefState =
  | { status: "ok"; data: CareerBriefV1 }
  | { status: "empty" }
  | { status: "failed" };