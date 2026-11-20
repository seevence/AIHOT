// 就业热点三个只读接口的前端接入，standalone：loader 的地址与参数、信号卡、热度榜空态、
// 日报无采集文案都在这里断言，不连数据库，也不需要 Web 进程。
// 路由文件是 JSX，Node 不能直接执行；可测的渲染与口径都在 modules/career-insights/web/ 的 .ts 里，
// 由路由与这里共用同一份实现。
import assert from "node:assert/strict";
import { once } from "node:events";
import { after, test } from "node:test";
import * as cheerio from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import type { CareerDailyResponseV1, CareerHotEntryV1, CareerSignalV1 } from "../contracts/index.ts";
import { FIXTURE_DAILY_V1, FIXTURE_HOT_V1, FIXTURE_SIGNALS_V1 } from "../fixtures/api.ts";
import { CareerSignals } from "../web/components/CareerSignals.ts";
import { CareerHotList } from "../web/components/CareerHotList.ts";
import { CareerDailyReport } from "../web/components/CareerDailyReport.ts";

const FIXTURE_PORT = 3102;
process.env.CAREER_FIXTURE_PORT = String(FIXTURE_PORT);
process.env.API_BASE_URL = `http://127.0.0.1:${FIXTURE_PORT}`;

const { fixtureServer, feedRequests } = await import("../web/fixture-server.ts");
const { loadCareerDaily, loadCareerHot, loadCareerSignals } = await import("../web/feeds.server.ts");

if (!fixtureServer.listening) await once(fixtureServer, "listening");
after(() => new Promise<void>((resolve) => {
  fixtureServer.closeAllConnections();
  fixtureServer.close(() => resolve());
}));

function render(page: ReturnType<typeof createElement>): cheerio.CheerioAPI {
  return cheerio.load(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/"] }, page)));
}

test("the three loaders ask the feed API with their own parameters", async () => {
  feedRequests.length = 0;
  const signals = await loadCareerSignals();
  const hot = await loadCareerHot();
  const daily = await loadCareerDaily();

  assert.deepEqual(
    feedRequests.map((request) => [request.pathname, request.params.toString()]),
    [
      ["/api/site/career-insights/signals", "limit=5"],
      ["/api/site/career-insights/hot", "limit=10"],
      ["/api/site/career-insights/daily", ""],
    ],
  );
  assert.equal(signals.signals.length, 3);
  assert.equal(hot.entries.length, 2);
  assert.equal(hot.window_days, 30);
  assert.equal(daily.has_run, true);
});

test("the signal card renders rule, company, title and the backend's reason with a job link", () => {
  const html = render(createElement(CareerSignals, { signals: FIXTURE_SIGNALS_V1.signals, skipped: FIXTURE_SIGNALS_V1.skipped }));
  const items = html("[data-signal-item]");
  assert.equal(items.length, 3);

  const expected: Array<[CareerSignalV1, string]> = [
    [FIXTURE_SIGNALS_V1.signals[0], "跨界组合"],
    [FIXTURE_SIGNALS_V1.signals[1], "新职族首现"],
    [FIXTURE_SIGNALS_V1.signals[2], "技能错配"],
  ];
  for (const [signal, ruleLabel] of expected) {
    const item = items.filter((_, element) => html(element).attr("data-signal-item") === signal.rule).first();
    assert.equal(item.length, 1, `no signal card for ${signal.rule}`);
    assert.equal(item.find(`[data-signal-rule='${signal.rule}']`).text(), ruleLabel);
    assert.equal(item.find("[data-signal-company]").text(), signal.company);
    assert.equal(item.find("[data-signal-title]").text(), signal.job_title);
    assert.equal(item.find("[data-signal-reason]").text(), signal.reason_text);
    assert.equal(item.find("a").attr("href"), `/career-insights/jobs/${signal.job_id}`);
  }

  assert.equal(
    html("[data-signals-skipped]").text(),
    "另有 1 家公司因历史不足 2 天暂无法判定突增",
  );
});

test("the signal card explains an empty result instead of inventing one", () => {
  const html = render(createElement(CareerSignals, { signals: [], skipped: [] }));
  assert.equal(html("[data-signal-item]").length, 0);
  const empty = html("[data-signals-empty]");
  assert.equal(empty.length, 1);
  assert.match(empty.text(), /当前样本下暂未发现异常信号/);
  assert.match(empty.text(), /需要更多来源与更长历史/);
  assert.equal(html("[data-signals-skipped]").length, 0);
});

test("the hot list shows the top three role families and a dash for a missing publish date", () => {
  const withMissingDate = FIXTURE_HOT_V1.entries[1]!;
  const html = render(createElement(CareerHotList, { entries: FIXTURE_HOT_V1.entries }));
  const entries = html("[data-hot-entry]");
  assert.equal(entries.length, 2);

  const first = entries.first();
  assert.equal(first.find("[data-hot-company]").text(), "虚构样例科技有限公司");
  assert.equal(first.find("[data-hot-job-count]").text(), "12");
  assert.equal(first.find("[data-hot-family]").length, 3);
  assert.equal(first.find("[data-hot-family]").first().text(), "AI 算法 5");
  assert.equal(first.find("[data-hot-latest]").text(), "2026年1月1日 17:00");

  const second = entries.last();
  assert.equal(second.find("[data-hot-company]").text(), withMissingDate.company);
  assert.equal(second.find("[data-hot-latest]").text(), "—");
});

test("an empty hot list keeps the site's way into the career insights page", () => {
  const html = render(createElement(CareerHotList, { entries: [] as CareerHotEntryV1[] }));
  assert.equal(html("[data-hot-entry]").length, 0);
  const empty = html("[data-hot-empty]");
  assert.equal(empty.length, 1);
  assert.match(empty.text(), /本站内容暂未接入/);
  const link = empty.find("a").filter((_, element) => empty.find(element).text() === "就业趋势洞察").first();
  assert.ok(link.length > 0, "no link to 就业趋势洞察");
  assert.equal(link.attr("href"), "/career-insights");
});

test("the daily report says today has not been collected yet when there was no run", () => {
  const noRun: CareerDailyResponseV1 = { ...FIXTURE_DAILY_V1, has_run: false, sources: [] };
  const html = render(createElement(CareerDailyReport, { daily: noRun }));
  assert.equal(html("[data-daily-no-run]").text(), "今日尚未采集");
  assert.equal(html("[data-daily-source]").length, 0);
});

test("the daily report shows the date, each source and the unknown-skill share", () => {
  const html = render(createElement(CareerDailyReport, { daily: FIXTURE_DAILY_V1 }));
  assert.equal(html("[data-daily-date]").attr("datetime"), FIXTURE_DAILY_V1.date);
  assert.equal(html("[data-daily-no-run]").length, 0);

  const sources = html("[data-daily-source]");
  assert.equal(sources.length, 2);
  const first = sources.first();
  assert.equal(first.find("[data-daily-collected]").text(), "20");
  assert.equal(first.find("[data-daily-accepted]").text(), "15");
  assert.equal(first.find("[data-daily-updated]").text(), "3");
  assert.equal(first.find("[data-daily-duplicates]").text(), "2");
  assert.equal(first.find("[data-daily-status]").text(), "正常");
  assert.equal(sources.last().find("[data-daily-status]").text(), "部分失败");

  assert.match(html.text(), /空技能岗位占比/);
  assert.match(html.text(), /12\.5%/);
});