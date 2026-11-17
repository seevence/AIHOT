# 角色 D（后端与 API）分支路线图

> 本文件是 `feat/career-api-d2` 分支上的本地路线图副本，基线取自集成分支 `feat/integration` 的 `ROADMAP.md`。
> 基线提交：`21d07eb docs: record green cloud ci`（完整 SHA `21d07eb894ad9e0703a3ba037d5a67177f401d64`，2026-11-17）
> 上一基线：`142e99a ci: run career integration check in docker job`（D1 使用的旧基线，已过期）
> 角色：D：后端与 API；分支 `feat/career-api-d2`；独占写集 `modules/career-insights/{server.ts,backend/**,migrations/**}`
> 独立 worktree：`D:/Codex下载/GitHub项目/seevence/AIHOT-d2`（主工作区保留 B 的未提交采集改动，互不影响）
> 门禁：每阶段完成 → 更新本文件 → 独立 review PASS → 才进入下一阶段；未确认前不并入集成分支、不 push 云端。
> 上游文档：`docs/specs/2026-11-17-career-hot-increment-spec.md`、`docs/specs/2026-11-18-career-hot-design.md`、`docs/specs/tasks.md`

## 本文件的更新位置与时机

- 阶段开始：登记基线 SHA、worktree、本阶段任务清单与受阻项。
- 阶段结束：登记门禁命令的实际输出、review 结论、推送的 commit。
- 云端 `ROADMAP.md` 由 A 维护，本文件**不直接改**它；需要同步的事实写进 PR 描述交给 A。
- 云端约束以 `git show origin/feat/integration:ROADMAP.md` 为准，摘录如下。

### 云端 ROADMAP §6 写集（2026-11-17）

| 角色 | 远程分支 | 独占写集 |
|---|---|---|
| A | `feat/integration` | `package.json`、`module.ts`、`contracts/`、`site/modules/`、`site/package.json`、Dockerfile、协作契约文档 |
| B | `feat/career-collector` | `modules/career-insights/collector/**` |
| C | `feat/career-data-metrics` | `modules/career-insights/{data/**,fixtures/**}` |
| D | `feat/career-api` | `modules/career-insights/{server.ts,backend/**,migrations/**}` |
| E | `feat/career-dashboard` | `modules/career-insights/{web.tsx,web/**}` |

- `site/site.ts`、`site/changelog.json`、`site/brand/**` **未出现在任何角色的写集中**，归属待队长裁定（BLK-01），不得由 D 单方面修改。
- `contracts/**` 属 A；`tests/**`、`scripts/**` 未列入任何写集（BLK-06/BLK-09）。

### 云端 ROADMAP §9 待确认事项（与 D 相关）

- 正式站名与一句话定位未定；不得使用 AIHOT 名称和 Logo（BLK-04）。
- 真实政策源可采集性未确认；`.gov.cn` 本机不可达（BLK-03）。
- C/D 使用真实样本验收契约后，将 `contract_version` 升级为 `1.0`（BLK-09）。
- 评审准确日期、演示时长、现场是否允许联网。

## 阶段划分与状态

| 阶段 | 对应 ROADMAP | 范围 | 状态 | Review |
|---|---|---|---|---|
| D1 | D2 后端部分 | SQL repository（summary/listJobs/jobDetail）、幂等观测写入、`career-insights.ingest` 队列、后端数据库测试 | 已完成 | PASS（2026-11-17） |
| D2 | D2 收尾 | 真实采集数据接入联调、`--require-data` 运行验收、数据库语义与 API v1 冻结前的真实样本验证 | 未开始 | - |
| D3 | D3 | SQL 指标冻结：五项指标真实样本验证、政策 `shared_themes` 接入真实政策证据、证据回溯 | 未开始 | - |
| D4 | D4–D5 | 后端只修缺陷：第二次采集观测验证、性能与错误处理、联调期问题 | 未开始 | - |
| S0 | tasks.md S0 | 云端基线 worktree、路线图登记、基线门禁、写集隔离模板 | 完成，待独立 review | 门禁部分通过（环境缺陷 2 例） |

## 不可妥协约束（摘自共享路线图与开发契约）

- 只消费契约：`@aihot/career-insights/contracts` 的类型、C 的 `validateNormalizedJobV1`、`METRIC_SPECS_V1` 与词典版本；不擅自改变指标口径。
- 写入只接受 C 校验后的 `NormalizedJobV1`；未知值保持 `null` / `unknown` / `[]`，不得解释为 0、不限或“不友好”。
- 分母为 0、单快照、政策证据不足时返回 `insufficient_data` + `value=null`，不得返回 0 冒充结论。
- 唯一职位键 `(source_key, job_key)`；精确观测幂等键 `(job_id, observed_at, content_hash)`；`first_seen_at` 不随后续采集改变，`last_seen_at` 正常推进；不推断下架。
- 公开 API 不返回 `raw_text`、原始 HTML、Cookie、堆栈或密钥；数据库未就绪返回 `503`。
- 不修改 `contracts/`、`data/`、`fixtures/`、`collector/`、`web/`、`web.tsx`、`module.ts`、`site/modules/`、`Dockerfile`、`package-lock.json`（属 A/B/C/E）。
- 不把 fixture 写入正式表；不编造真实数据。
- 阶段完成 → 更新本文件状态与阶段记录 → 独立 review → PASS 后才进入下一阶段。

## 阶段记录

### D1（已完成，独立 review PASS）

- 工作目录：独立 worktree `D:\桌面\huawei\AIHOT-d`，分支 `feat/career-api-d1`（基于 `142e99a`）；与 E 的 `AIHOT-e` 及主工作区隔离，避免共用暂存区。
- 计划：`.codeartsdoer/plans/career-d1-api-sql/design.md`、`task.md`
- 交付：真实 SQL repository、幂等 `ingestBatch`、`career-insights.ingest` 队列、`modules/career-insights/tests/` 后端测试
- 验证：`npx tsc -p modules/tsconfig.json` 通过；`modules/career-insights/tests/*.test.ts` 12/12 通过（临时 PostgreSQL `127.0.0.1:5433`）。
- 联调期修正：`ingestBatch` 的 jsonb 参数改用 `sql.json()`（原 `JSON.stringify` 被 postgres.js 二次编码为 JSON 字符串标量，导致 `@>` 过滤失效与 22023）；summary 空表补齐 `job_family_share` / `skill_demand_share` 的 `insufficient_data` 占位。
- 跨线最小修复（已记录待 A 同步基线）：`data/validate.ts`、`data/metrics.ts` 的 `../contracts` 补 `index.ts` 扩展名，否则 `tsc -p modules` 直接报 TS2834。
- 明确不做：政策 `shared_themes` 真实接入（D3）、HTTP `POST /api/ingest/...`（契约 §8.5 优先进程内写入）、指标口径变更
- 收尾动作：独立 review PASS 后提交到 `feat/career-api-d1`，暂不并入 `feat/career-api` / 集成分支，也不 push；PASS 后才进入 D2- 独立 review：PASS（无 blocker / major）；README 与无效测试断言的增量复核同样 PASS。review 实跑 `tsc -p modules` 通过、12/12 测试通过。
- 遗留到后续阶段（非 D1 缺陷）：① `docs/development-contract.md` 中 C-INGEST 拒绝消息写 `code:message`，实际 `ValidationIssueV1` 只有 `path`，需 A 修正契约文本；② 开发契约 §6.3 未识别技能比例与 §6.5 来源覆盖变化校验，D1 已显式延期，D3 签署时确认；③ `.codeartsdoer/` 是本地计划目录，不纳入提交。
### S0（完成，待独立 review）

- 基线：`origin/feat/integration` = `21d07eb`，校验命令 `git rev-parse origin/feat/integration` 输出 `21d07eb894ad9e0703a3ba037d5a67177f401d64`。
- worktree：`git worktree add "D:/Codex下载/GitHub项目/seevence/AIHOT-d2" -b feat/career-api-d2 origin/feat/integration` 成功；新树 `git status --short` 为空，B 的未提交采集改动未被带入。
- 落后提交：`git log --oneline HEAD..origin/feat/integration` 无输出。
- 门禁实跑（2026-11-17，Node v24.19.0）：
  - `npm run typecheck` → 0 error（含 contracts/backend/api/worker/tests/modules + web typegen）。
  - `npx tsc -p modules/tsconfig.json` → 0 error。
  - `node scripts/check-migrations.ts --base origin/feat/integration` → `migration history and online safety checked`，exit 0。
    - 首次失败原因：本机 `core.autocrlf=true` 且仓库无 `.gitattributes`，工作区迁移文件为 CRLF，与基线树内容不等价，被误判为“已部署迁移被修改”。处理：worktree 内 `git config core.autocrlf false` + 强制重新检出，**未改任何迁移内容**。
  - `npm run build -w @aihot/web` → 成功（standalone 中 3 个页面测试依赖该构建产物）。
  - `npm run test:standalone` → 321 tests / 319 pass / 2 fail。
    - 失败项：`tests/outbound-headers.standalone.test.ts` 的 `outbound direct/proxy keeps larger response headers confined to one host`，子进程以 `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`（libuv）崩溃，exit code `3221226505`。
    - 判定：环境缺陷，非基线代码缺陷。本机 Node `v24.19.0` 低于 `package.json` 要求的 `>=24.22.1`，崩溃发生在 Node libuv 层；本机无 nvm/fnm，未擅自升级全局 Node。阻塞编号记为 ENV-01，升级 Node 后须复跑该文件。
- 写集隔离模板（每阶段提交前执行）：
  ```bash
  git status --short
  git diff --name-only origin/feat/integration...HEAD
  git diff origin/feat/integration...HEAD --name-only | grep -v -E '^modules/career-insights/(server\.ts|backend/|migrations/)'
  git diff origin/feat/integration...HEAD --name-only | grep -E 'collector/|scripts/collect-career'
  ```
  期望：第 1 条仅显示本阶段意图修改的文件；第 3、4 条无输出。基线实测两条均为空（当前 HEAD 等于基线）。
- S0 遗留：ENV-01（Node 版本）；BLK-01～10 仍待拍板，S1/S2 迁移可本地编写但不可推送。