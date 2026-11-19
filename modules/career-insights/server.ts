import type { ServerModule } from "@aihot/backend/modules";
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
};

export default server;