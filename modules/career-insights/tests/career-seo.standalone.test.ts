/// <reference lib="dom" />
// 岗位与 career 页面的搜索元数据，standalone：页面是 JSX（Node 不能直接跑），meta 与 JobPosting 的
// 构造放在 web/seo.ts，这里断言页面 meta 实际返回的那组标签。要点：标题接站名、描述只用库里的真实字段、
// canonical 带岗位 id；JobPosting 字段正确且不写 validThrough；联调样例（虚构数据）不输出结构化数据也不索引。
// sitemap 条目（backend/sitemap.ts）在这里用注入的假行断言：三个索引页、每个存在的岗位、上限 5000。
import assert from "node:assert/strict";
import { test } from "node:test";
import { SITE } from "@aihot/site";
import type { JobDetailResponseV1 } from "../contracts/api.ts";
import { FIXTURE_JOB_DETAIL_V1 } from "../fixtures/api.ts";
import { SITEMAP_JOB_LIMIT, careerSitemapEntries } from "../backend/sitemap.ts";
import {
  DASHBOARD_PATH,
  POLICIES_PATH,
  careerDashboardMeta,
  careerPoliciesMeta,
  jobDescription,
  jobDetailPath,
  jobMeta,
  jobPostingDescription,
  jobPostingLd,
} from "../web/seo.ts";

type Tag = Record<string, unknown>;
const tagsOf = (meta: unknown): Tag[] => meta as Tag[];

function titleOf(tags: Tag[]): string {
  const tag = tags.find((candidate) => typeof candidate.title === "string");
  assert.ok(tag, "no <title> tag");
  return tag.title as string;
}

function descriptionOf(tags: Tag[]): string {
  const tag = tags.find((candidate) => candidate.name === "description");
  assert.ok(tag, "no meta description");
  return tag.content as string;
}

function canonicalOf(tags: Tag[]): string {
  const tag = tags.find((candidate) => candidate.tagName === "link" && candidate.rel === "canonical");
  assert.ok(tag, "no canonical link");
  return tag.href as string;
}

function robotsOf(tags: Tag[]): string | undefined {
  return tags.find((candidate) => candidate.name === "robots")?.content as string | undefined;
}

function jsonLdOf(tags: Tag[]): Record<string, unknown> | null {
  const tag = tags.find((candidate) => candidate["script:ld+json"] !== undefined);
  return tag ? (tag["script:ld+json"] as Record<string, unknown>) : null;
}

/** 可索引的真实岗位（fixture 的形状，但 data_origin 是 live）。 */
const LIVE: JobDetailResponseV1 = { ...FIXTURE_JOB_DETAIL_V1, data_origin: "live" };

test("职位详情 meta：标题是职位名接站名，描述只用库里的真实字段，canonical 带 id", () => {
  const tags = tagsOf(jobMeta(LIVE));
  assert.equal(titleOf(tags), `${LIVE.job.title} · ${SITE.name}`);
  assert.equal(new URL(canonicalOf(tags)).pathname, `/career-insights/jobs/${LIVE.job.id}`);
  assert.equal(jobDetailPath(LIVE.job.id), `/career-insights/jobs/${LIVE.job.id}`);

  const description = descriptionOf(tags);
  assert.match(description, /虚构样例科技有限公司/, "company");
  assert.match(description, /虚构市/, "city");
  assert.match(description, /软件 \/ AI 应用开发/, "role family label, not the enum");
  assert.match(description, /实习/, "employment type label");
  assert.match(description, /学生友好：是/);
  assert.match(description, /Python/, "skills by their labels");
  assert.equal(jobDescription(LIVE.job), description);

  assert.equal(robotsOf(tags), "max-image-preview:large", "a real job is indexable");
  assert.equal(tags.some((tag) => tag.name === "googlebot"), false);
});

test("JobPosting 结构化数据：标题、datePosted、公司、CN 城市、纯文本描述与 directApply", () => {
  const tags = tagsOf(jobMeta(LIVE));
  const ld = jsonLdOf(tags);
  assert.ok(ld, "live jobs carry JobPosting");
  assert.equal(ld["@context"], "https://schema.org");
  assert.equal(ld["@type"], "JobPosting");
  assert.equal(ld.title, LIVE.job.title);
  assert.equal(ld.datePosted, LIVE.job.first_seen_at, "datePosted is the first observation, as the page shows it");
  assert.deepEqual(ld.hiringOrganization, { "@type": "Organization", name: LIVE.job.company_name });
  assert.deepEqual(ld.jobLocation, {
    "@type": "Place",
    address: { "@type": "PostalAddress", addressCountry: "CN", addressLocality: "虚构市" },
  });
  assert.equal(ld.employmentType, "INTERN");
  assert.equal(ld.directApply, false, "readers apply on the official page");
  assert.equal("validThrough" in ld, false, "no invented expiry: availability is the latest observation");
  assert.equal(new URL(String(ld["@id"])).pathname, `/career-insights/jobs/${LIVE.job.id}`);

  const description = String(ld.description);
  assert.match(description, /招聘岗位：/, "the structured facts head it");
  assert.match(description, /虚构观测摘录/, "the observation excerpt the page also shows");
  assert.doesNotMatch(description, /<[^>]+>/, "plain text, no HTML tags");
  assert.ok(description.length <= 800);
});

test("JobPosting 描述去 HTML、多个城市给数组、没有城市时只给国家", () => {
  const html: JobDetailResponseV1 = {
    ...LIVE,
    observations: [{ ...LIVE.observations[0]!, evidence_excerpt: "<p>负责&nbsp;模型<br/>训练</p>" }],
  };
  const description = jobPostingDescription(html);
  assert.doesNotMatch(description, /<|>|&nbsp/);
  assert.match(description, /负责 模型 训练/);

  const multi = jobPostingLd({ ...LIVE, job: { ...LIVE.job, locations: ["北京", "上海"] } });
  const places = multi?.jobLocation as Array<{ address: { addressCountry: string; addressLocality: string } }>;
  assert.equal(places.length, 2);
  assert.deepEqual(places.map((place) => place.address.addressLocality), ["北京", "上海"]);
  places.forEach((place) => assert.equal(place.address.addressCountry, "CN"));

  const noCity = jobPostingLd({ ...LIVE, job: { ...LIVE.job, locations: [] } });
  const only = noCity?.jobLocation as { address: Record<string, string> };
  assert.equal(only.address.addressCountry, "CN");
  assert.equal("addressLocality" in only.address, false);
});

test("联调样例（synthetic_fixture）不输出 JobPosting，也不让搜索引擎索引", () => {
  assert.equal(jobPostingLd(FIXTURE_JOB_DETAIL_V1), null);
  const tags = tagsOf(jobMeta(FIXTURE_JOB_DETAIL_V1));
  assert.equal(jsonLdOf(tags), null);
  assert.equal(robotsOf(tags), "noindex, follow");
});

test("职业洞察与政策页：标题接站名、描述与 canonical 是页面自己的地址", () => {
  const dash = tagsOf(careerDashboardMeta());
  assert.equal(titleOf(dash), `职业洞察：岗位职族、技能需求与政策动向 · ${SITE.name}`);
  assert.ok(descriptionOf(dash).length > 0);
  assert.equal(new URL(canonicalOf(dash)).pathname, DASHBOARD_PATH);
  assert.equal(robotsOf(dash), "max-image-preview:large");

  const policies = tagsOf(careerPoliciesMeta("live"));
  assert.equal(titleOf(policies), `政策文件：就业与人才培养政策原文汇总 · ${SITE.name}`);
  assert.ok(descriptionOf(policies).length > 0);
  assert.equal(new URL(canonicalOf(policies)).pathname, POLICIES_PATH);
  assert.equal(robotsOf(policies), "max-image-preview:large");
});

test("联调样例不索引职业洞察与政策页", () => {
  for (const tags of [tagsOf(careerDashboardMeta("synthetic_fixture")), tagsOf(careerPoliciesMeta("synthetic_fixture"))]) {
    assert.equal(robotsOf(tags), "noindex, follow");
  }
});

test("sitemap 条目：三个索引页加每个存在的岗位详情，lastmod 是最近观测时间", async () => {
  const latest = new Date("2026-11-20T01:02:03.000Z");
  const entries = await careerSitemapEntries(async () => [
    { id: "16a8e9cb-d603-4c93-a5c6-5ee2f3757dd4", last_seen_at: latest },
    { id: "80607adb-4766-45f9-baa5-5ac9b31b5e7d", last_seen_at: "2026-11-19T00:00:00.000Z" },
  ]);
  assert.deepEqual(entries.map((entry) => entry.loc), [
    "/career-insights",
    "/career-insights/jobs",
    "/career-insights/policies",
    "/career-insights/jobs/16a8e9cb-d603-4c93-a5c6-5ee2f3757dd4",
    "/career-insights/jobs/80607adb-4766-45f9-baa5-5ac9b31b5e7d",
  ]);
  assert.equal(entries[3]!.lastmod?.toISOString(), latest.toISOString());
  assert.equal(entries[4]!.lastmod?.toISOString(), "2026-11-19T00:00:00.000Z");
  const missing = "00000000-0000-4000-8000-000000000000";
  assert.ok(!entries.some((entry) => entry.loc.includes(missing)), "a job that does not exist is never listed");
});

test("sitemap 里不存在岗位：没有岗位时只剩三个索引页", async () => {
  const entries = await careerSitemapEntries(async () => []);
  assert.deepEqual(entries.map((entry) => entry.loc), ["/career-insights", "/career-insights/jobs", "/career-insights/policies"]);
  assert.ok(entries.every((entry) => entry.lastmod === undefined));
});

test("sitemap 岗位 URL 上限 5000，注入更多行也不撑大 sitemap", async () => {
  const rows = Array.from({ length: SITEMAP_JOB_LIMIT + 5 }, (_, index) => ({
    id: `job-${index}`,
    last_seen_at: new Date("2026-11-20T00:00:00.000Z"),
  }));
  const entries = await careerSitemapEntries(async () => rows);
  assert.equal(entries.length, SITEMAP_JOB_LIMIT + 3);
  assert.equal(entries.filter((entry) => entry.loc.startsWith("/career-insights/jobs/")).length, SITEMAP_JOB_LIMIT);
});
