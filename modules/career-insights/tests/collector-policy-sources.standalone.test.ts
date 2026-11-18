import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  GOV_POLICY_LIST_URL,
  MOE_POLICY_LIST_URL,
  NDRC_POLICY_LIST_URL,
  createGovPolicySourceAdapter,
  createMoePolicySourceAdapter,
  createNdrcPolicySourceAdapter,
} from "../collector/adapters/policy-sources.ts";
import {
  parseGovPolicyList,
  parseMoePolicyList,
  parseNdrcPolicyList,
} from "../collector/adapters/policy-parse.ts";
import type { FetchTransport, TransportResponse } from "../collector/fetch/transport.ts";

const SAMPLES = join(dirname(fileURLToPath(import.meta.url)), "../collector/evidence/samples");

function response(body: string, url: string): TransportResponse {
  return {
    status: 200,
    requestUrl: url,
    finalUrl: url,
    contentType: "text/html; charset=utf-8",
    headers: { "content-type": "text/html; charset=utf-8" },
    body: Buffer.from(body),
    fetchedAt: "2026-11-18T08:00:00.000Z",
  };
}

async function sampleHtml(sourceKey: string, name: string): Promise<string> {
  return readFile(join(SAMPLES, sourceKey, "samples", name), "utf8");
}

async function transportFor(sourceKey: string, listUrl: string): Promise<FetchTransport> {
  const listHtml = await sampleHtml(sourceKey, "list.html");
  const parser =
    sourceKey === "state-council-policy"
      ? parseGovPolicyList
      : sourceKey === "ndrc-policy"
        ? parseNdrcPolicyList
        : parseMoePolicyList;
  const urls = parser(listHtml, listUrl)
    .slice(0, 3)
    .map((item) => item.url);
  const details = new Map<string, string>();
  for (let index = 0; index < urls.length; index += 1) {
    details.set(urls[index] as string, await sampleHtml(sourceKey, `detail-${index + 1}.html`));
  }

  return {
    async fetchPage(request) {
      const detail = details.get(request.url);
      if (detail !== undefined) return response(detail, request.url);
      if (request.url === listUrl) return response(listHtml, request.url);
      throw new Error(`未准备的请求：${request.url}`);
    },
  };
}

test("国务院政策适配器复用 PolicyEvidenceRefV1，产出 3 条", async () => {
  const transport = await transportFor("state-council-policy", GOV_POLICY_LIST_URL);
  const adapter = createGovPolicySourceAdapter(transport, {
    itemLimit: 3,
    sleep: async () => undefined,
  });

  const policies = await adapter.collect();
  assert.equal(policies.length, 3);
  for (const policy of policies) {
    assert.ok(policy.policy_item_id.length > 0);
    assert.ok(policy.title.length > 3);
    assert.ok(policy.issuer.length > 0);
    assert.match(policy.published_at, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(policy.source_tier, "national");
    assert.match(policy.official_url, /^https:\/\/www\.gov\.cn\//);
    assert.ok(Array.isArray(policy.theme_ids));
    assert.ok(policy.evidence_excerpt.length > 0);
    assert.ok(policy.evidence_excerpt.length <= 200);
  }
});

test("发改委政策适配器产出 3 条且发布机关固定", async () => {
  const transport = await transportFor("ndrc-policy", NDRC_POLICY_LIST_URL);
  const adapter = createNdrcPolicySourceAdapter(transport, {
    itemLimit: 3,
    sleep: async () => undefined,
  });

  const policies = await adapter.collect();
  assert.equal(policies.length, 3);
  for (const policy of policies) {
    assert.equal(policy.issuer, "国家发展改革委");
    assert.match(policy.published_at, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(policy.official_url, /^https:\/\/www\.ndrc\.gov\.cn\/xxgk\/zcfb\/tz\//);
    assert.ok(policy.evidence_excerpt.length > 0);
  }
});

test("政治主题按共享词典标注，且不超过 3 个", async () => {
  const transport = await transportFor("state-council-policy", GOV_POLICY_LIST_URL);
  const adapter = createGovPolicySourceAdapter(transport, {
    itemLimit: 3,
    sleep: async () => undefined,
  });
  const policies = await adapter.collect();
  for (const policy of policies) {
    assert.ok(policy.theme_ids.length <= 3);
  }
});
test("教育部政策适配器复用 PolicyEvidenceRefV1，产出 3 条", async () => {
  const transport = await transportFor("moe-policy", MOE_POLICY_LIST_URL);
  const adapter = createMoePolicySourceAdapter(transport, {
    itemLimit: 3,
    sleep: async () => undefined,
  });

  const policies = await adapter.collect();
  assert.equal(policies.length, 3);
  for (const policy of policies) {
    assert.equal(policy.issuer, "教育部");
    assert.match(policy.published_at, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(policy.official_url, /^https:\/\/www\.moe\.gov\.cn\//);
    assert.ok(policy.evidence_excerpt.length > 0);
  }
});