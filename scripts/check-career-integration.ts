// Checks the career-insights module against a live site: the page, health, summary, jobs and the invalid-id
// route. The pre-data phase accepts a rendered 503 page and 503 data_unavailable for summary and jobs;
// `--require-data` rejects them.
//   node scripts/check-career-integration.ts [--base http://localhost:3000] [--require-data]
import { parseArgs } from "node:util";
import { CAREER_CONTRACT_VERSION } from "@aihot/career-insights/contracts";

interface ResponseSnapshot {
  status: number;
  contentType: string;
  body: string;
}

interface CheckResult {
  path: string;
  reason: string | null;
}

type Check = (res: ResponseSnapshot) => string | null;

const PAGE_MARKER = "职业洞察";
const PRE_DATA_MARKER = "数据尚未就绪";
const TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(body: string): { value?: Record<string, unknown>; reason?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { reason: "response is not valid JSON" };
  }
  return isRecord(parsed) ? { value: parsed } : { reason: "response JSON is not an object" };
}

const healthCheck: Check = (res) => {
  if (res.status !== 200) return `HTTP ${res.status}, expected 200`;
  const json = readJson(res.body);
  if (json.reason) return json.reason;
  if (json.value!.ok !== true) return `ok is ${JSON.stringify(json.value!.ok)}, expected true`;
  if (json.value!.db !== "ok") return `db is ${JSON.stringify(json.value!.db)}, expected "ok"`;
  return null;
};

function pageCheck(requireData: boolean): Check {
  return (res) => {
    if (res.status !== 200 && res.status !== 503) return `HTTP ${res.status}, expected 200${requireData ? "" : " or a rendered 503"}`;
    if (res.status === 503 && requireData) return "HTTP 503, but --require-data expects real data";
    if (!res.contentType.includes("text/html")) return `content-type ${res.contentType || "(none)"}, expected HTML`;
    if (!res.body.includes(PAGE_MARKER)) return `the page does not contain ${PAGE_MARKER}`;
    if (res.status === 503 && !res.body.includes(PRE_DATA_MARKER)) return `HTTP 503 page does not contain ${PRE_DATA_MARKER}`;
    return null;
  };
}

function dataCheck(listField: "metrics" | "items", requireData: boolean): Check {
  return (res) => {
    if (res.status === 503) {
      if (requireData) return "HTTP 503, but --require-data expects real data";
      const json = readJson(res.body);
      if (json.reason) return `${json.reason} (HTTP 503)`;
      const error = json.value!.error;
      const code = isRecord(error) ? error.code : undefined;
      return code === "data_unavailable" ? null : `error.code ${JSON.stringify(code)}, expected "data_unavailable"`;
    }
    if (res.status !== 200) return `HTTP ${res.status}, expected 200${requireData ? "" : " or 503"}`;
    const json = readJson(res.body);
    if (json.reason) return json.reason;
    const value = json.value!;
    if (value.contract_version !== CAREER_CONTRACT_VERSION) {
      return `contract_version ${JSON.stringify(value.contract_version)}, expected "${CAREER_CONTRACT_VERSION}"`;
    }

    if (!Array.isArray(value[listField])) return `${listField} is not an array`;
    return null;
  };
}

const invalidIdCheck: Check = (res) => {
  if (res.status !== 400) return `HTTP ${res.status}, expected 400`;
  const json = readJson(res.body);
  if (json.reason) return json.reason;
  const error = json.value!.error;
  const code = isRecord(error) ? error.code : undefined;
  return code === "invalid_parameter" ? null : `error.code ${JSON.stringify(code)}, expected "invalid_parameter"`;
};

export async function checkCareerSite(base: string, options: { requireData?: boolean } = {}): Promise<CheckResult[]> {
  const origin = base.replace(/\/+$/, "");
  const requireData = options.requireData ?? false;
  const checks: Array<{ path: string; verify: Check }> = [
    { path: "/api/health", verify: healthCheck },
    { path: "/career-insights", verify: pageCheck(requireData) },
    { path: "/api/site/career-insights/summary", verify: dataCheck("metrics", requireData) },
    { path: "/api/site/career-insights/jobs", verify: dataCheck("items", requireData) },
    { path: "/api/site/career-insights/jobs/not-a-uuid", verify: invalidIdCheck },
  ];
  const results: CheckResult[] = [];
  for (const { path, verify } of checks) {
    let reason: string | null;
    try {
      const res = await fetch(origin + path, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
      const contentType = res.headers.get("content-type") ?? "";
      const body = await res.text();
      reason = verify({ status: res.status, contentType, body });
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
    results.push({ path, reason });
  }
  return results;
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { base: { type: "string" }, "require-data": { type: "boolean", default: false } } });
  const base = values.base ?? process.env.SITE_URL ?? "http://localhost:3000";
  const results = await checkCareerSite(base, { requireData: values["require-data"] });
  for (const { path, reason } of results) console.log(reason === null ? `✓ ${path}` : `✗ ${path}  ${reason}`);
  const failed = results.filter((result) => result.reason !== null).length;
  console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
  process.exitCode = failed ? 1 : 0;
}