# 1. Requirements

## 1.1 Requirement Areas

### R1: 看板总览与数据边界披露
前端看板向学生展示本次公开样本的范围与时效，所有数字来自 API。
- The system shall 显示有效职位数、公司数、来源数、数据截止时间、技能词典版本和 API 返回的 warnings。
- While 数据只覆盖单个观测时点，the system shall 显示“单快照”提示并且不渲染涨跌。
- Where API 返回 `data_origin=synthetic_fixture`，the system shall 显示“联调样例（非真实数据）”。

### R2: 职位筛选与分页
学生可按后端支持的维度筛选职位，并与总览同屏查看。
- When 学生选择或输入筛选项（`role_family`、`company`、`city`、`employment_type`、`student_friendly`）或翻页，the system shall 以 URL 查询参数重新请求 `/jobs` 并保持 `/summary` 同时展示。
- The system shall 使用 `JobFiltersV1` 的字段名作为 URL 参数名，`page` 从 1 开始，`page_size` 取 20 或 50。
- If 筛选后列表为空，the system shall 显示筛选无结果空态并允许一键清除筛选。
- While 页面处于请求中，the system shall 显示加载状态。

### R3: 指标与证据展开
每个指标可解释、可回溯。
- The system shall 展示 `MetricResultV1` 的 label、value、样本量、`as_of`、disclaimer，以及 `unknown_count`/`unknown_ratio`/`dictionary_version`（若存在）。
- When 学生展开某个指标，the system shall 列出该指标的 evidence：`kind=job` 的条目链接到 `/career-insights/jobs/:id`，其他 kind 打开 `official_url`。
- If `status=insufficient_data` 或 `value=null`，the system shall 显示“数据不足”而不是 0。
- If `status=not_applicable`，the system shall 显示“不适用”。

### R4: 政策—岗位共享主题与两侧证据
共享主题只表达方向呼应。
- The system shall 为每个 `SharedThemeV1` 展示主题名、政策数与职位数。
- When 学生展开某个主题，the system shall 同时列出政策侧证据（issuer、published_at、evidence_excerpt、官方原文链接）与职位侧证据（标题、公司、详情链接）。
- The system shall 不计算任何综合分，并展示“只表示方向呼应，不表示因果关系”的固定说明。

### R5: 页面状态
- If API 返回 503，the system shall 显示“数据尚未就绪”并提供重试。
- If API 返回 400/404/500，the system shall 分别显示参数错误、不存在、暂时无法加载。
- The system shall 为看板与详情页提供加载骨架/提示。

### R6: 目标方向视图（E2）
- When 学生选定一个 `role_family`，the system shall 展示该方向的高频技能（来自后端 `skill_demand_share` 指标的 `dimension.skill_id`）、可申请的应届/实习职位（`/jobs` 筛选结果）与相关政策主题。
- The system shall 注明“基于本次公开样本，不代表完整就业市场或录用概率”。

### R7: 响应式与演示兜底（E3/E4）
- The system shall 在手机（≤640px）与桌面（≥1024px）均可完成 5 分钟演示主路径。
- The system shall 不因长标题、长证据文本破坏布局。

# 2. Technical Design

## 2.1 Architecture and Implementation Boundaries

- 运行在 AIHOT `apps/web`（React Router v8 SSR + Tailwind v4 自定义 token：`text-ink/text-ink-2/text-ink-3/text-ink-4`、`bg-surface/bg-bg-sunk`、`rounded-card`、`border-line/border-line-strong`、`text-accent/bg-accent`）。
- 数据入口保持 SSR loader → `@aihot/web/lib/api.server` 的 `loadOr404`，路径 `/api/site/career-insights/summary|jobs|jobs/:id`；不在浏览器端 fetch，不新增 API。
- 筛选状态由 URL 查询参数驱动（`request.url`），loader 解析后同时传给组件回填；组件使用 `Link` 生成筛选/翻页地址，不引入客户端状态库。
- 组件拆分：`CareerDashboard` 仅负责布局与组装，筛选控件、指标列表、共享主题列表、职位列表、分页各自独立文件，由 E1 三个任务并行实现。
- 枚举选项来自 `@aihot/career-insights/contracts` 的 `RoleFamily`/`EmploymentType`/`StudentFriendly`；`company`/`city` 在 E1 使用精确匹配文本输入，不做前端聚合推导。
- 不改动 `module.ts`、`server.ts`、`contracts/**`、`data/**`、`fixtures/**`、`backend/**`、`migrations/**`、`site/modules/**`（属 A/C/D），不新增依赖。
- `web/fixture-server.ts` 保留为本地联调工具；正式 route 不引用它。

## 2.2 Interface Contracts

### C-WEB-FILTER@1: URL 筛选与请求参数
- Provider / Consumers: T1（provider）；`routes/dashboard.tsx` loader 与 `CareerFilters`（consumer，同属 T1）; Requirements: R2
- Public surface (exact, copy-paste), file `modules/career-insights/web/api.ts`:
  - `export const JOB_PAGE_SIZES: readonly [20, 50]`
  - `export function parseDashboardFilters(search: URLSearchParams): JobFiltersV1` — 读取同名参数；非法/未知 `role_family|employment_type|student_friendly` 值忽略、`page` 非正整数取 1、`page_size` 不在 `JOB_PAGE_SIZES` 取 20；`company|city|skill` 为空串时省略。返回值必含 `page`、`page_size`。
  - `export function buildJobsHref(filters: JobFiltersV1): string` — 返回 `/career-insights?<query>`；仅序列化已定义的 `JobFiltersV1` 字段，参数顺序固定为 `role_family,company,city,employment_type,student_friendly,skill,page,page_size`，`page=1` 与 `page_size=20` 也显式写出。
  - 保留现有 `careerApiPath`、`serializeJobFilters`、`loadCareerApi` 不变。
- Ownership: T1 独占 `web/filters.ts`（纯函数实现）与 `web/api.ts`（re-export 上述四项，保留 `careerApiPath`/`loadCareerApi`）。
- 模块边界（2026-11-17 澄清，向后兼容）：`JOB_PAGE_SIZES`、`parseDashboardFilters`、`buildJobsHref`、`serializeJobFilters` 的实现必须位于 `modules/career-insights/web/filters.ts`，且该文件不得引用 `@aihot/web/lib/api.server` 或任何 `.server` 模块；`web/api.ts` 必须 `export ... from "./filters"` 以保持本契约公共面；客户端组件（`CareerFilters.tsx`、`CareerDashboard.tsx`、`Pagination.tsx`）必须从 `../filters` 导入纯函数，禁止从 `../api` 导入。
- Failure semantics: 解析函数不抛错；非法值按上述默认值降级，避免 400 页面。
- Interaction semantics / status: READY

### C-WEB-LABELS@1: 枚举中文标签共享常量
- Provider / Consumers: T1 同时提供并消费；`components/CareerFilters.tsx` 与 `components/CareerDashboard.tsx` 共用。Requirements: R2
- Public surface (exact, copy-paste), file `modules/career-insights/web/labels.ts`:
  - `export const ROLE_FAMILY_LABELS: Record<RoleFamily, string>`
  - `export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string>`
  - `export const STUDENT_FRIENDLY_LABELS: Record<StudentFriendly, string>`（`unknown` 文案为“未知”）
- Ownership: T1 独占 `web/labels.ts`、`components/CareerFilters.tsx`、`components/CareerDashboard.tsx`；两个组件内不得重复定义映射。
- Failure semantics: 查表缺失时回退显示原值字符串。
- Interaction semantics / status: READY

### C-WEB-DASH-BIND@1: 看板组装绑定
- Provider / Consumers: T1（`components/CareerDashboard.tsx`，provider of layout）；T2（`MetricList`）、T3（`SharedThemeList`）作为被引用组件（consumer of 本契约的 props 形状）。Requirements: R1, R2, R3, R4
- Public surface (exact, copy-paste), file `modules/career-insights/web/components/CareerDashboard.tsx`:
  - `export function CareerDashboard({ summary, jobs, filters }: { summary: SummaryResponseV1; jobs: JobListResponseV1; filters: JobFiltersV1 })`
  - 组装顺序：header → fixture/单快照提示 → `CareerFilters`（props `{ filters }`）→ 样本概况 → warnings → `<MetricList metrics={summary.metrics} />` → `<SharedThemeList themes={summary.shared_themes} />` → 职位列表（列表由本文件内的 `JobRow` 渲染）→ `<Pagination page={jobs.page} pageSize={jobs.page_size} total={jobs.total} />`
  - 空态规则：`summary.sample_size === 0 || jobs.items.length === 0` 时渲染 `CareerEmpty`；当 `jobs.total === 0` 且存在任一筛选条件时改为渲染 `FilterEmpty`（T1 在 `components/Pagination.tsx` 同级新增 `components/FilterEmpty.tsx`，内容含清除筛选链接 `/career-insights`）。
  - `FilterEmpty` 结构（2026-11-17 补充，E5 收尾）：`<section>` 内用一个 `<div role="status">` 同时包裹标题 `<h2>` 与说明 `<p>`；“清除筛选”链接位于该 `div` 之外、`<section>` 之内。
- 向后兼容扩展（2026-11-17，补充 Contract 空白）：`CareerDashboard` 新增可选 prop `direction?: { roleFamily: RoleFamily; studentFriendlyTotal: number }`；存在时在职位列表区块之前渲染 `<DirectionView roleFamily={direction.roleFamily} summary={summary} jobs={jobs} studentFriendlyTotal={direction.studentFriendlyTotal} filters={filters} />`；缺失时保持 E1 组装顺序不变。`routes/dashboard.tsx` 的 loader 返回 `direction` 字段，取值由 `parseDirectionView` 决定。
- 组装顺序补充（2026-11-17 复审后）：总览视图下在 `CareerFilters` 之后、样本概况之前渲染“按目标方向查看”四个方向的 `DirectionLinks`（使用 `buildDirectionHref`）；方向视图下 `CareerFilters` 的表单必须携带 `view=direction` 与 `role_family=<当前方向>` 两个隐藏字段，避免应用筛选时静默退出方向视图。
- Ownership: T9 独占 `components/CareerDashboard.tsx`、`components/CareerFilters.tsx`、`components/Pagination.tsx`、`components/FilterEmpty.tsx`、`components/DirectionView.tsx`、`routes/dashboard.tsx`、`web/filters.ts`、`web/labels.ts`。
- Failure semantics: 组件不做任何数据转换与计算，只渲染 API 值。
- Interaction semantics / status: READY

### C-WEB-METRIC@1: 指标列表与证据展开
- Provider / Consumers: T2 提供 `components/MetricList.tsx`；T1 的 `CareerDashboard` 消费。Requirements: R3, R5
- Public surface (exact, copy-paste):
  - `export function MetricList({ metrics }: { metrics: MetricResultV1[] })`
  - 每个 metric 渲染为 `<article>`，固定 `data-metric-id={metric.metric_id}`；当 `metric.status === "ok" && metric.evidence.length > 0` 时渲染 `<details><summary>证据（N）</summary>…</details>`，否则不渲染展开控件。
  - `kind === "job"` 的 evidence 渲染 `<Link to={`/career-insights/jobs/${encodeURIComponent(ev.id)}`}>`；其余 kind 渲染 `<a href={ev.official_url} target="_blank" rel="noopener noreferrer">`。
  - 数值显示：`status === "insufficient_data"` → “数据不足”；`status === "not_applicable"` → “不适用”；`value === null` → “数据不足”；`unit === "ratio"` → `(value*100).toFixed(1) + "%"`；`unit === "count"` → `${value} 个`；其他 → `String(value)`。
  - 可选字段仅在存在时渲染：`unknown_count` 显示“未识别 N 个”、`unknown_ratio` 显示“未识别占比 x%”、`dictionary_version` 显示“词典 v…”。
- 维度标签（2026-11-17 补充，E3 复审）：当 `metric.dimension.role_family` 存在时，在同一 `<dl>` 渲染一行“方向”，值取 `ROLE_FAMILY_LABELS[role_family] ?? role_family`；卡片 `key` 必须包含 dimension 值（`${metric_id}:${skill_id ?? role_family ?? theme_id ?? index}`），`index` 为数组下标兜底，禁止多处共用 `"global"` 造成 key 冲突。
- Ownership: T2 独占 `components/MetricList.tsx`（可另建 `components/EvidenceList.tsx` 供自身使用）。
- Failure semantics: `evidence` 为空或 metric 缺失字段时只省略对应区块，不抛错。
- Interaction semantics / status: READY

### C-WEB-THEME@1: 共享主题两侧证据
- Provider / Consumers: T3 提供 `components/SharedThemeList.tsx`；T1 的 `CareerDashboard` 消费。Requirements: R4
- Public surface (exact, copy-paste):
  - `export function SharedThemeList({ themes }: { themes: SharedThemeV1[] })`
  - `themes.length === 0` 时返回 `null`（不渲染区块）。
  - 每个 theme 渲染 `<li data-theme-id={theme.theme_id}>`，标题行显示 `theme.label`、`政策 {policy_count}`、`岗位 {job_count}`，并渲染 `<details><summary>两侧证据</summary>…</details>`。
  - 政策侧：`<a href={policy.official_url} target="_blank" rel="noopener noreferrer">`，显示 `policy.title`、`policy.issuer`、`policy.published_at`、`policy.evidence_excerpt`、`policy.source_tier`（存在即显示）。
  - 职位侧：`<Link to={`/career-insights/jobs/${encodeURIComponent(job.id)}`}>`，显示 `job.title`。
  - 固定说明文案：`只表示政策方向与招聘需求的呼应，不表示因果关系。`
- Ownership: T3 独占 `components/SharedThemeList.tsx`。
- Failure semantics: 任一侧为空时该侧显示“暂无证据”，另一侧照常渲染。
- Interaction semantics / status: READY

### C-WEB-FILTER-EXT@1: 方向视图与详情返回参数（向后兼容 C-WEB-FILTER@1）
- Provider / Consumers: T9 提供 `web/filters.ts`；T10 的 `routes/job.tsx` 消费 `safeBackHref`。Requirements: R2, R3, R6
- Public surface (exact, copy-paste), file `modules/career-insights/web/filters.ts`:
  - `export type DashboardView = "overview" | "direction"`
  - `export function parseDirectionView(search: URLSearchParams): { view: DashboardView; roleFamily?: RoleFamily }` — 仅 `view=direction` 时 `view="direction"`，否则 `"overview"`；`role_family` 经枚举白名单校验，非法省略。
  - `export function buildDirectionHref(roleFamily: RoleFamily): string` — 返回 `/career-insights?view=direction&role_family=<id>&page=1&page_size=20`。
  - `export function buildJobHref(jobId: string, back: string): string` — 返回 `/career-insights/jobs/${encodeURIComponent(jobId)}?back=${encodeURIComponent(back)}`。
  - `export function safeBackHref(raw: string | null): string` — 仅当 `raw === "/career-insights"` 或 `raw.startsWith("/career-insights?")`、且不含 `//` 与 `:` 时原样返回，否则返回 `/career-insights`（2026-11-17 收严：前缀必须是完整路径边界，不得匹配 `/career-insights-evil`）。
- Ownership: T9 独占 `web/filters.ts`；T10 只导入 `safeBackHref`，不得修改该文件。
- Failure semantics: 非法值一律回退 `overview` / `/career-insights`，不抛错。
- Interaction semantics / status: READY

### C-WEB-LABELS@2: 技能中文标签（向后兼容 C-WEB-LABELS@1）
- Provider / Consumers: T9 提供 `web/labels.ts`；T10 的 `JobDetail` 消费。Requirements: R3, R6
- Public surface (exact, copy-paste), file `modules/career-insights/web/labels.ts`:
  - `export const SKILL_LABELS: Readonly<Record<string, string>>` — 至少覆盖 `data/dictionaries.ts` 中 SKILL_ALIASES 的全部目标 ID：`python, sql, machine_learning, deep_learning, pytorch, tensorflow, large_language_models, natural_language_processing, computer_vision, data_analysis, data_mining, data_engineering, spark, java, javascript, typescript, react, nodejs`。
  - `export function skillLabel(skillId: string): string` — 查表缺失时返回把 `_` 替换为空格的原 ID。
- Ownership: T9 独占 `web/labels.ts`；T10 只读导入。
- Failure semantics: 缺失回退原 ID 的可读形式。
- Interaction semantics / status: READY

### C-WEB-DIRECTION@1: 目标方向视图（同页，不新增路由）
- Provider / Consumers: T9 提供 `components/DirectionView.tsx`；T9 的 `CareerDashboard` 消费。Requirements: R6
- Public surface (exact, copy-paste):
  - `export function DirectionView({ roleFamily, summary, jobs, studentFriendlyTotal, filters }: { roleFamily: RoleFamily; summary: SummaryResponseV1; jobs: JobListResponseV1; studentFriendlyTotal: number; filters: JobFiltersV1 })`
  - 渲染顺序（2026-11-17 修订，E2 复审后）：
    1. 标题“目标岗位方向：{ROLE_FAMILY_LABELS[roleFamily]}” + 四个方向的切换链接（`buildDirectionHref`，当前方向加 `aria-current="page"`）。
    2. 口径说明：`职位计数与职位列表按所选方向过滤；指标与共享主题为全站口径，暂不按方向过滤。`（固定文案，必须与指标/主题区块同屏可见）
    3. 两个计数：`该方向职位 {jobs.total}`、`其中学生友好 {studentFriendlyTotal}`。
    4. 技能需求列表（自渲染，不得用 MetricList）：取 `summary.metrics.filter(m => m.metric_id === "skill_demand_share")`，逐项显示 `skillLabel(m.dimension.skill_id ?? "")`、占比（`unit=ratio` 按 `(value*100).toFixed(1)+"%"`，`status!=="ok"||value===null` 显示“数据不足”）与样本量；`key={`${m.metric_id}:${m.dimension.skill_id ?? "global"}`}`。
    5. 其余指标：`<MetricList metrics={summary.metrics.filter(m => m.metric_id !== "skill_demand_share")} />`。
    6. `<SharedThemeList themes={summary.shared_themes} />`。
    7. 前 5 条职位链接：`<Link to={buildJobHref(job.id, buildDirectionHref(roleFamily))}>`。
    8. “查看该方向全部职位”链接：`buildJobsHref({ ...filters, role_family: roleFamily, page: 1 })`。
    9. 固定文案 `以上组合基于本次公开样本与 0.1 版词典，不代表完整就业市场或录用概率。`
  - 空态：`jobs.items.length === 0 && jobs.total === 0` 渲染“该方向暂无职位”；`jobs.items.length === 0 && jobs.total > 0` 渲染“当前页没有职位”并给回第 1 页链接。
- Ownership: T9 独占 `components/DirectionView.tsx`。
- Failure semantics: 所有数字直接取自 API（`jobs.total`、额外请求的 `studentFriendlyTotal`、指标 value），组件内不做计算或聚合；指标口径不得被改写为“该方向”。
- Interaction semantics / status: READY

### C-WEB-JOB-DETAIL@1: 详情页字段与返回链路
- Provider / Consumers: T10 提供 `routes/job.tsx` 与 `components/JobDetail.tsx`。Requirements: R3, R5
- Public surface (exact, copy-paste):
  - `routes/job.tsx`：loader 中 `const back = new URL(request.url).searchParams.get("back");`，向组件传 `backHref={safeBackHref(back)}`（`safeBackHref` 从 `../filters` 导入）。
  - `export function JobDetail({ job, backHref }: { job: JobDetailV1; backHref: string })`：返回链接 `<Link to={backHref}>返回职位列表</Link>`。
  - 新增展示（存在才渲染）：`skills` 逐项用 `skillLabel(skill_id)`；`skill_evidence` 显示 `skillLabel(skill_id)` + `evidence_text`；`published_at`、`first_seen_at`、`last_seen_at`；`student_friendly` 用 `STUDENT_FRIENDLY_LABELS`、`employment_type` 用 `EMPLOYMENT_TYPE_LABELS`、`role_family` 用 `ROLE_FAMILY_LABELS`；`city`、`company`、`source_key` 原样显示；`official_url` 外链带 `target="_blank" rel="noopener noreferrer"`。
  - 时间展示（2026-11-17 补充，E5 收尾；同日按用户裁定修订）：所有面向用户的时间字段（`as_of`、`published_at`、`first_seen_at`、`last_seen_at`、观测 `observed_at`）必须由 `web/time.ts` 导出的 `CareerTime` 渲染。合法性判定：匹配 `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$` 且 `new Date(value)` 可解析；**允许自然顺延**（按该年该月实际天数：闰年 2 月 29 天、平年 28 天；`2024-02-29` 保持 2 月 29 日，`2025-02-29` 顺延为 3 月 1 日，`2026-02-30` 顺延为 3 月 2 日），不做回填比对拒绝。展示为 `Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" })` 的结果，`dateTime` 属性输出 `new Date(value).toISOString()` 的 canonical 值（与可见日期一致）；不可解析时渲染原文纯文本。`JobDetail.tsx` 不导出时间组件；`routes/job.tsx`、`CareerDashboard.tsx`、`MetricList.tsx`、`DirectionView.tsx` 统一从 `../time` 导入。
  - 原有观测记录区块与错误/未找到状态保持不变。
- Ownership: T10 独占 `routes/job.tsx`、`components/JobDetail.tsx`。

### C-WEB-TIME@1: 时间展示组件（E5 补充）
- Provider / Consumers: T24 提供 `modules/career-insights/web/time.ts`；T24 的 `components/JobDetail.tsx`、`routes/job.tsx`、`components/CareerDashboard.tsx`、`components/MetricList.tsx`、`components/DirectionView.tsx` 消费。Requirements: R3
- Public surface (exact, copy-paste):
  - `export function formatCareerDateTime(value: string): string | null` — 严格 `Z` 后缀 ISO 且 `new Date(value)` 可解析即返回格式化文本（允许自然顺延）；否则 `null`。
  - `export function CareerTime({ value, className }: { value: string; className?: string })` — 合法时 `<time dateTime={new Date(value).toISOString()} className={className}>{formatCareerDateTime(value)}</time>`；否则 `<span className={className}>{value}</span>`。
- 使用点：`JobDetail` 的 `published_at`/`first_seen_at`/`last_seen_at`；`routes/job.tsx` 观测 `observed_at`；`CareerDashboard` 的“数据截至 {summary.as_of}”；`MetricList` 的“统计时间 {metric.as_of}”；`DirectionView` 技能项“统计时间 {m.as_of}”。政策卡片 `SharedThemeList` 的 `policy.published_at` 暂保留原文（后端政策日期格式待 D 确认，见协同表第 9 项）。
- Ownership: T24 独占上述 6 个文件；`web/time.ts` 不得 import 任何 `.server` 模块或 React 以外依赖。
- Failure semantics: 不可解析的时间渲染原文，不抛错；合法但日期越界的值按 JS `Date` 自然顺延（预期行为，用户已裁定）；`dateTime` 只对可解析值输出 canonical ISO。
- Interaction semantics / status: READY
- Failure semantics: 缺失字段省略对应行；不展示未在 API 返回中的推测值。
- Interaction semantics / status: READY

### C-WEB-SKILL-TRACE@1: 方向视图技能可回溯性（E3 补充）
- Provider / Consumers: T15 提供 `components/DirectionView.tsx` 的技能列表区。Requirements: R3, R6
- Public surface (exact, copy-paste):
  - 每条 `skill_demand_share` 的 `<li data-skill-id={m.dimension.skill_id ?? "global"}>` 内显示：`skillLabel(...)`、占比/“数据不足”/“不适用”（`status === "not_applicable"` → “不适用”）、`样本量 {sample_size}`、`统计时间 {as_of}`、`disclaimer`。
  - 当 `m.evidence.length > 0` 时渲染 `<details><summary>证据（N）</summary>`；`kind === "job"` 用 `<Link to={buildJobHref(ev.id, buildDirectionHref(roleFamily))}>`，其余 kind 用 `<a href={ev.official_url} target="_blank" rel="noopener noreferrer">`。
  - `dimension.skill_id` 缺失时名称显示“未指定技能”而不是空白。
  - `unknown_count`/`unknown_ratio` 存在时按 C-WEB-METRIC@1 的合并文案展示（`未识别 N 个 · 未识别占比 x%`）。
  - 证据展开仅当 `m.status === "ok" && m.evidence.length > 0` 时渲染，与 MetricList 一致。
- Ownership: T15 独占 `components/DirectionView.tsx`、`components/MetricList.tsx`、`web/labels.ts`。
- Failure semantics: 字段缺失省略对应行；`evidence` 为空不渲染展开控件。
- Interaction semantics / status: READY

### C-WEB-RESPONSIVE@1: 响应式与长文本约束（E3 补充，样式契约）
- Provider / Consumers: T14 提供并自检；覆盖 `components/CareerFilters.tsx`、`components/CareerDashboard.tsx`、`components/Pagination.tsx`、`components/CareerStates.tsx`、`components/JobDetail.tsx`。Requirements: R7
- 约束（可判定）：
  - 全页不出现横向滚动：长标题、长证据摘录、长 URL 文本使用 `break-words`（外链可 `break-all`），容器不使用固定像素宽度。
  - 手机宽度（≤640px）：筛选表单字段单列、按钮全宽；指标卡片单列（`grid-cols-1`）；分页仅显示上一页/下一页 + 当前页/总页数，不横向溢出；详情页事实列表单列。
  - 桌面（≥1024px）：指标卡片最多 2 列；方向视图技能与指标区两列。
  - 每个筛选控件有可访问名称（`label htmlFor` 或 `aria-label`）；分页当前页保持 `aria-current="page"`；空态/错误态区域使用 `role="status"` 或 `role="alert"`。
  - ≤640px 时即使隐藏页码按钮，仍须有可见元素携带 `aria-current="page"`（例如“第 N / M 页”文本）；`role="status"` 区域内不得包含可聚焦控件（链接/按钮需移出该区域）。
  - 所有改动文件以单个换行结尾。
- Ownership: T14 独占上述 5 个文件（`DirectionView.tsx` 由 T15 负责其内部两列布局）。
- Failure semantics: 样式/结构改动不得改变任何已冻结契约的 props 与文案语义。
- Interaction semantics / status: READY

## 2.3 Service Interaction Matrix & Open Decisions

| Caller | Callee | Method | Transaction boundary | Lock order | Idempotency |
| ------ | ------ | ------ | -------------------- | ---------- | ----------- |
| `routes/dashboard.tsx` loader (T1) | Web SSR → API `GET /summary` | `loadCareerApi<SummaryResponseV1>` | 无事务（只读） | 无 | 幂等只读 |
| `routes/dashboard.tsx` loader (T1) | Web SSR → API `GET /jobs` | `loadCareerApi<JobListResponseV1>` | 无事务（只读） | 无 | 幂等只读，参数由 `parseDashboardFilters` 归一 |

开放决策（本期已定）：
- 筛选值来源：枚举用 contracts 常量；`company`/`city`/`skill` 用精确匹配文本输入（E1 不做前端聚合推导，避免不完整选项误导）。
- 分页大小：仅 20/50，`page_size` 超范围由前端归一，后端仍会校验。
- 证据跳转：`kind=job` 走站内详情页，其余走官方外链。
- 前端不展示政策独立列表页：政策证据只在共享主题内展示（后端未提供政策列表 API）。
