# 角色 C（数据层与指标）分支路线图

> 本文件是角色 C 数据层修复与真实样本复验的本地路线图与报告副本。
> 角色：C：数据层与指标；写集 `modules/career-insights/data/{dictionaries,normalize,metrics}.ts`、
> `modules/career-insights/tests/data-metrics.standalone.test.ts`、本文件。
> 门禁：不写数据库、不改 B/D/E 文件与契约；真实样本复验结论提交 A 线 `--require-data` 评审后由 B/A 重跑 B3。

## 阶段划分与状态

| 阶段 | 范围 | 状态 |
|---|---|---|
| C1 | 真实样本角色/经验归一化修复（`resolveRoleFamily`、`resolveExperience`） | 已完成，待复验 |
| C2 | 真实样本词表扩充（`ROLE_FAMILY_KEYWORDS`、`SKILL_ALIASES`） | 已完成，待复验 |
| C3 | 诊断导出（`computeExperienceDistribution`、`computeEntryLevelShare`、`computeSkillHitRate`）与本次复验报告 | 已完成，待复验 |

## 不可妥协约束（摘自 design.md §2.2）

- `C-REAL-NORMALIZE@1`：`hints.role_family="unknown"` 只表示采集侧未判定，必须继续按标题扫描 `ROLE_FAMILY_KEYWORDS`；只有 4 个已知职族提示可以直接采信。
- 中文经验映射覆盖 `一`..`十`、`两`/`二`、`零`，以及 `以上`、`以内`、`以下`、`-`、`~`、`至`。
- 空经验字段保持 `{min:null,max:null,raw:null}`，不解释成 0 年或“经验不限”。
- `student_friendly` 由既有契约语义派生（校招/实习/明确应届/0–1 年 => yes；明确 2 年以上 => no；无证据 => unknown）；未写经验不得判为 yes。
- `student_friendly_share` 的语义与 `metric_id` 不变，诊断不重写它。
- `C-DIAGNOSTICS@1`：诊断函数排除 `data_origin !== live` 的行并按 `source_key + job_key` 去重；空样本返回 `insufficient_data`/`null`，不返回 0。

## 本次复验（C1–C3）

### 数据来源与口径

- 只读查询 `career_jobs`（未写入、未重跑采集）：30 行，`data_origin=live`，`job_key` 互不相同（两行同名「无人车资深后端研发工程师」为不同 `job_key`，去重后仍为 30）。
- 30 行分属三个源：`tencent-official-careers`、`baidu-official-careers`、`meituan-official-careers`。任务描述中的“Tencent 数据”在库中是三源混合的真实样本，以下数字按 30 行 live 全体统计。
- 修复后数字由“用 DB 现有 `title` / `experience_raw` / `skills` 重新走修复后的 `resolveRoleFamily`、`resolveExperience`、`resolveStudentFriendly` 并调用三个诊断函数”得到；`skills` 的扫描逻辑未变，沿用库中已存的归一化结果。

### 修复点

- `data/normalize.ts`
  - `resolveRoleFamily`：`unknown` 提示不再作为最终答案，改为扫描标题关键词；其余未知值同样回落扫描。
  - `resolveExperience`：`YEAR_TOKEN` 同时接受阿拉伯数字与中文数字（`0`–`99`，含 `十`/`十五`/`二十` 组合，非法组合返回 `null` 不猜）；`以上`/`及以上`/`+`、`以内`/`及以内`/`以下`、`-`/`~`/`—`/`–`/`至`/`到` 均支持；经验字段本身为 `不限`（含既有 `EXPERIENCE_UNLIMITED_PHRASES`）时保留原文，不回填 0。
  - 新增 `parseChineseYears`、`toYears`、`isUnlimitedExperienceText` 三个内部函数，未新增公共 API。
- `data/dictionaries.ts`
  - `ROLE_FAMILY_KEYWORDS`：按 live 标题证据补充 `后台`、`服务器开发`、`移动端`、`桌面端`、`架构师`、`electron`（开发族）；`分析师`（数据族）；`产品策划`、`产品营销`（产品运营族）。
  - `SKILL_ALIASES` / `SKILL_LABELS`：新增 `electron`，证据为真实样本岗位「WorkBuddy-桌面端技术专家-Electron」。
- `data/metrics.ts`：新增 `DiagnosticJobInputV1`、`ExperienceBucketV1`、`EXPERIENCE_BUCKETS_V1` 与三个诊断函数；`data_origin` 为必填字段，非 `live` 一律排除，不给“漏传来源即按 live 计入”留口子；既有五项指标函数签名与语义未改动。

### 修复前后真实数字（30 行 live，as_of 2026-11-19，快照 cutoff `first_seen_at <= 2026-11-19T08:12:40.123Z`）

| 指标 | 修复前 | 修复后 |
|---|---|---|
| `role_family=unknown` | 30/30（100%） | 9/30（30%） |
| `ai_application_development` | 0 | 8 |
| `ai_product_operations` | 0 | 9 |
| `ai_algorithm` | 0 | 3 |
| `data` | 0 | 1 |
| 经验 `missing` | 10（33.3%） | 10（33.3%） |
| 经验 `zero` | 0 | 0 |
| 经验 `zero_to_one` | 0 | 0 |
| 经验 `two_to_three` | 7（23.3%） | 13（43.3%） |
| 经验 `four_to_five` | 3（10.0%） | 6（20.0%） |
| 经验 `six_to_nine` / `ten_plus` | 0 / 0 | 0 / 0 |
| 经验 `unlimited` | 1（3.3%） | 1（3.3%） |
| 经验 `unparsed` | 9（30.0%） | 0 |
| 经验缺失或 0–1 年占比 | 10/30 = 33.3% | 10/30 = 33.3% |
| 技能命中率（≥1 个已识别技能 / 去重 live 职位） | 23/30 = 76.7%，unknown 23.3%，词典 0.1 | 23/30 = 76.7%，unknown 23.3%，词典 0.1 |
| `student_friendly` yes / no / unknown | 0 / 13 / 17 | 0 / 21 / 9 |
| `student_friendly_share`（公开指标） | 0/30 = 0 | 0/30 = 0（语义不变） |

- 快照口径：B3 首次 ingest 的 30 行（`first_seen_at` 2026-11-19T08:08:37.234Z ~ 2026-11-19T08:12:40.123Z，UTC），三个源各 10 行。cutoff 之后 DB 继续采集增长（复验时全表已超过 30 行），新增行不纳入本报告与快照测试，因此数字不会随 DB 增长漂移。
- 经验九桶计数合计 30，占比合计 1；`unparsed` 从 9 归零是中文经验解析生效的直接结果，`missing` 10 行（AI 产品/后端/全栈/分析师/顾问等未写经验的岗位）保持 `missing`，未被回填为 0 或“经验不限”。
- `zero_to_one` 桶口径（本次复审修正）：桶按“岗位要求的最高年限”落桶，开放上界（`max=null`）取其下限。`min=1,max=3` 的「1-3年」按上限 3 年落 `two_to_three`，只有上限 ≤1 年（如 `0-1年`）才算 `zero_to_one`。因此本样本的 `zero_to_one` 为 0，「1-3年」不再被计入入门分子，入门占比由旧口径的 11/30（高估）修正为 10/30 = 33.3%（分子 = `missing` 10 + `zero` 0 + `zero_to_one` 0）。
- 入门占比分子固定为 `missing + zero + zero_to_one`，「不限」单列不计入；修正口径后修复前后同为 33.3%：变的只是原本无法解析的中文经历从 `unparsed` 进入 2–5 年桶。表中“修复前”列同样按修正后的桶口径重算，便于同口径对比。
- 技能命中率未变化：30 行中共 7 行没有任何已识别技能，文本本身不含技能词（见下），新增 `electron` 别名在 live 行中无命中。

### 按来源分别复验（每源 10 行，全部 live）

**腾讯 `tencent-official-careers`（10 行）**

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 职族分布 | unknown 10 | dev 3 / 产品运营 2 / 算法 1 / unknown 4 |
| 经验九桶 | unlimited 1、unparsed 9 | two_to_three 6、four_to_five 3、unlimited 1、unparsed 0、missing 0 |
| 经验缺失或 0–1 年占比 | 0/10 = 0 | 0/10 = 0 |
| 技能命中率 | 4/10 = 40%，unknown 60% | 4/10 = 40%，unknown 60% |
| `student_friendly` yes/no/unknown | 0 / 2 / 8 | 0 / 10 / 0 |

腾讯是中文经验短语最集中的来源：9 行 `三年以上`/`两年以上`/`五年以上` 由 `unparsed` 进入 2–5 年桶，8 行 `unknown` 因此按契约派生为 `no`。

**美团 `meituan-official-careers`（10 行）**

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 职族分布 | unknown 10 | dev 4 / 产品运营 4 / 数据 1 / unknown 1 |
| 经验九桶 | missing 5、two_to_three 2、four_to_five 3 | 不变 |
| 经验缺失或 0–1 年占比 | 5/10 = 50% | 5/10 = 50% |
| 技能命中率 | 9/10 = 90%，unknown 10% | 9/10 = 90%，unknown 10% |
| `student_friendly` yes/no/unknown | 0 / 5 / 5 | 0 / 5 / 5 |

美团行原本就是阿拉伯数字经验（`3年以上`/`5年以上`），经验解析未变化；修复只影响职族（unknown 10 → 1）。

**百度 `baidu-official-careers`（10 行）**

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 职族分布 | unknown 10 | 产品运营 3 / 算法 2 / dev 1 / unknown 4 |
| 经验九桶 | missing 5、two_to_three 4、zero_to_one 1 | missing 5、two_to_three 5、zero_to_one 0 |
| 经验缺失或 0–1 年占比 | 5/10 = 50% | 5/10 = 50% |
| 技能命中率 | 10/10 = 100%，unknown 0 | 10/10 = 100%，unknown 0 |
| `student_friendly` yes/no/unknown | 0 / 6 / 4 | 0 / 6 / 4 |

### 修复后仍为 unknown 的 9 条标题及原因

| 标题 | 来源 | 未映射原因 |
|---|---|---|
| 客工部接待经理（J101012） | 百度 | 接待/行政岗，标题无职族关键词 |
| 渠道经理（J107385） | 百度 | 渠道销售岗，非 AI 技术/产品运营 |
| 伙伴FDE培训设计与教研专家（J107259） | 百度 | 培训/教研专家，非研发岗 |
| 海外服务顾问（J107080） | 百度 | 服务顾问岗 |
| 小象超市-自有商品品质治理专家 | 美团 | 商品品质治理，非 AI 岗位 |
| UE微恐轻动作项目-手游美术项目管理 | 腾讯 | 游戏美术项目管理，非 AI 产品运营 |
| 腾讯云-KA大客户销售经理(物流方向) -北/上/深 | 腾讯 | 大客户销售岗 |
| 腾讯游戏高级品牌经理 | 腾讯 | 品牌市场岗 |
| 腾讯云-南区云原生销售-广州/深圳 | 腾讯 | 销售岗 |

以上 9 条属于 R2 允许保留 `unknown` 的通用非技术标题（百度 4、美团 1、腾讯 4）；不为其推测职族。

### 技能 0 命中的 7 行

腾讯云-云和AI售前架构师、UE微恐轻动作项目-手游美术项目管理、腾讯云-KA大客户销售经理、小象超市-自有商品品质治理专家、腾讯游戏高级品牌经理、腾讯云-南区云原生销售、微信小店-产品策划-b 端产品方向（腾讯 6、美团 1、百度 0）。七行 `skills=[]`，原文为业务/管理描述，未出现可识别技能词；技能命中率因此为 23/30，`unknown_ratio` 如实披露为 23.3%，不把“0 命中”当作指标成功。

### 已知关键词误判（披露，不在本任务修复范围）

| 标题 | 命中关键词 | 结果 | 说明 |
|---|---|---|---|
| 大模型即云计算大客户销售-华南游戏方向（J107254） | `大模型` | `ai_algorithm` | 实为销售岗 |
| 大客户技术支持-大模型方向（J107350） | `大模型` | `ai_algorithm` | 实为技术支持岗 |
| 腾讯云-云和AI售前架构师（物流方向）-北/上/深 | `架构师` | `ai_application_development` | 售前架构师偏解决方案/售前，归开发族是本次新增 `架构师` 关键词带来的误判 |
| 高级安全运营工程师 | `运营` | `ai_product_operations` | 实为安全运营工程岗 |

关键词法只能依据标题文本判定；上述四条按 `C-REAL-NORMALIZE@1`（命中关键词即返回该族）属于既定语义内的结果。其中「售前架构师」是本次词表扩充新引入的偏差（此前该行为 `unknown`），如需收窄应另行评审是否保留 `架构师`。若 A 线认为需要提高准确率，应另立契约引入否决词或最长匹配优先，本任务未擅自改动判定机制。

### 契约符合性

- `C-REAL-NORMALIZE@1`：已知提示优先、`unknown` 回落标题扫描；经验中文数字/单位覆盖；空经验保持 null；`student_friendly` 复用既有派生逻辑（`1-3年` 不满足 0–1 年条件，不产生 yes；`两年以上`/`三年以上` 变为 no）。
- `C-DIAGNOSTICS@1`：三个函数均返回去重后 live 样本量、`excluded_count`（非 live 行）与 `duplicate_count`；空样本 `status=insufficient_data`、`value=null`；技能函数在“无任何已识别技能”时同样返回 `insufficient_data`。

### 验证

- `npx tsc -p modules/tsconfig.json`：通过（exit 0）。
- `node --import ./tests/standalone.ts --test modules/career-insights/tests/data-metrics.standalone.test.ts`：15 tests / 15 pass / 0 fail。
- `data-metrics.standalone.test.ts` 覆盖：中文经验解析、`unknown` 提示回落、checked-in 腾讯列表样本（示例数据，非 DB 快照）10 行的职族/经验/学生友好、真实 DB 30 行 cutoff 快照（`2026-11-19T08:12:40.123Z`）复现本报告数字、`1-3年` 不入 `zero_to_one` 的桶边界、九桶分布与入门占比、技能命中率、空样本口径、非 live 排除与重复行去重。
- 本报告数字来自只读查询 + 修复后函数重算，未写库、未重跑采集、未改迁移与 B/D/E 文件。
## 样本演进与口径分层（2026-11-19）

三个样本层级并存，**禁止互相替代或混用**：

| 层级 | 行数 | 口径 | 用途 |
|---|---|---|---|
| 历史快照 | 30 | 首轮 B3 ingest，`first_seen_at <= 2026-11-19T08:12:40.123Z`，1 页/源 | 上文 C1–C3 复验报告与快照测试的固定输入；属历史快照，不随库增长 |
| 权威全表 | 40 | 1 页/源；normalizer 0.2.0 经 backfill 覆盖 40/40 | 归一化覆盖率与职族/经验分布的权威口径（baidu 11 / meituan 18 / tencent 11） |
| 扩采窗口基线 | 74 | 2 页/源（3 源 × 2 页） | `--pages 2` 扩采后的窗口基线，不是全量岗位库 |

- 40 行 → 74 行：`career_jobs` 40 → 74，`career_job_observations` 196 → 230，`career_policies` 6，`career_ingest_runs` 33 → 38；按源 baidu 20 / meituan 33 / tencent 21。
- 74 行分布：`role_family` unknown 47 / ai_product_operations 13 / ai_application_development 10 / data 2 / ai_algorithm 2；`student_friendly` no 57 / unknown 17（`yes` = 0）；`skills` 非空 55/74。
- `current_metrics` 的 30 行快照属上表第一层的历史输入，**不得与 40 行或 74 行全表数字混用**；引用 74 行时必须同时标注 3 源 / 2 页窗口 / `as_of` / unknown 单列（A 的裁定见 B 路线图）。

## 0.2.0 归一化版本刷新（C-NORMALIZER-REFRESH@1 / C-ROLE-KEYWORDS@2）

### 变更

- `NORMALIZER_VERSION = "normalizer/0.2.0"`；`NormalizedJobV1.normalizer_version` 为必填字段，归一化与入库都写入当前版本。
- 迁移 `modules/career-insights/migrations/0163_career_jobs_normalizer_version.sql`：`normalizer_version text NOT NULL DEFAULT 'normalizer/0.1.0'`，历史行回填 `normalizer/0.1.0`。
- `content_hash` 输入收窄为源内容：`schema_version`、`source_key`、`job_key`、`company_name`、`title`、`locations`、`degree_raw`、`experience_raw`、`raw_text`。`role_family`、`student_friendly`、`skills`、`skill_evidence`、解析后的 degree/experience 与 `normalizer_version` 不参与。
- `writeJob` 结果：新建 → `accepted`（写版本 + 1 条观测）；同源内容 + 版本/派生相同 → 只推进 `last_seen_at`，`duplicates`；同源内容 + 版本不同或派生不同 → 刷新派生字段与版本，`duplicates`，**不写新观测**；源内容变化 → 全量更新 + 新观测，`updated`。0.1.0 旧哈希与新算法不可比时，按源内容字段整体比较判定“源内容未变”，避免重入库把 34 行误判为内容变化。
- 词表（`C-ROLE-KEYWORDS@2`）：移除裸 `运营`，并移除 `大模型`、`架构师`、`解决方案`；`ai_product_operations` 仅保留 `ai产品`、`产品运营`、`产品经理`、`产品策划`、`产品营销`、`增长运营`、`用户增长`。`unknown` 提示继续回落标题扫描，已知提示仍优先。

### 六条负例（`data-normalize.standalone.test.ts`）

| # | 标题 | 期望 |
|---|---|---|
| 1 | 高级安全运营工程师 | `unknown`（裸 `运营` 已移除） |
| 2 | 游戏运营 / K6合作部-游戏运营-社区及用户运营 | `unknown` |
| 3 | 大模型即云计算大客户销售-华南游戏方向（J107254） | `unknown`（裸 `大模型` 已移除） |
| 4 | 大客户技术支持-大模型方向（J107350） | 非 `ai_algorithm` |
| 5 | 腾讯云-云和AI售前架构师（物流方向）-北/上/深 | `unknown`（`架构师` 已移除） |
| 6 | 通讯-商务拓展专家-运营商方向 / 渠道经理 / 客工部接待经理 / 海外服务顾问 | `unknown` |

同时断言收窄不伤明确岗位：`AI产品运营岗`、`ima-高级产品经理（基础框架）` → `ai_product_operations`；`全栈开发工程师` → `ai_application_development`；已知 `data` 提示仍优先于标题。

### 真实 34 行离线对比（as_of 2026-11-19，只读 15432，全表 34 行）

这是**诊断性重算**：用当前库的 `title` / `experience_raw` / `employment_type` / `skills` 走 0.2.0 实现重算，并与库中存储的 0.1.0 结果对比；**不是数据库刷新**，B 将重新 ingest 后由 0.2.0 写入。

| 指标 | 存储值（0.1.0） | 0.2.0 重算 |
|---|---|---|
| `role_family=unknown` | 28/34 | 18/34 |
| `ai_application_development` | 2 | 7 |
| `ai_product_operations` | 3 | 7 |
| `ai_algorithm` | 1 | 1 |
| `data` | 0 | 1 |
| 经验 `missing` | 11 | 11 |
| 经验 `zero` / `zero_to_one` | 0 / 0 | 0 / 0 |
| 经验 `two_to_three` | 13 | 13 |
| 经验 `four_to_five` | 7 | 8 |
| 经验 `six_to_nine` | 1 | 1 |
| 经验 `ten_plus` / `unlimited` | 0 / 1 | 0 / 1 |
| 经验 `unparsed` | 1 | 0 |
| 经验缺失或 0–1 年占比 | 11/34 = 32.4% | 11/34 = 32.4% |
| 技能命中率 | 24/34 = 70.6%，unknown 29.4%，词典 0.1 | 24/34 = 70.6%，unknown 29.4%，词典 0.1 |
| `student_friendly` yes / no / unknown | 0 / 23 / 11 | 0 / 24 / 10 |

- 职族变化 14 条：12 条 `unknown` 变得有证据（2 条无人车后端 → 开发族；AI 全栈/后端/全栈开发 → 开发族；AI 产品经理/运营/营销、产品营销专家、差旅产品经理、社区产品经理 → 产品运营族；智能商业分析师 → 数据族），2 条由误判回到 `unknown`（`WorkBuddy-生态合作运营`、`通讯-商务拓展专家-运营商方向`）。0.1.0 阶段的「大模型 → 算法」「运营 → 产品运营」「架构师 → 开发」误判在本版本消失。
- 经验变化 1 条：`腾讯云-云和AI售前架构师` 的 `五年以上工作经验` 从 `unparsed` 解析为 min 5 → `four_to_five`，其余 33 行不变（库中其余中文经验此前已由 B 重入库解析）。
- `student_friendly` 变化 1 条：同一岗位因经验解析为 5 年而由 `unknown` 变为 `no`；未写经验的 11 行仍为 `unknown`，`student_friendly_share` 定义未变。
- 技能命中率不变：0.2.0 未改技能词典；34 行中 10 行没有任何已识别技能，`unknown_ratio` 如实披露。

### 验证

- `npx tsc -p modules/tsconfig.json`：通过（exit 0）。
- `node --import ./tests/standalone.ts --test .../data-dedupe + data-normalize + data-metrics`：33 tests / 33 pass / 0 fail。
- 5433 `aihot_test`：`ingest.test.ts` + `repository.test.ts` 共 16 tests / 16 pass / 0 fail（含 3 条刷新场景：版本升级刷新、旧哈希跨版本刷新、同版本派生变化刷新，均不新增 observation）。
- 未写 15432：生产库仅执行 `SELECT`。worktree 下 `scripts/migrate.ts` 的 `REPO_ROOT` 解析到主仓库，global setup 不会应用本 worktree 的新迁移；本次在 5433 模板库直接调用 `runMigrations(process.cwd())` 应用 0163 后再跑 DB 测试。

## 11-20 后全量样本与职族口径（2026-11-20）

- 引用来源：完整口径见 `career-collector-roadmap.md` 的「LLM 归一化兜底与职族精度（2026-11-20）」节（`llm-0.1` → `llm-0.2` → `llm-0.3` 三次落地、回填对账与 `90494b8` 的 ASCII 词边界修复；该节已按最终值 120/63.8% 更新）；本节只登记引用规则，不复制该节的过程数字。
- 样本（2026-11-20 23:5x～11-21 00:0x CST，库内只读复核）：`career_jobs` **188** 行、`career_job_observations` **440** 行、`career_policies` 6、`career_briefs` 1；观测日 2（CST 日粒度）；`data_origin` 全部 `live`（188/188）。
- 职族（分母 188，unknown 单列）：11-20 批（PR #16 合入 main 时）为 `unknown` **121/188 = 64.4%**、`ai_application_development` 33、`ai_product_operations` 17、`data` 10、`ai_algorithm` 7；此后本分支 `90494b8`（未进 main）定向修复 1 行（「AI Agent 产品经理」误降）→ `ai_product_operations` 18、`unknown` **120/188 = 63.8%**。无论取哪一版，unknown 都是「宁可未分类也不误判」的口径，**不代表** 63.8%～64.4% 的岗位与 AI 无关；方向占比、技能趋势只能使用已分类子集，且必须同段写分母、把 unknown 单列。
- 归一化版本（分母 188）：`llm-0.3` 132、`llm-0.1` 31、`0.3.0` 23、`llm-0.2` 2；`llm-*` 按当前版本计（`3b12577`），`summary` 不再报 `stale_data`。
- 其它分布（分母 188）：`student_friendly` no 163 / unknown 21 / yes 4；空 `skills` 45/188 = 23.9%，`summary` 与 `/daily` 的 `unknown_ratio` 均为 45/188 口径（技能 unknown，不是职族 unknown）。
- 引用纪律：任何占比必须带分母与 unknown 单列；30 行历史快照、40 行权威全表、74 行扩采窗口三层仍按「样本演进与口径分层（2026-11-19）」使用，**不得**与 188 行全量口径混用或互相换算。

## 最近更新

- **2026-11-19**：`origin/feat/integration` = `a5191f7`（stage 合并并推送）；本地后续提交 `254c7dc`。
- 本次同步：新增「样本演进与口径分层」——30 行历史快照、40 行权威全表（1 页/源）、74 行扩采窗口基线（2 页/源）三层交叉说明；`current_metrics` 30 行快照属历史，不得与全表混用。既有 C1–C3 与 0.2.0 的历史结论保持不变。
- **2026-11-20**：新增「11-20 后全量样本与职族口径」：`career_jobs` 188 行、`career_job_observations` 440 行；职族 `unknown` 在 PR #16 合入时为 121/188 = 64.4%，本分支 `90494b8` 修复 1 行后为 120/188 = 63.8%（collector 路线图同节已按后者更新）。按「宁可未分类也不误判」引用；任何占比必须带分母与 unknown 单列，30/40/74 三层旧口径继续有效、不得与 188 行混用。
