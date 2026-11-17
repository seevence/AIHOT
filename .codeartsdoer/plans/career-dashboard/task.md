# 角色 E 前端开发任务（阶段 E1）

> 阶段：E1（对应共享 ROADMAP D2：接真实 API，总览 + 基础筛选 + 职位证据展开）
> 分支：`feat/career-dashboard`（基线 `142e99a`）
> 计划：`design.md`（同目录）；路线图副本：`docs/roadmaps/career-dashboard-roadmap.md`
> 门禁：E1 三个任务完成后由独立 code review 审查；PASS 后才追加 E2 任务。
> 写集边界：仅 `modules/career-insights/web.tsx` 与 `modules/career-insights/web/**`；不得修改 `contracts/**`、`data/**`、`fixtures/**`、`backend/**`、`migrations/**`、`module.ts`、`server.ts`、`site/modules/**`。

## T1: 看板筛选、分页与组装

- **Objective**: 让看板支持 URL 驱动的职位筛选与分页，并把指标/主题/职位区块按契约组装。
- **Requirements**: R1, R2, R5
- **Write set**: `modules/career-insights/web/api.ts`, `modules/career-insights/web/routes/dashboard.tsx`, `modules/career-insights/web/components/CareerFilters.tsx`, `modules/career-insights/web/components/Pagination.tsx`, `modules/career-insights/web/components/FilterEmpty.tsx`, `modules/career-insights/web/components/CareerDashboard.tsx`
- **Provides**: C-WEB-FILTER@1, C-WEB-DASH-BIND@1 (design.md §2.2)
- **Consumes**: C-WEB-METRIC@1, C-WEB-THEME@1 (design.md §2.2，仅按契约 props 引用组件)
- **Blocked by**: none
- **Deliverable**: `web/api.ts` 新增 `JOB_PAGE_SIZES`、`parseDashboardFilters`、`buildJobsHref`；`routes/dashboard.tsx` loader 解析 URL 筛选并请求对应 `/jobs`；`CareerFilters` 渲染方向/公司/城市/用工类型/学生友好筛选与“应用/清除”；`Pagination` 渲染上一页/下一页与页码链接；`FilterEmpty` 提供清除筛选入口；`CareerDashboard` 按契约顺序组装各区块并渲染职位行。

## T2: 指标卡片与证据展开

- **Objective**: 让每个指标展示口径、样本与可展开的真实证据。
- **Requirements**: R3, R5
- **Write set**: `modules/career-insights/web/components/MetricList.tsx`, `modules/career-insights/web/components/EvidenceList.tsx`
- **Provides**: C-WEB-METRIC@1 (design.md §2.2)
- **Consumes**: none
- **Blocked by**: none
- **Deliverable**: `MetricList` 组件按 C-WEB-METRIC@1 渲染指标卡片、status/value 语义、未识别比例与词典版本，并对 `evidence` 提供展开列表；`EvidenceList` 为站内职位证据与外链证据的统一渲染片段。

## T3: 政策—岗位共享主题

- **Objective**: 让共享主题同时展示政策侧与职位侧证据，并明确不表示因果。
- **Requirements**: R4
- **Write set**: `modules/career-insights/web/components/SharedThemeList.tsx`
- **Provides**: C-WEB-THEME@1 (design.md §2.2)
- **Consumes**: none
- **Blocked by**: none
- **Deliverable**: `SharedThemeList` 组件按 C-WEB-THEME@1 渲染主题计数、政策卡片（发布机关、发布时间、证据摘录、官方原文链接）与职位证据链接，并输出固定“不表示因果关系”说明。

## 后续阶段（E1 review PASS 后追加）

## T9: 目标方向视图与技能筛选

- **Objective**: 让学生在总览同页选择目标岗位方向，看到该方向职位、学生友好岗位数、相关指标与政策主题，并可用技能筛选职位。
- **Requirements**: R2, R6
- **Write set**: `modules/career-insights/web/filters.ts`, `modules/career-insights/web/labels.ts`, `modules/career-insights/web/routes/dashboard.tsx`, `modules/career-insights/web/components/CareerFilters.tsx`, `modules/career-insights/web/components/CareerDashboard.tsx`, `modules/career-insights/web/components/DirectionView.tsx`
- **Provides**: C-WEB-FILTER-EXT@1, C-WEB-LABELS@2, C-WEB-DIRECTION@1 (design.md §2.2)
- **Consumes**: C-WEB-METRIC@1, C-WEB-THEME@1 (design.md §2.2)
- **Blocked by**: none
- **Deliverable**: `filters.ts` 新增 `DashboardView`、`parseDirectionView`、`buildDirectionHref`、`buildJobHref`、`safeBackHref`；`labels.ts` 新增 `SKILL_LABELS` 与 `skillLabel`；dashboard loader 解析 `view`/`role_family` 并在方向视图下额外请求学生友好职位总数；`CareerFilters` 新增技能精确筛选输入（datalist 来自 `SKILL_LABELS`）；`DirectionView` 组件按契约渲染方向标题、两个计数、两项指标、共享主题、前 5 条职位与免责声明；`CareerDashboard` 在 `view=direction` 时组装 `DirectionView`，职位行链接带 `back` 参数。

## T10: 职位详情页字段与返回链路

- **Objective**: 让职位详情页展示技能证据与观测时间，并能返回带筛选的职位列表。
- **Requirements**: R3, R5
- **Write set**: `modules/career-insights/web/routes/job.tsx`, `modules/career-insights/web/components/JobDetail.tsx`
- **Provides**: C-WEB-JOB-DETAIL@1 (design.md §2.2)
- **Consumes**: C-WEB-FILTER-EXT@1 (`safeBackHref`), C-WEB-LABELS@1, C-WEB-LABELS@2 (design.md §2.2)
- **Blocked by**: none
- **Deliverable**: `routes/job.tsx` 解析 `back` 并用 `safeBackHref` 传给组件；`JobDetail` 新增 `backHref` prop 与“返回职位列表”链接，展示 `skills`、`skill_evidence`、`published_at`、`first_seen_at`、`last_seen_at`、枚举中文标签、城市/公司/来源与官方原文外链，缺失字段省略。

## T14: 响应式、长文本与状态区调优

- **Objective**: 让看板、筛选、分页、详情页在手机与桌面都可用，长文本不溢出，状态区语义明确。
- **Requirements**: R5, R7
- **Write set**: `modules/career-insights/web/components/CareerFilters.tsx`, `modules/career-insights/web/components/CareerDashboard.tsx`, `modules/career-insights/web/components/Pagination.tsx`, `modules/career-insights/web/components/CareerStates.tsx`, `modules/career-insights/web/components/JobDetail.tsx`
- **Provides**: C-WEB-RESPONSIVE@1 (design.md §2.2)
- **Consumes**: C-WEB-DASH-BIND@1, C-WEB-FILTER@1, C-WEB-JOB-DETAIL@1 (design.md §2.2)
- **Blocked by**: none
- **Deliverable**: 筛选栏手机单列/桌面多列且控件有可访问名称；指标与职位卡片响应式；分页手机显示上一页/下一页与当前页/总页数且不溢出；空态/错误态带 `role` 与明确文案；详情页事实列表单列、长文本 `break-words`、日期用 `<time>`；`JobDetail.tsx` 结尾换行。

## T15: 方向视图可回溯性与文案修正

- **Objective**: 让方向视图的技能指标可回溯到证据，并修正状态文案与缺失技能名。
- **Requirements**: R3, R6
- **Write set**: `modules/career-insights/web/components/DirectionView.tsx`, `modules/career-insights/web/components/MetricList.tsx`, `modules/career-insights/web/labels.ts`
- **Provides**: C-WEB-SKILL-TRACE@1 (design.md §2.2)
- **Consumes**: C-WEB-METRIC@1, C-WEB-LABELS@2, C-WEB-FILTER-EXT@1 (design.md §2.2)
- **Blocked by**: none
- **Deliverable**: 方向视图技能项展示 `统计时间`/`disclaimer`/占比与样本量，并有证据展开（职位站内、政策外链）；`status=not_applicable` 显示“不适用”；`dimension.skill_id` 缺失显示“未指定技能”；`MetricList` 同步该状态语义与标签回退（`ROLE_FAMILY_LABELS[...] ?? 原值`）。

## T22: 时间可读化、严格 ISO 校验与 FilterEmpty 结构收尾

- **Objective**: 把详情页时间显示为可读的中文时间，严格校验 ISO 值，统一筛选空态的可访问结构。
- **Requirements**: R3, R5, R7
- **Write set**: `modules/career-insights/web/components/JobDetail.tsx`, `modules/career-insights/web/routes/job.tsx`, `modules/career-insights/web/components/FilterEmpty.tsx`
- **Provides**: C-WEB-JOB-DETAIL@1（时间展示补充条款）、C-WEB-DASH-BIND@1（FilterEmpty 结构补充条款）(design.md §2.2)
- **Consumes**: C-WEB-LABELS@1 (design.md §2.2)
- **Blocked by**: none
- **Deliverable**: `JobDetail` 的 `published_at`/`first_seen_at`/`last_seen_at` 与 `routes/job.tsx` 观测记录时间显示为 `Asia/Shanghai` 固定时区的中文日期时间，`<time dateTime>` 仅在严格 ISO 且可解析时使用；`FilterEmpty` 用单个 `role="status"` 容器包裹标题与说明、清除链接在容器外；三个文件均以单个换行结尾。

## T24: 时间组件抽取与全站可读时间（E5 复审修复）

- **Objective**: 修正非法日历日期被顺延的问题，并把可读时间统一到所有展示 `as_of` 的位置。
- **Requirements**: R3
- **Write set**: `modules/career-insights/web/time.ts`, `modules/career-insights/web/components/JobDetail.tsx`, `modules/career-insights/web/routes/job.tsx`, `modules/career-insights/web/components/CareerDashboard.tsx`, `modules/career-insights/web/components/MetricList.tsx`, `modules/career-insights/web/components/DirectionView.tsx`
- **Provides**: C-WEB-TIME@1 (design.md §2.2)；C-WEB-JOB-DETAIL@1 时间展示条款
- **Consumes**: C-WEB-METRIC@1, C-WEB-SKILL-TRACE@1 (design.md §2.2)
- **Blocked by**: none
- **Deliverable**: 新增 `time.ts` 导出 `formatCareerDateTime`（严格 `Z` ISO + 回填比对）与 `CareerTime`；`JobDetail` 不再导出时间组件并改从 `../time` 导入；`routes/job.tsx`、`CareerDashboard`（数据截至）、`MetricList`（统计时间）、`DirectionView`（统计时间）统一使用 `CareerTime`；非法日期（如 `2026-02-30`）渲染原文且不输出 `dateTime`。

## 后续阶段

- E4（D5）：浏览器验收、真实备份页面核对、演示兜底