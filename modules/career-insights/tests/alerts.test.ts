// career.ingest 的告警进入 ops.alerts：整体失败与部分来源失败都要有人知道，重复提醒沿用
// ops.alerts 的既有节流（同一 key 一天一次），恢复由它自己发。这里用关闭的内部通道当 fake notifier：
// sendAlert 只记录、不发外网。
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { beijingAt } from "@aihot/contracts/time";
import { closeDb, sql } from "@aihot/backend/db";
import { getBoss, stopBoss } from "@aihot/backend/jobs/queue";
import { installModules } from "@aihot/backend/modules";
import { formatAlert } from "@aihot/backend/notify/feishu";
import { checkAlerts } from "@aihot/backend/operations/alerts";
import { CAREER_INGEST_JOB, careerIngestAlerts } from "../backend/alerts.ts";
import server from "../server.ts";

const NOW = beijingAt("2026-11-19", "06:10").getTime();
const career = (keys: string[]) => keys.filter((key) => key.startsWith(CAREER_INGEST_JOB));

function run(status: "ok" | "failed" | "skipped", detail: unknown, startedAt = new Date(NOW), error: string | null = null) {
  return sql`INSERT INTO job_runs (job, started_at, finished_at, status, detail, error)
    VALUES (${CAREER_INGEST_JOB}, ${startedAt}, ${startedAt}, ${status}, ${sql.json(detail as never)}, ${error})`;
}

before(async () => {
  Object.assign(process.env, { COLLECT_ENABLED: "false", MODEL_CALLS_ENABLED: "false", FEISHU_INTERNAL_ENABLED: "false" });
  installModules([server]);
  await getBoss();
});
beforeEach(async () => {
  await sql`DELETE FROM job_runs WHERE job = ${CAREER_INGEST_JOB}`;
  await sql`DELETE FROM settings WHERE key IN ('alerts.state', 'alerts.returns')`;
});
after(async () => {
  await stopBoss();
  await closeDb();
});

test("failedSources 非空：发出告警，正文含 job、来源、北京时间与 /admin/runs", async () => {
  await run("ok", { rejected: 0, failedSources: ["career-dji", "career-baidu"] });

  const [finding] = await careerIngestAlerts(NOW);
  assert.ok(finding, "最近一次运行有失败来源");
  assert.equal(finding.key, CAREER_INGEST_JOB);
  const text = [finding.title, finding.impact, finding.action, finding.detail].join("\n");
  assert.match(text, /career\.ingest/);
  assert.match(text, /career-dji/);
  assert.match(text, /career-baidu/);
  assert.match(text, /11月19日 06:10/, "时间按北京时间显示");
  assert.match(text, /可在 \/admin\/runs 查看/);

  const msg = formatAlert(finding, finding.since!, NOW);
  assert.match(msg.title, /职位数据采集/);
  assert.match(msg.lines.join("\n"), /career-dji、career-baidu/);

  assert.deepEqual(career((await checkAlerts(NOW)).sent), [CAREER_INGEST_JOB]);
  assert.deepEqual(career((await checkAlerts(NOW + 60 * 60_000)).sent), [], "同一失败一小时内不重复");
});

test("failedSources 为空：不告警", async () => {
  await run("ok", { rejected: 0, failedSources: [] });
  assert.deepEqual(await careerIngestAlerts(NOW), []);
  assert.deepEqual(career((await checkAlerts(NOW)).sent), []);
});

test("整体抛错（status=failed）：同样告警并带上错误", async () => {
  await run("failed", { owner: "worker" }, new Date(NOW), "fetch failed: ECONNRESET");
  const [finding] = await careerIngestAlerts(NOW);
  assert.ok(finding);
  assert.match(finding.impact!, /ECONNRESET/);
  assert.deepEqual(career((await checkAlerts(NOW)).sent), [CAREER_INGEST_JOB]);
});

test("下一次成功运行结束告警", async () => {
  await run("ok", { failedSources: ["career-dji"] });
  assert.deepEqual(career((await checkAlerts(NOW)).sent), [CAREER_INGEST_JOB]);

  await run("ok", { failedSources: [] }, new Date(NOW + 24 * 3600_000));
  assert.deepEqual(career((await checkAlerts(NOW + 24 * 3600_000 + 60_000)).sent), [`${CAREER_INGEST_JOB}:recovered`]);
});