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

## 待多角色协同（非 E 职责，需 A / C / D 处理）

| # | 事项 | 负责角色 | 现状 | 影响 / 触发条件 |
|---|---|---|---|---|
| 1 | `apps/web/app/lib/api.server.ts` 把 API 500 映射为 503，R5 的 500 分支不可达 | A | 未处理 | 后端 500 时页面显示“数据尚未就绪”而非“暂时无法加载” |
| 2 | 手机 fixed 底栏与页尾内容遮挡（间距/层级） | A（`apps/web` 外壳） | 未处理 | 手机滚动到底部时内容可能被底栏压住；E 无写集权限 |
| 3 | 真实数据链路（`summary`/`jobs`/`jobs/:id` 走真实 SQL 与迁移） | C / D | 未完成 | 当前只能显示 503 状态或 fixture 样例 |
| 4 | 真实备份页面核对（D5 范围项） | A + C / D | 未执行 | 需后端链路可用后在集成分支复验前端展示口径 |
| 5 | 站点公共静态资源 404（`manifest.webmanifest`/`icon.png`/`favicon.ico`） | A | 未处理 | 浏览器控制台 404，不影响业务功能 |
| 6 | `feat/career-dashboard` 合并与 push | A（集成） | 待 E5 审查 PASS | 合入 `feat/integration` 并做集成门禁 |
| 7 | 后端时间序列化统一为 UTC `Z`（`as_of`/`observed_at`/`published_at`） | C / D | 约定已在前端契约（非 Z 偏移降级为原文） | 后端若返回 `+08:00` 等偏移，前端按原文显示、不做可读化 |
| 8 | 真实数据下 `as_of` 可读化复验（含跨月/跨年与闰年边界） | C / D + A | 待后端链路 | 前端已覆盖，需真实数据样例再确认一次 |
| 9 | 政策卡片 `policy.published_at` 日期格式确认（是否也按 `Asia/Shanghai` 可读化） | C / D（政策数据与格式） | 未确认 | 当前 `SharedThemeList` 按原文展示；格式确认后由 E 接入 `CareerTime` |

说明：以上均为记录/风格级问题，不阻塞阶段完成；真实数据与外壳层问题留待集成分支处理
