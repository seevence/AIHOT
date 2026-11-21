// 岗位收藏的浏览器行为：详情页与岗位列表点「收藏」后，/starred 出现该岗位；点「移除」后消失；
// 整页重新打开后收藏仍在（localStorage 持久化）。真实生产 server + chromium，fakeApi 只提供岗位数据；
// 收藏只写浏览器，没有后端请求。
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, expect, type Browser } from "@playwright/test";
import { FIXTURE_AT as at, fakeApi, startWebServer, visit, type WebServer } from "./web-server.ts";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const JOB_TITLE = "AI 算法工程师（收藏测试）";
const LIST_ITEM = {
  id: JOB_ID,
  company_name: "示例科技有限公司",
  title: JOB_TITLE,
  role_family: "ai_algorithm",
  locations: ["北京", "上海"],
  employment_type: "campus",
  student_friendly: "yes",
  skills: ["python"],
  published_at: at,
  first_seen_at: at,
  last_seen_at: at,
  official_url: "https://example.org/jobs/job-favorites",
};
const jobList = {
  contract_version: "0.1",
  data_origin: "live",
  items: [LIST_ITEM],
  page: 1,
  page_size: 20,
  total: 1,
  as_of: at,
  filters: { page: 1, page_size: 20 },
};
const jobDetail = {
  contract_version: "0.1",
  data_origin: "live",
  job: {
    ...LIST_ITEM,
    source_key: "fixture",
    job_key: "job-favorites",
    degree: "bachelor",
    degree_raw: null,
    experience_min_years: null,
    experience_max_years: null,
    experience_raw: null,
    skill_evidence: [{ skill_id: "python", evidence_text: "固定职位文本：使用 Python。" }],
    collector_version: "fixture",
  },
  observations: [],
  notice: "固定说明：仅供测试。",
};
const api = fakeApi((url) => {
  if (url.pathname === "/api/site/career-insights/jobs") return jobList;
  if (url.pathname === `/api/site/career-insights/jobs/${JOB_ID}`) return jobDetail;
  return undefined;
});

let web: WebServer;
let chrome: Browser;
before(async () => {
  const started = await Promise.allSettled([startWebServer(api).then((server) => { web = server; }), chromium.launch({ channel: "chromium" }).then((browser) => { chrome = browser; })]);
  for (const result of started) if (result.status === "rejected") throw result.reason;
});
after(async () => {
  await chrome?.close();
  await web?.stop();
});

/** 打开一个页面并收集它报的错：首屏 hydration 出错会以 console error 出现在这里。 */
async function openPage() {
  const context = await chrome.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  // 站点图标 404 与收藏无关；hydration 不一致会以 React 的 console error 出现，必须为空。
  page.on("console", (message) => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(String(error)));
  return { context, page, errors };
}

test("starring a job on its detail page lists it on /starred, and 移除 removes it", async () => {
  const { context, page, errors } = await openPage();
  try {
    await visit(page, `${web.origin}/career-insights/jobs/${JOB_ID}`);
    const detailStar = page.locator("[data-job-star]");
    await expect(detailStar).toHaveText("收藏");
    await expect(detailStar).toHaveAttribute("aria-pressed", "false");
    await expect(detailStar).toHaveAttribute("data-job-star", "off");

    await detailStar.click();
    await expect(detailStar).toHaveText("已收藏");
    await expect(detailStar).toHaveAttribute("data-job-star", "on");
    await expect(detailStar).toHaveAttribute("aria-pressed", "true");

    await visit(page, `${web.origin}/starred`);
    const block = page.locator("[data-starred-jobs]");
    await expect(block.getByRole("heading", { level: 2, name: "收藏的岗位" })).toBeVisible();
    const row = block.locator(`[data-starred-job="${JOB_ID}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(JOB_TITLE);
    await expect(row).toContainText("示例科技有限公司");
    await expect(row).toContainText("北京、上海");
    await expect(row).toContainText("AI 算法");
    await expect(row.getByRole("link", { name: JOB_TITLE })).toHaveAttribute("href", `/career-insights/jobs/${JOB_ID}`);

    // 重新打开 /starred 是一次新的页面加载：收藏仍然在（localStorage 持久化）。
    await visit(page, `${web.origin}/starred`);
    await expect(page.locator(`[data-starred-job="${JOB_ID}"]`)).toBeVisible();

    await page.getByRole("button", { name: `移除收藏：${JOB_TITLE}` }).click();
    await expect(page.locator(`[data-starred-job="${JOB_ID}"]`)).toHaveCount(0);
    await expect(block).toContainText("还没有收藏的岗位，在热门岗位或职位详情点收藏");

    // 回到详情页，按钮已恢复未收藏。
    await visit(page, `${web.origin}/career-insights/jobs/${JOB_ID}`);
    await expect(page.locator("[data-job-star]")).toHaveAttribute("data-job-star", "off");
    assert.deepEqual(errors, [], "hydration must not log errors");
  } finally {
    await context.close();
  }
});

test("starring a job on a list row has the same effect and survives a reload", async () => {
  const { context, page, errors } = await openPage();
  try {
    await visit(page, `${web.origin}/career-insights/jobs`);
    const rowStar = page.locator(`[data-catalog-job="${JOB_ID}"] [data-job-star]`);
    await expect(rowStar).toHaveText("收藏");
    await expect(rowStar).toHaveAttribute("data-job-star", "off");
    await rowStar.click();
    await expect(rowStar).toHaveText("已收藏");
    await expect(rowStar).toHaveAttribute("data-job-star", "on");

    await visit(page, `${web.origin}/starred`);
    await expect(page.locator(`[data-starred-job="${JOB_ID}"]`)).toBeVisible();

    // 重新打开岗位列表，compact 按钮从 localStorage 恢复为已收藏。
    await visit(page, `${web.origin}/career-insights/jobs`);
    const reloadedStar = page.locator(`[data-catalog-job="${JOB_ID}"] [data-job-star]`);
    await expect(reloadedStar).toHaveText("已收藏");
    await expect(reloadedStar).toHaveAttribute("data-job-star", "on");

    // 同一份收藏在详情页也是已收藏状态。
    await visit(page, `${web.origin}/career-insights/jobs/${JOB_ID}`);
    await expect(page.locator("[data-job-star]")).toHaveText("已收藏");
    assert.deepEqual(errors, [], "hydration must not log errors");
  } finally {
    await context.close();
  }
});