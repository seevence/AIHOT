import { isRouteErrorResponse, useLoaderData, useNavigation, useRouteError } from "react-router";
import type { LoaderArgs } from "@aihot/web/lib/route-types";
import type { JobListResponseV1, SummaryResponseV1 } from "@aihot/career-insights/contracts";
import { careerApiPath, loadCareerApi, parseDashboardFilters, serializeJobFilters } from "../api";
import { CareerDashboard } from "../components/CareerDashboard";
import { CareerError, CareerLoading } from "../components/CareerStates";

export async function loader({ request }: LoaderArgs) {
  const filters = parseDashboardFilters(new URL(request.url).searchParams);
  const query = serializeJobFilters(filters);
  const [summary, jobs] = await Promise.all([
    loadCareerApi<SummaryResponseV1>(careerApiPath("/summary"), request.signal),
    loadCareerApi<JobListResponseV1>(`${careerApiPath("/jobs")}?${query}`, request.signal),
  ]);
  return { summary, jobs, filters };
}

export function headers() {
  return { "Cache-Control": "no-store" };
}

export function meta() {
  return [{ title: "职业洞察" }];
}

export const HydrateFallback = CareerLoading;

export function ErrorBoundary() {
  const error = useRouteError();
  return <CareerError status={isRouteErrorResponse(error) ? error.status : 500} />;
}

export default function CareerDashboardRoute() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  if (navigation.state === "loading") return <CareerLoading />;
  return <CareerDashboard summary={data.summary} jobs={data.jobs} filters={data.filters} />;
}