// 从 backup-local.ts 的 dump 恢复数据库：pg_restore --clean --if-exists 覆盖目标库。
// 默认只打印将要做的事、不执行；加 --yes 才真的恢复。恢复前请确认目标库名（会用备份内容覆盖它）。
//
// 用法：
//   node scripts/restore-local.ts <dump 文件> --database-url postgres://... --yes
//   node scripts/restore-local.ts .data/backups/20261121T063012Z.dump --database-url postgres://127.0.0.1:5432/aihot_test --yes
// 连接串也可以放 DATABASE_URL。目标库必须已存在；恢复不会创建数据库。
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { DEFAULT_DATABASE_URL, pgEnvironment } from "./backup-local.ts";

const run = promisify(execFile);

export interface RestoreOptions {
  help: boolean;
  dump: string | null;
  databaseUrl: string;
  yes: boolean;
}

export function parseRestoreArgs(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): RestoreOptions {
  const options: RestoreOptions = {
    help: false,
    dump: null,
    databaseUrl: env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
    yes: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith("--")) throw new Error(`${arg} 需要一个值`);
      return next;
    };
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--database-url") options.databaseUrl = value();
    else if (arg === "--yes") options.yes = true;
    else if (arg.startsWith("--")) throw new Error(`未知参数：${arg}`);
    else if (options.dump !== null) throw new Error(`只能指定一个 dump 文件（已有 ${options.dump}，又给了 ${arg}）`);
    else options.dump = arg;
  }
  return options;
}

function databaseName(databaseUrl: string): string {
  return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, "")) || "(默认库)";
}

function usage(): string {
  return [
    "从本地备份恢复数据库（pg_restore --clean --if-exists），会覆盖目标库。",
    "",
    "用法：node scripts/restore-local.ts <dump 文件> [--database-url <连接串>] --yes",
    "",
    "  --database-url  默认取 DATABASE_URL，再默认 postgres://127.0.0.1:5432/aihot",
    "  --yes           确认执行；不加时只显示将要恢复的库和文件，什么都不改",
    "",
    "提示：先恢复到一个临时库（如 xxx_test）演练，确认数据无误后再对正式库执行。",
  ].join("\n");
}

async function main(): Promise<void> {
  const options = parseRestoreArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (options.dump === null) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  const dump = path.resolve(options.dump);
  const info = await stat(dump).catch(() => null);
  if (info === null || !info.isFile()) {
    console.error(`找不到备份文件：${dump}`);
    process.exitCode = 1;
    return;
  }
  const target = databaseName(options.databaseUrl);
  console.log(`将把 ${dump}（${info.size} 字节）恢复到数据库 ${target}，--clean --if-exists 会覆盖同名对象。`);
  if (!options.yes) {
    console.log("未执行：确认目标库无误后加 --yes 再运行。");
    return;
  }
  const connection = pgEnvironment(options.databaseUrl);
  await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--dbname", connection.url, dump], {
    env: connection.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  console.log(`恢复完成：${dump} -> ${target}。请检查关键表的行数与应用的 /api/health。`);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(`恢复失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
