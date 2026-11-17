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
| E3 | D4：集中调优 | 空态/错误态、长文本、大屏与手机响应式、筛选体验、方向视图可回溯性、E1/E2 遗留 minor | 开发中 | - |
| E4 | D5：第二次采集与联调 | 浏览器验收、真实备份页面核对、演示兜底（截图/录屏说明） | 未开始 | - |

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