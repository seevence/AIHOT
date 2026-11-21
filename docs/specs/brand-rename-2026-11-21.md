# 品牌改名：THEWIND（2026-11-21）

## 决定

- 网站正式名：**THEWIND**（全大写、无空格，作为展示名与文件名前缀）。
- 依据：用户拍板「网站改名 THEWIND，其他地方跟着统一；改名前先评估哪些能改（底座是 AIHOT）」。
- 原则：**用户可见品牌全部统一为 THEWIND；上游技术底座标识保持 aihot**（避免数据丢失、部署事故与上游合并冲突）。

## 本轮已改（A 档：用户可见品牌）

| 项 | 文件 | 变更 |
|---|---|---|
| 站名 | `site/site.ts` | `SITE.name` MyHOT → THEWIND（导航/标题/RSS/og/JSON-LD/MCP/后台/报头全部单点派生） |
| 首页标题 | `site/site.ts` | `SITE.homeTitle` → `THEWIND — 就业趋势 · 每日岗位与政策洞察` |
| 结构化数据运营者 | `site/site.ts` | `SITE.organization.name` → THEWIND |
| 采集 UA | `site/site.ts` | `MyHOTBot/1.0` → `TheWindBot/1.0` |
| 页脚归属 | `site/site.ts` | `footerNote` 关闭（关于页不再显示上游品牌）；`poweredBy` 置 null（侧栏/「我的」页不再出现「由 AIHOT 驱动」外链） |
| 更新日志 | `site/changelog.json` | 新增「网站更名为 THEWIND」；首条公告去掉 AIHOT 字样 |
| 部署模板 | `.env.example` | 注释站名改 THEWIND；示例库名/数据目录与实机一致（aihot） |
| 决策记录 | 本文件 + `docs/specs/brand-change-checklist.md` | 取代旧的「就业HOT」工作名 |

静态资源无需重生成：logo/icon/favicon 是中性的四角星图形（无文字）；报头 nameplate 由 `SITE.subject`（就业）生成；og/海报按 `SITE.name` 现渲染；manifest/openapi/robots 用占位符运行时填充。

## 本轮已改（B1 档：公开技术标识）

- `SITE.mcpPrefix`：`myhot` → `thewind`。MCP 工具名、`/agent` 页示例、分享/导出文件名（`thewind-<id>.png`、`thewind-local-data-*.json`、`thewind-<id>.md`）随之更新。
- `SITE.interfaceVersion`：`4.0.0` → `5.0.0`（公开接口版本只升不降；openapi-v1 `{{version}}` 占位符自动跟随）。
- 旧 → 新工具名映射（当前无已知外部 MCP 接入）：

| 旧 | 新 |
|---|---|
| `myhot_get_latest` | `thewind_get_latest` |
| `myhot_search` | `thewind_search` |
| `myhot_get_hot_topics` | `thewind_get_hot_topics` |
| `myhot_get_story` | `thewind_get_story` |
| `myhot_get_daily` | `thewind_get_daily` |
| `myhot_get_weekly` | `thewind_get_weekly` |
| `myhot_get_monthly` | `thewind_get_monthly` |

（工具名由 `MCP_TOOL_NAMES`/前缀生成；部署后以 `/api/mcp` 的 `tools/list` 实测为 `thewind_get_latest / thewind_search / thewind_get_hot_topics / thewind_get_story / thewind_get_daily / thewind_get_weekly / thewind_get_monthly`。）

## 明确保留（B/C 档，不改）

- npm workspace 包名 `@aihot/*`、仓库名 `seevence/AIHOT`、上游 `KKKKhazix/AIHOT`、LICENSE/NOTICE（法律归属，NOTICE 明确「AIHOT 名称与 Logo 不在 MIT 许可内、请用你自己的名字」，与本次改名一致）。
- 数据库名/用户名 `aihot`、docker compose 项目名 `aihot` 与卷名（改名会新建空卷导致「数据消失」）、镜像名 `aihot-app`、env 前缀 `AIHOT_*`（改名会让旧 `.env` 静默失效）、CI/测试库名。
- localStorage key `aihot-*`（改名会丢读者收藏/已读/主题）、admin cookie `aihot_admin`、公开 API 字段 `links.aihot`、信源配置键 `_aihot`、CSS 动画名、`meta name="aihot-release"`、内部日志字段。
- 公开 API 路径 `/api/v1`、`/api/site`、`/api/mcp`（路径不含品牌）。

## 验证

- `npm run typecheck`；`npm run build -w @aihot/web`；`npm run test:web`；`npm run test:standalone`。
- 部署后抽查：`curl -s localhost:3000/ | grep -o 'THEWIND\|MyHOT\|AIHOT'` 只应出现 THEWIND；`/about` 无「由 AIHOT 驱动」；`/feed.xml` 标题为 THEWIND；`/manifest.webmanifest` name/short_name；`/llms.txt` 首行；`/openapi-v1.json` title/version 5.0.0；`/api/mcp` `tools/list` 工具名为 `thewind_*`；`/agent` 页示例为 thewind。
- 回滚：纯配置值改动，`git revert` + 重建 web 产物即可；无数据迁移。若已发布给外部 MCP 接入方，需通知按上表改名。

## 仍可能出现 aihot 的位置（非读者可见）

开发者可见的 `@aihot/*` import/包名、DB/compose/镜像名、env 前缀、localStorage key、cookie、CSS 动画名、公开契约字段 `links.aihot`；运维可见的部署命令与日志。均属内部技术标识，不影响读者品牌一致性。
