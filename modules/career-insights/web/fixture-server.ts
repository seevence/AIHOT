import { createServer, type ServerResponse } from "node:http";
import type { ApiErrorResponseV1 } from "@aihot/career-insights/contracts";
import { FIXTURE_JOB_DETAIL_V1, FIXTURE_JOB_LIST_V1, FIXTURE_SUMMARY_V1 } from "../fixtures/api.ts";

const HOST = "127.0.0.1";
const PORT = 3101;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, status: number, code: ApiErrorResponseV1["error"]["code"], message: string): void {
  send(res, status, { error: { code, message } } satisfies ApiErrorResponseV1);
}

const server = createServer((req, res) => {
  try {
    if (req.method !== "GET") {
      sendError(res, 405, "invalid_parameter", "method_not_allowed");
      return;
    }

    const { pathname } = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
    if (pathname === "/api/site/career-insights/summary") {
      send(res, 200, FIXTURE_SUMMARY_V1);
      return;
    }
    if (pathname === "/api/site/career-insights/jobs") {
      send(res, 200, FIXTURE_JOB_LIST_V1);
      return;
    }

    const detailMatch = pathname.match(/^\/api\/site\/career-insights\/jobs\/([^/]+)$/);
    if (detailMatch) {
      const id = decodeURIComponent(detailMatch[1]);
      if (id === FIXTURE_JOB_DETAIL_V1.job.id) {
        send(res, 200, FIXTURE_JOB_DETAIL_V1);
      } else {
        sendError(res, 404, "not_found", "job_not_found");
      }
      return;
    }

    sendError(res, 404, "not_found", "route_not_found");
  } catch {
    sendError(res, 500, "internal_error", "fixture_server_error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Career Insights fixture API: http://${HOST}:${PORT}（联调样例，非真实数据）`);
});