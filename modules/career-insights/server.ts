import type { ServerModule } from "@aihot/backend/modules";
import { runCareerIngest } from "./collector/cli/ingest-career.ts";
import { careerIngestAlerts } from "./backend/alerts.ts";
import { registerCareerHttp } from "./backend/http.ts";
import { runIncrementalLlmCron } from "./backend/llm-incremental.ts";
import { careerIngestQueue } from "./backend/queue.ts";
import { SqlCareerRepository } from "./backend/sql-repository.ts";

const repository = new SqlCareerRepository();

const server: ServerModule = {
  name: "career-insights",
  http(app) {
    registerCareerHttp(app, repository);
  },
  alerts: careerIngestAlerts,
  queues: [careerIngestQueue],
  schedules: [
    // 每天一次抓取，让每个职位的观测按日积累（热点趋势需要多个快照日）。
    { name: "career.ingest", cron: "10 6 * * *", missed: "once", run: () => runCareerIngest({ pageLimit: 2 }) },
    // 采集后错开半小时，只对本次窗口内新入库/更新且仍未分类的行做有预算的模型兜底：
    // 子进程里显式 MODEL_CALLS_ENABLED=true，worker 自己的开关不变；队列由 worker 统一按 singleton 注册。
    {
      name: "career.llm-normalize",
      cron: "40 6 * * *",
      missed: "once",
      run: () => runIncrementalLlmCron({ budgetRows: 50, budgetTokens: 50_000, sinceHours: 2 }),
    },
  ],
};

export default server;