import type { Scheduled, ServerModule } from "@aihot/backend/modules";
import { runCareerIngest, type CareerIngestRunResult } from "./collector/cli/ingest-career.ts";
import { careerIngestAlerts } from "./backend/alerts.ts";
import { registerCareerHttp } from "./backend/http.ts";
import { runIncrementalLlmCron, type IncrementalLlmCronDetail } from "./backend/llm-incremental.ts";
import { careerIngestQueue } from "./backend/queue.ts";
import { SqlCareerRepository } from "./backend/sql-repository.ts";

const repository = new SqlCareerRepository();

/** 每个来源抓几页；与兜底同属一个 job，测试按这个值断言注入的采集参数。 */
const INGEST_PAGE_LIMIT = 2;
/**
 * 兜底预算：80 行约等于一天新增岗位量（约 30-50 行）的余量，12 万 prompt token 按 chars/1.5 的保守估算
 * 约够 80 行；窗口 2 小时覆盖整轮采集（采集成功后立即进入兜底，不必再错开）。
 * 预算必须够处理完一天的批次：被跳过的行不会被下一轮 2 小时窗口再选中。
 */
const LLM_BUDGET_ROWS = 80;
const LLM_BUDGET_TOKENS = 120_000;
const LLM_SINCE_HOURS = 2;

/** 每日 job 的两个步骤；测试注入 fake，不碰真实数据库、子进程与模型。 */
export interface CareerDailyDeps {
  ingest: (options: { pageLimit?: number }) => Promise<CareerIngestRunResult>;
  llm: (options: { budgetRows: number; budgetTokens: number; sinceHours: number }) => Promise<IncrementalLlmCronDetail>;
}

/**
 * job_runs.detail：采集结果（report/rejected/failedSources 原样保留，alerts.ts 读顶层 failedSources）
 * 加上兜底汇总。两块都在，采集成功而兜底失败时采集成果不丢。
 */
export type CareerDailyResult = CareerIngestRunResult & { llm: IncrementalLlmCronDetail };

/**
 * 采集 → LLM 兜底的串行 run。两者必须在一个 job 里跑完：pg-boss 的 missed: "once" 补跑会在 worker
 * 启动时把同一时刻漏掉的槽位一起拉起来，拆成两个 schedule 时兜底会和采集同时启动（2026-11-21 实测
 * 01:28:55 两者同刻启动，兜底 185ms 结束、0 候选，当天新增的 34 行 unknown 没有兜底）。
 *
 * 采集抛错时整个 job 失败：不执行兜底，也不吞错。兜底返回 ok:false（子进程失败/超时）不算 job 失败，
 * 只记在 detail.llm 里，采集成果照样保留在 detail 里。
 */
function careerDailyRun(deps: CareerDailyDeps): () => Promise<CareerDailyResult> {
  return async () => {
    const ingest = await deps.ingest({ pageLimit: INGEST_PAGE_LIMIT });
    const llm = await deps.llm({ budgetRows: LLM_BUDGET_ROWS, budgetTokens: LLM_BUDGET_TOKENS, sinceHours: LLM_SINCE_HOURS });
    return { ...ingest, llm };
  };
}

/** career-insights 的全部 schedule：采集与兜底只能在这一条里串行，不要再拆出独立的兜底 cron。 */
export function createCareerSchedules(deps: CareerDailyDeps): Scheduled[] {
  return [{ name: "career.ingest", cron: "10 6 * * *", missed: "once", run: careerDailyRun(deps) }];
}

const server: ServerModule = {
  name: "career-insights",
  http(app) {
    registerCareerHttp(app, repository);
  },
  alerts: careerIngestAlerts,
  queues: [careerIngestQueue],
  schedules: createCareerSchedules({ ingest: runCareerIngest, llm: runIncrementalLlmCron }),
};

export default server;
