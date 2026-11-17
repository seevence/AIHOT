# 品牌改造清单：AIHOT → 就业HOT（D 提供，归属待队长裁定）

> 状态：清单完成，**未执行任何 site/ 改动**
> 归属：`site/site.ts`、`site/changelog.json`、`site/brand/**` 未出现在云端 `ROADMAP.md` 任何角色的独占写集中（BLK-01）
> 建议：由 A 执行，或由队长书面授权 D 以单个 commit 执行
> 日期：2026-11-17

## 一、必须改的配置（`site/site.ts`）

| 字段 | 当前值 | 目标值 | 说明 |
|---|---|---|---|
| `SITE.name` | `MyHOT` | `就业HOT` | 导航、标题、分享图、RSS、MCP、后台统一读取 |
| `SITE.subject` | `AI` | `就业` | 派生“就业日报”“就业动态” |
| `SITE.homeTitle` | `MyHOT — AI 行业动态 · 每日精选与日报` | `就业HOT — AI+ 就业趋势 · 每日精选与日报` | 浏览器标题与搜索结果 |
| `SITE.topicsTitle` | `AI 主题：公司与模型、技术方向、内容形态的最新动态` | `就业主题：岗位方向、技能需求与政策动态` | 主题目录页 |
| `SITE.description` | AI 热点站一句话介绍 | `用公开招聘与政策证据，帮助大学生看懂企业在招什么、政策在支持什么、自己该补什么。` | 搜索引擎、分享卡片、RSS、llms.txt |
| `SITE.tagline` | `值得关注的 AI 动态` | `看得懂的就业趋势` | 分享图、海报 |
| `SITE.keywords` | `["AI 资讯","AI 新闻","AI 日报","AI 行业动态"]` | `["AI 就业","就业趋势","招聘数据","技能需求","大学生就业"]` | 首页结构化数据 |
| `SITE.organization.name` | `MyHOT` | `就业HOT` | 结构化数据运营者 |
| `SITE.crawlerName` | `MyHOTBot/1.0` | `JiuYeHOTBot/1.0` | User-Agent，不冒用他站 |
| `SITE.footerNote` | `由 AIHOT 开源框架驱动` | `null` | 去上游品牌 |
| `SITE.poweredBy` | `{ name: "AIHOT", url: "https://aihot.news" }` | `null` | 去上游品牌与链接 |

## 二、保持不动（需单独评审）

| 字段 | 当前值 | 处理 | 理由 |
|---|---|---|---|
| `SITE.mcpPrefix` | `myhot` | 保持 | 公开工具名 `myhot_get_latest` 等；改名需升 `interfaceVersion` 主版本 |
| `SITE.interfaceVersion` | `4.0.0` | 保持 | 品牌不改变公开接口标识 |
| `SITE.locale` / `defaultUrl` | `zh-CN` / `http://localhost:3000` | 保持 | 域名由部署环境变量 `SITE_URL` 控制 |

## 三、其他文件

| 文件 | 改动 | 风险 |
|---|---|---|
| `site/changelog.json:10` | “用 AIHOT 开源框架搭起了这个站…” 改为不含 AIHOT 的品牌化文案 | 低 |
| `site/brand/**` | grep 未发现 AIHOT 文字；需人工确认 Logo 图形不是上游标识 | 中（需目检） |

## 四、验收命令（A 或授权执行者）

```bash
rg -n "MyHOT" site apps modules --glob '!**/node_modules/**'   # 期望 0 命中
rg -n "AIHOT|aihot.news" site --glob '!**/node_modules/**'      # 期望 0 命中（上游 LICENSE/NOTICE/README 除外）
npm run typecheck
npm run build -w @aihot/web
```

## 五、执行前置

- [ ] 队长确认正式站名是否就是“就业HOT”（BLK-04）
- [ ] 队长裁定 `site/site.ts` 归属（BLK-01）
- [ ] 确认 `footerNote` / `poweredBy` 是全移除还是保留非品牌化“基于开源框架”（BLK-10）
- [ ] 确认是否保留上游仓库链接（`SITE.github`）