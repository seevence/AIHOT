// Policy list page, standalone: the fixture API answers the policies route, and the rendered list is
// asserted without a database. The page's loader lives beside JSX that Node cannot run directly, so the
// address it builds (policyApiPath) and the query parsing are asserted here directly.
import assert from "node:assert/strict";
import { once } from "node:events";
import { after, test } from "node:test";
import * as cheerio from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { FIXTURE_POLICY_LIST_V1 } from "../fixtures/api.ts";
import {
  POLICY_PAGE_SIZE,
  buildPoliciesHref,
  parsePolicyFilters,
  policyApiPath,
  type PolicyListResponse,
  type PolicyPageFilters,
} from "../web/policy.ts";
import { PolicyList } from "../web/components/PolicyList.ts";
import { fixtureServer, policyRequests } from "../web/fixture-server.ts";

const FIXTURE_ORIGIN = "http://127.0.0.1:3101";
const FILTERS: PolicyPageFilters = { page: 1, page_size: POLICY_PAGE_SIZE };
const POLICIES = "/career-insights/policies";

if (!fixtureServer.listening) await once(fixtureServer, "listening");
after(() => new Promise<void>((resolve) => {
  fixtureServer.closeAllConnections();
  fixtureServer.close(() => resolve());
}));

function render(policies: PolicyListResponse, filters: PolicyPageFilters): cheerio.CheerioAPI {
  const html = renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [POLICIES] }, createElement(PolicyList, { policies, filters })),
  );
  return cheerio.load(html);
}

function hrefOf(html: cheerio.CheerioAPI, label: string): URL {
  const link = html("a").filter((_, element) => html(element).text() === label).first();
  assert.ok(link.length > 0, `no link labelled ${label}`);
  return new URL(link.attr("href") ?? "", "http://site.local");
}

test("the list renders every policy with its issuer, date and official link", () => {
  const html = render(FIXTURE_POLICY_LIST_V1, FILTERS);
  const rows = html("[data-policy-item]");
  assert.equal(rows.length, 6);
  assert.equal(rows.filter((_, element) => html(element).text().includes("示例国家部门")).length, 2);

  const links = html("[data-policy-link]");
  assert.equal(links.length, 6);
  links.each((_, element) => {
    const link = html(element);
    assert.match(link.attr("href") ?? "", /^https:\/\/example\.com\/policies\//);
    assert.equal(link.attr("target"), "_blank");
    assert.equal(link.attr("rel"), "noopener noreferrer");
  });

  assert.match(html("[data-policy-item]").first().text(), /2026/);
  assert.match(html("[data-source-tier]").first().text(), /政府官网/);
  assert.match(html("[data-policy-item]").first().text(), /主题：人工智能、人才培养/);
});

test("source and theme filters link to the page with the other filter kept", () => {
  const html = render(FIXTURE_POLICY_LIST_V1, { ...FILTERS, source_key: "ndrc-policy" });
  const source = hrefOf(html, "国家发展改革委政策发布");
  assert.equal(source.pathname, POLICIES);
  assert.equal(source.searchParams.get("source_key"), "ndrc-policy");
  assert.equal(source.searchParams.get("page"), "1");
  assert.equal(source.searchParams.get("page_size"), String(POLICY_PAGE_SIZE));

  const theme = hrefOf(html, "人才培养");
  assert.equal(theme.searchParams.get("theme"), "talent_development");
  assert.equal(theme.searchParams.get("source_key"), "ndrc-policy");
  assert.equal(theme.searchParams.get("page"), "1");
  assert.equal(theme.searchParams.get("page_size"), String(POLICY_PAGE_SIZE));

  const allThemes = html('[data-filter-group="主题"] a').filter((_, element) => html(element).text() === "全部");
  const cleared = new URL(allThemes.first().attr("href") ?? "", "http://site.local");
  assert.equal(cleared.searchParams.get("theme"), null);
  assert.equal(cleared.searchParams.get("source_key"), "ndrc-policy");
});

test("no policies under the current filters shows the empty state", () => {
  const html = render(
    { ...FIXTURE_POLICY_LIST_V1, items: [], total: 0, filters: { ...FILTERS, source_key: "ndrc-policy" } },
    { ...FILTERS, source_key: "ndrc-policy" },
  );
  assert.match(html("body").text(), /当前筛选下暂无政策/);
  assert.equal(hrefOf(html, "清除筛选").pathname, POLICIES);
  assert.equal(hrefOf(html, "清除筛选").searchParams.get("source_key"), null);
});

test("pagination and the API address keep the page size and filters", () => {
  const filters: PolicyPageFilters = {
    page: 2,
    page_size: POLICY_PAGE_SIZE,
    source_key: "ndrc-policy",
    theme: "talent_development",
  };
  const href = new URL(buildPoliciesHref(filters), "http://site.local");
  assert.equal(href.pathname, POLICIES);
  assert.equal(href.searchParams.get("page"), "2");
  assert.equal(href.searchParams.get("page_size"), "20");
  assert.equal(href.searchParams.get("source_key"), "ndrc-policy");
  assert.equal(href.searchParams.get("theme"), "talent_development");

  const parsed = parsePolicyFilters(
    new URLSearchParams("page=2&page_size=50&source_key=ndrc-policy&theme=talent_development"),
  );
  assert.deepEqual(parsed, filters);
  assert.equal(
    policyApiPath(parsed),
    "/policies?source_key=ndrc-policy&theme=talent_development&page=2&page_size=20",
  );
});

test("unknown filters are dropped and the page falls back to the first page", () => {
  assert.deepEqual(parsePolicyFilters(new URLSearchParams("page=0&source_key=unknown-source&theme=unknown")), {
    page: 1,
    page_size: POLICY_PAGE_SIZE,
  });
});

test("the fixture API serves the policy list and rejects parameters the backend rejects", async () => {
  const response = await fetch(`${FIXTURE_ORIGIN}/api/site/career-insights/policies?page=2&page_size=20&source_key=ndrc-policy&theme=talent_development`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as PolicyListResponse;
  assert.equal(body.items.length, 6);
  assert.equal(body.page, 2);
  assert.equal(body.page_size, 20);
  assert.deepEqual(body.filters, { page: 2, page_size: 20, source_key: "ndrc-policy", theme: "talent_development" });
  assert.deepEqual(policyRequests.at(-1)?.get("page"), "2");

  const badPage = await fetch(`${FIXTURE_ORIGIN}/api/site/career-insights/policies?page=99999`);
  assert.equal(badPage.status, 400);
  const badSource = await fetch(`${FIXTURE_ORIGIN}/api/site/career-insights/policies?source_key=unknown-source`);
  assert.equal(badSource.status, 400);
});