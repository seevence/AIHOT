import assert from "node:assert/strict";
import { test } from "node:test";
import { CliArgumentError, DEFAULT_PAGE_LIMIT, parsePageLimit } from "../collector/cli/args.ts";

test("缺省没有 --pages 时保持首屏口径", () => {
  assert.equal(parsePageLimit(["node", "collect-career.ts", "--live"]), DEFAULT_PAGE_LIMIT);
});

test("--pages 接受 1..10 的整数", () => {
  assert.equal(parsePageLimit(["node", "collect-career.ts", "--live", "--pages", "2"]), 2);
  assert.equal(parsePageLimit(["--pages", "10"]), 10);
  assert.equal(parsePageLimit(["--pages", "1"]), 1);
});

test("--pages 缺失值或非整数显式报错", () => {
  assert.throws(() => parsePageLimit(["--live", "--pages"]), CliArgumentError);
  assert.throws(() => parsePageLimit(["--pages", "--live"]), CliArgumentError);
  assert.throws(() => parsePageLimit(["--pages", "abc"]), CliArgumentError);
  assert.throws(() => parsePageLimit(["--pages", "2.5"]), CliArgumentError);
  assert.throws(() => parsePageLimit(["--pages", ""]), CliArgumentError);
});

test("--pages 超出 1..10 显式报错，不回退默认值", () => {
  assert.throws(() => parsePageLimit(["--pages", "0"]), CliArgumentError);
  assert.throws(() => parsePageLimit(["--pages", "11"]), CliArgumentError);
});