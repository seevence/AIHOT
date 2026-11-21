// 本地备份/恢复脚本（P1-5）：不依赖对象存储。这里只测不碰数据库的纯逻辑：参数解析、备份名时间戳、
// 保留策略（只清理脚本自己命名的 dump，不碰引擎备份）与连接串的凭据处理（密码不进 argv）。
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import {
  DEFAULT_KEEP,
  backupStamp,
  backupsDir,
  parseBackupArgs,
  pgEnvironment,
  selectBackups,
} from "../scripts/backup-local.ts";
import { parseRestoreArgs } from "../scripts/restore-local.ts";

test("backup-local 默认：DATABASE_URL / AIHOT_DATA_DIR 生效，保留 7 份", () => {
  const options = parseBackupArgs([], { DATABASE_URL: "postgres://u:p@127.0.0.1:5432/aihot", AIHOT_DATA_DIR: "D:\\data" });
  assert.equal(options.keep, DEFAULT_KEEP);
  assert.equal(options.keep, 7);
  assert.equal(options.databaseUrl, "postgres://u:p@127.0.0.1:5432/aihot");
  assert.equal(options.dir, path.join(path.resolve("D:\\data"), "backups"));
  assert.equal(backupsDir({ AIHOT_DATA_DIR: "D:\\data" }), path.join(path.resolve("D:\\data"), "backups"));
});

test("backup-local 参数：--database-url / --keep / --dir，非法值报错", () => {
  const options = parseBackupArgs(["--database-url", "postgres://127.0.0.1:5432/x", "--keep", "14", "--dir", ".data/backups"]);
  assert.equal(options.databaseUrl, "postgres://127.0.0.1:5432/x");
  assert.equal(options.keep, 14);
  assert.equal(options.dir, path.resolve(".data/backups"));
  assert.equal(parseBackupArgs(["--help"]).help, true);
  for (const argv of [["--keep", "0"], ["--keep", "abc"], ["--database-url"], ["--nope"]]) {
    assert.throws(() => parseBackupArgs(argv), /--keep|需要一个值|未知参数/);
  }
});

test("备份名是 UTC 时间戳，同一秒稳定", () => {
  assert.equal(backupStamp(new Date("2026-11-21T06:30:12.345Z")), "20261121T063012Z");
  assert.match(backupStamp(new Date()), /^\d{8}T\d{6}Z$/);
});

test("保留策略：只挑脚本命名的 dump，新的在前，保留最近 N 份", () => {
  const names = [
    "20261119T040000Z.dump",
    "20261120T040000Z.dump",
    "20261121T040000Z.dump",
    "aihot-20261121-0400.dump", // 引擎备份，不能删
    "20261121T040000Z.dump.partial",
    "notes.txt",
  ];
  assert.deepEqual(selectBackups(names, 2), {
    keep: ["20261121T040000Z.dump", "20261120T040000Z.dump"],
    remove: ["20261119T040000Z.dump"],
  });
  assert.deepEqual(selectBackups(names, 7), {
    keep: ["20261121T040000Z.dump", "20261120T040000Z.dump", "20261119T040000Z.dump"],
    remove: [],
  });
});

test("连接串：用户名密码进 PGUSER/PGPASSWORD，不出现在 argv；其余参数原样保留", () => {
  const { url, env } = pgEnvironment(
    "postgres://aihot:s3%40cret@db.example:5432/aihot?sslmode=require&user=alt%40user&password=p%40ss",
    { PATH: "/usr/bin" },
  );
  assert.equal(env.PGUSER, "alt@user");
  assert.equal(env.PGPASSWORD, "p@ss");
  assert.equal(env.PATH, "/usr/bin");
  assert.ok(!url.includes("s3%40cret"), "密码不能留在命令行 URL 里");
  assert.ok(!url.includes("aihot:"));
  assert.equal(url, "postgres://db.example:5432/aihot?sslmode=require");
});

test("restore-local 默认只预览、不执行；加 --yes 才算确认", () => {
  assert.deepEqual(parseRestoreArgs([".data/backups/20261121T063012Z.dump"], {}), {
    help: false,
    dump: ".data/backups/20261121T063012Z.dump",
    databaseUrl: "postgres://127.0.0.1:5432/aihot",
    yes: false,
  });
  const confirmed = parseRestoreArgs(["--database-url", "postgres://127.0.0.1:5432/aihot_restore_test", "--yes", "dump.dump"]);
  assert.equal(confirmed.yes, true);
  assert.equal(confirmed.dump, "dump.dump");
  assert.equal(confirmed.databaseUrl, "postgres://127.0.0.1:5432/aihot_restore_test");
  assert.throws(() => parseRestoreArgs(["a.dump", "b.dump"]), /只能指定一个/);
  assert.throws(() => parseRestoreArgs(["--nope"]), /未知参数/);
});