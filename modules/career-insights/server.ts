import type { Scheduled, ServerModule } from "@aihot/backend/modules";
import { runCareerIngest, type CareerIngestRunResult } from "./collector/cli/ingest-career.ts";
import { careerIngestAlerts } from "./backend/alerts.ts";
import { registerCareerHttp } from "./backend/http.ts";
import {
  DEFAULT_BUDGET_PROMPT_TOKENS,
  DEFAULT_BUDGET_ROWS,
  DEFAULT_SINCE_HOURS,
  runIncrementalLlmCron,
  type IncrementalLlmCronDetail,
} from "./backend/llm-incremental.ts";
import { careerIngestQueue } from "./backend/queue.ts";
import { SqlCareerRepository } from "./backend/sql-repository.ts";

const repository = new SqlCareerRepository();

/** 每个来源抓几页；与兜底同属一个 job，测试按这个值断言注入的采集参数。 */
const INGEST_PAGE_LIMIT = 2;

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
 *
 * 预算与窗口直接用 llm-incremental 的默认值（80 行 / 120000 token / 2 小时），不在这里复制数值，
 * 避免两处默认值漂移。120000 按实测 ≈1802 token/行 约够 60-67 行，一天新增约 30-50 行，余量充足；
 * 2 小时窗口覆盖整轮采集（采集成功后立即进入兜底，不必再错开）。被预算跳过的行不会被下一轮 2 小时
 * 窗口再选中，所以预算要够处理完一天的批次。
 *
 * 最坏耗时 = 采集约 53s + 兜底 CLI 15min（CLI_TIMEOUT_MS）< cron 队列 expireInSeconds=3600
 * （apps/worker/src/schedules.ts 统一给 cron.* 队列设的过期时间），不会被 pg-boss 判过期。
 */
function careerDailyRun(deps: CareerDailyDeps): () => Promise<CareerDailyResult> {
  return async () => {
    const ingest = await deps.ingest({ pageLimit: INGEST_PAGE_LIMIT });
    const llm = await deps.llm({
      budgetRows: DEFAULT_BUDGET_ROWS,
      budgetTokens: DEFAULT_BUDGET_PROMPT_TOKENS,
      sinceHours: DEFAULT_SINCE_HOURS,
    });
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
