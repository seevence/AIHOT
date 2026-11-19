import type { ServerModule } from "@aihot/backend/modules";
import { runCareerIngest } from "./collector/cli/ingest-career.ts";
import { registerCareerHttp } from "./backend/http.ts";
import { careerIngestQueue } from "./backend/queue.ts";
import { SqlCareerRepository } from "./backend/sql-repository.ts";

const repository = new SqlCareerRepository();

const server: ServerModule = {
  name: "career-insights",
  http(app) {
    registerCareerHttp(app, repository);
  },
  queues: [careerIngestQueue],
  schedules: [
    // 每天一次抓取，让每个职位的观测按日积累（热点趋势需要多个快照日）。
    { name: "career.ingest", cron: "10 6 * * *", missed: "once", run: () => runCareerIngest({ pageLimit: 2 }) },
  ],
};

export default server;