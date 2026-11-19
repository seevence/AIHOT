// 职位采集每天 06:10 跑一次（server.ts 的 career.ingest），整体抛错与部分来源失败都会留下
// job_runs 行：前者 status='failed'，后者把 failedSources 写进 detail。这里只读最近一次运行，
// 由 ops.alerts 的既有节奏负责发送与节流（同一 key 一天最多提醒一次，成功后发恢复）。
import { beijingStamp } from "@aihot/contracts/time";
import { sql } from "@aihot/backend/db";
import type { Finding } from "@aihot/backend/notify/feishu";

export const CAREER_INGEST_JOB = "career.ingest";

interface IngestRunRow {
  status: string;
  error: string | null;
  started_at: Date;
  detail: { failedSources?: string[] } | null;
}

/** 最近一次 career.ingest 的失败；没有运行、正在运行或已成功时为空。 */
export async function careerIngestAlerts(now: number): Promise<Finding[]> {
  const [run] = await sql<IngestRunRow[]>`
    SELECT status, error, started_at, detail FROM job_runs
    WHERE job = ${CAREER_INGEST_JOB} AND started_at <= ${new Date(now)}
    ORDER BY started_at DESC LIMIT 1`;
  if (run === undefined) return [];
  const failed = Array.isArray(run.detail?.failedSources) ? run.detail.failedSources : [];
  const crashed = run.status === "failed";
  if (!crashed && failed.length === 0) return [];
  const at = beijingStamp(run.started_at);
  const what = crashed
    ? `${CAREER_INGEST_JOB} 在 ${at} 运行失败${run.error ? `：${run.error.slice(0, 200)}` : ""}`
    : `${CAREER_INGEST_JOB} 在 ${at} 运行，${failed.length} 个来源没有成功：${failed.join("、")}`;
  return [{
    key: CAREER_INGEST_JOB,
    level: "today",
    title: "职位数据采集没有完整跑完",
    impact: `${what}，职位与政策数据可能没有更新`,
    heals: "下一次采集成功才会恢复；来源本身的问题不会自己好",
    action: "可在 /admin/runs 查看",
    detail: `job ${CAREER_INGEST_JOB} 状态 ${run.status}${failed.length ? `；失败来源（source_key）：${failed.join("、")}` : ""}${run.error ? `；错误：${run.error.slice(0, 500)}` : ""}`,
    since: run.started_at,
  }];
}