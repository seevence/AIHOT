# Career Insights 前端

## 页面

- `/career-insights`：通过正式 HTTP API 并行读取 summary 与 jobs，展示样本、指标、共享主题和职位列表。
- `/career-insights/jobs/:id`：读取职位详情与观测记录。

正式页面只使用 `@aihot/web/lib/api.server` 请求 `/api/site/career-insights/*`，不导入 fixture、数据库或密钥。API 返回 503 时页面显示“数据尚未就绪”，不会自动回退 fixture；加载、空态、请求错误和单快照均有独立可见状态。

## 本地 fixture 联调

在 AIHOT 仓库根目录启动独立服务：

```bash
node modules/career-insights/web/fixture-server.ts
```

另开终端，让 Web SSR 的 API 指向该服务：

```bash
API_BASE_URL=http://127.0.0.1:3101 npm run dev:web
```

fixture 服务只监听 `127.0.0.1:3101`，仅提供 summary、jobs 和固定职位详情三个 GET 数据响应，不写数据库。页面看到 `data_origin=synthetic_fixture` 时会显示“联调样例（非真实数据）”。