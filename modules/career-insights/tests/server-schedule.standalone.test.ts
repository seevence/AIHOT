// 定时采集是趋势可积累的前提：这里守 server.ts 声明的 cron 形状，worker 统一按其注册（Asia/Shanghai）。
import assert from "node:assert/strict";
import { test } from "node:test";
import server from "../server.ts";

test("career-insights 声明每日 06:10 的采集任务，missed 只补一次", () => {
  const schedule = server.schedules?.find((entry) => entry.name === "career.ingest");
  assert.ok(schedule, "career.ingest 已声明");
  assert.equal(schedule.cron, "10 6 * * *");
  assert.equal(schedule.missed, "once");
  assert.equal(typeof schedule.run, "function");
});