import assert from "node:assert/strict";
import { test } from "node:test";
import { CliArgumentError, DEFAULT_PAGE_LIMIT, parsePageLimit } from "../collector/cli/args.ts";

function isCliArgumentErrorMatching(pattern: RegExp) {
  return (error: unknown) => error instanceof CliArgumentError && pattern.test(error.message);
}

test("缺省没有 --pages 时保持首屏口径", () => {
  assert.equal(parsePageLimit(["node", "collect-career.ts", "--live"]), DEFAULT_PAGE_LIMIT);
});

test("--pages 接受 1..10 的整数", () => {
  assert.equal(parsePageLimit(["node", "collect-career.ts", "--live", "--pages", "2"]), 2);
  assert.equal(parsePageLimit(["--pages", "10"]), 10);
  assert.equal(parsePageLimit(["--pages", "1"]), 1);
});

test("--pages=N 等号写法与空格写法等价", () => {
  assert.equal(parsePageLimit(["--live", "--pages=2"]), 2);
  assert.equal(parsePageLimit(["node", "collect-career.ts", "--live", "--pages=1"]), 1);
  assert.equal(parsePageLimit(["--pages=10"]), 10);
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

test("--pages= 等号空值显式报错且给出具体原因", () => {
  assert.throws(
    () => parsePageLimit(["--live", "--pages="]),
    isCliArgumentErrorMatching(/未提供取值/),
  );
  assert.throws(
    () => parsePageLimit(["--pages="]),
    (error: unknown) => error instanceof CliArgumentError && !/unknown option/i.test(error.message),
  );
});

test("--pages= 等号非整数显式报错且给出具体原因", () => {
  assert.throws(() => parsePageLimit(["--live", "--pages=abc"]), isCliArgumentErrorMatching(/只接受整数/));
  assert.throws(() => parsePageLimit(["--pages=2.5"]), isCliArgumentErrorMatching(/只接受整数/));
  assert.throws(() => parsePageLimit(["--pages=-1"]), isCliArgumentErrorMatching(/只接受整数/));
});

test("--pages= 等号越界显式报错，不回退默认值", () => {
  assert.throws(() => parsePageLimit(["--live", "--pages=0"]), isCliArgumentErrorMatching(/超出范围/));
  assert.throws(() => parsePageLimit(["--pages=11"]), isCliArgumentErrorMatching(/超出范围/));
  assert.throws(
    () => parsePageLimit(["--pages=11"]),
    (error: unknown) => error instanceof CliArgumentError && !/unknown option/i.test(error.message),
  );
});

test("空格与等号写法混用时取首个 --pages 原文", () => {
  assert.equal(parsePageLimit(["--pages=3", "--pages", "5"]), 3);
  assert.equal(parsePageLimit(["--pages", "4", "--pages=9"]), 4);
  assert.equal(parsePageLimit(["--live", "--pages", "2", "--pages=abc"]), 2);
});