// 定时采集是趋势可积累的前提：这里守 server.ts 声明的 cron 形状，以及「采集成功后才兜底」的串行顺序。
// pg-boss 的 missed: "once" 补跑会在 worker 启动时把漏掉的槽位一起拉起来，所以采集与 LLM 兜底必须在
// 同一个 job 的同一个 run 里串行（2026-11-21 实测：两者同刻启动，兜底 185ms 结束、0 候选，
// 当天新增的 34 行 unknown 没有被兜底）。worker 统一按 server.schedules 注册（Asia/Shanghai）；
// 下面的 fake 依赖不碰真实数据库、子进程与模型。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_BUDGET_PROMPT_TOKENS,
  DEFAULT_BUDGET_ROWS,
  DEFAULT_SINCE_HOURS,
  emptyIncrementalLlmDetail,
} from "../backend/llm-incremental.ts";
import { buildIngestReport } from "../collector/cli/ingest-career.ts";
import server, { createCareerSchedules, type CareerDailyDeps, type CareerDailyResult } from "../server.ts";

function ingestResult(overrides: { rejected?: number; failedSources?: string[] } = {}) {
  return {
    report: buildIngestReport({
      startedAt: "2026-11-20T22:10:00.000Z",
      finishedAt: "2026-11-20T22:10:53.000Z",
      pageLimit: 2,
      jobs: [],
      policies: [],
      counts: { jobs: 34 },
    }),
    rejected: overrides.rejected ?? 0,
    failedSources: overrides.failedSources ?? [],
  };
}

function llmResult(ok: boolean) {
  const detail = emptyIncrementalLlmDetail({
    apply: true,
    since: new Date("2026-11-20T20:10:00.000Z"),
    maxRows: 80,
    maxPromptTokens: 120_000,
  });
  return ok
    ? { ...detail, ok: true, duration_ms: 185, exit_code: 0 }
    : { ...detail, ok: false, duration_ms: 185, exit_code: 1, error: "兜底子进程退出码 1" };
}

test("career-insights 只有一条每日 06:10 的 schedule，missed 只补一次", () => {
  const schedules = server.schedules ?? [];
  assert.equal(schedules.length, 1, "采集与兜底在同一个 run 里，不再有独立的兜底 schedule");
  assert.deepEqual(schedules.map((entry) => entry.name), ["career.ingest"], "career.llm-normalize 已删除");

  const [schedule] = schedules;
  assert.ok(schedule);
  assert.equal(schedule.cron, "10 6 * * *");
  assert.equal(schedule.missed, "once");
  assert.equal(typeof schedule.run, "function");
});

test("同一个 run 里先采集、等采集成功返回后才兜底：fake 调用序列为 ingest → llm", async () => {
  const calls: string[] = [];
  const deps: CareerDailyDeps = {
    async ingest(options) {
      calls.push("ingest:start");
      assert.equal(options.pageLimit, 2);
      // 模拟采集耗时（实测 53s）：兜底必须等 ingest 的 promise resolve 之后才开始。
      await new Promise((resolve) => setTimeout(resolve, 5));
      calls.push("ingest:done");
      return ingestResult();
    },
    async llm(options) {
      calls.push("llm");
      assert.deepEqual(calls, ["ingest:start", "ingest:done", "llm"], "兜底在采集 resolve 之后才开始，不是并发启动");
      assert.deepEqual(
        options,
        { budgetRows: DEFAULT_BUDGET_ROWS, budgetTokens: DEFAULT_BUDGET_PROMPT_TOKENS, sinceHours: DEFAULT_SINCE_HOURS },
        "注入的预算/窗口就是 llm-incremental 的导出默认值，server 不写死数字",
      );
      return llmResult(true);
    },
  };

  const [schedule] = createCareerSchedules(deps);
  const result = (await schedule!.run()) as CareerDailyResult;

  assert.deepEqual(calls, ["ingest:start", "ingest:done", "llm"], "兜底只在采集成功返回之后执行");
  assert.equal(result.report.kind, "career-ingest");
  assert.equal(result.report.page_limit, 2);
  assert.equal(result.llm.ok, true);
});

test("采集抛错时 job 失败：兜底不执行，错误不被吞掉", async () => {
  let llmCalls = 0;
  const [schedule] = createCareerSchedules({
    ingest: async () => {
      throw new Error("fetch failed: ECONNRESET");
    },
    llm: async () => {
      llmCalls += 1;
      return llmResult(true);
    },
  });

  await assert.rejects(schedule!.run(), /ECONNRESET/);
  assert.equal(llmCalls, 0, "采集失败后不进入兜底");
});

test("采集成功但兜底 ok:false：run 正常返回，detail 里采集结果与兜底汇总都在", async () => {
  const [schedule] = createCareerSchedules({
    ingest: async () => ingestResult({ rejected: 2, failedSources: ["career-dji"] }),
    llm: async () => llmResult(false),
  });

  const result = (await schedule!.run()) as CareerDailyResult;

  assert.equal(result.report.kind, "career-ingest", "采集成果保留在 detail.report");
  assert.equal(result.rejected, 2);
  assert.deepEqual(result.failedSources, ["career-dji"], "顶层 failedSources 供 alerts.ts 读取，形状不变");
  assert.equal(result.llm.ok, false, "兜底失败只记在 detail.llm，不升级为 job 失败");
  assert.match(result.llm.error ?? "", /退出码/);
});

test("兜底意外 throw（违反 runIncrementalLlmCron 不抛的契约）：job 失败", async () => {
  // runIncrementalLlmCron 的契约是失败也返回 ok:false、不抛错。一旦它违反契约抛错，让整个 job 失败、
  // 采集 report 不落 detail 是有意的：这类 bug 要在 job_runs 里显形，而不是被静默吞掉变成"成功"。
  const [schedule] = createCareerSchedules({
    ingest: async () => ingestResult(),
    llm: async () => {
      throw new Error("兜底子进程意外抛错");
    },
  });

  await assert.rejects(schedule!.run(), /兜底子进程意外抛错/);
});
