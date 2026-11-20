import { redirect, useLoaderData } from "react-router";
import { SITE } from "@aihot/site";
import type { Route } from "./+types/home";
import type {
  CareerCatalogResponseV1,
  CareerDailyResponseV1,
  CareerSignalsResponseV1,
  JobListResponseV1,
  SummaryResponseV1,
} from "@aihot/career-insights/contracts";
import { cachedPage } from "../lib/api.server";
import { logError } from "../lib/errors.server";
import { pageReuse } from "../lib/page-reuse";
import { pageMeta, siteLd } from "../lib/seo";
import type { Screen } from "../components/shell/screens";
import type { HomeBriefState, HomeBriefV1 } from "../features/home/contracts.ts";
import { HOME_CATALOG_LIMIT } from "../features/home/contracts.ts";
import { HomeWorkbench } from "../features/home/HomeWorkbench.tsx";
import {
  careerBriefPath,
  careerCatalogPath,
  careerDailyPath,
  careerLatestJobsPath,
  careerSignalsPath,
  careerSummaryPath,
  loadCareerBrief,
  loadCareerCatalog,
  loadCareerDaily,
  loadCareerLatestJobs,
  loadCareerSignals,
  loadCareerSummary,
} from "../../../../modules/career-insights/web/feeds.server.ts";

export const handle: Screen = { tab: "featured", name: "首页" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

/** 单区块失败只降级该区块：记一条请求日志，返回 null 由页面显示「本区块暂时不可用」。 */
async function settled<T>(path: string, promise: Promise<T>, signal: AbortSignal): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (!signal.aborted) logError(error, { msg: "home block failed", method: "GET", path });
    return null;
  }
}

/** 研判区块要区分「无缓存(204)」与请求失败，单独收敛。 */
async function settledBrief(signal: AbortSignal): Promise<HomeBriefState> {
  try {
    const data = await loadCareerBrief<HomeBriefV1>(signal);
    return data === null ? { status: "empty" } : { status: "ok", data };
  } catch (error) {
    if (!signal.aborted) logError(error, { msg: "home block failed", method: "GET", path: careerBriefPath() });
    return { status: "failed" };
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  // Search lives on /all; keep the parameters so old links still land on results.
  if (q && q.trim()) throw redirect(`/all${url.search}`);

  const signal = request.signal;
  const [summary, catalog, signals, daily, latestJobs, brief] = await Promise.all([
    settled<SummaryResponseV1>(careerSummaryPath(), loadCareerSummary(signal), signal),
    settled<CareerCatalogResponseV1>(
      careerCatalogPath(HOME_CATALOG_LIMIT),
      loadCareerCatalog<CareerCatalogResponseV1>(HOME_CATALOG_LIMIT, signal),
      signal,
    ),
    settled<CareerSignalsResponseV1>(careerSignalsPath(), loadCareerSignals(signal), signal),
    settled<CareerDailyResponseV1>(careerDailyPath(), loadCareerDaily(signal), signal),
    settled<JobListResponseV1>(careerLatestJobsPath(), loadCareerLatestJobs<JobListResponseV1>(signal), signal),
    settledBrief(signal),
  ]);

  // 工作台数据变化慢：共享缓存一分钟，浏览器在同一个 deadline 内复用。
  return cachedPage(60, { summary, catalog, signals, daily, latestJobs, brief });
}

export function meta() {
  return [
    ...pageMeta({
      path: "/",
      description: "已有什么岗位、需求在怎么变、我该怎么准备：同一屏看完的就业数据工作台。",
      jsonLd: siteLd(),
    }),
    // Webmaster platforms look for their verification tag on the home page only.
    ...Object.entries(SITE.siteVerification).map(([name, content]) => ({ name, content })),
  ];
}

export default function Home() {
  const { summary, catalog, signals, daily, latestJobs, brief } = useLoaderData<typeof loader>();
  return (
    <HomeWorkbench
      summary={summary}
      catalog={catalog}
      signals={signals}
      daily={daily}
      latestJobs={latestJobs}
      brief={brief}
    />
  );
}