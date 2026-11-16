# Career Insights 五人协作启动

本文是 A/B/C/D/E 的唯一启动入口。仓库为 `https://github.com/seevence/AIHOT.git`，上游为 `https://github.com/KKKKhazix/AIHOT.git`。准备阶段的冻结接口以 `.codeartsdoer/plans/career-collaboration-prep/design.md` §2.2 和 `docs/development-contract.md` 为准。

## 1. 获取权限与代码

需要 Node.js `>=24.22.1`、PostgreSQL 17、npm 和 GitHub CLI `gh`。

仓库拥有者拿到协作者的 GitHub 用户名后，由拥有者显式执行邀请（需要仓库管理权限）：

```bash
gh auth login
gh api --method PUT repos/seevence/AIHOT/collaborators/<GITHUB_USERNAME> -f permission=push
```

`<GITHUB_USERNAME>` 必须替换为本人提供的账号；当前未提供用户名时不得擅自邀请、猜测账号或分配身份。协作者接受邀请后执行：

```bash
git clone https://github.com/seevence/AIHOT.git
cd AIHOT
git remote add upstream https://github.com/KKKKhazix/AIHOT.git
git fetch origin --prune
```

## 2. 五条既有远程分支与写集

五条角色分支已经存在于 `origin`，不要另起同名分支，也不要修改其他角色的文件。

| 角色 | 既有远程分支 | 新克隆后的切换命令 | 文件所有权 |
|---|---|---|---|
| A：契约与集成 | `origin/feat/integration` | `git switch --track origin/feat/integration` | `modules/career-insights/{package.json,module.ts,contracts/**,README.md}`、`site/modules/{index.ts,server.ts,web.ts}`、`site/package.json`、`Dockerfile`、`docs/{development-contract.md,team-startup.md}` |
| B：采集 | `origin/feat/career-collector` | `git switch --track origin/feat/career-collector` | `modules/career-insights/collector/**` |
| C：数据与指标 | `origin/feat/career-data-metrics` | `git switch --track origin/feat/career-data-metrics` | `modules/career-insights/{data/**,fixtures/**}` |
| D：后端与 API | `origin/feat/career-api` | `git switch --track origin/feat/career-api` | `modules/career-insights/{server.ts,backend/**,migrations/**}` |
| E：前端 | `origin/feat/career-dashboard` | `git switch --track origin/feat/career-dashboard` | `modules/career-insights/{web.tsx,web/**}` |

已有本地分支时使用：

```bash
git switch <BRANCH_NAME>
git pull --ff-only origin <BRANCH_NAME>
```

`package-lock.json` 不属于任何角色写集。五条线完成并由 A 汇总后，只有 A 在 `feat/integration` 根据冻结的包声明统一更新锁文件：

```bash
git switch feat/integration
npm install --package-lock-only --ignore-scripts
```

## 3. 本地环境命令

并行开发期间锁文件尚未统一时，安装依赖但不生成或修改锁文件：

```bash
npm install --no-package-lock --no-audit --no-fund
cp .env.example .env
```

按 `docs/deploy.md` 填好 `.env` 的本地必填项。开发和测试保持 `COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`，外部推送开关也保持关闭；不要使用生产数据库或真实付费服务。A 更新并合并锁文件后改用：

```bash
npm ci
```

常用进程分别在不同终端启动：

```bash
npm run db:migrate
npm run dev:api
npm run dev:web
# 只有当前任务需要 worker 时才启动：
npm run dev:worker
```

页面地址为 `http://localhost:3000/career-insights`。准备阶段正式 repository 不可用，三个 GET 返回 `503 data_unavailable` 是预期行为，不是返回空列表或 fixture 的理由。

## 4. Fixture 联调

Fixture 只用于 E/C 联调，所有对象均为 `data_origin=synthetic_fixture`，页面必须显示“联调样例（非真实数据）”。服务仅监听 `127.0.0.1:3101`，不进入正式 server、生产 route 或 `web.tsx`。

终端一：

```bash
node modules/career-insights/web/fixture-server.ts
```

终端二：

```bash
API_BASE_URL=http://127.0.0.1:3101 npm run dev:web
```

验证三个地址：

```bash
curl http://127.0.0.1:3101/api/site/career-insights/summary
curl "http://127.0.0.1:3101/api/site/career-insights/jobs?page=1&page_size=20"
curl http://127.0.0.1:3101/api/site/career-insights/jobs/fixture-job-001
```

恢复正式 API 联调时，启动 `npm run dev:api`，并不带 `API_BASE_URL` 重新执行 `npm run dev:web`。正式 API 失败或 503 时页面展示错误/“数据尚未就绪”，不得自动回退 fixture。

## 5. 共享契约与变更规则

所有线只从统一入口导入，不读取或复制其他角色的实现来推测接口：

```ts
import type {
  RawCollectedJobV1,
  NormalizedJobV1,
  SummaryResponseV1,
  JobListResponseV1,
  JobDetailResponseV1,
} from "@aihot/career-insights/contracts";
```

- `CAREER_CONTRACT_VERSION="0.1"` 用于并行开发，真实样本验收后才升级 `1.0`；`CAREER_SCHEMA_VERSION="1.0"`。
- 共享类型在 `modules/career-insights/contracts/job.ts` 和 `api.ts`，HTTP Schema 在 `contracts/openapi.json`，统一由 `contracts/index.ts` 导出。
- `RawCollectedJobV1` 只走 B→C；D 只接受 C 校验后的 `NormalizedJobV1`。未知值保持 `null`、`unknown` 或 `[]`。
- 准备阶段只允许新增可选字段。删除、改名、改类型、改枚举或指标含义属于破坏性变更，必须由 A/C/D/E 共同评审并同步通知 B，不能由任一角色直接合并。
- 契约 PR 必须同时更新 `docs/development-contract.md`、对应 TypeScript 类型、`contracts/openapi.json`、受影响测试和 B/C/D/E 影响说明；有数据库语义变化时附新迁移与回退说明，不改历史迁移。
- 发现契约缺口或歧义时停止跨界修改，在自己 PR 中说明并交给 A 协调；不得在本地另造同名类型或通过读取队友实现补齐契约。

## 6. 提交检查与 PR 流程

提交前按实际改动执行：

```bash
npm run typecheck
DATABASE_URL=postgres://127.0.0.1:5432/career_insights_test npm test
npm run build -w @aihot/web && npm run test:web
# 站点已经启动时：
node scripts/smoke.ts --base http://localhost:3000
```

测试数据库账号需要 `CREATEDB`，库名必须以 `_test` 或 `_ci` 结尾。D 的迁移 PR 另执行：

```bash
node scripts/check-migrations.ts --base feat/integration
```

B/C/D/E 的 PR 一律以 `feat/integration` 为目标，不得直接推 `main`；每个 PR 只包含自己的写集，不夹带 `package-lock.json`。完成提交并推送当前角色分支后，使用下面对应命令：

```bash
# B
git push -u origin feat/career-collector
gh pr create --repo seevence/AIHOT --base feat/integration --head feat/career-collector --fill

# C
git push -u origin feat/career-data-metrics
gh pr create --repo seevence/AIHOT --base feat/integration --head feat/career-data-metrics --fill

# D
git push -u origin feat/career-api
gh pr create --repo seevence/AIHOT --base feat/integration --head feat/career-api --fill

# E
git push -u origin feat/career-dashboard
gh pr create --repo seevence/AIHOT --base feat/integration --head feat/career-dashboard --fill
```

PR 描述写明契约版本、修改文件、验证命令及结果、数据是否真实、对其他角色的影响。页面改动附截图；真实来源尚未试抓时保持 `enabled=false`，不得宣称已经自动采集。仍在开发时使用草稿 PR，不编造 Issue 分配或邀请状态。

A 收齐四条角色 PR、解决集成问题并统一锁文件后，再将整合结果向 `main` 提 PR：

```bash
git push -u origin feat/integration
gh pr create --repo seevence/AIHOT --base main --head feat/integration --fill
```

需要更新已推送的 PR 分支时使用 `git push --force-with-lease`，不使用强制推送覆盖他人提交。任何实际提交、推送、邀请或 Issue 分配都必须由对应负责人明确确认后执行。
## 7. Docker 重建、迁移与运行级联调检查

集成分支改动涉及 `Dockerfile`、`site/modules/**` 或模块迁移时，用 Docker 重建容器并重新执行迁移：

```bash
docker compose build
docker compose stop api worker web
docker compose run --rm setup && docker compose up -d
docker compose logs -f --tail 100 api worker web
```

`setup` 每次启动先执行 `node scripts/migrate.ts && node scripts/seed.ts` 再退出，所以这次 `run --rm setup` 就是本次的迁移；不要另造迁移命令，也不要改写历史迁移。

站点启动后执行运行级联调检查（脚本只读：不写库、不调模型、不启动服务）：

```bash
node scripts/check-career-integration.ts --base http://localhost:3000
# 真实数据就绪后（D2 起）503 不再被接受：
node scripts/check-career-integration.ts --base http://localhost:3000 --require-data
```

地址解析顺序为 `--base` → `SITE_URL` → `http://localhost:3000`。脚本依次请求 `/api/health`、`/career-insights`、`/api/site/career-insights/summary`、`/api/site/career-insights/jobs`、`/api/site/career-insights/jobs/not-a-uuid`；每次检查打印一行 `✓ <path>` 或 `✗ <path>  <原因>`，最后打印 `all checks passed`（退出码 `0`）或 `<N> check(s) failed`（退出码 `1`）。各检查相互独立，失败不会中断其余请求，也没有重试。

预期响应：

| 检查 | 要求 |
|---|---|
| `/api/health` | `200`，JSON `ok=true`、`db="ok"` |
| `/career-insights` | `text/html` 且页面包含 `职业洞察`（始终要求）；预数据阶段可返回渲染后的 `503` 错误页，且页面还须包含 `数据尚未就绪`；加 `--require-data` 时必须为 `200` |
| `/api/site/career-insights/summary`、`.../jobs` | 预数据阶段可 `503` + `error.code="data_unavailable"`；`200` 时 `contract_version` 必须等于 `CAREER_CONTRACT_VERSION`（当前 `0.1`），并带 `metrics`/`items` 数组；加 `--require-data` 时拒绝 `503` |
| `/api/site/career-insights/jobs/not-a-uuid` | `400` + `error.code="invalid_parameter"` |

预数据阶段接受渲染后的 `503` 错误页和 `503 data_unavailable` 只是本阶段的过渡，不是空列表或 fixture 的理由，也不代表最终 MVP 验收可以接受 `503`；真实数据到位后一律加 `--require-data` 运行。