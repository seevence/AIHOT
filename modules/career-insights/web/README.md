# Career Insights 前端

## 页面

- `/`（首页，2026-11-21 L1）：5 段 —— 今日概览 / AI 就业研判（只留 inferences ≤3 + actions ≤3） / 需求变化三指标（学生友好岗位带口径注） / 最新就业日报摘要+入口 / 热门方向 Top3 一行入口；不再请求 signals 与 latest jobs。
- `/career-insights`（2026-11-21 L2）：8 段 —— AI 趋势研判（完整 facts/inferences/actions/limitations/evidence）/ 不同寻常的信号（带数字依据与原文链接，skipped 分组提示）/ 岗位趋势 / 技能趋势 / 热门岗位摘要卡 + 跳转 jobs / 学生就业建议 / 政策与岗位联动（无共同主题整段隐藏）/ 数据范围与方法。通过正式 HTTP API 并行读取 summary、catalog、signals、brief，逐块降级。
- `/career-insights/jobs/:id`：读取职位详情与观测记录。
- `/career-insights/policies`：政策列表页，通过正式 HTTP API 读取 `/api/site/career-insights/policies`，支持 `source_key`、`theme`、`page`、`page_size` 查询参数与分页；参数非法时显示页面级错误状态，不回退 fixture。
- `/hot`：企业招聘热度榜，读取 `/api/site/career-insights/hot?limit=10`（公司、岗位数、前 3 个职族、最近发布日期）。
- `/daily`：就业日报，读取 `/api/site/career-insights/daily`（当日各来源采集结果、今日新增与库表计数、空技能岗位占比）。
  （已更新：`/daily` 由站点日报改为就业日报；站点日报的 `/weekly`、`/monthly` 仍走 `/api/site/reports/*`。）

正式页面只使用 `@aihot/web/lib/api.server` 请求 `/api/site/career-insights/*`，不导入 fixture、数据库或密钥。API 返回 503 时页面显示“数据尚未就绪”，不会自动回退 fixture；加载、空态、请求错误和单快照均有独立可见状态。

## 接口现状（正式 API）

- `GET /api/site/career-insights/summary`
- `GET /api/site/career-insights/jobs`
- `GET /api/site/career-insights/jobs/:id`
- `GET /api/site/career-insights/policies`：查询参数 `source_key`、`theme`、`page`（1–10000）、`page_size`（1–100，默认 20）；未知的 `source_key` / `theme`、非法页码或未支持的查询参数均返回 400 `invalid_parameter`；所有响应带 `Cache-Control: no-store`。
- `GET /api/site/career-insights/hot`：查询参数 `limit`（1–50，默认 10）、`window_days`（1–365，默认 30）；未支持参数返回 400 `invalid_parameter`。
- `GET /api/site/career-insights/daily`：不接受查询参数。
- `GET /api/site/career-insights/signals`：查询参数 `limit`（1–50，默认 10）、`window_days`（1–365，默认 30）。

## 本地 fixture 联调

在 AIHOT 仓库根目录启动独立服务：

```bash
node modules/career-insights/web/fixture-server.ts
```

另开终端，让 Web SSR 的 API 指向该服务：

```bash
API_BASE_URL=http://127.0.0.1:3101 npm run dev:web
```

fixture 服务只监听 `127.0.0.1:3101`（可用 `CAREER_FIXTURE_PORT` 改端口，避开并行测试），~~仅提供 summary、jobs 和固定职位详情三个 GET 数据响应~~（已更新：现在同时提供 `GET /api/site/career-insights/policies`，接受 `source_key`、`theme`、`page`、`page_size`；`source_key` 按 6 条样例的固定下标切分模拟后端过滤，非法参数返回 400 `invalid_parameter`，响应同样带 `no-store`），不写数据库。页面看到 `data_origin=synthetic_fixture` 时会显示“联调样例（非真实数据）”。（已更新：同时提供 `GET /api/site/career-insights/hot`、`daily`、`signals` 三个只读响应，供 `/hot`、`/daily` 与看板信号卡联调。）