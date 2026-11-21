# 就业平台「底座能力未集成」差距评估（2026-11-21）

> 只读评估：代码 + 本机 3000 实测 + 只读 SQL（career_jobs 222 / observations 500 / policies 6 / briefs 3 / comments 1；articles/publications/reports 均为 0）。本文只列结论与优先级，不代替实施。
> 状态图例：✅ 已集成且有用 ｜ 🟡 部分集成/默认隐藏 ｜ 🟠 未集成但底座可用 ｜ 🔴 未集成且不可用。

## 一、结论

1. 就业主链路已打通并就业化：首页工作台、职业洞察（研判/信号/趋势）、热门岗位 + 筛选 + 详情、政策页、就业日报（今日概况 + AI 评论 + 各来源结果）、企业招聘热度榜、岗位本地收藏、career API、每日 cron（采集 → LLM 兜底 → 研判 → 日报评论）。
2. 底座「流量与分发外围」基本未接入：`/all`、`/topics`(38 个 AI 主题)、`/weekly`、`/monthly`、`/daily/archive`、`/feed/*.xml`、`/api/v1/*`、MCP、`/llms.txt`、`/agent` 仍是文章体系（页面在、文案就业化、内容为空或旧 AI 内容）。
3. 五个成熟度能力面缺口最大：**岗位搜索、岗位/页面 SEO、管理后台 career 视图、通知告警实际可达、运维（备份/保留）**。
4. 最高杠杆是底座给模块预留的插座（`ServerModule`）：`sitemap.entries`、`agent.abilities`、`llms`、`retention`、`sourceHealth`、`models`；career 目前只实现了 http/alerts/queues/schedules 四项。

## 二、能力面矩阵（摘要）

| 面 | 状态 | 证据 / 缺口 |
|---|---|---|
| 首页 / 职业洞察 / 岗位目录与详情 / 政策 / 就业日报 / 企业热度榜 / 收藏 | ✅ | 真实数据渲染；`/hot` 被 `NAV.hidden` 隐藏且无入口（🟡） |
| 全站搜索 | 🟠 | 只搜文章；`/api/site/pool?q=岗位` total 0；suggestions 仍是 38 个 AI 主题 |
| 岗位关键词搜索 | 🔴 | job API 无 `q`（`?q=` → 400），UI 无搜索框 |
| 岗位页 SEO | 🔴 | 详情页 head 仅 title；无 description/canonical/og/JSON-LD；不在 sitemap（`/sitemaps/pages.xml` 无 career 路径）；不在 RSS |
| 洞察/岗位/政策页 meta | 🔴 | 只有 `<title>`，无站名后缀与描述 |
| `/all` `/topics` `/story` `/items` `/weekly` `/monthly` `/daily/archive` | 🟠/🔴 | 页面在但内容为空或旧 AI 主题/分类；周报月报 0 期；`reports.compose` 已失败 164 次 |
| RSS / llms.txt / openapi / MCP / Agent | 🟠 | 全是文章体系；career 未注册 openapi/MCP/llms；openapi-v1 中 career 0 次 |
| 管理后台 | 🟡 | 登录/引擎页可用；`/admin/runs` 可见 `cron.career.ingest` 行但不渲染 detail；无 career 来源/内容/模型/告警视图 |
| 告警 | 🔴 | career 告警逻辑已实现，但 `FEISHU_INTERNAL_ENABLED=false` 且未配 webhook → `sendAlert` 只打日志；brief/comment 失败无告警 |
| 备份 / 保留 | 🟠 | 备份代码在但未配对象存储（`ops.backup` 未注册，当前无自动备份）；career observations/ingest_runs 无清理 |
| 数据源 | ✅/🟠 | 3 岗位源 + 2 政策源已启用；moe 因 HTTPS→HTTP 门禁禁用，阿里/字节禁用于鉴权/SPA；18 个底座 AI RSS 源仍 enabled（打开采集会污染就业站） |
| 日报/周报/月报 | ✅/🟠 | 就业日报真实（含 AI 评论）；周/月报空壳；日报文案「每天 08:00」与实际 06:10 采集不一致 |
| 用户体系 | 🔴 | 底座无读者账号/云同步；收藏/已读全在 localStorage；岗位收藏导出不含 |
| 底座残留在跑 | 🟠 | 15 个 cron 中 7 个在 0 数据上空转；`/api/site/hot|timeline|pool|topics|reports` 空；`/about` 统计口径仍是 AI 源 |

## 三、优先级建议

### P0（直接影响用户/数据正确性）
1. **岗位搜索**：job API 加 `q`（title/company/skill/city 子串，量大再上 pg_trgm），前端搜索框 + overlay 分流 + suggestions 补方向/技能/企业。
2. **岗位/政策/洞察页 SEO**：统一 `pageMeta`（description/canonical/og）+ 岗位 `JobPosting` JSON-LD（需在招口径，避免过期）+ `module.sitemap.entries` 进 sitemap/IndexNow/百度推送。
3. **周报/月报决策**：补就业周/月聚合生产，或下线页面/导航/sitemap 并停 `reports.compose`（空转噪音）。
4. **空页与旧内容收口**：`/all`、`/topics`、`/items`、`/story`、`/daily/archive`、`/about` 数字、changelog、terms/privacy；空页 noindex/410，按「停用即删干净」连 cron/路由/sitemap/llms/测试一起收。
5. **告警真正可达**：配置飞书告警 webhook（或统一 webhook），career alerts 扩 brief/comment 失败与停摆；`/admin/runs` 展示 detail。
6. **政策相关性**：只收就业/教育/人才相关政策或加人工审核标记（当前 6 条含非就业政策）。
7. **清理 18 个底座 AI RSS 源**，确认 `COLLECT_ENABLED` 保持关闭或改指向。

### P1（可观测性与运营）
后台 career 视图（采集分来源/耗时/失败、LLM 兜底预算、研判/评论版本与失败、政策采集）；`module.retention` 清理 observations/ingest_runs；`module.models` 注册 career 步骤模型；底座空转 cron 清退；备份启用 + 恢复演练；就业日报归档 + 修正 08:00 文案；`/hot` 放出导航入口；就业日报/新增岗位推飞书。

### P2（SEO/增长/分发）
公开岗位/政策 API v1 + OpenAPI + llms + MCP（`agent.abilities` 插座现成）；就业 RSS（岗位/政策/日报）；IndexNow/百度覆盖岗位页；岗位/政策分享图；主题/标签就业化；career API 缓存（当前 no-store）。

### P3（可选）
读者账号/云同步（底座无，成本高）；岗位/政策 LLM 摘要与翻译；事件归组；未读时间线；收藏导出 v2 含岗位；采集深度扩展。

## 四、不要做 / 风险

- 不要在清理底座数据前打开 `COLLECT_ENABLED`：18 个 AI RSS 源会立刻把 AI 新闻灌进 `/all`、`/feed`、`/api/v1`。
- 不要继续在引擎文件里硬编码就业导航（应走模块 `web.sidebar/tabs` 插座）。
- 停用能力要删干净（路由/导航/sitemap/llms/cron/settings/env/测试），不是只隐藏。
- 部署一致性：compose 工作目录是 `D:\桌面\huawei\AIHOT`（旧代码），构建源是 `AIHOT-stage`；下次重建务必确认构建目标。

## 五、验收建议
`/sitemaps/pages.xml` 出现岗位/政策/洞察 URL；岗位页 head 有 description/canonical/JSON-LD；`/api/site/career-insights/jobs?q=数据` 返回 >0；`/admin/runs` 可见 career 分来源与研判状态；`/feed/jobs.xml` 有条目；`job_runs` 中 `reports.compose` 不再失败；`/about` 数字与 career 库一致；`grep -c career /openapi-v1.json` > 0。
