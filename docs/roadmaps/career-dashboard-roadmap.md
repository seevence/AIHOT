# 角色 E（前端与演示）分支路线图

> 本文件是 `feat/career-dashboard` 分支上的本地路线图副本，基线取自集成分支 `feat/integration` 的 `ROADMAP.md`。
> 基线提交：`142e99a ci: run career integration check in docker job`（2026-11-17）
> 角色：E：前端与演示；远程分支 `feat/career-dashboard`；独占写集 `modules/career-insights/{web.tsx,web/**}`
> 门禁：每阶段完成 → 更新本文件 → 独立 review PASS → 才进入下一阶段；未确认前不并入集成分支、不 push 云端。

## 阶段划分与状态

| 阶段 | 对应 ROADMAP | 范围 | 状态 | Review |
|---|---|---|---|---|
| E1 | D2：接真实 API，总览 + 基础筛选 + 职位证据展开 | 总览、职位筛选（方向/公司/城市/用工类型/学生友好）、分页、指标证据展开、政策—岗位共享主题两侧证据 | 已完成 | PASS（2026-11-17，两轮审查） |
| E2 | D3：主路径、筛选、建议和证据展开 | 目标方向视图（组合后端已算指标与证据）、技能筛选、完整主路径 | 已完成 | PASS（2026-11-17，两轮审查） |
| E3 | D4：集中调优 | 空态/错误态、长文本、大屏与手机响应式、筛选体验、方向视图可回溯性、E1/E2 遗留 minor | 已完成 | PASS（2026-11-17，两轮审查） |
| E4 | D5：第二次采集与联调 | 浏览器验收、真实备份页面核对、演示兜底（截图/录屏说明） | 已完成 | PASS（2026-11-17，收尾审查） |
| E5 | 收尾补丁（用户追加） | 时间可读化（含闰年/平年顺延口径）、全站 `as_of`、`FilterEmpty` 结构、文档与行尾 | 已完成 | PASS（2026-11-17，两轮） |

## 不可妥协约束（摘自共享路线图与开发契约）

- 正式路由只通过 `/api/site/career-insights/*` 读取数据；不访问数据库、不导入 fixture 冒充真实数据。
- 不在前端重复计算后端指标；数字只来自 API。
- `status=insufficient_data` 显示“数据不足”，不得画成 0 或下降；只有单快照时隐藏趋势。
- `unknown` 单独展示，不合并进“否”或“不限”。
- 每个指标可展开到职位或政策证据；政策—岗位共同方向必须同时提供两侧证据。
- 建议与结论注明“基于本次公开样本，不代表完整就业市场或录用概率”。
- 不修改 `module.ts`、`server.ts`、`contracts/`、`data/`、`fixtures/`、`backend/`、`migrations/`、`site/modules/`（属 A/C/D）。
- 加载、空态、错误态（400/404/500/503）均可见。

## 阶段记录

### E1（已完成，review PASS）

- 分支：`feat/career-dashboard`（基于 `142e99a`），独立 worktree `D:\桌面\huawei\AIHOT-e`
- 计划：`.codeartsdoer/plans/career-dashboard/design.md`、`task.md`
- 提交：`3c235c9`（功能）、`53afa9a`（首轮 review 修复）、`709547f`（.server 拆分与标签共享）
- 交付：
  - `web/filters.ts`：`JOB_PAGE_SIZES`、`parseDashboardFilters`、`buildJobsHref`、`serializeJobFilters`（客户端安全纯函数）
  - `web/labels.ts`：三套枚举中文标签，筛选与职位行共用
  - `CareerFilters`（方向/公司/城市/用工类型/学生友好，GET 提交，URL 回填）、`Pagination`（20/50，保留筛选）、`FilterEmpty`
  - `MetricList` + `EvidenceList`：口径/样本/未识别/词典版本，证据展开（职位站内、政策外链）
  - `SharedThemeList`：政策与职位两侧证据，固定“不表示因果关系”
  - `CareerDashboard`：按契约顺序组装，超页空态回首页，枚举中文标签
- 验证：`npm run typecheck -w @aihot/web`、`npm run build -w @aihot/web` 均通过（worktree 内）
- 遗留（转入 E3）：① 标签查表缺失时回退原值未落地（C-WEB-LABELS failure semantics）；② `CareerDashboard` 删除映射后多余空行；③ `apps/web/lib/api.server.ts` 把 API 500 映射为 503，R5 的 500 分支不可达，需与角色 A 协同。
### E2（开发完成，审查中）

- 计划：`.codeartsdoer/plans/career-dashboard/design.md` §2.2（C-WEB-FILTER-EXT@1、C-WEB-LABELS@2、C-WEB-DIRECTION@1、C-WEB-JOB-DETAIL@1）
- 交付：
  - `filters.ts`：`DashboardView`、`parseDirectionView`、`buildDirectionHref`、`buildJobHref`、`safeBackHref`；`api.ts` 同步 re-export 保持公共面
  - `labels.ts`：`SKILL_LABELS`（18 个技能 ID）与 `skillLabel`
  - `DirectionView`：方向标题、方向职位数、学生友好岗位数、两项指标、共享主题、前 5 条职位、免责声明
  - `CareerFilters`：技能精确筛选（datalist 来自技能词典）
  - `JobDetail` + `routes/job.tsx`：技能与技能证据、发布时间/首次/最近观测、枚举中文标签、`back` 返回链路
  - `CareerDashboard`：新增可选 `direction` prop，总览页新增“按目标方向查看”四方向入口
- 验证：`npm run typecheck -w @aihot/web`、`npm run build -w @aihot/web` 通过
- 提交：`e9e9a80`（功能）、`c83e406`（review 修复：口径标注、技能自渲染、back 收严）
- Review：首轮 FAIL（2 major：全站指标挂在方向标题下、技能指标未渲染 skill_id；10 minor）→ 修复 → 复审 PASS
- 遗留（转入 E3）：① 方向视图技能列表缺 as_of/disclaimer/证据展开；② `not_applicable` 被归为“数据不足”；③ 缺 `dimension.skill_id` 时名称空白；④ `formatShare` 与 `MetricList` 格式化逻辑重复（契约要求分列，接受）；⑤ `JobDetail.tsx` 结尾换行与日期 `<time>` 风格；⑥ `apps/web/lib/api.server.ts` 的 500→503 映射（跨角色 A）
### E3（开发完成，审查中）

- 计划：design.md §2.2 新增 C-WEB-SKILL-TRACE@1、C-WEB-RESPONSIVE@1
- 交付：
  - 筛选表单手机单列/桌面三列，控件 `label htmlFor` 可访问名称，手机按钮全宽
  - 分页手机仅保留上一页/下一页与页数文本；职位标题、公司、warnings、错误文案 `break-words`
  - 空态 `role="status"`、越界提示 `role="status"`、错误态 `role="alert"` 与窄屏边距
  - 详情页事实列表手机单列、日期 `<time>`、结尾换行
  - 方向视图技能项展示统计时间、口径说明、证据展开（职位站内/政策外链），`not_applicable` 显示“不适用”，缺失技能名显示“未指定技能”，技能区手机单列/桌面两列
  - `MetricList` 支持维度方向标签回退与多维 key
- 验证：`npm run typecheck -w @aihot/web`、`npm run build -w @aihot/web` 通过
- 提交：`91810b0`（功能）、`682cda6`（review 修复：移动端 aria-current、grid 断点、role=status 收窄、技能 unknown 与证据条件、key 兜底）
- Review：首轮 FAIL（1 major：移动端丢失 aria-current；14 minor）→ 修复 → 复审 PASS
- 遗留（转入 E4）：① `FilterEmpty.tsx` 空态缺 `role="status"`；② `CareerStates.tsx`/`JobDetail.tsx` 末尾换行与 `<time dateTime>` 校验；③ `CareerFilters.tsx` 不可达兜底 `?? "unknown"`；④ 计划文档 `.codeartsdoer/` 未入库（本阶段一并提交以便追溯）
### E4（已完成，收尾审查 PASS）

- 清理：`FilterEmpty` 空态 `role="status"`；`CareerStates`/`JobDetail` 末尾换行；`<time dateTime>` 仅对可解析时间生效；移除 `CareerFilters` 不可达兜底并收窄类型
- 浏览器验收（fixture 联调：fixture 服务 3101 + web 3010，`API_BASE_URL=http://127.0.0.1:3101`）：
  - 桌面 1440：总览、指标证据展开、方向视图（口径说明 + 技能证据 + 方向切换）、职位详情（信息/技能/技能证据/观测）
  - 手机 390：筛选单列与按钮全宽、方向视图与指标卡单列、分页仅上一页/下一页 + 页码文本
  - 控制台仅静态资源 404（`manifest.webmanifest`/`icon.png`/`favicon.ico`），属站点公共资源，不在角色 E 写集
  - 截图：`docs/verification/e4-dashboard-desktop.png`、`e4-direction-desktop.png`、`e4-job-detail.png`、`e4-dashboard-mobile.png`、`e4-direction-mobile.png`
- 遗留（跨角色/可选）：① 手机 fixed 底栏与页尾内容的遮挡关系由 `apps/web` 外壳负责（角色 A）；② 观测时间显示 ISO 原文，可读性可再优化（E5 已处理）；③ 真实数据链路需角色 C/D 完成后在集成分支复验
- 收尾审查：PASS（无 blocker/major，10 minor）。minor 记录：`FilterEmpty.tsx`/路线图末尾换行、路线图未写明 3010 端口覆盖方式、手机与桌面截图 URL 不同（筛选与方向视图）、缺手机详情与筛选空态截图、`isValidDateTime` 宽松解析边界、`hidden` 的 `?? ""` 保留、`FilterEmpty` 的 role 覆盖范围、桌面证据展开为折叠态、"真实备份页面核对"责任方待跨角色确认

### E5（收尾补丁，用户追加；已完成，复审 PASS）

- 范围（E 职责内可修项）：观测/发布时间可读化、严格 ISO 校验、`FilterEmpty` 可访问结构、`as_of` 全站统一、文档与行尾
- 契约补充：
  - C-WEB-JOB-DETAIL@1「时间展示」+ C-WEB-TIME@1：时间统一由 `web/time.ts` 的 `CareerTime` 渲染，固定 `Asia/Shanghai`、`zh-CN` medium/short
  - 合法性：严格 `Z` 后缀 ISO 且可解析；**允许自然顺延**（用户裁定）——闰年 2 月 29 天、平年 28 天
  - `dateTime` 输出 canonical `toISOString()`，与可见文本一致，不写无效日期字符串
  - C-WEB-DASH-BIND@1「FilterEmpty 结构」：单个 `role="status"` 包裹标题与说明，清除链接在外
- 交付：
  - `time.ts`：`formatCareerDateTime` + `CareerTime`
  - 使用点：`JobDetail`（`published_at`/`first_seen_at`/`last_seen_at`）、`routes/job.tsx`（`observed_at`）、`CareerDashboard`（数据截至 `as_of`）、`MetricList`（统计时间）、`DirectionView`（统计时间）
  - `FilterEmpty.tsx` 单个 `role="status"` 容器
- 实测（`npx tsx` + `renderToStaticMarkup`）：

| 输入 | 显示 | `dateTime` |
|---|---|---|
| `2024-02-29T00:00:00Z` | 2024年2月29日 08:00（闰年，不顺延） | `2024-02-29T00:00:00.000Z` |
| `2025-02-29T00:00:00Z` | 2025年3月1日 08:00（平年顺延 1 天） | `2025-03-01T00:00:00.000Z` |
| `2026-02-28T00:00:00Z` | 2026年2月28日 08:00 | `2026-02-28T00:00:00.000Z` |
| `2026-02-30T00:00:00Z` | 2026年3月2日 08:00（平年顺延 2 天） | `2026-03-02T00:00:00.000Z` |
| `2026-13-01T00:00:00Z` | 原文（不可解析） | 无（`<span>`） |

- 验证：`npm run typecheck -w @aihot/web`、`npm run build -w @aihot/web` 通过
- Review：首轮 FAIL（M1 按“必须拒绝顺延”判级）→ 用户裁定“顺延是对的，闰年与平年顺延不同” → 口径改为允许自然顺延 + canonical `dateTime` → 复审 PASS（0 blocker / 0 major，6 minor）
- 剩余 minor（不阻塞）：`time.ts` 重复解析两次（风格）、仅 Node SSR 实测未浏览器复验 hydration（Intl 配置一致，风险低）、文档末尾换行、政策卡片日期未纳入可读化（见协同表第 9 项）

### E6（真实数据复验与收敛；已完成，已合入）

- 合入：`cd69c68`（三项收敛：重复观测折叠、维度标签消歧）、`04f7cc4`（按 A 裁定修正 unknown 与应届友好文案），merge `254c7dc`。
- 真实数据复验证据（全部 PASS）：
  - 第一段 22/22；
  - 第二段 43/43；
  - 扩采 74 行增量 39/39。
- ~~未覆盖项：政策列表页前端仍 404（路由属 A），不在 E 写集内。~~ **已更新（2026-11-19，已被后续取代）**：政策列表页已完成，见「E7」（`8e81f33`）。
- 数据口径：真实数据链路已闭环，normalizer 0.2.0 落库 40/40；扩采后为 74 行「3 源 × 2 页」窗口基线（jobs 74 / obs 230 / policies 6 / runs 38）。

### E7（政策列表页；已完成，`8e81f33`）

- 提交：`8e81f33 feat(career-insights): 新增政策列表页`
- 页面：`/career-insights/policies`；loader 调用 `/api/site/career-insights/policies`（站点侧 `/policies?...`），支持 `source_key` / `theme` / `page` / `page_size`
- 功能：
  - 6 条政策列表
  - 来源 / 主题 chip 筛选（`policy.ts` 校验白名单，非法值忽略）
  - 分页（`Pagination`，保留筛选条件）
  - 0 条空态「当前筛选下暂无政策」
  - 超页提示
  - 政策标题外链 `target="_blank" rel="noopener noreferrer"`
- 验证：standalone 153/153（新增 6）；`npx tsc -p modules/tsconfig.json`；`npm run typecheck -w @aihot/web`、`npm run build -w @aihot/web`；SSR 200 且响应含 6 条政策
- 已知限制：
  - `page_size` 前端固定 20（`POLICY_PAGE_SIZE`），API 上限 100
  - `moe-policy` 源未启用时，选中该来源会出现 0 条

### E8（2026-11-20 就业化前端改版；PR #16）

- 合并关系：`origin/main` = `1782bbd`（PR #16，2026-11-20 22:47:44 +0800，tip `15cecc6`）；本节提交均为 `origin/main` 祖先，只有 `bb5b24a`、`96e8f99`、`8698672`、`90494b8` 是 `feat/stage-merge` 上**尚未进 main** 的本地提交（`bb5b24a` 为 skipped 提示修复）。
- 写集：`apps/web/**`（导航/首页/壳层/站点文案）、`modules/career-insights/{web/**,module.ts,fixtures/**,tests/**}`、`site/site.ts`；未改 `backend/`、`data/`（`CareerBriefV1` 由 `c21f0b9` 只加在 `contracts/insights.ts`）。
- **导航重构（`2727322`）**
  - 主导航 5 项：首页 `/`、热门岗位 `/career-insights/jobs`、职业洞察 `/career-insights`、就业日报 `/daily`（`withSubject("日报")`，`covers` `/weekly`、`/monthly`）、收藏 `/starred`。
  - `NAV.hidden = ["/all", "/hot", "/topics"]`（`site/site.ts`）：全部动态、就业热点、主题退出主导航与手机底栏，页面仍可直接打开；隐藏项的返回链路改回首页。
  - 手机底栏 4 个 tab：首页、岗位、洞察、收藏（`hot` 被 `inNav` 过滤；日报没有手机 tab；原「我的」页退出，收藏承担其入口）。
  - 实测：首页 SSR 侧栏只出现 5 项，`全部`/`就业热点`/`主题` 计数 0；底栏标签为 首页/岗位/洞察/收藏。
- **首页数据工作台（`38f3277`，8 段）**

| # | 区块 id | 标题 | 数据 |
|---|---|---|---|
| 1 | `home-overview` | 今日概览 | summary + catalog |
| 2 | `home-brief` | AI 就业研判 | `/brief` 缓存（204 →「继续积累观测」） |
| 3 | `home-indicators` | 需求变化 | summary 指标 |
| 4 | `home-top-directions` | 热门岗位 Top 6 | catalog `limit=6` |
| 5 | `home-signals` | 值得注意的信号（`CareerSignals` 卡片标题；该块无数据时外壳为「市场信号」） | `/signals` |
| 6 | `home-skills` | 热门技能与准备建议 | catalog.skills |
| 7 | `home-daily` | 最新就业日报 | `/daily` |
| 8 | `home-latest-jobs` | 最新岗位 | `/jobs`（6 条） |

  - 取数与降级：6 个请求并发（summary/catalog/signals/daily/latestJobs/brief）；每个区块独立 `settled()`，失败只把该块显示「本区块暂时不可用」；brief 单独区分 204（`empty`）与请求失败；整页 `cachedPage(60)`；`?q=` 仍重定向 `/all`。常量：`HOME_CATALOG_LIMIT=6`、`HOME_SIGNALS_LIMIT=5`、`HOME_LATEST_JOBS=6`。
  - skipped 提示（`bb5b24a`）：原实现只统计 `skipped` 中 `rule === "surge"` 的条数；改为**任何 skipped > 0 都显示**，按 rule 分组计数，`data-signals-skipped` 写 skipped 总数；测试新增 1 项（`career-feeds.standalone.test.ts` 现 8 项）。
- **职业洞察页七段（`c21f0b9`）**：`/career-insights` 用 `CareerInsightsBoard` 渲染 7 个 `data-insight-section`：
  1. `career-brief` AI 趋势研判（事实/推断/证据；缓存缺失显示「继续积累观测」）
  2. `career-job-trend` 岗位趋势（catalog）
  3. `career-skill-trend` 技能趋势（summary + catalog；含方向内高频技能组合）
  4. `career-hot-jobs` 热门岗位（方向榜 / 职位榜 / 市场信号）
  5. `career-student-advice` 学生就业建议（brief）
  6. `career-policy-jobs` 政策与岗位联动（summary.shared_themes）
  7. `career-method` 数据范围与方法（口径、未知字段、局限）
  - loader：summary + catalog（`limit=10`、`window_days=30`）+ signals + brief 并发，任一失败只降级对应区块（brief 的 204 与失败都收敛为 null）；`Cache-Control: no-store`。
  - 实测：`/career-insights` 200，7 个 `data-insight-section` 顺序与源码一致。
- **岗位目录页（`c21f0b9`）**：`/career-insights/jobs`（`module.ts` 注册），`JobsCatalogBoard` 三块——`direction-ranking` 方向榜、`title-ranking` 职位榜、`job-list` 岗位列表；学生友好 / 城市 chip 与分页全部由 URL 参数驱动，`catalog`（limit 10 / window 30）与 `jobs` 并发取数；筛选加载显示 `CareerPending`「正在加载筛选结果…」；空目录显示「继续积累观测」。实测：200，`data-section` 为 direction-ranking/title-ranking/job-list，方向榜 4 行（33/18/10/7，按 `data-catalog-direction`）。
- **就业日报页与就业热点榜（`c573c91`）**
  - `/daily` 改接 `GET .../daily`（`CareerDailyReport`）：各来源采集结果 + 今日概况（今日新增岗位 / 今日新增政策 / 职位库总量 / 政策库总量 / 空技能岗位占比），`has_run=false` 时有专门提示；`/weekly`、`/monthly` 不变（导航 `covers` 只用于高亮）。
  - `/hot` 改接 `GET .../hot`（`CareerHotList`）：企业招聘热度榜，按在招岗位数排序，显示前 3 职族与最近发布时间；页面 h1 与 meta 标题为「企业招聘热度榜」。
  - 实测：`/daily` 200：5 个来源、今日新增 25、职位库 188、政策库 6、空技能 45/188 = 23.9%；`/hot` 200：3 家（腾讯 70 / 美团 66 / 百度 52）、`window_days=30`。`/hot` 已在 `2727322` 后退出主导航（`NAV.hidden`），只能直接访问。
- **政策页与入口（`8e81f33` / `2dd4a86` / `0904032`；后续修正 `79e3b4c` / `645601c`）**
  - `8e81f33` 初版政策列表页（E7 已记录）。
  - `2dd4a86 fix(career-insights): 政策页非法筛选返回 400 而非静默丢弃`：`parsePolicyFiltersOrThrow` 区分「未提供」与「提供了但非法」，非法参数抛 `data(..., { status: 400 })` 交给 ErrorBoundary；主题用 `Object.hasOwn` 防原型链键；fixture API 同步按 `source_key` 过滤并移除 collector 未启用的 moe-policy 样例。
  - `0904032 feat(career-insights): 职业洞察页新增政策文件入口`：方向入口之后增加与一级 section 并列的「政策文件」入口（`PolicyEntry` → `/career-insights/policies`），standalone SSR 可断言。
  - E7 遗留纠正：每页条数不再是固定 20——`79e3b4c` 增加 20/50/100 切换（`aria-current` 标当前档，链接保留筛选）；来源/主题 chip 改由 API `facets` 驱动并带 count（`645601c`），来源校验放宽为形态校验（`^[a-z0-9][a-z0-9-]{0,63}`），因此 E7 的「`moe-policy` 未启用时选中该来源会出现 0 条」不再是可达路径（未启用源不进入 facets 选项；当前库只有 ndrc-policy / state-council-policy 两源）。
  - 实测：`/career-insights/policies` 200，h1「政策文件」，6 条；来源 chip 2 项（各 3 条）、主题 chip 2 项。
- **壳层修复（`0f0e6a9` + `3088e94`）**
  - `0f0e6a9 fix(web): 按输入设备决定外壳，鼠标设备窄窗口不再退回手机 tab`：`pointer: fine` 且 <700px 时保留桌面 rail、隐藏 PhoneBar/TabBar 并补 `#main` 顶距；触屏仍走手机外壳。
  - `3088e94 fix(web): 鼠标窄窗口只在 600–699px 用桌面 rail，更窄保留手机壳`：带宽收窄为 `@media (pointer: fine) and (min-width: 600px) and (max-width: 699px)`；<600px 一律手机壳（320px 真实手机不丢 64px 内容列）。
  - 用例参数化：`apps/web/tests/page-width.test.ts` 的 `SHELLS` 拆成 `phone: [320, 393]`（`hasTouch + isMobile`）与 `desktop: [669, 711, 941]`（鼠标上下文），`PAGES[].ready(page, shell)` 按外壳等待不同元素，断言语带 shell 名。
- **全站文案就业化（`993a68d`）**
  - `site/site.ts`：`SITE.subject` 由 `"AI"` 改为 `"就业"`，`homeTitle`/`topicsTitle`/`description`/`tagline`/`keywords`/`ABOUT.headline` 与 `CARDS`/`SEO_TITLES` 的就业口径同步（如 `keywords` = 就业趋势/招聘/AI 岗位/应届就业/就业政策）。
  - 导航与 `/hot` 的「热点榜」改为「就业热点」；`/all`、`/topics`、`/starred` 空态追加「本站内容暂未接入，可先查看 就业趋势洞察」引导链接（`/topics` 同时补 `topics.length === 0` 空态）。
  - 实测：首页 `<title>` 为 `MyHOT — 就业趋势 · 每日岗位与政策洞察`；`/daily` 为 `就业日报（2026-11-20） · MyHOT`；`/hot` 为 `企业招聘热度榜：按在招岗位数排序 · MyHOT`（`/hot` 标题在 `c573c91` 已再次改写，`993a68d` 的「就业热点」保留在导航标签/卡片文案）。
- **页面实测（2026-11-20 23:5x～11-21 00:0x CST，本机运行栈 SSR）**

| 路径 | HTTP | 标题 / 关键结构 |
|---|---|---|
| `/` | 200 | h1 就业数据工作台；8 个区块标题（今日概览、AI 就业研判、需求变化、热门岗位 Top 6、值得注意的信号、热门技能与准备建议、最新就业日报、最新岗位） |
| `/career-insights` | 200 | 7 个 `data-insight-section` |
| `/career-insights/jobs` | 200 | h1 热门岗位；`data-section` 3 个；方向榜 4 行 |
| `/daily` | 200 | h1 就业日报；`data-daily-source` 5 个；「各来源采集结果」「今日概况」 |
| `/career-insights/policies` | 200 | h1 政策文件；6 条政策 |
| `/hot` | 200 | h1 企业招聘热度榜；3 家企业（腾讯/美团/百度） |

- **验证**：`node --import ./tests/standalone.ts --test career-feeds.standalone.test.ts career-insights-board.standalone.test.ts data-normalize.standalone.test.ts` → **31/31 通过**（含 `bb5b24a` 的 skipped 分组用例、`15cecc6` 的城市集合用例、`c21f0b9` 的七段与目录页用例）。
- **已知限制 / 未覆盖**
  - 未跑浏览器级用例（`npm run test:web`，含 `page-width.test.ts` 的 Playwright 响应式断言）；壳层结论来自源码与用例改动，未在浏览器复验。
  - 本机运行栈镜像构建于 2026-11-20 22:49 CST（覆盖到 `15cecc6`），`bb5b24a` 的 skipped 提示改动只由源码与 standalone 用例覆盖；实测页面上 skipped 提示为「另有 3 家公司因历史不足 2 天暂无法判定突增」（当前 3 条 skipped 恰好全是 surge，与修复后行为一致）。
  - 写稿期间本分支 `90494b8` 把 1 行 unknown 改判为 ai_product_operations，方向计数由 33/17/10/7 变为 33/18/10/7（页面结构不变）；PR #16 合入 main 时职族口径为 unknown 121/188 = 64.4%，当前库为 120/188 = 63.8%。
  - `/hot` 退出主导航后无站内入口（仅 URL 直达）；如需曝光需再调整 `NAV.hidden` 或首页入口。
  - E7 的两条已知限制（页大小固定 20、moe-policy 0 条）已被 `79e3b4c` / `645601c` 取代，见上。

## 待多角色协同（非 E 职责，需 A / C / D 处理）

| # | 事项 | 负责角色 | 现状 | 影响 / 触发条件 |
|---|---|---|---|---|
| 1 | `apps/web/app/lib/api.server.ts` 把 API 500 映射为 503，R5 的 500 分支不可达 | A | **已闭环**：career API opt-in 保留 500，全站默认仍 503 | 后端 500 时页面显示“数据尚未就绪”而非“暂时无法加载” |
| 2 | 手机 fixed 底栏与页尾内容遮挡（间距/层级） | A（`apps/web` 外壳） | **已核验**：390×844 滚到底间隔 22.5px，无遮挡 | 手机滚动到底部时内容可能被底栏压住；E 无写集权限 |
| 3 | 真实数据链路（`summary`/`jobs`/`jobs/:id` 走真实 SQL 与迁移） | C / D | **已闭环**（原「未完成」已更新）：真实 SQL 链路已上线，normalizer 0.2.0 落库 40/40，扩采后 74 行基线（3 源 × 2 页）；E6 三项收敛（`cd69c68`）与文案修正（`04f7cc4`）已合入 | 原记录为 fixture 下只能显示 503，已被真实数据取代 |
| 4 | 真实备份页面核对（D5 范围项） | A + C / D | **已执行**（原「未执行」已更新）：真实数据复验第一段 22/22、第二段 43/43、扩采 74 行增量 39/39 全 PASS；~~政策列表页前端仍 404（未覆盖项，路由属 A）~~ **已更新（2026-11-19，已被后续取代）**：政策列表页已完成（`8e81f33`），见「E7」 | 已按真实数据核对前端展示口径 |
| 5 | 站点公共静态资源 404（`manifest.webmanifest`/`icon.png`/`favicon.ico`） | A | **已核验**：正式 Docker 全 200；404 仅 fixture 控制台 | 浏览器控制台 404，不影响业务功能 |
| 6 | `feat/career-dashboard` 合并与 push | A（集成） | **已闭环**：已合入 `feat/integration` 并推送 | 合入 `feat/integration` 并做集成门禁 |
| 7 | 后端时间序列化统一为 UTC `Z`（`as_of`/`observed_at`/`published_at`） | C / D | 约定已在前端契约（非 Z 偏移降级为原文） | 后端若返回 `+08:00` 等偏移，前端按原文显示、不做可读化 |
| 8 | 真实数据下 `as_of` 可读化复验（含跨月/跨年与闰年边界） | C / D + A | **已复验**（原「待后端链路」已更新）：在 0.2.0 的 40 行与扩采 74 行真实数据上均通过，含全站 `as_of` 显示 | 前端逻辑已由真实数据样例确认 |
| 9 | 政策卡片 `policy.published_at` 日期格式确认（是否也按 `Asia/Shanghai` 可读化） | C / D（政策数据与格式） | 未确认 | 当前 `SharedThemeList` 按原文展示；格式确认后由 E 接入 `CareerTime` |
| 10 | `career_briefs` 首版缓存已生成（1 行，`as_of=2026-11-20T10:58:45.58Z`）；数据前进后需离线重跑 `scripts/build-career-brief.ts` | A + C / D | 首版已写入；生成入口只有离线脚本，`server.ts` 无 brief 定时任务 | 重跑前首页/洞察页仍显示旧研判 |

说明：以上均为记录/风格级问题，不阻塞阶段完成；真实数据与外壳层问题留待集成分支处理
## 最近更新

- **2026-11-19**：`origin/feat/integration` = `a5191f7`（stage 合并并推送）；本地后续提交 `254c7dc`（merge：`04f7cc4` 文案修正）。
- 本次同步：协同表 #3/#4/#8 的「未完成/未执行/待后端链路」已被后续取代——真实数据链路已闭环（0.2.0 40/40，扩采 74 行基线），E 的复验证据为第一段 22/22、第二段 43/43、扩采 74 行增量 39/39 全 PASS；补充 E6 合入记录（`cd69c68` / `04f7cc4`）；政策列表页前端 404 仍为未覆盖项（路由属 A）。
- **2026-11-19**：`1ae9ccd`（含政策页 `8e81f33`）——政策列表页 `/career-insights/policies` 已完成，记录见「E7」；E6 与协同表 #4 的「前端 404 未覆盖」已标注为被后续取代。
- **2026-11-20**：**未读时间线随首页改版停用**。首页从 `Timeline` 切换为「就业数据工作台」后，`Timeline` 组件已无页面使用；`/all` 走 `/api/site/pool` + `DayList`，不传 `group`、不接 `readSet`/`unreadOnly`，无法承载「只看未读」。对应 `apps/web/tests/timeline-unread.test.ts`（`:187` 全部已读、`:195` 自动加载上限）已删除，合并后 CI 的 `Web tests` 不再因首页改版失败。**如需恢复，另开任务**：为 `Timeline` 重新接页面入口（或把未读能力并入 `DayList`），并恢复/重写这两个用例。
- **2026-11-20**：PR #16（`1782bbd`，tip `15cecc6`）合入就业化前端改版，新增「E8」：导航 5+4（`2727322`）、首页 8 段工作台与 skipped 提示（`38f3277`、`bb5b24a`）、职业洞察七段与岗位目录页（`c21f0b9`）、`/daily` 与 `/hot` 接口接入（`c573c91`）、政策页与入口收口（`8e81f33` / `2dd4a86` / `0904032`，后续 `79e3b4c` / `645601c`）、壳层 600–699px 规则（`0f0e6a9` / `3088e94`）、全站就业文案（`993a68d`）；E7 的两条已知限制已由 `79e3b4c` / `645601c` 取代。
- **2026-11-20**：`bb5b24a`（skipped 提示）、`96e8f99`、`8698672`、`90494b8` 为 `feat/stage-merge` 上的本地后续提交，尚未进 main；首页/洞察页 skipped 提示行为以源码与 standalone 用例为准，`90494b8` 的职族改判见 E8 已知限制。