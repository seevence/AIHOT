import type { ServerModule } from "@aihot/backend/modules";
import { registerCareerHttp } from "./backend/http.ts";
import { UnavailableCareerRepository } from "./backend/repository.ts";

const repository = new UnavailableCareerRepository();

const server: ServerModule = {
  name: "career-insights",
  http(app) {
    registerCareerHttp(app, repository);
  },
};

export default server;