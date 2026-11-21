import { isRouteErrorResponse, useLoaderData, useNavigation, useRouteError, type MetaFunction } from "react-router";
import type { LoaderArgs } from "@aihot/web/lib/route-types";
import { pageMeta } from "@aihot/web/lib/seo";
import type { Screen } from "@aihot/web/components/shell/screens";
import type { JobListResponseV1 } from "@aihot/career-insights/contracts";
import type { CareerCatalogResponseV1 } from "../../contracts/index.ts";
import { careerApiPath, loadCareerApi, parseDashboardFilters, serializeJobFilters } from "../api";
import { CATALOG_LIMIT, CATALOG_WINDOW_DAYS, JobsCatalogBoard } from "../components/JobsCatalogBoard";
import { CareerError, CareerLoading, CareerPending } from "../components/CareerStates";
import { JobStarButton } from "../components/JobStarButton";

export async function loader({ request }: LoaderArgs) {
  const search = new URL(request.url).searchParams;
  const filters = parseDashboardFilters(search);
  const [catalog, jobs] = await Promise.all([
    loadCareerApi<CareerCatalogResponseV1>(
      `${careerApiPath("/catalog")}?limit=${CATALOG_LIMIT}&window_days=${CATALOG_WINDOW_DAYS}`,
      request.signal,
    ),
    loadCareerApi<JobListResponseV1>(`${careerApiPath("/jobs")}?${serializeJobFilters(filters)}`, request.signal),
  ]);
  return { catalog, jobs, filters };
}

export function headers() {
  return { "Cache-Control": "no-store" };
}

export const handle: Screen = { tab: "jobs", name: "热门岗位" };

/**
 * 关键词只改这一页的结果视图，因此 canonical 固定指向不带查询的列表页，避免把每个搜索词都登记成
 * 独立页面；标题带关键词，读者与分享预览能看出这是搜索结果。
 */
export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const keyword = loaderData?.filters.q;
  return pageMeta({
    title: keyword ? `岗位搜索：${keyword}` : "热门岗位",
    description: keyword
      ? `「${keyword}」相关岗位：按职位名、公司、技能与城市搜索当前有效岗位，每条岗位附官方原文链接。`
      : "按职族与职位聚合的当前有效岗位，可按关键词、学生友好与城市筛选，每条岗位附官方原文链接。",
    path: "/career-insights/jobs",
  });
};

export const HydrateFallback = CareerLoading;

export function ErrorBoundary() {
  const error = useRouteError();
  return <CareerError status={isRouteErrorResponse(error) ? error.status : 500} />;
}

export default function JobsCatalogRoute() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  return (
    <>
      {navigation.state === "loading" && (
        <div className="mb-3">
          <CareerPending label="正在加载筛选结果…" />
        </div>
      )}
      <JobsCatalogBoard catalog={data.catalog} jobs={data.jobs} filters={data.filters} starButton={JobStarButton} />
    </>
  );
}