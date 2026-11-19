import { createServer, type ServerResponse } from "node:http";
import type { ApiErrorResponseV1 } from "@aihot/career-insights/contracts";
import { FIXTURE_JOB_DETAIL_V1, FIXTURE_JOB_LIST_V1, FIXTURE_POLICY_LIST_V1, FIXTURE_SUMMARY_V1 } from "../fixtures/api.ts";
import { POLICY_SOURCE_OPTIONS, THEME_LABELS } from "./labels.ts";

const HOST = "127.0.0.1";
const PORT = 3101;
const MAX_PAGE = 10_000;
const MAX_PAGE_SIZE = 100;

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

function positiveInteger(raw: string | null, fallback: number, maximum: number): number | null {
  if (raw === null) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= maximum ? value : null;
}

/** 测试读取最近一次政策请求的参数，断言 loader 与分页把查询原样传给 API。 */
export const policyRequests: URLSearchParams[] = [];

export const fixtureServer = createServer((req, res) => {
  try {
    if (req.method !== "GET") {
      sendError(res, 405, "invalid_parameter", "method_not_allowed");
      return;
    }

    const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
    const { pathname, searchParams } = url;
    if (pathname === "/api/site/career-insights/summary") {
      send(res, 200, FIXTURE_SUMMARY_V1);
      return;
    }
    if (pathname === "/api/site/career-insights/jobs") {
      send(res, 200, FIXTURE_JOB_LIST_V1);
      return;
    }
    if (pathname === "/api/site/career-insights/policies") {
      policyRequests.push(new URLSearchParams(searchParams));
      const page = positiveInteger(searchParams.get("page"), 1, MAX_PAGE);
      const pageSize = positiveInteger(searchParams.get("page_size"), 20, MAX_PAGE_SIZE);
      const sourceKey = searchParams.get("source_key");
      const theme = searchParams.get("theme");
      if (page === null || pageSize === null) {
        sendError(res, 400, "invalid_parameter", "invalid_page");
        return;
      }
      if (sourceKey !== null && !POLICY_SOURCE_OPTIONS.some((option) => option.value === sourceKey)) {
        sendError(res, 400, "invalid_parameter", "unknown_source");
        return;
      }
      if (theme !== null && !(theme in THEME_LABELS)) {
        sendError(res, 400, "invalid_parameter", "unknown_theme");
        return;
      }
      send(res, 200, {
        ...FIXTURE_POLICY_LIST_V1,
        page,
        page_size: pageSize,
        filters: {
          page,
          page_size: pageSize,
          ...(sourceKey === null ? {} : { source_key: sourceKey }),
          ...(theme === null ? {} : { theme }),
        },
      });
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

fixtureServer.listen(PORT, HOST, () => {
  console.log(`Career Insights fixture API: http://${HOST}:${PORT}（联调样例，非真实数据）`);
});