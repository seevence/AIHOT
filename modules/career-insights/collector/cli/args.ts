export const PAGES_FLAG = "--pages";
export const PAGE_LIMIT_MIN = 1;
export const PAGE_LIMIT_MAX = 10;
export const DEFAULT_PAGE_LIMIT = 1;

export class CliArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliArgumentError";
  }
}

const INTEGER_PATTERN = /^\d+$/;

/**
 * 解析 `--pages N`。缺省返回 DEFAULT_PAGE_LIMIT（保持每源首屏的既有口径）；
 * 非法值直接抛错，不做静默回退。
 */
export function parsePageLimit(argv: readonly string[]): number {
  const index = argv.indexOf(PAGES_FLAG);
  if (index === -1) {
    return DEFAULT_PAGE_LIMIT;
  }
  const raw = argv[index + 1];
  if (raw === undefined || raw.startsWith("--")) {
    throw new CliArgumentError(`${PAGES_FLAG} 需要 ${PAGE_LIMIT_MIN}..${PAGE_LIMIT_MAX} 的整数`);
  }
  if (!INTEGER_PATTERN.test(raw)) {
    throw new CliArgumentError(`${PAGES_FLAG} 只接受整数，收到 "${raw}"`);
  }
  const value = Number(raw);
  if (value < PAGE_LIMIT_MIN || value > PAGE_LIMIT_MAX) {
    throw new CliArgumentError(`${PAGES_FLAG} 超出范围 ${PAGE_LIMIT_MIN}..${PAGE_LIMIT_MAX}，收到 "${raw}"`);
  }
  return value;
}