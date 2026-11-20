import { isRouteErrorResponse, useLoaderData, useNavigation, useRouteError } from "react-router";
import type { LoaderArgs } from "@aihot/web/lib/route-types";
import type { Screen } from "@aihot/web/components/shell/screens";
import type { JobListResponseV1 } from "@aihot/career-insights/contracts";
import type { CareerCatalogResponseV1 } from "../../contracts/index.ts";
import { careerApiPath, loadCareerApi, parseDashboardFilters, serializeJobFilters } from "../api";
import { CATALOG_LIMIT, CATALOG_WINDOW_DAYS, JobsCatalogBoard } from "../components/JobsCatalogBoard";
import { CareerError, CareerLoading, CareerPending } from "../components/CareerStates";

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

export function meta() {
  return [{ title: "热门岗位" }];
}

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
      <JobsCatalogBoard catalog={data.catalog} jobs={data.jobs} filters={data.filters} />
    </>
  );
}